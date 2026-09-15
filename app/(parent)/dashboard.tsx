import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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
import { withAlpha } from '@/lib/color';
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
import { PAUSE_DURATIONS, type ParentPause } from '@/engine/parentMode';
import { makeStyles } from '@/ui/makeStyles';
import { useTheme } from '@/ui/ThemeProvider';
import { marca, pillarColor, radius, shadow, space, tonoMarca, type TonoMarca } from '@/ui/theme';
import { formatCountdown } from '@/ui/format';
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
 *
 * Sin animaciones, con densidad alta y pastel plano: quien entra aquí busca un
 * dato en diez segundos, no un juego.
 */
export default function Dashboard() {
  const { palette } = useTheme();
  const styles = useStyles();
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
  const parentPause = useAppStore((state) => state.parentPause);
  const pauseForParent = useAppStore((state) => state.pauseForParent);
  const resumeChild = useAppStore((state) => state.resumeChild);
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

  const estado = parentPause
    ? { etiqueta: 'En pausa', fondo: palette.pastelMango, tinta: palette.warning }
    : playing
      ? { etiqueta: 'Jugando', fondo: palette.successSoft, tinta: palette.success }
      : { etiqueta: 'Bloqueado', fondo: palette.accentSoft, tinta: palette.textMuted };

  const intentos30 = stats.reduce((suma, stat) => suma + stat.attemptsLast30Days, 0);
  const aciertos30 = stats.reduce(
    (suma, stat) => suma + (stat.accuracyLast30Days ?? 0) * stat.attemptsLast30Days,
    0,
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
      {/* De quién es el panel. Ocupa una línea y no tiene peso visual: lo
          primero que llama la atención sigue siendo el aviso de permisos. */}
      <View style={styles.cabecera}>
        <View style={styles.flex}>
          <Text style={styles.micro}>PANEL DE TUTORES</Text>
          <Text style={styles.nombre} numberOfLines={1}>
            {child.avatar} {child.alias} · {AGE_BAND_LABEL[child.band]}
          </Text>
        </View>
        <View style={[styles.estado, { backgroundColor: estado.fondo }]}>
          <Text style={[styles.estadoTexto, { color: estado.tinta }]}>● {estado.etiqueta}</Text>
        </View>
      </View>
      <Gap size="lg" />

      {/* 1. Lo que impide que la app haga su trabajo. */}
      {guard?.enabled && !guard.alive ? (
        <>
          <Alerta titulo="El sistema detuvo la supervisión">
            NEUROpass está configurado, pero Android cerró el vigilante y ahora mismo no está
            bloqueando nada. Suele pasar en capas con ahorro de batería agresivo. Concede el inicio
            automático y quita la restricción de batería para que no vuelva a ocurrir.
          </Alerta>
          <Gap size="md" />
          <Row gap="md">
            <Button
              label="Inicio automático"
              variant="secondary"
              fullWidth={false}
              style={styles.flex}
              onPress={async () => {
                const opened = await screenTime.openAutostartSettings();
                if (!opened) await screenTime.openBatterySettings();
              }}
            />
            <Button
              label="Batería"
              variant="secondary"
              fullWidth={false}
              style={styles.flex}
              onPress={() => screenTime.openBatterySettings()}
            />
          </Row>
          <Gap size="lg" />
        </>
      ) : null}

      {blocking.length > 0 ? (
        <>
          <Alerta titulo={`${blocking.length} permiso(s) sin conceder`}>
            Hasta que los concedas, NEUROpass no está bloqueando nada.
          </Alerta>
          <Gap size="md" />
          {requirements.map((requirement) => (
            <Card key={requirement.key} style={styles.requirement}>
              <Row justify="space-between">
                <Txt variant="bodyStrong" style={styles.flex}>
                  {requirement.title}
                </Txt>
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
          <Gap size="lg" />
        </>
      ) : null}

      {isSimulated ? (
        <>
          <Notice tone="warning" title="Módulo nativo no cargado">
            {secureStorage.isSecure
              ? 'Estás sobre el simulador: los permisos y el bloqueo son ficticios. Compila con expo run:android para probar el comportamiento real.'
              : 'Estás en el navegador: además del bloqueo simulado, el PIN se guarda en localStorage y no en el almacén seguro del sistema. Sirve para revisar la interfaz, no para uso real.'}
          </Notice>
          <Gap size="lg" />
        </>
      ) : null}

      {/* 2. Estado de ahora mismo. */}
      <ParentModeCard
        pause={parentPause}
        now={now}
        busy={busy}
        onPause={async (minutes) => {
          setBusy(true);
          try {
            await pauseForParent(minutes);
            await audit('modo_adulto_activado', minutes === null ? 'sin límite' : `${minutes} min`, child.id);
          } finally {
            setBusy(false);
          }
        }}
        onResume={async () => {
          setBusy(true);
          try {
            await resumeChild();
            await audit('modo_adulto_terminado', '', child.id);
          } finally {
            setBusy(false);
          }
        }}
      />

      <Gap size="md" />
      <View style={styles.tarjeta}>
        <View style={styles.tarjetaCabecera}>
          <Text style={styles.tituloSeccion}>Hoy</Text>
          <Txt variant="caption" color={palette.textMuted}>
            día contable desde las {settings.rewardPolicy.dayResetHour}:00
          </Txt>
        </View>
        <Gap size="md" />
        <View style={styles.metricas}>
          <Metrica valor={String(ledger.earnedMinutes)} etiqueta="min ganados" tono="morado" />
          <Metrica valor={String(settings.rewardPolicy.dailyCapMinutes)} etiqueta="tope diario" tono="aqua" />
          <Metrica valor={String(ledger.sessionsCompleted)} etiqueta="sesiones" tono="lima" />
        </View>
        <Gap size="md" />
        <ProgressBar
          value={ledger.earnedMinutes / Math.max(1, settings.rewardPolicy.dailyCapMinutes)}
          color={palette.accent}
        />
      </View>

      {/* 3. Controles inmediatos: lo que un tutor necesita a mitad de una tarde. */}
      <Gap size="lg" />
      <Text style={styles.tituloSeccion}>Acción rápida</Text>
      <Gap size="sm" />
      <View style={styles.acciones}>
        <BotonRapido label="+15 min" disabled={busy} onPress={() => grantExtra(15)} />
        <BotonRapido label="+30 min" disabled={busy} onPress={() => grantExtra(30)} />
        <BotonRapido label="Cortar ya" peligro disabled={busy} onPress={cutNow} />
      </View>

      {/* 4. Configuración. */}
      <Gap size="lg" />
      <Text style={styles.tituloSeccion}>Configuración</Text>
      <Gap size="sm" />
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

      {/* 5. Progreso. */}
      <Gap size="lg" />
      <Text style={styles.tituloSeccion}>Progreso por pilar</Text>
      <Gap size="xs" />
      <Txt variant="caption" color={palette.textMuted}>
        {intentos30 === 0
          ? 'Todavía no hay retos en los últimos 30 días.'
          : `Últimos 30 días: ${intentos30} retos, ${Math.round((aciertos30 / intentos30) * 100)}% de aciertos.`}{' '}
        El nivel refleja la dificultad que resuelve con soltura, no una nota.
      </Txt>
      <Gap size="sm" />
      <View style={[styles.tarjeta, styles.listaPilares]}>
        {stats.map((stat) => {
          const porcentaje = Math.round(masteryPercent(stat.mastery));
          return (
            <View
              key={stat.pillar}
              style={styles.filaPilar}
              accessible
              accessibilityLabel={`${PILLAR_LABEL[stat.pillar]}: nivel ${porcentaje} por ciento, ${stat.attemptsLast30Days} retos en 30 días`}
            >
              <View style={[styles.punto, { backgroundColor: pillarColor[stat.pillar] }]} />
              <Text style={styles.filaNombre}>{PILLAR_LABEL[stat.pillar]}</Text>
              <View style={styles.barraPilar}>
                <View
                  style={[
                    styles.barraPilarRelleno,
                    { width: `${porcentaje}%`, backgroundColor: pillarColor[stat.pillar] },
                  ]}
                />
              </View>
              <Text style={styles.filaPorcentaje}>{porcentaje}%</Text>
            </View>
          );
        })}
      </View>

      {weakest ? (
        <>
          <Gap size="md" />
          <View style={styles.nota}>
            <Text style={styles.notaEmoji}>{PILLAR_EMOJI[weakest]}</Text>
            <Text style={styles.notaTexto}>
              <Text style={styles.notaFuerte}>{PILLAR_LABEL[weakest]}</Text> es el pilar más rezagado.
              NEUROpass ya le está dando más peso en las próximas sesiones; no hace falta que cambies
              nada.
            </Text>
          </View>
        </>
      ) : null}

      <Gap size="lg" />
      <Text style={styles.tituloSeccion}>Últimas sesiones</Text>
      <Gap size="sm" />
      <View style={styles.tarjeta}>
        {sessions.length === 0 ? (
          <Txt variant="caption" color={palette.textMuted}>
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
      </View>

      <Gap size="xxl" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/** Aviso urgente. Pastel rosa y no rojo: urgente no es lo mismo que alarmante. */
function Alerta({ titulo, children }: { titulo: string; children: string }) {
  const styles = useStyles();
  return (
    <View style={styles.alerta} accessibilityRole="alert">
      <View style={styles.alertaIcono}>
        <Text style={styles.alertaEmoji}>⚠️</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.alertaTitulo}>{titulo}</Text>
        <Text style={styles.alertaTexto}>{children}</Text>
      </View>
    </View>
  );
}

/**
 * Modo adulto.
 *
 * El teléfono casi nunca es del menor: se lo prestan. Cuando el adulto lo
 * recupera, sin esta pausa pasan dos cosas indeseables a la vez: el tiempo que
 * el menor ganó se sigue consumiendo aunque no lo esté disfrutando, y la app
 * bloquea aplicaciones y pide resolver retos al adulto en su propio teléfono.
 *
 * La tarjeta vive arriba, junto al estado del menor, porque en una familia que
 * comparte dispositivo esta es la acción más frecuente del día.
 */
function ParentModeCard({
  pause,
  now,
  busy,
  onPause,
  onResume,
}: {
  pause: ParentPause | null;
  now: number;
  busy: boolean;
  onPause: (minutes: number | null) => void;
  onResume: () => void;
}) {
  const { palette } = useTheme();
  const styles = useStyles();
  if (pause) {
    const restante = pause.pausedUntil === null ? null : Math.max(0, pause.pausedUntil - now);

    return (
      <View style={[styles.tarjeta, { backgroundColor: palette.pastelMango }]}>
        <Row gap="md">
          <Text style={styles.parentModeIcon}>⏸️</Text>
          <View style={styles.flex}>
            <Txt variant="bodyStrong">Tienes el teléfono</Txt>
            <Txt variant="caption" color={palette.textMuted}>
              {restante === null
                ? 'Sin límite. El tiempo del menor está congelado hasta que se lo devuelvas.'
                : `Se reanuda solo en ${formatCountdown(restante)}. Su tiempo está congelado.`}
            </Txt>
          </View>
        </Row>
        <Gap size="md" />
        <Button label="Devolver el teléfono" onPress={onResume} disabled={busy} />
      </View>
    );
  }

  return (
    <View style={styles.tarjeta}>
      <Txt variant="bodyStrong">¿Necesitas el teléfono?</Txt>
      <Gap size="xs" />
      <Txt variant="caption" color={palette.textMuted}>
        Congela el tiempo del menor y quita el bloqueo mientras lo usas tú. No pierde ni un minuto
        de lo que ya ganó.
      </Txt>
      <Gap size="md" />
      <View style={styles.acciones}>
        {PAUSE_DURATIONS.map((minutes) => (
          <BotonRapido
            key={minutes ?? 'sin-limite'}
            label={minutes === null ? 'Sin límite' : `${minutes} min`}
            disabled={busy}
            onPress={() => onPause(minutes)}
          />
        ))}
      </View>
    </View>
  );
}

/** Una cifra del día sobre el pastel de su color. */
function Metrica({ valor, etiqueta, tono }: { valor: string; etiqueta: string; tono: TonoMarca }) {
  const { palette, isDark } = useTheme();
  const styles = useStyles();
  const fondo = { morado: palette.accentSoft, aqua: palette.pastelAqua, lima: palette.pastelLima }[
    tono as 'morado' | 'aqua' | 'lima'
  ];
  return (
    <View style={[styles.metrica, { backgroundColor: fondo }]}>
      {/* De día el tono saturado no alcanza contraste sobre su pastel; de noche
          es el oscuro el que se pierde sobre el tinte translúcido. */}
      <Text style={[styles.metricaValor, { color: isDark ? tonoMarca[tono].base : tonoMarca[tono].canto }]}>
        {valor}
      </Text>
      <Text style={styles.metricaEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

/**
 * Botón plano para acciones repetidas. Sin canto a propósito: en esta zona el
 * relieve se reserva al botón principal, y tres botones con canto seguidos se
 * leerían como tres acciones principales.
 */
function BotonRapido({
  label,
  onPress,
  disabled,
  peligro = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  peligro?: boolean;
}) {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.rapido,
        peligro ? { backgroundColor: palette.dangerSoft } : styles.rapidoNeutro,
        pressed && styles.pulsado,
        disabled && styles.inerte,
      ]}
    >
      <Text style={[styles.rapidoTexto, { color: peligro ? palette.danger : palette.text }]}>{label}</Text>
    </Pressable>
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
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    // La fila entera es el objetivo táctil, no un botón «Abrir» al extremo: en
    // una lista de configuración se toca donde está el nombre.
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
      style={({ pressed }) => [styles.navRow, pressed && styles.pulsado]}
    >
      <View style={styles.flex}>
        <Txt variant="bodyStrong">{label}</Txt>
        <Txt variant="caption" color={warning ? palette.warning : palette.textMuted} numberOfLines={2}>
          {detail}
        </Txt>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((palette) => ({
  flex: { flex: 1 },
  pulsado: { opacity: 0.7 },
  inerte: { opacity: 0.45 },

  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  micro: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.84,
    color: palette.textMuted,
  },
  nombre: { fontFamily: 'Baloo2_700Bold', fontSize: 23, lineHeight: 28, color: palette.text },
  estado: { paddingHorizontal: space.md + 3, paddingVertical: space.sm + 1, borderRadius: radius.pill },
  estadoTexto: { fontFamily: 'Nunito_700Bold', fontSize: 13, lineHeight: 18 },

  alerta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md + 1,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.dangerSoft,
  },
  alertaIcono: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(marca.rosa, 0.25),
  },
  alertaEmoji: { fontSize: 18, lineHeight: 24 },
  alertaTitulo: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, lineHeight: 20, color: palette.danger },
  alertaTexto: { fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, lineHeight: 17, color: palette.textMuted },
  requirement: { marginBottom: space.md },

  tarjeta: {
    padding: space.lg + 2,
    borderRadius: radius.xl,
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  tituloSeccion: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 17, lineHeight: 22, color: palette.text },
  metricas: { flexDirection: 'row', gap: 9 },
  metrica: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
  },
  metricaValor: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 23, lineHeight: 30 },
  metricaEtiqueta: { fontFamily: 'Nunito_700Bold', fontSize: 10.5, lineHeight: 14, color: palette.textMuted },
  parentModeIcon: { fontSize: 30, lineHeight: 36 },

  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  rapido: {
    flexGrow: 1,
    flexBasis: 90,
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  rapidoNeutro: { backgroundColor: palette.surface, ...shadow('sm') },
  rapidoTexto: { fontFamily: 'Nunito_700Bold', fontSize: 14.5, lineHeight: 20 },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    marginBottom: space.sm + 2,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  chevron: { fontFamily: 'Baloo2_700Bold', fontSize: 26, lineHeight: 30, color: palette.textMuted },

  listaPilares: { gap: space.md },
  filaPilar: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  filaNombre: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13.5, lineHeight: 18, color: palette.text },
  barraPilar: {
    width: 116,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    overflow: 'hidden',
  },
  barraPilarRelleno: { height: '100%', borderRadius: radius.pill },
  filaPorcentaje: {
    width: 36,
    textAlign: 'right',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    lineHeight: 16,
    color: palette.textMuted,
  },

  nota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm + 2,
    paddingVertical: space.md + 1,
    paddingHorizontal: space.md + 3,
    borderRadius: radius.lg,
    backgroundColor: palette.accentSoft,
  },
  notaEmoji: { fontSize: 17, lineHeight: 22 },
  notaTexto: { flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 12.5, lineHeight: 18, color: palette.text },
  notaFuerte: { fontFamily: 'Nunito_800ExtraBold' },

  sessionRow: { paddingVertical: space.sm },
}));
