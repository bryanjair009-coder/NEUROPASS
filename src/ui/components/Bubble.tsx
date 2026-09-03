import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { radius, shadow, space } from '@/ui/theme';

/**
 * Burbuja del enunciado.
 *
 * Es el elemento central de la guía visual: un círculo de color saturado con el
 * reto dentro. Tiene dos decisiones que la guía no podía anticipar.
 *
 * **Deja de ser círculo cuando el texto no cabe.** Un enunciado de comprensión
 * lectora ocupa varias líneas, y forzarlo dentro de un círculo obliga a
 * encogerlo hasta hacerlo ilegible o a recortarlo. Cuando el contenido supera
 * lo que un círculo admite con holgura, la burbuja se convierte en una forma
 * redondeada de la misma altura y color. Se conserva el lenguaje visual y no se
 * sacrifica la legibilidad, que en una app de ejercicios es la función.
 *
 * **La animación es discreta y perpetua.** Una flotación lenta de unos pocos
 * píxeles, más una entrada con escala. Le da vida a la pantalla sin competir
 * con el contenido: quien está leyendo un problema de matemáticas no necesita
 * un elemento saltando al lado.
 *
 * Se usa el `Animated` de React Native y no Reanimated a propósito: con
 * `useNativeDriver` la animación corre en el hilo de UI igualmente, y este
 * proyecto no tiene `babel.config.js`, del que depende el plugin de worklets de
 * Reanimated 4.
 */

interface BubbleProps {
  children: React.ReactNode;
  /** Color de relleno; viene del acento de la sesión. */
  color: string;
  /** Diámetro máximo. La burbuja nunca crece más allá del ancho disponible. */
  maxSize?: number;
}

/** Holgura vertical a partir de la cual el círculo deja de ser viable. */
const HOLGURA_CIRCULO = 0.62;

export function Bubble({ children, color, maxSize = 300 }: BubbleProps) {
  // Estado perezoso y no `useRef`: los valores animados sí se leen durante el
  // render —van dentro del estilo— y React 19 señala con razón la lectura de
  // una referencia en ese momento. El inicializador solo corre en el montaje,
  // así que el valor es igual de estable.
  const [flotar] = useState(() => new Animated.Value(0));
  const [entrada] = useState(() => new Animated.Value(0));
  const [contenidoAlto, setContenidoAlto] = useState(0);

  useEffect(() => {
    Animated.spring(entrada, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [entrada]);

  useEffect(() => {
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(flotar, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flotar, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    ciclo.start();
    return () => ciclo.stop();
  }, [flotar]);

  // El texto se mide una vez y decide la forma: círculo si cabe con holgura,
  // forma redondeada si no.
  const cabeEnCirculo = contenidoAlto === 0 || contenidoAlto <= maxSize * HOLGURA_CIRCULO;
  const alto = cabeEnCirculo ? maxSize : contenidoAlto + space.xxl * 2;

  return (
    <Animated.View
      style={[
        styles.burbuja,
        {
          backgroundColor: color,
          width: maxSize,
          height: alto,
          borderRadius: cabeEnCirculo ? maxSize / 2 : radius.xl,
          transform: [
            {
              translateY: flotar.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
            },
            {
              scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
            },
          ],
          opacity: entrada,
        },
        shadow('lg'),
      ]}
    >
      <View
        style={styles.contenido}
        onLayout={(evento: LayoutChangeEvent) =>
          setContenidoAlto(evento.nativeEvent.layout.height)
        }
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burbuja: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  contenido: { width: '100%', alignItems: 'center', justifyContent: 'center' },
});
