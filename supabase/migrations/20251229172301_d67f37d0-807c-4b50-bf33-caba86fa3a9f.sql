-- Add betting timer to tables
ALTER TABLE public.lucky9_tables
ADD COLUMN IF NOT EXISTS bet_timer_seconds integer NOT NULL DEFAULT 30;

-- Add is_banker flag to players to indicate if player is the banker
ALTER TABLE public.lucky9_players
ADD COLUMN IF NOT EXISTS is_banker boolean NOT NULL DEFAULT false;

-- Add betting_ends_at to games for timer countdown
ALTER TABLE public.lucky9_games
ADD COLUMN IF NOT EXISTS betting_ends_at timestamp with time zone;

-- Add banker_id to games to track who is the banker for current game
ALTER TABLE public.lucky9_games
ADD COLUMN IF NOT EXISTS banker_id uuid REFERENCES public.lucky9_players(id) ON DELETE SET NULL;