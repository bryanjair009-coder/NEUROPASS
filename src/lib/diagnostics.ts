/**
 * Reporte de diagnóstico para pruebas con personas reales.
 *
 * El problema que resuelve: los fallos de esta app dependen casi siempre del
 * fabricante y de qué permisos concedió quien la instaló. Un aviso de "no me
 * bloquea nada" sin esos datos no se puede investigar, y pedírselos uno por uno
 * por mensaje es lento y se responde mal.
 *
 * Se genera **texto plano que la persona copia y envía por donde quiera**, en
 * lugar de enviarlo a un servidor de errores. No es una limitación asumida a
 * regañadientes: NEUROpass no hace ninguna petición de red, y esa propiedad es
 * lo que permite decirle a una familia que nada de su hijo sale del teléfono.
 * Añadir telemetría por comodidad de desarrollo la rompería.
 *
 * Por eso el reporte **no lleva ningún dato del menor**: ni apodo, ni rango de
 * edad, ni progreso, ni qué aplicaciones tiene restringidas. Solo el modelo del
 * teléfono, el estado de los permisos y la salud del guardián, que es
 * exactamente lo que hace falta para reproducir un fallo. Hay una prueba que lo
 * verifica.
 */

export interface DiagnosticsInput {
  readonly appVersion: string;
  readonly buildNumber: string;
  /** Versión de Android, p. ej. "14". */
  readonly osVersion: string;
  /** Nivel de API, que es lo que de verdad cambia el comportamiento. */
  readonly apiLevel: number | string;
  readonly manufacturer: string;
  readonly model: string;
  readonly schemaVersion: number;
  readonly nativeModuleLoaded: boolean;
  readonly kdfAccelerated: boolean;
  readonly darkTheme: boolean;
  readonly permissions: Readonly<Record<string, boolean>>;
  readonly guard: {
    readonly enabled: boolean;
    readonly alive: boolean;
    readonly lastHeartbeatAt: number;
  } | null;
  readonly parentPaused: boolean;
  readonly generatedAt: number;
}

const si = (valor: boolean): string => (valor ? 'sí' : 'NO');

/** Antigüedad del latido en palabras; los milisegundos no le dicen nada a nadie. */
function describirLatido(lastHeartbeatAt: number, ahora: number): string {
  if (lastHeartbeatAt <= 0) return 'nunca se ha ejecutado';

  const segundos = Math.round((ahora - lastHeartbeatAt) / 1000);
  if (segundos < 5) return 'hace un instante';
  if (segundos < 120) return `hace ${segundos} s`;
  return `hace ${Math.round(segundos / 60)} min`;
}

export function formatDiagnostics(input: DiagnosticsInput): string {
  const lineas: string[] = [
    'NEUROpass · reporte de diagnóstico',
    '',
    `App          ${input.appVersion} (build ${input.buildNumber})`,
    `Dispositivo  ${input.manufacturer} ${input.model}`,
    `Android      ${input.osVersion} (API ${input.apiLevel})`,
    `Base datos   esquema v${input.schemaVersion}`,
    `Tema         ${input.darkTheme ? 'oscuro' : 'claro'}`,
    '',
    'Permisos',
  ];

  for (const [nombre, concedido] of Object.entries(input.permissions)) {
    lineas.push(`  ${nombre.padEnd(20)} ${si(concedido)}`);
  }

  lineas.push('', 'Guardián');
  if (!input.nativeModuleLoaded) {
    lineas.push('  módulo nativo no cargado (simulador)');
  } else if (!input.guard) {
    lineas.push('  sin estado disponible');
  } else {
    lineas.push(`  configurado         ${si(input.guard.enabled)}`);
    lineas.push(`  con vida            ${si(input.guard.alive)}`);
    lineas.push(`  último latido       ${describirLatido(input.guard.lastHeartbeatAt, input.generatedAt)}`);
  }

  lineas.push(
    '',
    'Otros',
    `  derivación nativa   ${si(input.kdfAccelerated)}`,
    `  modo adulto activo  ${si(input.parentPaused)}`,
    '',
    'Este reporte no incluye ningún dato del menor.',
  );

  return lineas.join('\n');
}
