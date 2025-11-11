-- Enable RLS on sessions table
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sessions table
CREATE POLICY "Anyone can insert sessions"
ON public.sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read sessions"
ON public.sessions FOR SELECT
USING (true);

CREATE POLICY "Anyone can update sessions"
ON public.sessions FOR UPDATE
USING (true);