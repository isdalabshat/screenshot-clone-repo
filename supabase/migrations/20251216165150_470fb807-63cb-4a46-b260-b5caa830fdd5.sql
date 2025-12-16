-- Create app_role enum for admin functionality
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  chips INTEGER NOT NULL DEFAULT 1000,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create poker_tables table
CREATE TABLE public.poker_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  small_blind INTEGER NOT NULL,
  big_blind INTEGER NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 9,
  hands_played INTEGER NOT NULL DEFAULT 0,
  max_hands INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create games table for tracking current game state
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.poker_tables(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, preflop, flop, turn, river, showdown, complete
  pot INTEGER NOT NULL DEFAULT 0,
  community_cards TEXT[] DEFAULT '{}',
  current_bet INTEGER NOT NULL DEFAULT 0,
  dealer_position INTEGER NOT NULL DEFAULT 0,
  current_player_position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table_players for players seated at tables
CREATE TABLE public.table_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.poker_tables(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0 AND position < 9),
  stack INTEGER NOT NULL DEFAULT 0,
  hole_cards TEXT[] DEFAULT '{}',
  current_bet INTEGER NOT NULL DEFAULT 0,
  is_folded BOOLEAN NOT NULL DEFAULT false,
  is_all_in BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_id, position),
  UNIQUE (table_id, user_id)
);

-- Create game_actions for tracking betting history
CREATE TABLE public.game_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- fold, check, call, bet, raise, all_in
  amount INTEGER DEFAULT 0,
  round TEXT NOT NULL, -- preflop, flop, turn, river
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_actions ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid()));

-- Poker tables policies (public read, admin write)
CREATE POLICY "Anyone can view tables" ON public.poker_tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage tables" ON public.poker_tables FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Auth users can create tables" ON public.poker_tables FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Games policies
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Auth users can manage games" ON public.games FOR ALL USING (auth.uid() IS NOT NULL);

-- Table players policies
CREATE POLICY "Anyone can view table players" ON public.table_players FOR SELECT USING (true);
CREATE POLICY "Auth users can join tables" ON public.table_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own player state" ON public.table_players FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave tables" ON public.table_players FOR DELETE USING (auth.uid() = user_id);

-- Game actions policies
CREATE POLICY "Anyone can view game actions" ON public.game_actions FOR SELECT USING (true);
CREATE POLICY "Auth users can create actions" ON public.game_actions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, chips)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username', 1000);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default tables
INSERT INTO public.poker_tables (name, small_blind, big_blind) VALUES
  ('Table 1 - Low Stakes', 10, 20),
  ('Table 2 - Medium Stakes', 25, 50);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_tables;