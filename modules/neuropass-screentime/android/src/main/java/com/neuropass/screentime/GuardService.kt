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

    /**
     * Marca del evento de primer plano más reciente ya procesado.
     *
     * La ventana de consulta arranca aquí en vez de en un punto fijo respecto a
     * "ahora". Con una ventana fija, cualquier ciclo que se retrase más que ella
     * —por Doze, por presión de memoria o porque el sistema retuvo el reparto de
     * eventos— pierde la transición para siempre, porque en el siguiente sondeo
     * la app ya lleva rato en primer plano y no genera un evento nuevo.
     */
    private var lastEventCursor: Long = 0L

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
        // El vigilante se reprograma en cada arranque: si el servicio murió y
        // esta llamada viene de la alarma, la cadena se mantiene viva.
        GuardWatchdog.schedule(this)
        // START_STICKY: si el sistema mata el servicio por presión de memoria,
        // debe volver. Es justo el escenario que un menor puede provocar
        // abriendo juegos pesados.
        return START_STICKY
    }

    /**
     * Deslizar la app fuera de recientes mata el servicio en la mayoría de las
     * capas de fabricante. Es el gesto más común y menos técnico para desactivar
     * un control parental, así que se reprograma el vigilante antes de morir.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        if (policyStore.guardEnabled) GuardWatchdog.schedule(this)
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        overlay.hide()
        // Si el guardián debía estar activo, su desaparición es un fallo, no un
        // cierre ordenado: se deja programado el relanzamiento.
        if (policyStore.guardEnabled) GuardWatchdog.schedule(this)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /** Un ciclo de evaluación. Devuelve cuánto esperar hasta el siguiente. */
    private fun evaluateOnce(): Long {
        // El latido se escribe antes de cualquier decisión: sirve para saber que
        // el guardián sigue vivo, no que la evaluación haya salido bien.
        policyStore.lastHeartbeatAt = System.currentTimeMillis()

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
        policyStore.lastForegroundPackage = foreground

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
     * Paquete en primer plano.
     *
     * Dos reglas gobiernan esta función, y ambas nacen de fallos reales:
     *
     * 1. **La ventana arranca en el último evento visto**, no a una distancia
     *    fija de "ahora". Con una ventana fija, un ciclo que se retrase más que
     *    ella pierde la transición de forma permanente: la app ya está abierta y
     *    no volverá a generar un evento de apertura.
     *
     * 2. **Ausencia de eventos significa "nada cambió", no "no hay nada".**
     *    Antes se devolvía cadena vacía, que el evaluador interpreta como
     *    permitido; el resultado era que el bloqueo se retiraba solo en cuanto
     *    el reparto de eventos se atrasaba un poco. Ahora se conserva el último
     *    paquete conocido, que es lo que de verdad implica no haber visto
     *    ninguna transición.
     */
    private fun detectForegroundPackage(): String {
        val usageStats = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return lastForegroundPackage

        val now = System.currentTimeMillis()
        val from = maxOf(lastEventCursor + 1, now - MAX_LOOKBACK_MS)
            .coerceAtMost(now - EVENT_LOOKBACK_MS)

        val events = usageStats.queryEvents(from, now)
        val event = UsageEvents.Event()
        var latestPackage = ""
        var latestTimestamp = lastEventCursor

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val isResume = event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
                event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
            if (isResume && event.timeStamp >= latestTimestamp) {
                latestTimestamp = event.timeStamp
                latestPackage = event.packageName ?: ""
            }
        }

        if (latestPackage.isNotEmpty()) {
            lastEventCursor = latestTimestamp
            return latestPackage
        }

        // Sin eventos nuevos: si ya se sabía qué había en pantalla, sigue ahí.
        if (lastForegroundPackage.isNotEmpty()) return lastForegroundPackage

        // Arranque en frío del servicio, sin historial en memoria. Se recurre a
        // las estadísticas agregadas, que sobreviven al reinicio del proceso y
        // en varias capas de fabricante se actualizan antes que los eventos.
        return mostRecentlyUsedPackage(usageStats, now)
    }

    private fun mostRecentlyUsedPackage(usageStats: UsageStatsManager, now: Long): String =
        runCatching {
            usageStats
                .queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - MAX_LOOKBACK_MS, now)
                .maxByOrNull { it.lastTimeUsed }
                ?.packageName
                .orEmpty()
        }.getOrDefault("")

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

        /** Ventana mínima que se inspecciona en cada sondeo. */
        private const val EVENT_LOOKBACK_MS = 15_000L

        /**
         * Tope de la ventana de eventos. Acota el trabajo cuando el guardián
         * lleva mucho tiempo sin ejecutarse —tras un reinicio o una muerte
         * prolongada— en vez de recorrer el historial entero de uso.
         */
        private const val MAX_LOOKBACK_MS = 10 * 60_000L

        fun start(context: Context) {
            val intent = Intent(context, GuardService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /**
         * Arranque tolerante a fallos, para los puntos que se ejecutan en
         * segundo plano. Devuelve si el servicio pudo lanzarse, de modo que
         * quien llama pueda decidir sin tener que capturar la excepción.
         */
        fun startSafely(context: Context): Boolean = runCatching { start(context) }.isSuccess

        fun stop(context: Context) {
            context.stopService(Intent(context, GuardService::class.java))
        }
    }
}
