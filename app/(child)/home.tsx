import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PILLARS, PILLAR_EMOJI, PILLAR_LABEL } from '@/domain/pillar';
import type { Child } from '@/data/repositories/children';
import { pillarStats, type PillarStat } from '@/data/repositories/progress';
import { canStartSession, type SessionGate } from '@/engine/economy';
import { masteryPercent } from '@/engine/mastery';
import { frozenRemainingMs, type ParentPause } from '@/engine/parentMode';
import { useActiveChild, useAppStore } from '@/state/appStore';
import { isSimulated } from '@/screentime';
import {
  Button,
  Card,
  Gap,
  Notice,
  ProgressBar,
  Row,
  Screen,
  Txt,
} from '@/ui/components/primitives';
import { palette, pillarColor, radius, shadow, space } from '@/ui/theme';
import { formatCountdown } from '@/ui/format';
import { useNow } from '@/ui/useNow';

/**
 * Pantalla principal del menor.
 *
 * Responde a tres preguntas y nada más: cuánto tiempo tengo, cómo consigo más,
 * y cómo voy. Todo lo demás —ajustes, estadísticas detalladas, historial— es
 * del tutor y no aparece aquí: llenar esta pantalla de información sobre su
 * propio rendimiento convierte el juego en una evaluación permanente.
 */
export default function ChildHome() {
  const child = useActiveChild();
  const children = useAppStore((state) => state.children);
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

  // Se refresca al volver a la pantalla —no solo al montar— porque se llega
  // aquí desde el resultado de una sesión con datos ya cambiados.
  useFocusEffect(
    useCallback(() => {
      void refresh();
      if (child) void pillarStats(child.id).then(setStats);
    }, [child, refresh]),
  );

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
  const hasTime = remainingMs > 0;

  return (
    <Screen>
      <Row justify="space-between">
        <Row gap="md">
          <Txt style={styles.avatar}>{child.avatar}</Txt>
          <View>
            <Txt variant="heading">Hola, {child.alias}</Txt>
            <Txt variant="caption" color={palette.textMuted}>
              {ledger.earnedMinutes} min ganados hoy
            </Txt>
          </View>
        </Row>

        {/* Acceso al panel del tutor, discreto pero no escondido: ocultarlo
            del todo obligaría a recordar un gesto secreto. El PIN es lo que
            protege, no la falta de visibilidad. */}
        <Pressable
          onPress={() => router.push('/(parent)/unlock')}
          accessibilityRole="button"
          accessibilityLabel="Panel de madres, padres y tutores"
          hitSlop={12}
          style={styles.parentAccess}
        >
          <Txt variant="caption" color={palette.textFaint}>
            👤 Tutor
          </Txt>
        </Pressable>
      </Row>

      <Gap size="xl" />

      <TimeCard remainingMs={remainingMs} hasTime={hasTime} pause={parentPause} />

      <Gap size="lg" />

      <SessionCallToAction gate={gate} sessionSize={settings.sessionSize} />

      <Gap size="xl" />

      <Txt variant="heading">Tus cinco poderes</Txt>
      <Gap size="md" />
      {PILLARS.map((pillar) => {
        const stat = stats.find((entry) => entry.pillar === pillar);
        const percent = stat ? masteryPercent(stat.mastery) : 20;

        return (
          <View key={pillar} style={styles.pillarRow}>
            <Row justify="space-between">
              <Txt variant="bodyStrong">
                {PILLAR_EMOJI[pillar]}  {PILLAR_LABEL[pillar]}
              </Txt>
              <Txt variant="caption" color={palette.textMuted}>
                nivel {Math.max(1, Math.round(percent / 20))}
              </Txt>
            </Row>
            <Gap size="sm" />
            <ProgressBar value={percent / 100} color={pillarColor[pillar]} />
          </View>
        );
      })}

      {isSimulated ? (
        <>
          <Gap size="xl" />
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

/**
 * Selector de menor.
 *
 * Solo aparece cuando hay más de un perfil, que es el caso de hermanos
 * compartiendo una tableta. Los botones son grandes y con avatar porque quien
 * elige puede tener seis años y leer poco.
 */
function ChildPicker({
  profiles,
  onPick,
}: {
  profiles: readonly Child[];
  onPick: (childId: string) => Promise<void>;
}) {
  return (
    <Screen>
      <Gap size="xxl" />
      <Txt variant="title" align="center">
        ¿Quién eres?
      </Txt>
      <Gap size="xl" />

      {profiles.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => void onPick(option.id)}
          accessibilityRole="button"
          accessibilityLabel={option.alias}
          style={styles.pickerRow}
        >
          <Txt style={styles.pickerAvatar}>{option.avatar}</Txt>
          <Txt variant="heading">{option.alias}</Txt>
        </Pressable>
      ))}
    </Screen>
  );
}

function TimeCard({
  remainingMs,
  hasTime,
  pause,
}: {
  remainingMs: number;
  hasTime: boolean;
  pause: ParentPause | null;
}) {
  return (
    <Card raised style={[styles.timeCard, hasTime && !pause && styles.timeCardActive]}>
      <Txt variant="caption" color={palette.textMuted} align="center">
        {/* Sin este aviso, el menor ve una cuenta atrás detenida y concluye que
            la app se rompió. Decirlo evita además que crea que perdió el tiempo
            que había ganado. */}
        {pause
          ? '⏸️  En pausa · tu tiempo está guardado'
          : hasTime
            ? 'Tiempo de juego disponible'
            : 'No tienes tiempo desbloqueado'}
      </Txt>
      <Gap size="sm" />
      <Txt
        variant="display"
        align="center"
        color={pause ? palette.warning : hasTime ? palette.success : palette.textFaint}
        style={styles.timeValue}
      >
        {formatCountdown(remainingMs)}
      </Txt>
    </Card>
  );
}

function SessionCallToAction({ gate, sessionSize }: { gate: SessionGate; sessionSize: number }) {
  if (gate.allowed) {
    return (
      <View>
        <Button
          label={`Resolver ${sessionSize} retos`}
          icon="🧠"
          onPress={() => router.push('/(child)/session')}
        />
        <Gap size="sm" />
        <Txt variant="caption" color={palette.textFaint} align="center">
          Gana minutos resolviendo. Entre más difícil el reto, más minutos.
        </Txt>
      </View>
    );
  }

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

/** mm:ss por debajo de una hora, h:mm por encima. */
const styles = StyleSheet.create({
  avatar: { fontSize: 40 },
  parentAccess: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
  },
  timeCard: { paddingVertical: space.xl },
  timeCardActive: { borderColor: palette.success, ...shadow('md') },
  timeValue: { fontSize: 52, lineHeight: 58 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pickerAvatar: { fontSize: 44 },
  pillarRow: { marginBottom: space.lg },
});
