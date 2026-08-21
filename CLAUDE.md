# NEUROpass — notas para trabajar en este repo

Control parental que condiciona el tiempo de pantalla a resolver retos
cognitivos. Expo SDK 57 + React Native 0.86, TypeScript estricto, local-first.

Lee el [README](README.md) para el contexto completo. Aquí solo está lo que hace
falta saber **antes de tocar código**.

## Comandos

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npx eslint .
```

Los tres tienen que pasar antes de dar algo por terminado. `npx expo export
--platform android` es la única forma de detectar errores de resolución de
módulos sin un dispositivo.

## Reglas del repo

**Idioma.** Todo en español: código, comentarios, nombres de dominio,
identificadores de la interfaz, mensajes de commit. Los tipos de TypeScript y las
APIs de plataforma se quedan en inglés porque no son nuestros.

**Los comentarios explican el porqué.** Si un comentario dice lo que el código ya
dice, sobra. Los que hay explican decisiones: por qué Elo y no una racha, por qué
sondeo y no `AccessibilityService`, por qué la resta se construye desde el
resultado.

**Nada de código muerto.** Sin `void x;` para callar al linter, sin exports que
nadie importa, sin props de estilo «por si acaso».

## Cosas que rompen si no se sabe

**La regla de precedencia de horarios está triplicada.** `domain/schedule.ts`
(TS), `PolicyEvaluator` (Kotlin) y `isWithinProtectedWindow` (Swift) implementan
lo mismo. Si cambia una, cambian las tres. `tests/schedule.test.ts` es la
especificación de referencia.

**`lib/crypto/sha256.ts` está verificado contra vectores oficiales.** No tocar
sin ejecutar `tests/crypto.test.ts`. Un error de un bit produciría hashes
autoconsistentes pero incompatibles con el resto del mundo.

**El motor es puro y determinista.** Nada en `src/engine` ni en `src/domain`
importa React, React Native ni expo-*. Es lo que permite ejecutarlo bajo Node en
las pruebas. Si un import rompe esa regla, el problema es el import.

**El esquema de la base es la frontera de privacidad.** No añadas columnas para
fecha de nacimiento, correo, ubicación, ni para el enunciado de un reto o la
opción elegida. Ver [`docs/PRIVACIDAD.md`](docs/PRIVACIDAD.md).

**`exactOptionalPropertyTypes` está activo.** Pasar `undefined` explícito no es
lo mismo que omitir la clave. Usa spread condicional:
`...(x ? { clave: x } : {})`.

**Los generadores tienen tests de propiedad.** Cualquier generador nuevo se
somete automáticamente a las invariantes de `tests/generators.test.ts`: sin
opciones duplicadas, respuesta correcta presente, y al menos 8 retos distintos
posibles por celda de rango y dificultad. Si un generador nuevo falla ahí, el
defecto es del generador.

**El panel del tutor está ordenado por urgencia.** Lo primero que se ve son los
permisos sin conceder, porque sin ellos la app no bloquea nada. No lo reordenes
por categorías temáticas.

## Estado

Núcleo completo, 481 pruebas en verde, el bundle de Android compila. Falta
compilar y probar el nativo en un dispositivo real, y el entitlement de Apple.
La lista exacta está en la sección «Qué falta» del README.
