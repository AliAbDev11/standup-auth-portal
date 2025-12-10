-- Enable RLS on roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read roles
CREATE POLICY "roles_select_authenticated" ON public.roles
  FOR SELECT TO authenticated USING (true);

-- Only superadmins can modify roles
CREATE POLICY "roles_modify_superadmin" ON public.roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'superadmin'
      AND profiles.deleted_at IS NULL
    )
  );

-- Fix security definer views by recreating them without SECURITY DEFINER
DROP VIEW IF EXISTS public.active_users_view CASCADE;
CREATE VIEW public.active_users_view AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  d.name AS department_name,
  p.department_id,
  p.is_active,
  p.created_at
FROM profiles p
JOIN departments d ON p.department_id = d.id
WHERE p.is_active = true 
  AND p.deleted_at IS NULL 
  AND d.deleted_at IS NULL;

DROP VIEW IF EXISTS public.todays_standup_status CASCADE;
CREATE VIEW public.todays_standup_status AS
SELECT 
  p.id AS user_id,
  p.full_name,
  p.email,
  d.name AS department_name,
  p.department_id,
  CASE
    WHEN s.id IS NOT NULL THEN 'submitted'
    WHEN lr.id IS NOT NULL AND lr.status = 'approved' THEN 'on_leave'
    ELSE 'pending'
  END AS status,
  s.submitted_at
FROM profiles p
JOIN departments d ON p.department_id = d.id
LEFT JOIN daily_standups s ON s.user_id = p.id AND s.date = CURRENT_DATE AND s.deleted_at IS NULL
LEFT JOIN leave_requests lr ON lr.user_id = p.id AND lr.date = CURRENT_DATE AND lr.deleted_at IS NULL
WHERE p.is_active = true 
  AND p.role = 'member'
  AND p.deleted_at IS NULL 
  AND d.deleted_at IS NULL;