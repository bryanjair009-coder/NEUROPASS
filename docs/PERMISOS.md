# Permisos y revisión en las tiendas

NEUROpass solicita tres permisos que las dos tiendas examinan con lupa. Este
documento explica por qué se piden, qué se hace exactamente con cada uno y qué
alternativa se descartó. Los bloques marcados **[TEXTO PARA LA CONSOLA]** están
redactados para copiarse tal cual al formulario de declaración correspondiente.

Un principio recorre todo el documento: la app pide el mínimo necesario para
funcionar y ni un permiso más. Cada solicitud extra es un motivo de rechazo y un
aumento del alcance de la app sobre un dispositivo familiar.

---

## Android

### `PACKAGE_USAGE_STATS` — acceso al uso de aplicaciones

**Qué hace la app con él.** Consulta `UsageStatsManager` para saber qué
aplicación está en primer plano y decidir si corresponde bloquearla. También
alimenta el resumen de uso por app que ve el tutor en el panel.

**Por qué es imprescindible.** Sin él no hay forma de detectar que el menor
abrió una app restringida, y el producto entero deja de existir.

**Qué NO se hace.** No se lee ningún contenido de las apps, ni notificaciones,
ni actividad dentro de ellas. Solo el nombre del paquete en primer plano y la
duración agregada. Nada de esto sale del dispositivo.

**Alternativa descartada.** `AccessibilityService` notifica los cambios de app
sin sondeo y con menos latencia, pero la política de Google Play restringe
severamente su uso y emplearlo para control parental es una vía rápida a la
suspensión de la cuenta de desarrollador. Se prefirió el sondeo, que es la ruta
soportada, asumiendo el coste en latencia y batería.

> **[TEXTO PARA LA CONSOLA]**
> NEUROpass es una aplicación de control parental de la categoría Familias. Usa
> el acceso a estadísticas de uso exclusivamente para identificar qué aplicación
> está en primer plano y aplicar los límites de tiempo que la madre, el padre o
> el tutor ha configurado en el dispositivo del menor. Los datos se procesan
> localmente en el dispositivo y no se transmiten a ningún servidor. La
> aplicación no realiza peticiones de red.

### `SYSTEM_ALERT_WINDOW` — mostrarse sobre otras aplicaciones

**Qué hace la app con él.** Dibuja la pantalla de bloqueo cuando el menor abre
una app restringida sin tiempo disponible. Esa pantalla explica por qué aparece
y ofrece dos botones: resolver retos, o ir al inicio.

**Por qué es imprescindible.** Android no permite a una app de terceros cerrar
procesos ajenos. La superposición es el único mecanismo soportado para
interponerse entre el menor y la app restringida.

**Qué NO se hace.** La superposición **no secuestra el dispositivo**: no captura
el botón de inicio, no bloquea las teclas del sistema, no se dibuja sobre
diálogos de permisos ni sobre pantallas de ajustes, y siempre incluye una salida
visible. Tampoco se muestra durante llamadas ni sobre aplicaciones no
restringidas.

**Dónde mirarlo en el código.** `BlockOverlay.kt`. Se usa `FLAG_NOT_TOUCH_MODAL`
y deliberadamente ninguna bandera que interfiera con la navegación del sistema.

> **[TEXTO PARA LA CONSOLA]**
> El permiso de superposición se utiliza únicamente para mostrar una pantalla
> informativa cuando el menor abre una aplicación restringida fuera del tiempo
> permitido. La pantalla indica el motivo del bloqueo y ofrece siempre la opción
> de volver al inicio; no impide el acceso a los ajustes del sistema, a las
> llamadas ni a la navegación del dispositivo. Solo aparece sobre las
> aplicaciones que la madre, el padre o el tutor ha seleccionado expresamente.

### `FOREGROUND_SERVICE_SPECIAL_USE` — servicio en primer plano

**Qué hace la app con él.** Mantiene vivo el servicio guardián que sondea la app
en primer plano y aplica la política.

**Subtipo declarado.** «Supervisión parental del tiempo de pantalla configurada
por la madre, el padre o el tutor del menor.» (Declarado en
`AndroidManifest.xml` mediante `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`, obligatorio
desde Android 14.)

**Por qué `specialUse` y no otro tipo.** Ninguno de los tipos predefinidos
—`dataSync`, `mediaPlayback`, `location`— describe esta función. Declarar un
tipo que no corresponde es motivo de rechazo.

**Notificación.** Es silenciosa (`IMPORTANCE_LOW`), permanente y sin insignia.
Además de cumplir el requisito de Android, sirve para que la familia sepa de un
vistazo que la supervisión sigue activa.

### `QUERY_ALL_PACKAGES` — enumerar aplicaciones instaladas

**Qué hace la app con él.** Muestra al tutor la lista de aplicaciones lanzables
para que elija cuáles limitar.

**Por qué no basta con `<queries>`.** El elemento `<queries>` del manifiesto
exige conocer de antemano los paquetes concretos. Aquí el tutor debe poder
elegir cualquier app de ocio instalada, que por definición no se conoce de
antemano.

**Filtrado aplicado.** Solo se listan aplicaciones con actividad de lanzador. Las
apps de sistema se ocultan por omisión y, al mostrarlas, la interfaz advierte
que bloquear el teléfono o los mensajes puede impedir que el menor contacte a
alguien en una urgencia.

> **[TEXTO PARA LA CONSOLA]**
> La aplicación necesita enumerar las aplicaciones instaladas para que la madre,
> el padre o el tutor pueda seleccionar cuáles quedan sujetas a límite de
> tiempo. La lista se muestra únicamente dentro del panel protegido por PIN y no
> se transmite fuera del dispositivo.

### Device Admin — protección antidesinstalación

**Qué hace la app con él.** Mientras el receptor está activo como administrador
de dispositivo, Android impide desinstalar NEUROpass desde el lanzador o los
ajustes.

**Política solicitada.** Solo `watch-login`. Es la mínima que Android admite: no
se pide borrado remoto, ni cifrado forzoso, ni control de contraseñas, ni
deshabilitar la cámara. El objetivo no es administrar el dispositivo, sino
existir como administrador, que es la condición que Android exige para blindar
la desinstalación.

**Es opcional y reversible.** El tutor lo activa y lo desactiva desde el panel,
tras el PIN. La interfaz advierte que hay que desactivarlo antes de desinstalar
la app.

### `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`

Se declara pero **no se solicita mediante diálogo directo**: la app abre la lista
de ajustes de batería (`ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`) y explica
por qué conviene la exención. Invocar
`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` sin cumplir los supuestos de la
política de Google Play es motivo de rechazo.

Sin la exención, la mayoría de capas de fabricante terminan matando el servicio
guardián y el control deja de aplicarse **en silencio**. Es la causa número uno
de «la app dejó de funcionar sola», así que el estado se reporta en el panel
para poder avisar al tutor en lugar de fallar sin ruido.

### Ficha de Google Play

- **Categoría:** Familias → Control parental.
- **Programa de familias:** requiere completar el cuestionario de contenido y
  declarar el público objetivo.
- **Sección de seguridad de los datos:** declarar **ninguna recopilación** y
  **ninguna transmisión**. La app no realiza peticiones de red, lo cual es
  verificable.

---

## iOS

### `com.apple.developer.family-controls`

Es un **entitlement restringido**: no basta con declararlo, hay que solicitarlo a
Apple desde el portal de desarrollador justificando que la app es estrictamente
de control parental. El trámite tarda semanas. Sin él, la app compila pero
`AuthorizationCenter.requestAuthorization` falla en tiempo de ejecución.

El procedimiento completo está en
[`IOS_FAMILY_CONTROLS.md`](IOS_FAMILY_CONTROLS.md).

### `NSFamilyControlsUsageDescription`

Texto que iOS muestra al pedir la autorización:

> NEUROpass necesita el permiso de Controles Familiares para aplicar y retirar
> los limites de tiempo de pantalla que configuras como madre, padre o tutor.

(Sin acentos a propósito: algunos generadores de `Info.plist` los manejan mal en
la cadena de propósito.)

### Qué NO puede hacer la app en iOS

Conviene tenerlo presente al preparar la ficha, porque afecta a las capturas y a
la descripción:

- No puede enumerar las aplicaciones instaladas.
- No puede leer el uso por aplicación.
- No puede dibujar una pantalla de bloqueo propia; el escudo lo muestra iOS.
- La selección de apps se hace en un selector del sistema y la app solo recibe
  tokens opacos.

### Directrices aplicables de la App Review

- **5.1.4 (Datos de menores):** la app no recopila datos de menores. Ver
  [`PRIVACIDAD.md`](PRIVACIDAD.md).
- **5.5 (Control parental):** el PIN nunca se transmite ni se almacena en claro.
- **Etiqueta de privacidad:** «No se recopilan datos». La app no tiene servidor,
  ni cuentas, ni SDK de terceros.

---

## Checklist antes de enviar a revisión

- [ ] Los textos justificativos de esta guía están copiados en ambas consolas.
- [ ] La sección de seguridad de datos declara **ninguna recopilación** en ambas
      tiendas.
- [ ] La ficha muestra capturas de la pantalla de bloqueo con su salida visible.
- [ ] La descripción explica el modelo (retos → minutos) sin prometer
      capacidades que iOS no permite.
- [ ] Entitlement de Family Controls aprobado por Apple.
- [ ] Un vídeo de demostración del flujo completo, adjunto a las notas de
      revisión: acelera notablemente la aprobación de una app que pide
      superposición y estadísticas de uso.
