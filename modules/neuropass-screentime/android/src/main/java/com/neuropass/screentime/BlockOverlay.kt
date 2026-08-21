package com.neuropass.screentime

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Pantalla de bloqueo que se dibuja sobre la app restringida.
 *
 * Es la única superficie de NEUROpass que un menor ve sin haberla pedido, así
 * que su diseño es una decisión de producto, no de ingeniería:
 *
 *  - **No es modal ni atrapa al usuario.** Deja siempre salir al inicio. Una
 *    superposición que secuestra el dispositivo es exactamente el patrón que
 *    usan las apps maliciosas y es causa directa de rechazo en Google Play.
 *  - **Explica y ofrece una salida.** El texto dice por qué está ahí y el
 *    botón principal lleva a resolver retos. Bloquear sin ofrecer el camino
 *    para desbloquear convierte la app en un castigo opaco.
 *  - **No culpa al menor.** "Se acabó el tiempo de juego", nunca "no te lo has
 *    ganado".
 *
 * La vista se construye en código y no en XML a propósito: un módulo de Expo
 * que arrastra layouts y temas propios choca con los recursos de la app
 * anfitriona y complica el `prebuild`.
 */
class BlockOverlay(private val context: Context) {

    private val windowManager =
        context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private var view: View? = null
    private var shownReason: BlockReason? = null

    fun show(policy: Policy, reason: BlockReason) {
        // Ya visible por el mismo motivo: no se reconstruye. Recrear la vista
        // en cada ciclo de sondeo produciría un parpadeo constante.
        if (view != null && shownReason == reason) return
        hide()

        if (!Settings.canDrawOverlays(context)) return

        val content = buildView(policy, reason)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // No se usa FLAG_NOT_TOUCHABLE: la capa debe recibir toques para
            // que sus botones funcionen. Tampoco se usan flags que bloqueen
            // las teclas del sistema; el botón de inicio sigue funcionando.
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.OPAQUE,
        ).apply { gravity = Gravity.CENTER }

        runCatching { windowManager.addView(content, params) }
            .onSuccess {
                view = content
                shownReason = reason
            }
    }

    fun hide() {
        val current = view ?: return
        runCatching { windowManager.removeView(current) }
        view = null
        shownReason = null
    }

    private fun buildView(policy: Policy, reason: BlockReason): View {
        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(BACKGROUND)
            setPadding(dp(32), dp(48), dp(32), dp(48))
        }

        root.addView(TextView(context).apply {
            text = "🧠"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 56f)
            gravity = Gravity.CENTER
        })

        root.addView(TextView(context).apply {
            text = when (reason) {
                BlockReason.HORARIO_PROTEGIDO -> "Ahora no toca pantalla"
                else -> policy.shieldTitle
            }
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
            gravity = Gravity.CENTER
            setPadding(0, dp(20), 0, dp(10))
        })

        root.addView(TextView(context).apply {
            text = when (reason) {
                BlockReason.HORARIO_PROTEGIDO ->
                    "Tu familia marcó este horario como tiempo sin juegos. Vuelve cuando termine."
                else -> policy.shieldMessage
            }
            setTextColor(SUBTLE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(32))
        })

        // Durante un horario protegido no se ofrece el atajo a los retos:
        // resolverlos no levantaría el bloqueo y prometerlo sería mentir.
        if (reason != BlockReason.HORARIO_PROTEGIDO) {
            root.addView(primaryButton("Resolver retos") {
                openDeepLink(policy.challengeDeepLink)
            })
        }

        root.addView(secondaryButton("Ir al inicio") {
            hide()
            context.startActivity(
                Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            )
        })

        return root
    }

    private fun openDeepLink(link: String) {
        hide()
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        runCatching { context.startActivity(intent) }.onFailure {
            // Si el enlace profundo no resuelve, se abre la app sin más: el
            // menor tiene que poder llegar a los retos de alguna forma.
            context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { fallback ->
                fallback.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(fallback)
            }
        }
    }

    private fun primaryButton(label: String, onClick: () -> Unit): Button =
        Button(context).apply {
            text = label
            setTextColor(Color.WHITE)
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(ACCENT)
            }
            setPadding(dp(28), dp(14), dp(28), dp(14))
            setOnClickListener { onClick() }
        }

    private fun secondaryButton(label: String, onClick: () -> Unit): Button =
        Button(context).apply {
            text = label
            setTextColor(SUBTLE)
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            background = null
            setPadding(dp(20), dp(16), dp(20), dp(8))
            setOnClickListener { onClick() }
        }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    private companion object {
        val BACKGROUND = Color.parseColor("#0B1020")
        val SUBTLE = Color.parseColor("#9AA4C4")
        val ACCENT = Color.parseColor("#6C5CE7")
    }
}
