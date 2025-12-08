-- Create deliverables table
CREATE TABLE IF NOT EXISTS public.deliverables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    day_number INTEGER NOT NULL CHECK (day_number >= 45 AND day_number <= 70),
    drive_link TEXT NOT NULL,
    linkedin_link TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, day_number)
);

-- Enable RLS
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own deliverables"
ON public.deliverables
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own deliverables"
ON public.deliverables
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and Managers can view all deliverables"
ON public.deliverables
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('superadmin', 'manager')
  )
);

-- Grant permissions
GRANT ALL ON public.deliverables TO authenticated;
GRANT ALL ON public.deliverables TO service_role;
