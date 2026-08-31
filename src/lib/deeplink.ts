import type { Href } from 'expo-router';

/**
 * Enlace profundo a la sesión de retos.
 *
 * Vive aquí, en un módulo sin dependencias de plataforma, por dos motivos:
 *
 *  - Es la única cadena de la app que solo se ejercita con un teléfono en la
 *    mano y una aplicación bloqueada delante. No hay pantalla que la recorra
 *    durante el desarrollo, así que necesita quedar cubierta por pruebas, y
 *    para eso tiene que poder importarse bajo Node.
 *  - El mismo valor se replica en Kotlin y en Swift como respaldo. Teniendo un
 *    origen único en TypeScript, las copias nativas se pueden contrastar.
 *
 * El `import type` se borra al compilar: este módulo no arrastra expo-router al
 * paquete, solo toma prestado su tipo de rutas.
 */

/** Esquema de enlaces de la app. Debe coincidir con `expo.scheme` de app.json. */
export const APP_SCHEME = 'neuropass';

/**
 * Ruta de la pantalla de sesión, tal como la resuelve expo-router.
 *
 * Cuidado con los paréntesis: `app/(child)/session.tsx` se sirve en `/session`,
 * **no** en `/child/session`. Los grupos entre paréntesis organizan archivos y
 * comparten layout, pero no aparecen en la URL. Escribir la ruta con el grupo
 * incluido generaba un enlace que no resolvía, y el menor terminaba en la
 * pantalla de "Unmatched Route" al tocar el botón de la pantalla de bloqueo.
 *
 * La anotación `satisfies Href` hace que mover o renombrar la pantalla rompa la
 * compilación, en vez de dejar un enlace muerto que solo se descubre en un
 * dispositivo real.
 */
export const CHALLENGE_ROUTE = '/session' satisfies Href;

/** Enlace completo que recibe la pantalla de bloqueo nativa. */
export const CHALLENGE_DEEP_LINK = `${APP_SCHEME}:/${CHALLENGE_ROUTE}`;
