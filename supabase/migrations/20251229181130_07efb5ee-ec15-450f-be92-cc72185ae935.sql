-- Add bet_accepted field to track if banker has accepted player's bet
ALTER TABLE public.lucky9_players
ADD COLUMN IF NOT EXISTS bet_accepted BOOLEAN DEFAULT NULL;

-- NULL = pending, true = accepted, false = rejected