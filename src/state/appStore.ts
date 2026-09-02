import { create } from 'zustand';

import {
  getSettings,
  listChildren,
  type Child,
  type ChildSettings,
} from '@/data/repositories/children';
import { activeParentPause, endParentMode, startParentMode } from '@/data/repositories/parentMode';
import { listBlockedApps, listSchedules, type Schedule } from '@/data/repositories/policy';
import { getLedger, unlockedUntil } from '@/data/repositories/rewards';
import type { DailyLedger } from '@/engine/economy';
import type { ParentPause } from '@/engine/parentMode';
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

  /**
   * Si el tutor ya se autenticó en esta ejecución.
   *
   * Vive aquí y no en un contexto dentro de `(parent)/` porque el alta inicial
   * ocurre fuera de ese árbol y necesita poder marcarlo: quien acaba de elegir
   * el PIN no debe tener que escribirlo diez segundos después.
   *
   * **Nunca se persiste.** Cerrar la app termina la sesión del tutor, que es
   * justo lo que se busca en el teléfono del menor.
   */
  parentUnlocked: boolean;

  children: Child[];
  activeChildId: string | null;

  settings: ChildSettings | null;
  ledger: DailyLedger | null;
  schedules: Schedule[];
  /** Instante hasta el que el ocio está desbloqueado; `null` si no hay nada. */
  unlockedUntil: number | null;
  /**
   * Pausa de modo adulto vigente, o `null`. Mientras exista, el tiempo del
   * menor no corre y no se bloquea ninguna aplicación.
   */
  parentPause: ParentPause | null;

  capabilities: ScreenTimeCapabilities | null;

  unlockParent: () => void;
  lockParent: () => void;
  bootstrap: () => Promise<void>;
  selectChild: (childId: string) => Promise<void>;
  refreshActiveChild: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  /** Vuelve a enviar la política completa al guardián nativo. */
  syncPolicy: () => Promise<void>;
  /** Entrega el teléfono al adulto: congela el tiempo y suspende el bloqueo. */
  pauseForParent: (durationMinutes: number | null) => Promise<void>;
  /** Devuelve el teléfono al menor y reanuda su tiempo donde estaba. */
  resumeChild: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  pinConfigured: false,
  parentUnlocked: false,
  children: [],
  activeChildId: null,
  settings: null,
  ledger: null,
  schedules: [],
  unlockedUntil: null,
  parentPause: null,
  capabilities: null,

  unlockParent: () => set({ parentUnlocked: true }),
  lockParent: () => set({ parentUnlocked: false }),

  bootstrap: async () => {
    const [children, pinConfigured, capabilities] = await Promise.all([
      listChildren(),
      hasPin(),
      screenTime.getCapabilities(),
    ]);

    // Con un único menor no tiene sentido pedir que se elija: se selecciona
    // solo. Es el caso mayoritario y ahorra un toque en cada arranque.
    //
    // Si el que estaba activo ya no existe —lo archivaron o lo borraron— se
    // descarta en lugar de conservar un identificador colgado, que dejaría la
    // pantalla del menor esperando datos que nunca llegan.
    const previous = get().activeChildId;
    const stillExists = previous !== null && children.some((child) => child.id === previous);
    const activeChildId = stillExists
      ? previous
      : children.length === 1
        ? (children[0]?.id ?? null)
        : null;

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
    const [ledger, schedules, until, pause] = await Promise.all([
      getLedger(childId, settings.rewardPolicy),
      listSchedules(childId),
      unlockedUntil(childId),
      activeParentPause(childId),
    ]);

    set({ settings, ledger, schedules, unlockedUntil: until, parentPause: pause });
  },

  refreshCapabilities: async () => {
    set({ capabilities: await screenTime.getCapabilities() });
  },

  pauseForParent: async (durationMinutes) => {
    const childId = get().activeChildId;
    if (!childId) return;
    await startParentMode(childId, durationMinutes);
    await get().syncPolicy();
    await get().refreshActiveChild();
  },

  resumeChild: async () => {
    const childId = get().activeChildId;
    if (!childId) return;
    await endParentMode(childId);
    await get().syncPolicy();
    await get().refreshActiveChild();
  },

  syncPolicy: async () => {
    const childId = get().activeChildId;
    if (!childId) return;

    const [blocked, schedules, until] = await Promise.all([
      listBlockedApps(childId),
      listSchedules(childId),
      unlockedUntil(childId),
    ]);

    // La política de recompensa aporta la antelación del aviso de fin de
    // tiempo. Se toma del estado si ya está cargada y, si no, de la base: este
    // método también se invoca desde flujos que aún no han refrescado al menor.
    const rewardPolicy = get().settings?.rewardPolicy ?? (await getSettings(childId)).rewardPolicy;
    // Se consulta la pausa *vigente*, que de paso liquida las que ya vencieron
    // y devuelve al menor el tiempo que no llegó a usarse.
    const pause = await activeParentPause(childId);

    await screenTime.applyPolicy(
      buildPolicy({
        blockedPackages: blocked.map((app) => app.packageName),
        unlockedUntil: until,
        schedules,
        rewardPolicy,
        pause,
      }),
    );

    set({ schedules, unlockedUntil: until, parentPause: pause });
  },
}));

/** Menor activo ya resuelto, para no repetir el `find` en cada pantalla. */
export function useActiveChild(): Child | null {
  return useAppStore((state) => state.children.find((child) => child.id === state.activeChildId) ?? null);
}
