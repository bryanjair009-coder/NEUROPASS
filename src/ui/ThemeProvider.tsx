import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getPreference, setPreference } from '@/data/repositories/preferences';
import { darkPalette, lightPalette, type Palette } from '@/ui/theme';

/**
 * Tema visible de la app.
 *
 * Tres modos y no dos. «Sistema» es el predeterminado porque quien ya configuró
 * su teléfono en oscuro no quiere que una app se lo ignore, y porque en un
 * dispositivo compartido con un menor el ajuste nocturno del sistema suele
 * estar bien puesto. Los otros dos existen para quien quiera fijarlo pase lo
 * que pase.
 *
 * La preferencia se guarda en la base local, no junto al PIN: no es un secreto
 * y sí es un dato que conviene que sobreviva a un cambio de PIN.
 */

export type ThemeMode = 'sistema' | 'claro' | 'oscuro';

interface ThemeValue {
  readonly palette: Palette;
  readonly isDark: boolean;
  /** Lo que el tutor eligió, que puede ser «sistema». */
  readonly mode: ThemeMode;
  readonly setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const PREFERENCIA = 'tema';

function esModo(valor: string | null): valor is ThemeMode {
  return valor === 'sistema' || valor === 'claro' || valor === 'oscuro';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('sistema');

  // La preferencia se lee una vez al arrancar. Hasta que llega se usa la del
  // sistema, que es también el valor por omisión: así no hay un parpadeo de
  // tema claro a oscuro en el arranque de quien ya lo tenía en oscuro.
  useEffect(() => {
    let cancelado = false;

    void getPreference(PREFERENCIA).then((guardado) => {
      if (!cancelado && esModo(guardado)) setModeState(guardado);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const isDark = mode === 'sistema' ? sistema === 'dark' : mode === 'oscuro';

    return {
      palette: isDark ? darkPalette : lightPalette,
      isDark,
      mode,
      setMode: (siguiente) => {
        setModeState(siguiente);
        void setPreference(PREFERENCIA, siguiente);
      },
    };
  }, [mode, sistema]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme() fuera de <ThemeProvider>');
  return value;
}

/** Atajo para el caso mayoritario: solo hace falta la paleta. */
export function usePalette(): Palette {
  return useTheme().palette;
}
