import { create } from 'zustand';

import {
  getSettings,
  listChildren,
  type Child,
  type ChildSettings,
} from '@/data/repositories/children';
import { listBlockedApps, listSchedules, type Schedule } from '@/data/repositories/policy';
import { getLedger, unlockedUntil } from '@/data/repositories/rewards';
import type { DailyLedger } from '@/engine/economy';
import { buildPolicy, screenTime, type ScreenTimeCapabilities } from '@/screentime';
import { hasPin } from '@/security/pinStore';

/**
 * Estado global mínimo.
 *
 * Solo vive aquí lo que necesitan varias pantallas a la vez y cuyo origen es
 * la base de datos o el sistema: qué menores hay, cuál está activo, qué
 * permisos concedió el tutor y cuánto tiempo queda desbloqueado. Todo lo demás
 * —el progreso de una sesión, el formulario de una franja horaria— es estado
 * local de su pantalla, porque subirlo aquí solo añadiría acoplamiento.
 */

interface AppState {
  ready: boolean;
  pinConfigured: boolean;

  children: Child[];
  activeChildId: string | null;

  settings: ChildSettings | null;
  ledger: DailyLedger | null;
  schedules: Schedule[];
  /** Instante hasta el que el ocio está desbloqueado; `null` si no hay nada. */
  unlockedUntil: number | null;

  capabilities: ScreenTimeCapabilities | null;

  bootstrap: () => Promise<void>;
  selectChild: (childId: string) => Promise<void>;
  refreshActiveChild: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  /** Vuelve a enviar la política completa al guardián nativo. */
  syncPolicy: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  pinConfigured: false,
  children: [],
  activeChildId: null,
  settings: null,
  ledger: null,
  schedules: [],
  unlockedUntil: null,
  capabilities: null,

  bootstrap: async () => {
    const [children, pinConfigured, capabilities] = await Promise.all([
      listChildren(),
      hasPin(),
      screenTime.getCapabilities(),
    ]);

    // Con un único menor no tiene sentido pedir que se elija: se selecciona
    // solo. Es el caso mayoritario y ahorra un toque en cada arranque.
    const activeChildId = get().activeChildId ?? (children.length === 1 ? (children[0]?.id ?? null) : null);

    set({ children, pinConfigured, capabilities, activeChildId, ready: true });

    if (activeChildId) await get().selectChild(activeChildId);
  },

  selectChild: async (childId) => {
    set({ activeChildId: childId });
    await get().refreshActiveChild();
  },

  refreshActiveChild: async () => {
    const childId = get().activeChildId;
    if (!childId) {
      set({ settings: null, ledger: null, schedules: [], unlockedUntil: null });
      return;
    }

    const settings = await getSettings(childId);
    const [ledger, schedules, until] = await Promise.all([
      getLedger(childId, settings.rewardPolicy),
      listSchedules(childId),
      unlockedUntil(childId),
    ]);

    set({ settings, ledger, schedules, unlockedUntil: until });
  },

  refreshCapabilities: async () => {
    set({ capabilities: await screenTime.getCapabilities() });
  },

  syncPolicy: async () => {
    const childId = get().activeChildId;
    if (!childId) return;

    const [blocked, schedules, until] = await Promise.all([
      listBlockedApps(childId),
      listSchedules(childId),
      unlockedUntil(childId),
    ]);

    await screenTime.applyPolicy(
      buildPolicy({
        blockedPackages: blocked.map((app) => app.packageName),
        unlockedUntil: until,
        schedules,
      }),
    );

    set({ schedules, unlockedUntil: until });
  },
}));

/** Menor activo ya resuelto, para no repetir el `find` en cada pantalla. */
export function useActiveChild(): Child | null {
  return useAppStore((state) => state.children.find((child) => child.id === state.activeChildId) ?? null);
}
