import type { AgeBand } from '@/domain/age';

/**
 * Corpus léxico y semántico en español de México que alimenta a los
 * generadores de Lenguaje, Lógica y Creatividad.
 *
 * Criterios de curación:
 *  - Vocabulario neutro y apropiado para menores; sin marcas, sin PII, sin
 *    referencias culturales que caduquen.
 *  - Cada entrada declara el rango de edad *mínimo* en el que es apropiada;
 *    los rangos superiores heredan el vocabulario de los inferiores, que es
 *    como funciona la adquisición léxica real.
 */

export interface SynonymSet {
  readonly word: string;
  readonly synonyms: readonly string[];
  readonly minBand: AgeBand;
}

export const SYNONYM_SETS: readonly SynonymSet[] = [
  { word: 'contento', synonyms: ['feliz', 'alegre'], minBand: '6-8' },
  { word: 'grande', synonyms: ['enorme', 'gigante'], minBand: '6-8' },
  { word: 'rápido', synonyms: ['veloz', 'ligero'], minBand: '6-8' },
  { word: 'bonito', synonyms: ['lindo', 'hermoso'], minBand: '6-8' },
  { word: 'casa', synonyms: ['hogar', 'vivienda'], minBand: '6-8' },
  { word: 'niño', synonyms: ['chico', 'pequeño'], minBand: '6-8' },
  { word: 'valiente', synonyms: ['audaz', 'intrépido'], minBand: '9-12' },
  { word: 'tranquilo', synonyms: ['sereno', 'calmado'], minBand: '9-12' },
  { word: 'listo', synonyms: ['inteligente', 'astuto'], minBand: '9-12' },
  { word: 'difícil', synonyms: ['complicado', 'arduo'], minBand: '9-12' },
  { word: 'antiguo', synonyms: ['añejo', 'remoto'], minBand: '9-12' },
  { word: 'enojado', synonyms: ['furioso', 'molesto'], minBand: '9-12' },
  { word: 'efímero', synonyms: ['pasajero', 'fugaz'], minBand: '13-16' },
  { word: 'perspicaz', synonyms: ['sagaz', 'agudo'], minBand: '13-16' },
  { word: 'obstinado', synonyms: ['terco', 'tenaz'], minBand: '13-16' },
  { word: 'abundante', synonyms: ['copioso', 'cuantioso'], minBand: '13-16' },
  { word: 'insólito', synonyms: ['extraordinario', 'inaudito'], minBand: '13-16' },
  { word: 'meticuloso', synonyms: ['minucioso', 'escrupuloso'], minBand: '13-16' },
];

export interface AntonymPair {
  readonly a: string;
  readonly b: string;
  readonly minBand: AgeBand;
}

export const ANTONYM_PAIRS: readonly AntonymPair[] = [
  { a: 'grande', b: 'pequeño', minBand: '6-8' },
  { a: 'alto', b: 'bajo', minBand: '6-8' },
  { a: 'frío', b: 'caliente', minBand: '6-8' },
  { a: 'día', b: 'noche', minBand: '6-8' },
  { a: 'lleno', b: 'vacío', minBand: '6-8' },
  { a: 'entrar', b: 'salir', minBand: '6-8' },
  { a: 'limpio', b: 'sucio', minBand: '6-8' },
  { a: 'valiente', b: 'cobarde', minBand: '9-12' },
  { a: 'generoso', b: 'egoísta', minBand: '9-12' },
  { a: 'antiguo', b: 'moderno', minBand: '9-12' },
  { a: 'aumentar', b: 'disminuir', minBand: '9-12' },
  { a: 'permitir', b: 'prohibir', minBand: '9-12' },
  { a: 'escaso', b: 'abundante', minBand: '13-16' },
  { a: 'efímero', b: 'perpetuo', minBand: '13-16' },
  { a: 'humilde', b: 'soberbio', minBand: '13-16' },
  { a: 'lícito', b: 'ilícito', minBand: '13-16' },
  { a: 'coherente', b: 'contradictorio', minBand: '13-16' },
];

export interface Category {
  readonly name: string;
  /** Miembros inequívocos de la categoría. */
  readonly members: readonly string[];
  readonly minBand: AgeBand;
}

export const CATEGORIES: readonly Category[] = [
  { name: 'frutas', members: ['manzana', 'plátano', 'naranja', 'uva', 'sandía', 'pera', 'mango'], minBand: '6-8' },
  { name: 'animales', members: ['perro', 'gato', 'caballo', 'conejo', 'tortuga', 'venado', 'lobo'], minBand: '6-8' },
  { name: 'colores', members: ['rojo', 'azul', 'verde', 'amarillo', 'morado', 'rosa', 'café'], minBand: '6-8' },
  { name: 'muebles', members: ['silla', 'mesa', 'sofá', 'cama', 'librero', 'buró'], minBand: '6-8' },
  { name: 'partes del cuerpo', members: ['mano', 'pie', 'codo', 'rodilla', 'hombro', 'tobillo'], minBand: '6-8' },
  { name: 'vehículos', members: ['coche', 'bicicleta', 'camión', 'avión', 'barco', 'tren'], minBand: '6-8' },
  { name: 'instrumentos musicales', members: ['guitarra', 'piano', 'violín', 'flauta', 'tambor', 'trompeta'], minBand: '9-12' },
  { name: 'herramientas', members: ['martillo', 'destornillador', 'sierra', 'pinzas', 'taladro', 'llave'], minBand: '9-12' },
  { name: 'planetas', members: ['Marte', 'Venus', 'Júpiter', 'Saturno', 'Mercurio', 'Neptuno'], minBand: '9-12' },
  { name: 'metales', members: ['hierro', 'cobre', 'plata', 'oro', 'aluminio', 'zinc'], minBand: '9-12' },
  { name: 'figuras geométricas', members: ['triángulo', 'cuadrado', 'círculo', 'rombo', 'pentágono', 'hexágono'], minBand: '9-12' },
  { name: 'gases nobles', members: ['helio', 'neón', 'argón', 'kriptón', 'xenón'], minBand: '13-16' },
  { name: 'géneros literarios', members: ['novela', 'ensayo', 'poesía', 'teatro', 'crónica'], minBand: '13-16' },
  { name: 'órganos', members: ['hígado', 'páncreas', 'riñón', 'pulmón', 'estómago'], minBand: '13-16' },
];

export interface SpellingItem {
  readonly correct: string;
  readonly wrong: readonly string[];
  readonly minBand: AgeBand;
}

export const SPELLING_ITEMS: readonly SpellingItem[] = [
  { correct: 'burbuja', wrong: ['burvuja', 'vurbuja', 'burbuya'], minBand: '6-8' },
  { correct: 'ventana', wrong: ['bentana', 'ventaba', 'vetana'], minBand: '6-8' },
  { correct: 'gigante', wrong: ['jigante', 'giante', 'gijante'], minBand: '6-8' },
  { correct: 'llave', wrong: ['yave', 'llabe', 'lave'], minBand: '6-8' },
  { correct: 'caballo', wrong: ['cavallo', 'cabayo', 'cavayo'], minBand: '6-8' },
  { correct: 'zapato', wrong: ['sapato', 'zapatto', 'zapado'], minBand: '6-8' },
  { correct: 'hermano', wrong: ['ermano', 'hermáno', 'hermanno'], minBand: '6-8' },
  { correct: 'juguete', wrong: ['jugete', 'juguette', 'huguete'], minBand: '6-8' },
  { correct: 'escuela', wrong: ['esquela', 'escuella', 'ezcuela'], minBand: '6-8' },
  { correct: 'hierba', wrong: ['yerva', 'hierva', 'ierba'], minBand: '9-12' },
  { correct: 'excepción', wrong: ['excepcion', 'esepción', 'exepción'], minBand: '9-12' },
  { correct: 'atravesar', wrong: ['atrabesar', 'atravezar', 'atrabezar'], minBand: '9-12' },
  { correct: 'bienvenido', wrong: ['bienbenido', 'vienvenido', 'bienbenidos'], minBand: '9-12' },
  { correct: 'decisión', wrong: ['desición', 'decición', 'dezisión'], minBand: '13-16' },
  { correct: 'absorber', wrong: ['absorver', 'abzorber', 'absorvér'], minBand: '13-16' },
  { correct: 'exuberante', wrong: ['exhuberante', 'exuverante', 'esuberante'], minBand: '13-16' },
  { correct: 'inhibición', wrong: ['inibición', 'inhivición', 'inhibision'], minBand: '13-16' },
  { correct: 'concienzudo', wrong: ['conciensudo', 'concienszudo', 'conscienzudo'], minBand: '13-16' },
];

export interface AnalogyItem {
  readonly a: string;
  readonly b: string;
  readonly c: string;
  readonly d: string;
  /** Relación explícita; se usa como pista y para agrupar distractores. */
  readonly relation: string;
  readonly minBand: AgeBand;
}

export const ANALOGIES: readonly AnalogyItem[] = [
  { a: 'perro', b: 'ladrar', c: 'gato', d: 'maullar', relation: 'sonido que produce', minBand: '6-8' },
  { a: 'pez', b: 'agua', c: 'ave', d: 'aire', relation: 'medio donde se desplaza', minBand: '6-8' },
  { a: 'mano', b: 'guante', c: 'pie', d: 'calcetín', relation: 'prenda que lo cubre', minBand: '6-8' },
  { a: 'sol', b: 'día', c: 'luna', d: 'noche', relation: 'momento al que pertenece', minBand: '6-8' },
  { a: 'vaca', b: 'leche', c: 'gallina', d: 'huevo', relation: 'lo que produce', minBand: '6-8' },
  { a: 'zapato', b: 'pie', c: 'sombrero', d: 'cabeza', relation: 'parte del cuerpo donde se usa', minBand: '6-8' },
  { a: 'cuchara', b: 'sopa', c: 'tenedor', d: 'ensalada', relation: 'lo que se come con él', minBand: '6-8' },
  { a: 'lápiz', b: 'escribir', c: 'tijeras', d: 'cortar', relation: 'para qué sirve', minBand: '6-8' },
  { a: 'libro', b: 'leer', c: 'canción', d: 'escuchar', relation: 'acción que corresponde', minBand: '9-12' },
  { a: 'médico', b: 'hospital', c: 'maestro', d: 'escuela', relation: 'lugar de trabajo', minBand: '9-12' },
  { a: 'hambre', b: 'comer', c: 'sed', d: 'beber', relation: 'necesidad y su solución', minBand: '9-12' },
  { a: 'semilla', b: 'árbol', c: 'huevo', d: 'ave', relation: 'origen y resultado', minBand: '9-12' },
  { a: 'termómetro', b: 'temperatura', c: 'báscula', d: 'peso', relation: 'instrumento y magnitud', minBand: '13-16' },
  { a: 'sequía', b: 'lluvia', c: 'insomnio', d: 'sueño', relation: 'carencia de algo', minBand: '13-16' },
  { a: 'abogado', b: 'ley', c: 'astrónomo', d: 'estrella', relation: 'profesión y objeto de estudio', minBand: '13-16' },
  { a: 'prólogo', b: 'libro', c: 'obertura', d: 'ópera', relation: 'parte inicial de una obra', minBand: '13-16' },
];

export interface ReadingPassage {
  readonly text: string;
  readonly question: string;
  readonly correct: string;
  readonly distractors: readonly string[];
  readonly minBand: AgeBand;
}

export const READING_PASSAGES: readonly ReadingPassage[] = [
  {
    text: 'Lucía guardó su paraguas porque el cielo se despejó por completo.',
    question: '¿Por qué guardó el paraguas?',
    correct: 'Porque dejó de haber riesgo de lluvia',
    distractors: ['Porque se le rompió', 'Porque tenía frío', 'Porque llegó a su casa'],
    minBand: '6-8',
  },
  {
    text: 'El perro escondió su juguete debajo del sillón y luego no lo encontró.',
    question: '¿Dónde estaba el juguete?',
    correct: 'Debajo del sillón',
    distractors: ['Encima del sillón', 'En el jardín', 'Dentro de una caja'],
    minBand: '6-8',
  },
  {
    text: 'Ana llevó su suéter a la escuela, pero hizo tanto calor que no se lo puso.',
    question: '¿Por qué no usó el suéter?',
    correct: 'Porque hizo calor',
    distractors: ['Porque lo perdió', 'Porque no le gustaba', 'Porque lo olvidó en casa'],
    minBand: '6-8',
  },
  {
    text: 'Primero Beto se lavó los dientes y después se puso la pijama.',
    question: '¿Qué hizo primero?',
    correct: 'Se lavó los dientes',
    distractors: ['Se puso la pijama', 'Se durmió', 'Desayunó'],
    minBand: '6-8',
  },
  {
    text: 'Los tres gatitos eran blancos, menos uno que tenía manchas negras.',
    question: '¿Cuántos gatitos eran completamente blancos?',
    correct: 'Dos',
    distractors: ['Tres', 'Uno', 'Ninguno'],
    minBand: '6-8',
  },
  {
    text: 'Como se le acabó la pintura azul, Sara terminó su dibujo del mar de color verde.',
    question: '¿Por qué el mar quedó verde?',
    correct: 'Porque ya no tenía pintura azul',
    distractors: ['Porque el mar es verde', 'Porque le gusta el verde', 'Porque se equivocó de dibujo'],
    minBand: '6-8',
  },
  {
    text: 'La bicicleta de Iker es roja y la de su prima es azul con una canasta.',
    question: '¿Cuál bicicleta tiene canasta?',
    correct: 'La de su prima',
    distractors: ['La de Iker', 'Las dos', 'Ninguna'],
    minBand: '6-8',
  },
  {
    text: 'Como llegó tarde al cine, Rosa se perdió los primeros minutos de la película.',
    question: '¿Qué le pasó por llegar tarde?',
    correct: 'Se perdió el inicio de la película',
    distractors: ['No la dejaron entrar', 'Vio otra película', 'Se quedó dormida'],
    minBand: '6-8',
  },
  {
    text: 'El pan se quemó porque nadie apagó el horno a tiempo.',
    question: '¿Cuál fue la causa de que se quemara el pan?',
    correct: 'Nadie apagó el horno a tiempo',
    distractors: ['El pan estaba viejo', 'El horno estaba frío', 'Había mucha gente'],
    minBand: '6-8',
  },
  {
    text: 'Aunque estudió toda la semana, Mateo sintió nervios antes del examen.',
    question: '¿Qué relación hay entre estudiar y sentir nervios en esta frase?',
    correct: 'Sintió nervios a pesar de haber estudiado',
    distractors: [
      'Sintió nervios porque estudió',
      'No estudió y por eso se puso nervioso',
      'Estudió para no sentir nervios y funcionó',
    ],
    minBand: '9-12',
  },
  {
    text: 'El río bajó de nivel tras meses sin lluvia, y varios cultivos de la ribera se perdieron.',
    question: '¿Cuál es la relación causa-efecto del texto?',
    correct: 'La falta de lluvia bajó el río y eso arruinó los cultivos',
    distractors: [
      'Los cultivos secaron el río',
      'El río bajó porque se perdieron los cultivos',
      'La lluvia arruinó los cultivos',
    ],
    minBand: '9-12',
  },
  {
    text: 'La autora sostiene que las ciudades deben priorizar el transporte público, pues cada autobús retira decenas de autos de la calle.',
    question: '¿Cuál es el argumento que sostiene su postura?',
    correct: 'Un autobús sustituye a decenas de autos particulares',
    distractors: [
      'Las ciudades son demasiado grandes',
      'El transporte público es más barato',
      'Los autos contaminan el aire',
    ],
    minBand: '13-16',
  },
  {
    text: 'El experimento se repitió cinco veces y el resultado fue idéntico en todas, salvo en la tercera, donde el sensor falló.',
    question: '¿Qué se puede concluir con mayor solidez?',
    correct: 'El resultado es consistente y la excepción se explica por una falla del instrumento',
    distractors: [
      'El experimento es poco confiable',
      'El sensor invalida las cinco repeticiones',
      'Hacen falta más de cinco repeticiones para concluir algo',
    ],
    minBand: '13-16',
  },
];

/** Objetos cotidianos para retos divergentes de creatividad. */
export const EVERYDAY_OBJECTS: readonly string[] = [
  'una caja de cartón',
  'un clip',
  'una cuchara',
  'una botella vacía',
  'un calcetín sin par',
  'una liga',
  'un periódico viejo',
  'una llanta usada',
  'un vaso de plástico',
  'una cuerda',
];

export interface StorySeed {
  readonly text: string;
  readonly minBand: AgeBand;
}

/** Semillas narrativas abiertas, escaladas por complejidad. */
export const STORY_SEEDS: readonly StorySeed[] = [
  { text: 'El gato de la esquina encontró una puerta pequeñita detrás del refrigerador...', minBand: '6-8' },
  { text: 'Al abrir su mochila, Sofía descubrió que adentro había empezado a llover...', minBand: '6-8' },
  { text: 'Todos los zapatos de la casa amanecieron acomodados formando una flecha hacia el jardín...', minBand: '6-8' },
  { text: 'El perro del vecino aprendió a decir exactamente una palabra, y la repetía cada mañana...', minBand: '6-8' },
  { text: 'La maestra pidió que dibujaran su animal favorito, y el dibujo de Pau empezó a moverse...', minBand: '6-8' },
  { text: 'Una nube se quedó atorada en el árbol del parque y nadie sabía cómo bajarla...', minBand: '6-8' },
  { text: 'El lápiz de Tomás escribía solo, pero nada más contaba chistes...', minBand: '6-8' },
  { text: 'En el patio apareció una escalera que subía hasta las nubes y no bajaba a ningún lado...', minBand: '6-8' },
  { text: 'La abuela dijo que las estrellas eran ventanas, y esa noche una se abrió...', minBand: '6-8' },
  { text: 'El reloj del pueblo marcó las trece en punto y nadie pareció notarlo, excepto Diego...', minBand: '9-12' },
  { text: 'La carta llegó sin remitente y solo decía: no abras la ventana del sótano...', minBand: '9-12' },
  { text: 'Cada vez que Mariana mentía, una planta de su casa perdía exactamente una hoja...', minBand: '9-12' },
  { text: 'El elevador del edificio empezó a detenerse en un piso que no aparecía en los botones...', minBand: '9-12' },
  { text: 'Cuando la última biblioteca del mundo cerró, alguien empezó a memorizar los libros...', minBand: '13-16' },
  { text: 'La ciudad votó por desconectar el internet durante un año. El primer día fue el más difícil...', minBand: '13-16' },
  { text: 'Desde el martes, todos los habitantes recuerdan el futuro pero olvidan el pasado...', minBand: '13-16' },
  { text: 'Le ofrecieron borrar un solo recuerdo, cualquiera, a cambio de responder una pregunta...', minBand: '13-16' },
];

/** Retos abiertos de resolución de problemas para adolescentes. */
export const OPEN_CHALLENGES: readonly string[] = [
  'Tu escuela desperdicia mucha agua en los bebederos. Propón una solución que cueste poco.',
  'Diseña una forma de explicarle a un niño de 6 años qué es la gravedad, sin usar la palabra fuerza.',
  'Inventa un servicio que ayude a las personas mayores de tu colonia a hacer sus compras.',
  'Propón tres maneras de reducir la basura de tu casa sin comprar nada nuevo.',
  'Si tuvieras que explicar tu día por medio de un solo dibujo, ¿qué dibujarías y por qué?',
  'Tu colonia se queda sin luz cada semana durante dos horas. Diseña un plan para esas dos horas.',
  'Rediseña el pupitre del salón para alguien que no puede estar sentado mucho tiempo.',
  'Inventa una regla nueva para un deporte que lo haga más justo. Explica por qué funcionaría.',
  'Propón cómo convencer a alguien de tu edad de leer un libro, sin decirle que es bueno para él.',
  'Diseña una señal que cualquier persona entienda sin saber leer ni conocer el idioma.',
];

/**
 * Filtra un corpus por rango: un menor ve el vocabulario de su rango y el de
 * los rangos inferiores, nunca el de los superiores.
 */
export function forBand<T extends { readonly minBand: AgeBand }>(
  corpus: readonly T[],
  band: AgeBand,
  order: readonly AgeBand[],
): T[] {
  const limit = order.indexOf(band);
  return corpus.filter((item) => order.indexOf(item.minBand) <= limit);
}
