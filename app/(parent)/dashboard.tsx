import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PILLAR_EMOJI, PILLAR_LABEL } from '@/domain/pillar';
import { AGE_BAND_LABEL } from '@/domain/age';
import {
  audit,
  describeSchedule,
  listBlockedApps,
  type BlockedApp,
} from '@/data/repositories/policy';
import { pillarStats, recentSessions, type PillarStat, type SessionSummary } from '@/data/repositories/progress';
import { grantTime, revokeActiveGrants } from '@/data/repositories/rewards';
import { masteryPercent, weakestPillar } from '@/engine/mastery';
import type { GuardStatus } from 'neuropass-screentime';
import { isSimulated, pendingRequirements, screenTime } from '@/screentime';
import { secureStorage } from '@/security/secureStorage';
import { useActiveChild, useAppStore } from '@/state/appStore';
import {
  Badge,
  Button,
  Card,
  Gap,
  Notice,
  ProgressBar,
  Row,
  Screen,
  Txt,
} from '@/ui/components/primitives';
import { palette, pillarColor, space } from '@/ui/theme';
import { useNow } from '@/ui/useNow';

import { useParentSession } from './_layout';

/**
 * Panel del tutor.
 *
 * Está ordenado por urgencia, no por categoría: primero lo que impide que la
 * app funcione (permisos pendientes), después el estado de ahora mismo, luego
 * los controles inmediatos y al final el progreso. Un panel ordenado por
 * secciones temáticas se lee bonito y esconde el hecho de que falta un permiso
 * sin el cual nada se está bloqueando.
 */
export default function Dashboard() {
  const session = useParentSession();
  const child = useActiveChild();
  const settings = useAppStore((state) => state.settings);
  const ledger = useAppStore((state) => state.ledger);
  const schedules = useAppStore((state) => state.schedules);
  const unlockedUntil = useAppStore((state) => state.unlockedUntil);
  const capabilities = useAppStore((state) => state.capabilities);
  const refresh = useAppStore((state) => state.refreshActiveChild);
  const refreshCapabilities = useAppStore((state) => state.refreshCapabilities);
  const syncPolicy = useAppStore((state) => state.syncPolicy);

  const [stats, setStats] = useState<PillarStat[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [guard, setGuard] = useState<GuardStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(5_000);

  useFocusEffect(
    useCallback(() => {
      if (!child) return;
      void refresh();
      void refreshCapabilities();
      void pillarStats(child.id).then(setStats);
      void recentSessions(child.id, 7).then(setSessions);
      void listBlockedApps(child.id).then(setBlockedApps);
      void screenTime.getGuardStatus().then(setGuard);
    }, [child, refresh, refreshCapabilities]),
  );

  // La sesión del tutor solo vive en memoria: si se perdió (app reiniciada),
  // se vuelve al PIN en vez de mostrar el panel.
  if (!session.unlocked) return <Redirect href="/(parent)/unlock" />;
  if (!child || !settings || !ledger || !capabilities) {
    return (
      <Screen>
        <Txt variant="body" color={palette.textMuted}>
          Cargando…
        </Txt>
      </Screen>
    );
  }

  const playing = unlockedUntil !== null && unlockedUntil > now;
  const requirements = pendingRequirements(capabilities);
  const blocking = requirements.filter((requirement) => requirement.blocking);
  const weakest = weakestPillar(
    Object.fromEntries(stats.map((stat) => [stat.pillar, stat.mastery])) as never,
  );

  const grantExtra = async (minutes: number) => {
    setBusy(true);
    try {
      await grantTime({ childId: child.id, minutes, source: 'parent' });
      await audit('tiempo_concedido', `${minutes} min`, child.id);
      await syncPolicy();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const cutNow = async () => {
    setBusy(true);
    try {
      const revoked = await revokeActiveGrants(child.id);
      await audit('tiempo_revocado', `${revoked} permisos`, child.id);
      await syncPolicy();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {/* 1. Lo que impide que la app haga su trabajo. */}
      {guard?.enabled && !guard.alive ? (
        <>
          <Notice tone="danger" title="El sistema detuvo la supervisión">
            NEUROpass está configurado, pero Android cerró el vigilante y ahora mismo no está
            bloqueando nada. Suele pasar en capas con ahorro de batería agresivo. Concede el inicio
            automático y quita la restricción de batería para que no vuelva a ocurrir.
          </Notice>
          <Gap size="md" />
          <Row gap="md">
            <Button
              label="Inicio automático"
              variant="secondary"
              onPress={async () => {
                const opened = await screenTime.openAutostartSettings();
                if (!opened) await screenTime.openBatterySettings();
              }}
            />
            <Button label="Batería" variant="secondary" onPress={() => screenTime.openBatterySettings()} />
          </Row>
          <Gap size="xl" />
        </>
      ) : null}

      {blocking.length > 0 ? (
        <>
          <Notice tone="danger" title={`${blocking.length} permiso(s) sin conceder`}>
            Hasta que los concedas, NEUROpass no está bloqueando nada.
          </Notice>
          <Gap size="md" />
          {requirements.map((requirement) => (
            <Card key={requirement.key} style={styles.requirement}>
              <Row justify="space-between">
                <Txt variant="bodyStrong">{requirement.title}</Txt>
                <Badge
                  label={requirement.blocking ? 'necesario' : 'recomendado'}
                  color={requirement.blocking ? palette.danger : palette.warning}
                />
              </Row>
              <Gap size="sm" />
              <Txt variant="caption" color={palette.textMuted}>
                {requirement.explanation}
              </Txt>
              <Gap size="md" />
              <Button
                label="Configurar"
                variant="secondary"
                onPress={async () => {
                  await requirement.action(screenTime);
                  await refreshCapabilities();
                }}
              />
            </Card>
          ))}
          <Gap size="xl" />
        </>
      ) : null}

      {isSimulated ? (
        <>
          <Notice tone="warning" title="Módulo nativo no cargado">
            {secureStorage.isSecure
              ? 'Estás sobre el simulador: los permisos y el bloqueo son ficticios. Compila con expo run:android para probar el comportamiento real.'
              : 'Estás en el navegador: además del bloqueo simulado, el PIN se guarda en localStorage y no en el almacén seguro del sistema. Sirve para revisar la interfaz, no para uso real.'}
          </Notice>
          <Gap size="xl" />
        </>
      ) : null}

      {/* 2. Estado de ahora mismo. */}
      <Row justify="space-between">
        <Row gap="md">
          <Txt style={styles.avatar}>{child.avatar}</Txt>
          <View>
            <Txt variant="heading">{child.alias}</Txt>
            <Txt variant="caption" color={palette.textMuted}>
              {AGE_BAND_LABEL[child.band]}
            </Txt>
          </View>
        </Row>
        <Badge
          label={playing ? 'Jugando' : 'Bloqueado'}
          color={playing ? palette.success : palette.textMuted}
        />
      </Row>

      <Gap size="lg" />

      <Card raised>
        <Row justify="space-between">
          <Metric label="Ganados hoy" value={`${ledger.earnedMinutes} min`} />
          <Metric label="Tope diario" value={`${settings.rewardPolicy.dailyCapMinutes} min`} />
          <Metric label="Sesiones" value={String(ledger.sessionsCompleted)} />
        </Row>
        <Gap size="md" />
        <ProgressBar
          value={ledger.earnedMinutes / Math.max(1, settings.rewardPolicy.dailyCapMinutes)}
          color={palette.accent}
        />
      </Card>

      <Gap size="lg" />

      {/* 3. Controles inmediatos: lo que un tutor necesita a mitad de una tarde. */}
      <Txt variant="heading">Acción rápida</Txt>
      <Gap size="md" />
      <Row gap="sm">
        <Button
          label="+15 min"
          variant="secondary"
          fullWidth={false}
          disabled={busy}
          onPress={() => grantExtra(15)}
          style={styles.quickButton}
        />
        <Button
          label="+30 min"
          variant="secondary"
          fullWidth={false}
          disabled={busy}
          onPress={() => grantExtra(30)}
          style={styles.quickButton}
        />
        <Button
          label="Cortar ya"
          variant="danger"
          fullWidth={false}
          disabled={busy}
          onPress={cutNow}
          style={styles.quickButton}
        />
      </Row>

      <Gap size="xl" />

      {/* 4. Configuración. */}
      <Txt variant="heading">Configuración</Txt>
      <Gap size="md" />
      <NavRow
        label="Apps limitadas"
        detail={
          blockedApps.length === 0
            ? 'Ninguna app seleccionada'
            : `${blockedApps.length} app(s): ${blockedApps.slice(0, 3).map((a) => a.appLabel).join(', ')}`
        }
        warning={blockedApps.length === 0}
        onPress={() => router.push('/(parent)/apps')}
      />
      <NavRow
        label="Horarios protegidos"
        detail={
          schedules.length === 0
            ? 'Sin franjas configuradas'
            : schedules.filter((s) => s.enabled).map(describeSchedule).join(' · ')
        }
        onPress={() => router.push('/(parent)/schedules')}
      />
      <NavRow
        label="Ajustes y privacidad"
        detail={`${settings.sessionSize} retos por sesión · PIN y datos`}
        onPress={() => router.push('/(parent)/settings')}
      />

      <Gap size="xl" />

      {/* 5. Progreso. */}
      <Txt variant="heading">Progreso por pilar</Txt>
      <Gap size="sm" />
      <Txt variant="caption" color={palette.textMuted}>
        Últimos 30 días. El nivel refleja la dificultad que resuelve con soltura, no una nota.
      </Txt>
      <Gap size="md" />

      {stats.map((stat) => (
        <View key={stat.pillar} style={styles.statRow}>
          <Row justify="space-between">
            <Txt variant="bodyStrong">
              {PILLAR_EMOJI[stat.pillar]}  {PILLAR_LABEL[stat.pillar]}
            </Txt>
            <Txt variant="caption" color={palette.textMuted}>
              {stat.attemptsLast30Days === 0
                ? 'sin datos'
                : `${Math.round((stat.accuracyLast30Days ?? 0) * 100)}% · ${stat.attemptsLast30Days} retos`}
            </Txt>
          </Row>
          <Gap size="sm" />
          <ProgressBar value={masteryPercent(stat.mastery) / 100} color={pillarColor[stat.pillar]} />
        </View>
      ))}

      {weakest ? (
        <>
          <Gap size="md" />
          <Notice tone="info" title={`Pilar más rezagado: ${PILLAR_LABEL[weakest]}`}>
            NEUROpass ya le está dando más peso en las próximas sesiones. No hace falta que cambies
            nada.
          </Notice>
        </>
      ) : null}

      <Gap size="xl" />

      <Txt variant="heading">Últimas sesiones</Txt>
      <Gap size="md" />
      {sessions.length === 0 ? (
        <Txt variant="caption" color={palette.textFaint}>
          Todavía no hay sesiones completadas.
        </Txt>
      ) : (
        sessions.map((entry) => (
          <Row key={entry.id} justify="space-between" style={styles.sessionRow}>
            <Txt variant="caption" color={palette.textMuted}>
              {new Date(entry.startedAt).toLocaleString('es-MX', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Txt>
            <Txt variant="caption">
              {entry.correctCount}/{entry.totalCount} · +{entry.grantedMinutes} min
            </Txt>
          </Row>
        ))
      )}

      <Gap size="xxl" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Txt variant="title">{value}</Txt>
      <Txt variant="caption" color={palette.textMuted}>
        {label}
      </Txt>
    </View>
  );
}

function NavRow({
  label,
  detail,
  onPress,
  warning = false,
}: {
  label: string;
  detail: string;
  onPress: () => void;
  warning?: boolean;
}) {
  return (
    <Card style={styles.navRow}>
      <Row justify="space-between">
        <View style={styles.navText}>
          <Txt variant="bodyStrong">{label}</Txt>
          <Gap size="xs" />
          <Txt variant="caption" color={warning ? palette.warning : palette.textMuted} numberOfLines={2}>
            {detail}
          </Txt>
        </View>
        <Button label="Abrir" variant="secondary" fullWidth={false} onPress={onPress} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  avatar: { fontSize: 36 },
  requirement: { marginBottom: space.md },
  metric: { alignItems: 'center', flex: 1 },
  quickButton: { flex: 1 },
  navRow: { marginBottom: space.md },
  navText: { flex: 1, marginRight: space.md },
  statRow: { marginBottom: space.lg },
  sessionRow: { paddingVertical: space.sm },
});
