/**
 * Contrato del puente nativo de tiempo de pantalla.
 *
 * Este archivo es el punto donde se resuelve la diferencia estructural entre
 * las dos plataformas, porque intentar unificarlas más abajo produce una
 * abstracción que miente:
 *
 *  ANDROID — la app ve la lista de aplicaciones instaladas
 *  (`QUERY_ALL_PACKAGES`), consulta el uso real con `UsageStatsManager` y
 *  bloquea dibujando una pantalla propia encima con `SYSTEM_ALERT_WINDOW`
 *  desde un servicio en primer plano. El bloqueo es *reactivo*: se detecta que
 *  una app restringida pasó a primer plano y se responde.
 *
 *  iOS — la app **nunca** ve qué aplicaciones hay instaladas ni cuáles se están
 *  usando: el sistema devuelve tokens opacos a través de un selector propio
 *  (`FamilyActivityPicker`) y aplica el bloqueo él mismo con
 *  `ManagedSettingsStore`. No hay overlay, no hay lista de paquetes, no hay
 *  estadísticas por app. El bloqueo es *declarativo*: se declara el conjunto
 *  restringido y el sistema muestra su propio escudo.
 *
 * Por eso el adaptador declara `selectionMode` y `usageMode`: la interfaz del
 * tutor tiene que ramificar de verdad, no fingir que ambas plataformas son la
 * misma. Fingirlo llevaría a una pantalla de iOS con una lista de apps siempre
 * vacía.
 */

export type ScreenTimeBackend = 'android' | 'ios' | 'mock';

/** Cómo elige el tutor las apps que se restringen. */
export type SelectionMode =
  /** Android: la app muestra su propia lista de paquetes instalados. */
  | 'package_list'
  /** iOS: se abre el selector del sistema y se reciben tokens opacos. */
  | 'system_picker';

/** Qué granularidad de uso puede leer la app. */
export type UsageMode =
  /** Android: minutos por aplicación. */
  | 'per_app'
  /** iOS: solo umbrales agregados vía DeviceActivity; sin desglose por app. */
  | 'aggregate_only';

export interface ScreenTimeCapabilities {
  readonly backend: ScreenTimeBackend;
  readonly selectionMode: SelectionMode;
  readonly usageMode: UsageMode;

  /** Android: acceso a estadísticas de uso concedido en Ajustes. */
  readonly usageAccess: boolean;
  /** Android: permiso para dibujar sobre otras apps. */
  readonly overlay: boolean;
  /** Android: administrador de dispositivo activo (protección antidesinstalación). */
  readonly deviceAdmin: boolean;
  /** Ambas: permiso de notificaciones, necesario para el servicio en primer plano. */
  readonly notifications: boolean;
  /** iOS: autorización de Family Controls concedida. */
  readonly familyControls: boolean;
  /** Android: exención de optimización de batería, sin la cual el guardián muere. */
  readonly batteryUnrestricted: boolean;
}

export interface InstalledApp {
  readonly packageName: string;
  readonly label: string;
  readonly isSystem: boolean;
  /** Icono en base64 (PNG), o cadena vacía si no se pudo obtener. */
  readonly iconBase64: string;
}

export interface UsageEntry {
  readonly packageName: string;
  readonly label: string;
  readonly foregroundMs: number;
}

/** Franja en la que el ocio está bloqueado pase lo que pase. */
export interface ScheduleWindow {
  /** Máscara de días; bit 0 = domingo. */
  readonly weekdayMask: number;
  readonly startMinute: number;
  readonly endMinute: number;
}

/**
 * Política que se entrega al guardián nativo.
 *
 * Es un estado completo, no un delta: cada llamada reemplaza la política
 * anterior por entero. Aplicar deltas a través del puente JS↔nativo obligaría
 * a mantener sincronizados dos estados que sobreviven a procesos distintos, y
 * ahí es donde aparecen los bloqueos fantasma.
 */
export interface ScreenTimePolicy {
  /** Android: paquetes restringidos. En iOS se ignora (el sistema guarda los tokens). */
  readonly blockedPackages: readonly string[];
  /** Instante hasta el que el ocio está permitido; `null` si no hay tiempo desbloqueado. */
  readonly unlockedUntil: number | null;
  /** Franjas que anulan cualquier tiempo desbloqueado. */
  readonly scheduleWindows: readonly ScheduleWindow[];
  /** Texto que se muestra en la pantalla de bloqueo, ya localizado. */
  readonly shieldTitle: string;
  readonly shieldMessage: string;
  /** Enlace profundo que abre la sesión de retos desde la pantalla de bloqueo. */
  readonly challengeDeepLink: string;
  /**
   * Instante en el que avisar de que el tiempo está por acabarse, o `null` si
   * no procede. Lo calcula `expiryWarningAt`; la plataforma solo programa una
   * alarma para ese momento, sin decidir nada.
   */
  readonly expiryWarningAt: number | null;
  /**
   * Modo adulto: mientras esté activo no se bloquea nada.
   *
   * `null` significa que no hay pausa. Un número es el instante en que la pausa
   * se levanta sola; `0` es una pausa indefinida, que solo termina cuando el
   * adulto lo indica. Se envía el instante y no solo una bandera para que el
   * guardián pueda reanudar el bloqueo por su cuenta, sin depender de que
   * alguien vuelva a abrir la app.
   */
  readonly pausedUntil: number | null;
}

export interface GuardStatus {
  /**
   * El guardián está activo **y** dando señales de vida. Es la única bandera
   * que la interfaz debe usar para decir "supervisando".
   */
  readonly running: boolean;
  /** El tutor tiene la supervisión configurada, viva o no. */
  readonly enabled: boolean;
  /**
   * Hubo latido reciente.
   *
   * `enabled && !alive` es el caso que importa: el sistema mató el servicio sin
   * avisar a nadie. Sin distinguirlo, el panel diría que todo va bien mientras
   * el menor usa lo que quiere, que es exactamente el fallo que se vio en un
   * dispositivo con HyperOS.
   */
  readonly alive: boolean;
  /** Epoch ms del último ciclo del guardián; 0 si nunca se ejecutó. */
  readonly lastHeartbeatAt: number;
  /** Paquete en primer plano en la última comprobación; vacío si se desconoce. */
  readonly foregroundPackage: string;
  readonly blockedNow: boolean;
  /** El adulto tiene el teléfono: no se bloquea nada y el tiempo no corre. */
  readonly paused: boolean;
  readonly reason: 'permitido' | 'sin_tiempo' | 'horario_protegido' | 'desconocido';
}

/**
 * Superficie del módulo nativo.
 *
 * Los métodos que no aplican a una plataforma no se omiten: se implementan
 * devolviendo un valor honesto (lista vacía, `false`) para que quien llama no
 * tenga que envolver todo en `try/catch`. Qué está disponible de verdad se
 * consulta en `getCapabilities()`.
 */
export interface ScreenTimeAdapter {
  getCapabilities(): Promise<ScreenTimeCapabilities>;

  /** Abre los ajustes del sistema correspondientes. No resuelve con el resultado: hay que reconsultar capacidades al volver. */
  openUsageAccessSettings(): Promise<void>;
  openOverlaySettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
  /**
   * Abre los ajustes de inicio automático del fabricante. Resuelve a `false`
   * cuando la capa no tiene esa pantalla, que es el caso de Android limpio.
   */
  openAutostartSettings(): Promise<boolean>;

  requestNotificationPermission(): Promise<boolean>;
  /** Android: activa el administrador de dispositivo (antidesinstalación). */
  requestDeviceAdmin(): Promise<boolean>;
  /** Android: desactiva el administrador; imprescindible antes de desinstalar. */
  releaseDeviceAdmin(): Promise<void>;
  /** iOS: solicita autorización de Family Controls para el perfil de menor. */
  requestFamilyControls(): Promise<boolean>;

  /** Android: apps lanzables instaladas. En iOS devuelve `[]`. */
  listInstalledApps(): Promise<InstalledApp[]>;
  /** iOS: abre el selector del sistema y guarda la selección. Devuelve cuántas entradas quedaron seleccionadas. */
  presentAppPicker(): Promise<number>;
  /** Número de apps o categorías actualmente restringidas. */
  getSelectionCount(): Promise<number>;

  /** Android: uso por app en una ventana. En iOS devuelve `[]`. */
  getUsage(startMs: number, endMs: number): Promise<UsageEntry[]>;

  applyPolicy(policy: ScreenTimePolicy): Promise<void>;
  clearPolicy(): Promise<void>;
  getGuardStatus(): Promise<GuardStatus>;
}
