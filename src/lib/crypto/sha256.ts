/**
 * SHA-256, HMAC-SHA-256 y PBKDF2-HMAC-SHA-256 en TypeScript puro.
 *
 * ¿Por qué implementarlo en vez de usar `expo-crypto`? Porque `expo-crypto`
 * expone `digest()` como una llamada asíncrona al módulo nativo, y PBKDF2 con
 * decenas de miles de iteraciones supondría cruzar el puente JS↔nativo cientos
 * de miles de veces: en un dispositivo real eso tarda minutos. Una
 * implementación síncrona en JS hace la derivación completa en el orden de
 * cientos de milisegundos.
 *
 * `expo-crypto` sí se usa para lo único que no puede hacerse en JS de forma
 * segura: obtener aleatoriedad criptográfica para las sales (ver security/pin.ts).
 *
 * La corrección está verificada contra los vectores de prueba de FIPS 180-4,
 * RFC 4231 y RFC 7914 en tests/crypto.test.ts. No modificar sin ejecutarlos.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const BLOCK_BYTES = 64;
const DIGEST_BYTES = 32;

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

export function sha256(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  const paddedLength = Math.ceil((message.length + 9) / BLOCK_BYTES) * BLOCK_BYTES;

  const buffer = new Uint8Array(paddedLength);
  buffer.set(message);
  buffer[message.length] = 0x80;

  const view = new DataView(buffer.buffer);
  // La longitud es de 64 bits big-endian. JS no maneja enteros de 64 bits en
  // bitwise, así que se parte en dos palabras de 32.
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const h = INITIAL_STATE.slice();
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += BLOCK_BYTES) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);

    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15] as number;
      const y = w[i - 2] as number;
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) | 0;
    }

    let a = h[0] as number;
    let b = h[1] as number;
    let c = h[2] as number;
    let d = h[3] as number;
    let e = h[4] as number;
    let f = h[5] as number;
    let g = h[6] as number;
    let acc = h[7] as number;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (acc + s1 + ch + (K[i] as number) + (w[i] as number)) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      acc = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h[0] = ((h[0] as number) + a) | 0;
    h[1] = ((h[1] as number) + b) | 0;
    h[2] = ((h[2] as number) + c) | 0;
    h[3] = ((h[3] as number) + d) | 0;
    h[4] = ((h[4] as number) + e) | 0;
    h[5] = ((h[5] as number) + f) | 0;
    h[6] = ((h[6] as number) + g) | 0;
    h[7] = ((h[7] as number) + acc) | 0;
  }

  const digest = new Uint8Array(DIGEST_BYTES);
  const digestView = new DataView(digest.buffer);
  for (let i = 0; i < 8; i += 1) digestView.setUint32(i * 4, h[i] as number, false);
  return digest;
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  // RFC 2104: las claves más largas que el bloque se reducen con el hash.
  const normalizedKey = key.length > BLOCK_BYTES ? sha256(key) : key;

  const inner = new Uint8Array(BLOCK_BYTES);
  const outer = new Uint8Array(BLOCK_BYTES);
  inner.set(normalizedKey);
  outer.set(normalizedKey);

  for (let i = 0; i < BLOCK_BYTES; i += 1) {
    const byte = inner[i] as number;
    inner[i] = byte ^ 0x36;
    outer[i] = byte ^ 0x5c;
  }

  const innerMessage = new Uint8Array(BLOCK_BYTES + message.length);
  innerMessage.set(inner);
  innerMessage.set(message, BLOCK_BYTES);

  const innerDigest = sha256(innerMessage);

  const outerMessage = new Uint8Array(BLOCK_BYTES + DIGEST_BYTES);
  outerMessage.set(outer);
  outerMessage.set(innerDigest, BLOCK_BYTES);

  return sha256(outerMessage);
}

/** PBKDF2-HMAC-SHA-256 (RFC 8018). */
export function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyLength: number,
): Uint8Array {
  if (iterations < 1) throw new RangeError('iterations debe ser ≥ 1');
  if (keyLength < 1) throw new RangeError('keyLength debe ser ≥ 1');

  const blocks = Math.ceil(keyLength / DIGEST_BYTES);
  const output = new Uint8Array(blocks * DIGEST_BYTES);

  const saltWithIndex = new Uint8Array(salt.length + 4);
  saltWithIndex.set(salt);
  const indexView = new DataView(saltWithIndex.buffer, salt.length, 4);

  for (let block = 1; block <= blocks; block += 1) {
    indexView.setUint32(0, block, false);

    let u = hmacSha256(password, saltWithIndex);
    const accumulated = u.slice();

    for (let iteration = 1; iteration < iterations; iteration += 1) {
      u = hmacSha256(password, u);
      for (let i = 0; i < DIGEST_BYTES; i += 1) {
        accumulated[i] = (accumulated[i] as number) ^ (u[i] as number);
      }
    }

    output.set(accumulated, (block - 1) * DIGEST_BYTES);
  }

  return output.slice(0, keyLength);
}

// ---------------------------------------------------------------------------
// Utilidades de codificación
// ---------------------------------------------------------------------------

export function utf8Bytes(text: string): Uint8Array {
  // `TextEncoder` existe en Hermes y en Node; el respaldo manual cubre runtimes
  // antiguos sin arrastrar una dependencia.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);

  const bytes: number[] = [];
  for (const char of text) {
    let code = char.codePointAt(0) as number;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
    code = 0;
  }
  return Uint8Array.from(bytes);
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new RangeError('Cadena hexadecimal de longitud impar');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new RangeError('Cadena hexadecimal inválida');
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Comparación en tiempo constante.
 *
 * Un `===` sobre las cadenas cortocircuita en el primer byte distinto y filtra
 * cuántos bytes iniciales acertó el atacante. Con un PIN de 6 dígitos —espacio
 * de solo un millón— ese canal lateral importa, así que siempre se recorren
 * los dos búferes completos.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // La longitud sí puede compararse directo: no es secreta.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}
