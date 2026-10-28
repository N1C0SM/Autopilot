ALTER TABLE public.chat_messages
  ADD COLUMN media_url text DEFAULT NULL,
  ADD COLUMN media_type text DEFAULT NULL;