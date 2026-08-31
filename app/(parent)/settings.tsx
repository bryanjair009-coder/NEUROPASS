import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PILLARS, PILLAR_EMOJI, PILLAR_LABEL, type Pillar } from '@/domain/pillar';
import { AGE_BANDS, AGE_BAND_LABEL, type AgeBand } from '@/domain/age';
import { updateChild, updateSettings } from '@/data/repositories/children';
import { audit } from '@/data/repositories/policy';
import { deleteOpenResponses, listOpenResponses, type OpenResponseRecord } from '@/data/repositories/progress';
import { wipeAllData } from '@/data/db';
import { DEFAULT_REWARD_POLICY } from '@/engine/economy';
import { screenTime } from '@/screentime';
import { clearPin } from '@/security/pinStore';
import { useActiveChild, useAppStore } from '@/state/appStore';
import {
  Button,
  Card,
  Gap,
  Notice,
  Row,
  Screen,
  Txt,
} from '@/ui/components/primitives';
import { palette, radius, space } from '@/ui/theme';

import { useParentSession } from './_layout';

/**
 * Ajustes y privacidad.
 *
 * La sección de datos está deliberadamente al mismo nivel que las demás y no
 * escondida al fondo: qué se guarda, dónde y cómo borrarlo es información que
 * una madre o un padre tiene derecho a encontrar sin buscar, y es exactamente
 * lo que revisan tanto Apple como Google en una app de la categoría Familias.
 */
export default function SettingsScreen() {
  const session = useParentSession();
  const child = useActiveChild();
  const settings = useAppStore((state) => state.settings);
  const capabilities = useAppStore((state) => state.capabilities);
  const refresh = useAppStore((state) => state.refreshActiveChild);
  const refreshCapabilities = useAppStore((state) => state.refreshCapabilities);
  const bootstrap = useAppStore((state) => state.bootstrap);

  const [responses, setResponses] = useState<OpenResponseRecord[]>([]);

  const reload = useCallback(async () => {
    if (!child) return;
    setResponses(await listOpenResponses(child.id, 20));
  }, [child]);

  // La carga inicial se hace con guarda de cancelación en lugar de invocar
  // `reload` a secas: si la pantalla se desmonta mientras la consulta está en
  // vuelo, escribir estado sobre un componente ya retirado es una fuga.
  useEffect(() => {
    if (!child) return undefined;
    let cancelled = false;

    void listOpenResponses(child.id, 20).then((rows) => {
      if (!cancelled) setResponses(rows);
    });

    return () => {
      cancelled = true;
    };
  }, [child]);

  if (!session.unlocked) return <Redirect href="/(parent)/unlock" />;
  if (!child || !settings) return null;

  const patch = async (changes: Parameters<typeof updateSettings>[1], detail: string) => {
    await updateSettings(child.id, changes);
    await audit('ajustes_actualizados', detail, child.id);
    await refresh();
  };

  const togglePillar = async (pillar: Pillar) => {
    const current = new Set(settings.focusPillars);
    if (current.has(pillar)) current.delete(pillar);
    else current.add(pillar);

    // Todos marcados equivale a ninguno marcado: se normaliza a lista vacía
    // para que el planificador no tenga que distinguir dos formas del mismo
    // estado.
    const next = current.size === PILLARS.length ? [] : [...current];
    await patch({ focusPillars: next }, `pilares: ${next.length === 0 ? 'todos' : next.join(', ')}`);
  };

  return (
    <Screen>
      <Txt variant="heading">Perfil</Txt>
      <Gap size="md" />
      <Card>
        <Txt variant="caption" color={palette.textMuted}>
          Rango de edad de {child.alias}
        </Txt>
        <Gap size="sm" />
        <Row gap="sm" wrap>
          {AGE_BANDS.map((band: AgeBand) => (
            <Button
              key={band}
              label={AGE_BAND_LABEL[band]}
              variant={child.band === band ? 'primary' : 'secondary'}
              fullWidth={false}
              onPress={async () => {
                await updateChild(child.id, { band });
                await audit('ajustes_actualizados', `rango: ${band}`, child.id);
                await bootstrap();
              }}
            />
          ))}
        </Row>
        <Gap size="sm" />
        <Txt variant="caption" color={palette.textFaint}>
          Cambiar el rango no borra el progreso, pero la dificultad se recalibra en las siguientes
          sesiones.
        </Txt>
      </Card>

      <Gap size="xl" />
      <Txt variant="heading">Sesiones y recompensa</Txt>
      <Gap size="md" />

      <Card>
        <Stepper
          label="Retos por sesión"
          value={settings.sessionSize}
          min={3}
          max={15}
          step={1}
          onChange={(sessionSize) => patch({ sessionSize }, `retos por sesión: ${sessionSize}`)}
        />

        <Gap size="lg" />
        <Stepper
          label="Tope de minutos al día"
          value={settings.rewardPolicy.dailyCapMinutes}
          min={15}
          max={240}
          step={15}
          suffix=" min"
          onChange={(dailyCapMinutes) =>
            patch(
              { rewardPolicy: { ...settings.rewardPolicy, dailyCapMinutes } },
              `tope diario: ${dailyCapMinutes} min`,
            )
          }
        />

        <Gap size="lg" />
        <Stepper
          label="Minutos por reto resuelto"
          value={settings.rewardPolicy.minutesPerCorrect}
          min={1}
          max={10}
          step={1}
          suffix=" min"
          onChange={(minutesPerCorrect) =>
            patch(
              { rewardPolicy: { ...settings.rewardPolicy, minutesPerCorrect } },
              `minutos por reto: ${minutesPerCorrect}`,
            )
          }
        />

        <Gap size="lg" />
        <Stepper
          label="Avisar antes de que se acabe"
          value={settings.rewardPolicy.expiryWarningMinutes}
          min={0}
          max={20}
          step={1}
          suffix=" min"
          onChange={(expiryWarningMinutes) =>
            patch(
              { rewardPolicy: { ...settings.rewardPolicy, expiryWarningMinutes } },
              `aviso previo: ${expiryWarningMinutes} min`,
            )
          }
        />
        <Gap size="sm" />
        <Txt variant="caption" color={palette.textMuted}>
          {settings.rewardPolicy.expiryWarningMinutes === 0
            ? 'Sin aviso: el tiempo se corta sin previo aviso.'
            : `Llega una notificación ${settings.rewardPolicy.expiryWarningMinutes} minutos antes para que pueda cerrar lo que esté haciendo.`}
        </Txt>

        <Gap size="lg" />
        <Stepper
          label="Espera entre sesiones"
          value={settings.rewardPolicy.sessionCooldownMinutes}
          min={0}
          max={60}
          step={5}
          suffix=" min"
          onChange={(sessionCooldownMinutes) =>
            patch(
              { rewardPolicy: { ...settings.rewardPolicy, sessionCooldownMinutes } },
              `espera: ${sessionCooldownMinutes} min`,
            )
          }
        />

        <Gap size="lg" />
        <Button
          label="Restaurar valores por defecto"
          variant="ghost"
          onPress={() => patch({ rewardPolicy: DEFAULT_REWARD_POLICY }, 'recompensa restaurada')}
        />
      </Card>

      <Gap size="xl" />
      <Txt variant="heading">Pilares activos</Txt>
      <Gap size="sm" />
      <Txt variant="caption" color={palette.textMuted}>
        Por omisión entran los cinco. Limitar a uno o dos concentra el esfuerzo pero deja de
        ejercitar el resto.
      </Txt>
      <Gap size="md" />

      {PILLARS.map((pillar) => {
        const active = settings.focusPillars.length === 0 || settings.focusPillars.includes(pillar);
        return (
          <Pressable
            key={pillar}
            onPress={() => togglePillar(pillar)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            style={[styles.pillarRow, active && styles.pillarRowActive]}
          >
            <Txt variant="bodyStrong">
              {PILLAR_EMOJI[pillar]}  {PILLAR_LABEL[pillar]}
            </Txt>
            <Txt variant="title" color={active ? palette.accent : palette.textFaint}>
              {active ? '☑' : '☐'}
            </Txt>
          </Pressable>
        );
      })}

      <Gap size="lg" />
      <Row justify="space-between">
        <View style={styles.grow}>
          <Txt variant="bodyStrong">Retos de respuesta escrita</Txt>
          <Txt variant="caption" color={palette.textMuted}>
            Los de creatividad. Se guardan en este teléfono y puedes leerlos abajo.
          </Txt>
        </View>
        <Button
          label={settings.allowOpenResponse ? 'Activados' : 'Desactivados'}
          variant={settings.allowOpenResponse ? 'primary' : 'secondary'}
          fullWidth={false}
          onPress={() =>
            patch(
              { allowOpenResponse: !settings.allowOpenResponse },
              `respuesta escrita: ${!settings.allowOpenResponse}`,
            )
          }
        />
      </Row>

      <Gap size="xl" />
      <Txt variant="heading">Lo que ha escrito {child.alias}</Txt>
      <Gap size="md" />

      {responses.length === 0 ? (
        <Txt variant="caption" color={palette.textFaint}>
          Todavía no hay respuestas escritas.
        </Txt>
      ) : (
        <>
          {responses.map((response) => (
            <Card key={response.id} style={styles.responseCard}>
              <Txt variant="caption" color={palette.textMuted} numberOfLines={2}>
                {response.prompt}
              </Txt>
              <Gap size="sm" />
              <Txt variant="body">{response.body}</Txt>
            </Card>
          ))}
          <Gap size="sm" />
          <Button
            label="Borrar todas las respuestas"
            variant="danger"
            onPress={() =>
              confirm(
                'Borrar respuestas escritas',
                `Se eliminarán las ${responses.length} respuestas de ${child.alias}. El progreso y los niveles no se tocan.`,
                async () => {
                  await deleteOpenResponses(child.id);
                  await audit('datos_borrados', 'respuestas escritas', child.id);
                  await reload();
                },
              )
            }
          />
        </>
      )}

      <Gap size="xl" />
      <Txt variant="heading">Seguridad</Txt>
      <Gap size="md" />

      <Card>
        <Txt variant="bodyStrong">Protección antidesinstalación</Txt>
        <Gap size="xs" />
        <Txt variant="caption" color={palette.textMuted}>
          {capabilities?.backend === 'ios'
            ? 'En iOS esto se gestiona desde Tiempo en Pantalla o un perfil de supervisión de Apple, no desde la app.'
            : capabilities?.deviceAdmin
              ? 'Activa. NEUROpass no puede desinstalarse desde el lanzador.'
              : 'Desactivada. El menor puede desinstalar la app desde los ajustes.'}
        </Txt>

        {capabilities?.backend !== 'ios' ? (
          <>
            <Gap size="md" />
            <Button
              label={capabilities?.deviceAdmin ? 'Desactivar protección' : 'Activar protección'}
              variant={capabilities?.deviceAdmin ? 'secondary' : 'primary'}
              onPress={async () => {
                if (capabilities?.deviceAdmin) await screenTime.releaseDeviceAdmin();
                else await screenTime.requestDeviceAdmin();
                await refreshCapabilities();
              }}
            />
            <Gap size="sm" />
            <Txt variant="caption" color={palette.textFaint}>
              Desactívala antes de desinstalar NEUROpass; si no, Android no dejará quitarla.
            </Txt>
          </>
        ) : null}
      </Card>

      <Gap size="md" />
      <Button
        label="Cambiar PIN"
        variant="secondary"
        onPress={() =>
          confirm(
            'Cambiar PIN',
            'Se generará también un código de recuperación nuevo y el anterior dejará de servir.',
            async () => {
              await clearPin();
              await bootstrap();
              router.replace('/onboarding');
            },
          )
        }
      />

      <Gap size="xl" />
      <Txt variant="heading">Datos y privacidad</Txt>
      <Gap size="md" />

      <Notice tone="info" title="Qué guarda NEUROpass">
        Todo vive únicamente en este teléfono, en una base de datos local. No hay servidor, no hay
        cuenta y no se envía nada por internet. De {child.alias} solo se almacena el apodo que tú
        escribiste, un emoji, el rango de edad y el resultado de cada reto: nunca el enunciado ni la
        opción que eligió.
      </Notice>

      <Gap size="md" />
      <Button
        label="Copiar resumen de privacidad"
        variant="ghost"
        onPress={async () => {
          await Clipboard.setStringAsync(PRIVACY_SUMMARY);
          await audit('datos_exportados', 'resumen de privacidad', child.id);
        }}
      />

      <Gap size="md" />
      <Button
        label="Borrar todos los datos"
        variant="danger"
        onPress={() =>
          confirm(
            'Borrar todo',
            'Se eliminarán todos los perfiles, el progreso, las respuestas escritas y el PIN. No se puede deshacer.',
            async () => {
              // El orden importa: primero se retira la política del guardián
              // nativo, y solo después se borra la base. Al revés quedaría un
              // servicio aplicando un bloqueo cuyo motivo ya no existe.
              await screenTime.clearPolicy();
              await wipeAllData();
              await clearPin();
              await bootstrap();
              router.replace('/onboarding');
            },
          )
        }
      />

      <Gap size="xxl" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

const PRIVACY_SUMMARY = [
  'NEUROpass — resumen de tratamiento de datos',
  '',
  'Almacenamiento: exclusivamente local (SQLite en el dispositivo).',
  'Transmisión de datos: ninguna. La app no realiza peticiones de red.',
  'Cuentas de usuario: no existen.',
  'Publicidad y analítica de terceros: ninguna.',
  '',
  'Datos del menor que se guardan:',
  '  - Apodo escrito por la madre, el padre o el tutor.',
  '  - Emoji de avatar.',
  '  - Rango de edad (6-8, 9-12 o 13-16). No se guarda la fecha de nacimiento.',
  '  - Por cada reto: pilar, dificultad, si acertó, tiempo empleado y una huella',
  '    del reto. No se guardan el enunciado ni la respuesta elegida.',
  '  - Respuestas de los retos de creatividad, si están activados. Se pueden',
  '    borrar por separado en cualquier momento.',
  '',
  'Datos del tutor: derivado PBKDF2 del PIN y del código de recuperación,',
  'guardados en el almacén seguro del sistema (Keychain / Keystore).',
].join('\n');

function confirm(title: string, message: string, action: () => Promise<void>): void {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Continuar', style: 'destructive', onPress: () => void action() },
  ]);
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <View>
      <Txt variant="caption" color={palette.textMuted}>
        {label}
      </Txt>
      <Gap size="xs" />
      <Row justify="space-between" style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Reducir ${label}`}
        >
          <Txt variant="title" color={value <= min ? palette.textFaint : palette.accentSoft}>
            −
          </Txt>
        </Pressable>

        <Txt variant="bodyStrong">
          {value}
          {suffix}
        </Txt>

        <Pressable
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Aumentar ${label}`}
        >
          <Txt variant="title" color={value >= max ? palette.textFaint : palette.accentSoft}>
            +
          </Txt>
        </Pressable>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pillarRowActive: { borderColor: palette.accent },
  stepper: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    backgroundColor: palette.surfaceRaised,
  },
  responseCard: { marginBottom: space.md },
  grow: { flex: 1, marginRight: space.md },
});
