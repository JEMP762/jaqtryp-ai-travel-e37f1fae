CREATE TABLE public.jax_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Conversa com JAX',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jax_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.jax_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jax_conversations_user_idx ON public.jax_conversations(user_id, updated_at DESC);
CREATE INDEX jax_messages_conv_idx ON public.jax_messages(conversation_id, created_at);
CREATE INDEX jax_messages_user_time_idx ON public.jax_messages(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jax_conversations TO authenticated;
GRANT ALL ON public.jax_conversations TO service_role;
GRANT SELECT, INSERT, DELETE ON public.jax_messages TO authenticated;
GRANT ALL ON public.jax_messages TO service_role;

ALTER TABLE public.jax_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jax_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jax_conversations_own" ON public.jax_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jax_messages_select_own" ON public.jax_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "jax_messages_insert_own" ON public.jax_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.jax_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "jax_messages_delete_own" ON public.jax_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER jax_conversations_touch
  BEFORE UPDATE ON public.jax_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();