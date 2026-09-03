import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Exercise, ExerciseResponse, Grade, SequenceToken } from '@/domain/exercise';
import { distinctWords } from '@/engine/grading';
import { Bubble } from '@/ui/components/Bubble';
import { Button, Gap, Row, Txt } from '@/ui/components/primitives';
import { DEFAULT_ACCENT, type SessionAccent } from '@/ui/sessionAccent';
import {
  MIN_TOUCH_TARGET,
  palette,
  promptTypeScale,
  radius,
  space,
  typography,
} from '@/ui/theme';

/**
 * Presentación de un reto.
 *
 * Un solo componente por tipo de enunciado, todos con el mismo contrato:
 * reciben el reto y devuelven una `ExerciseResponse`. La calificación no ocurre
 * aquí —vive en `engine/grading`— para que la vista no pueda decidir por su
 * cuenta qué es correcto: sería el sitio más fácil de romper por accidente y el
 * más difícil de probar.
 */

interface PromptProps {
  readonly exercise: Exercise;
  readonly disabled: boolean;
  /** Calificación ya emitida, en la fase de revisión. */
  readonly grade: Grade | null;
  readonly onRespond: (response: ExerciseResponse) => void;
  /** Pareja de colores de la sesión en curso. */
  readonly accent?: SessionAccent;
}

/**
 * Cada subcomponente se monta con `key={exercise.id}`.
 *
 * Es lo que garantiza que al pasar al siguiente reto la opción marcada, el
 * número escrito o el texto redactado empiecen vacíos. La alternativa —un
 * efecto que limpia el estado cuando cambia el id— provoca un render extra con
 * los datos del reto anterior ya visibles, y React 19 lo señala como cascada de
 * renders. Remontar es más simple y no tiene ese fotograma intermedio.
 */
export function ExercisePrompt(props: PromptProps) {
  switch (props.exercise.prompt.kind) {
    case 'multiple_choice':
    case 'sequence_recall':
      return <ChoicePrompt key={props.exercise.id} {...props} />;
    case 'numeric_entry':
      return <NumericPrompt key={props.exercise.id} {...props} />;
    case 'open_response':
      return <OpenPrompt key={props.exercise.id} {...props} />;
  }
}

// ---------------------------------------------------------------------------
// Enunciado
// ---------------------------------------------------------------------------

/**
 * Enunciado dentro de la burbuja de color de la sesión.
 *
 * El texto va en blanco sobre el relleno saturado, así que el contraste no
 * depende del color que le toque a la sesión: las parejas de `sessionAccent`
 * están elegidas para que el blanco funcione sobre cualquiera de ellas.
 */
export function Stem({
  exercise,
  accent = DEFAULT_ACCENT,
}: {
  exercise: Exercise;
  accent?: SessionAccent;
}) {
  const scale = promptTypeScale[exercise.band];
  return (
    <Bubble color={accent.bubble}>
      <Text style={[styles.stem, scale]} accessibilityRole="header">
        {exercise.prompt.stem}
      </Text>
    </Bubble>
  );
}

// ---------------------------------------------------------------------------
// Opción múltiple
// ---------------------------------------------------------------------------

function ChoicePrompt({ exercise, disabled, grade, onRespond, accent = DEFAULT_ACCENT }: PromptProps) {
  const [chosen, setChosen] = useState<number | null>(null);

  const prompt = exercise.prompt;
  if (prompt.kind !== 'multiple_choice' && prompt.kind !== 'sequence_recall') return null;

  return (
    <View>
      {prompt.options.map((option, index) => {
        const isChosen = chosen === index;
        const isAnswer = index === prompt.correctIndex;
        const revealed = grade !== null;

        return (
          <Pressable
            key={`${exercise.id}-${index}`}
            disabled={disabled}
            accessibilityRole="button"
            // El nombre se declara explícitamente y no se deja derivar del
            // texto hijo: muchas opciones son símbolos («▲», «♦») que algunas
            // capas de accesibilidad no anuncian, y quedarían como botones sin
            // nombre. Con la respuesta revelada se añade si era la correcta.
            accessibilityLabel={
              revealed && isAnswer ? `${option}. Respuesta correcta` : option
            }
            accessibilityState={{ selected: isChosen, disabled }}
            onPress={() => {
              setChosen(index);
              onRespond({ kind: 'choice', index });
            }}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: accent.action, borderColor: accent.action },
              pressed && !disabled && styles.optionPressed,
              isChosen && !revealed && styles.optionChosen,
              // En la revisión se marca siempre la correcta, se haya acertado o
              // no: aprender cuál era es más útil que saber que fue un error.
              revealed && isAnswer && styles.optionCorrect,
              revealed && isChosen && !isAnswer && styles.optionWrong,
              revealed && !isAnswer && !isChosen && styles.optionFaded,
            ]}
          >
            <Text style={styles.optionText}>{option}</Text>
            {revealed && isAnswer ? <Text style={styles.optionMark}>✓</Text> : null}
            {revealed && isChosen && !isAnswer ? <Text style={styles.optionMark}>✕</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fase de memorización
// ---------------------------------------------------------------------------

/**
 * Se muestra antes de la pregunta en los retos de memoria. Es una pantalla
 * aparte y no una sección más: si la secuencia y la pregunta convivieran, el
 * reto dejaría de medir memoria y pasaría a medir lectura.
 */
export function StudyPhase({
  instruction,
  sequence,
  onSkip,
}: {
  instruction: string;
  sequence: readonly SequenceToken[];
  onSkip: () => void;
}) {
  return (
    <View style={styles.studyContainer}>
      <Txt variant="heading" align="center" color={palette.textMuted}>
        {instruction || 'Memoriza esto'}
      </Txt>
      <Gap size="xl" />

      <Row gap="md" wrap justify="center">
        {sequence.map((token, index) => (
          <View
            key={`${token.label}-${index}`}
            style={[styles.token, token.color ? { backgroundColor: token.color } : null]}
          >
            <Text style={[styles.tokenText, token.color ? { color: palette.white } : null]}>
              {token.label}
            </Text>
          </View>
        ))}
      </Row>

      <Gap size="xxl" />
      <Txt variant="caption" color={palette.textFaint} align="center">
        La pregunta aparece en unos segundos
      </Txt>
      <Gap size="lg" />
      <Button label="Ya lo memoricé" variant="ghost" onPress={onSkip} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Entrada numérica
// ---------------------------------------------------------------------------

function NumericPrompt({ exercise, disabled, grade, onRespond }: PromptProps) {
  const [value, setValue] = useState('');

  const prompt = exercise.prompt;
  if (prompt.kind !== 'numeric_entry') return null;

  // Se admite el signo negativo y una coma decimal: en México la coma es el
  // separador habitual y rechazarla sería castigar la costumbre, no el saber.
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  const isValid = normalized.length > 0 && Number.isFinite(parsed);

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!disabled}
        keyboardType="numbers-and-punctuation"
        inputMode="numeric"
        placeholder="Escribe tu respuesta"
        placeholderTextColor={palette.textFaint}
        style={[
          styles.numericInput,
          grade?.outcome === 'correct' && { borderColor: palette.success },
          grade?.outcome === 'incorrect' && { borderColor: palette.danger },
        ]}
        onSubmitEditing={() => isValid && !disabled && onRespond({ kind: 'numeric', value: parsed })}
        returnKeyType="done"
        accessibilityLabel="Respuesta numérica"
      />
      <Gap />
      <Button
        label="Comprobar"
        disabled={!isValid || disabled}
        onPress={() => onRespond({ kind: 'numeric', value: parsed })}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Respuesta abierta
// ---------------------------------------------------------------------------

function OpenPrompt({ exercise, disabled, onRespond }: PromptProps) {
  const [text, setText] = useState('');

  const prompt = exercise.prompt;
  if (prompt.kind !== 'open_response') return null;

  const trimmed = text.trim();
  const words = distinctWords(trimmed);
  const meetsThreshold = trimmed.length >= prompt.minChars && words >= prompt.minDistinctWords;

  // El umbral se comprueba aquí *y* en `grading`. Aquí sirve para no dejar
  // enviar algo que se rechazaría; allí, porque la calificación no puede
  // depender de que la vista se haya comportado bien.
  return (
    <View>
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!disabled}
        multiline
        textAlignVertical="top"
        placeholder={prompt.placeholder}
        placeholderTextColor={palette.textFaint}
        style={styles.openInput}
        accessibilityLabel="Tu respuesta"
      />
      <Gap size="sm" />

      <Row justify="space-between">
        <Txt variant="caption" color={meetsThreshold ? palette.success : palette.textFaint}>
          {trimmed.length}/{prompt.minChars} caracteres · {words}/{prompt.minDistinctWords} palabras
        </Txt>
        {meetsThreshold ? (
          <Txt variant="caption" color={palette.success}>
            ¡Listo para enviar!
          </Txt>
        ) : null}
      </Row>

      <Gap />
      <Button
        label="Enviar mi idea"
        disabled={!meetsThreshold || disabled}
        onPress={() => onRespond({ kind: 'text', value: trimmed })}
      />
      <Gap size="sm" />
      <Txt variant="caption" color={palette.textFaint} align="center">
        Aquí no hay respuestas incorrectas. Solo cuenta que lo desarrolles.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  stem: {
    color: palette.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  option: {
    minHeight: MIN_TOUCH_TARGET + 8,
    // Píldora, como en la guía visual: el radio grande separa la respuesta del
    // enunciado sin necesidad de una línea divisoria.
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    marginBottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  optionChosen: { borderColor: palette.text },
  optionCorrect: { backgroundColor: palette.success, borderColor: palette.success },
  optionWrong: { backgroundColor: palette.danger, borderColor: palette.danger },
  /** Las descartadas se apagan para que la correcta destaque sin taparlas. */
  optionFaded: { opacity: 0.35 },
  optionText: {
    ...(typography.bodyStrong as object),
    color: palette.white,
    flexShrink: 1,
  },
  optionMark: { fontSize: 20, color: palette.white, marginLeft: space.md },

  studyContainer: { alignItems: 'center', paddingVertical: space.xl },
  token: {
    minWidth: 72,
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  tokenText: { fontSize: 22, fontWeight: '700', color: palette.text },

  numericInput: {
    ...(typography.title as object),
    color: palette.text,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    textAlign: 'center',
  },
  openInput: {
    ...(typography.body as object),
    color: palette.text,
    minHeight: 160,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    padding: space.lg,
  },
});
