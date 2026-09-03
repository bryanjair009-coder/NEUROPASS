import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  ALL_WEEKDAYS,
  SCHOOL_DAYS,
  WEEKDAY_LABELS,
  audit,
  deleteSchedule,
  describeSchedule,
  formatMinute,
  listSchedules,
  upsertSchedule,
  type Schedule,
} from '@/data/repositories/policy';
import { useActiveChild, useAppStore } from '@/state/appStore';
import {
  Button,
  Card,
  EmptyState,
  Gap,
  Notice,
  Row,
  Screen,
  Txt,
} from '@/ui/components/primitives';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import { MIN_TOUCH_TARGET, radius, space, typography } from '@/ui/theme';

import { useParentSession } from './_layout';

/**
 * Horarios protegidos.
 *
 * Franjas en las que el ocio está bloqueado aunque el menor tenga minutos
 * ganados. Se ofrecen plantillas —escuela, dormir, comida— porque son las tres
 * que configura casi todo el mundo, y crear una franja desde cero eligiendo
 * máscara de días y minutos es una fricción innecesaria para el caso común.
 */

interface Template {
  readonly label: string;
  readonly weekdayMask: number;
  readonly startMinute: number;
  readonly endMinute: number;
}

const TEMPLATES: readonly Template[] = [
  { label: 'Escuela', weekdayMask: SCHOOL_DAYS, startMinute: 7 * 60, endMinute: 14 * 60 },
  { label: 'Tarea', weekdayMask: SCHOOL_DAYS, startMinute: 16 * 60, endMinute: 18 * 60 },
  { label: 'Comida', weekdayMask: ALL_WEEKDAYS, startMinute: 14 * 60, endMinute: 15 * 60 },
  // La noche se corta a las 23:59 y no cruza la medianoche: una franja que
  // cruza el día se modela como dos, según valida el repositorio.
  { label: 'Dormir', weekdayMask: ALL_WEEKDAYS, startMinute: 21 * 60, endMinute: 23 * 60 + 59 },
];

export default function SchedulesScreen() {
  const palette = usePalette();
  const styles = useStyles();
  const session = useParentSession();
  const child = useActiveChild();
  const syncPolicy = useAppStore((state) => state.syncPolicy);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Schedule, 'id'> | null>(null);

  const reload = useCallback(async () => {
    if (!child) return;
    setSchedules(await listSchedules(child.id));
  }, [child]);

  // La carga inicial se hace con guarda de cancelación en lugar de invocar
  // `reload` a secas: si la pantalla se desmonta mientras la consulta está en
  // vuelo, escribir estado sobre un componente ya retirado es una fuga.
  useEffect(() => {
    if (!child) return undefined;
    let cancelled = false;

    void listSchedules(child.id).then((rows) => {
      if (!cancelled) setSchedules(rows);
    });

    return () => {
      cancelled = true;
    };
  }, [child]);

  if (!session.unlocked) return <Redirect href="/(parent)/unlock" />;
  if (!child) return null;

  const persist = async (schedule: Omit<Schedule, 'id'> & { id?: string }) => {
    setError(null);
    try {
      await upsertSchedule(schedule);
      await audit('horario_actualizado', schedule.label, child.id);
      await reload();
      await syncPolicy();
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la franja.');
    }
  };

  const remove = async (schedule: Schedule) => {
    await deleteSchedule(schedule.id);
    await audit('horario_actualizado', `eliminado: ${schedule.label}`, child.id);
    await reload();
    await syncPolicy();
  };

  return (
    <Screen>
      <Notice tone="info" title="Los horarios ganan al tiempo ganado">
        Dentro de una franja protegida, las apps limitadas quedan bloqueadas aunque el menor tenga
        minutos disponibles. Es lo que evita que los retos se conviertan en una forma de negociar la
        hora de dormir.
      </Notice>

      <Gap size="xl" />

      {schedules.length === 0 ? (
        <EmptyState
          emoji="🗓️"
          title="Sin franjas configuradas"
          description="Añade una de las plantillas de abajo o crea la tuya."
        />
      ) : (
        schedules.map((schedule) => (
          <Card key={schedule.id} style={styles.scheduleCard}>
            <Row justify="space-between">
              <View style={styles.scheduleText}>
                <Txt variant="bodyStrong" color={schedule.enabled ? palette.text : palette.textFaint}>
                  {schedule.label}
                </Txt>
                <Gap size="xs" />
                <Txt variant="caption" color={palette.textMuted}>
                  {describeSchedule(schedule)}
                </Txt>
              </View>

              <Row gap="sm">
                <Button
                  label={schedule.enabled ? 'Activa' : 'Pausada'}
                  variant={schedule.enabled ? 'primary' : 'secondary'}
                  fullWidth={false}
                  onPress={() => persist({ ...schedule, enabled: !schedule.enabled })}
                />
                <Button
                  label="✕"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => remove(schedule)}
                />
              </Row>
            </Row>
          </Card>
        ))
      )}

      <Gap size="xl" />
      <Txt variant="heading">Añadir franja</Txt>
      <Gap size="md" />

      <Row gap="sm" wrap>
        {TEMPLATES.map((template) => (
          <Button
            key={template.label}
            label={template.label}
            variant="secondary"
            fullWidth={false}
            onPress={() => persist({ ...template, childId: child.id, enabled: true })}
          />
        ))}
        <Button
          label="Personalizada"
          variant="ghost"
          fullWidth={false}
          onPress={() =>
            setDraft({
              childId: child.id,
              label: 'Nueva franja',
              weekdayMask: ALL_WEEKDAYS,
              startMinute: 20 * 60,
              endMinute: 22 * 60,
              enabled: true,
            })
          }
        />
      </Row>

      {draft ? (
        <>
          <Gap size="lg" />
          <DraftEditor
            draft={draft}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={() => persist(draft)}
          />
        </>
      ) : null}

      {error ? (
        <>
          <Gap size="md" />
          <Txt variant="caption" color={palette.danger}>
            {error}
          </Txt>
        </>
      ) : null}

      <Gap size="xxl" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function DraftEditor({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Omit<Schedule, 'id'>;
  onChange: (draft: Omit<Schedule, 'id'>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const palette = usePalette();
  const styles = useStyles();
  return (
    <Card raised>
      <Txt variant="caption" color={palette.textMuted}>
        Nombre
      </Txt>
      <Gap size="xs" />
      <TextInput
        value={draft.label}
        onChangeText={(label) => onChange({ ...draft, label })}
        style={styles.input}
        maxLength={30}
        accessibilityLabel="Nombre de la franja"
      />

      <Gap size="lg" />
      <Txt variant="caption" color={palette.textMuted}>
        Días
      </Txt>
      <Gap size="sm" />
      <Row gap="sm">
        {WEEKDAY_LABELS.map((label, index) => {
          const bit = 1 << index;
          const active = (draft.weekdayMask & bit) !== 0;
          return (
            <Pressable
              key={`${label}-${index}`}
              onPress={() => onChange({ ...draft, weekdayMask: draft.weekdayMask ^ bit })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              style={[styles.dayChip, active && styles.dayChipActive]}
            >
              <Txt variant="caption" color={active ? palette.white : palette.textMuted}>
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </Row>

      <Gap size="lg" />
      <Row gap="lg">
        <TimeStepper
          label="Desde"
          minute={draft.startMinute}
          onChange={(startMinute) => onChange({ ...draft, startMinute })}
        />
        <TimeStepper
          label="Hasta"
          minute={draft.endMinute}
          onChange={(endMinute) => onChange({ ...draft, endMinute })}
        />
      </Row>

      <Gap size="lg" />
      <Row gap="sm">
        <Button label="Cancelar" variant="ghost" fullWidth={false} onPress={onCancel} />
        <Button label="Guardar franja" fullWidth={false} onPress={onSave} style={styles.grow} />
      </Row>
    </Card>
  );
}

/**
 * Selector de hora en pasos de 30 minutos.
 *
 * Un selector nativo de hora daría precisión al minuto que nadie necesita para
 * "de 7:00 a 14:00", y obligaría a una dependencia más con comportamiento
 * distinto en cada plataforma. Dos botones y medias horas cubren el caso real.
 */
function TimeStepper({
  label,
  minute,
  onChange,
}: {
  label: string;
  minute: number;
  onChange: (minute: number) => void;
}) {
  const palette = usePalette();
  const styles = useStyles();
  const step = 30;
  return (
    <View style={styles.grow}>
      <Txt variant="caption" color={palette.textMuted}>
        {label}
      </Txt>
      <Gap size="xs" />
      <Row justify="space-between" style={styles.stepper}>
        <Pressable onPress={() => onChange(Math.max(0, minute - step))} hitSlop={8}>
          <Txt variant="title" color={palette.accentSoft}>
            −
          </Txt>
        </Pressable>
        <Txt variant="bodyStrong">{formatMinute(minute)}</Txt>
        <Pressable onPress={() => onChange(Math.min(1440, minute + step))} hitSlop={8}>
          <Txt variant="title" color={palette.accentSoft}>
            +
          </Txt>
        </Pressable>
      </Row>
    </View>
  );
}

const useStyles = makeStyles((palette) => ({
  scheduleCard: { marginBottom: space.md },
  scheduleText: { flex: 1, marginRight: space.md },
  input: {
    ...(typography.body as object),
    color: palette.text,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  dayChip: {
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  stepper: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: palette.surfaceRaised,
  },
  grow: { flex: 1 },
}));
