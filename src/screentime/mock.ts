import type {
  GuardStatus,
  InstalledApp,
  ScreenTimeAdapter,
  ScreenTimeCapabilities,
  ScreenTimePolicy,
  UsageEntry,
} from 'neuropass-screentime';

/**
 * Adaptador simulado.
 *
 * Se usa cuando el módulo nativo no está presente: Expo Go, web, tests y
 * cualquier arranque sin `expo run:android`. No es un maniquí vacío: reproduce
 * la máquina de estados real —permisos que empiezan denegados, política que se
 * guarda, guardián que se enciende y apaga— para que todo el flujo del tutor
 * pueda desarrollarse y probarse sin un dispositivo físico.
 *
 * Es explícito en `backend: 'mock'`, y la interfaz lo muestra con un aviso
 * visible. Un simulador que se hace pasar por el sistema real es la forma más
 * rápida de enviar a producción una app que en realidad no bloquea nada.
 */

const SAMPLE_APPS: readonly Omit<InstalledApp, 'iconBase64'>[] = [
  { packageName: 'com.example.videos', label: 'Videos Cortos', isSystem: false },
  { packageName: 'com.example.battle', label: 'Battle Royale', isSystem: false },
  { packageName: 'com.example.chat', label: 'Chat Grupal', isSystem: false },
  { packageName: 'com.example.stream', label: 'Streaming TV', isSystem: false },
  { packageName: 'com.example.sandbox', label: 'Mundo Sandbox', isSystem: false },
  { packageName: 'com.example.browser', label: 'Navegador', isSystem: true },
  { packageName: 'com.example.music', label: 'Música', isSystem: false },
  { packageName: 'com.example.puzzle', label: 'Rompecabezas', isSystem: false },
];

interface MockState {
  capabilities: ScreenTimeCapabilities;
  policy: ScreenTimePolicy | null;
  guardRunning: boolean;
}

const state: MockState = {
  capabilities: {
    backend: 'mock',
    selectionMode: 'package_list',
    usageMode: 'per_app',
    // Empiezan en falso a propósito: así el flujo de configuración de permisos
    // se recorre completo en desarrollo en vez de quedar sin probar.
    usageAccess: false,
    overlay: false,
    deviceAdmin: false,
    notifications: false,
    familyControls: false,
    batteryUnrestricted: false,
  },
  policy: null,
  guardRunning: false,
};

/** Simula que la persona concedió un permiso en los ajustes del sistema. */
function grant(permission: keyof ScreenTimeCapabilities): void {
  state.capabilities = { ...state.capabilities, [permission]: true };
}

export const mockAdapter: ScreenTimeAdapter = {
  async getCapabilities() {
    return state.capabilities;
  },

  async openUsageAccessSettings() {
    grant('usageAccess');
  },

  async openOverlaySettings() {
    grant('overlay');
  },

  async openBatterySettings() {
    grant('batteryUnrestricted');
  },

  async requestNotificationPermission() {
    grant('notifications');
    return true;
  },

  async requestDeviceAdmin() {
    grant('deviceAdmin');
    return true;
  },

  async releaseDeviceAdmin() {
    state.capabilities = { ...state.capabilities, deviceAdmin: false };
  },

  async requestFamilyControls() {
    grant('familyControls');
    return true;
  },

  async listInstalledApps() {
    return SAMPLE_APPS.map((app) => ({ ...app, iconBase64: '' }));
  },

  async presentAppPicker() {
    return state.policy?.blockedPackages.length ?? 0;
  },

  async getSelectionCount() {
    return state.policy?.blockedPackages.length ?? 0;
  },

  async getUsage(startMs: number, endMs: number): Promise<UsageEntry[]> {
    // Reparto determinista de la ventana pedida: una gráfica de desarrollo que
    // cambia en cada refresco impide detectar si el cálculo está bien.
    const windowMs = Math.max(0, endMs - startMs);
    return SAMPLE_APPS.filter((app) => !app.isSystem).map((app, index) => ({
      packageName: app.packageName,
      label: app.label,
      foregroundMs: Math.round((windowMs * (SAMPLE_APPS.length - index)) / 120),
    }));
  },

  async applyPolicy(policy: ScreenTimePolicy) {
    state.policy = policy;
    state.guardRunning = policy.blockedPackages.length > 0;
  },

  async clearPolicy() {
    state.policy = null;
    state.guardRunning = false;
  },

  async getGuardStatus(): Promise<GuardStatus> {
    const policy = state.policy;
    if (!policy || !state.guardRunning) {
      return { running: false, foregroundPackage: '', blockedNow: false, reason: 'permitido' };
    }

    const unlocked = policy.unlockedUntil !== null && Date.now() < policy.unlockedUntil;
    return {
      running: true,
      foregroundPackage: '',
      blockedNow: !unlocked,
      reason: unlocked ? 'permitido' : 'sin_tiempo',
    };
  },
};

/** Solo para tests: devuelve el simulador a su estado inicial. */
export function resetMockAdapter(): void {
  state.capabilities = {
    ...state.capabilities,
    usageAccess: false,
    overlay: false,
    deviceAdmin: false,
    notifications: false,
    familyControls: false,
    batteryUnrestricted: false,
  };
  state.policy = null;
  state.guardRunning = false;
}
