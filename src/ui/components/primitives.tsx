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

import { MIN_TOUCH_TARGET, palette, radius, shadow, space, typography } from '@/ui/theme';

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
  color = palette.text,
  align = 'left',
  style,
  numberOfLines,
}: TxtProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[typography[variant] as TextStyle, { color, textAlign: align }, style]}
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
}

export function Screen({ children, scroll = true, footer, padded = true }: ScreenProps) {
  const body = padded ? { padding: space.xl } : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
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
  return (
    <View
      style={[
        styles.card,
        raised && shadow('md'),
        raised && { backgroundColor: palette.surfaceRaised },
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
  const inert = disabled || loading;
  const colors = BUTTON_COLORS[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.background, borderColor: colors.border },
        fullWidth && styles.fullWidth,
        // La respuesta táctil es por opacidad y no por cambio de color: en el
        // modo del menor los botones ya son de colores saturados y un segundo
        // color de presión los vuelve ruidosos.
        pressed && !inert && styles.pressed,
        inert && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[typography.bodyStrong as TextStyle, { color: colors.text }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const BUTTON_COLORS: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: palette.accent, border: palette.accent, text: palette.white },
  secondary: { background: palette.surfaceRaised, border: palette.border, text: palette.text },
  ghost: { background: 'transparent', border: 'transparent', text: palette.textMuted },
  danger: { background: palette.dangerSoft, border: palette.danger, text: palette.danger },
};

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/** Barra de progreso simple. `value` se recorta a 0..1. */
export function ProgressBar({ value, color = palette.accent }: { value: number; color?: string }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Badge({ label, color = palette.accent }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[typography.caption as TextStyle, { color }]}>{label}</Text>
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
  const color = {
    info: palette.accentSoft,
    warning: palette.warning,
    danger: palette.danger,
    success: palette.success,
  }[tone];

  return (
    <View style={[styles.notice, { borderColor: color }]}>
      <Txt variant="bodyStrong" color={color}>
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

const styles = StyleSheet.create({
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
  button: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  badge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
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
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    backgroundColor: palette.surface,
  },
});
