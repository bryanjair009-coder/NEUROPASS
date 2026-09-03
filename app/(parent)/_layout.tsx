import { Stack } from 'expo-router';

import { useAppStore } from '@/state/appStore';
import { usePalette } from '@/ui/ThemeProvider';
import { typography } from '@/ui/theme';

/**
 * Zona del tutor.
 *
 * La sesión desbloqueada vive en `appStore`, solo en memoria, y **nunca** se
 * persiste: cerrar la app la termina. Es deliberado. Persistirla ahorraría un
 * PIN de vez en cuando y a cambio dejaría una ventana abierta en el teléfono
 * del menor, que es el dispositivo donde se está aplicando el control.
 *
 * Cada pantalla comprueba `unlocked` por su cuenta y redirige al PIN si hace
 * falta. Se hace pantalla por pantalla y no aquí porque en la web las rutas son
 * direccionables: alguien puede escribir `/(parent)/dashboard` en la barra y
 * saltarse cualquier comprobación que solo viviera en el layout.
 */
export function useParentSession() {
  const unlocked = useAppStore((state) => state.parentUnlocked);
  const unlock = useAppStore((state) => state.unlockParent);
  const lock = useAppStore((state) => state.lockParent);
  return { unlocked, unlock, lock };
}

export default function ParentLayout() {
  const palette = usePalette();
  return (
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
  );
}
