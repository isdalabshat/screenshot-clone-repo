-- Add proof_image_url column to cash_requests table
ALTER TABLE public.cash_requests 
ADD COLUMN proof_image_url TEXT;

-- Create storage bucket for cash request proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cash-proofs', 'cash-proofs', true);

-- Create storage policies for cash proofs
CREATE POLICY "Users can upload their own cash proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cash-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Cash proofs are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'cash-proofs');

CREATE POLICY "Users can delete their own cash proofs"
ON storage.objects FOR DELETE
USING (bucket_id = 'cash-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);