-- Add RLS policy for admins to update any profile (for chip management)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()));

-- Add RLS policy for admins to delete tables
CREATE POLICY "Admins can delete tables"
ON public.poker_tables
FOR DELETE
USING (is_admin(auth.uid()));

-- Add RLS policy for admins to update tables  
CREATE POLICY "Admins can update tables"
ON public.poker_tables
FOR UPDATE
USING (is_admin(auth.uid()));