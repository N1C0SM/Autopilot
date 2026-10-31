-- Biblioteca de ejercicios · fase 1: modelo de datos.
-- Solo añade: `exercises` conserva sus ids, nombres y columnas, así que las
-- rutinas guardadas (por exercise_id o por nombre) y el planificador siguen igual.
-- Los ejercicios que ya existen quedan como `published` y fuente `autopilot`.

-- ─── Clave normalizada del nombre: minúsculas, sin acentos ni signos ───
-- Sirve para el slug y para impedir duplicados ("Press Banca" = "press  banca").
CREATE OR REPLACE FUNCTION public.exercise_name_key(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT btrim(regexp_replace(
    translate(lower(coalesce(_name, '')), 'áàäâãåéèëêíìïîóòöôõúùüûñçý', 'aaaaaaeeeeiiiiooooouuuuncy'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

-- ─── Ficha completa ───
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS alt_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS instructions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_mistakes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tips text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS safety_notes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mechanic text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'autopilot',
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS license text,
  ADD COLUMN IF NOT EXISTS license_author text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_status_check CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  ADD CONSTRAINT exercises_mechanic_check CHECK (mechanic IS NULL OR mechanic IN ('compound', 'isolation'));

COMMENT ON COLUMN public.exercises.status IS
  'draft/pending: solo admin (importados o sin validar). published: visible en la biblioteca y usable por el planificador. archived: fuera de la biblioteca, pero las rutinas que lo usan lo siguen leyendo.';
COMMENT ON COLUMN public.exercises.source IS
  'Origen de la ficha: autopilot (propia) o wger. Si no es propia, license y license_author se muestran en la ficha.';

-- Slug estable para los ejercicios actuales; los repetidos llevan sufijo del id.
WITH base AS (
  SELECT id,
         nullif(replace(public.exercise_name_key(name), ' ', '-'), '') AS s,
         row_number() OVER (PARTITION BY public.exercise_name_key(name) ORDER BY created_at, id) AS n
  FROM public.exercises
  WHERE slug IS NULL
)
UPDATE public.exercises e
SET slug = coalesce(b.s, 'ejercicio') || CASE WHEN b.n > 1 OR b.s IS NULL THEN '-' || left(e.id::text, 8) ELSE '' END
FROM base b
WHERE b.id = e.id;

CREATE UNIQUE INDEX IF NOT EXISTS exercises_slug_key ON public.exercises (slug);
CREATE INDEX IF NOT EXISTS exercises_name_key_idx ON public.exercises (public.exercise_name_key(name));
CREATE INDEX IF NOT EXISTS exercises_status_idx ON public.exercises (status);
-- Una sola ficha por ejercicio de cada catálogo importado (la importación se puede repetir sin duplicar).
CREATE UNIQUE INDEX IF NOT EXISTS exercises_source_ref_key ON public.exercises (source, source_ref) WHERE source_ref IS NOT NULL;

-- Slug automático, updated_at y ningún nombre repetido en altas o renombres.
-- Los duplicados que ya existieran no bloquean nada: solo se comprueba al cambiar el nombre.
CREATE OR REPLACE FUNCTION public.exercises_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.name IS DISTINCT FROM OLD.name THEN
    IF EXISTS (
      SELECT 1 FROM public.exercises
      WHERE public.exercise_name_key(name) = public.exercise_name_key(NEW.name) AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Ya existe un ejercicio llamado "%"', NEW.name USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base_slug := coalesce(nullif(replace(public.exercise_name_key(NEW.name), ' ', '-'), ''), 'ejercicio');
    NEW.slug := base_slug;
    IF EXISTS (SELECT 1 FROM public.exercises WHERE slug = base_slug AND id <> NEW.id) THEN
      NEW.slug := base_slug || '-' || left(NEW.id::text, 8);
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exercises_before_write ON public.exercises;
CREATE TRIGGER exercises_before_write
  BEFORE INSERT OR UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.exercises_before_write();

-- ─── Catálogos ───
CREATE TABLE IF NOT EXISTS public.muscles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  filter_group text CHECK (filter_group IN (
    'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazos', 'Abdomen',
    'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos', 'Cuerpo completo')),
  sort integer NOT NULL DEFAULT 0
);
COMMENT ON COLUMN public.muscles.filter_group IS
  'Grupo del filtro de la biblioteca. NULL = el músculo se muestra en la ficha pero no tiene filtro propio.';

CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.exercise_categories_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.exercise_categories_catalog IS 'Modalidades de la biblioteca (Gimnasio, Calistenia, Funcional, Híbrido, Movilidad).';

INSERT INTO public.muscles (slug, name, filter_group, sort) VALUES
  ('pectoral', 'Pectoral mayor', 'Pecho', 10),
  ('serrato', 'Serrato anterior', 'Pecho', 11),
  ('dorsal', 'Dorsal ancho', 'Espalda', 20),
  ('trapecio', 'Trapecio', 'Espalda', 21),
  ('romboides', 'Romboides', 'Espalda', 22),
  ('erectores', 'Erectores espinales', 'Espalda', 23),
  ('deltoides-anterior', 'Deltoides anterior', 'Hombros', 30),
  ('deltoides-lateral', 'Deltoides lateral', 'Hombros', 31),
  ('deltoides-posterior', 'Deltoides posterior', 'Hombros', 32),
  ('manguito-rotador', 'Manguito rotador', 'Hombros', 33),
  ('biceps', 'Bíceps braquial', 'Bíceps', 40),
  ('braquial', 'Braquial', 'Bíceps', 41),
  ('triceps', 'Tríceps braquial', 'Tríceps', 50),
  ('antebrazo', 'Antebrazo', 'Antebrazos', 60),
  ('recto-abdominal', 'Recto abdominal', 'Abdomen', 70),
  ('oblicuos', 'Oblicuos', 'Abdomen', 71),
  ('flexores-cadera', 'Flexores de cadera', 'Abdomen', 72),
  ('cuadriceps', 'Cuádriceps', 'Cuádriceps', 80),
  ('aductores', 'Aductores', 'Cuádriceps', 81),
  ('isquiotibiales', 'Isquiotibiales', 'Isquiotibiales', 90),
  ('gluteo-mayor', 'Glúteo mayor', 'Glúteos', 100),
  ('gluteo-medio', 'Glúteo medio', 'Glúteos', 101),
  ('gemelos', 'Gemelos', 'Gemelos', 110),
  ('soleo', 'Sóleo', 'Gemelos', 111),
  ('cuello', 'Cuello', NULL, 120)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.equipment (slug, name, sort) VALUES
  ('peso-corporal', 'Peso corporal', 10),
  ('mancuernas', 'Mancuernas', 20),
  ('barra', 'Barra', 30),
  ('maquinas', 'Máquinas', 40),
  ('poleas', 'Poleas', 50),
  ('kettlebell', 'Kettlebell', 60),
  ('bandas', 'Bandas elásticas', 70),
  ('anillas', 'Anillas', 80),
  ('barra-dominadas', 'Barra de dominadas', 90),
  ('paralelas', 'Paralelas', 100),
  ('otros', 'Otros', 110)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.exercise_categories_catalog (slug, name, sort) VALUES
  ('gimnasio', 'Gimnasio', 10),
  ('calistenia', 'Calistenia', 20),
  ('funcional', 'Entrenamiento funcional', 30),
  ('hibrido', 'Entrenamiento híbrido', 40),
  ('movilidad', 'Movilidad', 50)
ON CONFLICT (slug) DO NOTHING;

-- ─── Relaciones ───
CREATE TABLE IF NOT EXISTS public.exercise_muscles (
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  muscle_id uuid NOT NULL REFERENCES public.muscles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'secondary')),
  PRIMARY KEY (exercise_id, muscle_id)
);
CREATE INDEX IF NOT EXISTS exercise_muscles_muscle_idx ON public.exercise_muscles (muscle_id);

CREATE TABLE IF NOT EXISTS public.exercise_equipment (
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, equipment_id)
);
CREATE INDEX IF NOT EXISTS exercise_equipment_equipment_idx ON public.exercise_equipment (equipment_id);

CREATE TABLE IF NOT EXISTS public.exercise_categories (
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.exercise_categories_catalog(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, category_id)
);
CREATE INDEX IF NOT EXISTS exercise_categories_category_idx ON public.exercise_categories (category_id);

-- Variante (misma técnica con otro agarre/equipo) o alternativa (sustituto equivalente).
CREATE TABLE IF NOT EXISTS public.exercise_relations (
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  related_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('variant', 'alternative')),
  PRIMARY KEY (exercise_id, related_id, kind),
  CHECK (exercise_id <> related_id)
);
CREATE INDEX IF NOT EXISTS exercise_relations_related_idx ON public.exercise_relations (related_id);

-- Fotos, clips en bucle y vídeos con su fuente y licencia. Solo se muestran los aprobados.
CREATE TABLE IF NOT EXISTS public.exercise_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image', 'loop', 'video')),
  url text NOT NULL,
  source text NOT NULL DEFAULT 'autopilot',
  source_url text,
  license text,
  license_author text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exercise_media_exercise_idx ON public.exercise_media (exercise_id, sort);

-- ─── Datos de cada usuario ───
CREATE TABLE IF NOT EXISTS public.exercise_favorites (
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS public.exercise_recent (
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);
CREATE INDEX IF NOT EXISTS exercise_recent_user_idx ON public.exercise_recent (user_id, viewed_at DESC);

-- ─── RLS ───
-- Los usuarios con sesión ven los publicados y los archivados (las rutinas antiguas
-- los siguen leyendo); borradores y pendientes solo los ve el admin (su política FOR ALL).
DROP POLICY IF EXISTS "Authenticated can view exercises" ON public.exercises;
CREATE POLICY "Authenticated can view live exercises"
  ON public.exercises FOR SELECT TO authenticated
  USING (status IN ('published', 'archived'));

ALTER TABLE public.muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_categories_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_recent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view muscles" ON public.muscles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage muscles" ON public.muscles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated can view equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage equipment" ON public.equipment FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated can view exercise categories" ON public.exercise_categories_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exercise categories" ON public.exercise_categories_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated can view exercise muscles" ON public.exercise_muscles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exercise muscles" ON public.exercise_muscles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated can view exercise equipment" ON public.exercise_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exercise equipment" ON public.exercise_equipment FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated can view exercise category links" ON public.exercise_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exercise category links" ON public.exercise_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated can view exercise relations" ON public.exercise_relations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exercise relations" ON public.exercise_relations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated can view approved exercise media" ON public.exercise_media FOR SELECT TO authenticated USING (status = 'approved');
CREATE POLICY "Admins manage exercise media" ON public.exercise_media FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users manage own exercise favorites" ON public.exercise_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own recent exercises" ON public.exercise_recent FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.muscles, public.equipment, public.exercise_categories_catalog,
  public.exercise_muscles, public.exercise_equipment, public.exercise_categories,
  public.exercise_relations, public.exercise_media TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.muscles, public.equipment, public.exercise_categories_catalog,
  public.exercise_muscles, public.exercise_equipment, public.exercise_categories,
  public.exercise_relations, public.exercise_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_favorites, public.exercise_recent TO authenticated;
GRANT ALL ON public.muscles, public.equipment, public.exercise_categories_catalog,
  public.exercise_muscles, public.exercise_equipment, public.exercise_categories,
  public.exercise_relations, public.exercise_media, public.exercise_favorites, public.exercise_recent TO service_role;
