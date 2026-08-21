import { requireOptionalNativeModule } from 'expo';

import type { ScreenTimeAdapter } from './types';

/**
 * Se usa `requireOptionalNativeModule` y no `requireNativeModule` porque el
 * módulo nativo no existe en Expo Go, ni en web, ni en los tests. Cuando falta,
 * la app debe seguir siendo utilizable —el motor de ejercicios y el panel del
 * tutor funcionan igual— y el simulador de `src/screentime/mock.ts` toma el
 * relevo. Un `require` obligatorio convertiría la ausencia del módulo en un
 * fallo de arranque, que es exactamente el peor comportamiento durante el
 * desarrollo.
 */
const nativeModule = requireOptionalNativeModule<ScreenTimeAdapter>('NeuropassScreentime');

export default nativeModule;
