package com.neuropass.screentime

import android.app.admin.DeviceAdminReceiver
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Protección antidesinstalación.
 *
 * Mientras este receptor esté activo como administrador de dispositivo,
 * Android impide desinstalar la app desde el lanzador o los ajustes. El tutor
 * lo desactiva desde el panel —tras el PIN— y solo entonces la desinstalación
 * queda disponible.
 *
 * Se pide la política mínima (`watch-login`) porque el objetivo no es
 * administrar el dispositivo, sino existir como administrador: es la
 * condición que Android exige para blindar la desinstalación. Pedir borrado
 * remoto o control de contraseñas para conseguir lo mismo sería desproporcionado
 * y motivo de rechazo en la revisión de Google Play.
 */
class AdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
    }

    /**
     * Texto que Android muestra al menor si intenta retirar la supervisión.
     * Es informativo, no acusatorio: la app da por hecho que quien lee esto es
     * un niño que no sabe qué está tocando.
     */
    override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
        "Si desactivas la supervisión, NEUROpass dejará de proteger los límites de tiempo " +
            "que configuró tu familia."

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
    }
}

/**
 * Relanza el guardián tras reiniciar el teléfono o actualizar la app.
 *
 * Sin esto, apagar y encender el dispositivo bastaría para desactivar el
 * control: es el primer truco que un menor descubre, y no requiere ningún
 * conocimiento técnico.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val relevant = intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED
        if (!relevant) return

        // Solo se relanza si el tutor tenía la supervisión activa: arrancar un
        // servicio en primer plano sin política que aplicar sería consumir
        // batería y mostrar una notificación permanente sin motivo.
        if (PolicyStore(context).guardEnabled) {
            GuardService.start(context)
        }
    }
}
