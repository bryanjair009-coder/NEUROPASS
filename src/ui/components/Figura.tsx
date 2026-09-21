import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

import type { Figura as DatosFigura, FormaFigura } from '@/domain/ilustracion';
import { darken, lighten } from '@/lib/color';

/**
 * Una figura dibujada.
 *
 * Sustituye a los caracteres ★ ◆ ▲ que se usaban antes. Aquellos dependían de
 * la tipografía de cada teléfono —en algunos un rombo salía como un cuadrado
 * girado diminuto— y se veían planos. Aquí cada forma tiene volumen —un
 * degradado, un borde más oscuro y un brillo— y las llenas llevan una carita:
 * es el mismo lenguaje de AXO, y convierte una figura geométrica en algo que
 * un niño de seis años mira con gusto.
 *
 * Las huecas no llevan cara ni brillo, solo el contorno: en los retos de
 * lógica «llena o hueca» es la regla que hay que descubrir, y cualquier
 * adorno la haría menos evidente.
 *
 * Todo se dibuja en una caja de 100 × 100 y se escala al tamaño pedido.
 */

/** Tinta de la cara. Es la del texto del tema día: funciona sobre cualquier relleno de color. */
const TINTA_CARA = '#1A1240';

function estrella(): string {
  const puntos: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radio = i % 2 === 0 ? 45 : 20;
    const angulo = -Math.PI / 2 + (i * Math.PI) / 5;
    puntos.push(`${(50 + radio * Math.cos(angulo)).toFixed(1)} ${(55 + radio * Math.sin(angulo)).toFixed(1)}`);
  }
  return `M${puntos.join(' L')} Z`;
}

function hexagono(): string {
  const puntos: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angulo = (i * Math.PI) / 3;
    puntos.push(`${(50 + 42 * Math.cos(angulo)).toFixed(1)} ${(50 + 42 * Math.sin(angulo)).toFixed(1)}`);
  }
  return `M${puntos.join(' L')} Z`;
}

const TRAZOS: Record<FormaFigura, string> = {
  circulo: 'M50 10 A40 40 0 1 1 49.99 10 Z',
  cuadrado: 'M28 12 H72 Q88 12 88 28 V72 Q88 88 72 88 H28 Q12 88 12 72 V28 Q12 12 28 12 Z',
  triangulo: 'M50 12 L88 84 Q90 88 85 88 H15 Q10 88 12 84 Z',
  rombo: 'M50 8 L90 50 L50 92 L10 50 Z',
  cruz: 'M38 10 H62 V38 H90 V62 H62 V90 H38 V62 H10 V38 H38 Z',
  corazon: 'M50 86 C22 66 8 50 12 32 C16 16 38 12 50 28 C62 12 84 16 88 32 C92 50 78 66 50 86 Z',
  gota: 'M50 8 C58 22 82 46 82 64 A32 32 0 0 1 18 64 C18 46 42 22 50 8 Z',
  luna: 'M60 10 A40 40 0 1 0 90 62 A30 30 0 1 1 60 10 Z',
  estrella: estrella(),
  hexagono: hexagono(),
};

/**
 * Dónde va la cara en cada forma: su centro visual, que en el triángulo o la
 * gota está más abajo que el centro de la caja. La luna no lleva: en una forma
 * tan estrecha la cara quedaría cortada.
 */
const CARAS: Partial<Record<FormaFigura, { readonly x: number; readonly y: number }>> = {
  circulo: { x: 50, y: 50 },
  cuadrado: { x: 50, y: 50 },
  triangulo: { x: 50, y: 64 },
  rombo: { x: 50, y: 50 },
  cruz: { x: 50, y: 50 },
  corazon: { x: 50, y: 44 },
  gota: { x: 50, y: 62 },
  hexagono: { x: 50, y: 50 },
  estrella: { x: 50, y: 56 },
};

/** Brillo especular; solo en las formas con una superficie amplia arriba a la izquierda. */
const BRILLOS: Partial<Record<FormaFigura, { readonly x: number; readonly y: number }>> = {
  circulo: { x: 36, y: 28 },
  cuadrado: { x: 30, y: 26 },
  corazon: { x: 30, y: 30 },
  gota: { x: 38, y: 48 },
  hexagono: { x: 34, y: 28 },
};

export function Figura({ figura, tamano }: { figura: DatosFigura; tamano: number }) {
  // Identificador propio del degradado: varias figuras en la misma pantalla no
  // pueden compartirlo, o todas tomarían el color de la primera.
  const id = `figura${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const trazo = TRAZOS[figura.forma];

  // El SVG va dentro de una vista: en web, un `<svg>` suelto queda por debajo
  // de cualquier fondo en posición absoluta —como el degradado de las
  // opciones— aunque vaya después en el árbol, y la figura desaparecía.
  const caja = { width: tamano, height: tamano };

  if (figura.hueca) {
    return (
      <View style={caja}>
        <Svg width={tamano} height={tamano} viewBox="0 0 100 100">
          <Path d={trazo} fill="none" stroke={figura.color} strokeWidth={9} strokeLinejoin="round" />
        </Svg>
      </View>
    );
  }

  const cara = CARAS[figura.forma];
  const brillo = BRILLOS[figura.forma];

  return (
    <View style={caja}>
      <Svg width={tamano} height={tamano} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lighten(figura.color, 0.3)} />
            <Stop offset="1" stopColor={figura.color} />
          </LinearGradient>
        </Defs>
        <Path
          d={trazo}
          fill={`url(#${id})`}
          stroke={darken(figura.color, 0.22)}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        {brillo ? (
          <Ellipse
            cx={brillo.x}
            cy={brillo.y}
            rx={11}
            ry={6}
            fill="#FFFFFF"
            opacity={0.45}
            transform={`rotate(-25 ${brillo.x} ${brillo.y})`}
          />
        ) : null}
        {cara ? (
          <>
            <Circle cx={cara.x - 10} cy={cara.y} r={4.5} fill={TINTA_CARA} />
            <Circle cx={cara.x + 10} cy={cara.y} r={4.5} fill={TINTA_CARA} />
            <Circle cx={cara.x - 8.5} cy={cara.y - 1.5} r={1.5} fill="#FFFFFF" />
            <Circle cx={cara.x + 11.5} cy={cara.y - 1.5} r={1.5} fill="#FFFFFF" />
            <Circle cx={cara.x - 17} cy={cara.y + 7} r={4} fill="#FF5DA0" opacity={0.35} />
            <Circle cx={cara.x + 17} cy={cara.y + 7} r={4} fill="#FF5DA0" opacity={0.35} />
            <Path
              d={`M${cara.x - 6} ${cara.y + 8} Q${cara.x} ${cara.y + 14} ${cara.x + 6} ${cara.y + 8}`}
              stroke={TINTA_CARA}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
