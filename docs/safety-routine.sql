-- Rutina "Safety" (6 días de entreno + descansos) para nicolassanmarcos4@gmail.com
-- Ejecutar en el SQL Editor de Supabase (proyecto Autopilot).

-- 1) Obtener el user_id
DO $$
DECLARE
  v_user_id uuid;
  v_routine_id uuid := gen_random_uuid();
  v_workouts jsonb;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nicolassanmarcos4@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- 2) Leer el plan actual (si existe)
  SELECT workouts_json INTO v_workouts FROM public.training_plan WHERE user_id = v_user_id;

  -- 3) Construir el nuevo plan: Safety en L, M, X, J, S + descansos en V y D.
  --    Si ya había sesiones en esos días, se sobrescriben (ajusta si no quieres).
  v_workouts := jsonb_build_array(
    jsonb_build_object('day','Lunes','type','gimnasio','routine_name','Safety','muscle_focus','Pecho, hombro lateral y tríceps','custom',true,'routine_id',v_routine_id,'exercises',jsonb_build_array(
      jsonb_build_object('exercise_id','press-inclinado-mancuernas','name','Press inclinado con mancuernas','series',3,'reps','6-10','weight','0','rest','90s','muscle_group','Pecho'),
      jsonb_build_object('exercise_id','press-horizontal-mancuernas','name','Press horizontal con mancuernas','series',3,'reps','8-12','weight','0','rest','90s','muscle_group','Pecho'),
      jsonb_build_object('exercise_id','aperturas-polea','name','Aperturas en polea','series',2,'reps','12-15','weight','0','rest','90s','muscle_group','Pecho'),
      jsonb_build_object('exercise_id','elevacion-lateral-polea','name','Elevación lateral en polea','series',3,'reps','12-20','weight','0','rest','90s','muscle_group','Hombros'),
      jsonb_build_object('exercise_id','elevacion-lateral-mancuernas','name','Elevación lateral con mancuernas','series',2,'reps','12-20','weight','0','rest','60s','muscle_group','Hombros'),
      jsonb_build_object('exercise_id','extension-triceps-cuerda','name','Extensión de tríceps con cuerda','series',2,'reps','10-15','weight','0','rest','90s','muscle_group','Tríceps')
    )),
    jsonb_build_object('day','Martes','type','gimnasio','routine_name','Safety','muscle_focus','Piernas A + abdomen','custom',true,'routine_id',v_routine_id,'exercises',jsonb_build_array(
      jsonb_build_object('exercise_id','hack-squat','name','Hack squat','series',3,'reps','6-10','weight','0','rest','120s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','prensa','name','Prensa','series',2,'reps','10-15','weight','0','rest','120s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','extension-cuadriceps','name','Extensión de cuádriceps','series',2,'reps','12-15','weight','0','rest','90s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','curl-femoral-sentado','name','Curl femoral sentado','series',3,'reps','10-15','weight','0','rest','90s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','gemelos','name','Gemelos','series',3,'reps','12-20','weight','0','rest','90s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','crunch-polea','name','Crunch en polea','series',3,'reps','10-15','weight','0','rest','90s','muscle_group','Core'),
      jsonb_build_object('exercise_id','elevaciones-piernas','name','Elevaciones de piernas','series',2,'reps','10-15','weight','0','rest','90s','muscle_group','Core')
    )),
    jsonb_build_object('day','Miércoles','type','gimnasio','routine_name','Safety','muscle_focus','Espalda, hombro posterior y bíceps','custom',true,'routine_id',v_routine_id,'exercises',jsonb_build_array(
      jsonb_build_object('exercise_id','dominadas-lastradas','name','Dominadas lastradas','series',3,'reps','6-8','weight','0','rest','90s','muscle_group','Espalda'),
      jsonb_build_object('exercise_id','remo-pecho-apoyado','name','Remo con pecho apoyado','series',3,'reps','8-12','weight','0','rest','90s','muscle_group','Espalda'),
      jsonb_build_object('exercise_id','jalon-unilateral','name','Jalón unilateral','series',2,'reps','10-12','weight','0','rest','90s','muscle_group','Espalda'),
      jsonb_build_object('exercise_id','pajaros-maquina','name','Pájaros en máquina','series',3,'reps','12-20','weight','0','rest','90s','muscle_group','Hombros'),
      jsonb_build_object('exercise_id','face-pulls','name','Face pulls','series',2,'reps','12-20','weight','0','rest','90s','muscle_group','Hombros'),
      jsonb_build_object('exercise_id','curl-inclinado','name','Curl inclinado','series',3,'reps','8-12','weight','0','rest','90s','muscle_group','Bíceps')
    )),
    jsonb_build_object('day','Jueves','type','gimnasio','routine_name','Safety','muscle_focus','Pecho, hombros y serrato','custom',true,'routine_id',v_routine_id,'exercises',jsonb_build_array(
      jsonb_build_object('exercise_id','press-inclinado-maquina','name','Press inclinado en máquina','series',2,'reps','8-12','weight','0','rest','90s','muscle_group','Pecho'),
      jsonb_build_object('exercise_id','press-horizontal-maquina','name','Press horizontal en máquina','series',2,'reps','8-12','weight','0','rest','90s','muscle_group','Pecho'),
      jsonb_build_object('exercise_id','cruces-abajo-arriba','name','Cruces abajo-arriba','series',2,'reps','12-15','weight','0','rest','90s','muscle_group','Pecho'),
      jsonb_build_object('exercise_id','elevacion-lateral-polea-2','name','Elevación lateral en polea','series',3,'reps','12-20','weight','0','rest','90s','muscle_group','Hombros'),
      jsonb_build_object('exercise_id','elevacion-lateral-maquina','name','Elevación lateral en máquina','series',2,'reps','12-20','weight','0','rest','90s','muscle_group','Hombros'),
      jsonb_build_object('exercise_id','aperturas-inversas-maquina','name','Aperturas inversas en máquina','series',2,'reps','12-20','weight','0','rest','90s','muscle_group','Hombros'),
      jsonb_build_object('exercise_id','push-up-plus','name','Push-up plus','series',2,'reps','12-15','weight','0','rest','90s','muscle_group','Core'),
      jsonb_build_object('exercise_id','crunch-maquina','name','Crunch en máquina','series',3,'reps','12-15','weight','0','rest','60s','muscle_group','Core')
    )),
    jsonb_build_object('day','Viernes','type','actividad','sport','Descanso','intensity','','duration',''),
    jsonb_build_object('day','Sábado','type','gimnasio','routine_name','Safety','muscle_focus','Piernas B, abdomen y espalda','custom',true,'routine_id',v_routine_id,'exercises',jsonb_build_array(
      jsonb_build_object('exercise_id','peso-muerto-romano','name','Peso muerto rumano','series',3,'reps','8-12','weight','0','rest','120s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','sentadilla-bulgara','name','Sentadilla búlgara','series',3,'reps','8-12','weight','0','rest','90s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','curl-femoral','name','Curl femoral','series',3,'reps','10-15','weight','0','rest','90s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','extension-cuadriceps-2','name','Extensión de cuádriceps','series',2,'reps','12-15','weight','0','rest','90s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','gemelos-2','name','Gemelos','series',3,'reps','12-20','weight','0','rest','90s','muscle_group','Piernas'),
      jsonb_build_object('exercise_id','remo-polea','name','Remo en polea','series',2,'reps','10-12','weight','0','rest','90s','muscle_group','Espalda'),
      jsonb_build_object('exercise_id','reverse-crunch','name','Reverse crunch','series',3,'reps','12-15','weight','0','rest','90s','muscle_group','Core'),
      jsonb_build_object('exercise_id','ab-wheel','name','Ab wheel','series',2,'reps','8-12','weight','0','rest','90s','muscle_group','Core'),
      jsonb_build_object('exercise_id','serratus-punches','name','Serratus punches','series',2,'reps','12-15','weight','0','rest','60s','muscle_group','Core')
    )),
    jsonb_build_object('day','Domingo','type','actividad','sport','Descanso','intensity','','duration','')
  );

  -- 4) Upsert
  INSERT INTO public.training_plan (user_id, workouts_json, updated_at)
  VALUES (v_user_id, v_workouts, now())
  ON CONFLICT (user_id) DO UPDATE SET workouts_json = EXCLUDED.workouts_json, updated_at = now();

  RAISE NOTICE 'Rutina Safety insertada para %', v_user_id;
END $$;