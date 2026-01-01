-- Add DELETE policy for admins on lucky9_fees table
CREATE POLICY "Admins can delete lucky9 fees"
ON public.lucky9_fees
FOR DELETE
USING (is_admin(auth.uid()));

-- Add DELETE policy for admins on cash_requests table
CREATE POLICY "Admins can delete cash requests"
ON public.cash_requests
FOR DELETE
USING (is_admin(auth.uid()));