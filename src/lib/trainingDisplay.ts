const formatMuscleFocus = (muscleFocus: string) => {
  const muscles = muscleFocus
    .split(/\s*[·,;]\s*/)
    .map((muscle) => muscle.trim().toLocaleLowerCase("es"))
    .filter(Boolean);

  if (muscles.length < 2) return muscleFocus.trim();

  const [first, ...rest] = muscles;
  const titleCase = (value: string) => value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
  const middle = rest.slice(0, -1);
  return `${titleCase(first)}${middle.length ? `, ${middle.join(", ")}` : ""} y ${rest.at(-1)}`;
};

export const formatTrainingTitle = (routineName?: string | null, muscleFocus?: string | null) => {
  const routine = routineName?.trim();
  const focus = muscleFocus?.trim();

  if (!routine) return focus ? formatMuscleFocus(focus) : "";
  if (!focus || routine.toLocaleLowerCase("es").includes(focus.toLocaleLowerCase("es"))) return routine;
  return `${routine} · ${formatMuscleFocus(focus)}`;
};
