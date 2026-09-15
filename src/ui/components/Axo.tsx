import { useEffect, useState } from 'react';
import { Animated, Easing, View, type ImageSourcePropType } from 'react-native';

import { marca } from '@/ui/theme';
import { useMovimientoReducido } from '@/ui/useMovimientoReducido';

/**
 * AXO, el guía visual.
 *
 * Aparece en todas las pantallas del menor. La constancia es la función: un
 * personaje que siempre tiene el mismo aspecto reduce la carga de orientación,
 * y el menor sabe dónde está por quién le habla antes de leer nada.
 *
 * Va **suelto sobre la interfaz**, sin disco ni marco. Lo que lo asienta es una
 * sombra elíptica debajo: un recorte flotando sin sombra se lee como una
 * pegatina pegada encima, no como algo que está ahí.
 *
 * Solo dos expresiones tienen movimiento propio —el salto del acierto y la
 * negación del fallo—. Si cada una tuviera el suyo, el menor dejaría de
 * distinguir cuál significa qué. Las demás flotan en reposo.
 *
 * Quien lo use con reacción debe montarlo con `key={\`${idReto}-${resultado}\`}`:
 * sin remontar, la reacción no se vuelve a disparar y el segundo acierto ya no
 * celebra nada.
 */

/** Cinco caras y el cuerpo entero, que solo aparece en la bienvenida. */
export type ExpresionAxo = 'neutro' | 'reto' | 'acierto' | 'fallo' | 'sorpresa' | 'cuerpo';

interface Recorte {
  readonly fuente: ImageSourcePropType;
  /** Alto entre ancho del PNG, para no deformarlo ni dejar aire alrededor. */
  readonly proporcion: number;
}

// Las proporciones son las de los PNG de `assets/axo`. Si se sustituyen por
// recortes nuevos hay que actualizarlas, o AXO quedará encogido dentro de su caja.
const LISTO: Recorte = { fuente: require('../../../assets/axo/axo-listo.png'), proporcion: 408 / 510 };

const RECORTES: Record<ExpresionAxo, Recorte> = {
  neutro: LISTO,
  reto: LISTO,
  acierto: { fuente: require('../../../assets/axo/axo-feliz.png'), proporcion: 435 / 510 },
  fallo: { fuente: require('../../../assets/axo/axo-confundido.png'), proporcion: 453 / 510 },
  sorpresa: { fuente: require('../../../assets/axo/axo-sorpresa.png'), proporcion: 447 / 510 },
  cuerpo: { fuente: require('../../../assets/axo/axo-cuerpo.png'), proporcion: 722 / 528 },
};

type Reaccion = 'salto' | 'temblor';

const REACCION: Partial<Record<ExpresionAxo, Reaccion>> = {
  acierto: 'salto',
  fallo: 'temblor',
};

/** Hueco bajo los pies para que la sombra asome por debajo del recorte. */
const HUECO_SOMBRA = 0.08;

interface AxoProps {
  readonly ancho: number;
  readonly expresion?: ExpresionAxo;
  /** Color de la sombra de apoyo; conviene el del contexto (pilar, tarjeta…). */
  readonly tinte?: string;
  /** Flotación perpetua en reposo. Se apaga sola con «reducir movimiento». */
  readonly flota?: boolean;
}

export function Axo({ ancho, expresion = 'neutro', tinte = marca.aqua, flota = true }: AxoProps) {
  // Estado perezoso y no `useRef`: los valores animados se leen durante el
  // render —van dentro del estilo— y React 19 señala leer una referencia ahí.
  const [subir] = useState(() => new Animated.Value(0));
  const [avance] = useState(() => new Animated.Value(0));
  const movimientoReducido = useMovimientoReducido();

  const recorte = RECORTES[expresion];
  const reaccion = REACCION[expresion];

  useEffect(() => {
    if (!reaccion || movimientoReducido) return undefined;
    avance.setValue(0);
    const animacion = Animated.timing(avance, {
      toValue: 1,
      duration: reaccion === 'salto' ? 1000 : 600,
      // Lineal a propósito: la curva ya está escrita en los fotogramas clave de
      // `transformar`, y una segunda curva encima deformaría el aplastamiento.
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animacion.start();
    return () => animacion.stop();
  }, [avance, reaccion, movimientoReducido]);

  // La flotación solo corre cuando no hay reacción que contar: dos movimientos
  // a la vez sobre el mismo personaje ya no se leen como ninguno de los dos.
  useEffect(() => {
    if (movimientoReducido || !flota || reaccion) return undefined;
    const media = { duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true };
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(subir, { toValue: 1, ...media }),
        Animated.timing(subir, { toValue: 0, ...media }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [subir, flota, reaccion, movimientoReducido]);

  const altoImagen = ancho * recorte.proporcion;
  const alto = altoImagen * (1 + HUECO_SOMBRA);

  return (
    <View
      style={{ width: ancho, height: alto, alignItems: 'center', justifyContent: 'flex-end' }}
      // AXO acompaña; el significado lo lleva el texto de cada pantalla. Anunciar
      // «imagen, AXO» en cada una solo alarga la lectura con lector de pantalla.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Sombra de apoyo. Se encoge y se aclara cuando AXO sube, que es lo que
          hace que la flotación parezca altura y no un desplazamiento. */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          width: ancho * 0.56,
          height: Math.max(6, ancho * 0.09),
          borderRadius: ancho,
          backgroundColor: tinte,
          opacity: subir.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.24] }),
          transform: [{ scaleX: subir.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) }],
        }}
      />
      {/* Sin `shadow()` sobre la imagen: en Android la elevación dibuja la
          sombra del rectángulo entero, no la del contorno recortado. */}
      <Animated.Image
        source={recorte.fuente}
        resizeMode="contain"
        style={{
          width: ancho,
          height: altoImagen,
          marginBottom: altoImagen * HUECO_SOMBRA * 0.5,
          transform: transformar(reaccion, avance, subir),
        }}
      />
    </View>
  );
}

/**
 * Transformación según la fase. Los fotogramas reproducen los del prototipo
 * (`npSalta`, `npTiembla`, `npFlota`) para que el movimiento sea el mismo que
 * se validó en diseño.
 */
function transformar(reaccion: Reaccion | undefined, avance: Animated.Value, subir: Animated.Value) {
  if (reaccion === 'salto') {
    const pasos = [0, 0.18, 0.42, 0.62, 0.82, 1];
    return [
      { translateY: avance.interpolate({ inputRange: pasos, outputRange: [0, -26, 2, -12, 0, 0] }) },
      { scaleX: avance.interpolate({ inputRange: pasos, outputRange: [1, 1.1, 0.94, 1.04, 0.99, 1] }) },
      { scaleY: avance.interpolate({ inputRange: pasos, outputRange: [1, 0.94, 1.06, 0.98, 1.01, 1] }) },
      {
        rotate: avance.interpolate({
          inputRange: pasos,
          outputRange: ['0deg', '-5deg', '3deg', '-2deg', '0deg', '0deg'],
        }),
      },
    ];
  }

  if (reaccion === 'temblor') {
    // Negación de un lado a otro, que se apaga. Nunca un golpe ni una caída:
    // fallar no se dibuja como castigo.
    const pasos = [0, 0.15, 0.3, 0.45, 0.6, 0.78, 1];
    return [
      { translateX: avance.interpolate({ inputRange: pasos, outputRange: [0, -9, 8, -6, 5, -2, 0] }) },
      {
        rotate: avance.interpolate({
          inputRange: pasos,
          outputRange: ['0deg', '-5deg', '4deg', '-3deg', '2deg', '-1deg', '0deg'],
        }),
      },
    ];
  }

  return [{ translateY: subir.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }];
}
