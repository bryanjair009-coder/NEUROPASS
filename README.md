# NEUROpass

Control parental que convierte el tiempo de pantalla en una recompensa por el
esfuerzo cognitivo. El menor resuelve una sesión corta de retos —matemáticas,
lógica, memoria, lenguaje y creatividad, ajustados a su rango de edad— y con
ello desbloquea minutos de ocio en las apps que la madre, el padre o el tutor
haya limitado.

**Estado:** núcleo completo y verificado. El módulo nativo de Android está
escrito y listo para compilar; el de iOS está escrito y requiere macOS más el
entitlement de Apple. Ver [Qué falta](#qué-falta).

---

## Puesta en marcha

```bash
npm install
```

El bloqueo real de aplicaciones necesita código nativo, así que **no funciona en
Expo Go**. Hay dos formas de ejecutar el proyecto:

**Con bloqueo real (requiere Android Studio y JDK 17):**

```bash
npx expo run:android
```

**Sin bloqueo, para trabajar en la interfaz y el motor:**

```bash
npx expo start
```

Sin el módulo nativo la app arranca igual y usa un adaptador simulado. Lo avisa
con un aviso visible en pantalla; nunca finge estar bloqueando algo.

### Comprobaciones

```bash
npm test
```

```bash
npm run typecheck
```

481 pruebas cubren el motor de ejercicios, la economía de tiempo, la
criptografía del PIN y los horarios protegidos.

---

## Cómo está organizado

```
app/                        Rutas (expo-router)
  (child)/                  Zona del menor: hub, sesión, resultado
  (parent)/                 Zona del tutor: PIN, panel, apps, horarios, ajustes
src/
  domain/                   Tipos y reglas puras, sin plataforma
  engine/                   Motor de ejercicios, maestría, economía
    generators/             Un archivo por pilar cognitivo
  data/                     SQLite: migraciones y repositorios
  security/                 PIN, derivación de clave, bloqueo por intentos
  screentime/               Fachada del puente nativo + simulador
  state/                    Estado global y máquina de la sesión
  ui/                       Sistema de diseño y componentes
  lib/crypto/               SHA-256, HMAC y PBKDF2 en TypeScript puro
modules/neuropass-screentime/
  android/                  Kotlin: UsageStats, overlay, Device Admin
  ios/                      Swift: FamilyControls, ManagedSettings
tests/                      Pruebas del núcleo
docs/                       Permisos, privacidad y guía de iOS
```

La dirección de las dependencias es estricta: `domain` no importa nada, `engine`
importa `domain`, `data` importa ambos, y `app` importa de todos. Nada de
`src/engine` o `src/domain` toca React ni React Native, que es lo que permite
probarlo bajo Node directamente.

---

## Decisiones que conviene conocer antes de tocar el código

### El motor de ejercicios es procedural, no un banco de preguntas

Las 100 preguntas escritas a mano del banco original se conservan, pero como
complemento. El grueso lo generan 38 generadores deterministas que producen un
espacio de retos prácticamente ilimitado. La razón es simple: un banco fijo de
100 preguntas se memoriza en unos días y el producto deja de funcionar.

Todo el motor es una función pura de su semilla. La misma semilla produce la
misma sesión, lo que permite reproducir en una prueba cualquier sesión que un
menor haya visto y auditar sin almacenar el contenido de cada reto.

Los distractores nunca son ruido: son errores que un menor comete de verdad
—fuera por uno, invertir la resta, confundir el orden de operaciones—, para que
equivocarse signifique algo diagnosticable.

### La dificultad se ajusta con Elo, por pilar

Cada menor tiene un rating por pilar. Tras cada intento se actualiza con el peso
que corresponde a la dificultad del reto, y la siguiente sesión elige retos con
una probabilidad de acierto objetivo del 75 %: dentro de la zona de dificultad
deseable, alta para sostener la motivación y baja para que haya aprendizaje.

El rating es relativo al rango de edad. Nunca se comparan menores entre sí, ni
siquiera dentro del dispositivo.

### La economía de tiempo está calibrada contra dos fallos opuestos

Si paga demasiado, el límite deja de existir. Si paga demasiado poco, el menor
abandona y el tutor desinstala. Las reglas:

- Solo el acierto paga; el error da cero pero **nunca resta**. Restar empujaría
  al menor a evitar los retos difíciles, justo lo contrario del objetivo.
- La dificultad paga más, o la estrategia óptima sería encadenar retos triviales.
- Rendimientos decrecientes a partir de la cuarta sesión del día, más un tope
  duro que fija el tutor.
- El día contable empieza a las 4:00, no a medianoche: la madrugada cuenta al
  día anterior, que es como lo entiende una familia.

### Los horarios protegidos ganan siempre al tiempo ganado

Dentro de una franja marcada —escuela, hora de dormir— las apps limitadas quedan
bloqueadas aunque el menor tenga minutos disponibles. Sin esta precedencia,
resolver retos a las tres de la madrugada abriría el bloqueo nocturno y la app
pasaría de ser un control parental a un mecanismo para negociarlo.

Esta regla está implementada tres veces —TypeScript, Kotlin y Swift— porque no
hay forma de compartir código entre las tres plataformas.
`tests/schedule.test.ts` es la especificación de referencia de las tres.

### El PIN se trata como una credencial de verdad

Nunca se almacena: solo un derivado PBKDF2-HMAC-SHA-256 con 60 000 iteraciones y
sal aleatoria, guardado en Keychain (iOS) o Keystore (Android). La comparación
es en tiempo constante y los intentos fallidos activan un bloqueo exponencial
persistente que sobrevive a reiniciar la app y detecta si se atrasa el reloj del
sistema.

La implementación criptográfica está en TypeScript puro —cruzar el puente nativo
60 000 veces tardaría minutos— y verificada contra los vectores de FIPS 180-4,
RFC 4231 y RFC 7914 en `tests/crypto.test.ts`. **No modificar sin ejecutarlos.**

Un PIN de 6 dígitos tiene un espacio de 10⁶: ninguna función de derivación lo
vuelve inatacable. Lo que hace PBKDF2 es encarecer ese millón de intentos varios
órdenes de magnitud. La defensa real contra el ataque que de verdad ocurre —un
menor probando combinaciones— es el bloqueo exponencial.

### Android e iOS son estructuralmente distintos y el código lo refleja

| | Android | iOS |
|---|---|---|
| Ver apps instaladas | Sí (`QUERY_ALL_PACKAGES`) | **Nunca**, por diseño de Apple |
| Elegir qué limitar | Lista propia de paquetes | Selector del sistema, tokens opacos |
| Aplicar el bloqueo | Overlay propio desde un servicio | El sistema muestra su escudo |
| Leer uso por app | Sí (`UsageStatsManager`) | No, solo umbrales agregados |
| Naturaleza | Reactiva: detectar y responder | Declarativa: declarar y delegar |

El contrato del puente expone esa diferencia con `selectionMode` y `usageMode`
en lugar de esconderla. Fingir que son lo mismo llevaría a una pantalla de iOS
con una lista de apps siempre vacía.

### Privacidad por diseño, no por promesa

No existe columna alguna para fecha de nacimiento, correo, teléfono, escuela,
ubicación ni identificador de dispositivo. Del menor se guarda un alias que
escribe el tutor, un emoji y el rango de edad.

De cada intento se guarda el resultado —pilar, dificultad, acierto, tiempo,
huella— pero **nunca el enunciado ni la opción elegida**. Las respuestas escritas
de los retos de creatividad viven en su propia tabla, para poder borrarlas en
bloque sin tocar el progreso y para que sea evidente dónde están.

La app no hace ninguna petición de red. No hay servidor, no hay cuentas, no hay
analítica.

---

## Qué falta

Estas son las piezas que no se pueden completar sin hardware o aprobaciones
externas, y lo que exige cada una:

**Android — compilar y probar en dispositivo.** Requiere Android Studio con SDK
36 y JDK 17. El código Kotlin está completo (servicio guardián, overlay, Device
Admin, arranque tras reinicio) pero nunca se ha ejecutado en un teléfono real.
Lo que hay que verificar primero: la latencia del sondeo de `UsageStatsManager`
en distintas capas de fabricante, y si el servicio sobrevive sin la exención de
optimización de batería.

**iOS — entitlement de Apple.** `com.apple.developer.family-controls` es
restringido: hay que solicitarlo a Apple justificando que la app es
estrictamente de control parental, y el trámite tarda semanas. Sin él, el módulo
compila pero `requestAuthorization` falla en ejecución. Además hace falta macOS.
Ver [`docs/IOS_FAMILY_CONTROLS.md`](docs/IOS_FAMILY_CONTROLS.md).

**iOS — extensión `DeviceActivityMonitor`.** Para que el escudo se restablezca
solo al expirar el tiempo, en lugar de al abrir la app. Es un target adicional
del proyecto de Xcode, no algo que pueda vivir en un módulo local de Expo.

**Sincronización opcional con Supabase.** Decidida en el diseño (solo pareo
padre↔hijo con identificadores anónimos y métricas agregadas) pero no
implementada: la app es local-first y funciona completa sin ella.

**Fichas de tienda.** El texto justificativo de cada permiso está en
[`docs/PERMISOS.md`](docs/PERMISOS.md), listo para copiarse a la consola de
Google Play y a App Store Connect.

---

## Documentación

- [`docs/PERMISOS.md`](docs/PERMISOS.md) — cada permiso, por qué se pide y el
  texto para la revisión de las tiendas.
- [`docs/PRIVACIDAD.md`](docs/PRIVACIDAD.md) — inventario exacto de datos y
  cumplimiento COPPA / GDPR-K.
- [`docs/IOS_FAMILY_CONTROLS.md`](docs/IOS_FAMILY_CONTROLS.md) — trámite del
  entitlement y pasos de configuración en Xcode.
