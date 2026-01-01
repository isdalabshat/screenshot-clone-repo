-- Add gcash_number column to cash_requests for cash out requests
ALTER TABLE public.cash_requests 
ADD COLUMN gcash_number TEXT;