import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PILLARS, PILLAR_EMOJI, PILLAR_LABEL } from '@/domain/pillar';
import { pillarStats, type PillarStat } from '@/data/repositories/progress';
import { canStartSession, type SessionGate } from '@/engine/economy';
import { masteryPercent } from '@/engine/mastery';
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
  const settings = useAppStore((state) => state.settings);
  const ledger = useAppStore((state) => state.ledger);
  const unlockedUntil = useAppStore((state) => state.unlockedUntil);
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
  const remainingMs = unlockedUntil ? unlockedUntil - now : 0;
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

      <TimeCard remainingMs={remainingMs} hasTime={hasTime} />

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

function TimeCard({ remainingMs, hasTime }: { remainingMs: number; hasTime: boolean }) {
  return (
    <Card raised style={[styles.timeCard, hasTime && styles.timeCardActive]}>
      <Txt variant="caption" color={palette.textMuted} align="center">
        {hasTime ? 'Tiempo de juego disponible' : 'No tienes tiempo desbloqueado'}
      </Txt>
      <Gap size="sm" />
      <Txt
        variant="display"
        align="center"
        color={hasTime ? palette.success : palette.textFaint}
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
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

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
  pillarRow: { marginBottom: space.lg },
});
