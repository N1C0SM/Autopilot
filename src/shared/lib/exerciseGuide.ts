/**
 * Técnica de un ejercicio: cómo se hace, en qué fijarse y qué evitar.
 *
 * La biblioteca de ejercicios no guarda texto de técnica, así que la guía se
 * resuelve por nombre (ejercicios habituales), después por patrón de movimiento
 * o grupo muscular, y si nada encaja, con pautas generales. Nunca devuelve vacío.
 */
export interface ExerciseGuide {
  steps: string[];
  cues: string[];
  mistakes: string[];
  /** Aviso de seguridad para levantamientos pesados. */
  safety?: string;
}

const HEAVY_SAFETY = "Con cargas altas, usa topes de seguridad o pide a alguien que te asista.";

const GUIDES = {
  hipThrust: {
    steps: [
      "Apoya la parte alta de la espalda en un banco, con la barra sobre la cadera y una almohadilla.",
      "Pies planos a la anchura de la cadera, de forma que arriba las rodillas queden a unos 90°.",
      "Empuja con los talones y sube la cadera hasta alinear hombros, cadera y rodillas. Baja controlado.",
    ],
    cues: [
      "Barbilla recogida y mirada al frente: costillas y pelvis se mueven juntas.",
      "Aprieta los glúteos un segundo arriba.",
      "Las rodillas siguen la línea de los pies.",
    ],
    mistakes: [
      "Arquear la zona lumbar en lugar de extender la cadera.",
      "Colocar los pies demasiado lejos o demasiado cerca del banco.",
    ],
  },
  romanianDeadlift: {
    steps: [
      "De pie con el peso en las manos y las rodillas ligeramente flexionadas.",
      "Lleva la cadera hacia atrás y baja el peso pegado a las piernas con la espalda neutra.",
      "Para al notar un estiramiento fuerte en los isquios y sube empujando la cadera hacia delante.",
    ],
    cues: [
      "El peso roza las piernas durante todo el recorrido.",
      "La flexión de rodilla no cambia: el movimiento es de cadera.",
      "Escápulas ligeramente atrás y cuello alineado.",
    ],
    mistakes: ["Redondear la espalda para bajar más.", "Convertirlo en una sentadilla doblando las rodillas."],
  },
  deadlift: {
    steps: [
      "Pies a la anchura de la cadera y la barra sobre la mitad del pie.",
      "Agarra la barra, baja la cadera hasta que las tibias la toquen y saca el pecho.",
      "Empuja el suelo y extiende la cadera a la vez. Baja por el mismo camino.",
    ],
    cues: [
      "Tensa los dorsales antes de tirar, como si apretaras las axilas.",
      "La barra va pegada al cuerpo todo el recorrido.",
      "Coge aire y bloquea el abdomen antes de cada repetición.",
    ],
    mistakes: ["Tirar con la espalda redondeada.", "Subir la cadera antes que la barra."],
    safety: HEAVY_SAFETY,
  },
  splitSquat: {
    steps: [
      "Apoya el empeine del pie trasero en un banco y adelanta el otro pie.",
      "Baja en vertical hasta que la rodilla trasera casi toque el suelo.",
      "Sube empujando con el pie delantero.",
    ],
    cues: [
      "El peso va sobre todo en el pie delantero.",
      "Torso algo inclinado para más glúteo; más vertical para más cuádriceps.",
      "La rodilla delantera sigue la línea del pie.",
    ],
    mistakes: ["Poner el pie delantero tan cerca que se levanta el talón.", "Rebotar abajo sin control."],
  },
  lunge: {
    steps: [
      "De pie, da un paso largo hacia delante o hacia atrás.",
      "Baja hasta que las dos rodillas formen unos 90°.",
      "Empuja con el pie delantero para volver.",
    ],
    cues: ["Torso estable y abdomen firme.", "La rodilla delantera sigue la dirección del pie.", "Controla la bajada."],
    mistakes: ["Dejar que la rodilla delantera se vaya hacia dentro.", "Dar pasos demasiado cortos."],
  },
  gobletSquat: {
    steps: [
      "Sujeta una mancuerna o kettlebell pegada al pecho, con los codos hacia abajo.",
      "Pies algo más abiertos que la cadera y las puntas ligeramente hacia fuera.",
      "Baja entre las piernas con el torso erguido y sube empujando el suelo.",
    ],
    cues: [
      "Los codos bajan por dentro de las rodillas.",
      "Pie entero apoyado: talón y base de los dedos.",
      "Rodillas hacia fuera, en la línea de los pies.",
    ],
    mistakes: ["Separar el peso del pecho.", "Levantar los talones al bajar."],
  },
  legPress: {
    steps: [
      "Siéntate con la espalda y la cadera bien apoyadas.",
      "Pies en la plataforma a la anchura de la cadera.",
      "Baja hasta donde la pelvis no se despegue y empuja sin bloquear las rodillas.",
    ],
    cues: ["La zona lumbar no se separa del respaldo.", "Rodillas alineadas con los pies.", "Empuja con todo el pie."],
    mistakes: ["Bajar tanto que la pelvis se enrolla.", "Bloquear las rodillas de golpe arriba."],
  },
  squat: {
    steps: [
      "Barra sobre la parte alta de la espalda, manos firmes y codos debajo.",
      "Pies a la anchura de los hombros y las puntas algo hacia fuera.",
      "Baja sentándote entre las piernas hasta al menos la paralela y sube empujando el suelo.",
    ],
    cues: [
      "Coge aire y bloquea el abdomen antes de bajar.",
      "Rodillas hacia fuera, siguiendo la línea de los pies.",
      "El peso repartido en todo el pie.",
    ],
    mistakes: ["Que las rodillas se cierren al subir.", "Inclinar el torso de golpe al salir del fondo."],
    safety: HEAVY_SAFETY,
  },
  benchPress: {
    steps: [
      "Túmbate con los ojos bajo la barra, escápulas juntas y hacia abajo, y los pies firmes en el suelo.",
      "Agarra algo más ancho que los hombros y saca la barra con los brazos estirados.",
      "Baja controlado hasta la parte baja del pecho y empuja hacia arriba y ligeramente hacia atrás.",
    ],
    cues: [
      "Codos entre 45° y 70° respecto al torso, no abiertos en cruz.",
      "Muñecas rectas, con la barra sobre el antebrazo.",
      "Glúteos apoyados en el banco todo el tiempo.",
    ],
    mistakes: ["Rebotar la barra en el pecho.", "Perder la posición de las escápulas al empujar."],
    safety: HEAVY_SAFETY,
  },
  overheadPress: {
    steps: [
      "De pie, barra a la altura de las clavículas y agarre algo más ancho que los hombros.",
      "Aprieta glúteos y abdomen y empuja la barra en vertical, apartando la cabeza.",
      "Termina con la barra sobre la mitad del pie y la cabeza entre los brazos. Baja controlado.",
    ],
    cues: ["Antebrazos verticales vistos de frente.", "Costillas abajo: sin arquear la espalda.", "La barra sube en línea recta."],
    mistakes: ["Arquear la zona lumbar para empujar.", "Empujar la barra hacia delante en lugar de hacia arriba."],
  },
  dips: {
    steps: [
      "Sujétate en las paralelas con los brazos estirados y los hombros abajo.",
      "Baja flexionando los codos, con el torso algo inclinado, hasta que los hombros lleguen a la altura de los codos.",
      "Empuja hasta estirar los brazos.",
    ],
    cues: ["Hombros lejos de las orejas.", "Codos hacia atrás, no abiertos.", "Bajada controlada."],
    mistakes: ["Bajar más de lo que tus hombros toleran.", "Encoger los hombros."],
  },
  pushUp: {
    steps: [
      "Manos algo más anchas que los hombros y el cuerpo en línea de cabeza a talones.",
      "Baja el pecho hacia el suelo con los codos a unos 45°.",
      "Empuja el suelo hasta estirar los brazos.",
    ],
    cues: ["Glúteos y abdomen apretados: el cuerpo es una tabla.", "El pecho llega cerca del suelo.", "Separa las escápulas arriba."],
    mistakes: ["Dejar caer la cadera.", "Abrir los codos en cruz."],
  },
  pullUp: {
    steps: [
      "Cuelga de la barra con agarre algo más ancho que los hombros y los brazos estirados.",
      "Empieza bajando los hombros y lleva el pecho hacia la barra tirando de los codos hacia abajo.",
      "Sube hasta pasar la barbilla y baja controlado hasta estirar los brazos.",
    ],
    cues: ["Piensa en llevar los codos a los bolsillos.", "Cuerpo estable, sin balanceo.", "Recorrido completo en cada repetición."],
    mistakes: ["Hacer medias repeticiones sin estirar abajo.", "Impulsarte con las piernas."],
  },
  latPulldown: {
    steps: [
      "Ajusta el rodillo sobre los muslos y agarra la barra algo más ancho que los hombros.",
      "Baja los hombros y tira de la barra hacia la parte alta del pecho.",
      "Sube controlado hasta estirar los brazos.",
    ],
    cues: ["Codos hacia abajo y atrás.", "Torso ligeramente inclinado y quieto.", "Pecho hacia la barra."],
    mistakes: ["Tirar por detrás de la nuca.", "Balancear el torso para mover el peso."],
  },
  row: {
    steps: [
      "Inclina el torso con la espalda neutra, o apóyate en un banco.",
      "Tira del peso hacia la parte baja del pecho llevando los codos atrás.",
      "Baja controlado hasta estirar los brazos.",
    ],
    cues: ["Junta las escápulas al final del tirón.", "El torso no ayuda a subir el peso.", "Cuello alineado con la espalda."],
    mistakes: ["Redondear la espalda.", "Encoger los hombros al tirar."],
  },
  facePull: {
    steps: [
      "Polea a la altura de la cara con cuerda; agarra con los pulgares hacia ti.",
      "Tira hacia la cara separando las manos, con los codos altos.",
      "Vuelve controlado.",
    ],
    cues: ["Codos a la altura de los hombros o por encima.", "Rota los hombros hacia fuera al final.", "Carga moderada y técnica limpia."],
    mistakes: ["Tirar echando el cuerpo atrás.", "Usar tanto peso que no puedes rotar."],
  },
  lateralRaise: {
    steps: [
      "De pie, mancuernas a los lados y codos algo flexionados.",
      "Sube los brazos hacia los lados hasta la altura de los hombros.",
      "Baja despacio.",
    ],
    cues: ["Sube guiando con los codos, no con las manos.", "Hombros lejos de las orejas.", "Torso quieto."],
    mistakes: ["Balancear el cuerpo.", "Subir por encima de los hombros encogiéndolos."],
  },
  legCurl: {
    steps: [
      "Ajusta la máquina: rodilla alineada con el eje y el rodillo sobre los tobillos.",
      "Flexiona las rodillas llevando los talones hacia los glúteos.",
      "Vuelve despacio hasta casi estirar.",
    ],
    cues: ["Cadera pegada al banco o al asiento.", "Pausa breve en la contracción.", "Controla la bajada."],
    mistakes: ["Levantar la cadera para ayudarte.", "Soltar el peso de golpe."],
  },
  legExtension: {
    steps: [
      "Ajusta el asiento: rodilla alineada con el eje y el rodillo sobre los tobillos.",
      "Extiende las rodillas hasta casi bloquear.",
      "Baja controlado.",
    ],
    cues: ["Agárrate a las asas para no despegarte.", "Pausa de un segundo arriba.", "Recorrido completo."],
    mistakes: ["Dar patadas con impulso.", "Despegar la cadera del asiento."],
  },
  triceps: {
    steps: [
      "Fija los codos cerca de la cabeza o pegados al cuerpo, según la variante.",
      "Extiende los codos hasta estirar los brazos.",
      "Vuelve controlado hasta notar el estiramiento.",
    ],
    cues: ["Solo se mueven los antebrazos.", "Muñecas firmes.", "Bajada lenta."],
    mistakes: ["Abrir los codos.", "Usar el torso para mover el peso."],
  },
  bicepsCurl: {
    steps: [
      "De pie, brazos estirados y codos pegados al cuerpo.",
      "Flexiona los codos y sube el peso hacia los hombros.",
      "Baja despacio hasta estirar.",
    ],
    cues: ["Codos quietos a los lados.", "Palmas hacia arriba al subir.", "Sin balanceo."],
    mistakes: ["Balancear el torso.", "Cortar el recorrido abajo."],
  },
  chestFly: {
    steps: [
      "Brazos extendidos delante del pecho con los codos ligeramente flexionados.",
      "Abre los brazos en arco hasta notar el estiramiento en el pecho.",
      "Vuelve por el mismo arco juntando las manos.",
    ],
    cues: ["El ángulo del codo no cambia.", "Pecho alto y escápulas atrás.", "Movimiento lento."],
    mistakes: ["Convertirlo en un press doblando los codos.", "Bajar más de lo que tu hombro tolera."],
  },
  plank: {
    steps: [
      "Antebrazos en el suelo bajo los hombros y piernas estiradas.",
      "Cuerpo en línea recta de cabeza a talones.",
      "Mantén la posición respirando con normalidad.",
    ],
    cues: ["Aprieta glúteos y abdomen.", "Empuja el suelo con los antebrazos.", "Cuello neutro."],
    mistakes: ["Dejar caer la cadera.", "Aguantar la respiración."],
  },
  crunch: {
    steps: [
      "Túmbate con las rodillas flexionadas, o en el banco declinado con los pies sujetos.",
      "Enrolla el torso acercando las costillas a la pelvis.",
      "Baja controlado sin llegar a descansar.",
    ],
    cues: ["Piensa en enrollar la columna, no en subir recto.", "Si usas peso, sujétalo pegado al pecho.", "Suelta el aire al subir."],
    mistakes: ["Tirar del cuello con las manos.", "Subir con impulso."],
  },
  legRaise: {
    steps: [
      "Cuelga de la barra o túmbate boca arriba con las piernas estiradas.",
      "Sube las piernas enrollando la pelvis hacia arriba.",
      "Baja despacio sin balancearte.",
    ],
    cues: ["El movimiento acaba en la pelvis, no en las piernas.", "Hombros activos si estás colgado.", "Controla la bajada."],
    mistakes: ["Balancearte para subir.", "Arquear la zona lumbar al bajar."],
  },
  rollout: {
    steps: [
      "De rodillas, con las manos en la rueda bajo los hombros.",
      "Rueda hacia delante con el abdomen firme hasta donde llegues sin arquear la espalda.",
      "Vuelve tirando con el abdomen.",
    ],
    cues: ["Glúteos apretados y pelvis hacia dentro.", "Brazos estirados.", "Recorrido corto al principio."],
    mistakes: ["Arquear la zona lumbar.", "Llegar más lejos de lo que controlas."],
  },
  calfRaise: {
    steps: [
      "Apoya la parte delantera del pie en un escalón con los talones libres.",
      "Sube lo más alto que puedas.",
      "Baja despacio hasta notar el estiramiento.",
    ],
    cues: ["Pausa arriba y abajo.", "Recorrido completo.", "Rodillas estiradas, o flexionadas en la variante sentado."],
    mistakes: ["Rebotar abajo.", "Hacer medias repeticiones."],
  },
  skill: {
    steps: [
      "Calienta muñecas, hombros y escápulas antes de empezar.",
      "Trabaja la progresión que puedas sostener con buena forma.",
      "Series cortas y descansos largos: es trabajo de fuerza máxima.",
    ],
    cues: ["Para cuando pierdas la forma: calidad antes que tiempo.", "Escápulas activas en todo momento.", "Cuerpo tenso de pies a cabeza."],
    mistakes: ["Saltarte progresiones.", "Entrenarlo cansado al final de la sesión."],
  },
} satisfies Record<string, ExerciseGuide>;

const PATTERN_GUIDES: Record<"push" | "pull" | "squat" | "hinge" | "core", ExerciseGuide> = {
  push: {
    steps: [
      "Coloca hombros y escápulas estables antes de empujar.",
      "Baja el peso controlado hasta el recorrido completo.",
      "Empuja con intención manteniendo la postura.",
    ],
    cues: ["Muñecas alineadas con los antebrazos.", "Codos sin abrir del todo.", "Abdomen firme."],
    mistakes: ["Rebotar abajo.", "Encoger los hombros."],
  },
  pull: {
    steps: [
      "Empieza activando las escápulas: hombros abajo y atrás.",
      "Tira llevando los codos hacia el cuerpo.",
      "Vuelve despacio hasta estirar los brazos.",
    ],
    cues: ["Piensa en los codos, no en las manos.", "Torso estable.", "Recorrido completo."],
    mistakes: ["Usar impulso.", "Encoger los hombros."],
  },
  squat: {
    steps: [
      "Pies firmes y el peso repartido en todo el pie.",
      "Baja flexionando cadera y rodillas a la vez con el torso estable.",
      "Sube empujando el suelo.",
    ],
    cues: ["Rodillas en la línea de los pies.", "Abdomen bloqueado.", "Baja hasta donde controles."],
    mistakes: ["Dejar que las rodillas se vayan hacia dentro.", "Levantar los talones."],
  },
  hinge: {
    steps: [
      "Rodillas ligeramente flexionadas y espalda neutra.",
      "Lleva la cadera hacia atrás para bajar el peso.",
      "Sube extendiendo la cadera y apretando los glúteos.",
    ],
    cues: ["El peso cerca del cuerpo.", "El movimiento es de cadera, no de espalda.", "Cuello alineado."],
    mistakes: ["Redondear la espalda.", "Echarte hacia atrás al terminar arriba."],
  },
  core: {
    steps: [
      "Coloca la pelvis en posición neutra.",
      "Haz el movimiento despacio con el abdomen firme.",
      "Respira sin perder la tensión.",
    ],
    cues: ["Costillas abajo.", "Calidad antes que cantidad.", "Controla cada fase."],
    mistakes: ["Arquear la zona lumbar.", "Usar impulso."],
  },
};

const GENERIC_GUIDE: ExerciseGuide = {
  steps: [
    "Calienta con una o dos series ligeras.",
    "Haz cada repetición con el recorrido completo que controles.",
    "Baja en 2 o 3 segundos y sube con intención.",
  ],
  cues: [
    "Postura estable antes de mover el peso.",
    "Suelta el aire en el esfuerzo.",
    "Deja una o dos repeticiones en reserva salvo que tu plan diga otra cosa.",
  ],
  mistakes: ["Sacrificar la técnica por más peso.", "Acortar el recorrido."],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// El orden importa: lo específico antes que lo general ("curl femoral" antes que "curl",
// "triceps" antes que "jalon", "goblet" antes que "sentadilla").
const NAME_RULES: { test: RegExp; guide: ExerciseGuide }[] = [
  { test: /hip thrust|puente de gluteo|glute bridge/, guide: GUIDES.hipThrust },
  { test: /rumano|\brdl\b|romanian/, guide: GUIDES.romanianDeadlift },
  { test: /peso muerto|deadlift/, guide: GUIDES.deadlift },
  { test: /bulgar|split squat/, guide: GUIDES.splitSquat },
  { test: /zancada|estocada|lunge/, guide: GUIDES.lunge },
  { test: /goblet/, guide: GUIDES.gobletSquat },
  { test: /prensa|leg press/, guide: GUIDES.legPress },
  { test: /lever|planche|plancha (tuck|straddle|completa|full|lean)|muscle.?up|handstand|\bpino\b|l-sit|\bl sit\b|bandera|human flag/, guide: GUIDES.skill },
  { test: /sentadilla|squat/, guide: GUIDES.squat },
  { test: /press (de )?banca|bench/, guide: GUIDES.benchPress },
  { test: /press militar|press (de )?hombros?|overhead|press arnold/, guide: GUIDES.overheadPress },
  { test: /fondos|\bdips?\b/, guide: GUIDES.dips },
  { test: /flexion(es)? de brazos|flexiones|push.?ups?/, guide: GUIDES.pushUp },
  { test: /dominada|pull.?ups?|chin.?ups?/, guide: GUIDES.pullUp },
  { test: /triceps|press frances|pushdown|skull/, guide: GUIDES.triceps },
  { test: /jalon|pulldown/, guide: GUIDES.latPulldown },
  { test: /face pull/, guide: GUIDES.facePull },
  { test: /\bremo\b|\brow\b/, guide: GUIDES.row },
  { test: /elevaci(on|ones) laterale?s?|lateral raise/, guide: GUIDES.lateralRaise },
  { test: /curl femoral|femoral|leg curl|hamstring curl/, guide: GUIDES.legCurl },
  { test: /extensi(on|ones) de (cuadriceps|pierna)|leg extension/, guide: GUIDES.legExtension },
  { test: /\bcurl\b/, guide: GUIDES.bicepsCurl },
  { test: /apertura|cruce de polea|pec deck|contractora|\bfly\b|\bflyes?\b/, guide: GUIDES.chestFly },
  { test: /rueda|ab wheel|rollout/, guide: GUIDES.rollout },
  { test: /elevaci(on|ones) de piernas|leg raise|rodillas al pecho/, guide: GUIDES.legRaise },
  { test: /plancha|plank/, guide: GUIDES.plank },
  { test: /abdominal|crunch|encogimiento/, guide: GUIDES.crunch },
  { test: /gemelo|pantorrilla|calf/, guide: GUIDES.calfRaise },
];

const PATTERN_ALIASES: Record<string, keyof typeof PATTERN_GUIDES> = {
  empuje: "push",
  tiron: "pull",
  sentadilla: "squat",
  bisagra: "hinge",
  core: "core",
};

const MUSCLE_TO_PATTERN: Record<string, keyof typeof PATTERN_GUIDES> = {
  pecho: "push",
  hombros: "push",
  triceps: "push",
  espalda: "pull",
  biceps: "pull",
  romboides: "pull",
  trapecios: "pull",
  antebrazos: "pull",
  piernas: "squat",
  aductores: "squat",
  abductores: "squat",
  gluteos: "hinge",
  isquiotibiales: "hinge",
  lumbares: "hinge",
  core: "core",
  serrato: "core",
};

export function getExerciseGuide(input: {
  name?: string | null;
  movementPattern?: string | null;
  muscleGroup?: string | null;
}): ExerciseGuide {
  const name = normalize(input.name ?? "");
  if (name) {
    const rule = NAME_RULES.find((candidate) => candidate.test.test(name));
    if (rule) return rule.guide;
  }
  const pattern = PATTERN_ALIASES[normalize(input.movementPattern ?? "")];
  if (pattern) return PATTERN_GUIDES[pattern];
  const byMuscle = MUSCLE_TO_PATTERN[normalize(input.muscleGroup ?? "")];
  if (byMuscle) return PATTERN_GUIDES[byMuscle];
  return GENERIC_GUIDE;
}
