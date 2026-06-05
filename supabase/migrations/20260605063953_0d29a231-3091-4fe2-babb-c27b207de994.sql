
CREATE TABLE public.goal_physiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.goal_physiques TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.goal_physiques TO authenticated;
GRANT ALL ON public.goal_physiques TO service_role;

ALTER TABLE public.goal_physiques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible goal physiques"
  ON public.goal_physiques FOR SELECT
  TO anon, authenticated
  USING (visible = true);

CREATE POLICY "Admins can view all goal physiques"
  ON public.goal_physiques FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage goal physiques"
  ON public.goal_physiques FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER goal_physiques_set_updated_at
  BEFORE UPDATE ON public.goal_physiques
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
