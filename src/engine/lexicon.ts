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

/**
 * Retos de reutilización con un propósito.
 *
 * Sustituyen a «dale un uso distinto a un calcetín», que ejercitaba la
 * fluidez de ideas pero no llevaba a ningún aprendizaje: la respuesta podía
 * ser cualquier cosa y no había un problema que resolver. Aquí el material y
 * la necesidad están emparejados para que la solución sea posible y útil, y
 * el menor tiene que planear los pasos. Entrenan tres cosas a la vez:
 * creatividad aplicada, planificación y la idea de que lo viejo tiene valor.
 */
export interface RetoReutilizar {
  readonly material: string;
  readonly necesidad: string;
  readonly minBand: AgeBand;
}

export const RETOS_REUTILIZAR: readonly RetoReutilizar[] = [
  { material: 'una caja de cartón', necesidad: 'hacerle una casita a tu juguete favorito', minBand: '6-8' },
  { material: 'una botella de plástico vacía', necesidad: 'regar una planta pequeña', minBand: '6-8' },
  { material: 'hojas de periódico', necesidad: 'hacer un sombrero para un desfile', minBand: '6-8' },
  { material: 'un frasco con tapa', necesidad: 'guardar tus colores en orden', minBand: '6-8' },
  { material: 'dos tubos de papel de baño', necesidad: 'hacer unos binoculares de juguete', minBand: '6-8' },
  { material: 'un calcetín viejo', necesidad: 'hacer un títere para contar un cuento', minBand: '6-8' },
  { material: 'tapas de botella', necesidad: 'armar un juego de memoria', minBand: '6-8' },
  { material: 'una caja de huevo', necesidad: 'hacer un semillero para sembrar', minBand: '6-8' },
  { material: 'vasos de yogur limpios', necesidad: 'hacer un juego de boliche', minBand: '6-8' },
  { material: 'una bolsa de papel', necesidad: 'hacer una máscara para una obra de teatro', minBand: '6-8' },

  { material: 'una llanta vieja', necesidad: 'hacer una maceta grande para el patio', minBand: '9-12' },
  { material: 'dos latas limpias y un hilo', necesidad: 'hacer un teléfono para hablar con un amigo', minBand: '9-12' },
  { material: 'cartón y ligas', necesidad: 'construir una catapulta que lance bolitas de papel', minBand: '9-12' },
  { material: 'una botella de plástico', necesidad: 'hacer un comedero para pájaros', minBand: '9-12' },
  { material: 'retazos de tela', necesidad: 'hacer una bolsa para las compras', minBand: '9-12' },
  { material: 'un garrafón vacío', necesidad: 'regar las plantas gota a gota mientras no estás', minBand: '9-12' },

  { material: 'cajas de cartón', necesidad: 'hacer un organizador para el escritorio del salón', minBand: '13-16' },
  { material: 'un frasco, arena, piedras y algodón', necesidad: 'hacer un filtro que aclare agua turbia, explicando qué hace cada capa', minBand: '13-16' },
  { material: 'palitos de madera y cuerda', necesidad: 'construir un puente que aguante el peso de un libro', minBand: '13-16' },
  { material: 'un celular viejo que ya no se usa', necesidad: 'darle una nueva utilidad en casa sin tirarlo', minBand: '13-16' },
  { material: 'botellas de plástico y tierra', necesidad: 'hacer un jardín vertical en una pared', minBand: '13-16' },
];

/**
 * Problemas cotidianos con una sola solución que de verdad funciona.
 *
 * Sustituyen a «inventa algo que combine una llanta y un calcetín», que
 * pedía unir dos objetos al azar sin ningún fin. Aquí se ejercita el
 * pensamiento flexible aplicado: usar lo que se tiene de una forma que no es
 * la habitual para resolver algo real. Las ideas incorrectas no son absurdas:
 * cada una falla por una razón que el menor puede descubrir si se para a
 * pensar si de verdad resolvería el problema.
 */
export interface ProblemaCreativo {
  readonly situacion: string;
  readonly correcta: string;
  readonly incorrectas: readonly string[];
  readonly minBand: AgeBand;
}

export const PROBLEMAS_CREATIVOS: readonly ProblemaCreativo[] = [
  { situacion: 'Se te cayó una canica debajo del sillón y tu mano no cabe.', correcta: 'Sacarla empujando con una regla larga', incorrectas: ['Soplarle desde lejos', 'Esperar a que salga sola', 'Aventar otra canica encima'], minBand: '6-8' },
  { situacion: 'Está lloviendo, no tienes paraguas y debes llevar tu dibujo al otro salón.', correcta: 'Guardar el dibujo en una bolsa de plástico', incorrectas: ['Doblar el dibujo muchas veces', 'Correr con el dibujo en la mano', 'Soplarle al dibujo mientras caminas'], minBand: '6-8' },
  { situacion: 'Tu planta está seca y la regadera se rompió.', correcta: 'Regarla con un vaso de agua, poco a poco', incorrectas: ['Ponerla junto a la estufa', 'Taparla con una cobija', 'Pintar las hojas de verde'], minBand: '6-8' },
  { situacion: 'Quieres alcanzar un libro que está en una repisa muy alta.', correcta: 'Pedir ayuda a un adulto', incorrectas: ['Saltar hasta tocarlo', 'Jalar la repisa hacia abajo', 'Trepar por los cajones abiertos'], minBand: '6-8' },
  { situacion: 'Tu lápiz se quedó sin punta y no tienes sacapuntas.', correcta: 'Pedir prestado un sacapuntas o un lápiz', incorrectas: ['Morder la punta', 'Seguir escribiendo con la madera', 'Dejar la tarea sin hacer'], minBand: '6-8' },
  { situacion: 'Se derramó agua en la mesa donde vas a dibujar.', correcta: 'Secarla con un trapo o una servilleta', incorrectas: ['Soplarle para que se vaya', 'Poner tu cuaderno encima', 'Dibujar encima del agua'], minBand: '6-8' },
  { situacion: 'Quieres saber si una naranja flota o se hunde.', correcta: 'Ponerla con cuidado en una tina con agua', incorrectas: ['Pesarla con la mano', 'Mirarla con una lupa', 'Pelarla y adivinar'], minBand: '6-8' },
  { situacion: 'Tienes las manos muy frías en el recreo.', correcta: 'Ponerte guantes o frotarte las manos', incorrectas: ['Mojarlas con agua fría', 'Quitarte el suéter', 'Ponerlas en el piso'], minBand: '6-8' },
  { situacion: 'Se perdió tu gato y quieres que los vecinos te ayuden a buscarlo.', correcta: 'Hacer un cartel con su dibujo y pegarlo en la calle', incorrectas: ['Esconderte en tu cuarto', 'Llamarlo una sola vez', 'Esperar sin decirle a nadie'], minBand: '6-8' },
  { situacion: 'Tu torre de bloques se cae porque la base es muy chiquita.', correcta: 'Hacer la base más ancha', incorrectas: ['Poner los bloques grandes arriba', 'Construirla más rápido', 'Soplarle para acomodarla'], minBand: '6-8' },

  { situacion: 'Tienes que medir el largo de tu cuarto y no hay cinta métrica.', correcta: 'Contar cuántos pasos iguales caben y medir un paso con una regla', incorrectas: ['Adivinar el número', 'Medir solo la puerta', 'Contar los focos del techo'], minBand: '9-12' },
  { situacion: 'La puerta del salón se cierra sola y no entra aire.', correcta: 'Poner un tope en el piso para detenerla', incorrectas: ['Pintar la puerta', 'Cerrar las ventanas', 'Quitarle la manija'], minBand: '9-12' },
  { situacion: 'Quieres que tu carrito baje más lejos por una rampa.', correcta: 'Hacer la rampa más inclinada y lisa', incorrectas: ['Pintarle rayas al carrito', 'Acostar la rampa en el piso', 'Hacer el carrito de cartón mojado'], minBand: '9-12' },
  { situacion: 'El salón está muy ruidoso y nadie escucha a la maestra.', correcta: 'Acordar una señal con la mano para pedir silencio', incorrectas: ['Que todos hablen más fuerte', 'Poner música', 'Salir del salón'], minBand: '9-12' },
  { situacion: 'Tu bici rechina al pedalear y la cadena está seca.', correcta: 'Ponerle aceite a la cadena con ayuda de un adulto', incorrectas: ['Mojarla con refresco', 'Pedalear más rápido', 'Quitarle los frenos'], minBand: '9-12' },
  { situacion: 'Siempre olvidas llevar tu cuaderno a la escuela.', correcta: 'Dejarlo en la mochila desde la noche anterior', incorrectas: ['Pensarlo muy fuerte una vez', 'Escribirlo en tu mano ya en la escuela', 'Esconderlo debajo de la cama'], minBand: '9-12' },
  { situacion: 'Quieres ver cómo crecen las raíces de un frijol.', correcta: 'Ponerlo en un frasco con algodón húmedo junto a la ventana', incorrectas: ['Guardarlo en el congelador', 'Enterrarlo en arena seca', 'Dejarlo en un cajón sin agua'], minBand: '9-12' },
  { situacion: 'Tu mochila pesa mucho y te duele la espalda.', correcta: 'Llevar solo lo del día y usar las dos correas', incorrectas: ['Cargarla con una sola mano', 'Meter más libros para equilibrar', 'Arrastrarla por el piso'], minBand: '9-12' },

  { situacion: 'Tu escuela quiere usar menos plástico en la cafetería.', correcta: 'Dar un descuento a quien traiga su propio vaso', incorrectas: ['Comprar popotes de colores', 'Prohibir comer en la escuela', 'Tirar la basura en otro lado'], minBand: '13-16' },
  { situacion: 'Tu equipo no se pone de acuerdo sobre el tema del proyecto.', correcta: 'Hacer una lista de opciones y votar con criterios claros', incorrectas: ['Que decida quien grite más', 'Que cada quien haga un proyecto distinto', 'No entregar nada'], minBand: '13-16' },
  { situacion: 'El celular se descarga muy rápido en un viaje largo.', correcta: 'Bajar el brillo y cerrar las apps que no usas', incorrectas: ['Subir el volumen', 'Ponerlo al sol', 'Abrir más apps a la vez'], minBand: '13-16' },
  { situacion: 'Tienes tres exámenes la próxima semana.', correcta: 'Repartir el estudio en bloques diarios para cada materia', incorrectas: ['Estudiar todo la noche anterior', 'Estudiar solo tu materia favorita', 'Leer cada tema una sola vez'], minBand: '13-16' },
  { situacion: 'El huerto de la escuela se seca cada fin de semana.', correcta: 'Enterrar botellas con agujeros junto a las plantas para que rieguen poco a poco', incorrectas: ['Inundarlo el viernes', 'Cubrirlo con plástico negro', 'Cambiar las plantas cada lunes'], minBand: '13-16' },
  { situacion: 'Quieres saber qué botana prefieren tus compañeros.', correcta: 'Hacer una encuesta corta y contar los resultados', incorrectas: ['Suponer que les gusta lo mismo que a ti', 'Preguntarle solo a tu mejor amigo', 'Elegir la más cara'], minBand: '13-16' },
  { situacion: 'Una rampa para silla de ruedas es demasiado empinada.', correcta: 'Hacerla más larga para que la subida sea más suave', incorrectas: ['Pintarla de amarillo', 'Hacerla más corta', 'Ponerle escalones'], minBand: '13-16' },
  { situacion: 'Tu video para la clase aburre a todos a los 30 segundos.', correcta: 'Empezar con una pregunta o un ejemplo interesante', incorrectas: ['Hacerlo más largo', 'Quitarle el audio', 'Leer todo el texto en pantalla'], minBand: '13-16' },
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
