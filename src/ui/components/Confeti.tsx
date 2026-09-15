import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Rng } from '@/lib/rng';
import { marca } from '@/ui/theme';
import { useMovimientoReducido } from '@/ui/useMovimientoReducido';

/**
 * Confeti de acierto.
 *
 * Solo aparece al acertar y una vez por reto: si celebrara también el intento,
 * dejaría de significar nada. La animación corre entera en el hilo de UI, así
 * que no compite con el render de la hoja de revisión que sube a la vez.
 *
 * Las piezas salen de un generador sembrado con el id del reto y no de
 * `Math.random`: el render tiene que ser puro, y así el mismo reto produce
 * siempre la misma lluvia en lugar de recolocarla en cada repintado.
 */

/** El amarillo no es de marca: es el único tono cálido claro que separa del mango. */
const COLORES = [marca.rosa, marca.mango, marca.lima, marca.aqua, marca.morado, '#FFE066'];
const PIEZAS = 46;
const CAIDA = 620;

interface Pieza {
  readonly izquierda: number;
  readonly deriva: number;
  readonly giro: number;
  readonly duracion: number;
  readonly retardo: number;
  readonly lado: number;
  readonly color: string;
  readonly redonda: boolean;
}

function generarPiezas(semilla: string): readonly Pieza[] {
  const rng = new Rng(semilla);
  return Array.from({ length: PIEZAS }, (_, i) => ({
    izquierda: rng.next(),
    deriva: (rng.next() - 0.5) * 220,
    giro: (rng.next() - 0.5) * 1080,
    duracion: 1500 + rng.next() * 1300,
    retardo: rng.next() * 350,
    lado: 7 + rng.next() * 9,
    color: COLORES[i % COLORES.length] as string,
    redonda: i % 3 === 0,
  }));
}

interface ConfetiProps {
  /** Id del reto: piezas nuevas en cada uno, estables dentro de él. */
  readonly semilla: string;
  readonly activo: boolean;
}

export function Confeti({ semilla, activo }: ConfetiProps) {
  const movimientoReducido = useMovimientoReducido();
  if (!activo || movimientoReducido) return null;

  // Montado con `key` para que un reto nuevo regenere y relance las piezas.
  return <Lluvia key={semilla} semilla={semilla} />;
}

function Lluvia({ semilla }: { semilla: string }) {
  const [piezas] = useState(() => generarPiezas(semilla));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.lienzo]}>
      {piezas.map((pieza, indice) => (
        <PiezaCayendo key={indice} pieza={pieza} />
      ))}
    </View>
  );
}

function PiezaCayendo({ pieza }: { pieza: Pieza }) {
  const [avance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const caida = Animated.timing(avance, {
      toValue: 1,
      duration: pieza.duracion,
      delay: pieza.retardo,
      easing: Easing.bezier(0.2, 0.6, 0.5, 1),
      useNativeDriver: true,
    });
    caida.start();
    return () => caida.stop();
  }, [avance, pieza.duracion, pieza.retardo]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: '30%',
        left: `${pieza.izquierda * 100}%`,
        width: pieza.lado,
        height: pieza.redonda ? pieza.lado : pieza.lado * 1.7,
        borderRadius: pieza.redonda ? pieza.lado / 2 : 2,
        backgroundColor: pieza.color,
        opacity: avance.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: avance.interpolate({ inputRange: [0, 1], outputRange: [0, pieza.deriva] }) },
          { translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [0, CAIDA] }) },
          { rotate: avance.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${pieza.giro}deg`] }) },
        ],
      }}
    />
  );
}

const styles = StyleSheet.create({
  // Por encima de la hoja de revisión, que también se superpone a la pantalla.
  lienzo: { zIndex: 20, overflow: 'hidden' },
});
