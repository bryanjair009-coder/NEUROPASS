// @ts-check
/**
 * Normaliza el banco curado de origen (JSONC en español, esquema plano) al
 * esquema interno del motor.
 *
 * Se ejecuta una sola vez por revisión del banco y su salida
 * (assets/data/exercise-bank.json) se versiona: así el arranque de la app no
 * paga el costo de parsear ni validar, y cualquier cambio en el contenido es
 * visible en el diff.
 *
 *   node scripts/build-bank.mjs ../gemini-code-1787085842088.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../assets/data/exercise-bank.json');

const PILLAR_MAP = {
  Matematicas: 'matematicas',
  Creatividad: 'creatividad',
  Memoria: 'memoria',
  Logica: 'logica',
  Lenguaje: 'lenguaje',
};

/** Elimina comentarios de línea fuera de cadenas para poder parsear el JSONC de origen. */
function stripJsonComments(source) {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }

    if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }

    out += char;
  }

  return out;
}

/** Separa por comas de nivel superior: no rompe "(2,3)" ni "París (Francia)". */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const char of text) {
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);

    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);

  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Extrae los elementos memorizables de una instrucción en prosa.
 * Devuelve `[]` cuando la instrucción es una frase que debe leerse completa
 * (p. ej. un texto histórico breve): en ese caso la UI la muestra tal cual.
 */
function parseSequence(instruction) {
  const colon = instruction.indexOf(':');
  if (colon === -1) return [];

  const body = instruction
    .slice(colon + 1)
    .trim()
    .replace(/\.$/, '');

  const commaParts = splitTopLevel(body);
  if (commaParts.length > 1) return commaParts;

  // Códigos del tipo "4-8-2-9".
  if (/^[\w\d]+(-[\w\d]+)+$/.test(body)) return body.split('-');

  // Una sola frase larga: no son elementos discretos.
  return body.split(/\s+/).length > 6 ? [] : [body];
}

/**
 * Calibración inicial de dificultad.
 *
 * El banco de origen no trae dificultad. Se ancla en el rango de edad (los
 * retos de un rango superior son intrínsecamente más duros) y se desplaza
 * según la posición del ítem dentro de su grupo, porque el banco está escrito
 * en orden ascendente dentro de cada rango. Es una semilla, no una medición:
 * el modelo de maestría por pilar corrige la selección con el desempeño real.
 */
function calibrateDifficulty(band, indexInGroup, groupSize) {
  const anchor = { '6-8': 2, '9-12': 3, '13-16': 4 }[band];
  const third = Math.max(1, Math.ceil(groupSize / 3));
  const shift = indexInGroup < third ? -1 : indexInGroup < third * 2 ? 0 : 1;
  return Math.min(5, Math.max(1, anchor + shift));
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Uso: node scripts/build-bank.mjs <ruta-al-banco-origen.json>');
  process.exit(1);
}

const raw = readFileSync(resolve(process.cwd(), sourcePath), 'utf8');
/** @type {any[]} */
const source = JSON.parse(stripJsonComments(raw));

// Agrupa por pilar+rango para poder calibrar por posición relativa.
const groups = new Map();
for (const item of source) {
  const key = `${item.pilar}|${item.edad}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}

const problems = [];
const items = [];

for (const [key, group] of groups) {
  group.forEach((item, index) => {
    const pillar = PILLAR_MAP[item.pilar];
    if (!pillar) {
      problems.push(`${item.id}: pilar desconocido "${item.pilar}"`);
      return;
    }

    const options = item.opciones ?? [];
    const correctIndex = options.indexOf(item.respuesta_correcta);

    if (correctIndex === -1) {
      problems.push(`${item.id}: la respuesta correcta no está entre las opciones`);
      return;
    }
    if (new Set(options.map((o) => String(o).trim().toLowerCase())).size !== options.length) {
      problems.push(`${item.id}: opciones duplicadas`);
      return;
    }
    if (options.length < 3) {
      problems.push(`${item.id}: solo ${options.length} opciones`);
      return;
    }

    const difficulty = calibrateDifficulty(item.edad, index, group.length);
    const base = {
      id: item.id,
      pillar,
      band: item.edad,
      difficulty,
      stem: item.pregunta,
      options,
      correctIndex,
    };

    if (item.tipo === 'memoria_secuencia') {
      const sequence = parseSequence(item.instruccion ?? '');
      items.push({
        ...base,
        kind: 'sequence_recall',
        instruction: item.instruccion ?? '',
        sequence,
        // ~1.2 s por elemento, con un piso de 3 s para leer la consigna.
        studyMs: Math.max(3000, sequence.length * 1200),
      });
    } else {
      items.push({ ...base, kind: 'multiple_choice' });
    }
  });
  void key;
}

if (problems.length > 0) {
  console.error(`\n${problems.length} ítem(s) descartados por inconsistencias:`);
  for (const problem of problems) console.error(`  - ${problem}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(items, null, 2)}\n`, 'utf8');

const byPillar = items.reduce((acc, i) => ({ ...acc, [i.pillar]: (acc[i.pillar] ?? 0) + 1 }), {});
console.log(`\n${items.length}/${source.length} ítems normalizados → assets/data/exercise-bank.json`);
console.log(byPillar);
