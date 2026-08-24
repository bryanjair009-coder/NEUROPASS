package com.neuropass.screentime

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Política de bloqueo y su evaluación.
 *
 * Vive en `SharedPreferences` y no en memoria porque el proceso de JavaScript
 * y el servicio guardián pueden no coexistir: Android puede matar la actividad
 * y dejar el servicio vivo, o reiniciar el servicio tras un arranque sin que
 * React Native llegue a cargarse nunca. Un estado compartido y persistente es
 * la única forma de que el guardián sepa qué hacer sin depender del puente.
 *
 * `PolicyEvaluator` es deliberadamente puro: no toca Android, así que es la
 * pieza que se puede razonar y probar de forma aislada. Toda la lógica de
 * "¿bloqueo o no?" está ahí, no dispersa por el servicio.
 */

data class ScheduleWindow(
    val weekdayMask: Int,
    val startMinute: Int,
    val endMinute: Int,
)

data class Policy(
    val blockedPackages: Set<String>,
    /** Epoch ms hasta el que el ocio está permitido; 0 si no hay tiempo desbloqueado. */
    val unlockedUntil: Long,
    val scheduleWindows: List<ScheduleWindow>,
    val shieldTitle: String,
    val shieldMessage: String,
    val challengeDeepLink: String,
) {
    companion object {
        val EMPTY = Policy(
            blockedPackages = emptySet(),
            unlockedUntil = 0L,
            scheduleWindows = emptyList(),
            shieldTitle = "Tiempo de juego agotado",
            shieldMessage = "Resuelve unos retos en NEUROpass para desbloquear más tiempo.",
            challengeDeepLink = "neuropass://child/session",
        )
    }
}

/** Motivo por el que se bloquea o se deja pasar. Se refleja tal cual en la UI del tutor. */
enum class BlockReason { PERMITIDO, SIN_TIEMPO, HORARIO_PROTEGIDO }

object PolicyEvaluator {

    /**
     * Decide si un paquete debe bloquearse ahora.
     *
     * El orden de las reglas es la regla más importante del módulo: un horario
     * protegido gana siempre al tiempo ganado. Si fuera al revés, un menor
     * podría resolver retos a las 3 de la madrugada y abrir el bloqueo de la
     * hora de dormir, con lo que la app pasaría de ser un control parental a
     * ser un mecanismo para negociarlo.
     */
    fun evaluate(policy: Policy, packageName: String, nowMs: Long, calendar: Calendar): BlockReason {
        // Una app no restringida se deja pasar sin mirar horarios ni tiempo.
        if (packageName.isEmpty()) return BlockReason.PERMITIDO
        if (!policy.blockedPackages.contains(packageName)) return BlockReason.PERMITIDO

        return currentState(policy, nowMs, calendar)
    }

    /**
     * Estado del ocio ahora mismo, sin referirse a ninguna app concreta.
     *
     * Es lo que necesita el panel del tutor para decir "jugando" o "bloqueado".
     * Preguntárselo a `evaluate` con un paquete vacío devolvía siempre
     * PERMITIDO, porque ese caso está pensado para "no sé qué hay en primer
     * plano", no para "dime cómo está el sistema".
     */
    fun currentState(policy: Policy, nowMs: Long, calendar: Calendar): BlockReason {
        if (isWithinProtectedWindow(policy.scheduleWindows, calendar)) {
            return BlockReason.HORARIO_PROTEGIDO
        }

        if (nowMs < policy.unlockedUntil) return BlockReason.PERMITIDO

        return BlockReason.SIN_TIEMPO
    }

    fun isWithinProtectedWindow(windows: List<ScheduleWindow>, calendar: Calendar): Boolean {
        // Calendar.DAY_OF_WEEK va de 1 (domingo) a 7; la máscara usa el bit 0
        // para domingo, de ahí el desplazamiento.
        val weekdayBit = 1 shl (calendar.get(Calendar.DAY_OF_WEEK) - 1)
        val minuteOfDay = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)

        return windows.any { window ->
            (window.weekdayMask and weekdayBit) != 0 &&
                minuteOfDay >= window.startMinute &&
                minuteOfDay < window.endMinute
        }
    }
}

/** Lectura y escritura de la política, compartida entre el módulo y el servicio. */
class PolicyStore(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun save(policy: Policy) {
        val windows = JSONArray()
        policy.scheduleWindows.forEach { window ->
            windows.put(
                JSONObject()
                    .put(KEY_WEEKDAY_MASK, window.weekdayMask)
                    .put(KEY_START_MINUTE, window.startMinute)
                    .put(KEY_END_MINUTE, window.endMinute)
            )
        }

        prefs.edit()
            .putStringSet(KEY_PACKAGES, policy.blockedPackages)
            .putLong(KEY_UNLOCKED_UNTIL, policy.unlockedUntil)
            .putString(KEY_WINDOWS, windows.toString())
            .putString(KEY_TITLE, policy.shieldTitle)
            .putString(KEY_MESSAGE, policy.shieldMessage)
            .putString(KEY_DEEP_LINK, policy.challengeDeepLink)
            .apply()
    }

    fun load(): Policy {
        val windows = mutableListOf<ScheduleWindow>()
        runCatching {
            val array = JSONArray(prefs.getString(KEY_WINDOWS, "[]") ?: "[]")
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                windows.add(
                    ScheduleWindow(
                        weekdayMask = item.optInt(KEY_WEEKDAY_MASK, 0),
                        startMinute = item.optInt(KEY_START_MINUTE, 0),
                        endMinute = item.optInt(KEY_END_MINUTE, 0),
                    )
                )
            }
        }
        // Si el JSON estuviera corrupto, se sigue con la lista vacía: es
        // preferible dejar de aplicar horarios a que el guardián no arranque.

        return Policy(
            blockedPackages = prefs.getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet(),
            unlockedUntil = prefs.getLong(KEY_UNLOCKED_UNTIL, 0L),
            scheduleWindows = windows,
            shieldTitle = prefs.getString(KEY_TITLE, Policy.EMPTY.shieldTitle) ?: Policy.EMPTY.shieldTitle,
            shieldMessage = prefs.getString(KEY_MESSAGE, Policy.EMPTY.shieldMessage) ?: Policy.EMPTY.shieldMessage,
            challengeDeepLink = prefs.getString(KEY_DEEP_LINK, Policy.EMPTY.challengeDeepLink)
                ?: Policy.EMPTY.challengeDeepLink,
        )
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    /** El guardián debe estar activo mientras haya al menos una app restringida. */
    var guardEnabled: Boolean
        get() = prefs.getBoolean(KEY_GUARD_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_GUARD_ENABLED, value).apply()

    companion object {
        private const val PREFS_NAME = "neuropass_screentime_policy"
        private const val KEY_PACKAGES = "blocked_packages"
        private const val KEY_UNLOCKED_UNTIL = "unlocked_until"
        private const val KEY_WINDOWS = "schedule_windows"
        private const val KEY_TITLE = "shield_title"
        private const val KEY_MESSAGE = "shield_message"
        private const val KEY_DEEP_LINK = "challenge_deep_link"
        private const val KEY_GUARD_ENABLED = "guard_enabled"
        private const val KEY_WEEKDAY_MASK = "weekdayMask"
        private const val KEY_START_MINUTE = "startMinute"
        private const val KEY_END_MINUTE = "endMinute"
    }
}
