-- Add is_sitting_out column to table_players
ALTER TABLE public.table_players 
ADD COLUMN is_sitting_out BOOLEAN NOT NULL DEFAULT false;