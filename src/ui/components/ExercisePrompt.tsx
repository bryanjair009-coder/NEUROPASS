import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Exercise, ExerciseResponse, Grade, SequenceToken } from '@/domain/exercise';
import { PILLAR_EMOJI, PILLAR_LABEL } from '@/domain/pillar';
import { distinctWords } from '@/engine/grading';
import { lighten, withAlpha } from '@/lib/color';
import { Figura } from '@/ui/components/Figura';
import { Ilustracion } from '@/ui/components/Ilustracion';
import { Button, Gap, Row, Txt } from '@/ui/components/primitives';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette, useTheme } from '@/ui/ThemeProvider';
import {
  opcionesPorPilar,
  pillarColor,
  pillarColorInk,
  promptTypeScale,
  radius,
  shadow,
  space,
  tonoMarca,
  typography,
  veredicto,
  type Palette,
  type TonoMarca,
} from '@/ui/theme';
import { useMovimientoReducido } from '@/ui/useMovimientoReducido';

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
 * Panel del enunciado.
 *
 * Sustituye a la burbuja de color. La burbuja obligaba a elegir entre un
 * círculo que no admitía textos largos y una forma que dejaba de parecer
 * burbuja; un panel neutro con el filo del color del pilar admite cualquier
 * longitud, y deja el color para lo que el menor tiene que distinguir: las
 * opciones.
 *
 * El filo late despacio. Es lo único que se mueve dentro del panel, y lo hace
 * en un ciclo largo para no competir con la lectura.
 */
export function PanelEnunciado({ exercise }: { exercise: Exercise }) {
  const { isDark } = useTheme();
  const styles = useStyles();
  const movimientoReducido = useMovimientoReducido();
  const [brillo] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (movimientoReducido) {
      brillo.setValue(1);
      return undefined;
    }
    const media = { duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(brillo, { toValue: 0.45, ...media }),
        Animated.timing(brillo, { toValue: 1, ...media }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [brillo, movimientoReducido]);

  const color = pillarColor[exercise.pillar];
  // De día el tono saturado del pilar no alcanza contraste como texto pequeño;
  // de noche es la variante oscura la que se pierde sobre el navy.
  const tinta = isDark ? color : pillarColorInk[exercise.pillar];
  const etiqueta = PILLAR_LABEL[exercise.pillar];

  return (
    <View style={styles.panel}>
      <Animated.View style={[styles.filo, { opacity: brillo }]}>
        <LinearGradient
          colors={[withAlpha(color, 0), color, withAlpha(color, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Text
        style={[styles.microPilar, { color: tinta }]}
        accessibilityLabel={`${etiqueta}, dificultad ${exercise.difficulty} de 5`}
      >
        {PILLAR_EMOJI[exercise.pillar]} {etiqueta.toUpperCase()} · {'★'.repeat(exercise.difficulty)}
      </Text>
      <Text style={[styles.enunciado, promptTypeScale[exercise.band]]} accessibilityRole="header">
        {exercise.prompt.stem}
      </Text>
      {exercise.prompt.ilustracion ? (
        <View style={styles.ilustracion}>
          <Ilustracion ilustracion={exercise.prompt.ilustracion} />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Opción múltiple
// ---------------------------------------------------------------------------

/**
 * A partir de este largo una opción ya no cabe a media anchura sin partirse en
 * cuatro líneas, y la rejilla pasa a una columna. Pasa con las opciones de
 * comprensión lectora, que son frases y no palabras sueltas.
 */
const LARGO_MEDIA_COLUMNA = 24;

type Veredicto = keyof typeof veredicto;

/**
 * Respuestas en cuadrícula de dos columnas.
 *
 * La cuadrícula deja las cuatro opciones por encima del pliegue con
 * enunciados de cualquier longitud; la lista vertical obligaba a desplazarse
 * justo cuando el menor ya había decidido su respuesta.
 */
function ChoicePrompt({ exercise, disabled, grade, onRespond }: PromptProps) {
  const palette = usePalette();
  const styles = useStyles();
  const [chosen, setChosen] = useState<number | null>(null);

  const prompt = exercise.prompt;
  if (prompt.kind !== 'multiple_choice' && prompt.kind !== 'sequence_recall') return null;

  const revealed = grade !== null;
  const tonos = opcionesPorPilar[exercise.pillar];
  // Con figuras las etiquetas son cortas («rombo hueco») y la rejilla 2×2 es
  // lo que permite comparar los dibujos de un vistazo.
  const unaColumna =
    !prompt.figurasOpciones && prompt.options.some((option) => option.length > LARGO_MEDIA_COLUMNA);

  return (
    <View style={styles.rejilla}>
      {prompt.options.map((option, index) => {
        const isChosen = chosen === index;
        const isAnswer = index === prompt.correctIndex;
        const estado: Veredicto | null = !revealed
          ? null
          : isAnswer
            ? 'acierto'
            : isChosen
              ? 'fallo'
              : 'descartada';
        const tono = tonos[index % tonos.length] as TonoMarca;
        const figura = prompt.figurasOpciones?.[index];
        // Una opción con figura va sobre fondo neutro: una estrella roja sobre
        // una píldora rosa se confunde, y el color de la figura es parte de lo
        // que hay que reconocer.
        const relleno = estado
          ? veredicto[estado]
          : figura
            ? { arriba: palette.surface, abajo: palette.surfaceRaised, canto: palette.arcadePista }
            : {
                arriba: lighten(tonoMarca[tono].base, 0.3),
                abajo: tonoMarca[tono].base,
                canto: tonoMarca[tono].canto,
              };
        const tinta = estado ? tintaPildora(palette, estado) : figura ? palette.text : tintaPildora(palette, tono);

        return (
          <Pressable
            key={`${exercise.id}-${index}`}
            disabled={disabled}
            accessibilityRole="button"
            // El nombre se declara explícitamente y no se deja derivar del
            // texto hijo: muchas opciones son símbolos («▲», «♦») que algunas
            // capas de accesibilidad no anuncian, y quedarían como botones sin
            // nombre. Con la respuesta revelada se añade si era la correcta.
            accessibilityLabel={revealed && isAnswer ? `${option}. Respuesta correcta` : option}
            accessibilityState={{ selected: isChosen, disabled }}
            onPress={() => {
              setChosen(index);
              onRespond({ kind: 'choice', index });
            }}
            style={[
              styles.opcion,
              unaColumna ? styles.opcionAncha : styles.opcionMedia,
              { backgroundColor: relleno.canto },
              // En la revisión se apagan las descartadas para que la correcta
              // destaque sin llegar a taparlas: saber cuál era es más útil que
              // saber que hubo un error.
              estado === 'descartada' && styles.opcionDescartada,
            ]}
          >
            {({ pressed }) => (
              <View style={[styles.opcionCara, pressed && !disabled && styles.opcionHundida]}>
                <LinearGradient
                  colors={[relleno.arriba, relleno.abajo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {figura ? (
                  <>
                    <Figura figura={figura} tamano={52} />
                    <Text style={[styles.opcionEtiqueta, { color: tinta }]} numberOfLines={1}>
                      {option}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.opcionTexto, { color: tinta }]} numberOfLines={4}>
                    {option}
                  </Text>
                )}
                {/* La marca va en posición absoluta para que el texto quede
                    centrado igual antes y después de revelarse. */}
                {estado === 'acierto' ? <Text style={[styles.opcionMarca, { color: tinta }]}>✓</Text> : null}
                {estado === 'fallo' ? <Text style={[styles.opcionMarca, { color: tinta }]}>✕</Text> : null}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Texto sobre una píldora. De día va en blanco; de noche en un tono muy oscuro
 * del mismo color, porque blanco sobre neón en una habitación a oscuras
 * deslumbra. El morado y el gris ya son lo bastante oscuros para el blanco.
 */
function tintaPildora(palette: Palette, relleno: TonoMarca | Veredicto): string {
  switch (relleno) {
    case 'aqua':
      return palette.tintaPildoraAqua;
    case 'rosa':
    case 'fallo':
      return palette.tintaPildoraRosa;
    case 'lima':
    case 'acierto':
      return palette.tintaPildoraLima;
    case 'mango':
      return palette.tintaPildoraMango;
    case 'morado':
    case 'descartada':
      return palette.white;
  }
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
  const palette = usePalette();
  const styles = useStyles();
  return (
    <View style={styles.studyContainer}>
      <Txt variant="heading" align="center">
        {instruction || 'Memoriza esto'}
      </Txt>
      <Gap size="xl" />

      <Row gap="md" wrap justify="center">
        {sequence.map((token, index) =>
          token.figura ? (
            <View key={`${token.label}-${index}`} style={styles.tokenFigura}>
              <Figura figura={token.figura} tamano={60} />
              <Text style={styles.tokenEtiqueta}>{token.label}</Text>
            </View>
          ) : (
            <View
              key={`${token.label}-${index}`}
              style={[styles.token, token.color ? { backgroundColor: token.color } : null]}
            >
              <Text style={[styles.tokenText, token.color ? { color: palette.white } : null]}>
                {token.label}
              </Text>
            </View>
          ),
        )}
      </Row>

      <Gap size="xxl" />
      <Txt variant="caption" color={palette.textMuted} align="center">
        La pregunta aparece en unos segundos
      </Txt>
      <Gap size="lg" />
      <Button label="Ya lo memoricé" variant="secondary" onPress={onSkip} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Entrada numérica
// ---------------------------------------------------------------------------

function NumericPrompt({ exercise, disabled, grade, onRespond }: PromptProps) {
  const palette = usePalette();
  const styles = useStyles();
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
        placeholder="Tu respuesta"
        placeholderTextColor={palette.textFaint}
        style={[
          styles.numericInput,
          grade?.outcome === 'correct' && { borderColor: palette.success },
          grade?.outcome === 'incorrect' && { borderColor: palette.warning },
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
  const palette = usePalette();
  const styles = useStyles();
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
        <Txt variant="caption" color={meetsThreshold ? palette.success : palette.textMuted}>
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
      <Txt variant="caption" color={palette.textMuted} align="center">
        Aquí no hay respuestas incorrectas. Solo cuenta que lo desarrolles.
      </Txt>
    </View>
  );
}

/** Canto de las opciones: el mismo relieve que los botones principales. */
const CANTO_OPCION = 5;

const useStyles = makeStyles((palette) => ({
  panel: {
    backgroundColor: palette.arcadePanel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.xl,
    paddingHorizontal: space.lg + 2,
    paddingVertical: space.lg + 4,
    alignItems: 'center',
    ...shadow('md'),
  },
  filo: { position: 'absolute', top: 0, left: space.xl, right: space.xl, height: 3 },
  microPilar: { ...(typography.micro as object), textAlign: 'center' },
  enunciado: {
    marginTop: space.sm + 2,
    fontFamily: 'Baloo2_700Bold',
    color: palette.text,
    textAlign: 'center',
  },

  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  opcion: {
    borderRadius: 26,
    paddingBottom: CANTO_OPCION,
    ...shadow('sm'),
  },
  // `flexBasis` y no un ancho fijo: con un número impar de opciones, la última
  // ocupa la fila entera en vez de dejar un hueco a su derecha.
  opcionMedia: { flexBasis: '40%', flexGrow: 1 },
  opcionAncha: { flexBasis: '100%' },
  opcionCara: {
    minHeight: 88 - CANTO_OPCION,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
    overflow: 'hidden',
  },
  /** Al pulsar, la cara baja sobre su canto; el hueco de la rejilla no cambia. */
  opcionHundida: { transform: [{ translateY: CANTO_OPCION - 1 }] },
  opcionDescartada: { opacity: 0.5 },
  opcionTexto: {
    fontFamily: 'Baloo2_700Bold',
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'center',
  },
  opcionMarca: {
    position: 'absolute',
    top: space.sm,
    right: space.md,
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: 18,
  },

  ilustracion: { alignSelf: 'stretch', marginTop: space.md },
  opcionEtiqueta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
    textAlign: 'center',
  },

  studyContainer: { alignItems: 'center', paddingVertical: space.xl },
  tokenFigura: {
    alignItems: 'center',
    gap: space.xs,
    minWidth: 84,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  tokenEtiqueta: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 18, color: palette.text },
  token: {
    minWidth: 76,
    minHeight: 76,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    ...shadow('sm'),
  },
  tokenText: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 28, lineHeight: 34, color: palette.text },

  numericInput: {
    ...(typography.title as object),
    color: palette.text,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.xl,
    backgroundColor: palette.arcadePanel,
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
    borderRadius: radius.lg,
    backgroundColor: palette.arcadePanel,
    padding: space.lg,
  },
}));
