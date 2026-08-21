# Privacidad y protección de datos

NEUROpass trata datos de menores de edad, así que la privacidad no es una
sección de la aplicación: es una restricción de diseño que condiciona el esquema
de la base de datos, la arquitectura y qué funcionalidades directamente no
existen.

Este documento es el inventario exacto de lo que se guarda. Está pensado para
tres lectores: quien revise la app en Apple o Google, quien tenga que responder
un formulario de cumplimiento, y quien vaya a modificar el esquema y necesite
saber qué no puede añadir.

---

## Resumen en una línea

Todo se guarda en el dispositivo. La aplicación no realiza ninguna petición de
red. No hay servidor, no hay cuentas y no hay SDK de terceros.

---

## Inventario de datos

### Lo que se guarda del menor

| Dato | Dónde | Por qué es necesario |
|---|---|---|
| Alias | `children.alias` | Distinguir perfiles cuando hay varios menores. Lo escribe el tutor; puede ser cualquier apodo. |
| Emoji de avatar | `children.avatar` | Identificación visual para quien aún no lee bien. |
| Rango de edad (`6-8`, `9-12`, `13-16`) | `children.band` | Es la granularidad mínima que el motor necesita para elegir retos apropiados. |
| Por cada intento: pilar, dificultad, resultado, tiempo empleado, si pidió pista, huella del reto | `attempts` | Ajustar la dificultad y no repetir retos recientes. |
| Rating de maestría por pilar | `mastery` | Modelo adaptativo. |
| Minutos ganados y sesiones por día | `daily_ledger` | Aplicar el tope diario. |
| Respuestas escritas de los retos de creatividad | `open_responses` | Que el tutor pueda leerlas. **Se pueden borrar por separado.** |

### Lo que NO se guarda, y no hay dónde guardarlo

El esquema no tiene columna alguna para nada de esto. No es una decisión de la
capa de aplicación que un cambio futuro pueda revertir por descuido: si alguien
quisiera añadirlo, tendría que crear la columna y escribir una migración.

- Fecha de nacimiento o edad exacta.
- Nombre completo, apellidos.
- Correo electrónico, teléfono.
- Escuela, grado escolar, curso.
- Ubicación, coordenadas, dirección.
- Identificadores de dispositivo, publicitarios o de instalación.
- Fotografías, audio o vídeo.
- Contactos, mensajes o contenido de otras aplicaciones.
- Historial de navegación.
- **El enunciado de los retos y la opción que eligió el menor.**

Este último punto merece una explicación, porque es el que más se suele pasar por
alto: guardar «pregunta X, respondió la opción B» construiría, sesión tras
sesión, un registro detallado de la actividad cognitiva de un menor. No hace
ninguna falta. Con la huella del reto basta para no repetirlo, y con el resultado
basta para el modelo de maestría. Si alguna vez hiciera falta reconstruir un reto
concreto, la semilla de la sesión lo permite sin duplicar el contenido.

### Lo que se guarda del tutor

| Dato | Dónde | Forma |
|---|---|---|
| PIN | Keychain (iOS) / Keystore (Android), vía `expo-secure-store` | Derivado PBKDF2-HMAC-SHA-256, 60 000 iteraciones, sal aleatoria de 16 bytes. **Nunca el PIN.** |
| Código de recuperación | Igual | Mismo tratamiento. Se muestra una única vez al configurarlo. |
| Contador de intentos fallidos | Igual | Enteros. |
| Acciones del tutor | `audit_log` | Qué se cambió y cuándo. Nunca registra actividad del menor. |

---

## Transmisión de datos

**Ninguna.** La aplicación no contiene código de red. Es verificable: no hay
llamadas a `fetch`, `XMLHttpRequest`, WebSocket ni cliente HTTP alguno en el
código de la aplicación.

No hay analítica, ni telemetría de fallos, ni publicidad, ni SDK de terceros con
capacidad de red.

---

## Derechos del usuario

Todos se ejercen desde la app, sin escribir a nadie y sin esperar:

| Derecho | Cómo | Dónde en el código |
|---|---|---|
| Acceso | El panel muestra todos los datos guardados. | `app/(parent)/dashboard.tsx`, `settings.tsx` |
| Portabilidad | «Copiar resumen de privacidad» genera un resumen textual. | `settings.tsx` |
| Rectificación | Alias, avatar y rango se editan en cualquier momento. | `settings.tsx` |
| Supresión parcial | «Borrar todas las respuestas» elimina el texto libre sin tocar el progreso. | `deleteOpenResponses` |
| Supresión total | «Borrar todos los datos» vacía la base, hace `VACUUM` y elimina el PIN. | `wipeAllData`, `clearPin` |

---

## Cumplimiento

### COPPA (Estados Unidos, menores de 13)

- **§312.4 (Aviso):** el panel incluye una explicación en lenguaje llano de qué
  se guarda, visible sin buscar, no enterrada en un enlace legal.
- **§312.5 (Consentimiento parental verificable):** la app se configura
  íntegramente desde el dispositivo, por la persona adulta que lo tiene en la
  mano y que establece el PIN. No se recopila información personal, por lo que
  el supuesto que exige consentimiento verificable no llega a activarse.
- **§312.7 (Prohibición de condicionar la participación):** no se pide ningún
  dato que no sea estrictamente necesario para la funcionalidad.
- **§312.8 (Confidencialidad y retención):** todo permanece en el dispositivo,
  bajo el cifrado del sistema operativo. La retención la controla el tutor y
  puede terminarla con una acción.

### GDPR-K (Unión Europea, artículo 8)

- **Base jurídica:** interés legítimo de quien ejerce la responsabilidad
  parental, ejercido en su propio dispositivo familiar.
- **Minimización (art. 5.1.c):** el rango de edad sustituye a la fecha de
  nacimiento; el resultado del intento sustituye al contenido.
- **Limitación del plazo (art. 5.1.e):** sin caducidad automática, pero con
  borrado inmediato y completo a un toque.
- **Seguridad (art. 32):** cifrado en reposo del sistema operativo, credenciales
  derivadas con PBKDF2, sin transmisión.
- **Derecho de supresión (art. 17):** una acción, sin residuos, con `VACUUM`
  para que el archivo devuelva las páginas borradas en lugar de conservarlas.

---

## Límites conocidos

Se documentan porque disimularlos sería peor que tenerlos.

**Borrar los datos de la app elimina también el PIN.** Ningún almacenamiento a
nivel de aplicación puede impedirlo en Android. Un menor que sepa dónde mirar
puede vaciar los datos desde los ajustes del sistema y dejar la app sin
configurar, lo que también desactiva el bloqueo. La defensa disponible es el
Device Admin, que impide la desinstalación; para impedir además el borrado de
datos hace falta configurar el dispositivo en modo Device Owner con un perfil
gestionado, que queda fuera del alcance de una app instalada desde la tienda.

**El alias es texto libre.** La app no puede impedir que alguien escriba ahí el
nombre completo del menor. Por eso el campo se trata siempre como si lo fuera:
nunca se sincroniza y nunca se exporta sin una acción explícita del tutor.

**Sin sincronización no hay panel remoto.** El tutor tiene que configurar la app
en el dispositivo del menor, físicamente. Es la contrapartida directa de no
tener servidor, y se consideró preferible a abrir un canal de datos sobre un
menor.
