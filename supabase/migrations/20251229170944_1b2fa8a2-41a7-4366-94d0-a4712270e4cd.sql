-- Create Lucky 9 tables
CREATE TABLE public.lucky9_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  min_bet INTEGER NOT NULL DEFAULT 10,
  max_bet INTEGER NOT NULL DEFAULT 1000,
  max_players INTEGER NOT NULL DEFAULT 6,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Lucky 9 games
CREATE TABLE public.lucky9_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.lucky9_tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'betting', -- betting, dealing, player_turns, dealer_turn, showdown, finished
  dealer_cards TEXT[] DEFAULT '{}',
  dealer_hidden_card TEXT,
  current_player_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Lucky 9 players
CREATE TABLE public.lucky9_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.lucky9_tables(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.lucky9_games(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  position INTEGER NOT NULL,
  stack INTEGER NOT NULL DEFAULT 0,
  current_bet INTEGER NOT NULL DEFAULT 0,
  cards TEXT[] DEFAULT '{}',
  has_acted BOOLEAN NOT NULL DEFAULT false,
  has_stood BOOLEAN NOT NULL DEFAULT false,
  is_natural BOOLEAN NOT NULL DEFAULT false,
  result TEXT, -- win, lose, push, natural_win
  winnings INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.lucky9_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lucky9_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lucky9_players ENABLE ROW LEVEL SECURITY;

-- Lucky 9 Tables RLS policies
CREATE POLICY "Anyone can view lucky9 tables" 
ON public.lucky9_tables FOR SELECT USING (true);

CREATE POLICY "Admins can manage lucky9 tables" 
ON public.lucky9_tables FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert lucky9 tables" 
ON public.lucky9_tables FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update lucky9 tables" 
ON public.lucky9_tables FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete lucky9 tables" 
ON public.lucky9_tables FOR DELETE USING (is_admin(auth.uid()));

-- Lucky 9 Games RLS policies
CREATE POLICY "Anyone can view lucky9 games" 
ON public.lucky9_games FOR SELECT USING (true);

CREATE POLICY "Auth users can manage lucky9 games" 
ON public.lucky9_games FOR ALL USING (auth.uid() IS NOT NULL);

-- Lucky 9 Players RLS policies
CREATE POLICY "Anyone can view lucky9 players" 
ON public.lucky9_players FOR SELECT USING (true);

CREATE POLICY "Auth users can join lucky9 tables" 
ON public.lucky9_players FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lucky9 player state" 
ON public.lucky9_players FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave lucky9 tables" 
ON public.lucky9_players FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete lucky9 players" 
ON public.lucky9_players FOR DELETE USING (is_admin(auth.uid()));

-- Add realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE public.lucky9_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lucky9_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lucky9_players;

-- Create trigger for updating updated_at
CREATE TRIGGER update_lucky9_games_updated_at
BEFORE UPDATE ON public.lucky9_games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();