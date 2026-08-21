import { describe, expect, it } from 'vitest';

import {
  fromHex,
  hmacSha256,
  pbkdf2Sha256,
  sha256,
  timingSafeEqual,
  toHex,
  utf8Bytes,
} from '@/lib/crypto/sha256';

/**
 * Vectores de prueba oficiales. Una implementación criptográfica escrita a
 * mano solo es defendible si se verifica contra los vectores publicados: sin
 * esto, un error de un bit produciría hashes consistentes consigo mismos pero
 * incompatibles con el resto del mundo, y el fallo pasaría inadvertido hasta
 * que alguien intentara auditarlo.
 */

const hash = (text: string): string => toHex(sha256(utf8Bytes(text)));

describe('SHA-256 (FIPS 180-4)', () => {
  it('cadena vacía', () => {
    expect(hash('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('"abc"', () => {
    expect(hash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('mensaje de 448 bits (dos bloques)', () => {
    expect(hash('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('un millón de "a"', () => {
    expect(hash('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('longitudes en la frontera del relleno', () => {
    // 55, 56 y 64 bytes son los casos donde el relleno cambia de bloque.
    expect(hash('a'.repeat(55))).toBe('9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318');
    expect(hash('a'.repeat(56))).toBe('b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a');
    expect(hash('a'.repeat(64))).toBe('ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb');
  });
});

describe('HMAC-SHA-256 (RFC 4231)', () => {
  it('caso 1: clave de 20 bytes 0x0b', () => {
    const key = new Uint8Array(20).fill(0x0b);
    const mac = hmacSha256(key, utf8Bytes('Hi There'));
    expect(toHex(mac)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });

  it('caso 2: clave "Jefe"', () => {
    const mac = hmacSha256(utf8Bytes('Jefe'), utf8Bytes('what do ya want for nothing?'));
    expect(toHex(mac)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('caso 6: clave de 131 bytes, más larga que el bloque', () => {
    const key = new Uint8Array(131).fill(0xaa);
    const message = utf8Bytes('Test Using Larger Than Block-Size Key - Hash Key First');
    expect(toHex(hmacSha256(key, message))).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    );
  });
});

describe('PBKDF2-HMAC-SHA-256 (RFC 7914 §11)', () => {
  const derive = (password: string, salt: string, iterations: number, length: number): string =>
    toHex(pbkdf2Sha256(utf8Bytes(password), utf8Bytes(salt), iterations, length));

  it('1 iteración', () => {
    expect(derive('password', 'salt', 1, 32)).toBe(
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
    );
  });

  it('2 iteraciones', () => {
    expect(derive('password', 'salt', 2, 32)).toBe(
      'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43',
    );
  });

  it('4096 iteraciones', () => {
    expect(derive('password', 'salt', 4096, 32)).toBe(
      'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a',
    );
  });

  it('salida de varios bloques', () => {
    expect(
      derive('passwordPASSWORDpassword', 'saltSALTsaltSALTsaltSALTsaltSALTsalt', 4096, 40),
    ).toBe('348c89dbcbd32b2f32d814b8116e84cf2b17347ebc1800181c4e2a1fb8dd53e1c635518c7dac47e9');
  });

  it('rechaza parámetros inválidos', () => {
    expect(() => pbkdf2Sha256(utf8Bytes('a'), utf8Bytes('b'), 0, 32)).toThrow(RangeError);
    expect(() => pbkdf2Sha256(utf8Bytes('a'), utf8Bytes('b'), 1, 0)).toThrow(RangeError);
  });
});

describe('utilidades', () => {
  it('hex ida y vuelta', () => {
    const bytes = Uint8Array.from([0, 1, 15, 16, 127, 128, 255]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it('rechaza hexadecimal malformado', () => {
    expect(() => fromHex('abc')).toThrow(RangeError);
    expect(() => fromHex('zz')).toThrow(RangeError);
  });

  it('codifica UTF-8 multibyte', () => {
    expect(toHex(utf8Bytes('ñ'))).toBe('c3b1');
    expect(toHex(utf8Bytes('€'))).toBe('e282ac');
    expect(toHex(utf8Bytes('🧠'))).toBe('f09fa7a0');
  });

  it('la comparación en tiempo constante distingue contenido y longitud', () => {
    const a = Uint8Array.from([1, 2, 3]);
    expect(timingSafeEqual(a, Uint8Array.from([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(a, Uint8Array.from([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(a, Uint8Array.from([1, 2]))).toBe(false);
  });
});
