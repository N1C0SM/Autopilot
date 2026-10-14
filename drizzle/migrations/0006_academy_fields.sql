ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS order_index integer,
  ADD COLUMN IF NOT EXISTS evidence_level text,
  ADD COLUMN IF NOT EXISTS "references" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_level_chk CHECK (level IS NULL OR level IN ('beginner','intermediate','advanced'));
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_evidence_chk CHECK (evidence_level IS NULL OR evidence_level IN ('solid','limited','hypothesis'));
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_review_chk CHECK (review_status IN ('draft','in_review','verified'));

CREATE OR REPLACE FUNCTION public.blog_posts_require_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.published AND NEW.category IS NOT NULL AND NEW.review_status <> 'verified' THEN
    RAISE EXCEPTION 'Los artículos de la Academia solo se publican tras marcarlos como verificados';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER blog_posts_require_review
BEFORE INSERT OR UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.blog_posts_require_review();

CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON public.blog_posts (category, order_index);