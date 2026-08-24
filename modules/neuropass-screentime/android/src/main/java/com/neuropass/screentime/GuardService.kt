package com.neuropass.screentime

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import java.util.Calendar

/**
 * Servicio guardián.
 *
 * Sondea qué aplicación está en primer plano y, cuando es una restringida sin
 * tiempo disponible, levanta la pantalla de bloqueo. Tres decisiones que
 * conviene entender antes de tocar nada aquí:
 *
 * 1. **Se sondea, no se observa.** Android no ofrece a una app normal ninguna
 *    forma de suscribirse a "cambió la app en primer plano". La alternativa
 *    sería un `AccessibilityService`, que sí notifica, pero Google Play
 *    restringe severamente ese API y usarlo para control parental es una vía
 *    rápida a la suspensión de la cuenta. Sondear `UsageStatsManager` es la
 *    ruta soportada.
 *
 * 2. **La cadencia es adaptativa.** Sondear cada segundo de forma constante
 *    castiga la batería y hace que el sistema mate el servicio. Se sondea
 *    rápido justo después de detectar actividad y se ralentiza cuando no pasa
 *    nada, que es cuando el teléfono está quieto en el bolsillo.
 *
 * 3. **El servicio es la fuente de verdad, no el puente JS.** Lee la política
 *    de `PolicyStore` en cada ciclo. Así sigue aplicándola correctamente
 *    aunque el proceso de React Native no exista, que es el caso normal:
 *    el menor está en otro juego, no dentro de NEUROpass.
 */
class GuardService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var policyStore: PolicyStore
    private lateinit var overlay: BlockOverlay

    private var lastForegroundPackage: String = ""

    private val tick = object : Runnable {
        override fun run() {
            val nextInterval = runCatching { evaluateOnce() }.getOrElse {
                // Una excepción en un ciclo no puede detener el guardián: se
                // registra implícitamente al volver al intervalo lento y se
                // sigue. Un servicio de control parental que se cae en
                // silencio es peor que uno que se equivoca una vez.
                IDLE_INTERVAL_MS
            }
            handler.postDelayed(this, nextInterval)
        }
    }

    override fun onCreate() {
        super.onCreate()
        policyStore = PolicyStore(this)
        overlay = BlockOverlay(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Desde Android 14 hay que repetir el tipo al arrancar el servicio,
            // no basta con declararlo en el manifiesto.
            startForeground(
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        handler.removeCallbacks(tick)
        handler.post(tick)
        // START_STICKY: si el sistema mata el servicio por presión de memoria,
        // debe volver. Es justo el escenario que un menor puede provocar
        // abriendo juegos pesados.
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        overlay.hide()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /** Un ciclo de evaluación. Devuelve cuánto esperar hasta el siguiente. */
    private fun evaluateOnce(): Long {
        val policy = policyStore.load()

        if (policy.blockedPackages.isEmpty()) {
            overlay.hide()
            return IDLE_INTERVAL_MS
        }

        val foreground = detectForegroundPackage()
        val reason = PolicyEvaluator.evaluate(
            policy = policy,
            packageName = foreground,
            nowMs = System.currentTimeMillis(),
            calendar = Calendar.getInstance(),
        )

        val changed = foreground != lastForegroundPackage
        lastForegroundPackage = foreground

        return when (reason) {
            BlockReason.PERMITIDO -> {
                overlay.hide()
                // Tras un cambio de app se vigila de cerca un rato: es cuando
                // es más probable que el siguiente movimiento sea abrir un
                // juego restringido.
                if (changed) ACTIVE_INTERVAL_MS else IDLE_INTERVAL_MS
            }

            BlockReason.SIN_TIEMPO, BlockReason.HORARIO_PROTEGIDO -> {
                overlay.show(policy, reason)
                // Mientras el bloqueo está en pantalla se sondea rápido para
                // retirarlo en cuanto el menor salga de la app.
                ACTIVE_INTERVAL_MS
            }
        }
    }

    /**
     * Paquete en primer plano según los eventos de uso recientes.
     *
     * Se consulta una ventana amplia (no solo el último intervalo) porque
     * `queryEvents` no garantiza entregar eventos con baja latencia; con una
     * ventana corta se pierden transiciones y el bloqueo llega tarde.
     */
    private fun detectForegroundPackage(): String {
        val usageStats = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return ""

        val now = System.currentTimeMillis()
        val events = usageStats.queryEvents(now - EVENT_LOOKBACK_MS, now)
        val event = UsageEvents.Event()
        var latestPackage = ""
        var latestTimestamp = 0L

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val isResume = event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
                event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
            if (isResume && event.timeStamp >= latestTimestamp) {
                latestTimestamp = event.timeStamp
                latestPackage = event.packageName ?: ""
            }
        }

        return latestPackage
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Supervisión activa",
            // IMPORTANCE_LOW: la notificación es obligatoria para un servicio
            // en primer plano, pero no debe sonar ni vibrar. Molestar a la
            // familia con ella sería la forma más rápida de que desinstalen.
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Indica que NEUROpass está supervisando el tiempo de pantalla."
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)

        val openApp = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = openApp?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        // Se usa el `Notification.Builder` del framework y no `NotificationCompat`:
        // el constructor con canal existe desde API 26, que es el mínimo de este
        // módulo, así que la capa de compatibilidad no aporta nada y a cambio
        // añadiría una dependencia de androidx a un módulo que no tiene ninguna.
        // La prioridad tampoco se declara: desde Oreo la fija el canal.
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("NEUROpass está activo")
            .setContentText("Supervisando el tiempo de pantalla configurado por tu familia.")
            // El icono de la propia app en lugar de uno del sistema: se resuelve
            // en tiempo de ejecución, así que no depende de qué constantes de
            // `android.R.drawable` sigan siendo públicas.
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .apply { pendingIntent?.let { setContentIntent(it) } }
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "neuropass_guard"
        private const val NOTIFICATION_ID = 4711

        /** Cadencia mientras hay actividad relevante o un bloqueo en pantalla. */
        private const val ACTIVE_INTERVAL_MS = 900L

        /** Cadencia en reposo; el compromiso entre latencia y batería. */
        private const val IDLE_INTERVAL_MS = 3_000L

        /** Ventana de eventos que se inspecciona en cada sondeo. */
        private const val EVENT_LOOKBACK_MS = 15_000L

        fun start(context: Context) {
            val intent = Intent(context, GuardService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, GuardService::class.java))
        }
    }
}
