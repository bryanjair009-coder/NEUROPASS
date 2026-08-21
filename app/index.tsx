import { Redirect } from 'expo-router';

import { useAppStore } from '@/state/appStore';

/**
 * Puerta de entrada.
 *
 * NEUROpass se instala en el dispositivo del menor, así que la pantalla por
 * omisión es la suya, no la del tutor. El panel del tutor está detrás del PIN
 * y hay que ir a buscarlo: si la app abriera en el panel, bastaría con ser el
 * primero en tomar el teléfono para saltarse el control.
 */
export default function Index() {
  const pinConfigured = useAppStore((state) => state.pinConfigured);
  const children = useAppStore((state) => state.children);

  const needsSetup = !pinConfigured || children.length === 0;
  if (needsSetup) return <Redirect href="/onboarding" />;

  return <Redirect href="/(child)/home" />;
}
