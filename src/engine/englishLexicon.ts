import type { AgeBand } from '@/domain/age';

/**
 * Corpus de inglés como lengua extranjera.
 *
 * Inglés estadounidense (color, favorite, soccer): es la variante con la que un
 * menor en México más se va a encontrar. Las instrucciones de cada reto van en
 * español porque el menor de seis años todavía no lee inglés; lo que se aprende
 * es el contenido, no la consigna.
 *
 * Como en el corpus en español, cada entrada declara el rango mínimo en el que
 * es apropiada y los rangos superiores la heredan.
 *
 * Criterio para los distractores: cada opción incorrecta tiene que ser
 * inequívocamente incorrecta. En una lengua que el menor está aprendiendo, un
 * distractor «casi válido» no mide lo que sabe: le enseña algo falso.
 */

export type CategoriaVisual = 'animales' | 'comida' | 'casa' | 'cuerpo' | 'naturaleza';

export interface PalabraVisual {
  readonly emoji: string;
  readonly en: string;
  readonly es: string;
  readonly categoria: CategoriaVisual;
}

/**
 * Vocabulario concreto y de alta frecuencia, con imagen.
 *
 * No incluye «orange»: sería a la vez fruta y color, y el reto de colores lo
 * usa como color.
 */
export const VOCABULARIO_VISUAL: readonly PalabraVisual[] = [
  { emoji: '🐶', en: 'dog', es: 'perro', categoria: 'animales' },
  { emoji: '🐱', en: 'cat', es: 'gato', categoria: 'animales' },
  { emoji: '🐦', en: 'bird', es: 'pájaro', categoria: 'animales' },
  { emoji: '🐟', en: 'fish', es: 'pez', categoria: 'animales' },
  { emoji: '🐴', en: 'horse', es: 'caballo', categoria: 'animales' },
  { emoji: '🐮', en: 'cow', es: 'vaca', categoria: 'animales' },
  { emoji: '🐷', en: 'pig', es: 'cerdo', categoria: 'animales' },
  { emoji: '🐭', en: 'mouse', es: 'ratón', categoria: 'animales' },
  { emoji: '🦁', en: 'lion', es: 'león', categoria: 'animales' },
  { emoji: '🐸', en: 'frog', es: 'rana', categoria: 'animales' },

  { emoji: '🍎', en: 'apple', es: 'manzana', categoria: 'comida' },
  { emoji: '🍌', en: 'banana', es: 'plátano', categoria: 'comida' },
  { emoji: '🥛', en: 'milk', es: 'leche', categoria: 'comida' },
  { emoji: '🍞', en: 'bread', es: 'pan', categoria: 'comida' },
  { emoji: '🥚', en: 'egg', es: 'huevo', categoria: 'comida' },
  { emoji: '🧀', en: 'cheese', es: 'queso', categoria: 'comida' },
  { emoji: '🍓', en: 'strawberry', es: 'fresa', categoria: 'comida' },
  { emoji: '💧', en: 'water', es: 'agua', categoria: 'comida' },
  { emoji: '🍪', en: 'cookie', es: 'galleta', categoria: 'comida' },
  { emoji: '🍰', en: 'cake', es: 'pastel', categoria: 'comida' },

  { emoji: '🏠', en: 'house', es: 'casa', categoria: 'casa' },
  { emoji: '🚪', en: 'door', es: 'puerta', categoria: 'casa' },
  { emoji: '🪑', en: 'chair', es: 'silla', categoria: 'casa' },
  { emoji: '🛏️', en: 'bed', es: 'cama', categoria: 'casa' },
  { emoji: '📖', en: 'book', es: 'libro', categoria: 'casa' },
  { emoji: '✏️', en: 'pencil', es: 'lápiz', categoria: 'casa' },
  { emoji: '⚽', en: 'ball', es: 'pelota', categoria: 'casa' },
  { emoji: '🚗', en: 'car', es: 'carro', categoria: 'casa' },
  { emoji: '🕐', en: 'clock', es: 'reloj', categoria: 'casa' },
  { emoji: '👕', en: 'shirt', es: 'camisa', categoria: 'casa' },

  { emoji: '👁️', en: 'eye', es: 'ojo', categoria: 'cuerpo' },
  { emoji: '👂', en: 'ear', es: 'oreja', categoria: 'cuerpo' },
  { emoji: '👃', en: 'nose', es: 'nariz', categoria: 'cuerpo' },
  { emoji: '👄', en: 'mouth', es: 'boca', categoria: 'cuerpo' },
  { emoji: '✋', en: 'hand', es: 'mano', categoria: 'cuerpo' },
  { emoji: '🦶', en: 'foot', es: 'pie', categoria: 'cuerpo' },

  { emoji: '☀️', en: 'sun', es: 'sol', categoria: 'naturaleza' },
  { emoji: '🌙', en: 'moon', es: 'luna', categoria: 'naturaleza' },
  { emoji: '⭐', en: 'star', es: 'estrella', categoria: 'naturaleza' },
  { emoji: '🌳', en: 'tree', es: 'árbol', categoria: 'naturaleza' },
  { emoji: '🌸', en: 'flower', es: 'flor', categoria: 'naturaleza' },
  { emoji: '🌧️', en: 'rain', es: 'lluvia', categoria: 'naturaleza' },
];

export interface PalabraTraduccion {
  readonly en: string;
  readonly es: string;
  readonly minBand: AgeBand;
}

/**
 * Vocabulario para traducir sin imagen. Empieza por el visual —lo concreto se
 * adquiere antes— y añade palabras más abstractas en los rangos mayores.
 */
export const PALABRAS_TRADUCCION: readonly PalabraTraduccion[] = [
  ...VOCABULARIO_VISUAL.map(({ en, es }) => ({ en, es, minBand: '6-8' as const })),

  { en: 'teacher', es: 'maestro', minBand: '9-12' },
  { en: 'friend', es: 'amigo', minBand: '9-12' },
  { en: 'school', es: 'escuela', minBand: '9-12' },
  { en: 'homework', es: 'tarea', minBand: '9-12' },
  { en: 'kitchen', es: 'cocina', minBand: '9-12' },
  { en: 'window', es: 'ventana', minBand: '9-12' },
  { en: 'street', es: 'calle', minBand: '9-12' },
  { en: 'money', es: 'dinero', minBand: '9-12' },
  { en: 'game', es: 'juego', minBand: '9-12' },
  { en: 'song', es: 'canción', minBand: '9-12' },
  { en: 'happy', es: 'feliz', minBand: '9-12' },
  { en: 'tired', es: 'cansado', minBand: '9-12' },
  { en: 'fast', es: 'rápido', minBand: '9-12' },
  { en: 'cold', es: 'frío', minBand: '9-12' },

  { en: 'knowledge', es: 'conocimiento', minBand: '13-16' },
  { en: 'journey', es: 'viaje', minBand: '13-16' },
  { en: 'environment', es: 'medio ambiente', minBand: '13-16' },
  { en: 'borrow', es: 'pedir prestado', minBand: '13-16' },
  { en: 'choose', es: 'elegir', minBand: '13-16' },
  { en: 'improve', es: 'mejorar', minBand: '13-16' },
  { en: 'forget', es: 'olvidar', minBand: '13-16' },
  { en: 'weather', es: 'clima', minBand: '13-16' },
  { en: 'neighbor', es: 'vecino', minBand: '13-16' },
  { en: 'healthy', es: 'saludable', minBand: '13-16' },
];

export const NUMEROS: readonly { readonly valor: number; readonly en: string }[] = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
].map((en, indice) => ({ valor: indice + 1, en }));

/** Colores con su valor para dibujarlos; el reto muestra un círculo de ese color. */
export const COLORES: readonly { readonly color: string; readonly en: string }[] = [
  { color: '#FF5A4E', en: 'red' },
  { color: '#FF9F1C', en: 'orange' },
  { color: '#FFC23A', en: 'yellow' },
  { color: '#22C55E', en: 'green' },
  { color: '#2F7BFF', en: 'blue' },
  { color: '#7C5FFF', en: 'purple' },
  { color: '#2B2540', en: 'black' },
  { color: '#FFFFFF', en: 'white' },
  { color: '#A0522D', en: 'brown' },
];

/**
 * Expresiones de cortesía. En español se evita «disculpa», que valdría tanto
 * para «Excuse me» como para «I'm sorry»: cada expresión tiene una sola
 * traducción posible entre las opciones.
 */
export const SALUDOS: readonly { readonly es: string; readonly en: string }[] = [
  { es: 'hola', en: 'Hello' },
  { es: 'adiós', en: 'Goodbye' },
  { es: 'gracias', en: 'Thank you' },
  { es: 'por favor', en: 'Please' },
  { es: 'buenos días', en: 'Good morning' },
  { es: 'buenas noches', en: 'Good night' },
  { es: '¿cómo estás?', en: 'How are you?' },
  { es: 'lo siento', en: "I'm sorry" },
  { es: 'con permiso', en: 'Excuse me' },
  { es: 'de nada', en: "You're welcome" },
  { es: 'nos vemos luego', en: 'See you later' },
  { es: 'mucho gusto', en: 'Nice to meet you' },
];

/** Sujetos con su forma de «to be». `enPregunta` es cómo se escribe tras el verbo. */
export const SUJETOS_TO_BE: readonly { readonly sujeto: string; readonly enPregunta: string; readonly verbo: 'am' | 'is' | 'are' }[] = [
  { sujeto: 'I', enPregunta: 'I', verbo: 'am' },
  { sujeto: 'You', enPregunta: 'you', verbo: 'are' },
  { sujeto: 'He', enPregunta: 'he', verbo: 'is' },
  { sujeto: 'She', enPregunta: 'she', verbo: 'is' },
  { sujeto: 'It', enPregunta: 'it', verbo: 'is' },
  { sujeto: 'We', enPregunta: 'we', verbo: 'are' },
  { sujeto: 'They', enPregunta: 'they', verbo: 'are' },
  { sujeto: 'My mom', enPregunta: 'my mom', verbo: 'is' },
  { sujeto: 'The dogs', enPregunta: 'the dogs', verbo: 'are' },
  { sujeto: 'Ana and Luis', enPregunta: 'Ana and Luis', verbo: 'are' },
  { sujeto: 'My teacher', enPregunta: 'my teacher', verbo: 'is' },
];

export const COMPLEMENTOS_TO_BE: readonly string[] = [
  'happy',
  'tired',
  'at home',
  'at school',
  'hungry',
  'in the garden',
  'very funny',
  'ready',
];

export interface Verbo {
  readonly base: string;
  readonly tercera: string;
  readonly gerundio: string;
  readonly pasado: string;
  readonly complemento: string;
  /** Pasado irregular: se reserva para los niveles altos. */
  readonly irregular: boolean;
}

/**
 * Verbos cuyas cuatro formas son distintas entre sí. «read» o «put» quedan
 * fuera: su pasado se escribe igual que la base y el reto tendría dos opciones
 * idénticas.
 */
export const VERBOS: readonly Verbo[] = [
  { base: 'play', tercera: 'plays', gerundio: 'playing', pasado: 'played', complemento: 'soccer', irregular: false },
  { base: 'watch', tercera: 'watches', gerundio: 'watching', pasado: 'watched', complemento: 'TV', irregular: false },
  { base: 'walk', tercera: 'walks', gerundio: 'walking', pasado: 'walked', complemento: 'to school', irregular: false },
  { base: 'study', tercera: 'studies', gerundio: 'studying', pasado: 'studied', complemento: 'English', irregular: false },
  { base: 'clean', tercera: 'cleans', gerundio: 'cleaning', pasado: 'cleaned', complemento: 'the kitchen', irregular: false },
  { base: 'eat', tercera: 'eats', gerundio: 'eating', pasado: 'ate', complemento: 'breakfast', irregular: true },
  { base: 'drink', tercera: 'drinks', gerundio: 'drinking', pasado: 'drank', complemento: 'milk', irregular: true },
  { base: 'go', tercera: 'goes', gerundio: 'going', pasado: 'went', complemento: 'to the park', irregular: true },
  { base: 'ride', tercera: 'rides', gerundio: 'riding', pasado: 'rode', complemento: 'a bike', irregular: true },
  { base: 'sing', tercera: 'sings', gerundio: 'singing', pasado: 'sang', complemento: 'songs', irregular: true },
  { base: 'swim', tercera: 'swims', gerundio: 'swimming', pasado: 'swam', complemento: 'in the pool', irregular: true },
  { base: 'write', tercera: 'writes', gerundio: 'writing', pasado: 'wrote', complemento: 'stories', irregular: true },
  { base: 'buy', tercera: 'buys', gerundio: 'buying', pasado: 'bought', complemento: 'bread', irregular: true },
  { base: 'make', tercera: 'makes', gerundio: 'making', pasado: 'made', complemento: 'cookies', irregular: true },
];

/** Solo personas: «The cat plays soccer» sería gramatical y absurdo. */
export const SUJETOS_VERBO: readonly { readonly sujeto: string; readonly tercera: boolean }[] = [
  { sujeto: 'I', tercera: false },
  { sujeto: 'You', tercera: false },
  { sujeto: 'We', tercera: false },
  { sujeto: 'They', tercera: false },
  { sujeto: 'He', tercera: true },
  { sujeto: 'She', tercera: true },
  { sujeto: 'My brother', tercera: true },
  { sujeto: 'Sofía', tercera: true },
  { sujeto: 'My friends', tercera: false },
  { sujeto: 'Ana and Luis', tercera: false },
];

export const ADVERBIOS_FRECUENCIA: readonly string[] = ['usually', 'always', 'often', 'never'];

export const MARCADORES_PASADO: readonly string[] = ['yesterday', 'last week', 'last Saturday', 'two days ago'];

export const PREPOSICIONES: readonly { readonly es: string; readonly en: string }[] = [
  { es: 'debajo de', en: 'under' },
  { es: 'encima de', en: 'on' },
  { es: 'dentro de', en: 'in' },
  { es: 'al lado de', en: 'next to' },
  { es: 'detrás de', en: 'behind' },
  { es: 'enfrente de', en: 'in front of' },
];

export const COSAS_UBICABLES: readonly { readonly es: string; readonly en: string }[] = [
  { es: 'El gato', en: 'The cat' },
  { es: 'La pelota', en: 'The ball' },
  { es: 'El libro', en: 'The book' },
  { es: 'El perro', en: 'The dog' },
  { es: 'La mochila', en: 'The backpack' },
];

/** `admiteDentro`: «dentro de la puerta» no tiene sentido, «dentro de la caja» sí. */
export const LUGARES: readonly { readonly es: string; readonly en: string; readonly admiteDentro: boolean }[] = [
  { es: 'la mesa', en: 'the table', admiteDentro: false },
  { es: 'la caja', en: 'the box', admiteDentro: true },
  // «Dentro de la cama» suena raro en español aunque «in the bed» sea correcto.
  { es: 'la cama', en: 'the bed', admiteDentro: false },
  { es: 'la silla', en: 'the chair', admiteDentro: false },
  { es: 'la puerta', en: 'the door', admiteDentro: false },
];

/**
 * Oraciones con los errores que de verdad comete un hispanohablante: calcar
 * «tengo diez años», omitir el sujeto, olvidar la -s de tercera persona o
 * poner el adjetivo detrás del sustantivo.
 */
export const ORACIONES_TRADUCCION: readonly {
  readonly es: string;
  readonly correcta: string;
  readonly errores: readonly string[];
  readonly minBand: AgeBand;
}[] = [
  { es: 'Tengo diez años.', correcta: 'I am ten years old.', errores: ['I have ten years.', 'I have ten years old.', 'I am ten years.'], minBand: '9-12' },
  { es: 'Me gusta el chocolate.', correcta: 'I like chocolate.', errores: ['Me like chocolate.', 'It likes me chocolate.', 'I like the chocolate very.'], minBand: '9-12' },
  { es: 'Ella es mi mejor amiga.', correcta: 'She is my best friend.', errores: ['She is my friend best.', 'Her is my best friend.', 'She my best friend is.'], minBand: '9-12' },
  { es: '¿Dónde está el baño?', correcta: 'Where is the bathroom?', errores: ['Where the bathroom is?', 'Where are the bathroom?', 'Where is bathroom the?'], minBand: '9-12' },
  { es: 'No tengo hambre.', correcta: 'I am not hungry.', errores: ["I don't have hungry.", 'I not am hungry.', 'I have not hunger.'], minBand: '9-12' },
  { es: 'Tenemos dos perros.', correcta: 'We have two dogs.', errores: ['We have two dog.', 'We has two dogs.', 'Us have two dogs.'], minBand: '9-12' },
  { es: 'Él no juega fútbol.', correcta: "He doesn't play soccer.", errores: ["He don't play soccer.", "He doesn't plays soccer.", 'He no play soccer.'], minBand: '9-12' },
  { es: 'Hace frío hoy.', correcta: 'It is cold today.', errores: ['It makes cold today.', 'Is cold today.', 'It has cold today.'], minBand: '9-12' },
  { es: 'Mi casa es grande.', correcta: 'My house is big.', errores: ['My house is bigs.', 'My big is house.', 'Mine house is big.'], minBand: '9-12' },
  { es: '¿Te gusta leer?', correcta: 'Do you like to read?', errores: ['You like read?', 'Does you like to read?', 'Like you to read?'], minBand: '9-12' },
  { es: 'Voy a la escuela en autobús.', correcta: 'I go to school by bus.', errores: ['I go to the school in bus.', 'I goes to school by bus.', 'I go at school by bus.'], minBand: '9-12' },
  { es: 'Tengo frío.', correcta: 'I am cold.', errores: ['I have cold.', 'I am coldness.', 'I has cold.'], minBand: '9-12' },
];

/**
 * Falsos amigos: palabras que se parecen al español y significan otra cosa.
 * El distractor principal es siempre el falso amigo, que es el error que el
 * reto quiere desactivar.
 */
export const FALSOS_AMIGOS: readonly { readonly en: string; readonly correcto: string; readonly falso: string }[] = [
  { en: 'actually', correcto: 'en realidad', falso: 'actualmente' },
  { en: 'library', correcto: 'biblioteca', falso: 'librería' },
  { en: 'embarrassed', correcto: 'avergonzado', falso: 'embarazada' },
  { en: 'sensible', correcto: 'sensato', falso: 'sensible' },
  { en: 'exit', correcto: 'salida', falso: 'éxito' },
  { en: 'carpet', correcto: 'alfombra', falso: 'carpeta' },
  { en: 'realize', correcto: 'darse cuenta', falso: 'realizar' },
  { en: 'large', correcto: 'grande', falso: 'largo' },
  { en: 'fabric', correcto: 'tela', falso: 'fábrica' },
  { en: 'lecture', correcto: 'conferencia', falso: 'lectura' },
  { en: 'parents', correcto: 'padres', falso: 'parientes' },
  { en: 'soap', correcto: 'jabón', falso: 'sopa' },
];

/**
 * Comparativos y superlativos. Los errores guardados son los de aplicar mal la
 * regla —«more big», «gooder», «happyer»—, no palabras al azar. En «happy» y
 * «easy» el error es de ortografía y no «more happy», que muchos hablantes
 * nativos aceptan.
 */
export const COMPARATIVOS: readonly {
  readonly base: string;
  readonly comparativo: string;
  readonly comparativoMal: string;
  readonly superlativo: string;
  readonly superlativoMal: string;
  readonly pares: readonly (readonly [string, string])[];
  readonly fraseSuperlativo: string;
}[] = [
  { base: 'big', comparativo: 'bigger', comparativoMal: 'more big', superlativo: 'the biggest', superlativoMal: 'the most big', pares: [['An elephant', 'a dog'], ['The city', 'the town']], fraseSuperlativo: 'The blue whale is ___ animal in the ocean.' },
  { base: 'tall', comparativo: 'taller', comparativoMal: 'more tall', superlativo: 'the tallest', superlativoMal: 'the most tall', pares: [['My dad', 'me'], ['The tree', 'the house']], fraseSuperlativo: 'Luis is ___ boy in the class.' },
  { base: 'fast', comparativo: 'faster', comparativoMal: 'more fast', superlativo: 'the fastest', superlativoMal: 'the most fast', pares: [['A car', 'a bike'], ['A cheetah', 'a horse']], fraseSuperlativo: 'The cheetah is ___ land animal.' },
  { base: 'small', comparativo: 'smaller', comparativoMal: 'more small', superlativo: 'the smallest', superlativoMal: 'the most small', pares: [['A mouse', 'a cat'], ['My room', 'the kitchen']], fraseSuperlativo: 'This is ___ size in the store.' },
  { base: 'old', comparativo: 'older', comparativoMal: 'more old', superlativo: 'the oldest', superlativoMal: 'the most old', pares: [['My grandma', 'my mom'], ['This castle', 'our school']], fraseSuperlativo: 'Don Pepe is ___ person in town.' },
  { base: 'happy', comparativo: 'happier', comparativoMal: 'happyer', superlativo: 'the happiest', superlativoMal: 'the happyest', pares: [['My dog', 'my cat'], ['Ana', 'her brother']], fraseSuperlativo: 'This is ___ day of my life.' },
  { base: 'easy', comparativo: 'easier', comparativoMal: 'easyer', superlativo: 'the easiest', superlativoMal: 'the easyest', pares: [['Math', 'science'], ['This test', 'the last one']], fraseSuperlativo: 'This is ___ exercise in the book.' },
  { base: 'good', comparativo: 'better', comparativoMal: 'gooder', superlativo: 'the best', superlativoMal: 'the goodest', pares: [['This movie', 'the book'], ['Pizza', 'salad']], fraseSuperlativo: 'She is ___ player on the team.' },
  { base: 'bad', comparativo: 'worse', comparativoMal: 'badder', superlativo: 'the worst', superlativoMal: 'the baddest', pares: [['The weather today', 'yesterday'], ['This song', 'the first one']], fraseSuperlativo: 'That was ___ day of the trip.' },
  { base: 'expensive', comparativo: 'more expensive', comparativoMal: 'expensiver', superlativo: 'the most expensive', superlativoMal: 'the expensivest', pares: [['A phone', 'a pencil'], ['This jacket', 'that shirt']], fraseSuperlativo: 'This is ___ car in the store.' },
  { base: 'beautiful', comparativo: 'more beautiful', comparativoMal: 'beautifuler', superlativo: 'the most beautiful', superlativoMal: 'the beautifulest', pares: [['The beach', 'the city'], ['This garden', 'our park']], fraseSuperlativo: 'It is ___ place I know.' },
  { base: 'interesting', comparativo: 'more interesting', comparativoMal: 'interestinger', superlativo: 'the most interesting', superlativoMal: 'the interestingest', pares: [['This book', 'the movie'], ['History', 'that video']], fraseSuperlativo: 'That was ___ class of the year.' },
];

/**
 * Lecturas cortas. Cada respuesta sale literalmente del texto: en una segunda
 * lengua se mide primero la comprensión literal, y las inferencias llegan
 * cuando el vocabulario ya no es el obstáculo.
 */
export const LECTURAS: readonly {
  readonly texto: string;
  readonly pregunta: string;
  readonly correcta: string;
  readonly distractores: readonly string[];
  readonly minBand: AgeBand;
}[] = [
  { texto: 'Tom has a small dog. The dog\'s name is Max. Max likes to run in the park.', pregunta: "What is the dog's name?", correcta: 'Max', distractores: ['Tom', 'Park', 'Sam'], minBand: '9-12' },
  { texto: 'Lucy gets up at seven o\'clock. She eats breakfast and walks to school with her brother.', pregunta: 'How does Lucy go to school?', correcta: 'She walks.', distractores: ['She takes the bus.', 'Her mom drives her.', 'She rides a bike.'], minBand: '9-12' },
  { texto: 'It is raining today, so Pedro is not playing outside. He is reading a book in his room.', pregunta: 'Where is Pedro?', correcta: 'In his room.', distractores: ['In the park.', 'At school.', 'Outside.'], minBand: '9-12' },
  { texto: "Maria's favorite fruit is mango. She does not like bananas, but she loves strawberries.", pregunta: "What is Maria's favorite fruit?", correcta: 'Mango', distractores: ['Bananas', 'Strawberries', 'Grapes'], minBand: '9-12' },
  { texto: 'The museum opens at nine and closes at five. On Mondays, it is closed all day.', pregunta: 'When is the museum closed all day?', correcta: 'On Mondays', distractores: ['At nine', 'At five', 'In the morning'], minBand: '9-12' },
  { texto: 'Sam wanted to buy a new game, but he did not have enough money. He decided to save his money for two months.', pregunta: "Why didn't Sam buy the game?", correcta: "He didn't have enough money.", distractores: ['The store was closed.', "He didn't like the game.", 'His mom said no.'], minBand: '9-12' },
  { texto: 'Last summer, Ana visited her grandparents in Oaxaca. They cooked delicious food and went to the market every day.', pregunta: 'Who did Ana visit?', correcta: 'Her grandparents', distractores: ['Her teacher', 'Her cousins', 'Her friends'], minBand: '9-12' },
  { texto: 'Jake is taller than his sister, but his sister is older than him.', pregunta: 'Who is older?', correcta: "Jake's sister", distractores: ['Jake', 'They are the same age.', "Jake's brother"], minBand: '9-12' },
  { texto: 'The library is next to the school. Students go there after class to study and borrow books.', pregunta: 'Where is the library?', correcta: 'Next to the school.', distractores: ['Behind the park.', 'Inside the school.', 'Far from the school.'], minBand: '13-16' },
  { texto: 'Carla forgot her umbrella at home. When the rain started, she ran to a café and waited there.', pregunta: 'What did Carla forget?', correcta: 'Her umbrella', distractores: ['Her phone', 'Her keys', 'Her backpack'], minBand: '13-16' },
  { texto: 'Mr. Lopez teaches math. His students say his classes are difficult but interesting.', pregunta: 'What do the students think about his classes?', correcta: 'They are difficult but interesting.', distractores: ['They are easy and boring.', 'They are too short.', 'They are only in the morning.'], minBand: '13-16' },
  { texto: 'Diego practices the guitar every evening. Next month, he will play in a concert at his school.', pregunta: 'What will Diego do next month?', correcta: 'Play in a concert', distractores: ['Buy a guitar', 'Start guitar lessons', 'Change schools'], minBand: '13-16' },
];
