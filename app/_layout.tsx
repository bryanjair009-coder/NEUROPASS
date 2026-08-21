import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDatabase } from '@/data/db';
import { useAppStore } from '@/state/appStore';
import { palette, space, typography } from '@/ui/theme';

// La splash se retira a mano cuando la base ya migró y el estado está cargado:
// dejar que se oculte sola mostraría una pantalla vacía mientras tanto.
void SplashScreen.preventAutoHideAsync();

/**
 * A partir del SDK 56, expo-router ya no se apoya en react-navigation, así que
 * no hay `ThemeProvider` que envolver: el tema se aplica directamente en las
 * `screenOptions` del Stack, que es donde vive ahora la configuración visual
 * de la navegación.
 */

export default function RootLayout() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const ready = useAppStore((state) => state.ready);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // El orden importa: primero se abre y migra la base, y solo después se
        // carga el estado, que depende de ella.
        await getDatabase();
        await bootstrap();
      } catch (error) {
        if (!cancelled) {
          // Un fallo aquí casi siempre es una migración rota. Se muestra el
          // motivo en pantalla en lugar de dejar la splash colgada para
          // siempre, que es lo que ocurre si el error se traga.
          setFailure(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) void SplashScreen.hideAsync();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  if (failure) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>No se pudo abrir NEUROpass</Text>
        <Text style={styles.errorBody}>{failure}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: palette.base },
            headerTintColor: palette.text,
            headerTitleStyle: typography.heading,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: palette.base },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(child)" options={{ headerShown: false }} />
          <Stack.Screen name="(parent)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.base,
    padding: space.xl,
  },
  errorTitle: { ...(typography.title as object), color: palette.text, marginBottom: space.md },
  errorBody: { ...(typography.body as object), color: palette.textMuted, textAlign: 'center' },
});
