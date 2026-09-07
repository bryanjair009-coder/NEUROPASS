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
 * Icono de la pantalla de bloqueo: un cerebro dentro de un foco.
 *
 * Es la metáfora de la guía visual —la idea— y no un cerebro suelto: el foco es
 * lo que convierte "estás bloqueado" en "se te va a ocurrir algo".
 *
 * El bulbo, el casquillo y los destellos se dibujan en Canvas porque tienen que
 * tomar el color del texto para verse en los dos temas; un icono de color fijo
 * desaparecería sobre uno de los dos fondos. El cerebro sí es emoji: su color es
 * constante y dibujarlo a mano daría una versión peor de algo que el sistema ya
 * renderiza bien.
 *
 * Las proporciones se expresan como fracciones del lado, no en dp, para que el
 * icono se pueda escalar sin volver a cuadrar el dibujo.
 */
class IdeaIcon(
    context: android.content.Context,
    private val strokeColor: Int,
) : FrameLayout(context) {

    private val cerebro = TextView(context).apply {
        text = "🧠"
        gravity = Gravity.CENTER
    }

    init {
        setWillNotDraw(false)
        addView(cerebro, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)

        // El cerebro se dimensiona en píxeles y no en sp: tiene que caber dentro
        // del bulbo, y el bulbo se mide en fracciones del lado de la vista. Con
        // sp el tamaño dependería de los ajustes de fuente del sistema y el
        // emoji se saldría del dibujo en un teléfono con letra grande.
        cerebro.setTextSize(TypedValue.COMPLEX_UNIT_PX, w * BULBO_RADIO * 1.35f)
        cerebro.translationY = -h * (0.5f - BULBO_CENTRO)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val lado = width.toFloat()
        val cx = lado / 2f
        val cy = height * BULBO_CENTRO
        val radio = lado * BULBO_RADIO

        val trazo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = strokeColor
            style = Paint.Style.STROKE
            strokeWidth = lado * 0.035f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }

        // Bulbo.
        canvas.drawCircle(cx, cy, radio, trazo)

        // Cuello: dos lados que bajan desde el bulbo hacia el casquillo.
        val cuelloAncho = radio * 0.46f
        val cuelloArriba = cy + radio * 0.88f
        val cuelloAbajo = cy + radio * 1.24f
        canvas.drawLine(cx - cuelloAncho, cuelloArriba, cx - cuelloAncho, cuelloAbajo, trazo)
        canvas.drawLine(cx + cuelloAncho, cuelloArriba, cx + cuelloAncho, cuelloAbajo, trazo)

        // Casquillo: las roscas, que es lo que hace reconocible al foco.
        val roscaAncho = radio * 0.42f
        for (i in 0 until 3) {
            val y = cuelloAbajo + radio * 0.16f * i
            canvas.drawLine(cx - roscaAncho, y, cx + roscaAncho, y, trazo)
        }

        // Destellos: coronan el bulbo sin rodearlo, como en la referencia.
        val interior = radio * 1.28f
        val exterior = radio * 1.62f
        for (i in 0 until 5) {
            val angulo = Math.toRadians(-152.0 + i * 31.0)
            canvas.drawLine(
                cx + (cos(angulo) * interior).toFloat(),
                cy + (sin(angulo) * interior).toFloat(),
                cx + (cos(angulo) * exterior).toFloat(),
                cy + (sin(angulo) * exterior).toFloat(),
                trazo,
            )
        }
    }

    private companion object {
        /** Radio del bulbo como fracción del lado de la vista. */
        const val BULBO_RADIO = 0.26f

        /** Altura del centro del bulbo; deja sitio abajo para el casquillo. */
        const val BULBO_CENTRO = 0.40f
    }
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
