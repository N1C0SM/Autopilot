ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS cover_alt text;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS related_slugs text[] NOT NULL DEFAULT '{}';