package com.neuropass.screentime

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
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
 *  - **Explica y ofrece una salida.** El botón principal lleva a resolver retos.
 *    Bloquear sin ofrecer el camino para desbloquear convierte la app en un
 *    castigo opaco.
 *  - **No culpa al menor.** Los mensajes plantean lo que viene como algo que
 *    vale la pena, nunca como un castigo por lo que hizo.
 *  - **No se repite.** El mensaje y la pareja de colores cambian en cada
 *    aparición. Es la pantalla que más veces ve un menor, y una idéntica
 *    veinte veces al día deja de leerse a los tres días.
 *
 * La vista se construye en código y no en XML a propósito: un módulo de Expo
 * que arrastra layouts y temas propios choca con los recursos de la app
 * anfitriona y complica el `prebuild`.
 *
 * El lenguaje visual —burbuja con degradado, píldora con canto— se reconstruye
 * aquí con la API de dibujo de Android en `ShieldStyle`, porque una vista de
 * `WindowManager` no puede reutilizar nada de React Native.
 */
class BlockOverlay(private val context: Context) {

    private val windowManager =
        context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private var view: View? = null
    private var shownReason: BlockReason? = null

    fun show(policy: Policy, reason: BlockReason) {
        // Ya visible por el mismo motivo: no se reconstruye. Recrear la vista
        // en cada ciclo de sondeo produciría un parpadeo constante, y de paso
        // cambiaría el mensaje y el color varias veces por segundo.
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
        val oscuro = policy.darkTheme
        val fondo = if (oscuro) FONDO_OSCURO else FONDO_CLARO
        val texto = if (oscuro) TEXTO_OSCURO else TEXTO_CLARO

        val acento = policy.shieldAccents.randomOrNull() ?: ACENTO_POR_OMISION

        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(fondo)
            setPadding(dp(32), dp(48), dp(32), dp(48))
        }

        root.addView(
            SquareHost(context, IdeaIcon(context, texto)),
            LinearLayout.LayoutParams(dp(104), dp(104)),
        )

        // Durante un horario protegido el texto es fijo y no se ofrece el atajo
        // a los retos: resolverlos no levantaría el bloqueo, y prometerlo sería
        // mentirle al menor.
        val mensaje = if (reason == BlockReason.HORARIO_PROTEGIDO) {
            "Ahora no toca pantalla. Tu familia reservó este rato para descansar."
        } else {
            policy.shieldMessages.randomOrNull() ?: policy.shieldMessage
        }

        root.addView(
            TextView(context).apply {
                text = mensaje
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
                gravity = Gravity.CENTER
                background = ShieldStyle.bubble(acento.bubble)
                setPadding(dp(32), dp(32), dp(32), dp(32))
            },
            LinearLayout.LayoutParams(dp(250), dp(250)).apply {
                topMargin = dp(24)
                bottomMargin = dp(36)
            },
        )

        if (reason != BlockReason.HORARIO_PROTEGIDO) {
            root.addView(
                pillButton("Resolver retos", acento.action) {
                    openDeepLink(policy.challengeDeepLink)
                },
                LinearLayout.LayoutParams(dp(256), LinearLayout.LayoutParams.WRAP_CONTENT),
            )
        }

        root.addView(
            secondaryButton("volver al inicio", texto) {
                hide()
                context.startActivity(
                    Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                )
            }
        )

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

    private fun pillButton(label: String, color: Int, onClick: () -> Unit): Button =
        Button(context).apply {
            text = label
            setTextColor(Color.WHITE)
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            background = ShieldStyle.pill(color, dp(30).toFloat(), dp(4))
            setPadding(dp(28), dp(14), dp(28), dp(18))
            setOnClickListener { onClick() }
        }

    /** Enlace de texto, sin fondo: la salida existe pero no compite con el reto. */
    private fun secondaryButton(label: String, color: Int, onClick: () -> Unit): Button =
        Button(context).apply {
            text = label
            setTextColor(color)
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            background = null
            setPadding(dp(20), dp(18), dp(20), dp(8))
            setOnClickListener { onClick() }
        }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    private companion object {
        // Los mismos valores que lightPalette y darkPalette en TypeScript.
        // tests/shield.test.ts comprueba que no se separen.
        val FONDO_CLARO = Color.parseColor("#FAFBFF")
        val FONDO_OSCURO = Color.parseColor("#0B1020")
        val TEXTO_CLARO = Color.parseColor("#101B3F")
        val TEXTO_OSCURO = Color.parseColor("#F2F5FF")

        /** Respaldo si la política llegara sin acentos. */
        val ACENTO_POR_OMISION = ShieldAccent(
            bubble = Color.parseColor("#C64FE3"),
            action = Color.parseColor("#21BFE3"),
        )
    }
}
