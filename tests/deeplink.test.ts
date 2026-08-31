import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_SCHEME, CHALLENGE_DEEP_LINK, CHALLENGE_ROUTE } from '@/lib/deeplink';

/**
 * El enlace del botón "Resolver retos" de la pantalla de bloqueo.
 *
 * Este enlace tiene una propiedad incómoda: es el único punto de la app donde
 * un error no se manifiesta hasta que alguien lo toca en un teléfono real, con
 * una app bloqueada delante. No hay pantalla que lo ejercite en desarrollo, no
 * hay tipo que lo valide en tiempo de ejecución, y el valor está escrito por
 * duplicado en TypeScript y en Kotlin.
 *
 * Ya falló una vez: el enlace apuntaba a `neuropass://child/session` porque el
 * archivo vive en `app/(child)/session.tsx`, pero los grupos entre paréntesis
 * de expo-router no forman parte de la URL. El resultado era que el menor
 * llegaba a "Unmatched Route" en lugar de a los ejercicios.
 *
 * Estas pruebas cubren las tres formas en que puede volver a romperse.
 */

const REPO_ROOT = join(__dirname, '..');

describe('enlace profundo a la sesión de retos', () => {
  it('apunta a una pantalla que existe', () => {
    // La ruta se traduce a un archivo dentro de app/, posiblemente bajo un
    // grupo entre paréntesis, que no aparece en la URL.
    const nombre = CHALLENGE_ROUTE.replace(/^\//, '');
    const candidatos = [
      join(REPO_ROOT, 'app', `${nombre}.tsx`),
      join(REPO_ROOT, 'app', '(child)', `${nombre}.tsx`),
      join(REPO_ROOT, 'app', '(parent)', `${nombre}.tsx`),
    ];

    expect(
      candidatos.some((ruta) => existsSync(ruta)),
      `Ninguna pantalla corresponde a "${CHALLENGE_ROUTE}". Buscado en:\n${candidatos.join('\n')}`,
    ).toBe(true);
  });

  it('no incluye el grupo entre paréntesis en la URL', () => {
    // `(child)` organiza archivos y comparte layout; nunca es parte de la ruta.
    expect(CHALLENGE_DEEP_LINK).not.toMatch(/\/(child|parent)\//);
  });

  it('usa el esquema declarado en app.json', () => {
    const appConfig = JSON.parse(readFileSync(join(REPO_ROOT, 'app.json'), 'utf8'));
    expect(APP_SCHEME).toBe(appConfig.expo.scheme);
    expect(CHALLENGE_DEEP_LINK.startsWith(`${APP_SCHEME}://`)).toBe(true);
  });

  it('coincide con el valor por omisión que lleva el módulo de Android', () => {
    // El guardián puede arrancar antes de que exista una política guardada, y
    // en ese caso usa su propia constante. Si las dos se separan, el fallo solo
    // aparece en ese arranque en frío, que es el más difícil de reproducir.
    const policyKt = readFileSync(
      join(
        REPO_ROOT,
        'modules/neuropass-screentime/android/src/main/java/com/neuropass/screentime/Policy.kt',
      ),
      'utf8',
    );

    const encontrado = policyKt.match(/challengeDeepLink = "([^"]+)"/);
    expect(encontrado?.[1], 'No se localizó el enlace por omisión en Policy.kt').toBeDefined();
    expect(encontrado?.[1]).toBe(CHALLENGE_DEEP_LINK);
  });
});
