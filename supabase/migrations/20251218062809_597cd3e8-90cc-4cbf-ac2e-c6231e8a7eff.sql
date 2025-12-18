-- Create table for tracking collected fees/rake
CREATE TABLE public.collected_fees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid REFERENCES public.games(id) NOT NULL,
    table_id uuid REFERENCES public.poker_tables(id) NOT NULL,
    fee_amount integer NOT NULL DEFAULT 0,
    pot_size integer NOT NULL DEFAULT 0,
    big_blind integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.collected_fees ENABLE ROW LEVEL SECURITY;

-- Anyone can view fees (for stats)
CREATE POLICY "Anyone can view fees" ON public.collected_fees FOR SELECT USING (true);

-- Only admin can insert fees (via service role)
CREATE POLICY "Service role inserts fees" ON public.collected_fees FOR INSERT WITH CHECK (true);

-- Create table for cash in/out requests
CREATE TABLE public.cash_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    request_type text NOT NULL CHECK (request_type IN ('cash_in', 'cash_out')),
    amount integer NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes text,
    processed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.cash_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests" ON public.cash_requests FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON public.cash_requests FOR SELECT USING (is_admin(auth.uid()));

-- Users can create their own requests
CREATE POLICY "Users can create own requests" ON public.cash_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can update any request
CREATE POLICY "Admins can update requests" ON public.cash_requests FOR UPDATE USING (is_admin(auth.uid()));

-- Enable realtime for cash_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collected_fees;