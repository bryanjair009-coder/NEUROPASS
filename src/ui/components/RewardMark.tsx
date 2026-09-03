import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { usePalette } from '@/ui/ThemeProvider';

/**
 * Marca de recompensa: un reloj con un trofeo encima.
 *
 * Reproduce el icono de la guía visual, donde el reloj representa el tiempo y
 * el trofeo el logro. Va directamente sobre el fondo, sin burbuja ni tarjeta
 * que lo encierre: es una ilustración, no un contenido dentro de un recipiente,
 * y meterla en un círculo de color la convertiría en otra cosa.
 *
 * El reloj se dibuja con SVG y no con un emoji porque tiene que tomar el color
 * del texto para funcionar en los dos temas —un emoji de reloj mantendría su
 * color y se perdería sobre fondo oscuro—, y porque las manecillas debían
 * quedar en la posición de la referencia.
 *
 * El trofeo sí es un emoji: su color es constante en ambos temas y dibujarlo en
 * SVG daría una versión peor de algo que el sistema ya renderiza bien.
 */

interface RewardMarkProps {
  readonly size?: number;
  /** Sin celebración cuando no se ganó tiempo: el reloj aparece pero no salta. */
  readonly celebrate?: boolean;
}

export function RewardMark({ size = 132, celebrate = true }: RewardMarkProps) {
  const palette = usePalette();
  const [entrada] = useState(() => new Animated.Value(0));
  const [salto] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(entrada, {
      toValue: 1,
      friction: 5,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [entrada]);

  useEffect(() => {
    if (!celebrate) return;

    // El trofeo rebota dos veces al aparecer y se queda quieto: una animación
    // perpetua junto a un texto de resultado distrae de lo que hay que leer.
    const rebote = Animated.sequence([
      Animated.delay(220),
      Animated.timing(salto, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(salto, { toValue: 0, friction: 4, useNativeDriver: true }),
    ]);

    rebote.start();
    return () => rebote.stop();
  }, [salto, celebrate]);

  const trazo = Math.max(3, size * 0.055);
  const radio = size / 2 - trazo / 2;

  return (
    <Animated.View
      style={[
        styles.marco,
        {
          width: size * 1.35,
          height: size * 1.12,
          transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          opacity: entrada,
        },
      ]}
    >
      <Svg width={size} height={size} style={styles.reloj}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radio}
          stroke={palette.text}
          strokeWidth={trazo}
          fill="none"
        />
        {/* Manecillas en la posición de la referencia: hacia arriba y a la izquierda. */}
        <Line
          x1={size / 2}
          y1={size / 2}
          x2={size / 2}
          y2={size * 0.22}
          stroke={palette.text}
          strokeWidth={trazo}
          strokeLinecap="round"
        />
        <Line
          x1={size / 2}
          y1={size / 2}
          x2={size * 0.28}
          y2={size / 2}
          stroke={palette.text}
          strokeWidth={trazo}
          strokeLinecap="round"
        />
      </Svg>

      <Animated.View
        style={[
          styles.trofeo,
          {
            transform: [
              { translateY: salto.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.16] }) },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.72, lineHeight: size * 0.86 }}>🏆</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  marco: { alignSelf: 'center', justifyContent: 'center' },
  reloj: { position: 'absolute', left: 0, top: 0 },
  // El trofeo se solapa por la derecha y algo más abajo, como en la referencia.
  trofeo: { position: 'absolute', right: 0, bottom: 0 },
});
