import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { ElementoEscena, Escena as DatosEscena } from '@/domain/ilustracion';
import { radius } from '@/ui/theme';

/**
 * Escena ilustrada.
 *
 * Sustituye a los tres emoji seguidos (🚲🌆🌅) con los que se pedía inventar
 * un título. Tres emoji no forman una escena: el menor tenía que imaginar cómo
 * se relacionaban, y en cada teléfono se veían distintos. Aquí la escena se
 * compone por capas —cielo, clima, suelo y hasta tres elementos— con el mismo
 * estilo plano y redondeado del resto de la app.
 *
 * Se dibuja en un lienzo de 320 × 180 y se escala al ancho disponible. Los
 * colores son de ilustración, no de la paleta: una noche tiene que ser de
 * noche aunque la app esté en tema día.
 */

const ANCHO = 320;
const ALTO = 180;

const CIELOS: Record<DatosEscena['cielo'], readonly [string, string]> = {
  dia: ['#7CC8FF', '#D8F1FF'],
  atardecer: ['#FF8A5B', '#FFD37A'],
  noche: ['#18224F', '#3B4C8F'],
};

const COLINAS: Record<'pasto' | 'arena' | 'nieve', readonly [string, string]> = {
  pasto: ['#7AD67F', '#4FBF62'],
  arena: ['#F7DC9A', '#EFC877'],
  nieve: ['#EEF4FF', '#D8E4FA'],
};

/** Altura del suelo en la que se apoyan los elementos. */
function lineaDeSuelo(suelo: DatosEscena['suelo']): number {
  if (suelo === 'mar') return 130;
  if (suelo === 'playa') return 150;
  return 140;
}

/** Posiciones horizontales según cuántos elementos haya, para repartirlos sin amontonarlos. */
function posiciones(cantidad: number): readonly number[] {
  if (cantidad <= 1) return [160];
  if (cantidad === 2) return [100, 220];
  return [70, 160, 250];
}

const ESTRELLAS: readonly (readonly [number, number])[] = [
  [36, 28], [88, 54], [140, 20], [196, 46], [230, 18], [300, 70], [118, 78], [22, 70],
];

const COPOS: readonly (readonly [number, number])[] = [
  [20, 30], [60, 70], [96, 22], [130, 96], [170, 58], [205, 26], [240, 88], [280, 44], [310, 100], [48, 110], [150, 16], [262, 120],
];

export function Escena({ escena }: { escena: DatosEscena }) {
  const id = `escena${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const noche = escena.cielo === 'noche';
  const suelo = lineaDeSuelo(escena.suelo);
  const xs = posiciones(escena.elementos.length);

  return (
    <View style={styles.marco} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CIELOS[escena.cielo][0]} />
            <Stop offset="1" stopColor={CIELOS[escena.cielo][1]} />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={ANCHO} height={ALTO} fill={`url(#${id})`} />

        {escena.astros.includes('estrellas')
          ? ESTRELLAS.map(([x, y]) => (
              <Path
                key={`${x}-${y}`}
                d="M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z"
                fill="#FFF6C2"
                transform={`translate(${x} ${y})`}
              />
            ))
          : null}
        {escena.astros.includes('sol') ? <Sol /> : null}
        {escena.astros.includes('luna') ? (
          <Path d="M8 -18 A20 20 0 1 0 22 10 A16 16 0 1 1 8 -18 Z" fill="#FFF1A8" transform="translate(250 40)" />
        ) : null}
        {escena.astros.includes('nube') ? (
          <>
            <Nube x={52} y={44} />
            <Nube x={176} y={30} />
          </>
        ) : null}

        {escena.clima === 'lluvia'
          ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((i) =>
              [62, 96].map((y) => (
                <Line
                  key={`${i}-${y}`}
                  x1={18 + i * 29 + (y === 96 ? 14 : 0)}
                  y1={y}
                  x2={12 + i * 29 + (y === 96 ? 14 : 0)}
                  y2={y + 14}
                  stroke="#9ED0FF"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              )),
            )
          : null}

        <Suelo tipo={escena.suelo} />

        {/* De noche el suelo se oscurece; si no, el paisaje parece de día bajo un cielo nocturno. */}
        {noche ? <Rect x={0} y={108} width={ANCHO} height={ALTO - 108} fill="#0B1238" opacity={0.3} /> : null}

        {escena.elementos.map((elemento, indice) => (
          <G key={`${elemento}-${indice}`} transform={`translate(${xs[indice] ?? 160} ${suelo})`}>
            {dibujarElemento(elemento, noche)}
          </G>
        ))}

        {escena.clima === 'nieve'
          ? COPOS.map(([x, y]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} fill="#FFFFFF" opacity={0.95} />)
          : null}
      </Svg>
    </View>
  );
}

function Sol() {
  return (
    <G transform="translate(262 42)">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angulo = (i * Math.PI) / 4;
        return (
          <Line
            key={i}
            x1={Math.cos(angulo) * 24}
            y1={Math.sin(angulo) * 24}
            x2={Math.cos(angulo) * 32}
            y2={Math.sin(angulo) * 32}
            stroke="#FFD23F"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        );
      })}
      <Circle cx={0} cy={0} r={18} fill="#FFD23F" stroke="#F5B400" strokeWidth={2} />
    </G>
  );
}

function Nube({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x} ${y})`} opacity={0.95}>
      <Circle cx={0} cy={0} r={13} fill="#FFFFFF" />
      <Circle cx={16} cy={-7} r={16} fill="#FFFFFF" />
      <Circle cx={33} cy={0} r={12} fill="#FFFFFF" />
      <Circle cx={16} cy={5} r={13} fill="#FFFFFF" />
    </G>
  );
}

function Suelo({ tipo }: { tipo: DatosEscena['suelo'] }) {
  if (tipo === 'mar') {
    return (
      <>
        <Rect x={0} y={118} width={ANCHO} height={62} fill="#3BA9E6" />
        <Rect x={0} y={152} width={ANCHO} height={28} fill="#2E8FD0" />
        <Olas y={136} />
        <Olas y={164} />
      </>
    );
  }

  if (tipo === 'playa') {
    return (
      <>
        <Rect x={0} y={110} width={ANCHO} height={50} fill="#3BA9E6" />
        <Olas y={128} />
        <Path d="M0 148 Q160 134 320 150 V180 H0 Z" fill="#F7DC9A" />
      </>
    );
  }

  const [atras, frente] = COLINAS[tipo];
  return (
    <>
      <Path d="M0 128 Q90 110 180 124 T320 118 V180 H0 Z" fill={atras} />
      <Path d="M0 146 Q110 132 205 146 T320 140 V180 H0 Z" fill={frente} />
    </>
  );
}

function Olas({ y }: { y: number }) {
  return (
    <Path
      d={`M0 ${y} q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0`}
      stroke="#FFFFFF"
      strokeWidth={2}
      fill="none"
      opacity={0.45}
    />
  );
}

/** Cada elemento se dibuja con su base en (0, 0): el suelo lo coloca. */
function dibujarElemento(elemento: ElementoEscena, noche: boolean): ReactNode {
  switch (elemento) {
    case 'arbol':
      return (
        <>
          <Rect x={-5} y={-28} width={10} height={28} rx={3} fill="#8B5A2B" />
          <Circle cx={-13} cy={-34} r={14} fill="#27A862" />
          <Circle cx={13} cy={-34} r={14} fill="#27A862" />
          <Circle cx={0} cy={-47} r={19} fill="#2FBF71" />
        </>
      );
    case 'casa':
      return (
        <>
          <Rect x={-28} y={-40} width={56} height={40} rx={3} fill="#FFB86B" stroke="#E0913F" strokeWidth={2} />
          <Path d="M-34 -38 L0 -66 L34 -38 Z" fill="#E4574B" stroke="#C4453B" strokeWidth={2} strokeLinejoin="round" />
          <Rect x={-7} y={-22} width={14} height={22} rx={2} fill="#8B5A2B" />
          {/* De noche la ventana está encendida: es lo que hace acogedora la escena. */}
          <Rect x={10} y={-32} width={12} height={10} rx={2} fill={noche ? '#FFE27A' : '#BFE9FF'} />
        </>
      );
    case 'montana':
      return (
        <>
          <Path d="M-62 0 L-12 -82 L38 0 Z" fill="#8E9BB5" />
          <Path d="M-8 0 L30 -58 L68 0 Z" fill="#A7B3CC" />
          <Path d="M-26 -59 L-12 -82 L2 -59 L-5 -54 L-12 -60 L-19 -54 Z" fill="#FFFFFF" />
          <Path d="M20 -43 L30 -58 L40 -43 L35 -40 L30 -45 L25 -40 Z" fill="#FFFFFF" />
        </>
      );
    case 'barco':
      return (
        <>
          <Line x1={0} y1={-8} x2={0} y2={-60} stroke="#6B4B2A" strokeWidth={3} strokeLinecap="round" />
          <Path d="M3 -58 L30 -16 H3 Z" fill="#FFFFFF" stroke="#D5DCEA" strokeWidth={1.5} />
          <Path d="M-3 -52 L-22 -16 H-3 Z" fill="#FFF3D6" />
          <Path d="M-34 -8 H34 L24 8 H-24 Z" fill="#E4574B" stroke="#C4453B" strokeWidth={2} strokeLinejoin="round" />
        </>
      );
    case 'cohete':
      return (
        <>
          <Path d="M-8 -20 Q0 4 8 -20 Z" fill="#FF9F1C" />
          <Path d="M-12 -34 L-24 -14 L-12 -20 Z" fill="#E4574B" />
          <Path d="M12 -34 L24 -14 L12 -20 Z" fill="#E4574B" />
          <Path d="M0 -84 C16 -70 16 -34 12 -20 H-12 C-16 -34 -16 -70 0 -84 Z" fill="#EEF2FA" stroke="#C8D1E6" strokeWidth={2} />
          <Circle cx={0} cy={-54} r={7} fill="#5BC0FF" stroke="#2F7BFF" strokeWidth={2} />
        </>
      );
    case 'globo':
      return (
        <>
          <Path d="M0 -44 Q5 -30 0 -18 T0 0" stroke="#6A5F94" strokeWidth={1.5} fill="none" />
          <Path d="M-4 -46 L4 -46 L0 -42 Z" fill="#E0458A" />
          <Ellipse cx={0} cy={-68} rx={18} ry={22} fill="#FF5DA0" />
          <Ellipse cx={-7} cy={-76} rx={5} ry={8} fill="#FFFFFF" opacity={0.45} />
        </>
      );
    case 'cactus':
      return (
        <>
          <Path d="M-8 -30 H-18 Q-22 -30 -22 -34 V-44" stroke="#3CB371" strokeWidth={9} strokeLinecap="round" fill="none" />
          <Path d="M8 -22 H18 Q22 -22 22 -26 V-40" stroke="#3CB371" strokeWidth={9} strokeLinecap="round" fill="none" />
          <Rect x={-8} y={-56} width={16} height={56} rx={8} fill="#3CB371" />
          <Line x1={-2} y1={-48} x2={-2} y2={-6} stroke="#5FD18E" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case 'flor':
      return (
        <>
          <Line x1={0} y1={0} x2={0} y2={-30} stroke="#2FBF71" strokeWidth={3} strokeLinecap="round" />
          <Ellipse cx={6} cy={-14} rx={7} ry={3.5} fill="#2FBF71" transform="rotate(-30 6 -14)" />
          {[0, 1, 2, 3, 4].map((i) => {
            const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
            return <Circle key={i} cx={Math.cos(angulo) * 8} cy={-36 + Math.sin(angulo) * 8} r={7} fill="#FF7EB6" />;
          })}
          <Circle cx={0} cy={-36} r={5} fill="#FFC23A" />
        </>
      );
    case 'faro':
      return (
        <>
          <Path d="M6 -66 L70 -80 L70 -52 Z" fill="#FFF3B0" opacity={0.55} />
          <Path d="M-10 0 L-6 -60 H6 L10 0 Z" fill="#FFFFFF" stroke="#C8D1E6" strokeWidth={1.5} />
          <Path d="M-8.7 -20 L-8.2 -28 H8.2 L8.7 -20 Z" fill="#E4574B" />
          <Path d="M-7.4 -40 L-6.9 -48 H6.9 L7.4 -40 Z" fill="#E4574B" />
          <Rect x={-8} y={-72} width={16} height={12} rx={2} fill="#FFE27A" stroke="#E0B84A" strokeWidth={1.5} />
          <Path d="M-11 -72 L0 -82 L11 -72 Z" fill="#E4574B" />
        </>
      );
    case 'tienda':
      return (
        <>
          <Path d="M-34 0 L0 -46 L34 0 Z" fill="#FF9F1C" stroke="#E07F00" strokeWidth={2} strokeLinejoin="round" />
          <Path d="M-10 0 L0 -30 L10 0 Z" fill="#8A4B00" />
        </>
      );
  }
}

const styles = StyleSheet.create({
  marco: {
    width: '100%',
    aspectRatio: ANCHO / ALTO,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
