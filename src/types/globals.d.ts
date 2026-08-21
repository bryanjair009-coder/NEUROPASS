/**
 * `__DEV__` lo inyecta el bundler de React Native, no el runtime de Node.
 * Se declara aquí porque el motor de ejercicios se compila para ambos
 * entornos y en los tests se consulta siempre con `typeof`.
 */
declare const __DEV__: boolean;
