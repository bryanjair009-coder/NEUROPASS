package com.neuropass.screentime

import android.graphics.Color
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.InsetDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.StateListDrawable
import kotlin.math.roundToInt

/**
 * Lenguaje visual de la pantalla de bloqueo.
 *
 * La pantalla de bloqueo se dibuja con `WindowManager` sobre otras apps, así que
 * no puede reutilizar ni un componente de React Native: la píldora con canto y
 * la sombra de AXO hay que volver a construirlas con la API de dibujo de
 * Android. Este archivo concentra esa traducción para que el overlay no acabe
 * siendo una versión pobre del resto de la app.
 *
 * Las equivalencias son deliberadas y hay una prueba que las vigila
 * (`tests/shield.test.ts`): la aritmética de color y la proporción del
 * degradado son las mismas que usan `lib/color.ts` y el botón principal.
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
     * Píldora con canto, igual que el botón principal de la app.
     *
     * Dos capas: el canto al fondo y la cara con degradado encima, recortada por
     * abajo. Es la forma de conseguir en Android el relieve que en la app se
     * hace con una cara sobre un fondo de otro color.
     *
     * Al pulsar, la cara se oscurece un poco. La app hunde la cara sobre el
     * canto; aquí un fondo no puede moverse, y sin ninguna respuesta el menor
     * no sabría si el toque llegó.
     */
    fun pill(color: Int, canto: Int, radius: Float, edge: Int): Drawable = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_pressed), capas(darken(color, 0.08f), canto, radius, edge))
        addState(intArrayOf(), capas(color, canto, radius, edge))
    }

    private fun capas(color: Int, canto: Int, radius: Float, edge: Int): LayerDrawable {
        val fondo = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
            setColor(canto)
        }

        val cara = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(lighten(color, 0.2f), color),
        ).apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
        }

        return LayerDrawable(arrayOf(fondo, InsetDrawable(cara, 0, 0, 0, edge)))
    }

    /**
     * Sombra de apoyo de AXO: un óvalo translúcido del color del contexto.
     *
     * En el prototipo va desenfocada; aquí basta la transparencia, porque un
     * desenfoque en tiempo real sobre otra app cuesta más de lo que aporta.
     */
    fun sombra(color: Int): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.argb((0.45f * 255).roundToInt(), Color.red(color), Color.green(color), Color.blue(color)))
    }
}
