-- Add Call Time columns to lucky9_tables
ALTER TABLE public.lucky9_tables 
ADD COLUMN call_time_minutes INTEGER DEFAULT NULL,
ADD COLUMN call_time_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN call_time_banker_id UUID DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lucky9_tables.call_time_minutes IS 'Call time duration in minutes (30, 60, or NULL for no call time)';
COMMENT ON COLUMN public.lucky9_tables.call_time_started_at IS 'When the call time started (activated when banker starts first round)';
COMMENT ON COLUMN public.lucky9_tables.call_time_banker_id IS 'The banker who started the call time';