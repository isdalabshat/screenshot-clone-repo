-- Add admin delete policies for all related tables

-- game_actions: Allow admins to delete
CREATE POLICY "Admins can delete game actions" 
ON public.game_actions 
FOR DELETE 
USING (is_admin(auth.uid()));

-- collected_fees: Allow admins to delete  
CREATE POLICY "Admins can delete collected fees"
ON public.collected_fees
FOR DELETE
USING (is_admin(auth.uid()));

-- chat_messages: Allow admins to delete
CREATE POLICY "Admins can delete chat messages"
ON public.chat_messages
FOR DELETE
USING (is_admin(auth.uid()));

-- table_players: Allow admins to delete
CREATE POLICY "Admins can delete table players"
ON public.table_players
FOR DELETE
USING (is_admin(auth.uid()));

-- games: Allow admins to delete
CREATE POLICY "Admins can delete games"
ON public.games
FOR DELETE
USING (is_admin(auth.uid()));