import { describe, expect, it } from 'vitest';

import { AGE_BANDS, type AgeBand } from '@/domain/age';
import { DIFFICULTIES, type Difficulty, type Exercise } from '@/domain/exercise';
import { ALL_GENERATORS, catalogCoverage, materialize } from '@/engine/catalog';
import { PILLARS } from '@/domain/pillar';
import { Rng } from '@/lib/rng';
import type { ExerciseGenerator } from '@/engine/types';

/**
 * Tests de propiedad sobre el catálogo completo.
 *
 * Un generador procedural produce un espacio de retos demasiado grande para
 * revisarlo a mano; lo que sí se puede es fijar las invariantes que un reto
 * debe cumplir SIEMPRE y ejercitarlas sobre cientos de muestras por generador,
 * rango y dificultad. Estas invariantes son justo las que arruinan un test de
 * opción múltiple: opciones duplicadas, la respuesta correcta ausente, un
 * enunciado vacío o un distractor idéntico al acierto.
 */

const SAMPLES_PER_CELL = 60;

/** Todas las combinaciones (generador, rango, dificultad) que el catálogo declara soportar. */
function cells(): { generator: ExerciseGenerator; band: AgeBand; difficulty: Difficulty }[] {
  const out: { generator: ExerciseGenerator; band: AgeBand; difficulty: Difficulty }[] = [];
  for (const generator of ALL_GENERATORS) {
    for (const band of generator.bands) {
      for (const difficulty of DIFFICULTIES) {
        if (difficulty < generator.difficulty[0] || difficulty > generator.difficulty[1]) continue;
        out.push({ generator, band, difficulty });
      }
    }
  }
  return out;
}

const normalize = (value: string): string => value.trim().toLocaleLowerCase('es');

function assertValid(exercise: Exercise, where: string): void {
  expect(exercise.fingerprint, `${where}: huella vacía`).toBeTruthy();
  expect(exercise.pillar, `${where}: pilar`).toBeTruthy();
  if (exercise.timeLimitSec !== null) {
    expect(exercise.timeLimitSec, `${where}: límite de tiempo`).toBeGreaterThan(5);
  }

  const { prompt } = exercise;
  expect(prompt.stem.trim().length, `${where}: enunciado vacío`).toBeGreaterThan(0);

  switch (prompt.kind) {
    case 'multiple_choice':
    case 'sequence_recall': {
      expect(prompt.options.length, `${where}: pocas opciones`).toBeGreaterThanOrEqual(3);
      expect(prompt.correctIndex, `${where}: correctIndex bajo`).toBeGreaterThanOrEqual(0);
      expect(prompt.correctIndex, `${where}: correctIndex alto`).toBeLessThan(prompt.options.length);

      const unique = new Set(prompt.options.map(normalize));
      expect(unique.size, `${where}: opciones duplicadas → ${prompt.options.join(' | ')}`).toBe(
        prompt.options.length,
      );

      for (const option of prompt.options) {
        expect(option.trim().length, `${where}: opción vacía`).toBeGreaterThan(0);
      }

      if (prompt.kind === 'sequence_recall') {
        expect(prompt.studyMs, `${where}: studyMs`).toBeGreaterThan(500);
        const hasContent = prompt.sequence.length > 0 || prompt.instruction.trim().length > 0;
        expect(hasContent, `${where}: fase de memorización sin contenido`).toBe(true);
      }
      break;
    }
    case 'numeric_entry': {
      expect(Number.isFinite(prompt.answer), `${where}: respuesta no finita`).toBe(true);
      expect(prompt.tolerance, `${where}: tolerancia negativa`).toBeGreaterThanOrEqual(0);
      break;
    }
    case 'open_response': {
      expect(prompt.minChars, `${where}: minChars`).toBeGreaterThan(0);
      expect(prompt.minDistinctWords, `${where}: minDistinctWords`).toBeGreaterThan(0);
      expect(prompt.placeholder.length, `${where}: placeholder vacío`).toBeGreaterThan(0);
      break;
    }
  }
}

describe('catálogo de generadores', () => {
  it('cubre los cinco pilares en los tres rangos de edad', () => {
    const coverage = catalogCoverage();
    for (const pillar of PILLARS) {
      for (const band of AGE_BANDS) {
        expect(coverage[pillar][band], `${pillar} / ${band} sin generadores`).toBeGreaterThan(0);
      }
    }
  });

  it('no tiene ids duplicados', () => {
    const ids = ALL_GENERATORS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declara rangos de dificultad coherentes', () => {
    for (const generator of ALL_GENERATORS) {
      const [min, max] = generator.difficulty;
      expect(min, `${generator.id}`).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThanOrEqual(1);
      expect(max).toBeLessThanOrEqual(5);
      expect(generator.bands.length, `${generator.id} sin rangos`).toBeGreaterThan(0);
    }
  });
});

describe('invariantes de los retos generados', () => {
  for (const { generator, band, difficulty } of cells()) {
    it(`${generator.id} · ${band} · d${difficulty}`, () => {
      for (let sample = 0; sample < SAMPLES_PER_CELL; sample += 1) {
        const rng = new Rng(`${generator.id}|${band}|${difficulty}|${sample}`);
        const exercise = materialize(generator, band, difficulty, rng, sample);
        assertValid(exercise, `${generator.id}/${band}/d${difficulty}/#${sample}`);
      }
    });
  }
});

/** Huellas distintas que produce un generador en `samples` muestras. */
function variety(generator: ExerciseGenerator, band: AgeBand, difficulty: Difficulty, samples: number): number {
  const fingerprints = new Set<string>();
  for (let sample = 0; sample < samples; sample += 1) {
    const rng = new Rng(`variedad|${generator.id}|${band}|${difficulty}|${sample}`);
    fingerprints.add(materialize(generator, band, difficulty, rng, sample).fingerprint);
  }
  return fingerprints.size;
}

describe('variedad', () => {
  /**
   * No todos los generadores tienen el mismo espacio de retos: los
   * procedurales son prácticamente infinitos, mientras que los que se apoyan
   * en un corpus curado (comprensión lectora, analogías, ortografía) están
   * acotados por su contenido. Exigirles a todos el mismo número sería
   * arbitrario, así que se verifican dos propiedades distintas y ambas
   * significativas:
   *
   *  1. El espacio del generador no es degenerado: al menos 8 retos distintos
   *     por celda. Menos que eso se memoriza en una semana.
   *  2. El muestreo no está sesgado: en 100 tiradas debe aflorar casi todo su
   *     espacio (o 20 retos distintos, lo que sea menor). Esto detecta un
   *     generador que "puede" variar pero en la práctica devuelve siempre lo
   *     mismo por un mal uso del RNG.
   */
  const MIN_SPACE = 8;
  const TARGET_OBSERVED = 20;

  it('cada generador tiene contenido suficiente y lo muestrea sin sesgo', () => {
    const problems: string[] = [];

    for (const { generator, band, difficulty } of cells()) {
      // Una sola pasada larga estima el espacio; el prefijo de 100 muestras del
      // mismo recorrido determinista sirve para medir el sesgo, sin repetir
      // el trabajo.
      const space = variety(generator, band, difficulty, 1200);
      const observed = variety(generator, band, difficulty, 100);
      const where = `${generator.id} · ${band} · d${difficulty}`;

      if (space < MIN_SPACE) {
        problems.push(`${where} → solo ${space} retos posibles (mínimo ${MIN_SPACE})`);
        continue;
      }

      const expected = Math.min(TARGET_OBSERVED, Math.ceil(space * 0.8));
      if (observed < expected) {
        problems.push(
          `${where} → ${observed} distintos en 100 tiradas (espacio ≈ ${space}, se esperaban ≥ ${expected})`,
        );
      }
    }

    expect(problems, `Problemas de variedad:\n${problems.join('\n')}`).toEqual([]);
  });
});

describe('determinismo', () => {
  it('la misma semilla produce el mismo reto', () => {
    for (const generator of ALL_GENERATORS) {
      const band = generator.bands[0] as AgeBand;
      const difficulty = generator.difficulty[0];
      const first = materialize(generator, band, difficulty, new Rng('semilla-fija'), 0);
      const second = materialize(generator, band, difficulty, new Rng('semilla-fija'), 0);
      expect(second, generator.id).toEqual(first);
    }
  });
});
