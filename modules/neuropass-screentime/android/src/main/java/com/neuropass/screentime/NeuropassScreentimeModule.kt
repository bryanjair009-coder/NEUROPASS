package com.neuropass.screentime

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.Calendar

/**
 * Puente nativo de Android.
 *
 * Todo lo que expone es sincrónico y barato salvo `listInstalledApps` y
 * `getUsage`, que se declaran con `AsyncFunction` porque recorren cientos de
 * paquetes y rasterizan iconos: hacerlo en el hilo de JS congelaría la
 * interfaz del tutor en un dispositivo con muchas apps.
 *
 * Ningún método concede permisos por su cuenta. Los tres permisos sensibles
 * —acceso a estadísticas de uso, superposición y administrador de
 * dispositivo— solo puede concederlos la persona, en la pantalla del sistema.
 * El módulo se limita a abrir esa pantalla y a reportar el estado.
 */
class NeuropassScreentimeModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    private val activity
        get() = appContext.currentActivity

    override fun definition() = ModuleDefinition {
        Name("NeuropassScreentime")

        // -------------------------------------------------------------------
        // Capacidades
        // -------------------------------------------------------------------

        AsyncFunction("getCapabilities") {
            mapOf(
                "backend" to "android",
                "selectionMode" to "package_list",
                "usageMode" to "per_app",
                "usageAccess" to hasUsageAccess(),
                "overlay" to Settings.canDrawOverlays(context),
                "deviceAdmin" to isDeviceAdminActive(),
                "notifications" to hasNotificationPermission(),
                "familyControls" to false,
                "batteryUnrestricted" to isBatteryUnrestricted(),
            )
        }

        // -------------------------------------------------------------------
        // Apertura de ajustes del sistema
        // -------------------------------------------------------------------

        AsyncFunction("openUsageAccessSettings") {
            launchSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }

        AsyncFunction("openOverlaySettings") {
            launchSettings(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${context.packageName}"),
                )
            )
        }

        AsyncFunction("openBatterySettings") {
            // Se abre la lista, no el diálogo directo de exención: pedirla con
            // ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS sin cumplir los
            // supuestos de la política de Google Play es motivo de rechazo.
            launchSettings(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }

        /**
         * Abre la pantalla de inicio automático del fabricante.
         *
         * Ninguna capa expone este ajuste por API: hay que ir a la actividad
         * concreta de cada una. Se prueban por orden y se cae a la ficha de la
         * app si ninguna existe, que es lo que ocurre en Android limpio, donde
         * el ajuste sencillamente no hace falta.
         */
        AsyncFunction("openAutostartSettings") {
            val candidates = listOf(
                "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
                "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
                "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
                "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
                "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
                "com.samsung.android.lool" to "com.samsung.android.sm.battery.ui.BatteryActivity",
            )

            val opened = candidates.any { (pkg, cls) ->
                val intent = Intent().setComponent(ComponentName(pkg, cls))
                if (context.packageManager.resolveActivity(intent, 0) == null) {
                    false
                } else {
                    launchSettings(intent)
                    true
                }
            }

            if (!opened) {
                launchSettings(
                    Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:${context.packageName}"),
                    )
                )
            }

            opened
        }

        AsyncFunction("requestNotificationPermission") {
            // En Android 13+ el permiso lo pide el propio contenedor de Expo a
            // través de expo-notifications; aquí solo se reporta el estado para
            // no duplicar diálogos.
            hasNotificationPermission()
        }

        // -------------------------------------------------------------------
        // Administrador de dispositivo
        // -------------------------------------------------------------------

        AsyncFunction("requestDeviceAdmin") {
            if (isDeviceAdminActive()) return@AsyncFunction true

            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent())
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Activa la supervisión para que NEUROpass no pueda desinstalarse sin tu PIN.",
                )
            }
            launchSettings(intent)
            // El resultado llega cuando la persona vuelve; quien llama debe
            // reconsultar `getCapabilities()`. Devolver aquí un booleano
            // optimista sería mentir sobre el estado real.
            false
        }

        AsyncFunction("releaseDeviceAdmin") {
            val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (manager.isAdminActive(adminComponent())) {
                manager.removeActiveAdmin(adminComponent())
            }
        }

        // -------------------------------------------------------------------
        // Selección de apps (solo Android)
        // -------------------------------------------------------------------

        AsyncFunction("listInstalledApps") {
            val packageManager = context.packageManager
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)

            // Solo apps con lanzador: los cientos de paquetes de sistema sin
            // interfaz no significan nada para quien configura la app.
            packageManager.queryIntentActivities(launcherIntent, 0)
                .asSequence()
                .mapNotNull { it.activityInfo?.applicationInfo }
                .distinctBy { it.packageName }
                .filter { it.packageName != context.packageName }
                .map { info ->
                    mapOf(
                        "packageName" to info.packageName,
                        "label" to packageManager.getApplicationLabel(info).toString(),
                        "isSystem" to ((info.flags and ApplicationInfo.FLAG_SYSTEM) != 0),
                        "iconBase64" to encodeIcon(packageManager.getApplicationIcon(info)),
                    )
                }
                .sortedBy { (it["label"] as String).lowercase() }
                .toList()
        }

        // iOS lo implementa de verdad; en Android el selector es la propia
        // lista, así que aquí no hay nada que presentar.
        AsyncFunction("presentAppPicker") { 0 }

        AsyncFunction("getSelectionCount") {
            PolicyStore(context).load().blockedPackages.size
        }

        // -------------------------------------------------------------------
        // Estadísticas de uso
        // -------------------------------------------------------------------

        AsyncFunction("getUsage") { startMs: Long, endMs: Long ->
            if (!hasUsageAccess()) return@AsyncFunction emptyList<Map<String, Any>>()

            val usageStats = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
                ?: return@AsyncFunction emptyList<Map<String, Any>>()
            val packageManager = context.packageManager

            usageStats
                .queryUsageStats(UsageStatsManager.INTERVAL_BEST, startMs, endMs)
                .asSequence()
                .filter { it.totalTimeInForeground > 0 }
                // `queryUsageStats` puede devolver varias filas por paquete;
                // se agregan en lugar de quedarse con una arbitraria.
                .groupBy { it.packageName }
                .map { (packageName, entries) ->
                    mapOf(
                        "packageName" to packageName,
                        "label" to resolveLabel(packageManager, packageName),
                        "foregroundMs" to entries.sumOf { it.totalTimeInForeground },
                    )
                }
                .sortedByDescending { it["foregroundMs"] as Long }
                .toList()
        }

        // -------------------------------------------------------------------
        // Política y guardián
        // -------------------------------------------------------------------

        AsyncFunction("applyPolicy") { policy: Map<String, Any?> ->
            val store = PolicyStore(context)
            val parsed = parsePolicy(policy)
            store.save(parsed)

            // El aviso se reprograma en cada aplicación de política: es la única
            // forma de que siga siendo correcto cuando el menor gana más tiempo
            // o el tutor se lo corta.
            TimeWarning.schedule(
                context,
                (policy["expiryWarningAt"] as? Number)?.toLong(),
                parsed.unlockedUntil,
            )

            if (parsed.blockedPackages.isEmpty()) {
                store.guardEnabled = false
                GuardWatchdog.cancel(context)
                GuardService.stop(context)
            } else {
                store.guardEnabled = true
                GuardService.start(context)
                // El vigilante se programa aquí y no solo dentro del servicio:
                // si el sistema impide arrancarlo en este momento, la alarma
                // sigue siendo el camino de vuelta.
                GuardWatchdog.schedule(context)
            }
        }

        AsyncFunction("clearPolicy") {
            val store = PolicyStore(context)
            store.clear()
            store.guardEnabled = false
            GuardWatchdog.cancel(context)
            TimeWarning.cancel(context)
            GuardService.stop(context)
        }

        AsyncFunction("getGuardStatus") {
            val store = PolicyStore(context)
            val policy = store.load()
            val reason = PolicyEvaluator.currentState(
                policy = policy,
                nowMs = System.currentTimeMillis(),
                calendar = Calendar.getInstance(),
            )

            // "Habilitado" y "vivo" son cosas distintas: el sistema puede haber
            // matado el servicio sin avisar a nadie. El latido es lo único que
            // distingue supervisar de creer que se supervisa.
            val heartbeatAge = System.currentTimeMillis() - store.lastHeartbeatAt
            val alive = store.lastHeartbeatAt > 0L && heartbeatAge < GuardWatchdog.HEARTBEAT_STALE_MS

            mapOf(
                "running" to (store.guardEnabled && alive),
                "enabled" to store.guardEnabled,
                "alive" to alive,
                "lastHeartbeatAt" to store.lastHeartbeatAt,
                "foregroundPackage" to store.lastForegroundPackage,
                "blockedNow" to (reason != BlockReason.PERMITIDO),
                "reason" to when (reason) {
                    BlockReason.PERMITIDO -> "permitido"
                    BlockReason.SIN_TIEMPO -> "sin_tiempo"
                    BlockReason.HORARIO_PROTEGIDO -> "horario_protegido"
                },
            )
        }
    }

    // -----------------------------------------------------------------------

    @Suppress("UNCHECKED_CAST")
    private fun parsePolicy(raw: Map<String, Any?>): Policy {
        val windows = (raw["scheduleWindows"] as? List<Map<String, Any?>>).orEmpty().map { window ->
            ScheduleWindow(
                weekdayMask = (window["weekdayMask"] as? Number)?.toInt() ?: 0,
                startMinute = (window["startMinute"] as? Number)?.toInt() ?: 0,
                endMinute = (window["endMinute"] as? Number)?.toInt() ?: 0,
            )
        }

        return Policy(
            blockedPackages = (raw["blockedPackages"] as? List<String>).orEmpty().toSet(),
            // JS entrega `null` cuando no hay tiempo desbloqueado; se traduce
            // a 0, que es "ya caducado" para el evaluador.
            unlockedUntil = (raw["unlockedUntil"] as? Number)?.toLong() ?: 0L,
            scheduleWindows = windows,
            shieldTitle = raw["shieldTitle"] as? String ?: Policy.EMPTY.shieldTitle,
            shieldMessage = raw["shieldMessage"] as? String ?: Policy.EMPTY.shieldMessage,
            challengeDeepLink = raw["challengeDeepLink"] as? String ?: Policy.EMPTY.challengeDeepLink,
        )
    }

    private fun launchSettings(intent: Intent) {
        val target = activity ?: context
        if (target === context) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { target.startActivity(intent) }
    }

    private fun adminComponent() = ComponentName(context, AdminReceiver::class.java)

    private fun isDeviceAdminActive(): Boolean {
        val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
        return manager?.isAdminActive(adminComponent()) == true
    }

    /**
     * `PACKAGE_USAGE_STATS` no se consulta con `checkSelfPermission`: es un
     * permiso de tipo appop, y la única forma fiable de saber si está concedido
     * es preguntarle a `AppOpsManager`.
     */
    private fun hasUsageAccess(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName,
            )
        }

        return if (mode == AppOpsManager.MODE_DEFAULT) {
            context.checkSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            mode == AppOpsManager.MODE_ALLOWED
        }
    }

    private fun hasNotificationPermission(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

    /**
     * Sin exención de optimización de batería, el sistema termina matando el
     * servicio guardián en la mayoría de capas de fabricante, y el control
     * deja de aplicarse en silencio. Es la causa número uno de "la app dejó de
     * funcionar sola", así que el estado se reporta para poder avisar al tutor.
     */
    private fun isBatteryUnrestricted(): Boolean {
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return power.isIgnoringBatteryOptimizations(context.packageName)
    }

    private fun resolveLabel(packageManager: PackageManager, packageName: String): String =
        runCatching {
            packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0)).toString()
        }.getOrDefault(packageName)

    /** Rasteriza el icono a PNG en base64, acotado para no inflar el puente. */
    private fun encodeIcon(drawable: Drawable): String = runCatching {
        val size = ICON_SIZE_PX
        val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
            Bitmap.createScaledBitmap(drawable.bitmap, size, size, true)
        } else {
            Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).also { output ->
                val canvas = Canvas(output)
                drawable.setBounds(0, 0, size, size)
                drawable.draw(canvas)
            }
        }

        ByteArrayOutputStream().use { stream ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        }
    }.getOrDefault("")

    private companion object {
        /** 96 px basta para una lista; ir más alto multiplica el tamaño del puente. */
        const val ICON_SIZE_PX = 96
    }
}
