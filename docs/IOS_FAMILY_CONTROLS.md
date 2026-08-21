# iOS: Family Controls, paso a paso

El módulo Swift está escrito y es funcional, pero **no basta con compilarlo**.
Apple exige un entitlement restringido y algunas piezas del proyecto de Xcode
que no pueden vivir dentro de un módulo local de Expo.

Este documento es la ruta completa, con lo que hay que hacer, en qué orden, y
qué esperar de los tiempos.

---

## 1. Solicitar el entitlement (empieza por aquí)

`com.apple.developer.family-controls` es un entitlement **restringido**: no se
activa desde la lista de capacidades del portal, hay que pedirlo y que Apple lo
apruebe.

1. Entra a <https://developer.apple.com/contact/request/family-controls-distribution>.
2. Rellena el formulario con el Bundle ID (`com.neuropass.app`).
3. En la justificación, sé concreto y explica el mecanismo, no la intención:

   > NEUROpass es una aplicación de control parental. La madre, el padre o el
   > tutor selecciona, mediante `FamilyActivityPicker`, las aplicaciones cuyo
   > uso queda condicionado. La app aplica y retira restricciones con
   > `ManagedSettingsStore` en función de los ejercicios educativos que el menor
   > completa. Toda la información se procesa localmente en el dispositivo y no
   > se transmite a ningún servidor. La aplicación no recopila información
   > personal de menores.

**Plazo realista: de dos a seis semanas.** Es el camino crítico del proyecto en
iOS, así que conviene enviarlo antes que cualquier otra cosa.

Sin el entitlement, el módulo compila con normalidad, pero
`AuthorizationCenter.shared.requestAuthorization(for: .child)` falla en tiempo de
ejecución. El módulo ya lo contempla: resuelve `false` en lugar de lanzar, para
que la interfaz muestre la guía de configuración y no un error opaco.

---

## 2. Requisitos de máquina

- **macOS con Xcode 16 o superior.** No hay atajo: los binarios de iOS solo se
  firman y compilan en macOS. Desde Windows la única vía es EAS Build en la nube
  (`eas build --platform ios`), que sí funciona pero necesita igualmente la
  cuenta de desarrollador y el entitlement aprobado.
- **Cuenta de Apple Developer de pago.** Family Controls no funciona con perfil
  de desarrollo gratuito.
- **Dispositivo físico.** El simulador no aplica restricciones reales.
- **Destino mínimo iOS 16.4**, ya fijado en `app.json` vía
  `expo-build-properties`.

---

## 3. Generar el proyecto nativo

```bash
npx expo prebuild --platform ios --clean
```

Esto crea `ios/` a partir de `app.json`, incluidos el entitlement de Family
Controls y `NSFamilyControlsUsageDescription`, ambos ya declarados.

```bash
npx pod-install
```

---

## 4. Verificar la firma en Xcode

Abre `ios/NEUROpass.xcworkspace` y comprueba, en el target de la app:

- **Signing & Capabilities** incluye *Family Controls*. Si no aparece, el
  entitlement todavía no está aprobado o el perfil de aprovisionamiento no se ha
  regenerado desde entonces.
- El perfil de aprovisionamiento es posterior a la aprobación. Si es anterior,
  bórralo y deja que Xcode lo regenere; es el fallo más común y se manifiesta
  como un error de autorización en ejecución, no de compilación.

---

## 5. La extensión que falta

El módulo actual restablece el escudo **la próxima vez que se abre la app**. Para
que se restablezca solo al expirar el tiempo, hace falta una extensión
`DeviceActivityMonitor`, que es un target adicional de Xcode y no puede vivir
dentro de un módulo local de Expo.

### Crearla

1. En Xcode: **File → New → Target → Device Activity Monitor Extension**.
2. Nómbrala `NeuropassMonitor`.
3. Añade un **App Group** compartido entre la app y la extensión
   (`group.com.neuropass.shared`): es la única forma de que ambas vean la misma
   selección y el mismo instante de expiración.

### Qué debe hacer

```swift
import DeviceActivity
import ManagedSettings

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private let store = ManagedSettingsStore(named: .init("neuropass"))

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // El intervalo de tiempo desbloqueado ha empezado: se retira el escudo.
    store.shield.applications = nil
    store.shield.applicationCategories = nil
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    // Se acabó el tiempo: vuelve el escudo, sin que la app tenga que abrirse.
    applyStoredSelection()
  }
}
```

`applyStoredSelection()` lee la `FamilyActivitySelection` del App Group y la
vuelve a aplicar. Es la misma lógica que `applyShield()` en
`NeuropassScreentimeModule.swift`, adaptada a leer del contenedor compartido en
lugar de `UserDefaults.standard`.

### Programar el intervalo desde la app

Al conceder minutos, además de aplicar la política:

```swift
let schedule = DeviceActivitySchedule(
  intervalStart: DateComponents(hour: startHour, minute: startMinute),
  intervalEnd: DateComponents(hour: endHour, minute: endMinute),
  repeats: false
)
try DeviceActivityCenter().startMonitoring(.init("neuropass.unlock"), during: schedule)
```

---

## 6. Personalizar el escudo (opcional)

Con una extensión `ShieldConfiguration` se puede sustituir el texto y el icono
por defecto de iOS por los de NEUROpass, de forma que el menor vea el mismo
mensaje que en Android. Los textos ya están centralizados en `SHIELD_COPY`
(`src/screentime/index.ts`) precisamente para no duplicarlos en tres sitios.

Es una mejora de coherencia visual, no un requisito funcional.

---

## 7. Probar en dispositivo

```bash
npx expo run:ios --device
```

Lista de verificación, en orden:

1. La autorización de Family Controls se concede sin error.
2. El selector del sistema se abre y la selección persiste al reabrir la app.
3. Al abrir una app restringida sin tiempo, aparece el escudo de iOS.
4. Tras completar una sesión, el escudo desaparece.
5. Al expirar el tiempo, el escudo vuelve **sin abrir NEUROpass** (esto requiere
   el paso 5).
6. Dentro de un horario protegido, el escudo se mantiene aunque haya minutos
   disponibles.

---

## Diferencias con Android que conviene tener presentes

Al probar en iOS, esto **no es un fallo**: es como funciona la plataforma.

| Comportamiento | Android | iOS |
|---|---|---|
| Lista de apps en el panel | Se muestra | Vacía a propósito; se usa el selector del sistema |
| Uso por aplicación | Con cifras | Vacío; solo hay umbrales agregados |
| Aspecto de la pantalla de bloqueo | La de NEUROpass | La de iOS, salvo que se añada `ShieldConfiguration` |
| Notificación permanente | Sí, la exige el servicio | No hay servicio, no hay notificación |
| Protección antidesinstalación | Device Admin | No aplica; se gestiona con Tiempo en Pantalla o MDM |
| Exención de batería | Necesaria | No aplica; el bloqueo lo aplica el sistema |

La consecuencia práctica: en iOS el bloqueo es **más fiable** que en Android,
porque no depende de un servicio propio que el sistema pueda matar. A cambio, la
app ve muchísimo menos.
