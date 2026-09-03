import { Stack } from 'expo-router';

import { usePalette } from '@/ui/ThemeProvider';

/**
 * Zona del menor.
 *
 * Sin cabeceras y sin gesto de retroceso durante la sesión: una vez empezados
 * los retos, salir con un deslizamiento dejaría la sesión a medias y el tiempo
 * sin conceder, que desde el lado del menor se vive como una injusticia.
 */
export default function ChildLayout() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.base },
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      <Stack.Screen name="result" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
