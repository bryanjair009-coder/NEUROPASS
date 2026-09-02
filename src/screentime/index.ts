import nativeModule, {
  type ScreenTimeAdapter,
  type ScreenTimeCapabilities,
  type ScreenTimePolicy,
  type ScheduleWindow,
} from 'neuropass-screentime';

import type { Schedule } from '@/data/repositories/policy';
import { expiryWarningAt, type RewardPolicy } from '@/engine/economy';
import type { ParentPause } from '@/engine/parentMode';
import { CHALLENGE_DEEP_LINK } from '@/lib/deeplink';
import { mockAdapter } from './mock';

export type {
  GuardStatus,
  InstalledApp,
  ScheduleWindow,
  ScreenTimeAdapter,
  ScreenTimeCapabilities,
  ScreenTimePolicy,
  SelectionMode,
  UsageEntry,
} from 'neuropass-screentime';

/**
 * Punto único de acceso a la capa de tiempo de pantalla.
 *
 * Toda la app pasa por aquí y nunca importa el módulo nativo de forma directa.
 * Así el simulador y la implementación real son intercambiables, y la
 * diferencia queda contenida en un archivo en vez de repartida por cada
 * pantalla que quisiera comprobar si el módulo existe.
 */

export const screenTime: ScreenTimeAdapter = nativeModule ?? mockAdapter;

/** `true` cuando se está corriendo sobre el simulador y no se bloquea nada de verdad. */
export const isSimulated = nativeModule === null;

/**
 * Convierte las franjas del modelo de datos al formato del puente.
 * Solo viajan las habilitadas: filtrar en la frontera evita que el código
 * nativo tenga que conocer el concepto de franja desactivada.
 */
export function toScheduleWindows(schedules: readonly Schedule[]): ScheduleWindow[] {
  return schedules
    .filter((schedule) => schedule.enabled)
    .map((schedule) => ({
      weekdayMask: schedule.weekdayMask,
      startMinute: schedule.startMinute,
      endMinute: schedule.endMinute,
    }));
}

/** Textos de la pantalla de bloqueo. Viven aquí para no duplicarlos en Kotlin y Swift. */
export const SHIELD_COPY = {
  title: 'Se acabó el tiempo de juego',
  message: 'Resuelve unos retos en NEUROpass y desbloquea más tiempo.',
  deepLink: CHALLENGE_DEEP_LINK,
} as const;

export function buildPolicy(input: {
  blockedPackages: readonly string[];
  unlockedUntil: number | null;
  schedules: readonly Schedule[];
  rewardPolicy: RewardPolicy;
  pause: ParentPause | null;
  now?: number;
}): ScreenTimePolicy {
  return {
    blockedPackages: input.blockedPackages,
    unlockedUntil: input.unlockedUntil,
    scheduleWindows: toScheduleWindows(input.schedules),
    shieldTitle: SHIELD_COPY.title,
    shieldMessage: SHIELD_COPY.message,
    challengeDeepLink: SHIELD_COPY.deepLink,
    expiryWarningAt: expiryWarningAt(input.unlockedUntil, input.rewardPolicy, input.now ?? Date.now()),
    // Una pausa indefinida viaja como 0 porque el lado nativo no distingue
    // "sin valor" de "sin límite" con un solo número; 0 nunca es un instante
    // válido en este contexto.
    pausedUntil: input.pause === null ? null : (input.pause.pausedUntil ?? 0),
  };
}

/** Requisito de configuración pendiente, para guiar al tutor paso a paso. */
export interface SetupRequirement {
  readonly key: keyof ScreenTimeCapabilities;
  readonly title: string;
  readonly explanation: string;
  /** Qué hacer para resolverlo. */
  readonly action: (adapter: ScreenTimeAdapter) => Promise<unknown>;
  /** Si sin esto el bloqueo directamente no funciona. */
  readonly blocking: boolean;
}

/**
 * Requisitos pendientes según la plataforma.
 *
 * Se ordenan por criticidad y se explica cada uno con el porqué, no solo el
 * qué: conceder acceso a estadísticas de uso o permitir dibujar sobre otras
 * apps son permisos que, sin explicación, cualquier persona razonable rechaza.
 */
export function pendingRequirements(
  capabilities: ScreenTimeCapabilities,
): SetupRequirement[] {
  if (capabilities.backend === 'ios') {
    return capabilities.familyControls
      ? []
      : [
          {
            key: 'familyControls',
            title: 'Autorizar Controles Familiares',
            explanation:
              'iOS aplica los límites por su cuenta, pero primero necesita tu autorización como madre, padre o tutor. NEUROpass nunca ve qué apps tienes instaladas.',
            action: (adapter) => adapter.requestFamilyControls(),
            blocking: true,
          },
        ];
  }

  const requirements: SetupRequirement[] = [];

  if (!capabilities.usageAccess) {
    requirements.push({
      key: 'usageAccess',
      title: 'Permitir acceso al uso de apps',
      explanation:
        'Sin esto NEUROpass no puede saber qué aplicación está abierta y no hay forma de aplicar ningún límite. Solo se lee el nombre de la app en primer plano; nada de su contenido.',
      action: (adapter) => adapter.openUsageAccessSettings(),
      blocking: true,
    });
  }

  if (!capabilities.overlay) {
    requirements.push({
      key: 'overlay',
      title: 'Permitir mostrarse sobre otras apps',
      explanation:
        'Es la pantalla amable que aparece cuando se acaba el tiempo. Siempre deja salir al inicio: no atrapa el teléfono.',
      action: (adapter) => adapter.openOverlaySettings(),
      blocking: true,
    });
  }

  if (!capabilities.notifications) {
    requirements.push({
      key: 'notifications',
      title: 'Permitir notificaciones',
      explanation:
        'Android exige una notificación permanente mientras la supervisión está activa. Es silenciosa y sirve además para que sepas de un vistazo que NEUROpass sigue funcionando.',
      action: (adapter) => adapter.requestNotificationPermission(),
      blocking: true,
    });
  }

  if (!capabilities.batteryUnrestricted) {
    requirements.push({
      key: 'batteryUnrestricted',
      title: 'Quitar la restricción de batería',
      explanation:
        'Sin esta excepción el sistema cierra la supervisión —en algunas capas, en cuanto sales de la app— y el control deja de aplicarse sin avisar a nadie. Verificado en un dispositivo con HyperOS: el bloqueo funcionaba una vez y no volvía a funcionar.',
      // Marcado como necesario y no como recomendado: el modo de fallo es
      // silencioso y total, así que tratarlo como un extra opcional es engañar
      // a quien configura la app.
      action: (adapter) => adapter.openBatterySettings(),
      blocking: true,
    });
  }

  if (!capabilities.deviceAdmin) {
    requirements.push({
      key: 'deviceAdmin',
      title: 'Proteger contra desinstalación',
      explanation:
        'Opcional. Impide que se desinstale NEUROpass sin tu PIN. Puedes desactivarlo cuando quieras desde este mismo panel.',
      action: (adapter) => adapter.requestDeviceAdmin(),
      blocking: false,
    });
  }

  return requirements;
}
