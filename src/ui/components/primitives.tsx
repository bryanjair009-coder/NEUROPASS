import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { lighten, withAlpha } from '@/lib/color';
import { FondoFlotante } from '@/ui/components/FondoFlotante';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import {
  ALTO_BOTON_PRINCIPAL,
  MIN_TOUCH_TARGET,
  marca,
  radius,
  shadow,
  space,
  typography,
  type Palette,
} from '@/ui/theme';

/**
 * Primitivas de interfaz.
 *
 * Se mantienen deliberadamente pocas y sin configuración: `Button` acepta
 * cuatro variantes y nada más. La alternativa —componentes con veinte props de
 * estilo— produce pantallas que divergen poco a poco hasta que la app parece
 * escrita por cinco personas distintas.
 */

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

type TypographyVariant = keyof typeof typography;

interface TxtProps {
  children: ReactNode;
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function Txt({
  children,
  variant = 'body',
  color,
  align = 'left',
  style,
  numberOfLines,
}: TxtProps) {
  // El color por omisión sale del tema vigente y no puede fijarse en la firma:
  // un valor por defecto se evalúa al importar el módulo, cuando todavía no se
  // sabe qué tema está activo.
  const palette = usePalette();
  const resolved = color ?? palette.text;

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[typography[variant] as TextStyle, { color: resolved, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Contenedores
// ---------------------------------------------------------------------------

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Contenido fijo al pie, fuera del área desplazable. */
  footer?: ReactNode;
  padded?: boolean;
  /**
   * Formas pastel flotando detrás. Solo en la zona del menor: el panel del
   * tutor es para leer datos en diez segundos y va sin animación.
   */
  formas?: boolean;
}

export function Screen({ children, scroll = true, footer, padded = true, formas = false }: ScreenProps) {
  const styles = useStyles();
  const body = padded ? { padding: space.xl } : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {formas ? <FondoFlotante /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[body, styles.scrollContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[body, styles.flex]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
  accent?: string;
}

export function Card({ children, style, raised = false, accent }: CardProps) {
  const styles = useStyles();

  return (
    <View
      style={[
        styles.card,
        raised ? styles.cardRaised : shadow('sm'),
        // La barra de acento identifica el pilar sin ocupar una línea de texto.
        accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Separación vertical explícita; evita márgenes sueltos repartidos por el árbol. */
export function Gap({ size = 'lg' }: { size?: keyof typeof space }) {
  return <View style={{ height: space[size] }} />;
}

export function Row({
  children,
  gap = 'md',
  align = 'center',
  justify = 'flex-start',
  wrap = false,
  style,
}: {
  children: ReactNode;
  gap?: keyof typeof space;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          justifyContent: justify,
          gap: space[gap],
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

/** Alto del canto inferior; al pulsar, la cara baja todo menos un píxel. */
const CANTO = 5;

/**
 * Botón con canto.
 *
 * El canto no es un borde que se encoge al pulsar sino una capa de fondo que
 * la cara deja al descubierto: si fuera un `borderBottomWidth` variable, cada
 * pulsación cambiaría el alto del botón y empujaría el resto de la pantalla un
 * par de píxeles, justo cuando el dedo espera que nada se mueva.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  icon,
  style,
}: ButtonProps) {
  const palette = usePalette();
  const styles = useStyles();
  const inert = disabled || loading;
  const colors = buttonColors(palette)[variant];
  const conCanto = colors.canto !== null;
  // A ancho completo es la acción principal de la pantalla y gana alto y
  // tipografía; los compactos conviven en filas y se quedan en el mínimo táctil.
  const alto = fullWidth ? ALTO_BOTON_PRINCIPAL : MIN_TOUCH_TARGET + (conCanto ? CANTO : 0);

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          paddingBottom: conCanto ? CANTO : 0,
          backgroundColor: colors.canto ?? 'transparent',
        },
        fullWidth && styles.fullWidth,
        variant === 'primary' && !inert && shadow('md', palette.accent),
        inert && styles.disabled,
        style,
      ]}
    >
      {({ pressed }) => {
        const hundido = pressed && !inert;
        return (
          // La cara va en el flujo normal y no en posición absoluta: así el
          // botón compacto mide lo que su texto, en vez de colapsar a ancho cero.
          <View
            style={[
              styles.buttonFace,
              {
                minHeight: alto - (conCanto ? CANTO : 0),
                backgroundColor: colors.background,
                transform: [{ translateY: hundido && conCanto ? CANTO - 1 : 0 }],
              },
              // Sin canto no hay nada que hundir: la respuesta es por opacidad.
              hundido && !conCanto && styles.pressed,
            ]}
          >
            {colors.gradient ? (
              <LinearGradient
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text
                numberOfLines={2}
                style={[
                  (fullWidth ? typography.action : typography.bodyStrong) as TextStyle,
                  styles.buttonText,
                  { color: colors.text },
                ]}
              >
                {icon ? `${icon}  ` : ''}
                {label}
              </Text>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

interface ButtonColors {
  background: string;
  /** Degradado vertical de la cara, si lo tiene. */
  gradient: readonly [string, string] | null;
  /** Color del canto, o `null` para un botón plano. */
  canto: string | null;
  text: string;
}

function buttonColors(palette: Palette): Record<ButtonVariant, ButtonColors> {
  return {
    primary: {
      background: palette.accent,
      gradient: [lighten(palette.accent, 0.2), palette.accent],
      canto: marca.moradoOsc,
      text: palette.white,
    },
    secondary: {
      background: palette.surface,
      gradient: null,
      // El canto de las secundarias es el borde de la paleta sobre el lienzo:
      // da el mismo relieve sin competir en color con la principal.
      canto: palette.arcadePista,
      text: palette.text,
    },
    ghost: { background: 'transparent', gradient: null, canto: null, text: palette.textMuted },
    danger: { background: palette.dangerSoft, gradient: null, canto: null, text: palette.danger },
  };
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/** Barra de progreso. `value` se recorta a 0..1. */
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const palette = usePalette();
  const styles = useStyles();
  const clamped = Math.min(1, Math.max(0, value));
  const resolved = color ?? palette.accent;

  return (
    <View style={styles.progressTrack}>
      <LinearGradient
        colors={[lighten(resolved, 0.3), resolved]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.progressFill, { width: `${clamped * 100}%` }]}
      />
    </View>
  );
}

export function Badge({ label, color }: { label: string; color?: string }) {
  const palette = usePalette();
  const styles = useStyles();
  const resolved = color ?? palette.accent;

  return (
    // Pastel del mismo color en vez de contorno: el contorno fino de antes se
    // perdía sobre las tarjetas y no se distinguía de un campo de texto.
    <View style={[styles.badge, { backgroundColor: withAlpha(resolved, 0.16) }]}>
      <Text style={[typography.caption as TextStyle, { color: resolved }]}>{label}</Text>
    </View>
  );
}

/** Estado vacío con una acción opcional; evita pantallas en blanco sin explicación. */
export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}) {
  const palette = usePalette();
  const styles = useStyles();

  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Txt variant="heading" align="center">
        {title}
      </Txt>
      <Gap size="sm" />
      <Txt variant="body" color={palette.textMuted} align="center">
        {description}
      </Txt>
      {action ? (
        <>
          <Gap />
          <Button label={action.label} onPress={action.onPress} fullWidth={false} />
        </>
      ) : null}
    </View>
  );
}

/** Aviso persistente. `tone` decide el color; nunca se usa rojo para información. */
export function Notice({
  tone,
  title,
  children,
}: {
  tone: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  children?: ReactNode;
}) {
  const palette = usePalette();
  const styles = useStyles();

  // El fondo pastel lleva el tono y el título lo repite en saturado. Con solo
  // un borde de color, un aviso de peligro y una tarjeta cualquiera se
  // distinguían por dos píxeles.
  const { fondo, tinta } = {
    info: { fondo: palette.accentSoft, tinta: palette.accent },
    warning: { fondo: palette.pastelMango, tinta: palette.warning },
    danger: { fondo: palette.dangerSoft, tinta: palette.danger },
    success: { fondo: palette.successSoft, tinta: palette.success },
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: fondo }]}>
      <Txt variant="bodyStrong" color={tinta}>
        {title}
      </Txt>
      {children ? (
        <>
          <Gap size="xs" />
          {typeof children === 'string' ? (
            <Txt variant="caption" color={palette.textMuted}>
              {children}
            </Txt>
          ) : (
            children
          )}
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.base },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.base,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: space.lg,
  },
  cardRaised: { borderRadius: radius.xl, padding: space.xl - 6, ...shadow('md') },
  button: { borderRadius: radius.pill },
  // Sin `flexGrow`: la cara mide lo que fija `minHeight`. Con él, dentro de una
  // fila que se parte en varias líneas, Android estiraba la cara hacia abajo y
  // la siguiente fila se montaba encima de la tarjeta.
  buttonFace: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    overflow: 'hidden',
  },
  buttonText: { textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.arcadePista,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  badge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
  },
  emptyEmoji: { fontSize: 48, marginBottom: space.md },
  notice: {
    borderRadius: radius.lg,
    padding: space.lg,
  },
}));
