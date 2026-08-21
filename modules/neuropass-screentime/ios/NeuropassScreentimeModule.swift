import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

/**
 Puente nativo de iOS.

 El modelo de iOS es opuesto al de Android y conviene tenerlo presente antes de
 tocar este archivo:

 - La app **nunca** sabe qué aplicaciones hay instaladas ni cuáles se están
   usando. `FamilyActivityPicker` es una vista del sistema que devuelve tokens
   opacos; no hay bundle identifiers, ni nombres, ni iconos.
 - La app **no** dibuja el bloqueo. Se declara el conjunto restringido en
   `ManagedSettingsStore` y es iOS quien muestra su propio escudo cuando el
   menor abre esa app. No hay overlay ni servicio en segundo plano, y por eso
   tampoco hay nada que la batería pueda matar.
 - Desbloquear tiempo consiste en **vaciar** el escudo y volver a ponerlo al
   expirar. La reprogramación se hace con `DeviceActivityCenter`, que requiere
   una extensión `DeviceActivityMonitor` en el proyecto de la app (ver
   docs/IOS_FAMILY_CONTROLS.md); mientras esa extensión no exista, el escudo se
   restablece la próxima vez que la app se abre.

 REQUISITO NO NEGOCIABLE: `com.apple.developer.family-controls` es un
 entitlement restringido. Hay que solicitarlo a Apple y justificar que la app
 es estrictamente de control parental. Sin él, este módulo compila pero
 `requestAuthorization` falla en tiempo de ejecución.
 */
public class NeuropassScreentimeModule: Module {

  private let store = ManagedSettingsStore(named: .init("neuropass"))
  private let selectionKey = "neuropass.family.selection"
  private let unlockedUntilKey = "neuropass.family.unlockedUntil"

  public func definition() -> ModuleDefinition {
    Name("NeuropassScreentime")

    // -----------------------------------------------------------------------
    // Capacidades
    // -----------------------------------------------------------------------

    AsyncFunction("getCapabilities") { () -> [String: Any] in
      let authorized = AuthorizationCenter.shared.authorizationStatus == .approved

      return [
        "backend": "ios",
        "selectionMode": "system_picker",
        "usageMode": "aggregate_only",
        // Los tres permisos de Android no existen aquí. Se reportan como
        // `true` en lugar de `false` porque desde la perspectiva de quien
        // llama significan "no hay nada pendiente que pedir", y un `false`
        // haría que la UI mostrara pasos imposibles de completar en iOS.
        "usageAccess": authorized,
        "overlay": true,
        "deviceAdmin": false,
        "notifications": true,
        "familyControls": authorized,
        "batteryUnrestricted": true,
      ]
    }

    // En iOS estos ajustes no existen como pantalla propia; se dejan como
    // operaciones vacías para que quien llama no tenga que ramificar.
    AsyncFunction("openUsageAccessSettings") { }
    AsyncFunction("openOverlaySettings") { }
    AsyncFunction("openBatterySettings") { }

    AsyncFunction("requestNotificationPermission") { () -> Bool in true }
    AsyncFunction("requestDeviceAdmin") { () -> Bool in false }
    AsyncFunction("releaseDeviceAdmin") { }

    // -----------------------------------------------------------------------
    // Autorización de Family Controls
    // -----------------------------------------------------------------------

    AsyncFunction("requestFamilyControls") { (promise: Promise) in
      Task {
        do {
          // `.child` declara que este dispositivo es el del menor. En el
          // dispositivo del tutor se usaría `.individual`; NEUROpass se
          // instala en el del menor, que es donde se aplica el límite.
          try await AuthorizationCenter.shared.requestAuthorization(for: .child)
          promise.resolve(AuthorizationCenter.shared.authorizationStatus == .approved)
        } catch {
          // El error más común aquí no es que la persona rechace, sino que
          // falte el entitlement. Se resuelve con `false` en lugar de
          // rechazar la promesa para que la UI muestre la guía de
          // configuración en vez de un error opaco.
          promise.resolve(false)
        }
      }
    }

    // -----------------------------------------------------------------------
    // Selección de apps
    // -----------------------------------------------------------------------

    AsyncFunction("listInstalledApps") { () -> [[String: Any]] in
      // iOS no permite enumerar apps instaladas, por diseño. Devolver una
      // lista vacía es la respuesta honesta; la UI usa `selectionMode` para
      // saber que aquí toca abrir el selector del sistema.
      []
    }

    AsyncFunction("presentAppPicker") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self else {
          promise.resolve(0)
          return
        }
        self.presentPicker(promise: promise)
      }
    }

    AsyncFunction("getSelectionCount") { () -> Int in
      let selection = self.loadSelection()
      return selection.applicationTokens.count
        + selection.categoryTokens.count
        + selection.webDomainTokens.count
    }

    AsyncFunction("getUsage") { (_: Double, _: Double) -> [[String: Any]] in
      // El desglose por app no está disponible sin una extensión
      // `DeviceActivityReport`, y aun con ella los datos solo pueden
      // renderizarse dentro de una vista del sistema: no se pueden leer desde
      // JavaScript. Se devuelve vacío en vez de inventar cifras.
      []
    }

    // -----------------------------------------------------------------------
    // Aplicación de la política
    // -----------------------------------------------------------------------

    AsyncFunction("applyPolicy") { (policy: [String: Any]) in
      let unlockedUntil = (policy["unlockedUntil"] as? Double) ?? 0
      UserDefaults.standard.set(unlockedUntil, forKey: self.unlockedUntilKey)

      let now = Date().timeIntervalSince1970 * 1000
      let withinProtectedWindow = Self.isWithinProtectedWindow(
        windows: policy["scheduleWindows"] as? [[String: Any]] ?? [],
        date: Date()
      )

      // Un horario protegido gana siempre al tiempo desbloqueado; es la misma
      // regla que aplica el evaluador de Android y tiene que coincidir.
      let shouldShield = withinProtectedWindow || now >= unlockedUntil

      if shouldShield {
        self.applyShield()
      } else {
        self.clearShield()
      }
    }

    AsyncFunction("clearPolicy") {
      self.clearShield()
      UserDefaults.standard.removeObject(forKey: self.selectionKey)
      UserDefaults.standard.removeObject(forKey: self.unlockedUntilKey)
    }

    AsyncFunction("getGuardStatus") { () -> [String: Any] in
      let unlockedUntil = UserDefaults.standard.double(forKey: self.unlockedUntilKey)
      let now = Date().timeIntervalSince1970 * 1000
      let shielded = self.store.shield.applications?.isEmpty == false

      return [
        // En iOS no hay servicio propio: el "guardián" es el sistema, y está
        // activo mientras haya un escudo declarado.
        "running": AuthorizationCenter.shared.authorizationStatus == .approved,
        "foregroundPackage": "",
        "blockedNow": shielded,
        "reason": shielded ? (now >= unlockedUntil ? "sin_tiempo" : "horario_protegido") : "permitido",
      ]
    }
  }

  // -------------------------------------------------------------------------

  private func presentPicker(promise: Promise) {
    guard let root = Self.topViewController() else {
      promise.resolve(0)
      return
    }

    let model = PickerModel(selection: loadSelection())
    var hosting: UIHostingController<PickerScreen>?

    let screen = PickerScreen(
      model: model,
      onFinish: { [weak self] result in
        hosting?.dismiss(animated: true)

        guard let self else {
          promise.resolve(0)
          return
        }

        // Cancelar deja intacta la selección anterior; solo se persiste al
        // confirmar. El picker emite decenas de actualizaciones intermedias
        // mientras la persona toca, y guardarlas todas sería escribir en
        // disco en cada pulsación.
        if let confirmed = result {
          self.saveSelection(confirmed)
          self.applyShield()
        }

        promise.resolve(Self.count(self.loadSelection()))
      }
    )

    let controller = UIHostingController(rootView: screen)
    // Se impide cerrar deslizando: la promesa solo se resuelve desde los
    // botones, y un descarte por gesto la dejaría pendiente para siempre.
    controller.isModalInPresentation = true
    hosting = controller

    root.present(controller, animated: true)
  }

  private static func count(_ selection: FamilyActivitySelection) -> Int {
    selection.applicationTokens.count
      + selection.categoryTokens.count
      + selection.webDomainTokens.count
  }

  private static func topViewController() -> UIViewController? {
    let keyWindow = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }

    var controller = keyWindow?.rootViewController
    while let presented = controller?.presentedViewController {
      controller = presented
    }
    return controller
  }

  private func applyShield() {
    let selection = loadSelection()
    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty
      ? nil
      : .specific(selection.categoryTokens)
    store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
  }

  private func clearShield() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
  }

  private func loadSelection() -> FamilyActivitySelection {
    guard
      let data = UserDefaults.standard.data(forKey: selectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else {
      return FamilyActivitySelection()
    }
    return selection
  }

  private func saveSelection(_ selection: FamilyActivitySelection) {
    guard let data = try? JSONEncoder().encode(selection) else { return }
    UserDefaults.standard.set(data, forKey: selectionKey)
  }

  /// Misma regla de horarios que el evaluador de Android, replicada aquí
  /// porque no hay forma de compartir código entre ambas plataformas.
  private static func isWithinProtectedWindow(windows: [[String: Any]], date: Date) -> Bool {
    let calendar = Calendar.current
    let components = calendar.dateComponents([.weekday, .hour, .minute], from: date)
    guard
      let weekday = components.weekday,
      let hour = components.hour,
      let minute = components.minute
    else { return false }

    // `weekday` va de 1 (domingo) a 7; la máscara usa el bit 0 para domingo.
    let weekdayBit = 1 << (weekday - 1)
    let minuteOfDay = hour * 60 + minute

    return windows.contains { window in
      let mask = window["weekdayMask"] as? Int ?? 0
      let start = window["startMinute"] as? Int ?? 0
      let end = window["endMinute"] as? Int ?? 0
      return (mask & weekdayBit) != 0 && minuteOfDay >= start && minuteOfDay < end
    }
  }
}

// MARK: - Selector de apps

/// Estado observable del selector. `FamilyActivityPicker` necesita un
/// `Binding`, y sostenerlo en un objeto evita que SwiftUI lo reinicie en cada
/// redibujo de la hoja.
private final class PickerModel: ObservableObject {
  @Published var selection: FamilyActivitySelection

  init(selection: FamilyActivitySelection) {
    self.selection = selection
  }
}

/// Envoltorio del selector del sistema con confirmación explícita.
///
/// `FamilyActivityPicker` no trae botones propios: sin esta envoltura, la
/// única salida sería cerrar la app.
private struct PickerScreen: View {
  @ObservedObject var model: PickerModel

  /// Recibe la selección al confirmar, o `nil` al cancelar.
  let onFinish: (FamilyActivitySelection?) -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $model.selection)
        .navigationTitle("Apps a limitar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancelar") { onFinish(nil) }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Guardar") { onFinish(model.selection) }
              .fontWeight(.semibold)
          }
        }
    }
    .navigationViewStyle(.stack)
  }
}
