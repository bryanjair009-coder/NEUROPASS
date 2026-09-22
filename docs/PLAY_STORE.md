# Publicación en Google Play

Todo lo que hay que hacer, en orden, y los textos exactos que pide cada
formulario. Lo que está entre `⟨corchetes⟩` es lo único que hay que completar a
mano.

El riesgo de esta app no es técnico: es de políticas. Pide tres permisos que
Google revisa persona a persona y entra en la categoría Familias, que tiene
reglas propias. Este documento está escrito para que la revisión encuentre
respondida cada pregunta antes de hacerla.

---

## 1. Cuenta de desarrollador

- **Pago único de 25 USD** y verificación de identidad.
- **Cuenta personal o de empresa.** La personal se abre en un día; la de empresa
  exige un número D-U-N-S, que es gratuito pero tarda semanas.
- **Prueba cerrada obligatoria.** Las cuentas personales creadas desde finales de
  2023 tienen que correr una prueba cerrada con **al menos 12 probadores
  durante 14 días seguidos** antes de poder publicar en producción. Conviene
  empezarla cuanto antes: es el camino crítico.
- **Perfil de pagos y datos fiscales.** Solo hace falta cuando se cobre; para
  publicar gratis no se necesita.

---

## 2. Compilar el paquete de tienda

Google Play no acepta APK para apps nuevas: hay que subir un **AAB**.

```bash
npx eas-cli@22 build --platform android --profile production
```

- El perfil `production` de `eas.json` ya genera `app-bundle` y sube el
  `versionCode` solo en cada compilación.
- La firma la administra EAS con la clave de subida, y Google vuelve a firmar
  con Play App Signing. No hay que generar ningún keystore a mano.
- Cada envío necesita un `versionCode` mayor que el anterior. Los APK de prueba
  ya gastaron hasta el 12.

---

## 3. Ficha de la tienda

**Nombre de la app** (máx. 30)

```
NEUROpass: control parental
```

**Descripción corta** (máx. 80)

```
El tiempo de pantalla se gana resolviendo retos de lógica, memoria y más.
```

**Descripción completa** (máx. 4000)

```
NEUROpass convierte el tiempo de pantalla en algo que se gana.

En lugar de apagar el teléfono a una hora fija, el menor resuelve una sesión
corta de retos y desbloquea minutos de juego. Los retos se ajustan solos a su
nivel: si algo le cuesta, aparece más seguido; si lo domina, sube la dificultad.

CÓMO FUNCIONA

1. Tú eliges qué aplicaciones se limitan y en qué horarios.
2. Cuando el menor quiere usarlas y no tiene tiempo, NEUROpass le propone una
   sesión de retos.
3. Cada acierto suma minutos, hasta el tope diario que tú definas.

CINCO ÁREAS, MÁS INGLÉS

Matemáticas, creatividad, memoria, lógica y lenguaje, con retos adaptados a tres
rangos de edad: 6 a 8, 9 a 12 y 13 a 16 años. Incluye retos de inglés con
vocabulario, gramática y lecturas cortas, que puedes desactivar cuando quieras.

Los retos se generan en el teléfono, así que no se acaban ni se repiten a los
pocos días.

PARA MADRES, PADRES Y TUTORES

- Panel protegido con PIN.
- Horarios protegidos que ganan siempre al tiempo ganado: a la hora de dormir no
  hay retos que valgan.
- Modo adulto: si necesitas tu teléfono, congelas el tiempo del menor y se lo
  devuelves después sin que pierda un minuto.
- Puedes dar o cortar tiempo al instante.
- Progreso por área, sin notas ni comparaciones.

PRIVACIDAD

NEUROpass funciona sin internet y no tiene servidor ni cuentas. Todo se guarda
en el teléfono. Del menor solo se almacena el apodo que tú escribas, un emoji,
el rango de edad y el resultado de cada reto: nunca el enunciado ni la opción
que eligió. No hay publicidad ni analítica de terceros.
```

**Categoría:** Educación.
**Etiquetas:** control parental, tiempo de pantalla, educación infantil.
**Correo de contacto:** `⟨tu correo⟩`.
**Política de privacidad:** la URL del paso 4.

### Recursos gráficos

| Recurso | Tamaño | Notas |
|---|---|---|
| Icono | 512 × 512 PNG | Ya está en `assets/icon.png`. |
| Gráfico destacado | 1024 × 500 PNG | Obligatorio. AXO sobre el lienzo morado y el nombre. |
| Capturas de teléfono | mín. 2, recomendado 6 | 1080 × 1920. |

Capturas sugeridas, en este orden: inicio del menor con la tarjeta de tiempo,
sesión con un reto y las respuestas de colores, pantalla de recompensa, panel
del tutor, horarios protegidos y ajustes con los retos de inglés.

**Importante:** las capturas tienen que ser de la app real y de esta versión.
Las de las versiones anteriores al rediseño ya no sirven.

---

## 4. Política de privacidad pública

Google exige una URL abierta, sin inicio de sesión. El archivo
[`docs/privacidad.html`](privacidad.html) está listo para publicarse tal cual.

Con GitHub Pages, que es gratis y usa el repositorio que ya existe:

1. En GitHub: **Settings → Pages**.
2. **Source:** Deploy from a branch. **Branch:** `main`, carpeta `/docs`.
3. Guardar y esperar un par de minutos.
4. La URL queda así:
   `https://bryanjair009-coder.github.io/NEUROPASS/privacidad.html`

Antes de publicarla hay que sustituir `⟨tu correo⟩` dentro del archivo: Play
pide un contacto real en la política.

---

## 5. Seguridad de los datos

Es el formulario donde más apps se atoran, porque se responde de memoria y luego
no coincide con lo que hace la app. Aquí coincide, y es verificable: no hay ni
una petición de red en el código.

| Pregunta | Respuesta |
|---|---|
| ¿Tu app recopila o comparte alguno de los tipos de datos obligatorios? | **No** |
| ¿Se cifran los datos en tránsito? | No aplica: no se transmite nada |
| ¿Pueden los usuarios pedir que se eliminen sus datos? | **Sí**, desde Ajustes → Borrar todos los datos |
| ¿La app tiene cuentas de usuario? | **No** |
| ¿Publicidad o analítica de terceros? | **No** |

Matiz importante, por si en la revisión preguntan: la app **guarda** datos en el
dispositivo (progreso, apodo, respuestas escritas), pero Play solo considera
«recopilación» lo que sale del teléfono. Aquí no sale nada, y la copia de
seguridad automática de Android está desactivada para que tampoco llegue a
Google Drive.

---

## 6. Clasificación de contenido y público objetivo

Cuestionario IARC:

- Categoría de la app: **Educación / Referencia**.
- Violencia, sexo, lenguaje, sustancias, apuestas: **no** a todo.
- ¿Los usuarios pueden interactuar entre sí, compartir ubicación o contenido?
  **No.** Las respuestas escritas de los retos de creatividad se quedan en el
  teléfono y solo las ve quien tenga el PIN.
- ¿Compras dentro de la app o publicidad? **No** en esta versión.

Público objetivo:

- Grupos de edad: **menores de 13 años y también adolescentes y adultos**. Al
  incluir menores de 13, la app entra en la **política de Familias**, lo cual es
  correcto: las pantallas del menor están diseñadas para esa edad.
- Al entrar en Familias hay que confirmar que no hay anuncios, que no se usan
  SDK sin certificar y que existe política de privacidad. Se cumplen las tres.

---

## 7. Declaraciones de permisos

Cada una se responde en Play Console. Los textos están listos para pegar.

### Acceso al uso de apps (`PACKAGE_USAGE_STATS`)

```
NEUROpass es una app de control parental. Necesita saber qué aplicación está en
primer plano para aplicar los límites de tiempo que configura la madre, el padre
o el tutor desde un panel protegido con PIN. Solo se lee el nombre del paquete
de la app en primer plano; no se lee su contenido, no se guarda historial de uso
y ese dato no sale del dispositivo. La app muestra un aviso explicando este uso
y pide la aceptación del tutor antes de abrir los ajustes del permiso.
```

### Ver todas las apps instaladas (`QUERY_ALL_PACKAGES`)

```
El tutor tiene que poder elegir, de una lista, qué aplicaciones quedan limitadas
para el menor. Para mostrar esa lista la app necesita consultar las aplicaciones
instaladas. Es el caso de uso de gestión de dispositivo y control parental. La
lista se muestra únicamente dentro del panel protegido con PIN y no se
transmite a ningún servidor: la app no realiza peticiones de red.
```

### Servicio en primer plano de uso especial (`FOREGROUND_SERVICE_SPECIAL_USE`)

```
El servicio supervisa qué aplicación está en primer plano para aplicar los
límites de tiempo de pantalla configurados por el tutor, también cuando la app
no está abierta. No existe un tipo de servicio en primer plano que corresponda a
la supervisión parental, por eso se declara como uso especial. El servicio
muestra una notificación permanente mientras está activo.
```

### Mostrarse sobre otras apps (`SYSTEM_ALERT_WINDOW`)

```
Cuando el menor abre una aplicación limitada sin tiempo disponible, NEUROpass
muestra una pantalla encima explicando que se acabó el tiempo y ofreciendo
resolver retos para ganar más. La pantalla nunca bloquea el dispositivo: el
botón de inicio funciona y siempre hay una salida visible.
```

### Administrador de dispositivo (protección antidesinstalación)

```
Función opcional que el tutor activa desde el panel protegido con PIN. Se usa
exclusivamente para impedir que el menor desinstale la app de control parental.
Se solicita únicamente la política mínima que Android exige (watch-login): la
app no borra el dispositivo, no gestiona contraseñas, no bloquea la pantalla y
no usa la cámara. Antes de activarla se muestra un aviso que enumera lo que la
app no puede hacer, y el tutor puede desactivarla en cualquier momento desde el
mismo panel.
```

**Es el permiso con más riesgo de rechazo.** Si Google lo cuestiona, la salida
es publicar sin él: es opcional y la app funciona igual. Se retira quitando el
receptor del manifiesto del módulo y el apartado de Ajustes.

---

## 8. Video de demostración

Google pide un video para los permisos de uso especial. Con un enlace de YouTube
como **no listado** basta. Guion de dos minutos:

1. Abrir NEUROpass y entrar al panel con el PIN.
2. Elegir dos apps para limitar y guardar.
3. Mostrar el aviso del acceso al uso de apps y aceptarlo.
4. Salir, abrir una de esas apps sin tiempo disponible y enseñar la pantalla de
   bloqueo con AXO, incluido que el botón de inicio funciona.
5. Pulsar «Resolver retos», completar una sesión y volver a abrir la app ya
   desbloqueada.
6. Enseñar la notificación permanente de la supervisión.

---

## 9. Orden recomendado

1. Abrir la cuenta y crear la app en Play Console.
2. Publicar la política de privacidad (paso 4).
3. Compilar el AAB (paso 2) y subirlo a **prueba interna**.
4. Instalarlo desde Play en un teléfono real y comprobar que el bloqueo, el
   escudo y el aviso previo funcionan igual que en el APK de prueba.
5. Llenar ficha, seguridad de datos, clasificación y declaraciones.
6. Empezar la **prueba cerrada** con 12 probadores y dejarla correr 14 días.
7. Enviar a producción.

Entre la prueba cerrada y la revisión de permisos, calcula de tres a cinco
semanas desde hoy hasta estar publicado.

---

## 10. Si rechazan la app

Suele pasar en el primer envío y casi siempre por lo mismo:

- **Permisos sin justificar:** responder con los textos del paso 7, sin cambiar
  nada más.
- **Administrador de dispositivo:** quitarlo y volver a enviar.
- **Política de Familias:** revisar que en la ficha no haya lenguaje que
  presente la app como un juego, y que las capturas sean de la app real.
- **Seguridad de los datos incompleta:** suele ser la pregunta de eliminación de
  datos; la respuesta es que se borran desde Ajustes.
