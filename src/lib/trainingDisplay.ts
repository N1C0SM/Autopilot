export const friendlyGoalText = (value: string) => value.replace(/\b(gain_muscle|lose_weight|recomp|improve_endurance|general_health|skill_based)\b/g, key => ({gain_muscle:"Ganar músculo",lose_weight:"Perder grasa",recomp:"Recomposición",improve_endurance:"Mejorar resistencia",general_health:"Salud general",skill_based:"Habilidades"})[key] || key);
const formatMuscleFocus = (muscleFocus: string) => {
  const muscles = muscleFocus
    .split(/\s*[·,;]\s*/)
    .map((muscle) => muscle.trim().toLocaleLowerCase("es"))
    .filter(Boolean);

  if (muscles.length < 2) return muscleFocus.trim();

  const [first, ...rest] = muscles;
  const titleCase = (value: string) => value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
  const middle = rest.slice(0, -1);
  return `${titleCase(first)}${middle.length ? `, ${middle.join(", ")}` : ""} y ${rest[rest.length - 1]}`;
};

export const formatTrainingTitle = (routineName?: string | null, muscleFocus?: string | null) => {
  const routine = routineName ? friendlyGoalText(routineName.trim()) : undefined;
  const focus = muscleFocus?.trim();

  if (!routine) return focus ? formatMuscleFocus(focus) : "";
  if (!focus || routine.toLocaleLowerCase("es").includes(focus.toLocaleLowerCase("es"))) return routine;
  return `${routine} · ${formatMuscleFocus(focus)}`;
};
