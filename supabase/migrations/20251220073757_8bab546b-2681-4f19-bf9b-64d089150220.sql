-- Add total_invested column to track player's total bet contribution across all rounds
-- This is essential for proper side pot calculation in all-in scenarios
ALTER TABLE public.table_players 
ADD COLUMN IF NOT EXISTS total_invested integer NOT NULL DEFAULT 0;