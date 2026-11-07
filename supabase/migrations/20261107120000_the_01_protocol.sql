-- THE 0.1% PROTOCOL — Ejercicios y rutina de Nicolás San Marcos
-- Fase 1: inserta los ejercicios del protocolo en la biblioteca.
-- Fase 2: asigna la rutina semanal al usuario nicolassanmarcos4@gmail.com.

-- ─── FASE 1: Ejercicios ───────────────────────────────────────────────────────
-- Se insertan como status='published', source='autopilot', con is_stable/is_progressable/high_tension=true.
-- El trigger exercises_before_write genera el slug automáticamente.

DO $$
DECLARE
  -- IDs de equipamiento
  eq_bw          uuid; -- peso-corporal
  eq_barra_dom   uuid; -- barra-dominadas
  eq_paralelas   uuid; -- paralelas
  eq_anillas     uuid; -- anillas
  eq_mancuernas  uuid; -- mancuernas
  eq_barra       uuid; -- barra
  eq_poleas      uuid; -- poleas

  -- IDs de músculos
  m_dorsal          uuid;
  m_biceps          uuid;
  m_braquial        uuid;
  m_recto_abd       uuid;
  m_oblicuos        uuid;
  m_flex_cadera     uuid;
  m_cuadriceps      uuid;
  m_isquios         uuid;
  m_gluteo_mayor    uuid;
  m_gluteo_medio    uuid;
  m_gemelos         uuid;
  m_soleo           uuid;
  m_pectoral        uuid;
  m_serrato         uuid;
  m_delt_ant        uuid;
  m_delt_lat        uuid;
  m_delt_post       uuid;
  m_trapecio        uuid;
  m_romboides       uuid;
  m_triceps         uuid;
  m_antebrazo       uuid;
  m_erectores       uuid;

  -- IDs de categorías
  cat_cal  uuid; -- calistenia
  cat_gym  uuid; -- gimnasio
  cat_func uuid; -- funcional
  cat_mov  uuid; -- movilidad

  -- IDs de los ejercicios nuevos
  ex_front_lever_neg   uuid;
  ex_front_lever_hold  uuid;
  ex_front_lever_row   uuid;
  ex_one_arm_hang      uuid;
  ex_one_arm_dom       uuid;
  ex_one_arm_neg       uuid;
  ex_press_inc_mc      uuid;
  ex_apert_inc         uuid;
  ex_dips              uuid;
  ex_elevac_lat        uuid;
  ex_face_pull         uuid;
  ex_dominadas         uuid;
  ex_remo_mc           uuid;
  ex_curl_barra        uuid;
  ex_curl_mc_alt       uuid;
  ex_press_mc          uuid;
  ex_fondos_tri        uuid;
  ex_squat             uuid;
  ex_bulgarian         uuid;
  ex_hip_thrust        uuid;
  ex_rdl               uuid;
  ex_glute_kickback    uuid;
  ex_hollow_body       uuid;
  ex_l_sit             uuid;
  ex_ab_wheel          uuid;
  ex_dragon_flag       uuid;
  ex_dead_hang         uuid;
  ex_farmers_walk      uuid;
  ex_sprint            uuid;
  ex_salto_cuerda      uuid;
BEGIN

  -- ── Carga de IDs de catálogos ──
  SELECT id INTO eq_bw          FROM public.equipment WHERE slug = 'peso-corporal';
  SELECT id INTO eq_barra_dom   FROM public.equipment WHERE slug = 'barra-dominadas';
  SELECT id INTO eq_paralelas   FROM public.equipment WHERE slug = 'paralelas';
  SELECT id INTO eq_anillas     FROM public.equipment WHERE slug = 'anillas';
  SELECT id INTO eq_mancuernas  FROM public.equipment WHERE slug = 'mancuernas';
  SELECT id INTO eq_barra       FROM public.equipment WHERE slug = 'barra';
  SELECT id INTO eq_poleas      FROM public.equipment WHERE slug = 'poleas';

  SELECT id INTO m_dorsal        FROM public.muscles WHERE slug = 'dorsal';
  SELECT id INTO m_biceps        FROM public.muscles WHERE slug = 'biceps';
  SELECT id INTO m_braquial      FROM public.muscles WHERE slug = 'braquial';
  SELECT id INTO m_recto_abd     FROM public.muscles WHERE slug = 'recto-abdominal';
  SELECT id INTO m_oblicuos      FROM public.muscles WHERE slug = 'oblicuos';
  SELECT id INTO m_flex_cadera   FROM public.muscles WHERE slug = 'flexores-cadera';
  SELECT id INTO m_cuadriceps    FROM public.muscles WHERE slug = 'cuadriceps';
  SELECT id INTO m_isquios       FROM public.muscles WHERE slug = 'isquiotibiales';
  SELECT id INTO m_gluteo_mayor  FROM public.muscles WHERE slug = 'gluteo-mayor';
  SELECT id INTO m_gluteo_medio  FROM public.muscles WHERE slug = 'gluteo-medio';
  SELECT id INTO m_gemelos       FROM public.muscles WHERE slug = 'gemelos';
  SELECT id INTO m_soleo         FROM public.muscles WHERE slug = 'soleo';
  SELECT id INTO m_pectoral      FROM public.muscles WHERE slug = 'pectoral';
  SELECT id INTO m_serrato       FROM public.muscles WHERE slug = 'serrato';
  SELECT id INTO m_delt_ant      FROM public.muscles WHERE slug = 'deltoides-anterior';
  SELECT id INTO m_delt_lat      FROM public.muscles WHERE slug = 'deltoides-lateral';
  SELECT id INTO m_delt_post     FROM public.muscles WHERE slug = 'deltoides-posterior';
  SELECT id INTO m_trapecio      FROM public.muscles WHERE slug = 'trapecio';
  SELECT id INTO m_romboides     FROM public.muscles WHERE slug = 'romboides';
  SELECT id INTO m_triceps       FROM public.muscles WHERE slug = 'triceps';
  SELECT id INTO m_antebrazo     FROM public.muscles WHERE slug = 'antebrazo';
  SELECT id INTO m_erectores     FROM public.muscles WHERE slug = 'erectores';

  SELECT id INTO cat_cal  FROM public.exercise_categories_catalog WHERE slug = 'calistenia';
  SELECT id INTO cat_gym  FROM public.exercise_categories_catalog WHERE slug = 'gimnasio';
  SELECT id INTO cat_func FROM public.exercise_categories_catalog WHERE slug = 'funcional';
  SELECT id INTO cat_mov  FROM public.exercise_categories_catalog WHERE slug = 'movilidad';


  -- ── PROJECT LEVER: Front lever ────────────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension, skill_tag, progression_order)
  VALUES (
    'Front lever negativa',
    ARRAY['Front lever negative', 'Negativa front lever'],
    'La fase excéntrica del front lever: bajas el cuerpo de forma controlada desde horizontal hasta la posición colgada. Es la progresión más efectiva para desarrollar la fuerza de tirón y la tensión abdominal necesarias para mantener el front lever.',
    ARRAY['Agárrate a la barra con pronación y brazos extendidos.','Sube las piernas hasta la posición de front lever con ayuda si necesitas.','Baja lentamente y de forma controlada durante 4-6 segundos.','Mantén el cuerpo completamente recto: caderas, espalda y piernas en línea.','Llega hasta la posición colgada sin perder la tensión.'],
    ARRAY['Dejar caer el cuerpo sin control en la fase final.','Encorvar la espalda o flexionar las caderas.','No mantener la tensión en el core durante todo el descenso.'],
    ARRAY['Busca sentir los dorsales trabajando activamente durante todo el recorrido.','Empieza con progresiones: tucked o straddle antes de full.'],
    ARRAY['Calienta bien los hombros y codos antes de trabajar esta habilidad.'],
    'Espalda', 'Calistenia', 'Tirón', 3, 1, 'Fuerza', 'Alta', 'Alta', 1,
    'compound', 'published', 'autopilot', true, true, true, 'front_lever', 2
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_front_lever_neg;

  IF ex_front_lever_neg IS NULL THEN
    SELECT id INTO ex_front_lever_neg FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Front lever negativa');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension, skill_tag, progression_order)
  VALUES (
    'Front lever isométrico',
    ARRAY['Front lever hold', 'Front lever static'],
    'Mantener el cuerpo horizontal colgado de la barra con brazos extendidos. Una de las habilidades de fuerza relativa más completas de la calistenia: exige dorsales, core y cadena posterior trabajando a la vez.',
    ARRAY['Agárrate a la barra con pronación, manos a la anchura de hombros.','Sube el cuerpo hasta la posición horizontal con los brazos extendidos.','Aprieta los glúteos, el core y los dorsales de forma simultánea.','Mantén la posición el tiempo objetivo sin perder la alineación.','Baja de forma controlada.'],
    ARRAY['Dejar caer las caderas por debajo de la línea del cuerpo.','Doblar los codos durante el hold.','Aguantar la respiración más de 2-3 segundos seguidos.'],
    ARRAY['Progresa: tucked → straddle tucked → straddle → full.','El agarre debe ser firme pero no forzado para preservar los tendones.'],
    ARRAY['No trabajes esta habilidad si notas dolor en los codos o hombros.'],
    'Espalda', 'Calistenia', 'Tirón', 3, 1, 'Isométrico', 'Alta', 'Alta', 1,
    'compound', 'published', 'autopilot', true, true, true, 'front_lever', 3
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_front_lever_hold;

  IF ex_front_lever_hold IS NULL THEN
    SELECT id INTO ex_front_lever_hold FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Front lever isométrico');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension, skill_tag, progression_order)
  VALUES (
    'Front lever row',
    ARRAY['Front lever pull', 'Front lever tirón'],
    'Desde la posición de front lever, flexionas los codos y llevas el pecho hacia la barra. Combina la dificultad isométrica del front lever con la fuerza dinámica del tirón: uno de los ejercicios de espalda más difíciles y completos.',
    ARRAY['Adopta la posición de front lever con el cuerpo horizontal.','Mantén las caderas elevadas y el core activo durante todo el movimiento.','Flexiona los codos y tira del pecho hacia la barra.','Extiende los brazos de forma controlada para volver al punto de partida.'],
    ARRAY['Perder la posición horizontal al tirar.','Usar el impulso de las caderas en lugar de fuerza de brazos y espalda.'],
    ARRAY['Empieza con la versión tucked hasta dominar el movimiento.','Si aún no mantienes el full front lever, trabaja las negativas primero.'],
    ARRAY['Esta habilidad requiere meses de base previa. No la fuerces antes de tiempo.'],
    'Espalda', 'Calistenia', 'Tirón', 3, 1, 'Fuerza', 'Alta', 'Alta', 2,
    'compound', 'published', 'autopilot', true, true, true, 'front_lever', 4
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_front_lever_row;

  IF ex_front_lever_row IS NULL THEN
    SELECT id INTO ex_front_lever_row FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Front lever row');
  END IF;


  -- ── ONE ARM MISSION: Dominada a una mano ──────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension, skill_tag, progression_order)
  VALUES (
    'Dead hang a una mano',
    ARRAY['One arm dead hang', 'Colgado a una mano'],
    'Colgar de la barra con un solo brazo durante el mayor tiempo posible. El punto de partida obligatorio de la dominada a una mano: desarrolla la fuerza de agarre, la estabilidad del manguito rotador y la resistencia del antebrazo.',
    ARRAY['Agárrate a la barra con una mano, pronación o supinación.','Deja que el peso recaiga completamente sobre ese brazo.','Mantén el hombro activo: no dejes que el hombro suba hacia la oreja.','Aguanta el tiempo objetivo y cambia de mano.'],
    ARRAY['Dejar el hombro completamente pasivo (riesgo de impingement).','Rotar el cuerpo de forma excesiva con la inercia.'],
    ARRAY['Progresa: 10s → 20s → 30s → 45s antes de avanzar a la negativa.','Trabaja con ambos lados para detectar desequilibrios.'],
    ARRAY['No realices esta progresión si tienes lesiones activas en el hombro o codo.'],
    'Espalda', 'Calistenia', 'Tirón', 3, 1, 'Fuerza', 'Alta', 'Media', 1,
    'compound', 'published', 'autopilot', true, true, true, 'one_arm_pull', 1
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_dead_hang;

  IF ex_dead_hang IS NULL THEN
    SELECT id INTO ex_dead_hang FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dead hang a una mano');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension, skill_tag, progression_order)
  VALUES (
    'Dominada a una mano negativa',
    ARRAY['One arm pull-up negative', 'Negativa dominada unilateral'],
    'Fase excéntrica de la dominada a una mano: subes con las dos manos y bajas de forma controlada con una sola. El método más eficiente para construir la fuerza excéntrica específica que exige esta habilidad de élite.',
    ARRAY['Sube a la barra usando ambas manos hasta la posición de dominada completa.','Suelta una mano y colócala en el antebrazo del otro brazo para apoyo mínimo.','Baja de forma controlada durante 5-8 segundos con el brazo que trabaja.','Mantén el cuerpo recto y el core activo durante todo el descenso.','Cambia de brazo en cada serie.'],
    ARRAY['Bajar demasiado rápido sin control.','Apoyarse demasiado con la mano del antebrazo.','Dejar el hombro abrirse hacia afuera al bajar.'],
    ARRAY['Graba el descenso para verificar que la velocidad es constante.','3-5 negativas lentas por serie antes de perder la forma.'],
    ARRAY['Esta habilidad genera mucha tensión en los tendones del codo. Descansa 48-72h entre sesiones.'],
    'Espalda', 'Calistenia', 'Tirón', 3, 1, 'Fuerza', 'Alta', 'Alta', 2,
    'compound', 'published', 'autopilot', true, true, true, 'one_arm_pull', 3
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_one_arm_neg;

  IF ex_one_arm_neg IS NULL THEN
    SELECT id INTO ex_one_arm_neg FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dominada a una mano negativa');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension, skill_tag, progression_order)
  VALUES (
    'Dominada a una mano',
    ARRAY['One arm pull-up', 'One arm chin-up'],
    'La dominada a una mano es el pico de la fuerza relativa de tirón: subir el mentón por encima de la barra usando únicamente un brazo. Requiere años de trabajo específico, pero cuando se consigue, el control que da es incomparable.',
    ARRAY['Agárrate a la barra con una mano, supinación o pronación según preferencia.','Con el cuerpo ligeramente inclinado hacia ese lado, inicia el tirón desde el dorsal.','Flexiona el codo de forma explosiva y controlada hasta pasar el mentón por la barra.','Baja de forma excéntrica y controlada para aprovechar también la fase negativa.'],
    ARRAY['Usar un impulso de cadera para ayudar al tirón.','Subir sin activar el dorsal: si el hombro tira solo, la técnica falla.','No completar el rango: el mentón tiene que superar claramente la barra.'],
    ARRAY['Si tienes dudas de si la llegas, aún no la tienes. Sigue con las negativas.','El lado no dominante suele necesitar 2-4 semanas más de trabajo.'],
    ARRAY['Haz siempre un calentamiento específico de agarre y hombro antes de esta habilidad.'],
    'Espalda', 'Calistenia', 'Tirón', 3, 1, 'Fuerza', 'Alta', 'Alta', 3,
    'compound', 'published', 'autopilot', true, true, true, 'one_arm_pull', 5
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_one_arm_dom;

  IF ex_one_arm_dom IS NULL THEN
    SELECT id INTO ex_one_arm_dom FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dominada a una mano');
  END IF;


  -- ── FORGE: Pecho superior + dominadas ────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Press inclinado con mancuernas',
    ARRAY['Incline dumbbell press', 'Press mancuernas inclinado'],
    'Press de pecho sobre banco inclinado con mancuernas. Focaliza el trabajo en el haz clavicular del pectoral, la parte que define la línea superior del pecho y proyecta una imagen de fuerza.',
    ARRAY['Siéntate en el banco con inclinación de 30-45°, mancuernas sobre las rodillas.','Lleva las mancuernas a la altura del pecho con los codos a 60-75° del cuerpo.','Empuja de forma explosiva hasta extender los brazos sin bloquear los codos.','Baja de forma controlada en 2-3 segundos hasta sentir el estiramiento pectoral.'],
    ARRAY['Inclinar demasiado el banco (>45°): convierte el ejercicio en un press de hombro.','No bajar lo suficiente: el pecho no llega a estirarse.','Separar los codos 90° del tronco: sobrecarga el hombro anterior.'],
    ARRAY['Un banco a 30° activa más pecho y menos deltoides que a 45°.','Empareja las mancuernas en el punto alto para cerrar bien la contracción pectoral.'],
    ARRAY['No arquees la espalda de forma excesiva para proteger la columna lumbar.'],
    'Pecho', 'Gimnasio', 'Empuje', 2, 1, 'Hipertrofia', 'Media', 'Media', 1,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_press_inc_mc;

  IF ex_press_inc_mc IS NULL THEN
    SELECT id INTO ex_press_inc_mc FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Press inclinado con mancuernas');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Apertura inclinada con mancuernas',
    ARRAY['Incline dumbbell fly', 'Aperturas inclinadas'],
    'Movimiento de aislamiento para el pectoral superior realizado sobre banco inclinado. Maximiza el estiramiento en la fase negativa y trabaja la amplitud del pecho de una forma que el press no consigue.',
    ARRAY['Banco inclinado a 30°, mancuernas sujetas con los brazos casi extendidos.','Abre los brazos en arco con un ligero doblez en el codo hasta notar el estiramiento pectoral.','Sube trazando el mismo arco juntando las mancuernas en la parte alta.','Controla la bajada durante 2-3 segundos.'],
    ARRAY['Bajar demasiado: el hombro puede lesionarse más allá de una apertura de 90°.','Doblar mucho el codo y convertir el movimiento en un press.'],
    ARRAY['El peso es secundario aquí. Busca sentir cada repetición, no mover carga.','Úsalo como ejercicio finalizador después del press.'],
    ARRAY['Si notas molestia anterior en el hombro, reduce la apertura hasta el umbral sin dolor.'],
    'Pecho', 'Gimnasio', 'Empuje', 2, 2, 'Hipertrofia', 'Baja', 'Baja', 3,
    'isolation', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_apert_inc;

  IF ex_apert_inc IS NULL THEN
    SELECT id INTO ex_apert_inc FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Apertura inclinada con mancuernas');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Fondos en paralelas',
    ARRAY['Dips', 'Triceps dips', 'Fondos paralelas'],
    'El ejercicio de empuje más completo en calistenia: trabaja pecho inferior, tríceps y deltoides anterior con carga de peso corporal total. Fundamental para construir masa en el tren superior.',
    ARRAY['Sube a las paralelas con los brazos extendidos y el cuerpo recto.','Baja inclinando ligeramente el torso hacia delante para implicar más pecho.','Desciende hasta que los hombros queden por debajo de los codos o hasta notar el estiramiento.','Empuja hacia arriba de forma explosiva sin bloquear los codos al llegar arriba.'],
    ARRAY['No inclinar el torso: el ejercicio trabaja principalmente tríceps.','Bajar demasiado rápido sin control.','Encoger los hombros hacia las orejas al subir.'],
    ARRAY['Cuando dominas 3×12 con tu peso, añade lastrado para seguir progresando.','La inclinación hacia delante (10-20°) desplaza el trabajo hacia el pecho.'],
    ARRAY['Si tienes molestias en el hombro anterior, revisa la inclinación del tronco y reduce el rango.'],
    'Pecho', 'Calistenia', 'Empuje', 2, 1, 'Hipertrofia', 'Media', 'Media', 2,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_dips;

  IF ex_dips IS NULL THEN
    SELECT id INTO ex_dips FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Fondos en paralelas');
  END IF;


  -- ── WINGS: Hombro lateral ─────────────────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Elevación lateral con mancuernas',
    ARRAY['Lateral raise', 'Elevaciones laterales'],
    'El ejercicio de aislamiento del deltoides lateral por excelencia. Es lo que da anchura real a los hombros y la silueta en V al cuerpo. Pocos ejercicios tienen tanto impacto visual con tanto trabajo en hombro.',
    ARRAY['De pie con una mancuerna en cada mano, brazos a los lados del cuerpo.','Eleva los brazos de forma lateral hasta la altura del hombro con un ligero doblez en el codo.','En el punto alto, el dedo meñique debe estar ligeramente más alto que el pulgar (rotación interna).','Baja de forma controlada sin dejar que los brazos caigan.'],
    ARRAY['Elevar por encima de 90°: los trapecios toman el control y el lateral pierde tensión.','Usar demasiado peso y usar el impulso del cuerpo para subir.','No controlar la fase negativa.'],
    ARRAY['Las elevaciones laterales en polea mantienen más tensión en el deltoides que las mancuernas.','Series largas (15-20 reps) funcionan muy bien en este músculo.'],
    ARRAY['Si notas pellizco en el hombro al elevar, reduce la carga o usa la variante en polea.'],
    'Hombros', 'Gimnasio', 'Empuje', 1, 2, 'Hipertrofia', 'Baja', 'Baja', 3,
    'isolation', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_elevac_lat;

  IF ex_elevac_lat IS NULL THEN
    SELECT id INTO ex_elevac_lat FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Elevación lateral con mancuernas');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Face pull',
    ARRAY['Face pull polea', 'Tirón a la cara'],
    'Ejercicio de tirón en polea alta hacia la cara que trabaja el deltoides posterior, romboides y manguito rotador. Fundamental para el equilibrio empuje/tirón del hombro y la salud articular a largo plazo.',
    ARRAY['Coloca la polea a la altura de la cara con una cuerda.','Agarra los extremos de la cuerda con los pulgares hacia arriba.','Tira hacia tu cara separando los codos hacia fuera y hacia atrás.','En el punto final, los codos deben estar a la altura de los hombros o por encima.','Vuelve de forma controlada sin dejar que los hombros se cierren hacia delante.'],
    ARRAY['Tirar hacia el cuello en lugar de hacia la cara.','No separar los codos: convierte el ejercicio en un curl de bíceps.','Usar demasiado peso y perder el control de la rotación externa.'],
    ARRAY['Es un ejercicio de prevención y equilibrio, no de ego. El peso no importa.','Inclúyelo siempre que hagas muchas series de empuje en la semana.'],
    ARRAY['Mantén los hombros bajos durante todo el recorrido para no activar el trapecio superior en exceso.'],
    'Hombros', 'Gimnasio', 'Tirón', 1, 2, 'Hipertrofia', 'Baja', 'Baja', 4,
    'isolation', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_face_pull;

  IF ex_face_pull IS NULL THEN
    SELECT id INTO ex_face_pull FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Face pull');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Press de hombro con mancuernas',
    ARRAY['Dumbbell shoulder press', 'Press militar mancuernas', 'Arnold press'],
    'Press vertical de hombros con mancuernas. Trabaja los tres haces del deltoides con mayor rango de movimiento y libertad que el press con barra, además de activar el core para estabilizar el movimiento.',
    ARRAY['Siéntate en un banco con respaldo vertical, mancuernas a la altura del hombro.','Las palmas pueden mirar hacia delante o hacia dentro según preferencia.','Empuja hacia arriba hasta casi extender los codos por encima de la cabeza.','Baja de forma controlada hasta la posición inicial sin dejar caer los codos por debajo del hombro.'],
    ARRAY['Arquear la espalda lumbar al empujar: señal de que el peso es excesivo.','Bajar los codos demasiado: sobrecarga el tendón del bíceps.'],
    ARRAY['Empieza con el press Arnold (rotación de muñeca al subir) para mayor activación del deltoides anterior.','Reduce la carga si el lower back se despega del respaldo.'],
    ARRAY['Con historial de problemas de hombro, usa el press de pie con mancuernas para mayor libertad de movimiento.'],
    'Hombros', 'Gimnasio', 'Empuje', 2, 1, 'Fuerza', 'Media', 'Media', 1,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_press_mc;

  IF ex_press_mc IS NULL THEN
    SELECT id INTO ex_press_mc FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Press de hombro con mancuernas');
  END IF;


  -- ── PREDATOR: Espalda + Bíceps ────────────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Dominadas',
    ARRAY['Pull-ups', 'Chin-ups', 'Dominadas barra'],
    'El ejercicio de tirón vertical más importante de la calistenia. Trabaja el dorsal ancho, bíceps y toda la musculatura de la espalda con la carga del propio peso corporal. Base de cualquier programa de fuerza relativa.',
    ARRAY['Agárrate a la barra con pronación y las manos a la anchura de hombros o algo más separadas.','Cuelga con los brazos extendidos y activa los hombros: no dejes que se suban hacia las orejas.','Tira de los codos hacia abajo y hacia atrás para subir el pecho hacia la barra.','Sube hasta que el mentón supere la barra o el pecho la toque.','Baja de forma controlada hasta la extensión completa.'],
    ARRAY['Usar el impulso y el balanceo del cuerpo para subir.','No llegar a la extensión completa al bajar.','Encorvar el cuello para intentar llegar a la barra.'],
    ARRAY['La supinación (chin-up) activa más bíceps; la pronación más dorsal. Varía entre sesiones.','Cuando dominas 3×10, empieza a lastrar.'],
    ARRAY['Calienta el agarre y los hombros antes de hacer series al fallo.'],
    'Espalda', 'Calistenia', 'Tirón', 1, 1, 'Fuerza', 'Media', 'Media', 1,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_dominadas;

  IF ex_dominadas IS NULL THEN
    SELECT id INTO ex_dominadas FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dominadas');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Remo con mancuerna',
    ARRAY['Dumbbell row', 'One arm row', 'Remo unilateral mancuerna'],
    'Ejercicio de tirón horizontal unilateral con mancuerna apoyando el cuerpo en un banco. Permite cargas elevadas con alta activación del dorsal y los romboides, mientras corriges desequilibrios entre lados.',
    ARRAY['Apoya una rodilla y la mano del mismo lado en el banco, espalda paralela al suelo.','Con la mano libre sujeta la mancuerna con el brazo extendido hacia abajo.','Tira del codo hacia el techo manteniendo el codo pegado al cuerpo.','Lleva la mancuerna a la cadera, no al pecho.','Baja de forma controlada sin dejar que el hombro ruede hacia delante.'],
    ARRAY['Rotar el torso para añadir fuerza: convierte el ejercicio en un swing.','Subir la mancuerna al pecho en vez de a la cadera: activa más bíceps que dorsal.'],
    ARRAY['La retracción escapular al final del movimiento maximiza la contracción del dorsal.','Trabaja las mismas series en cada lado independientemente.'],
    ARRAY['No realices el ejercicio con la espalda rotada: mantén el torso estable en todo momento.'],
    'Espalda', 'Gimnasio', 'Tirón', 1, 1, 'Hipertrofia', 'Alta', 'Media', 2,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_remo_mc;

  IF ex_remo_mc IS NULL THEN
    SELECT id INTO ex_remo_mc FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Remo con mancuerna');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Curl de bíceps con barra',
    ARRAY['Barbell curl', 'Curl barra', 'Curl bíceps barra olímpica'],
    'El ejercicio de bíceps más clásico y eficaz para construir masa en el brazo. La barra permite cargar más peso que las mancuernas, lo que maximiza el estímulo de hipertrofia en el bíceps braquial.',
    ARRAY['De pie con la barra en agarre supino a la anchura de caderas.','Los codos fijos a los lados del cuerpo, sin moverse durante el movimiento.','Curla la barra hacia los hombros contrayendo el bíceps.','Baja de forma controlada y llega a la extensión completa.'],
    ARRAY['Balancear el cuerpo hacia atrás para ayudar a subir la barra.','No llegar a la extensión al bajar: pierde el rango de movimiento más estimulante.','Elevar los codos hacia adelante al subir.'],
    ARRAY['El agarre supino cerrado (manos más juntas) activa más bíceps braquial. El agarre ancho, más coracobraquial.','Alterna semanas de 6-8 y 10-15 reps para cubrir fuerza e hipertrofia.'],
    ARRAY['Si notas dolor en la muñeca, prueba con barra EZ o mancuernas en su lugar.'],
    'Bíceps', 'Gimnasio', 'Tirón', 1, 2, 'Hipertrofia', 'Media', 'Baja', 4,
    'isolation', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_curl_barra;

  IF ex_curl_barra IS NULL THEN
    SELECT id INTO ex_curl_barra FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Curl de bíceps con barra');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Curl de bíceps alternado con mancuernas',
    ARRAY['Alternating dumbbell curl', 'Curl alterno mancuernas', 'Alternating curl'],
    'Variante unilateral del curl de bíceps que trabaja cada brazo de forma independiente, corrigiendo desequilibrios y permitiendo mayor rango de supinación que la barra.',
    ARRAY['De pie con una mancuerna en cada mano, palmas hacia el cuerpo (neutro).','Curla un brazo girando la muñeca hacia afuera (supinación) al subir.','Lleva la mancuerna hasta el nivel del hombro y contrae el bíceps.','Baja de forma controlada y repite con el otro brazo.'],
    ARRAY['No girar la muñeca: pierde la ventaja de este ejercicio sobre la barra.','Balancear el torso para generar impulso.'],
    ARRAY['La supinación al subir maximiza la contracción del bíceps braquial. Hazla deliberadamente.'],
    ARRAY['Mantén los codos fijos a los lados durante todo el movimiento.'],
    'Bíceps', 'Gimnasio', 'Tirón', 1, 2, 'Hipertrofia', 'Baja', 'Baja', 5,
    'isolation', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_curl_mc_alt;

  IF ex_curl_mc_alt IS NULL THEN
    SELECT id INTO ex_curl_mc_alt FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Curl de bíceps alternado con mancuernas');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Extensión de tríceps en polea',
    ARRAY['Triceps pushdown', 'Triceps rope pushdown', 'Empuje polea tríceps'],
    'Ejercicio de aislamiento de tríceps en polea alta. Permite mantener una tensión constante durante todo el recorrido y trabajar los tres haces del tríceps con una carga controlable y progresiva.',
    ARRAY['Coloca una cuerda o barra en la polea alta.','Agarra con los codos cerca del cuerpo a 90°.','Extiende los codos empujando hacia abajo hasta la extensión completa.','Separa los extremos de la cuerda en el punto bajo para aumentar la contracción.','Sube de forma controlada sin dejar que los codos se eleven.'],
    ARRAY['Dejar que los codos salgan hacia adelante o hacia los lados al empujar.','No llegar a la extensión completa para evitar el quemado del tríceps.'],
    ARRAY['La cuerda permite más rango y mejor contracción que la barra recta.','Funciona muy bien en superserie con curl de bíceps.'],
    ARRAY['Usa cargas con las que puedas mantener los codos fijos durante todas las repeticiones.'],
    'Tríceps', 'Gimnasio', 'Empuje', 1, 2, 'Hipertrofia', 'Baja', 'Baja', 5,
    'isolation', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_fondos_tri;

  IF ex_fondos_tri IS NULL THEN
    SELECT id INTO ex_fondos_tri FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Extensión de tríceps en polea');
  END IF;


  -- ── TITAN: Piernas A ──────────────────────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Sentadilla con barra',
    ARRAY['Back squat', 'Squat barra', 'Sentadilla trasera'],
    'El rey de los ejercicios de pierna y uno de los movimientos fundamentales del entrenamiento de fuerza. Trabaja cuádriceps, glúteos, isquiotibiales y erectores espinales de forma simultánea con carga axial.',
    ARRAY['Coloca la barra en el trapecio (high bar) o en los deltoides posteriores (low bar).','Posición de pies a la anchura de los hombros o algo más, pies ligeramente rotados hacia fuera.','Inhala, activa el core, baja controladamente manteniendo el torso erguido.','Las rodillas siguen la dirección de los dedos de los pies durante todo el recorrido.','Desciende hasta el paralelo o por debajo si la movilidad lo permite.','Empuja el suelo para subir de forma explosiva.'],
    ARRAY['Dejar caer las rodillas hacia dentro (valgo) al bajar o al subir.','Inclinar el torso hacia delante en exceso: señal de poca movilidad de tobillo o cadera.','No llegar al paralelo: pierde el rango de activación de glúteos.'],
    ARRAY['El talón elevado mejora la postura en la sentadilla si tienes movilidad de tobillo limitada.','Trabaja la movilidad de cadera y tobillo en el calentamiento.'],
    ARRAY['Con cargas altas, usa siempre jaula o squat rack con topes de seguridad.','El cinturón solo se usa a partir de cargas cercanas al máximo.'],
    'Piernas', 'Gimnasio', 'Sentadilla', 2, 1, 'Fuerza', 'Alta', 'Alta', 1,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_squat;

  IF ex_squat IS NULL THEN
    SELECT id INTO ex_squat FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Sentadilla con barra');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Sentadilla búlgara',
    ARRAY['Bulgarian split squat', 'Rear foot elevated split squat', 'Split squat búlgaro'],
    'Sentadilla unilateral con el pie trasero elevado en un banco. Máxima activación del cuádriceps y glúteo de la pierna delantera, con un alto componente de estabilidad y equilibrio que corrige asimetrías entre piernas.',
    ARRAY['Colócate de espaldas a un banco y apoya el empeine del pie trasero sobre él.','El pie delantero queda a una distancia que, al bajar, la rodilla no supere mucho los dedos del pie.','Baja verticalmente hasta que la rodilla trasera casi toque el suelo.','Mantén el torso erguido y el core activo durante todo el movimiento.','Empuja con el talón delantero para subir.'],
    ARRAY['Inclinarse demasiado hacia delante: activa más la cadera que el cuádriceps.','Colocar el pie delantero demasiado cerca del banco: sobrecarga la rodilla.','Dejar caer la rodilla delantera hacia dentro.'],
    ARRAY['Puedes sujetar mancuernas o usar barra para añadir carga progresivamente.','Es normal que al principio el equilibrio sea el factor limitante. Empieza sin peso.'],
    ARRAY['Si notas molestia en la rodilla trasera, coloca una esterilla debajo.'],
    'Piernas', 'Gimnasio', 'Sentadilla', 2, 1, 'Hipertrofia', 'Media', 'Alta', 2,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_bulgarian;

  IF ex_bulgarian IS NULL THEN
    SELECT id INTO ex_bulgarian FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Sentadilla búlgara');
  END IF;


  -- ── ATLAS: Cadena posterior ───────────────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Hip thrust con barra',
    ARRAY['Hip thrust', 'Barbell hip thrust', 'Puente de glúteos con barra'],
    'El ejercicio de mayor activación electromiográfica del glúteo mayor. Con carga en la cadera, permite trabajar el glúteo en su rango de extensión máxima con cargas progresivas muy elevadas.',
    ARRAY['Apoya la parte alta de la espalda en un banco con la barra sobre las caderas (usa una colchoneta para proteger).','Los pies planos en el suelo a la anchura de caderas, rodillas a 90° al llegar arriba.','Empuja las caderas hacia el techo contrayendo los glúteos al llegar a la extensión completa.','Aguanta 1-2 segundos en el punto alto con los glúteos apretados.','Baja de forma controlada sin que las caderas toquen el suelo.'],
    ARRAY['No llegar a la extensión completa de cadera en el punto alto.','Arquear la zona lumbar en exceso en lugar de usar los glúteos.','Dejar que las rodillas caigan hacia dentro.'],
    ARRAY['La posición de los pies influye: más alejados = más glúteo y menos cuádriceps.','Añade una banda elástica alrededor de las rodillas para activar más el glúteo medio.'],
    ARRAY['Usa siempre una almohadilla o barra en la cadera para proteger las crestas ilíacas.'],
    'Glúteos', 'Gimnasio', 'Bisagra', 2, 1, 'Hipertrofia', 'Alta', 'Media', 1,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_hip_thrust;

  IF ex_hip_thrust IS NULL THEN
    SELECT id INTO ex_hip_thrust FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Hip thrust con barra');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Romanian deadlift',
    ARRAY['RDL', 'Peso muerto rumano', 'Romanian deadlift mancuernas'],
    'Bisagra de cadera con énfasis en el estiramiento excéntrico de los isquiotibiales y glúteos. Es el ejercicio de cadena posterior más efectivo para desarrollar los isquios y mejorar la fuerza de arranque.',
    ARRAY['De pie con la barra o mancuernas a la altura de la cadera, agarre prono.','Mantén las rodillas ligeramente flexionadas y fijas durante todo el movimiento.','Empuja la cadera hacia atrás mientras bajas la carga por delante de las piernas.','Baja hasta sentir el estiramiento profundo de los isquiotibiales.','Extiende la cadera para volver arriba, apretando los glúteos al llegar a la extensión.'],
    ARRAY['Redondear la espalda lumbar: el error más peligroso de este ejercicio.','Doblar las rodillas en exceso: convierte el movimiento en una sentadilla.','No sentir los isquiotibiales: señal de que el rango es insuficiente.'],
    ARRAY['Trabaja frente a un espejo o grábate para verificar la posición de la espalda.','La movilidad de los isquiotibiales limita el rango. Trabájala con estiramiento.'],
    ARRAY['Si la carga es alta, usa cinturón. Con lumbar ya lesionada, consulta antes.'],
    'Piernas', 'Gimnasio', 'Bisagra', 2, 1, 'Fuerza', 'Alta', 'Alta', 2,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_rdl;

  IF ex_rdl IS NULL THEN
    SELECT id INTO ex_rdl FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Romanian deadlift');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Patada de glúteo en polea',
    ARRAY['Glute kickback', 'Cable glute kickback', 'Extensión de cadera en polea'],
    'Extensión de cadera unilateral en polea baja con tobillera. Aisla el glúteo mayor en toda su extensión y permite cargas progresivas. Uno de los pocos ejercicios que trabaja el glúteo en la posición de máximo acortamiento.',
    ARRAY['Ata la tobillera a la polea baja y apoya las manos en la estructura del aparato.','Con la pierna de trabajo ligeramente flexionada, extiende la cadera hacia atrás y hacia arriba.','Lleva el talón hasta donde lo permita la extensión de cadera completa.','Contrae el glúteo en el punto alto y aguanta 1 segundo.','Vuelve de forma controlada sin que el pie toque el suelo hasta completar la serie.'],
    ARRAY['Usar la zona lumbar para elevar la pierna en lugar del glúteo.','Levantar demasiado la pierna y usar los erectores como compensación.'],
    ARRAY['El rango de movimiento importa más que el peso. Con demasiada carga la forma se rompe.'],
    ARRAY['Mantén la espalda neutral durante todo el ejercicio.'],
    'Glúteos', 'Gimnasio', 'Bisagra', 1, 3, 'Hipertrofia', 'Baja', 'Baja', 4,
    'isolation', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_glute_kickback;

  IF ex_glute_kickback IS NULL THEN
    SELECT id INTO ex_glute_kickback FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Patada de glúteo en polea');
  END IF;


  -- ── CORE CONTROL ──────────────────────────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Hollow body hold',
    ARRAY['Hollow body', 'Posición cóncava', 'Hollow hold'],
    'Posición isométrica fundamental de la calistenia: el cuerpo forma una curva cóncava con las costillas hundidas, lumbar pegada al suelo y extremidades extendidas. Es la base de toda la compresión y tensión del core para habilidades como el front lever o el planche.',
    ARRAY['Túmbate boca arriba con los brazos extendidos sobre la cabeza.','Aprieta las costillas hacia abajo y pega la zona lumbar al suelo.','Eleva las piernas a unos 15-20 cm del suelo (o más si es lo que aguantas con buena forma).','Eleva también los hombros ligeramente del suelo.','Aguanta la posición respirando de forma controlada.'],
    ARRAY['Dejar que la zona lumbar se arquee y se separe del suelo: el ejercicio pierde su sentido.','Aguantar la respiración durante todo el hold.'],
    ARRAY['Progresión: rodillas dobladas → piernas a 45° → piernas a 20° → hollow body con movimiento de brazos.','10-20 segundos con buena forma son más efectivos que 60 segundos con mala técnica.'],
    ARRAY['Si notas tensión en el cuello, apoya la cabeza ligeramente en el suelo.'],
    'Core', 'Calistenia', 'Core', 2, 2, 'Isométrico', 'Baja', 'Baja', 1,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_hollow_body;

  IF ex_hollow_body IS NULL THEN
    SELECT id INTO ex_hollow_body FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Hollow body hold');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'L-sit en paralelas',
    ARRAY['L-sit', 'L-sit parallettes', 'L-hold'],
    'Posición isométrica de compresión: cuerpo recto, piernas elevadas formando 90° en las paralelas o en el suelo. Trabaja la compresión del core, el tríceps como estabilizador y los flexores de cadera con alta intensidad.',
    ARRAY['Colócate entre las paralelas con los brazos extendidos y el cuerpo en suspensión.','Activa el core y eleva las piernas hasta la posición horizontal (90° con el torso).','Mantén las piernas rectas y juntas, dedos de los pies en punta.','Empuja hacia abajo con las manos para elevar los hombros y crear separación con el suelo.','Aguanta el tiempo objetivo sin perder la posición.'],
    ARRAY['Doblar las rodillas para aguantar más tiempo.','No empujar hacia abajo con los brazos: el cuerpo queda muy bajo.','Perder la extensión lumbar y curvar la espalda.'],
    ARRAY['Progresión: L-sit con rodillas → L-sit con una pierna extendida → L-sit completo.','Trabajar en paralelas es más fácil que en el suelo por el mayor rango de movimiento.'],
    ARRAY['Si notas dolor en las muñecas, entrena en paralelas antes de pasar al suelo.'],
    'Core', 'Calistenia', 'Core', 3, 2, 'Isométrico', 'Baja', 'Media', 2,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_l_sit;

  IF ex_l_sit IS NULL THEN
    SELECT id INTO ex_l_sit FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('L-sit en paralelas');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Ab wheel',
    ARRAY['Rueda abdominal', 'Wheel rollout', 'Ab rollout'],
    'Rodamiento con la rueda abdominal desde la posición de rodillas. Uno de los ejercicios de core de mayor activación del recto abdominal, además de trabajar los dorsales y los hombros como estabilizadores de la posición extendida.',
    ARRAY['Arrodíllate con la rueda frente a ti en el suelo.','Con el core activo y la espalda neutral, rueda hacia adelante extendiendo los brazos.','Llega hasta donde puedas sin que la zona lumbar se arquee.','Contrae el core para volver a la posición inicial.','Mantén la tensión durante todo el recorrido.'],
    ARRAY['Arquear la zona lumbar al extenderse: riesgo real de lesión.','Usar la inercia para volver en vez de fuerza del core.','Extenderse más de lo que la fuerza actual permite.'],
    ARRAY['Empieza con un rango corto y aumenta progresivamente.','El rollout de pie es una progresión avanzada solo para quien domina el de rodillas.'],
    ARRAY['Este ejercicio está contraindicado con dolor lumbar activo. Consulta antes si es tu caso.'],
    'Core', 'Calistenia', 'Core', 2, 2, 'Fuerza', 'Media', 'Media', 3,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_ab_wheel;

  IF ex_ab_wheel IS NULL THEN
    SELECT id INTO ex_ab_wheel FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Ab wheel');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Dragon flag',
    ARRAY['Dragon flag Bruce Lee', 'Bandera del dragón'],
    'Ejercicio avanzado de core popularizado por Bruce Lee. El cuerpo recto y rígido se eleva y desciende usando solo la zona lumbar apoyada en un banco. Máxima activación del recto abdominal con control total del core.',
    ARRAY['Tímbate en un banco y agarra los extremos detrás de la cabeza.','Eleva las piernas y la cadera formando una línea recta con el cuerpo.','Baja de forma controlada manteniendo el cuerpo completamente recto.','No dejes que la zona lumbar toque el banco antes de llegar al final.','Sube de nuevo con fuerza abdominal.'],
    ARRAY['Doblar las caderas para facilitar el movimiento.','Bajar sin control dejando caer el cuerpo.','Intentar este ejercicio sin tener una base sólida de ab wheel y L-sit.'],
    ARRAY['La fase negativa (bajada) es donde se construye la fuerza. Enfócate en ella.','Progresión: tucked → straddle → full.'],
    ARRAY['No realices este ejercicio con dolor lumbar activo. La demanda sobre la columna es muy alta.'],
    'Core', 'Calistenia', 'Core', 3, 2, 'Fuerza', 'Media', 'Alta', 4,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_dragon_flag;

  IF ex_dragon_flag IS NULL THEN
    SELECT id INTO ex_dragon_flag FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dragon flag');
  END IF;


  -- ── WAR MODE: Agarre + cardio ─────────────────────────────────────────────

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Farmer''s walk',
    ARRAY['Farmers carry', 'Paseo del granjero', 'Loaded carry'],
    'Caminar con mancuernas o kettlebells pesadas durante una distancia o tiempo determinados. Desarrolla la fuerza del agarre, el core lateral, los trapecios y la capacidad cardiovascular de forma simultánea. Fundamental para la Spartan Race.',
    ARRAY['Coge las mancuernas o kettlebells, una en cada mano.','De pie, espalda recta, hombros hacia atrás y abajo, core activo.','Camina con pasos cortos y controlados a un ritmo constante.','Mantén la mirada al frente y la posición sin perder la tensión en ningún momento.','Al terminar, deja las cargas en el suelo con control.'],
    ARRAY['Dejar que los hombros suban hacia las orejas durante el ejercicio.','Inclinar el torso hacia los lados: señal de que el peso es excesivo.','Pasos demasiado largos que desestabilizan el tronco.'],
    ARRAY['Aumenta el peso cuando puedas completar la distancia/tiempo sin que la postura se rompa.','También puedes hacerlo unilateral (suitcase carry) para mayor demanda lateral del core.'],
    ARRAY['Si el agarre falla antes que cualquier otro factor, ese es el limitante a trabajar primero.'],
    'Cuerpo completo', 'Gimnasio', 'Core', 2, 2, 'Fuerza', 'Alta', 'Media', 1,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_farmers_walk;

  IF ex_farmers_walk IS NULL THEN
    SELECT id INTO ex_farmers_walk FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Farmer''s walk');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Sprints',
    ARRAY['Sprint intervals', 'Carreras cortas', 'Sprint training'],
    'Esfuerzos de carrera máxima durante 10-30 segundos con recuperación activa entre series. Desarrollan la potencia del tren inferior, la capacidad anaeróbica y la velocidad de reacción. Clave en la preparación para la Spartan Race.',
    ARRAY['Calienta con 5-10 minutos de trote ligero y activación dinámica.','Marca la distancia o el tiempo del sprint (20-40 metros o 10-20 segundos).','Sale en aceleración máxima desde una posición baja con el torso inclinado.','Mantén la cadencia alta y los brazos activos durante el sprint.','Recupera trotando o caminando hasta que la frecuencia cardíaca baje a 120-130 bpm.','Repite 6-10 series según el nivel y el objetivo del día.'],
    ARRAY['Salir a máxima velocidad sin calentamiento previo.','No recuperar lo suficiente entre series: el sprint deja de ser sprint.'],
    ARRAY['Los sprints en cuesta son más seguros para las articulaciones y añaden más demanda muscular.','Empieza con 60-70% de velocidad máxima si vuelves al sprint después de un descanso.'],
    ARRAY['Calienta siempre adecuadamente. Los isquiotibiales fríos son el punto más vulnerable.'],
    'Cardio', 'Funcional', 'Sentadilla', 2, 3, 'Resistencia', 'Alta', 'Alta', 2,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_sprint;

  IF ex_sprint IS NULL THEN
    SELECT id INTO ex_sprint FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Sprints');
  END IF;

  INSERT INTO public.exercises (name, alt_names, description, instructions, common_mistakes, tips, safety_notes,
    muscle_group, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level,
    recommended_order, mechanic, status, source, is_stable, is_progressable, high_tension)
  VALUES (
    'Salto a la comba',
    ARRAY['Jump rope', 'Comba', 'Skipping', 'Cuerda de saltar'],
    'Saltar a la comba de forma continua. Mejora la coordinación, el ritmo, la agilidad de pies y la resistencia cardiovascular aeróbica-anaeróbica. Imprescindible en la preparación para pruebas de obstáculos.',
    ARRAY['Sostén los mangos de la comba con ambas manos a la altura de las caderas.','Salta con ambos pies juntos o en alternancia, solo levantando los talones del suelo.','Mantén los codos cerca del cuerpo y mueve la comba con las muñecas, no con los brazos.','Aterriza de puntillas, nunca con el talón plano.','Empieza por bloques de 30-60 segundos y descansa 30 segundos.'],
    ARRAY['Saltar demasiado alto: cansa más sin añadir beneficio.','Usar los brazos para girar la comba en vez de las muñecas.','Aterrizar con el talón: impacto innecesario en las articulaciones.'],
    ARRAY['Double unders (doble vuelta por salto) son la progresión avanzada para mayor intensidad.','Varía entre ritmo constante y sprints de comba para entrenar distintas vías energéticas.'],
    ARRAY['Con lesiones de tobillo, empieza solo con salto continuo antes de probar doble vuelta.'],
    'Cardio', 'Funcional', 'Core', 1, 3, 'Resistencia', 'Baja', 'Media', 3,
    'compound', 'published', 'autopilot', true, true, true
  ) ON CONFLICT DO NOTHING RETURNING id INTO ex_salto_cuerda;

  IF ex_salto_cuerda IS NULL THEN
    SELECT id INTO ex_salto_cuerda FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Salto a la comba');
  END IF;


  -- ── Relaciones músculo/equipo/categoría ──────────────────────────────────
  -- Solo se insertan si el ejercicio existe (ON CONFLICT DO NOTHING previene duplicados).

  -- Front lever negativa
  IF ex_front_lever_neg IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_neg, m_dorsal, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_neg, m_recto_abd, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_neg, m_biceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_neg, m_braquial, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_front_lever_neg, eq_barra_dom) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_front_lever_neg, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Front lever isométrico
  IF ex_front_lever_hold IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_hold, m_dorsal, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_hold, m_recto_abd, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_hold, m_biceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_hold, m_oblicuos, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_front_lever_hold, eq_barra_dom) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_front_lever_hold, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Front lever row
  IF ex_front_lever_row IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_row, m_dorsal, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_row, m_recto_abd, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_front_lever_row, m_biceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_front_lever_row, eq_barra_dom) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_front_lever_row, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Dead hang a una mano
  IF ex_dead_hang IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_dead_hang, m_antebrazo, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dead_hang, m_dorsal, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dead_hang, m_trapecio, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_dead_hang, eq_barra_dom) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_dead_hang, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Dominada a una mano negativa
  IF ex_one_arm_neg IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_neg, m_dorsal, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_neg, m_biceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_neg, m_antebrazo, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_neg, m_recto_abd, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_one_arm_neg, eq_barra_dom) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_one_arm_neg, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Dominada a una mano
  IF ex_one_arm_dom IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_dom, m_dorsal, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_dom, m_biceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_dom, m_antebrazo, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_one_arm_dom, m_recto_abd, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_one_arm_dom, eq_barra_dom) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_one_arm_dom, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Press inclinado
  IF ex_press_inc_mc IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_press_inc_mc, m_pectoral, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_press_inc_mc, m_delt_ant, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_press_inc_mc, m_triceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_press_inc_mc, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_press_inc_mc, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Apertura inclinada
  IF ex_apert_inc IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_apert_inc, m_pectoral, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_apert_inc, m_serrato, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_apert_inc, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_apert_inc, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Fondos en paralelas
  IF ex_dips IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_dips, m_pectoral, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dips, m_triceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dips, m_delt_ant, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_dips, eq_paralelas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_dips, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Elevación lateral
  IF ex_elevac_lat IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_elevac_lat, m_delt_lat, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_elevac_lat, m_trapecio, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_elevac_lat, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_elevac_lat, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Face pull
  IF ex_face_pull IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_face_pull, m_delt_post, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_face_pull, m_romboides, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_face_pull, m_trapecio, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_face_pull, eq_poleas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_face_pull, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Press de hombro
  IF ex_press_mc IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_press_mc, m_delt_ant, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_press_mc, m_delt_lat, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_press_mc, m_triceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_press_mc, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_press_mc, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Dominadas
  IF ex_dominadas IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_dominadas, m_dorsal, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dominadas, m_biceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dominadas, m_trapecio, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_dominadas, eq_barra_dom) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_dominadas, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Remo con mancuerna
  IF ex_remo_mc IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_remo_mc, m_dorsal, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_remo_mc, m_romboides, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_remo_mc, m_biceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_remo_mc, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_remo_mc, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Curl barra
  IF ex_curl_barra IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_curl_barra, m_biceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_curl_barra, m_braquial, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_curl_barra, eq_barra) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_curl_barra, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Curl alterno
  IF ex_curl_mc_alt IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_curl_mc_alt, m_biceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_curl_mc_alt, m_braquial, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_curl_mc_alt, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_curl_mc_alt, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Extensión tríceps polea
  IF ex_fondos_tri IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_fondos_tri, m_triceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_fondos_tri, eq_poleas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_fondos_tri, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Sentadilla con barra
  IF ex_squat IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_squat, m_cuadriceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_squat, m_gluteo_mayor, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_squat, m_isquios, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_squat, m_erectores, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_squat, eq_barra) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_squat, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Sentadilla búlgara
  IF ex_bulgarian IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_bulgarian, m_cuadriceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_bulgarian, m_gluteo_mayor, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_bulgarian, m_isquios, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_bulgarian, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_bulgarian, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Hip thrust
  IF ex_hip_thrust IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_hip_thrust, m_gluteo_mayor, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_hip_thrust, m_gluteo_medio, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_hip_thrust, m_isquios, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_hip_thrust, eq_barra) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_hip_thrust, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- RDL
  IF ex_rdl IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_rdl, m_isquios, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_rdl, m_gluteo_mayor, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_rdl, m_erectores, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_rdl, eq_barra) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_rdl, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Patada de glúteo en polea
  IF ex_glute_kickback IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_glute_kickback, m_gluteo_mayor, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_glute_kickback, m_isquios, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_glute_kickback, eq_poleas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_glute_kickback, cat_gym) ON CONFLICT DO NOTHING;
  END IF;

  -- Hollow body
  IF ex_hollow_body IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_hollow_body, m_recto_abd, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_hollow_body, m_oblicuos, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_hollow_body, m_flex_cadera, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_hollow_body, eq_bw) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_hollow_body, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- L-sit
  IF ex_l_sit IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_l_sit, m_recto_abd, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_l_sit, m_flex_cadera, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_l_sit, m_triceps, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_l_sit, eq_paralelas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_l_sit, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Ab wheel
  IF ex_ab_wheel IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_ab_wheel, m_recto_abd, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_ab_wheel, m_dorsal, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_ab_wheel, m_oblicuos, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_ab_wheel, eq_bw) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_ab_wheel, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Dragon flag
  IF ex_dragon_flag IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_dragon_flag, m_recto_abd, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dragon_flag, m_oblicuos, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_dragon_flag, m_flex_cadera, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_dragon_flag, eq_bw) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_dragon_flag, cat_cal) ON CONFLICT DO NOTHING;
  END IF;

  -- Farmer's walk
  IF ex_farmers_walk IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_farmers_walk, m_antebrazo, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_farmers_walk, m_trapecio, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_farmers_walk, m_recto_abd, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_farmers_walk, eq_mancuernas) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_farmers_walk, cat_func) ON CONFLICT DO NOTHING;
  END IF;

  -- Sprints
  IF ex_sprint IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_sprint, m_cuadriceps, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_sprint, m_isquios, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_sprint, m_gluteo_mayor, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_sprint, m_gemelos, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_sprint, eq_bw) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_sprint, cat_func) ON CONFLICT DO NOTHING;
  END IF;

  -- Salto a la comba
  IF ex_salto_cuerda IS NOT NULL THEN
    INSERT INTO public.exercise_muscles VALUES (ex_salto_cuerda, m_gemelos, 'primary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_muscles VALUES (ex_salto_cuerda, m_soleo, 'secondary') ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_equipment VALUES (ex_salto_cuerda, eq_bw) ON CONFLICT DO NOTHING;
    INSERT INTO public.exercise_categories VALUES (ex_salto_cuerda, cat_func) ON CONFLICT DO NOTHING;
  END IF;

END $$;


-- ─── FASE 2: Rutina semanal THE 0.1% PROTOCOL ────────────────────────────────
-- Se asigna directamente a nicolassanmarcos4@gmail.com usando el user_id de profiles.
-- Si el usuario no existe en la base de datos de producción, el bloque DO termina
-- sin error (se aplica la rutina cuando el usuario exista gracias a la guarda IS NULL).

DO $$
DECLARE
  _user_id  uuid;
  _plan     jsonb;

  -- IDs de ejercicios (resueltos por nombre normalizado)
  id_squat          uuid;
  id_bulgarian      uuid;
  id_hip_thrust     uuid;
  id_rdl            uuid;
  id_glute_kickback uuid;
  id_hollow_body    uuid;
  id_l_sit          uuid;
  id_ab_wheel       uuid;
  id_dragon_flag    uuid;
  id_press_inc_mc   uuid;
  id_apert_inc      uuid;
  id_dips           uuid;
  id_elevac_lat     uuid;
  id_face_pull      uuid;
  id_press_mc       uuid;
  id_fl_neg         uuid;
  id_fl_hold        uuid;
  id_fl_row         uuid;
  id_dominadas      uuid;
  id_remo_mc        uuid;
  id_dead_hang      uuid;
  id_one_arm_neg    uuid;
  id_curl_barra     uuid;
  id_curl_mc_alt    uuid;
  id_fondos_tri     uuid;
  id_farmers_walk   uuid;
  id_sprint         uuid;
  id_salto_cuerda   uuid;
BEGIN

  -- ── Resolver user_id ──
  SELECT user_id INTO _user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim('nicolassanmarcos4@gmail.com'))
  LIMIT 1;

  IF _user_id IS NULL THEN
    RAISE NOTICE 'Usuario nicolassanmarcos4@gmail.com no encontrado. La rutina se aplicará cuando se registre.';
    RETURN;
  END IF;

  -- ── Resolver IDs de ejercicios ──
  SELECT id INTO id_squat          FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Sentadilla con barra') LIMIT 1;
  SELECT id INTO id_bulgarian      FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Sentadilla búlgara') LIMIT 1;
  SELECT id INTO id_hip_thrust     FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Hip thrust con barra') LIMIT 1;
  SELECT id INTO id_rdl            FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Romanian deadlift') LIMIT 1;
  SELECT id INTO id_glute_kickback FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Patada de glúteo en polea') LIMIT 1;
  SELECT id INTO id_hollow_body    FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Hollow body hold') LIMIT 1;
  SELECT id INTO id_l_sit          FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('L-sit en paralelas') LIMIT 1;
  SELECT id INTO id_ab_wheel       FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Ab wheel') LIMIT 1;
  SELECT id INTO id_dragon_flag    FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dragon flag') LIMIT 1;
  SELECT id INTO id_press_inc_mc   FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Press inclinado con mancuernas') LIMIT 1;
  SELECT id INTO id_apert_inc      FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Apertura inclinada con mancuernas') LIMIT 1;
  SELECT id INTO id_dips           FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Fondos en paralelas') LIMIT 1;
  SELECT id INTO id_elevac_lat     FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Elevación lateral con mancuernas') LIMIT 1;
  SELECT id INTO id_face_pull      FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Face pull') LIMIT 1;
  SELECT id INTO id_press_mc       FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Press de hombro con mancuernas') LIMIT 1;
  SELECT id INTO id_fl_neg         FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Front lever negativa') LIMIT 1;
  SELECT id INTO id_fl_hold        FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Front lever isométrico') LIMIT 1;
  SELECT id INTO id_fl_row         FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Front lever row') LIMIT 1;
  SELECT id INTO id_dominadas      FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dominadas') LIMIT 1;
  SELECT id INTO id_remo_mc        FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Remo con mancuerna') LIMIT 1;
  SELECT id INTO id_dead_hang      FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dead hang a una mano') LIMIT 1;
  SELECT id INTO id_one_arm_neg    FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Dominada a una mano negativa') LIMIT 1;
  SELECT id INTO id_curl_barra     FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Curl de bíceps con barra') LIMIT 1;
  SELECT id INTO id_curl_mc_alt    FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Curl de bíceps alternado con mancuernas') LIMIT 1;
  SELECT id INTO id_fondos_tri     FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Extensión de tríceps en polea') LIMIT 1;
  SELECT id INTO id_farmers_walk   FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Farmer''s walk') LIMIT 1;
  SELECT id INTO id_sprint         FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Sprints') LIMIT 1;
  SELECT id INTO id_salto_cuerda   FROM public.exercises WHERE public.exercise_name_key(name) = public.exercise_name_key('Salto a la comba') LIMIT 1;


  -- ── Construir workouts_json ──
  _plan := jsonb_build_array(

    -- LUNES — TITAN: Lower Body Strength (Piernas A + Core)
    jsonb_build_object(
      'day', 'Lunes',
      'type', 'gimnasio',
      'routine_name', 'TITAN — Lower Body Strength',
      'muscle_focus', 'Cuádriceps · Glúteos · Core',
      'custom', true,
      'session_icon', '🏛️',
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', id_squat,      'name', 'Sentadilla con barra',     'series', 4, 'reps', 5,  'weight', '', 'rest', '180s', 'muscle_group', 'Piernas',  'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_bulgarian,  'name', 'Sentadilla búlgara',        'series', 3, 'reps', 8,  'weight', '', 'rest', '120s', 'muscle_group', 'Piernas',  'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_hip_thrust, 'name', 'Hip thrust con barra',      'series', 4, 'reps', 10, 'weight', '', 'rest', '90s',  'muscle_group', 'Glúteos',  'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_hollow_body,'name', 'Hollow body hold',           'series', 3, 'reps', 30, 'weight', '', 'rest', '60s',  'muscle_group', 'Core',     'exercise_type', 'Calistenia', 'tracking_mode', 'seconds_only'),
        jsonb_build_object('exercise_id', id_ab_wheel,   'name', 'Ab wheel',                   'series', 3, 'reps', 8,  'weight', '', 'rest', '60s',  'muscle_group', 'Core',     'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps')
      )
    ),

    -- MARTES — FORGE: Upper Body Sculpt (Pecho superior + Hombro lateral)
    jsonb_build_object(
      'day', 'Martes',
      'type', 'gimnasio',
      'routine_name', 'FORGE — Upper Body Sculpt',
      'muscle_focus', 'Pecho superior · Hombro lateral · Tríceps',
      'custom', true,
      'session_icon', '🔥',
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', id_press_inc_mc, 'name', 'Press inclinado con mancuernas',   'series', 4, 'reps', 8,  'weight', '', 'rest', '120s', 'muscle_group', 'Pecho',    'exercise_type', 'Gimnasio', 'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_dips,         'name', 'Fondos en paralelas',               'series', 3, 'reps', 10, 'weight', '', 'rest', '90s',  'muscle_group', 'Pecho',    'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps'),
        jsonb_build_object('exercise_id', id_apert_inc,    'name', 'Apertura inclinada con mancuernas', 'series', 3, 'reps', 12, 'weight', '', 'rest', '60s',  'muscle_group', 'Pecho',    'exercise_type', 'Gimnasio', 'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_press_mc,     'name', 'Press de hombro con mancuernas',    'series', 3, 'reps', 10, 'weight', '', 'rest', '90s',  'muscle_group', 'Hombros',  'exercise_type', 'Gimnasio', 'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_elevac_lat,   'name', 'Elevación lateral con mancuernas',  'series', 4, 'reps', 15, 'weight', '', 'rest', '60s',  'muscle_group', 'Hombros',  'exercise_type', 'Gimnasio', 'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_face_pull,    'name', 'Face pull',                         'series', 3, 'reps', 15, 'weight', '', 'rest', '45s',  'muscle_group', 'Hombros',  'exercise_type', 'Gimnasio', 'tracking_mode', 'weighted_reps')
      )
    ),

    -- MIÉRCOLES — PREDATOR: Unilateral Strength (Dominada una mano + Espalda + Brazos)
    jsonb_build_object(
      'day', 'Miércoles',
      'type', 'gimnasio',
      'routine_name', 'PREDATOR — Unilateral Strength',
      'muscle_focus', 'Espalda · Bíceps · Tríceps · Agarre',
      'custom', true,
      'session_icon', '🦅',
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', id_dead_hang,   'name', 'Dead hang a una mano',          'series', 4, 'reps', 20, 'weight', '', 'rest', '120s', 'muscle_group', 'Espalda', 'exercise_type', 'Calistenia', 'tracking_mode', 'seconds_only'),
        jsonb_build_object('exercise_id', id_one_arm_neg, 'name', 'Dominada a una mano negativa',  'series', 4, 'reps', 3,  'weight', '', 'rest', '180s', 'muscle_group', 'Espalda', 'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps'),
        jsonb_build_object('exercise_id', id_dominadas,   'name', 'Dominadas',                      'series', 3, 'reps', 8,  'weight', '', 'rest', '120s', 'muscle_group', 'Espalda', 'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps'),
        jsonb_build_object('exercise_id', id_remo_mc,     'name', 'Remo con mancuerna',             'series', 3, 'reps', 10, 'weight', '', 'rest', '90s',  'muscle_group', 'Espalda', 'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_curl_barra,  'name', 'Curl de bíceps con barra',       'series', 3, 'reps', 8,  'weight', '', 'rest', '60s',  'muscle_group', 'Bíceps',  'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_fondos_tri,  'name', 'Extensión de tríceps en polea',  'series', 3, 'reps', 12, 'weight', '', 'rest', '60s',  'muscle_group', 'Tríceps', 'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps')
      )
    ),

    -- JUEVES — ATLAS: Posterior Chain (Piernas B + Core)
    jsonb_build_object(
      'day', 'Jueves',
      'type', 'gimnasio',
      'routine_name', 'ATLAS — Posterior Chain',
      'muscle_focus', 'Isquiotibiales · Glúteos · Core',
      'custom', true,
      'session_icon', '🌍',
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', id_rdl,            'name', 'Romanian deadlift',           'series', 4, 'reps', 6,  'weight', '', 'rest', '180s', 'muscle_group', 'Piernas', 'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_hip_thrust,     'name', 'Hip thrust con barra',         'series', 3, 'reps', 12, 'weight', '', 'rest', '90s',  'muscle_group', 'Glúteos', 'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_glute_kickback, 'name', 'Patada de glúteo en polea',    'series', 3, 'reps', 15, 'weight', '', 'rest', '60s',  'muscle_group', 'Glúteos', 'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_l_sit,          'name', 'L-sit en paralelas',           'series', 3, 'reps', 15, 'weight', '', 'rest', '60s',  'muscle_group', 'Core',    'exercise_type', 'Calistenia', 'tracking_mode', 'seconds_only'),
        jsonb_build_object('exercise_id', id_dragon_flag,    'name', 'Dragon flag',                  'series', 3, 'reps', 5,  'weight', '', 'rest', '90s',  'muscle_group', 'Core',    'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps')
      )
    ),

    -- VIERNES — RESET: Recuperación y movilidad
    jsonb_build_object(
      'day', 'Viernes',
      'type', 'actividad',
      'sport', 'Movilidad y recuperación',
      'intensity', 'Baja',
      'duration', '30-45min',
      'custom', true,
      'session_icon', '🔄'
    ),

    -- SÁBADO — OVERDRIVE: Performance Day (Front lever + Calistenia + Hombro + Agarre + Carrera)
    jsonb_build_object(
      'day', 'Sábado',
      'type', 'gimnasio',
      'routine_name', 'OVERDRIVE — Performance Day',
      'muscle_focus', 'Front lever · Habilidades · Agarre · Cardio',
      'custom', true,
      'session_icon', '⚡',
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', id_fl_neg,       'name', 'Front lever negativa',          'series', 4, 'reps', 5,  'weight', '', 'rest', '180s', 'muscle_group', 'Espalda', 'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps'),
        jsonb_build_object('exercise_id', id_fl_hold,      'name', 'Front lever isométrico',         'series', 4, 'reps', 8,  'weight', '', 'rest', '180s', 'muscle_group', 'Espalda', 'exercise_type', 'Calistenia', 'tracking_mode', 'seconds_only'),
        jsonb_build_object('exercise_id', id_fl_row,       'name', 'Front lever row',                 'series', 3, 'reps', 4,  'weight', '', 'rest', '180s', 'muscle_group', 'Espalda', 'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps'),
        jsonb_build_object('exercise_id', id_dominadas,    'name', 'Dominadas',                       'series', 3, 'reps', 6,  'weight', '', 'rest', '120s', 'muscle_group', 'Espalda', 'exercise_type', 'Calistenia', 'tracking_mode', 'bodyweight_reps'),
        jsonb_build_object('exercise_id', id_elevac_lat,   'name', 'Elevación lateral con mancuernas','series', 3, 'reps', 15, 'weight', '', 'rest', '60s',  'muscle_group', 'Hombros', 'exercise_type', 'Gimnasio',   'tracking_mode', 'weighted_reps'),
        jsonb_build_object('exercise_id', id_farmers_walk, 'name', 'Farmer''s walk',                 'series', 4, 'reps', 40, 'weight', '', 'rest', '90s',  'muscle_group', 'Cuerpo completo', 'exercise_type', 'Funcional', 'tracking_mode', 'seconds_only'),
        jsonb_build_object('exercise_id', id_sprint,       'name', 'Sprints',                         'series', 8, 'reps', 15, 'weight', '', 'rest', '60s',  'muscle_group', 'Cardio',  'exercise_type', 'Funcional',  'tracking_mode', 'seconds_only'),
        jsonb_build_object('exercise_id', id_salto_cuerda, 'name', 'Salto a la comba',               'series', 4, 'reps', 60, 'weight', '', 'rest', '45s',  'muscle_group', 'Cardio',  'exercise_type', 'Funcional',  'tracking_mode', 'seconds_only')
      )
    ),

    -- DOMINGO — RECHARGE: Descanso completo
    jsonb_build_object(
      'day', 'Domingo',
      'type', 'actividad',
      'sport', 'Descanso completo',
      'intensity', 'Baja',
      'duration', '—',
      'custom', true,
      'session_icon', '😴'
    )

  );

  -- ── Upsert del plan ──
  INSERT INTO public.training_plan (user_id, workouts_json)
  VALUES (_user_id, _plan)
  ON CONFLICT (user_id) DO UPDATE
    SET workouts_json = EXCLUDED.workouts_json;

  -- ── Marcar plan como listo ──
  UPDATE public.profiles
  SET plan_status = 'plan_ready'
  WHERE user_id = _user_id;

  RAISE NOTICE 'THE 0.1%% PROTOCOL asignado correctamente a %', 'nicolassanmarcos4@gmail.com';

END $$;
