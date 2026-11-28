-- Rutinas predefinidas (plantillas) administradas por el admin.
-- Cada rutina es un conjunto de días (DayPlan[]) que el usuario puede aplicar a su plan.

CREATE TABLE IF NOT EXISTS public.routine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: cualquiera autenticado puede leer las públicas; solo admin escribe.
ALTER TABLE public.routine_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS routine_templates_read ON public.routine_templates;
CREATE POLICY routine_templates_read ON public.routine_templates
  FOR SELECT TO authenticated USING (is_public = true);

DROP POLICY IF EXISTS routine_templates_admin ON public.routine_templates;
CREATE POLICY routine_templates_admin ON public.routine_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed: rutinas predefinidas (solo si la tabla está vacía).
INSERT INTO public.routine_templates (name, description, days)
SELECT * FROM (VALUES
  ('PPL (Push/Pull/Legs)', '3 días: empuje, tirón y piernas. Ideal para 3 días/semana.', '[
    {"day":"Lunes","type":"gimnasio","routine_name":"PPL - Push","muscle_focus":"Pecho, hombros y tríceps","custom":true,"exercises":[
      {"exercise_id":"press-banca","name":"Press de banca","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Pecho"},
      {"exercise_id":"press-inclinado","name":"Press inclinado con mancuernas","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Pecho"},
      {"exercise_id":"elevacion-lateral","name":"Elevación lateral","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Hombros"},
      {"exercise_id":"fondos","name":"Fondos en paralelas","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Tríceps"},
      {"exercise_id":"extension-triceps","name":"Extensión de tríceps","series":3,"reps":"10-15","weight":"0","rest":"60s","muscle_group":"Tríceps"}
    ]},
    {"day":"Miércoles","type":"gimnasio","routine_name":"PPL - Pull","muscle_focus":"Espalda y bíceps","custom":true,"exercises":[
      {"exercise_id":"dominadas","name":"Dominadas","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Espalda"},
      {"exercise_id":"remo-barra","name":"Remo con barra","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"jalon","name":"Jalón al pecho","series":3,"reps":"10-12","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"curl-barra","name":"Curl con barra","series":3,"reps":"8-12","weight":"0","rest":"60s","muscle_group":"Bíceps"},
      {"exercise_id":"curl-martillo","name":"Curl martillo","series":3,"reps":"10-15","weight":"0","rest":"60s","muscle_group":"Bíceps"}
    ]},
    {"day":"Viernes","type":"gimnasio","routine_name":"PPL - Legs","muscle_focus":"Piernas y glúteos","custom":true,"exercises":[
      {"exercise_id":"sentadilla","name":"Sentadilla","series":4,"reps":"6-8","weight":"0","rest":"180s","muscle_group":"Piernas"},
      {"exercise_id":"prensa","name":"Prensa","series":3,"reps":"10-12","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"curl-femoral","name":"Curl femoral","series":3,"reps":"10-12","weight":"0","rest":"90s","muscle_group":"Piernas"},
      {"exercise_id":"extension-cuadriceps","name":"Extensión de cuádriceps","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Piernas"},
      {"exercise_id":"gemelos","name":"Gemelos","series":4,"reps":"12-20","weight":"0","rest":"60s","muscle_group":"Piernas"}
    ]}
  ]'::jsonb),
  ('Upper/Lower', '4 días: tren superior e inferior alternados.', '[
    {"day":"Lunes","type":"gimnasio","routine_name":"Upper","muscle_focus":"Tren superior","custom":true,"exercises":[
      {"exercise_id":"press-banca","name":"Press de banca","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Pecho"},
      {"exercise_id":"remo-barra","name":"Remo con barra","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Espalda"},
      {"exercise_id":"press-militar","name":"Press militar","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Hombros"},
      {"exercise_id":"dominadas","name":"Dominadas","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"curl-barra","name":"Curl con barra","series":3,"reps":"10-12","weight":"0","rest":"60s","muscle_group":"Bíceps"},
      {"exercise_id":"extension-triceps","name":"Extensión de tríceps","series":3,"reps":"10-12","weight":"0","rest":"60s","muscle_group":"Tríceps"}
    ]},
    {"day":"Martes","type":"gimnasio","routine_name":"Lower","muscle_focus":"Tren inferior","custom":true,"exercises":[
      {"exercise_id":"sentadilla","name":"Sentadilla","series":4,"reps":"6-8","weight":"0","rest":"180s","muscle_group":"Piernas"},
      {"exercise_id":"peso-muerto-rumano","name":"Peso muerto rumano","series":3,"reps":"8-12","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"prensa","name":"Prensa","series":3,"reps":"10-12","weight":"0","rest":"90s","muscle_group":"Piernas"},
      {"exercise_id":"curl-femoral","name":"Curl femoral","series":3,"reps":"10-12","weight":"0","rest":"60s","muscle_group":"Piernas"},
      {"exercise_id":"gemelos","name":"Gemelos","series":4,"reps":"12-20","weight":"0","rest":"60s","muscle_group":"Piernas"}
    ]},
    {"day":"Jueves","type":"gimnasio","routine_name":"Upper","muscle_focus":"Tren superior","custom":true,"exercises":[
      {"exercise_id":"press-inclinado","name":"Press inclinado con mancuernas","series":4,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Pecho"},
      {"exercise_id":"remo-pecho-apoyado","name":"Remo con pecho apoyado","series":4,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"elevacion-lateral","name":"Elevación lateral","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Hombros"},
      {"exercise_id":"fondos","name":"Fondos en paralelas","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Tríceps"},
      {"exercise_id":"curl-inclinado","name":"Curl inclinado","series":3,"reps":"8-12","weight":"0","rest":"60s","muscle_group":"Bíceps"}
    ]},
    {"day":"Viernes","type":"gimnasio","routine_name":"Lower","muscle_focus":"Tren inferior","custom":true,"exercises":[
      {"exercise_id":"sentadilla-bulgara","name":"Sentadilla búlgara","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Piernas"},
      {"exercise_id":"peso-muerto-rumano","name":"Peso muerto rumano","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Piernas"},
      {"exercise_id":"extension-cuadriceps","name":"Extensión de cuádriceps","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Piernas"},
      {"exercise_id":"curl-femoral","name":"Curl femoral","series":3,"reps":"10-15","weight":"0","rest":"60s","muscle_group":"Piernas"},
      {"exercise_id":"gemelos","name":"Gemelos","series":4,"reps":"12-20","weight":"0","rest":"60s","muscle_group":"Piernas"}
    ]}
  ]'::jsonb),
  ('Arnold Split', '3 días: pecho/espalda, hombros/brazos, piernas.', '[
    {"day":"Lunes","type":"gimnasio","routine_name":"Arnold - Pecho y espalda","muscle_focus":"Pecho y espalda","custom":true,"exercises":[
      {"exercise_id":"press-banca","name":"Press de banca","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Pecho"},
      {"exercise_id":"dominadas","name":"Dominadas","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Espalda"},
      {"exercise_id":"press-inclinado","name":"Press inclinado con mancuernas","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Pecho"},
      {"exercise_id":"remo-barra","name":"Remo con barra","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"cruces","name":"Cruces en polea","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Pecho"}
    ]},
    {"day":"Miércoles","type":"gimnasio","routine_name":"Arnold - Hombros y brazos","muscle_focus":"Hombros, bíceps y tríceps","custom":true,"exercises":[
      {"exercise_id":"press-militar","name":"Press militar","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Hombros"},
      {"exercise_id":"elevacion-lateral","name":"Elevación lateral","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Hombros"},
      {"exercise_id":"curl-barra","name":"Curl con barra","series":3,"reps":"8-12","weight":"0","rest":"60s","muscle_group":"Bíceps"},
      {"exercise_id":"extension-triceps","name":"Extensión de tríceps","series":3,"reps":"10-12","weight":"0","rest":"60s","muscle_group":"Tríceps"},
      {"exercise_id":"curl-martillo","name":"Curl martillo","series":3,"reps":"10-15","weight":"0","rest":"60s","muscle_group":"Bíceps"}
    ]},
    {"day":"Viernes","type":"gimnasio","routine_name":"Arnold - Piernas","muscle_focus":"Piernas y glúteos","custom":true,"exercises":[
      {"exercise_id":"sentadilla","name":"Sentadilla","series":4,"reps":"6-8","weight":"0","rest":"180s","muscle_group":"Piernas"},
      {"exercise_id":"prensa","name":"Prensa","series":3,"reps":"10-12","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"curl-femoral","name":"Curl femoral","series":3,"reps":"10-12","weight":"0","rest":"90s","muscle_group":"Piernas"},
      {"exercise_id":"extension-cuadriceps","name":"Extensión de cuádriceps","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Piernas"},
      {"exercise_id":"gemelos","name":"Gemelos","series":4,"reps":"12-20","weight":"0","rest":"60s","muscle_group":"Piernas"}
    ]}
  ]'::jsonb),
  ('PPL + Upper/Lower', '7 días: PPL (3) + Upper/Lower (4) para volumen alto.', '[
    {"day":"Lunes","type":"gimnasio","routine_name":"PPL+UL - Push","muscle_focus":"Pecho, hombros y tríceps","custom":true,"exercises":[
      {"exercise_id":"press-banca","name":"Press de banca","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Pecho"},
      {"exercise_id":"press-inclinado","name":"Press inclinado con mancuernas","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Pecho"},
      {"exercise_id":"elevacion-lateral","name":"Elevación lateral","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Hombros"},
      {"exercise_id":"extension-triceps","name":"Extensión de tríceps","series":3,"reps":"10-15","weight":"0","rest":"60s","muscle_group":"Tríceps"}
    ]},
    {"day":"Martes","type":"gimnasio","routine_name":"PPL+UL - Pull","muscle_focus":"Espalda y bíceps","custom":true,"exercises":[
      {"exercise_id":"dominadas","name":"Dominadas","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Espalda"},
      {"exercise_id":"remo-barra","name":"Remo con barra","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"curl-barra","name":"Curl con barra","series":3,"reps":"8-12","weight":"0","rest":"60s","muscle_group":"Bíceps"}
    ]},
    {"day":"Miércoles","type":"gimnasio","routine_name":"PPL+UL - Legs","muscle_focus":"Piernas","custom":true,"exercises":[
      {"exercise_id":"sentadilla","name":"Sentadilla","series":4,"reps":"6-8","weight":"0","rest":"180s","muscle_group":"Piernas"},
      {"exercise_id":"prensa","name":"Prensa","series":3,"reps":"10-12","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"curl-femoral","name":"Curl femoral","series":3,"reps":"10-12","weight":"0","rest":"90s","muscle_group":"Piernas"}
    ]},
    {"day":"Jueves","type":"gimnasio","routine_name":"PPL+UL - Upper","muscle_focus":"Tren superior","custom":true,"exercises":[
      {"exercise_id":"press-banca","name":"Press de banca","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Pecho"},
      {"exercise_id":"remo-barra","name":"Remo con barra","series":4,"reps":"6-8","weight":"0","rest":"120s","muscle_group":"Espalda"},
      {"exercise_id":"press-militar","name":"Press militar","series":3,"reps":"8-12","weight":"0","rest":"90s","muscle_group":"Hombros"}
    ]},
    {"day":"Viernes","type":"gimnasio","routine_name":"PPL+UL - Lower","muscle_focus":"Tren inferior","custom":true,"exercises":[
      {"exercise_id":"sentadilla","name":"Sentadilla","series":4,"reps":"6-8","weight":"0","rest":"180s","muscle_group":"Piernas"},
      {"exercise_id":"peso-muerto-rumano","name":"Peso muerto rumano","series":3,"reps":"8-12","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"gemelos","name":"Gemelos","series":4,"reps":"12-20","weight":"0","rest":"60s","muscle_group":"Piernas"}
    ]}
  ]'::jsonb),
  ('Método Bilbo', 'Full body 3x/semana con alta frecuencia y volumen moderado.', '[
    {"day":"Lunes","type":"gimnasio","routine_name":"Bilbo - Full A","muscle_focus":"Full body","custom":true,"exercises":[
      {"exercise_id":"sentadilla","name":"Sentadilla","series":3,"reps":"8-10","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"press-banca","name":"Press de banca","series":3,"reps":"8-10","weight":"0","rest":"90s","muscle_group":"Pecho"},
      {"exercise_id":"remo-barra","name":"Remo con barra","series":3,"reps":"8-10","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"press-militar","name":"Press militar","series":3,"reps":"8-10","weight":"0","rest":"90s","muscle_group":"Hombros"},
      {"exercise_id":"curl-barra","name":"Curl con barra","series":2,"reps":"10-12","weight":"0","rest":"60s","muscle_group":"Bíceps"}
    ]},
    {"day":"Miércoles","type":"gimnasio","routine_name":"Bilbo - Full B","muscle_focus":"Full body","custom":true,"exercises":[
      {"exercise_id":"peso-muerto-rumano","name":"Peso muerto rumano","series":3,"reps":"8-10","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"press-inclinado","name":"Press inclinado con mancuernas","series":3,"reps":"8-10","weight":"0","rest":"90s","muscle_group":"Pecho"},
      {"exercise_id":"dominadas","name":"Dominadas","series":3,"reps":"8-10","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"elevacion-lateral","name":"Elevación lateral","series":3,"reps":"12-15","weight":"0","rest":"60s","muscle_group":"Hombros"},
      {"exercise_id":"extension-triceps","name":"Extensión de tríceps","series":2,"reps":"10-12","weight":"0","rest":"60s","muscle_group":"Tríceps"}
    ]},
    {"day":"Viernes","type":"gimnasio","routine_name":"Bilbo - Full C","muscle_focus":"Full body","custom":true,"exercises":[
      {"exercise_id":"sentadilla","name":"Sentadilla","series":3,"reps":"8-10","weight":"0","rest":"120s","muscle_group":"Piernas"},
      {"exercise_id":"press-banca","name":"Press de banca","series":3,"reps":"8-10","weight":"0","rest":"90s","muscle_group":"Pecho"},
      {"exercise_id":"remo-pecho-apoyado","name":"Remo con pecho apoyado","series":3,"reps":"8-10","weight":"0","rest":"90s","muscle_group":"Espalda"},
      {"exercise_id":"curl-martillo","name":"Curl martillo","series":3,"reps":"10-12","weight":"0","rest":"60s","muscle_group":"Bíceps"},
      {"exercise_id":"gemelos","name":"Gemelos","series":3,"reps":"12-20","weight":"0","rest":"60s","muscle_group":"Piernas"}
    ]}
  ]'::jsonb)
) AS v(name, description, days)
WHERE NOT EXISTS (SELECT 1 FROM public.routine_templates LIMIT 1);