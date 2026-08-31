package com.neuropass.screentime

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock

/**
 * Vigilante del guardián.
 *
 * En Android, un servicio en primer plano **no** es garantía de supervivencia.
 * `START_STICKY` es una petición, no un contrato, y varias capas de fabricante
 * —MIUI y HyperOS de forma notoria, pero también One UI, ColorOS y Funtouch—
 * lo ignoran y matan el proceso en cuanto la app deja el primer plano. Para una
 * app de control parental eso no es un detalle de rendimiento: es la diferencia
 * entre bloquear y no bloquear, porque el escenario normal es justamente que el
 * menor esté en otra aplicación.
 *
 * La estrategia es de tres capas, de más a menos fiable:
 *
 *  1. **Alarma que se reprograma sola.** Cada disparo comprueba si el guardián
 *     sigue vivo y lo relanza si no. Se usa `setAndAllowWhileIdle`, que es
 *     inexacta y atraviesa Doze, en lugar de una alarma exacta: esta última
 *     exige `SCHEDULE_EXACT_ALARM`, un permiso que Google Play restringe a
 *     despertadores y calendarios y cuya solicitud complicaría la revisión sin
 *     aportar precisión que aquí haga falta.
 *
 *  2. **`onTaskRemoved`.** Deslizar la app fuera de recientes es la forma más
 *     común —y menos técnica— de matar el servicio. Se reprograma la alarma
 *     desde ahí antes de que el proceso muera.
 *
 *  3. **Latido persistido.** El servicio escribe una marca de tiempo en cada
 *     ciclo. Si la marca envejece, el guardián está muerto aunque nadie lo haya
 *     notificado, y el panel del tutor puede decirlo en lugar de aparentar que
 *     todo funciona.
 *
 * Ninguna de las tres sustituye al permiso de inicio automático del fabricante.
 * Lo que hacen es reducir la ventana de caída de horas a un minuto y, sobre
 * todo, hacerla **visible** para quien configuró la app.
 */
object GuardWatchdog {

    /**
     * Periodo nominal de comprobación. El sistema puede retrasarlo cuando el
     * dispositivo está en Doze profundo, que es precisamente cuando nadie está
     * usando el teléfono y no hay nada que bloquear.
     */
    private const val INTERVAL_MS = 60_000L

    private const val REQUEST_CODE = 4712

    /**
     * Antigüedad del latido a partir de la cual se considera muerto al guardián.
     *
     * Se toma con holgura sobre el periodo del vigilante (60 s). Un umbral
     * ajustado al sondeo —3 s— daría falsas alarmas cada vez que el sistema
     * congela el proceso en Doze, y una alarma que salta sin motivo se aprende
     * a ignorar, que es peor que no tenerla.
     */
    const val HEARTBEAT_STALE_MS = 120_000L

    fun schedule(context: Context) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val triggerAt = SystemClock.elapsedRealtime() + INTERVAL_MS

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent(context))
        } else {
            manager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent(context))
        }
    }

    fun cancel(context: Context) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        manager.cancel(pendingIntent(context))
    }

    private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        Intent(context, WatchdogReceiver::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}

/**
 * Recibe el disparo de la alarma: relanza el guardián si hacía falta y vuelve a
 * programarse. La cadena se rompe solo cuando el tutor desactiva la supervisión.
 */
class WatchdogReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val store = PolicyStore(context)

        if (!store.guardEnabled) {
            GuardWatchdog.cancel(context)
            return
        }

        // Arrancar un servicio que ya corre es barato: `onStartCommand` reinicia
        // el ciclo de sondeo y nada más. No hace falta comprobar antes si está
        // vivo, y consultarlo con `getRunningServices` está obsoleto y devuelve
        // información poco fiable desde Android 8.
        //
        // Desde Android 12 arrancar un servicio en primer plano desde segundo
        // plano lanza `ForegroundServiceStartNotAllowedException` salvo que la
        // app esté exenta. NEUROpass lo está por dos vías —tener concedido
        // SYSTEM_ALERT_WINDOW y estar fuera de la optimización de batería—, que
        // son justo los permisos que pide para funcionar. Aun así el arranque se
        // protege: una excepción no capturada aquí mataría el proceso y con él
        // la única cadena que puede resucitar al guardián.
        GuardService.startSafely(context)

        // La reprogramación va fuera del `runCatching` a propósito: si el
        // arranque falló, el siguiente intento es más necesario, no menos.
        GuardWatchdog.schedule(context)
    }
}
