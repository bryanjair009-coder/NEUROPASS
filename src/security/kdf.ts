import { fromHex, pbkdf2Sha256, toHex, utf8Bytes } from '@/lib/crypto/sha256';

/**
 * Derivación de clave del PIN, acelerada por la plataforma cuando se puede.
 *
 * El problema que resuelve, medido: 60 000 iteraciones de PBKDF2-HMAC-SHA256 en
 * JavaScript puro cuestan ~380 ms en un equipo de escritorio y bastante más de
 * un segundo en un teléfono de gama media con Hermes. Y son **síncronas**, así
 * que congelan el hilo de JS: el botón ni siquiera alcanza a pintar su estado
 * de carga antes del bloqueo. Para quien lo usa, es un botón que parece muerto
 * y de pronto salta.
 *
 * Android trae PBKDF2 en `SecretKeyFactory`, implementado en código nativo y,
 * al exponerse como `AsyncFunction`, ejecutado fuera del hilo de JS. El mismo
 * trabajo baja a decenas de milisegundos **y** la interfaz sigue respondiendo.
 *
 * ## Por qué se inyecta en vez de importarse
 *
 * Este módulo no importa el módulo nativo: lo recibe. Importarlo arrastraría
 * `expo` hasta `security/pin.ts`, que es lógica pura y tiene que poder
 * ejecutarse bajo Node en las pruebas. La app registra el acelerador al
 * arrancar; donde no lo haya —web, Expo Go, pruebas— se usa la implementación
 * en JavaScript, que es la verificada contra los vectores oficiales.
 *
 * ## Por qué hay una autocomprobación
 *
 * Cambiar de motor de derivación es peligroso: si el nativo produjera un byte
 * distinto, **todos los PIN ya configurados dejarían de verificar** y el tutor
 * quedaría fuera de su propio panel. Ambos implementan el mismo estándar
 * (RFC 2898) y deberían coincidir, pero "deberían" no basta cuando ese es el
 * coste del error. Por eso la primera vez se deriva un vector conocido con los
 * dos motores y se comparan; solo si coinciden byte a byte se usa el nativo.
 */

/** Deriva `keyBytes` y devuelve el resultado en hexadecimal. */
export type KdfAccelerator = (
  password: string,
  saltHex: string,
  iterations: number,
  keyBytes: number,
) => Promise<string>;

/** Entrada de la autocomprobación. Pocas iteraciones: solo compara motores. */
const VECTOR = {
  password: 'neuropass-autocomprobacion',
  saltHex: '000102030405060708090a0b0c0d0e0f',
  iterations: 1_000,
  keyBytes: 32,
} as const;

let acelerador: KdfAccelerator | null = null;
let compatible: Promise<boolean> | null = null;

/**
 * Registra la implementación de la plataforma. Pasar `null` vuelve a
 * JavaScript, que es lo que ocurre donde no hay módulo nativo.
 */
export function registerKdfAccelerator(fn: KdfAccelerator | null): void {
  acelerador = fn;
  compatible = null;
}

function derivarEnJs(pin: string, salt: Uint8Array, iterations: number, keyBytes: number): Uint8Array {
  return pbkdf2Sha256(utf8Bytes(pin), salt, iterations, keyBytes);
}

async function esCompatible(fn: KdfAccelerator): Promise<boolean> {
  try {
    const esperado = toHex(
      derivarEnJs(VECTOR.password, fromHex(VECTOR.saltHex), VECTOR.iterations, VECTOR.keyBytes),
    );
    const obtenido = await fn(VECTOR.password, VECTOR.saltHex, VECTOR.iterations, VECTOR.keyBytes);
    return obtenido.toLowerCase() === esperado;
  } catch {
    return false;
  }
}

/** Si la derivación está usando la implementación de la plataforma. */
export async function kdfIsAccelerated(): Promise<boolean> {
  const fn = acelerador;
  if (!fn) return false;

  compatible ??= esCompatible(fn);
  return compatible;
}

/**
 * Deriva `keyBytes` a partir del PIN. El resultado es idéntico con cualquiera
 * de los dos motores; solo cambia cuánto tarda y si bloquea el hilo.
 */
export async function deriveKey(
  pin: string,
  salt: Uint8Array,
  iterations: number,
  keyBytes: number,
): Promise<Uint8Array> {
  const fn = acelerador;

  if (fn && (await kdfIsAccelerated())) {
    return fromHex(await fn(pin, toHex(salt), iterations, keyBytes));
  }

  // Sin acelerador el bucle es síncrono y bloquea el hilo. Se cede un turno
  // antes de empezar para que React alcance a pintar el estado de carga del
  // botón: sin esto, quien pulsa no recibe ninguna señal hasta que termina, y
  // la app parece congelada en el peor momento posible.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return derivarEnJs(pin, salt, iterations, keyBytes);
}
