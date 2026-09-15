import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Attempt } from '@/domain/exercise';
import type { Pillar } from '@/domain/pillar';
import { finishSession, getMastery, getRecentFingerprints, startSession } from '@/data/repositories/progress';
import {
  applyReward,
  computeReward,
  emptyLedger,
  type DailyLedger,
  type RewardPolicy,
} from '@/engine/economy';
import type { MasteryState } from '@/engine/mastery';
import { getLedger, grantTime, saveLedger } from '@/data/repositories/rewards';
import { lighten, withAlpha } from '@/lib/color';
import { useActiveChild, useAppStore } from '@/state/appStore';
import { useSession } from '@/state/useSession';
import { Aparece } from '@/ui/components/Aparece';
import { Axo, type ExpresionAxo } from '@/ui/components/Axo';
import { Confeti } from '@/ui/components/Confeti';
import { ExercisePrompt, PanelEnunciado, StudyPhase } from '@/ui/components/ExercisePrompt';
import { Button, Gap, Screen, Txt } from '@/ui/components/primitives';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import { MIN_TOUCH_TARGET, marca, pillarColor, radius, shadow, space, typography } from '@/ui/theme';
import { useMovimientoReducido } from '@/ui/useMovimientoReducido';

/**
 * Sesión de retos, en modo arcade.
 *
 * Es la pantalla que más se usa de toda la app, así que su prioridad es que no
 * estorbe: un reto por pantalla, sin navegación y con retroalimentación
 * inmediata. Todo el estado de la sesión vive en `useSession`; aquí solo se
 * dibuja y se persiste al terminar.
 *
 * No hay botón para volver al inicio. La guía visual lo dibujaba, pero salir a
 * mitad de tanda deja los retos resueltos sin conceder, y desde el lado del
 * menor eso se vive como una injusticia: es la misma razón por la que el gesto
 * de retroceso está desactivado en el layout.
 */
export default function SessionScreen() {
  const palette = usePalette();
  const child = useActiveChild();
  const settings = useAppStore((state) => state.settings);
  const ledger = useAppStore((state) => state.ledger);
  const syncPolicy = useAppStore((state) => state.syncPolicy);
  const refresh = useAppStore((state) => state.refreshActiveChild);

  const [context, setContext] = useState<{
    mastery: Record<Pillar, MasteryState>;
    recentFingerprints: string[];
    sessionId: string;
    seed: string;
    startedAt: number;
  } | null>(null);

  // La semilla se genera aquí dentro, no en el cuerpo del componente: `Date.now()`
  // durante el render es impuro y produciría una semilla distinta en cada
  // rerender. Fijada una sola vez, la sesión es reproducible y volver atrás no
  // cambia los retos.
  useEffect(() => {
    if (!child) return undefined;
    let cancelled = false;

    (async () => {
      const startedAt = Date.now();
      const seed = `${child.id}|${startedAt}`;
      const [mastery, recentFingerprints, sessionId] = await Promise.all([
        getMastery(child.id),
        getRecentFingerprints(child.id),
        startSession(child.id, seed),
      ]);
      if (!cancelled) setContext({ mastery, recentFingerprints, sessionId, seed, startedAt });
    })();

    return () => {
      cancelled = true;
    };
  }, [child]);

  if (!child || !settings || !context) {
    return (
      <Screen>
        <Txt variant="body" color={palette.textMuted}>
          Preparando tus retos…
        </Txt>
      </Screen>
    );
  }

  return (
    <SessionRunner
      band={child.band}
      seed={context.seed}
      size={settings.sessionSize}
      mastery={context.mastery}
      focusPillars={settings.focusPillars}
      allowOpenResponse={settings.allowOpenResponse}
      recentFingerprints={context.recentFingerprints}
      policy={settings.rewardPolicy}
      ledger={ledger ?? emptyLedger(context.startedAt, settings.rewardPolicy)}
      startedAt={context.startedAt}
      onFinished={async (attempts) => {
        const freshLedger = await getLedger(child.id, settings.rewardPolicy);
        const breakdown = computeReward(attempts, settings.rewardPolicy, freshLedger, Date.now());

        await finishSession({
          sessionId: context.sessionId,
          childId: child.id,
          attempts,
          grantedMinutes: breakdown.grantedMinutes,
        });
        await saveLedger(child.id, applyReward(freshLedger, breakdown, settings.rewardPolicy, Date.now()));

        if (breakdown.grantedMinutes > 0) {
          await grantTime({ childId: child.id, minutes: breakdown.grantedMinutes, source: 'session' });
        }

        // La política se reenvía al guardián nativo *después* de asentar los
        // minutos: al revés, el bloqueo se levantaría antes de que exista el
        // permiso que lo justifica.
        await syncPolicy();
        await refresh();

        router.replace({
          pathname: '/(child)/result',
          params: {
            minutes: String(breakdown.grantedMinutes),
            correct: String(breakdown.correctCount),
            total: String(attempts.length),
            capped: breakdown.cappedByDailyLimit ? '1' : '0',
          },
        });
      }}
    />
  );
}

// ---------------------------------------------------------------------------

interface RunnerProps {
  band: Parameters<typeof useSession>[0]['band'];
  seed: string;
  size: number;
  mastery: Record<Pillar, MasteryState>;
  focusPillars: readonly Pillar[];
  allowOpenResponse: boolean;
  recentFingerprints: readonly string[];
  policy: RewardPolicy;
  /** Libro del día al empezar, para calcular los minutos que se van ganando. */
  ledger: DailyLedger;
  startedAt: number;
  onFinished: (attempts: readonly Attempt[]) => Promise<void>;
}

function SessionRunner({ onFinished, policy, ledger, startedAt, ...props }: RunnerProps) {
  const palette = usePalette();
  const styles = useStyles();

  const session = useSession({
    band: props.band,
    seed: props.seed,
    size: props.size,
    mastery: props.mastery,
    focusPillars: props.focusPillars,
    recentFingerprints: props.recentFingerprints,
    allowOpenResponse: props.allowOpenResponse,
  });

  // Guarda contra un doble cierre: `onFinished` escribe en la base y concede
  // minutos, así que ejecutarlo dos veces duplicaría el tiempo otorgado.
  const finishing = useRef(false);

  useEffect(() => {
    if (session.phase !== 'terminada' || finishing.current) return;
    finishing.current = true;
    void onFinished(session.attempts);
  }, [session.phase, session.attempts, onFinished]);

  // Los minutos que se van ganando se calculan con la misma función que
  // concederá el tiempo al cerrar la tanda, con decaimiento y tope incluidos,
  // para que el número de la barra no prometa lo que después no se da. Solo se
  // retira el premio de sesión perfecta: contarlo por adelantado haría que el
  // número bajara al primer fallo, y equivocarse no debe restar nada a la vista.
  const politicaSinBono = useMemo(() => ({ ...policy, perfectBonusMinutes: 0 }), [policy]);
  const minutosDe = (attempts: readonly Attempt[]) =>
    computeReward(attempts, politicaSinBono, ledger, startedAt).grantedMinutes;

  const exercise = session.exercise;

  if (!exercise || session.phase === 'terminada') {
    return (
      <Screen>
        <Txt variant="body" color={palette.textMuted}>
          Calculando tus minutos…
        </Txt>
      </Screen>
    );
  }

  const reviewing = session.phase === 'revisando';
  const attempt = session.lastAttempt;
  const acierto = attempt?.grade.outcome === 'correct' || attempt?.grade.outcome === 'accepted';
  const acumulados = minutosDe(session.attempts);
  const ganadosEnEste = reviewing ? acumulados - minutosDe(session.attempts.slice(0, -1)) : 0;

  // La cara se deriva de la fase y no se guarda: la sorpresa queda reservada
  // para los últimos diez segundos, cuando conviene que el menor levante la vista.
  const expresion: ExpresionAxo = reviewing
    ? acierto
      ? 'acierto'
      : 'fallo'
    : session.secondsLeft !== null && session.secondsLeft <= 10
      ? 'sorpresa'
      : 'reto';

  return (
    <View style={styles.pantalla}>
      <LinearGradient
        colors={[palette.arcadeFondoArriba, palette.arcadeFondoAbajo]}
        style={StyleSheet.absoluteFill}
      />
      {/* Dos manchas de marca, quietas. En la guía van desenfocadas; aquí son
          círculos con muy poca opacidad, que dan el mismo ambiente sin pagar un
          desenfoque en tiempo real en teléfonos modestos. */}
      <View pointerEvents="none" style={[styles.mancha, styles.manchaMorada]} />
      <View pointerEvents="none" style={[styles.mancha, styles.manchaAqua]} />

      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right', 'bottom']}>
        <Cabecera
          avance={(session.index + (reviewing ? 1 : 0)) / session.total}
          minutos={acumulados}
          indice={session.index}
          total={session.total}
          segundos={session.secondsLeft}
        />

        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {session.phase === 'estudiando' && exercise.prompt.kind === 'sequence_recall' ? (
            <StudyPhase
              instruction={exercise.prompt.instruction}
              sequence={exercise.prompt.sequence}
              onSkip={session.finishStudy}
            />
          ) : (
            <Aparece key={exercise.id} desde="derecha">
              <View style={styles.axo}>
                <Axo
                  // Remontar al cambiar de cara es lo que vuelve a disparar la
                  // reacción en cada reto.
                  key={`${exercise.id}-${expresion}`}
                  ancho={150}
                  expresion={expresion}
                  tinte={pillarColor[exercise.pillar]}
                />
              </View>

              <PanelEnunciado exercise={exercise} />
              <Gap size="lg" />

              <ExercisePrompt
                exercise={exercise}
                disabled={reviewing}
                grade={attempt?.grade ?? null}
                onRespond={(response) => {
                  // La vibración diferencia acierto de fallo sin necesidad de leer,
                  // que es justo lo que hace falta a los 6 años.
                  const willBeCorrect =
                    (exercise.prompt.kind === 'multiple_choice' ||
                      exercise.prompt.kind === 'sequence_recall') &&
                    response.kind === 'choice' &&
                    response.index === exercise.prompt.correctIndex;

                  void Haptics.notificationAsync(
                    willBeCorrect
                      ? Haptics.NotificationFeedbackType.Success
                      : Haptics.NotificationFeedbackType.Warning,
                  ).catch(() => undefined);

                  session.submit(response);
                }}
              />

              {/* En la revisión la pista se retira: ya no ayuda a responder, y
                  quedaría tapada por la hoja que sube desde abajo. */}
              {session.hintVisible && !reviewing && exercise.prompt.hint ? (
                <Aparece desde="abajo" style={styles.pista}>
                  <Text style={styles.pistaIcono}>💡</Text>
                  <View style={styles.flex}>
                    <Text style={styles.pistaTexto}>{exercise.prompt.hint}</Text>
                    <Text style={styles.pistaNota}>Con pista, este reto vale algunos minutos menos.</Text>
                  </View>
                </Aparece>
              ) : null}
            </Aparece>
          )}
        </ScrollView>

        {reviewing && attempt ? (
          <HojaRevision
            key={exercise.id}
            attempt={attempt}
            indice={session.index}
            ultimo={session.index + 1 >= session.total}
            ganados={ganadosEnEste}
            onSiguiente={session.next}
          />
        ) : session.canRequestHint ? (
          <View style={styles.pie}>
            <Pressable
              onPress={session.requestHint}
              accessibilityRole="button"
              style={({ pressed }) => [styles.botonPista, pressed && styles.pulsado]}
            >
              <Text style={styles.botonPistaTexto}>💡 AXO, dame una pista</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      <Confeti semilla={exercise.id} activo={reviewing && acierto} />
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Barra de energía.
 *
 * Convierte el avance de la tanda en algo que se ve llenarse; el contador
 * «2 de 5» decía lo mismo y no lo sentía nadie. Se conserva al lado, en
 * pequeño, para quien sí quiere el número.
 *
 * El relleno anima `width`, que no admite el driver nativo. Es la única
 * animación de la sesión en el hilo de JavaScript, y dura medio segundo.
 */
function Cabecera({
  avance,
  minutos,
  indice,
  total,
  segundos,
}: {
  avance: number;
  minutos: number;
  indice: number;
  total: number;
  segundos: number | null;
}) {
  const styles = useStyles();
  const movimientoReducido = useMovimientoReducido();
  const [relleno] = useState(() => new Animated.Value(avance));

  useEffect(() => {
    if (movimientoReducido) {
      relleno.setValue(avance);
      return undefined;
    }
    const animacion = Animated.timing(relleno, {
      toValue: avance,
      duration: 500,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    });
    animacion.start();
    return () => animacion.stop();
  }, [relleno, avance, movimientoReducido]);

  const urgente = segundos !== null && segundos <= 10;

  return (
    <View style={styles.cabecera}>
      <View style={styles.flex}>
        <View style={styles.energiaEtiquetas}>
          <Text style={styles.energiaMicro}>ENERGÍA</Text>
          <Text style={styles.energiaMinutos}>+{minutos} min</Text>
        </View>
        <View
          style={styles.barra}
          accessibilityRole="progressbar"
          accessibilityLabel="Retos completados"
          accessibilityValue={{ min: 0, max: total, now: Math.round(avance * total) }}
        >
          <Animated.View
            style={[
              styles.barraRelleno,
              { width: relleno.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          >
            <LinearGradient
              colors={[marca.lima, lighten(marca.aqua, 0.3)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>

      {segundos !== null ? (
        <View style={[styles.chip, urgente && styles.chipUrgente]}>
          <Text style={[styles.chipTexto, urgente && styles.chipTextoUrgente]}>⏱ {segundos}s</Text>
        </View>
      ) : null}
      <View style={styles.chip}>
        <Text style={styles.chipTexto}>
          {indice + 1}/{total}
        </Text>
      </View>
    </View>
  );
}

const ELOGIOS = ['¡Muy bien!', '¡Lo tienes!', '¡Exacto!', '¡Genial!', '¡Perfecto!'];
const ANIMOS = ['Casi lo tenías', 'Buen intento', 'Ya casi'];

/**
 * Hoja de revisión.
 *
 * Sube desde abajo en lugar de aparecer en su sitio: así el menor ve primero
 * cuál era la correcta en la cuadrícula, y el texto llega después a explicarlo.
 */
function HojaRevision({
  attempt,
  indice,
  ultimo,
  ganados,
  onSiguiente,
}: {
  attempt: Attempt;
  indice: number;
  ultimo: boolean;
  ganados: number;
  onSiguiente: () => void;
}) {
  const palette = usePalette();
  const styles = useStyles();
  const { outcome, feedback, expected } = attempt.grade;
  const acierto = outcome === 'correct' || outcome === 'accepted';

  const titulo = acierto
    ? (ELOGIOS[indice % ELOGIOS.length] as string)
    : outcome === 'skipped'
      ? 'Se acabó el tiempo'
      : (ANIMOS[indice % ANIMOS.length] as string);

  const detalle = acierto
    ? ganados > 0
      ? `Ganaste ${ganados} ${ganados === 1 ? 'minuto' : 'minutos'} con este reto.`
      : feedback
    : expected
      ? `La respuesta era «${expected}». Equivocarse no te resta nada.`
      : feedback;

  return (
    <Aparece desde="abajo" style={styles.hoja}>
      <View style={styles.hojaFila}>
        <Axo
          ancho={64}
          expresion={acierto ? 'acierto' : 'fallo'}
          tinte={acierto ? marca.lima : marca.mango}
          flota={false}
        />
        <View style={styles.flex}>
          <Text
            style={[styles.hojaTitulo, { color: acierto ? palette.success : palette.warning }]}
            accessibilityLiveRegion="polite"
          >
            {titulo}
          </Text>
          <Text style={styles.hojaDetalle}>{detalle}</Text>
        </View>
      </View>
      <Gap size="md" />
      <Button label={ultimo ? 'Ver mis minutos' : 'Siguiente reto'} onPress={onSiguiente} />
    </Aparece>
  );
}

const useStyles = makeStyles((palette) => ({
  pantalla: { flex: 1, backgroundColor: palette.arcadeFondoAbajo },
  flex: { flex: 1 },
  mancha: { position: 'absolute', borderRadius: 999 },
  manchaMorada: {
    top: 80,
    left: -60,
    width: 180,
    height: 180,
    backgroundColor: withAlpha(marca.morado, 0.12),
  },
  manchaAqua: {
    bottom: 60,
    right: -70,
    width: 190,
    height: 190,
    backgroundColor: withAlpha(marca.aqua, 0.12),
  },

  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 3,
    paddingHorizontal: space.xl - 2,
    paddingTop: space.md,
  },
  energiaEtiquetas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  energiaMicro: { ...(typography.micro as object), color: palette.textMuted },
  energiaMinutos: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 13, lineHeight: 18, color: palette.success },
  barra: {
    height: 13,
    marginTop: space.xs + 1,
    borderRadius: radius.pill,
    backgroundColor: palette.arcadePista,
    overflow: 'hidden',
  },
  barraRelleno: { height: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 3,
    borderRadius: radius.pill,
    backgroundColor: palette.arcadePanel,
    ...shadow('sm'),
  },
  chipUrgente: { backgroundColor: palette.pastelMango },
  chipTexto: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 13, lineHeight: 18, color: palette.text },
  chipTextoUrgente: { color: palette.warning },

  contenido: {
    flexGrow: 1,
    paddingHorizontal: space.xl - 2,
    paddingTop: space.md + 2,
    paddingBottom: space.xl,
  },
  axo: { alignItems: 'center', marginBottom: space.md },

  pista: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm + 2,
    marginTop: space.md + 2,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    borderRadius: radius.md + 2,
    backgroundColor: palette.pastelMango,
  },
  pistaIcono: { fontSize: 16, lineHeight: 20 },
  pistaTexto: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20, color: palette.warning },
  pistaNota: { ...(typography.caption as object), marginTop: space.xs, color: palette.textMuted },

  pie: { alignItems: 'center', paddingHorizontal: space.xl - 2, paddingTop: space.sm, paddingBottom: space.lg },
  botonPista: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space.xl - 2,
    borderRadius: radius.pill,
    backgroundColor: palette.pastelMango,
  },
  botonPistaTexto: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20, color: palette.warning },
  pulsado: { opacity: 0.75 },

  hoja: {
    paddingTop: space.lg,
    paddingHorizontal: space.xl - 2,
    paddingBottom: space.xl,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderColor: palette.border,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    ...shadow('lg'),
  },
  hojaFila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hojaTitulo: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 20, lineHeight: 25 },
  hojaDetalle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13.5, lineHeight: 19, color: palette.textMuted },
}));
