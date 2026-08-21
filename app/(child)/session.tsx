import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { Attempt } from '@/domain/exercise';
import { PILLAR_EMOJI, PILLAR_LABEL, type Pillar } from '@/domain/pillar';
import { finishSession, getMastery, getRecentFingerprints, startSession } from '@/data/repositories/progress';
import { applyReward, computeReward } from '@/engine/economy';
import type { MasteryState } from '@/engine/mastery';
import { getLedger, grantTime, saveLedger } from '@/data/repositories/rewards';
import { useActiveChild, useAppStore } from '@/state/appStore';
import { useSession } from '@/state/useSession';
import { ExercisePrompt, StudyPhase, Stem } from '@/ui/components/ExercisePrompt';
import { Badge, Button, Card, Gap, ProgressBar, Row, Screen, Txt } from '@/ui/components/primitives';
import { palette, pillarColor } from '@/ui/theme';

/**
 * Sesión de retos.
 *
 * Es la pantalla que más se usa de toda la app, así que su prioridad es que no
 * estorbe: un reto por pantalla, sin navegación, sin distracciones, y
 * retroalimentación inmediata. Todo el estado de la sesión vive en
 * `useSession`; aquí solo se dibuja y se persiste al terminar.
 */
export default function SessionScreen() {
  const child = useActiveChild();
  const settings = useAppStore((state) => state.settings);
  const syncPolicy = useAppStore((state) => state.syncPolicy);
  const refresh = useAppStore((state) => state.refreshActiveChild);

  const [context, setContext] = useState<{
    mastery: Record<Pillar, MasteryState>;
    recentFingerprints: string[];
    sessionId: string;
    seed: string;
  } | null>(null);

  // La semilla se genera aquí dentro, no en el cuerpo del componente: `Date.now()`
  // durante el render es impuro y produciría una semilla distinta en cada
  // rerender. Fijada una sola vez, la sesión es reproducible y volver atrás no
  // cambia los retos.
  useEffect(() => {
    if (!child) return undefined;
    let cancelled = false;

    (async () => {
      const seed = `${child.id}|${Date.now()}`;
      const [mastery, recentFingerprints, sessionId] = await Promise.all([
        getMastery(child.id),
        getRecentFingerprints(child.id),
        startSession(child.id, seed),
      ]);
      if (!cancelled) setContext({ mastery, recentFingerprints, sessionId, seed });
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
      childId={child.id}
      band={child.band}
      seed={context.seed}
      sessionId={context.sessionId}
      size={settings.sessionSize}
      mastery={context.mastery}
      focusPillars={settings.focusPillars}
      allowOpenResponse={settings.allowOpenResponse}
      recentFingerprints={context.recentFingerprints}
      onFinished={async (attempts) => {
        const ledger = await getLedger(child.id, settings.rewardPolicy);
        const breakdown = computeReward(attempts, settings.rewardPolicy, ledger, Date.now());

        await finishSession({
          sessionId: context.sessionId,
          childId: child.id,
          attempts,
          grantedMinutes: breakdown.grantedMinutes,
        });
        await saveLedger(child.id, applyReward(ledger, breakdown, settings.rewardPolicy, Date.now()));

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
  childId: string;
  band: Parameters<typeof useSession>[0]['band'];
  seed: string;
  sessionId: string;
  size: number;
  mastery: Record<Pillar, MasteryState>;
  focusPillars: readonly Pillar[];
  allowOpenResponse: boolean;
  recentFingerprints: readonly string[];
  onFinished: (attempts: readonly Attempt[]) => Promise<void>;
}

function SessionRunner(props: RunnerProps) {
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
    void props.onFinished(session.attempts);
  }, [session.phase, session.attempts, props]);

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

  const accent = pillarColor[exercise.pillar];
  const reviewing = session.phase === 'revisando';

  return (
    <Screen
      scroll
      footer={
        reviewing ? (
          <View>
            <Txt variant="bodyStrong" color={feedbackColor(session.lastAttempt)}>
              {session.lastAttempt?.grade.feedback}
            </Txt>
            {session.lastAttempt?.grade.expected &&
            session.lastAttempt.grade.outcome !== 'correct' ? (
              <>
                <Gap size="xs" />
                <Txt variant="caption" color={palette.textMuted}>
                  La respuesta era: {session.lastAttempt.grade.expected}
                </Txt>
              </>
            ) : null}
            <Gap size="md" />
            <Button
              label={session.index + 1 >= session.total ? 'Ver mis minutos' : 'Siguiente reto'}
              onPress={session.next}
            />
          </View>
        ) : null
      }
    >
      <Row justify="space-between">
        <Txt variant="caption" color={palette.textMuted}>
          Reto {session.index + 1} de {session.total}
        </Txt>
        {session.secondsLeft !== null ? (
          <Txt
            variant="caption"
            color={session.secondsLeft <= 10 ? palette.warning : palette.textMuted}
          >
            ⏱ {session.secondsLeft}s
          </Txt>
        ) : (
          <Txt variant="caption" color={palette.textFaint}>
            Sin prisa
          </Txt>
        )}
      </Row>

      <Gap size="sm" />
      <ProgressBar value={session.index / session.total} color={accent} />
      <Gap size="xl" />

      <Row gap="sm">
        <Badge label={`${PILLAR_EMOJI[exercise.pillar]} ${PILLAR_LABEL[exercise.pillar]}`} color={accent} />
        <Badge label={'★'.repeat(exercise.difficulty)} color={palette.textMuted} />
      </Row>

      <Gap size="lg" />

      {session.phase === 'estudiando' && exercise.prompt.kind === 'sequence_recall' ? (
        <StudyPhase
          instruction={exercise.prompt.instruction}
          sequence={exercise.prompt.sequence}
          onSkip={session.finishStudy}
        />
      ) : (
        <>
          <Stem exercise={exercise} />
          <Gap size="xl" />

          <ExercisePrompt
            exercise={exercise}
            disabled={reviewing}
            grade={session.lastAttempt?.grade ?? null}
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

          {session.canRequestHint ? (
            <>
              <Gap size="lg" />
              <Button label="Necesito una pista" variant="ghost" onPress={session.requestHint} />
            </>
          ) : null}

          {session.hintVisible && exercise.prompt.hint ? (
            <>
              <Gap size="md" />
              <Card accent={palette.warning}>
                <Txt variant="caption" color={palette.warning}>
                  PISTA
                </Txt>
                <Gap size="xs" />
                <Txt variant="body">{exercise.prompt.hint}</Txt>
                <Gap size="xs" />
                <Txt variant="caption" color={palette.textFaint}>
                  Este reto valdrá algunos minutos menos.
                </Txt>
              </Card>
            </>
          ) : null}
        </>
      )}

      <Gap size="xxl" />
    </Screen>
  );
}

function feedbackColor(attempt: Attempt | null): string {
  switch (attempt?.grade.outcome) {
    case 'correct':
    case 'accepted':
      return palette.success;
    case 'incorrect':
      return palette.warning;
    default:
      return palette.textMuted;
  }
}

