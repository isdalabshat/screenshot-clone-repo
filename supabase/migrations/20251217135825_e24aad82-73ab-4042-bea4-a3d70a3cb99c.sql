-- Add turn_expires_at column to games table for 30-second timer
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS turn_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient timer queries
CREATE INDEX IF NOT EXISTS idx_games_turn_expires_at ON public.games(turn_expires_at) WHERE turn_expires_at IS NOT NULL;