-- Create chat messages table for table chat
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can view messages for tables they're viewing
CREATE POLICY "Anyone can view chat messages"
ON public.chat_messages
FOR SELECT
USING (true);

-- Auth users can send messages
CREATE POLICY "Auth users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Add index for faster queries
CREATE INDEX idx_chat_messages_table_id ON public.chat_messages(table_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);