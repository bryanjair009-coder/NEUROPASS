/**
 * Mensajes de la pantalla de bloqueo.
 *
 * Se elige uno al azar cada vez que aparece. La rotación no es decoración: esta
 * pantalla es la que más veces ve un menor, y un texto idéntico repetido veinte
 * veces al día deja de leerse a los tres días.
 *
 * El registro está calculado. Ninguno regaña, ninguno dice «no puedes» y
 * ninguno menciona el castigo: todos plantean lo que viene como algo que vale
 * la pena, porque el momento del bloqueo es justo cuando la app se juega que el
 * menor la viva como un reto o como un carcelero.
 *
 * Viven en TypeScript y viajan con la política, así que cambiar la lista no
 * exige recompilar el módulo nativo.
 */
export const SHIELD_MESSAGES: readonly string[] = [
  'Hora de descansar y descubrir algo nuevo.',
  '¡Próxima parada: una nueva aventura!',
  '¿Sabías que...? Explorar cosas nuevas ayuda a tu cerebro a aprender.',
  '¡Tu cerebro está listo para un nuevo reto!',
  'Hora de descansar y dejar volar tu imaginación.',
  'Un reto nuevo, una idea nueva.',
  '¡Reto encontrado! ¿Lo aceptas?',
  'Cada intento cuenta.',
  '¡Tu próxima misión está lista!',
  'Hora de descansar y probar algo diferente.',
];
