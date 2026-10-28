
-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_user_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own conversations
CREATE POLICY "Users can view own chat"
ON public.chat_messages FOR SELECT TO authenticated
USING (conversation_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Users and admins can send messages
CREATE POLICY "Users can send messages in own chat"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  (conversation_user_id = auth.uid() AND sender_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Weight tracking table
CREATE TABLE public.weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weight numeric NOT NULL,
  logged_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, logged_at)
);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own weight logs"
ON public.weight_logs FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all weight logs"
ON public.weight_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add subscription fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_end timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
