-- Add lucky9_fees table to track fees collected from Lucky 9 games
CREATE TABLE public.lucky9_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES public.lucky9_games(id) ON DELETE SET NULL,
  table_id UUID NOT NULL REFERENCES public.lucky9_tables(id) ON DELETE CASCADE,
  fee_amount INTEGER NOT NULL DEFAULT 0,
  total_winnings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lucky9_fees ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read fees (admin will manage via service role)
CREATE POLICY "Anyone can view lucky9 fees"
ON public.lucky9_fees
FOR SELECT
USING (true);

-- Enable realtime for lucky9_fees
ALTER PUBLICATION supabase_realtime ADD TABLE public.lucky9_fees;