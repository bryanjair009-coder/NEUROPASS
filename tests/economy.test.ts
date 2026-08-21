import { describe, expect, it } from 'vitest';

import type { Attempt, Difficulty, Exercise, GradeOutcome } from '@/domain/exercise';
import {
  DEFAULT_REWARD_POLICY,
  applyReward,
  canStartSession,
  computeReward,
  dayKeyOf,
  emptyLedger,
  extendUnlockWindow,
  rolledOver,
  type DailyLedger,
} from '@/engine/economy';

const policy = DEFAULT_REWARD_POLICY;
const T0 = new Date('2026-08-21T15:00:00').getTime();

function attempt(
  outcome: GradeOutcome,
  difficulty: Difficulty,
  options: { usedHint?: boolean; open?: boolean } = {},
): Attempt {
  const exercise = {
    id: `x-${outcome}-${difficulty}-${Math.random()}`,
    sourceId: 'test',
    pillar: 'matematicas',
    band: '9-12',
    difficulty,
    fingerprint: 'fp',
    timeLimitSec: 60,
    prompt: options.open
      ? { kind: 'open_response', stem: 'x', placeholder: 'y', minChars: 10, minDistinctWords: 3 }
      : { kind: 'multiple_choice', stem: 'x', options: ['a', 'b', 'c'], correctIndex: 0 },
  } as Exercise;

  return {
    exercise,
    response: { kind: 'choice', index: 0 },
    grade: { outcome, score: outcome === 'correct' || outcome === 'accepted' ? 1 : 0, feedback: '' },
    elapsedMs: 5_000,
    usedHint: options.usedHint ?? false,
  };
}

const freshLedger = (): DailyLedger => emptyLedger(T0, policy);

describe('día contable', () => {
  it('la madrugada cuenta al día anterior', () => {
    // Con corte a las 4:00, las 02:00 del día 21 pertenecen al día 20.
    const lateNight = new Date('2026-08-21T02:00:00').getTime();
    const afternoon = new Date('2026-08-20T15:00:00').getTime();
    expect(dayKeyOf(lateNight, 4)).toBe(dayKeyOf(afternoon, 4));
  });

  it('después del corte empieza un día nuevo', () => {
    const beforeReset = new Date('2026-08-21T03:59:00').getTime();
    const afterReset = new Date('2026-08-21T04:01:00').getTime();
    expect(dayKeyOf(beforeReset, 4)).not.toBe(dayKeyOf(afterReset, 4));
  });

  it('el libro se reinicia solo al cambiar de día contable', () => {
    const used: DailyLedger = { ...freshLedger(), earnedMinutes: 45, sessionsCompleted: 3 };
    expect(rolledOver(used, T0 + 60_000, policy).earnedMinutes).toBe(45);

    const nextDay = new Date('2026-08-22T10:00:00').getTime();
    expect(rolledOver(used, nextDay, policy).earnedMinutes).toBe(0);
    expect(rolledOver(used, nextDay, policy).sessionsCompleted).toBe(0);
  });
});

describe('cálculo de recompensa', () => {
  it('paga más por dificultad más alta', () => {
    const easy = computeReward([attempt('correct', 1)], policy, freshLedger(), T0);
    const hard = computeReward([attempt('correct', 5)], policy, freshLedger(), T0);
    expect(hard.grantedMinutes).toBeGreaterThan(easy.grantedMinutes);
  });

  it('un fallo no paga, pero tampoco resta', () => {
    const onlyWrong = computeReward([attempt('incorrect', 3), attempt('incorrect', 3)], policy, freshLedger(), T0);
    expect(onlyWrong.grantedMinutes).toBe(0);

    // El fallo solo cuesta el bono de sesión perfecta; los minutos que ya
    // habían ganado los aciertos se conservan intactos.
    const mixed = computeReward([attempt('correct', 3), attempt('incorrect', 3)], policy, freshLedger(), T0);
    const alone = computeReward([attempt('correct', 3)], policy, freshLedger(), T0);

    const baseOf = (result: typeof mixed): number =>
      result.lines.find((line) => line.label.includes('retos resueltos'))?.minutes ?? 0;

    expect(baseOf(mixed)).toBe(baseOf(alone));
    expect(mixed.grantedMinutes).toBe(alone.grantedMinutes - policy.perfectBonusMinutes);
  });

  it('premia la sesión perfecta', () => {
    const perfect = computeReward([attempt('correct', 2), attempt('correct', 2)], policy, freshLedger(), T0);
    const imperfect = computeReward(
      [attempt('correct', 2), attempt('correct', 2), attempt('incorrect', 2)],
      policy,
      freshLedger(),
      T0,
    );
    expect(perfect.lines.some((l) => l.label === 'Sesión perfecta')).toBe(true);
    expect(imperfect.lines.some((l) => l.label === 'Sesión perfecta')).toBe(false);
  });

  it('la pista reduce el pago sin anularlo', () => {
    const clean = computeReward([attempt('correct', 4)], policy, freshLedger(), T0);
    const hinted = computeReward([attempt('correct', 4, { usedHint: true })], policy, freshLedger(), T0);
    expect(hinted.grantedMinutes).toBeLessThan(clean.grantedMinutes);
    expect(hinted.grantedMinutes).toBeGreaterThan(0);
  });

  it('los retos abiertos pagan pero no cuentan para la sesión perfecta', () => {
    const withOpen = computeReward(
      [attempt('correct', 3), attempt('accepted', 3, { open: true })],
      policy,
      freshLedger(),
      T0,
    );
    expect(withOpen.correctCount).toBe(2);
    expect(withOpen.gradedCount).toBe(1);
    expect(withOpen.lines.some((l) => l.label === 'Sesión perfecta')).toBe(true);
  });

  it('aplica rendimientos decrecientes a partir de la cuarta sesión del día', () => {
    const attempts = [attempt('correct', 3), attempt('correct', 3), attempt('correct', 3)];

    const first = computeReward(attempts, policy, { ...freshLedger(), sessionsCompleted: 0 }, T0);
    const fourth = computeReward(attempts, policy, { ...freshLedger(), sessionsCompleted: 3 }, T0);
    const sixth = computeReward(attempts, policy, { ...freshLedger(), sessionsCompleted: 5 }, T0);

    expect(first.diminishingApplied).toBe(1);
    expect(fourth.grantedMinutes).toBeLessThan(first.grantedMinutes);
    expect(sixth.grantedMinutes).toBeLessThan(fourth.grantedMinutes);
    expect(sixth.grantedMinutes).toBeGreaterThan(0);
  });

  it('nunca supera el tope diario', () => {
    const attempts = Array.from({ length: 20 }, () => attempt('correct', 5));
    const ledger: DailyLedger = { ...freshLedger(), earnedMinutes: 85 };

    const result = computeReward(attempts, policy, ledger, T0);
    expect(result.grantedMinutes).toBe(policy.dailyCapMinutes - 85);
    expect(result.cappedByDailyLimit).toBe(true);
    expect(applyReward(ledger, result, policy, T0).earnedMinutes).toBe(policy.dailyCapMinutes);
  });

  it('no otorga nada si el tope ya está agotado', () => {
    const ledger: DailyLedger = { ...freshLedger(), earnedMinutes: policy.dailyCapMinutes };
    expect(computeReward([attempt('correct', 5)], policy, ledger, T0).grantedMinutes).toBe(0);
  });

  it('el desglose siempre suma lo que se muestra al tutor', () => {
    const result = computeReward([attempt('correct', 3), attempt('correct', 5)], policy, freshLedger(), T0);
    const total = result.lines.reduce((sum, line) => sum + line.minutes, 0);
    expect(Math.round(total)).toBe(result.grantedMinutes);
  });
});

describe('control de acceso a una nueva sesión', () => {
  it('permite la primera sesión del día', () => {
    expect(canStartSession(freshLedger(), policy, T0)).toEqual({ allowed: true });
  });

  it('exige el enfriamiento entre sesiones', () => {
    const ledger: DailyLedger = { ...freshLedger(), lastSessionEndedAt: T0 };

    const tooSoon = canStartSession(ledger, policy, T0 + 60_000);
    expect(tooSoon.allowed).toBe(false);
    if (!tooSoon.allowed && tooSoon.reason === 'cooldown') {
      expect(tooSoon.waitMs).toBe(9 * 60_000);
    }

    expect(canStartSession(ledger, policy, T0 + 11 * 60_000).allowed).toBe(true);
  });

  it('atrasar el reloj no salta el enfriamiento', () => {
    const ledger: DailyLedger = { ...freshLedger(), lastSessionEndedAt: T0 };
    const result = canStartSession(ledger, policy, T0 - 3 * 60 * 60 * 1000);

    expect(result.allowed).toBe(false);
    if (!result.allowed && result.reason === 'cooldown') {
      expect(result.waitMs).toBe(policy.sessionCooldownMinutes * 60_000);
    }
  });

  it('bloquea al alcanzar el tope diario', () => {
    const ledger: DailyLedger = { ...freshLedger(), earnedMinutes: policy.dailyCapMinutes };
    expect(canStartSession(ledger, policy, T0)).toEqual({ allowed: false, reason: 'daily_cap' });
  });

  it('el tope se libera al cambiar el día contable', () => {
    const ledger: DailyLedger = { ...freshLedger(), earnedMinutes: policy.dailyCapMinutes };
    const nextDay = new Date('2026-08-22T09:00:00').getTime();
    expect(canStartSession(ledger, policy, nextDay).allowed).toBe(true);
  });
});

describe('ventana de tiempo desbloqueado', () => {
  const MIN = 60_000;

  it('sin ventana previa, empieza ahora', () => {
    expect(extendUnlockWindow(null, T0, 15)).toBe(T0 + 15 * MIN);
  });

  it('con una ventana ya caducada, empieza ahora', () => {
    expect(extendUnlockWindow(T0 - 5 * MIN, T0, 15)).toBe(T0 + 15 * MIN);
  });

  it('con una ventana abierta, se encadena en vez de solaparse', () => {
    /**
     * Es la regresión que motivó extraer esta función: si la nueva concesión
     * empezara en `now`, ganar 15 minutos cuando quedan 20 no cambiaría el
     * máximo de las caducidades y el menor perdería lo recién ganado.
     */
    const quedan20 = T0 + 20 * MIN;
    expect(extendUnlockWindow(quedan20, T0, 15)).toBe(T0 + 35 * MIN);
  });

  it('encadenar varias veces acumula el total', () => {
    let end = extendUnlockWindow(null, T0, 10);
    end = extendUnlockWindow(end, T0, 10);
    end = extendUnlockWindow(end, T0, 10);
    expect(end).toBe(T0 + 30 * MIN);
  });

  it('una concesión de cero minutos no mueve la ventana', () => {
    const quedan20 = T0 + 20 * MIN;
    expect(extendUnlockWindow(quedan20, T0, 0)).toBe(quedan20);
    expect(extendUnlockWindow(null, T0, 0)).toBe(T0);
  });

  it('un número negativo de minutos no acorta la ventana', () => {
    // Nada debería llamar así, pero recortar la ventana por un valor negativo
    // sería quitarle al menor tiempo que ya se había ganado.
    const quedan20 = T0 + 20 * MIN;
    expect(extendUnlockWindow(quedan20, T0, -30)).toBe(quedan20);
  });
});
