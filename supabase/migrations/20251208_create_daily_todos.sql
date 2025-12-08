-- Create daily_todos table
CREATE TABLE IF NOT EXISTS public.daily_todos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    task_text TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT max_5_tasks_per_day CHECK (position >= 1 AND position <= 5),
    UNIQUE(user_id, date, position)
);

-- Enable RLS
ALTER TABLE public.daily_todos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own todos"
ON public.daily_todos
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers and Admins can view all todos"
ON public.daily_todos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('superadmin', 'manager')
  )
);

-- Grant permissions
GRANT ALL ON public.daily_todos TO authenticated;
GRANT ALL ON public.daily_todos TO service_role;

-- Create index for faster queries
CREATE INDEX idx_daily_todos_user_date ON public.daily_todos(user_id, date);
CREATE INDEX idx_daily_todos_date ON public.daily_todos(date);
