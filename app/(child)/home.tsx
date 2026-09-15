import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { AGE_BAND_LABEL } from '@/domain/age';
import { PILLARS, PILLAR_EMOJI, PILLAR_LABEL, type Pillar } from '@/domain/pillar';
import type { Child } from '@/data/repositories/children';
import { pillarStats, type PillarStat } from '@/data/repositories/progress';
import { DEFAULT_REWARD_POLICY, canStartSession, type SessionGate } from '@/engine/economy';
import { masteryPercent } from '@/engine/mastery';
import { frozenRemainingMs } from '@/engine/parentMode';
import { lighten, withAlpha } from '@/lib/color';
import { useActiveChild, useAppStore } from '@/state/appStore';
import { isSimulated } from '@/screentime';
import { Aparece } from '@/ui/components/Aparece';
import { Axo } from '@/ui/components/Axo';
import { Button, Gap, Notice, Screen, Txt } from '@/ui/components/primitives';
import { formatCountdown } from '@/ui/format';
import { makeStyles } from '@/ui/makeStyles';
import { useTheme } from '@/ui/ThemeProvider';
import {
  marca,
  pastelDePilar,
  pillarColor,
  pillarColorInk,
  radius,
  shadow,
  space,
  tonoMarca,
  veredicto,
  type Palette,
  type TonoMarca,
} from '@/ui/theme';
import { useMovimientoReducido } from '@/ui/useMovimientoReducido';
import { useNow } from '@/ui/useNow';
import { useRacha } from '@/ui/useRacha';

/**
 * Pantalla principal del menor.
 *
 * Responde a tres preguntas y nada más: cuánto tiempo tengo, cómo consigo más,
 * y cómo voy. Todo lo demás —ajustes, estadísticas detalladas, historial— es
 * del tutor y no aparece aquí: llenar esta pantalla de información sobre su
 * propio rendimiento convierte el juego en una evaluación permanente.
 */
export default function ChildHome() {
  const { palette } = useTheme();
  const styles = useStyles();
  const child = useActiveChild();
  const children = useAppStore((state) => state.children);
  const ready = useAppStore((state) => state.ready);
  const activeChildId = useAppStore((state) => state.activeChildId);
  const selectChild = useAppStore((state) => state.selectChild);
  const settings = useAppStore((state) => state.settings);
  const ledger = useAppStore((state) => state.ledger);
  const unlockedUntil = useAppStore((state) => state.unlockedUntil);
  const parentPause = useAppStore((state) => state.parentPause);
  const refresh = useAppStore((state) => state.refreshActiveChild);

  const [stats, setStats] = useState<PillarStat[]>([]);
  // La cuenta atrás del tiempo restante necesita un reloj que avance solo.
  const now = useNow();
  const racha = useRacha(
    child?.id ?? null,
    (settings?.rewardPolicy ?? DEFAULT_REWARD_POLICY).dayResetHour,
    ledger?.sessionsCompleted ?? 0,
  );

  // Se refresca al volver a la pantalla —no solo al montar— porque se llega
  // aquí desde el resultado de una sesión con datos ya cambiados.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      if (child) void pillarStats(child.id).then(setStats);
    }, [child, refresh]),
  );

  // Sin ningún perfil no hay nada que mostrar. Se llega aquí por enlace
  // profundo o por la barra de direcciones en web, saltándose la comprobación
  // de `app/index.tsx`; sin esta salida la pantalla se queda en "Cargando…"
  // para siempre, esperando datos de un menor que no existe.
  if (ready && children.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  // Varios perfiles y ninguno activo: hay que preguntar. Sin esta pantalla la
  // app se quedaba esperando datos de un menor que nunca se había elegido.
  if (activeChildId === null && children.length > 0) {
    return <ChildPicker profiles={children} onPick={selectChild} />;
  }

  if (!child || !settings || !ledger) {
    return (
      <Screen>
        <Txt variant="body" color={palette.textMuted}>
          Cargando…
        </Txt>
      </Screen>
    );
  }

  const gate = canStartSession(ledger, settings.rewardPolicy, now);
  // Durante el modo adulto el vencimiento ya está desplazado, así que restarle
  // "ahora" daría un número que no significa nada para el menor. Lo que se le
  // muestra es lo que recuperará cuando le devuelvan el teléfono.
  const remainingMs = parentPause
    ? frozenRemainingMs(parentPause, unlockedUntil, now)
    : unlockedUntil
      ? unlockedUntil - now
      : 0;
  const estado: EstadoTiempo = parentPause ? 'pausa' : remainingMs > 0 ? 'jugando' : 'sin-tiempo';

  return (
    <Screen formas>
      <View style={styles.cabecera}>
        <View style={styles.saludo}>
          <View style={[styles.avatar, { backgroundColor: palette.pastelRosa }]}>
            <Text style={styles.avatarEmoji}>{child.avatar}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.hola} numberOfLines={1}>
              ¡Hola, {child.alias}!
            </Text>
            <Txt variant="caption" color={palette.textMuted}>
              {ledger.earnedMinutes} min ganados hoy
              {/* Un solo día no es una racha: anunciarla desde el primero la
                  vacía de sentido cuando de verdad lleva varios. */}
              {racha >= 2 ? ` · racha de ${racha} días 🔥` : ''}
            </Txt>
          </View>
        </View>

        {/* Acceso al panel del tutor, discreto pero no escondido: ocultarlo
            del todo obligaría a recordar un gesto secreto. El PIN es lo que
            protege, no la falta de visibilidad. */}
        <Pressable
          onPress={() => router.push('/(parent)/unlock')}
          accessibilityRole="button"
          accessibilityLabel="Panel de madres, padres y tutores"
          style={({ pressed }) => [styles.botonTutor, pressed && styles.pulsado]}
        >
          <Text style={styles.botonTutorIcono}>👤</Text>
        </Pressable>
      </View>

      <Gap size="lg" />
      <TarjetaTiempo remainingMs={remainingMs} estado={estado} ganadosHoy={ledger.earnedMinutes} />
      <Gap size="lg" />
      <AccesoRetos gate={gate} sessionSize={settings.sessionSize} />
      <Gap size="xl" />

      <View style={styles.seccion}>
        <Txt variant="heading">Tus cinco poderes</Txt>
        <Txt variant="caption" color={palette.textMuted}>
          nivel actual
        </Txt>
      </View>
      <Gap size="md" />
      {PILLARS.map((pillar, indice) => {
        const stat = stats.find((entry) => entry.pillar === pillar);
        return (
          <FilaPoder
            key={pillar}
            pillar={pillar}
            percent={stat ? masteryPercent(stat.mastery) : 20}
            indice={indice}
          />
        );
      })}

      {isSimulated ? (
        <>
          <Gap size="lg" />
          <Notice tone="warning" title="Modo de prueba">
            El módulo nativo no está cargado, así que no se está bloqueando ninguna app de verdad.
            Compila con `expo run:android` para probar el bloqueo real.
          </Notice>
        </>
      ) : null}

      <Gap size="xxl" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/** Pastel del avatar y tinta del rango, rotando por perfil. */
const TONOS_PERFIL: readonly TonoMarca[] = ['rosa', 'aqua', 'lima', 'mango'];

const PASTEL_DE_TONO: Record<TonoMarca, keyof Palette> = {
  rosa: 'pastelRosa',
  aqua: 'pastelAqua',
  lima: 'pastelLima',
  mango: 'pastelMango',
  morado: 'accentSoft',
};

/**
 * Selector de menor.
 *
 * Solo aparece cuando hay más de un perfil, que es el caso de hermanos
 * compartiendo una tableta. Las tarjetas son grandes y con avatar porque quien
 * elige puede tener seis años y leer poco. Cada perfil lleva el rango de edad
 * y no un nivel: esta pantalla la ven todos los hermanos a la vez, y comparar
 * niveles entre ellos es justo lo que no debe fomentar.
 */
function ChildPicker({
  profiles,
  onPick,
}: {
  profiles: readonly Child[];
  onPick: (childId: string) => Promise<void>;
}) {
  const { palette, isDark } = useTheme();
  const styles = useStyles();

  return (
    <Screen formas>
      <Gap size="xxl" />
      <Txt variant="title" align="center">
        ¿Quién eres?
      </Txt>
      <Gap size="xs" />
      <Txt variant="body" align="center" color={palette.textMuted}>
        Toca tu cara para entrar
      </Txt>
      <Gap size="xl" />

      <View style={styles.rejilla}>
        {profiles.map((option, indice) => {
          const tono = TONOS_PERFIL[indice % TONOS_PERFIL.length] as TonoMarca;
          return (
            <Aparece key={option.id} desde="abajo" retardo={100 * indice} style={styles.celda}>
              <Pressable
                onPress={() => void onPick(option.id)}
                accessibilityRole="button"
                accessibilityLabel={option.alias}
                style={({ pressed }) => [styles.perfil, pressed && styles.pulsado]}
              >
                <View style={[styles.perfilAvatar, { backgroundColor: palette[PASTEL_DE_TONO[tono]] }]}>
                  <Text style={styles.perfilEmoji}>{option.avatar}</Text>
                </View>
                <Text style={styles.perfilAlias} numberOfLines={1}>
                  {option.alias}
                </Text>
                <Text
                  style={[
                    styles.perfilRango,
                    { color: isDark ? tonoMarca[tono].base : tonoMarca[tono].canto },
                  ]}
                >
                  {AGE_BAND_LABEL[option.band]}
                </Text>
              </Pressable>
            </Aparece>
          );
        })}

        {/* Crear un perfil cambia la configuración, así que pasa por el PIN. */}
        <Aparece desde="abajo" retardo={100 * profiles.length} style={styles.celda}>
          <Pressable
            onPress={() => router.push('/(parent)/unlock')}
            accessibilityRole="button"
            accessibilityLabel="Nuevo perfil, lo crea un adulto"
            style={({ pressed }) => [styles.perfil, styles.perfilNuevo, pressed && styles.pulsado]}
          >
            <View style={[styles.perfilAvatar, { backgroundColor: palette.accentSoft }]}>
              <Text style={styles.perfilMas}>+</Text>
            </View>
            <Text style={styles.perfilNuevoTexto}>Nuevo perfil</Text>
          </Pressable>
        </Aparece>
      </View>

      <Gap size="xl" />
      <View style={styles.tarjetaAxo}>
        <Axo ancho={64} expresion="acierto" tinte={marca.aqua} />
        <Txt variant="bodyStrong" style={styles.flex}>
          ¡Te estaba esperando! Toca tu cara y entrenamos juntos.
        </Txt>
      </View>

      <Gap size="xl" />
      <View style={styles.accesoTutor}>
        <View style={[styles.accesoIcono, { backgroundColor: palette.accentSoft }]}>
          <Text style={styles.botonTutorIcono}>👤</Text>
        </View>
        <Txt variant="bodyStrong" color={palette.textMuted} style={styles.flex}>
          ¿Eres la mamá, el papá o tutor?
        </Txt>
        <Button label="Entrar" fullWidth={false} onPress={() => router.push('/(parent)/unlock')} />
      </View>
      <Gap size="xl" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

type EstadoTiempo = 'jugando' | 'pausa' | 'sin-tiempo';

const ASPECTO_TIEMPO: Record<
  EstadoTiempo,
  { colores: readonly [string, string]; etiqueta: string; nota: string }
> = {
  jugando: { colores: [marca.lima, marca.limaOsc], etiqueta: 'TIEMPO DE JUEGO', nota: '¡Sigue corriendo!' },
  // Sin este aviso, el menor ve una cuenta atrás detenida y concluye que la app
  // se rompió. Decirlo evita además que crea que perdió el tiempo ganado.
  pausa: { colores: [marca.mango, marca.mangoOsc], etiqueta: 'EN PAUSA', nota: 'Tu tiempo está guardado' },
  'sin-tiempo': {
    colores: [veredicto.descartada.arriba, veredicto.descartada.abajo],
    etiqueta: 'SIN TIEMPO',
    nota: 'Entrena con AXO para ganar minutos',
  },
};

/**
 * Tarjeta de tiempo.
 *
 * El anillo gira solo mientras el tiempo corre: parado en pausa o sin tiempo,
 * es la forma de decir «esto no avanza» antes de que se lea el número.
 */
function TarjetaTiempo({
  remainingMs,
  estado,
  ganadosHoy,
}: {
  remainingMs: number;
  estado: EstadoTiempo;
  ganadosHoy: number;
}) {
  const styles = useStyles();
  const movimientoReducido = useMovimientoReducido();
  const [giro] = useState(() => new Animated.Value(0));
  const gira = estado === 'jugando' && !movimientoReducido;

  useEffect(() => {
    if (!gira) return undefined;
    const ciclo = Animated.loop(
      Animated.timing(giro, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [giro, gira]);

  const aspecto = ASPECTO_TIEMPO[estado];
  const cuenta = formatCountdown(remainingMs);

  return (
    <View
      style={[styles.tiempo, shadow('lg', aspecto.colores[1])]}
      accessible
      accessibilityLabel={`${aspecto.nota}. ${cuenta}`}
    >
      <View style={styles.tiempoInterior}>
        <LinearGradient
          colors={aspecto.colores}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.brilloTarjeta} />

        <View style={styles.anillo}>
          <View style={styles.anilloPista} />
          <Animated.View
            style={[
              styles.anilloArco,
              { transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
          />
          <Text style={styles.anilloTexto}>
            {estado === 'pausa' ? '⏸' : estado === 'sin-tiempo' ? '🔒' : `de ${ganadosHoy}`}
          </Text>
        </View>

        <View style={styles.flex}>
          <Text style={styles.tiempoEtiqueta}>{aspecto.etiqueta}</Text>
          <Text style={styles.tiempoCuenta}>{cuenta}</Text>
          <Text style={styles.tiempoNota}>{aspecto.nota}</Text>
        </View>
      </View>
    </View>
  );
}

function AccesoRetos({ gate, sessionSize }: { gate: SessionGate; sessionSize: number }) {
  if (gate.allowed) return <EntrenaConAxo sessionSize={sessionSize} />;

  if (gate.reason === 'cooldown') {
    return (
      <Notice tone="info" title={`Descansa un poco · ${formatCountdown(gate.waitMs)}`}>
        Tu cerebro rinde más si haces pausas entre sesiones. Vuelve cuando termine la cuenta.
      </Notice>
    );
  }

  return (
    <Notice tone="info" title="Ya ganaste todo el tiempo de hoy">
      Mañana empiezas de cero. Nos vemos entonces.
    </Notice>
  );
}

/**
 * Acceso a los retos.
 *
 * Es la acción principal de la pantalla y la única tarjeta con canto: se tiene
 * que leer como algo que se pulsa, no como un dato más. El halo que late detrás
 * de AXO es lo único que se mueve en ella.
 */
function EntrenaConAxo({ sessionSize }: { sessionSize: number }) {
  const styles = useStyles();
  const movimientoReducido = useMovimientoReducido();
  const [pulso] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (movimientoReducido) return undefined;
    const ciclo = Animated.loop(
      Animated.timing(pulso, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [pulso, movimientoReducido]);

  return (
    <Pressable
      onPress={() => router.push('/(child)/session')}
      accessibilityRole="button"
      accessibilityLabel={`Entrena con AXO: resolver ${sessionSize} retos`}
      style={styles.cta}
    >
      {({ pressed }) => (
        <View style={[styles.ctaCara, pressed && styles.ctaHundida]}>
          <LinearGradient
            colors={[lighten(marca.morado, 0.2), marca.morado]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.ctaAxo}>
            {movimientoReducido ? null : (
              <Animated.View
                style={[
                  styles.ctaHalo,
                  {
                    opacity: pulso.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0, 0.5] }),
                    transform: [
                      { scale: pulso.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.32, 1] }) },
                    ],
                  },
                ]}
              />
            )}
            <Axo ancho={80} expresion="reto" tinte={marca.moradoOsc} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.ctaTitulo}>Entrena con AXO</Text>
            <Text style={styles.ctaNota}>{sessionSize} retos · gana minutos de juego</Text>
          </View>
          <View style={styles.ctaChevron}>
            <Text style={styles.ctaChevronTexto}>›</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Un poder por pilar. La barra entra creciendo, escalonada de arriba abajo:
 * cinco barras apareciendo a la vez se leen como un bloque, y en cascada se
 * leen como cinco cosas distintas.
 */
function FilaPoder({ pillar, percent, indice }: { pillar: Pillar; percent: number; indice: number }) {
  const { palette, isDark } = useTheme();
  const styles = useStyles();
  const movimientoReducido = useMovimientoReducido();
  const [relleno] = useState(() => new Animated.Value(0));

  // `width` no admite el driver nativo; son cinco barras y ocurre una vez.
  useEffect(() => {
    if (movimientoReducido) {
      relleno.setValue(percent / 100);
      return undefined;
    }
    const animacion = Animated.timing(relleno, {
      toValue: percent / 100,
      duration: 1100 + indice * 200,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    });
    animacion.start();
    return () => animacion.stop();
  }, [relleno, percent, indice, movimientoReducido]);

  const color = pillarColor[pillar];
  const nivel = Math.max(1, Math.round(percent / 20));

  return (
    <View style={styles.poder} accessible accessibilityLabel={`${PILLAR_LABEL[pillar]}, nivel ${nivel}`}>
      <View style={[styles.poderIcono, { backgroundColor: pastelDePilar(palette, pillar) }]}>
        <Text style={styles.poderEmoji}>{PILLAR_EMOJI[pillar]}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.poderNombre}>{PILLAR_LABEL[pillar]}</Text>
        <View style={styles.poderPista}>
          <Animated.View
            style={[
              styles.poderRelleno,
              { width: relleno.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          >
            <LinearGradient
              colors={[lighten(color, 0.3), color]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
      <Text style={[styles.poderNivel, { color: isDark ? color : pillarColorInk[pillar] }]}>N{nivel}</Text>
    </View>
  );
}

const useStyles = makeStyles((palette) => ({
  flex: { flex: 1 },
  pulsado: { opacity: 0.8 },

  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  saludo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 29, lineHeight: 36 },
  hola: { fontFamily: 'Baloo2_700Bold', fontSize: 22, lineHeight: 28, color: palette.text },
  botonTutor: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  botonTutorIcono: { fontSize: 19, lineHeight: 24 },

  tiempo: { borderRadius: radius.xxl },
  tiempoInterior: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg + 2,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg + 4,
  },
  brilloTarjeta: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: withAlpha(palette.white, 0.14),
  },
  anillo: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  anilloPista: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 46,
    borderWidth: 8,
    borderColor: withAlpha(palette.white, 0.25),
  },
  // Un aro con dos lados coloreados y dos transparentes es medio anillo; al
  // girar, es el arco el que parece recorrer la pista.
  anilloArco: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 46,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: palette.white,
    borderRightColor: palette.white,
  },
  anilloTexto: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 15, lineHeight: 20, color: palette.white },
  tiempoEtiqueta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.84,
    color: withAlpha(palette.white, 0.85),
  },
  tiempoCuenta: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 50, lineHeight: 56, color: palette.white },
  tiempoNota: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 19, color: withAlpha(palette.white, 0.9) },

  cta: { borderRadius: radius.xxl, backgroundColor: marca.moradoOsc, paddingBottom: 6, ...shadow('lg', marca.morado) },
  ctaCara: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    padding: space.lg + 2,
  },
  ctaHundida: { transform: [{ translateY: 5 }] },
  ctaAxo: { width: 84, height: 80, alignItems: 'center', justifyContent: 'flex-end' },
  ctaHalo: {
    position: 'absolute',
    bottom: 2,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: withAlpha(palette.white, 0.25),
  },
  ctaTitulo: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 25, lineHeight: 30, color: palette.white },
  ctaNota: { fontFamily: 'Nunito_700Bold', fontSize: 13, lineHeight: 19, color: withAlpha(palette.white, 0.9) },
  ctaChevron: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(palette.white, 0.22),
  },
  ctaChevronTexto: { fontFamily: 'Baloo2_700Bold', fontSize: 26, lineHeight: 30, color: palette.white },

  seccion: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  poder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.sm + 2,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  poderIcono: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  poderEmoji: { fontSize: 19, lineHeight: 24 },
  poderNombre: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 18, color: palette.text },
  poderPista: {
    height: 10,
    marginTop: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    overflow: 'hidden',
  },
  poderRelleno: { height: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  poderNivel: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 15, lineHeight: 20, minWidth: 28, textAlign: 'right' },

  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 15 },
  celda: { width: '48%' },
  perfil: {
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: space.lg + 6,
    paddingHorizontal: space.md,
    borderRadius: 30,
    backgroundColor: palette.surface,
    ...shadow('md'),
  },
  perfilNuevo: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  perfilAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  perfilEmoji: { fontSize: 44, lineHeight: 54 },
  perfilAlias: { fontFamily: 'Baloo2_700Bold', fontSize: 21, lineHeight: 26, color: palette.text },
  perfilRango: { fontFamily: 'Nunito_700Bold', fontSize: 12, lineHeight: 16 },
  perfilMas: { fontFamily: 'Baloo2_700Bold', fontSize: 38, lineHeight: 46, color: palette.accent },
  perfilNuevoTexto: { fontFamily: 'Baloo2_700Bold', fontSize: 18, lineHeight: 26, color: palette.textMuted },

  tarjetaAxo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: 26,
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  accesoTutor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg + 2,
    backgroundColor: palette.surfaceRaised,
  },
  accesoIcono: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
}));
