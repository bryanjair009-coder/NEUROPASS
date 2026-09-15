import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Si el sistema pide reducir el movimiento.
 *
 * Se escucha el cambio además de leerlo al montar: quien activa el ajuste con
 * la app abierta —por mareo, por ejemplo— no debería tener que reiniciarla para
 * que AXO deje de saltar.
 *
 * Arranca en `false` porque la consulta es asíncrona. El peor caso es que una
 * animación empiece y se detenga en el primer fotograma, que es preferible a
 * retrasar la pintura de la pantalla esperando la respuesta.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    let vigente = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (vigente) setReducido(valor);
    });
    const suscripcion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducido);

    return () => {
      vigente = false;
      suscripcion.remove();
    };
  }, []);

  return reducido;
}
