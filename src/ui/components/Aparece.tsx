import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useMovimientoReducido } from '@/ui/useMovimientoReducido';

/**
 * Entrada de un bloque al montarse.
 *
 * Dos direcciones y nada más. «Desde la derecha» es el cambio de reto: se lee
 * como avanzar, igual que pasar una página. «Desde abajo» es lo que responde a
 * un toque —la pista, la hoja de revisión—, y tarda menos de 300 ms, que es
 * donde un niño todavía percibe causa y efecto.
 *
 * Para repetir la entrada hay que remontarlo con una `key` nueva.
 */

interface ApareceProps {
  readonly children: ReactNode;
  readonly desde: 'derecha' | 'abajo';
  readonly style?: StyleProp<ViewStyle>;
}

export function Aparece({ children, desde, style }: ApareceProps) {
  const movimientoReducido = useMovimientoReducido();
  const [avance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (movimientoReducido) {
      avance.setValue(1);
      return undefined;
    }
    const entrada = Animated.timing(avance, {
      toValue: 1,
      duration: desde === 'derecha' ? 450 : 300,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    entrada.start();
    return () => entrada.stop();
  }, [avance, desde, movimientoReducido]);

  const transform =
    desde === 'derecha'
      ? [
          { translateX: avance.interpolate({ inputRange: [0, 1], outputRange: [38, 0] }) },
          { scale: avance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ]
      : [{ translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }];

  return <Animated.View style={[style, { opacity: avance, transform }]}>{children}</Animated.View>;
}
