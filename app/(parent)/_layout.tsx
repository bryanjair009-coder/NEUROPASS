import { Stack } from 'expo-router';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { palette, typography } from '@/ui/theme';

/**
 * Zona del tutor.
 *
 * La sesión desbloqueada vive en memoria y **nunca** se persiste: cerrar la app
 * la termina. Es deliberado. Persistirla ahorraría un PIN de vez en cuando y a
 * cambio dejaría una ventana abierta en el teléfono del menor, que es el
 * dispositivo donde se está aplicando el control.
 */

interface ParentSession {
  readonly unlocked: boolean;
  unlock(): void;
  lock(): void;
}

const ParentSessionContext = createContext<ParentSession | null>(null);

export function useParentSession(): ParentSession {
  const value = useContext(ParentSessionContext);
  if (!value) throw new Error('useParentSession fuera del árbol de (parent)');
  return value;
}

function ParentSessionProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  const value = useMemo<ParentSession>(
    () => ({
      unlocked,
      unlock: () => setUnlocked(true),
      lock: () => setUnlocked(false),
    }),
    [unlocked],
  );

  return <ParentSessionContext.Provider value={value}>{children}</ParentSessionContext.Provider>;
}

export default function ParentLayout() {
  return (
    <ParentSessionProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.base },
          headerTintColor: palette.text,
          headerTitleStyle: typography.heading,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.base },
        }}
      >
        <Stack.Screen name="unlock" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ title: 'Panel', headerBackVisible: false }} />
        <Stack.Screen name="apps" options={{ title: 'Apps limitadas' }} />
        <Stack.Screen name="schedules" options={{ title: 'Horarios protegidos' }} />
        <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
      </Stack>
    </ParentSessionProvider>
  );
}
