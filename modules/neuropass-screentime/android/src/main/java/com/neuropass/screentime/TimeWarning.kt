package com.neuropass.screentime

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import kotlin.math.ceil

/**
 * Aviso previo al fin del tiempo de ocio.
 *
 * Cortar la pantalla sin previo aviso, a media partida, es la forma más rápida
 * de que una familia acabe desinstalando el control parental. El objetivo de
 * NEUROpass es que el límite se respete, no que se sufra, así que se avisa con
 * antelación para que el menor pueda cerrar lo que esté haciendo.
 *
 * Dos decisiones de implementación:
 *
 *  1. **Se programa con `AlarmManager`, no desde el servicio guardián.** El
 *     guardián puede estar muerto —varias capas de fabricante lo matan— y el
 *     aviso seguiría siendo correcto y útil. Una alarma la mantiene el sistema,
 *     no el proceso de la app.
 *
 *  2. **El instante llega ya calculado desde TypeScript.** Aquí no se decide
 *     nada sobre cuándo avisar: esa regla vive en `expiryWarningAt`, con
 *     pruebas, y no se replica en Kotlin ni en Swift. La lógica de horarios ya
 *     está triplicada en este proyecto y no conviene añadir una cuarta copia de
 *     nada.
 *
 * LIMITACIÓN CONOCIDA: el aviso se calcula sobre `unlockedUntil`. Si una franja
 * horaria protegida empieza antes de ese instante, el corte real llegará antes
 * que el aviso. Se documenta en lugar de disimularlo; resolverlo exige calcular
 * el próximo inicio de franja, que hoy no se hace en ningún lado.
 */
object TimeWarning {

    private const val CHANNEL_ID = "neuropass_time_warning"
    private const val NOTIFICATION_ID = 4713
    private const val REQUEST_CODE = 4714

    /** Programa el aviso, o lo cancela si no procede. */
    fun schedule(context: Context, warningAt: Long?, unlockedUntil: Long) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

        // Cualquier cambio de política reemplaza la alarma anterior: si el menor
        // gana más tiempo o el tutor lo corta, el aviso viejo dejaría de tener
        // sentido y llegaría a destiempo.
        manager.cancel(pendingIntent(context, 0L))

        if (warningAt == null || warningAt <= System.currentTimeMillis()) return

        // `setAndAllowWhileIdle` atraviesa Doze. Es inexacta, con una desviación
        // de minutos solo si el dispositivo lleva mucho rato en reposo profundo,
        // que es justo cuando nadie está jugando y el aviso no hace falta. La
        // alternativa exacta exige SCHEDULE_EXACT_ALARM, que Google Play
        // restringe a despertadores y calendarios.
        val intent = pendingIntent(context, unlockedUntil)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, warningAt, intent)
        } else {
            manager.set(AlarmManager.RTC_WAKEUP, warningAt, intent)
        }
    }

    fun cancel(context: Context) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        manager.cancel(pendingIntent(context, 0L))
        notificationManager(context).cancel(NOTIFICATION_ID)
    }

    /**
     * El instante de expiración viaja dentro del intent para que la
     * notificación pueda decir cuántos minutos quedan de verdad en el momento
     * de dispararse, y no los que se habían previsto al programarla.
     */
    private fun pendingIntent(context: Context, unlockedUntil: Long): PendingIntent {
        val intent = Intent(context, TimeWarningReceiver::class.java)
            .putExtra(EXTRA_UNLOCKED_UNTIL, unlockedUntil)

        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }

    internal const val EXTRA_UNLOCKED_UNTIL = "unlockedUntil"

    internal fun notificationManager(context: Context): NotificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    internal fun notify(context: Context, minutesLeft: Int, deepLink: String) {
        val manager = notificationManager(context)

        // Canal propio y con importancia alta, separado del canal silencioso del
        // guardián: este aviso sí debe verse e interrumpir, porque es accionable
        // y llega mientras el menor está mirando otra aplicación.
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Avisos de tiempo",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Avisa poco antes de que se acabe el tiempo de juego."
                setShowBadge(true)
            }
        )

        val tap = PendingIntent.getActivity(
            context,
            REQUEST_CODE + 1,
            Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val cuerpo = if (minutesLeft <= 1) {
            "Se acaba en menos de un minuto. Toca para ganar más resolviendo retos."
        } else {
            "Te quedan $minutesLeft minutos. Toca para ganar más resolviendo retos."
        }

        manager.notify(
            NOTIFICATION_ID,
            Notification.Builder(context, CHANNEL_ID)
                .setContentTitle("Tu tiempo de juego está por terminar")
                .setContentText(cuerpo)
                .setStyle(Notification.BigTextStyle().bigText(cuerpo))
                .setSmallIcon(context.applicationInfo.icon)
                .setAutoCancel(true)
                .setContentIntent(tap)
                .build(),
        )
    }
}

/** Dispara la notificación cuando la alarma vence. */
class TimeWarningReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val store = PolicyStore(context)
        val policy = store.load()

        // Entre la programación y el disparo pueden haber cambiado las cosas: el
        // tutor pudo cortar el tiempo, o el menor pudo ganar más. Se decide con
        // la política vigente, no con la que había al programar la alarma.
        val unlockedUntil = intent.getLongExtra(TimeWarning.EXTRA_UNLOCKED_UNTIL, 0L)
        if (unlockedUntil != policy.unlockedUntil) return

        val restanteMs = policy.unlockedUntil - System.currentTimeMillis()
        if (restanteMs <= 0) return

        TimeWarning.notify(
            context,
            ceil(restanteMs / 60_000.0).toInt(),
            policy.challengeDeepLink,
        )
    }
}
