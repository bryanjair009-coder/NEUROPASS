import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { usePalette } from '@/ui/ThemeProvider';
import type { Palette } from '@/ui/theme';

/**
 * Hojas de estilo que reaccionan al tema.
 *
 * `StyleSheet.create` se evalúa al importar el módulo, una sola vez, así que
 * cualquier color que se escriba ahí queda congelado con el tema que hubiera al
 * arrancar. Es la razón por la que un modo oscuro añadido a posteriori suele
 * dejar la mitad de la app con los colores del otro tema.
 *
 * Envolver la hoja en una fábrica traslada su evaluación al render, donde sí se
 * conoce el tema vigente, y el `useMemo` evita rehacerla en cada pintado: solo
 * se recalcula cuando la paleta cambia de verdad.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (palette: Palette) => T & StyleSheet.NamedStyles<T>,
) {
  return function useStyles(): T {
    const palette = usePalette();
    return useMemo(() => StyleSheet.create(factory(palette)), [palette]);
  };
}
