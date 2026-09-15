import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

import { usePalette } from '@/ui/ThemeProvider';
import type { Palette } from '@/ui/theme';
import { useMovimientoReducido } from '@/ui/useMovimientoReducido';

/**
 * Formas pastel que flotan detrás de las pantallas del menor.
 *
 * Se mueven en ciclos de 11 a 15 segundos, por debajo del umbral que roba
 * atención sostenida: se perciben como ambiente, no como algo que mirar. Cada
 * forma lleva su propio periodo para que nunca se sincronicen, porque cuatro
 * formas subiendo a la vez sí se notan.
 */

interface Forma {
  readonly posicion: ViewStyle;
  readonly color: keyof Palette;
  readonly duracion: number;
  /** Desplazamiento vertical y giro en el punto medio del ciclo. */
  readonly sube: number;
  readonly gira: number;
  /** Giro de partida, para que la forma cuadrada no quede alineada con la pantalla. */
  readonly giroInicial: number;
}

const FORMAS: readonly Forma[] = [
  {
    posicion: { top: -40, left: -50, width: 190, height: 190, borderRadius: 95 },
    color: 'pastelRosa',
    duracion: 11_000,
    sube: -22,
    gira: 8,
    giroInicial: 0,
  },
  {
    posicion: { top: 180, right: -60, width: 160, height: 160, borderRadius: 80 },
    color: 'pastelAqua',
    duracion: 13_000,
    sube: 18,
    gira: -10,
    giroInicial: 0,
  },
  {
    posicion: { bottom: 130, left: -40, width: 150, height: 150, borderRadius: 44 },
    color: 'pastelLima',
    duracion: 15_000,
    sube: -22,
    gira: 8,
    giroInicial: 18,
  },
  {
    posicion: { bottom: -30, right: 20, width: 130, height: 130, borderRadius: 65 },
    color: 'pastelMango',
    duracion: 12_000,
    sube: 18,
    gira: -10,
    giroInicial: 0,
  },
];

export function FondoFlotante() {
  return (
    <View pointerEvents="none" style={styles.lienzo}>
      {FORMAS.map((forma) => (
        <FormaFlotando key={forma.color} forma={forma} />
      ))}
    </View>
  );
}

function FormaFlotando({ forma }: { forma: Forma }) {
  const palette = usePalette();
  const movimientoReducido = useMovimientoReducido();
  const [avance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (movimientoReducido) {
      avance.setValue(0);
      return undefined;
    }
    const media = {
      duration: forma.duracion / 2,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    };
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(avance, { toValue: 1, ...media }),
        Animated.timing(avance, { toValue: 0, ...media }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [avance, forma.duracion, movimientoReducido]);

  return (
    <Animated.View
      style={[
        styles.forma,
        forma.posicion,
        {
          backgroundColor: palette[forma.color],
          transform: [
            { translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [0, forma.sube] }) },
            {
              rotate: avance.interpolate({
                inputRange: [0, 1],
                outputRange: [`${forma.giroInicial}deg`, `${forma.giroInicial + forma.gira}deg`],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  lienzo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  forma: { position: 'absolute' },
});
