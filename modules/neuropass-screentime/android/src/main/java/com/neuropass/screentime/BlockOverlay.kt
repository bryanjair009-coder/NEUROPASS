package com.neuropass.screentime

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
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
 *  - **No se repite.** El mensaje cambia en cada aparición. Es la pantalla que
 *    más veces ve un menor, y una idéntica veinte veces al día deja de leerse a
 *    los tres días.
 *
 * AXO con el rompecabezas ocupa el centro y el mensaje va debajo como texto
 * suelto. Antes había una burbuja de color con el mensaje dentro, y competía
 * con el personaje por el mismo punto de atención: AXO ya dice de qué va la
 * pantalla antes de que se lea nada.
 *
 * La vista se construye en código y no en XML a propósito: un módulo de Expo
 * que arrastra layouts y temas propios choca con los recursos de la app
 * anfitriona y complica el `prebuild`. Los dos recursos que sí trae —la imagen
 * y la tipografía— llevan el prefijo `neuropass_` por la misma razón.
 */
class BlockOverlay(private val context: Context) {

    private val windowManager =
        context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private var view: View? = null
    private var shownReason: BlockReason? = null
    private var flotacion: ValueAnimator? = null

    fun show(policy: Policy, reason: BlockReason) {
        // Ya visible por el mismo motivo: no se reconstruye. Recrear la vista
        // en cada ciclo de sondeo produciría un parpadeo constante, y de paso
        // cambiaría el mensaje varias veces por segundo.
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
            .onFailure { detenerFlotacion() }
    }

    fun hide() {
        // La animación se detiene antes de retirar la vista: un animador
        // infinito que sobrevive a su vista la retiene en memoria para siempre.
        detenerFlotacion()
        val current = view ?: return
        runCatching { windowManager.removeView(current) }
        view = null
        shownReason = null
    }

    private fun detenerFlotacion() {
        flotacion?.cancel()
        flotacion = null
    }

    private fun buildView(policy: Policy, reason: BlockReason): View {
        val oscuro = policy.darkTheme
        val fondo = if (oscuro) FONDO_OSCURO else FONDO_CLARO
        val texto = if (oscuro) TEXTO_OSCURO else TEXTO_CLARO
        val textoSuave = if (oscuro) TEXTO_SUAVE_OSCURO else TEXTO_SUAVE_CLARO
        // Si la fuente no cargara se usa la del sistema: la pantalla de bloqueo
        // tiene que salir aunque sea con otra letra.
        val baloo = runCatching { context.resources.getFont(R.font.neuropass_baloo2_bold) }.getOrNull()

        // Durante un horario protegido no se ofrece el atajo a los retos:
        // resolverlos no levantaría el bloqueo, y prometerlo sería mentirle al
        // menor.
        val protegido = reason == BlockReason.HORARIO_PROTEGIDO

        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(fondo)
            setPadding(dp(28), dp(44), dp(28), dp(44))
        }

        root.addView(axo(), LinearLayout.LayoutParams(dp(ANCHO_AXO), LinearLayout.LayoutParams.WRAP_CONTENT))

        root.addView(
            TextView(context).apply {
                text = if (protegido) "HORA DE DESCANSAR" else "AXO TE ESPERA"
                setTextColor(if (oscuro) AQUA else AQUA_OSC)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                letterSpacing = 0.14f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
            },
            envolvente().apply { topMargin = dp(24) },
        )

        val mensaje = if (protegido) {
            "Ahora no toca pantalla. Tu familia reservó este rato para descansar."
        } else {
            policy.shieldMessages.randomOrNull() ?: policy.shieldMessage
        }

        root.addView(
            TextView(context).apply {
                text = mensaje
                setTextColor(texto)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 25f)
                baloo?.let { typeface = it }
                gravity = Gravity.CENTER
                maxWidth = dp(290)
                includeFontPadding = false
                // El interlineado exacto solo existe desde Android 9. Antes se
                // deja el de la fuente, que en Baloo ya es holgado.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    lineHeight = sp(32)
                }
            },
            envolvente().apply { topMargin = dp(8) },
        )

        if (!protegido) {
            root.addView(
                pillButton("Resolver retos", baloo) { openDeepLink(policy.challengeDeepLink) },
                LinearLayout.LayoutParams(dp(278), dp(62)).apply { topMargin = dp(24) },
            )
        }

        root.addView(
            secondaryButton("volver al inicio", textoSuave) {
                hide()
                context.startActivity(
                    Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                )
            },
            envolvente().apply { topMargin = dp(if (protegido) 24 else 10) },
        )

        return root
    }

    /**
     * AXO sobre su sombra.
     *
     * La sombra es lo que lo asienta: un recorte flotando sin nada debajo se
     * lee como una pegatina. La flotación usa un animador del sistema, así que
     * con «quitar animaciones» activado en accesibilidad termina al instante y
     * AXO se queda quieto sin que haya que comprobarlo aquí.
     */
    private fun axo(): View {
        val contenedor = FrameLayout(context)

        contenedor.addView(
            View(context).apply { background = ShieldStyle.sombra(AQUA) },
            FrameLayout.LayoutParams(dp(150), dp(20), Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL),
        )

        val imagen = ImageView(context).apply {
            setImageResource(R.drawable.neuropass_axo_reto)
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            // Es ilustración: el significado lo lleva el texto de debajo.
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        contenedor.addView(
            imagen,
            FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT)
                .apply { bottomMargin = dp(10) },
        )

        flotacion = ObjectAnimator.ofFloat(imagen, View.TRANSLATION_Y, 0f, -dp(12).toFloat()).apply {
            duration = 2300
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }

        return contenedor
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

    private fun pillButton(label: String, fuente: Typeface?, onClick: () -> Unit): Button =
        Button(context).apply {
            text = label
            setTextColor(Color.WHITE)
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 19f)
            fuente?.let { typeface = it }
            background = ShieldStyle.pill(MORADO, MORADO_OSC, dp(31).toFloat(), dp(CANTO))
            // Sin esto el botón de Material dibuja su propia sombra rectangular
            // alrededor de la píldora redondeada.
            stateListAnimator = null
            // El relleno inferior compensa el canto para que el texto quede
            // centrado en la cara y no en la píldora entera.
            setPadding(dp(24), 0, dp(24), dp(CANTO))
            setOnClickListener { onClick() }
        }

    /** Enlace de texto, sin fondo: la salida existe pero no compite con el reto. */
    private fun secondaryButton(label: String, color: Int, onClick: () -> Unit): Button =
        Button(context).apply {
            text = label
            setTextColor(color)
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.DEFAULT_BOLD
            background = null
            stateListAnimator = null
            minHeight = dp(48)
            setPadding(dp(20), dp(10), dp(20), dp(10))
            setOnClickListener { onClick() }
        }

    private fun envolvente() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    )

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    private fun sp(value: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value.toFloat(), context.resources.displayMetrics).toInt()

    private companion object {
        /** Ancho de AXO en dp, el del prototipo. */
        const val ANCHO_AXO = 238

        /** Alto del canto de la píldora, el mismo que el del botón principal de la app. */
        const val CANTO = 5

        // Los mismos valores que paletaDia, paletaNoche y marca en TypeScript.
        // tests/shield.test.ts comprueba que no se separen.
        val FONDO_CLARO = Color.parseColor("#F4F1FF")
        val FONDO_OSCURO = Color.parseColor("#070E24")
        val TEXTO_CLARO = Color.parseColor("#1A1240")
        val TEXTO_OSCURO = Color.parseColor("#EAF2FF")
        val TEXTO_SUAVE_CLARO = Color.parseColor("#6A5F94")
        val TEXTO_SUAVE_OSCURO = Color.parseColor("#93A2CC")
        val MORADO = Color.parseColor("#7C5FFF")
        val MORADO_OSC = Color.parseColor("#5B3FE0")
        val AQUA = Color.parseColor("#22D3EE")
        val AQUA_OSC = Color.parseColor("#0E9FBC")
    }
}
