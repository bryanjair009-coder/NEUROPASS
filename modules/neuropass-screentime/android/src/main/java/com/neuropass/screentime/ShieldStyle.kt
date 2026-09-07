package com.neuropass.screentime

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.InsetDrawable
import android.graphics.drawable.LayerDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Lenguaje visual de la pantalla de bloqueo.
 *
 * La pantalla de bloqueo se dibuja con `WindowManager` sobre otras apps, así que
 * no puede reutilizar ni un componente de React Native: la burbuja y la píldora
 * hay que volver a construirlas con la API de dibujo de Android. Este archivo
 * concentra esa traducción para que el overlay no acabe siendo una versión
 * pobre del resto de la app.
 *
 * Las equivalencias son deliberadas y hay una prueba que las vigila
 * (`tests/shield.test.ts`): los colores de marca y la proporción del degradado
 * son los mismos que usa `lib/color.ts` en TypeScript.
 */
object ShieldStyle {

    /** Mezcla hacia negro, equivalente a `darken` de TypeScript. */
    fun darken(color: Int, amount: Float): Int {
        val factor = 1f - amount.coerceIn(0f, 1f)
        // Se redondea, no se trunca: la versión de TypeScript redondea, y con
        // `toInt()` los mismos colores de marca salían con un bit de diferencia
        // entre la app y la pantalla de bloqueo.
        return Color.rgb(
            (Color.red(color) * factor).roundToInt(),
            (Color.green(color) * factor).roundToInt(),
            (Color.blue(color) * factor).roundToInt(),
        )
    }

    /** Mezcla hacia blanco, equivalente a `lighten` de TypeScript. */
    fun lighten(color: Int, amount: Float): Int {
        val t = amount.coerceIn(0f, 1f)
        return Color.rgb(
            (Color.red(color) + (255 - Color.red(color)) * t).roundToInt(),
            (Color.green(color) + (255 - Color.green(color)) * t).roundToInt(),
            (Color.blue(color) + (255 - Color.blue(color)) * t).roundToInt(),
        )
    }

    /**
     * Burbuja: óvalo con degradado diagonal.
     *
     * El degradado va del color aclarado al oscurecido, con la misma proporción
     * que en la app, para que una superficie de color no se lea como una mancha
     * plana sino como un volumen con una fuente de luz.
     */
    fun bubble(color: Int): GradientDrawable = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(lighten(color, 0.22f), color, darken(color, 0.18f)),
    ).apply { shape = GradientDrawable.OVAL }

    /**
     * Píldora con canto.
     *
     * Dos capas: una forma oscura al fondo y la píldora con degradado encima,
     * desplazada hacia arriba. Es la manera de conseguir en Android el borde
     * inferior grueso que en la app se hace con `borderBottomWidth`, que aquí
     * no existe.
     */
    fun pill(color: Int, radius: Float, edge: Int): LayerDrawable {
        val fondo = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
            setColor(darken(color, 0.28f))
        }

        val frente = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(lighten(color, 0.16f), darken(color, 0.06f)),
        ).apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
        }

        return LayerDrawable(arrayOf(fondo, InsetDrawable(frente, 0, 0, 0, edge)))
    }
}

/**
 * Icono de la pantalla de bloqueo: un cerebro con destellos alrededor.
 *
 * Reproduce el icono de la guía visual. El cerebro es un emoji porque su color
 * es constante y dibujarlo a mano daría una versión peor de algo que el sistema
 * ya renderiza bien; los destellos sí se dibujan, porque tienen que tomar el
 * color del texto para verse en los dos temas.
 */
class SparkIcon(
    context: android.content.Context,
    private val strokeColor: Int,
) : FrameLayout(context) {

    private val pincel = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = strokeColor
        strokeWidth = dp(3f)
        strokeCap = Paint.Cap.ROUND
    }

    init {
        setWillNotDraw(false)

        addView(
            TextView(context).apply {
                text = "🧠"
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 46f)
                gravity = Gravity.CENTER
            },
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, Gravity.CENTER),
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val cx = width / 2f
        val cy = height / 2f
        val interior = width * 0.36f
        val exterior = width * 0.47f

        // Cinco destellos en el arco superior, como en la referencia: no rodean
        // el cerebro por completo, solo lo coronan.
        for (i in 0 until 5) {
            val angulo = Math.toRadians(-150.0 + i * 30.0)
            canvas.drawLine(
                cx + (cos(angulo) * interior).toFloat(),
                cy + (sin(angulo) * interior).toFloat(),
                cx + (cos(angulo) * exterior).toFloat(),
                cy + (sin(angulo) * exterior).toFloat(),
                pincel,
            )
        }
    }

    private fun dp(value: Float): Float = value * resources.displayMetrics.density
}

/** Vista cuadrada: el icono necesita alto y ancho iguales para que el arco cuadre. */
class SquareHost(context: android.content.Context, private val child: View) :
    FrameLayout(context) {

    init {
        addView(child, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, widthMeasureSpec)
    }
}
