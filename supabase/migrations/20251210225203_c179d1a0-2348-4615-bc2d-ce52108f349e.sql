-- Step 1: Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('superadmin', 'manager', 'member');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Step 3: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create the has_role SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 5: Create a function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'superadmin' THEN 1 
      WHEN 'manager' THEN 2 
      WHEN 'member' THEN 3 
    END
  LIMIT 1
$$;

-- Step 6: Migrate existing roles from profiles to user_roles (ONLY for users that exist in auth.users)
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.role::text::app_role
FROM public.profiles p
INNER JOIN auth.users u ON p.id = u.id
WHERE p.deleted_at IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 7: Create RLS policies for user_roles table
CREATE POLICY "user_roles_select_superadmin" ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_roles_insert_superadmin" ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "user_roles_update_superadmin" ON public.user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "user_roles_delete_superadmin" ON public.user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Step 8: Update RLS policies on profiles to use has_role function
DROP POLICY IF EXISTS "profiles_select_superadmin" ON public.profiles;
CREATE POLICY "profiles_select_superadmin" ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'superadmin') 
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "profiles_select_managers" ON public.profiles;
CREATE POLICY "profiles_select_managers" ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'manager')
    AND department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin')
    OR (
      public.has_role(auth.uid(), 'manager')
      AND role = 'member'
      AND department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'superadmin')
    OR (
      public.has_role(auth.uid(), 'manager')
      AND role = 'member'
      AND department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL
      )
    )
  );

-- Step 9: Update RLS policies on daily_standups to use has_role function
DROP POLICY IF EXISTS "standups_select_policy" ON public.daily_standups;
CREATE POLICY "standups_select_policy" ON public.daily_standups
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'superadmin')
      OR (
        public.has_role(auth.uid(), 'manager')
        AND user_id IN (
          SELECT id FROM profiles
          WHERE department_id = (SELECT department_id FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL)
          AND deleted_at IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "standups_insert_policy" ON public.daily_standups;
CREATE POLICY "standups_insert_policy" ON public.daily_standups
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(), 'member')
  );

DROP POLICY IF EXISTS "standups_update_policy" ON public.daily_standups;
CREATE POLICY "standups_update_policy" ON public.daily_standups
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'superadmin')
  );

-- Step 10: Update RLS policies on leave_requests to use has_role function
DROP POLICY IF EXISTS "leave_select_policy" ON public.leave_requests;
CREATE POLICY "leave_select_policy" ON public.leave_requests
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'superadmin')
      OR (
        public.has_role(auth.uid(), 'manager')
        AND user_id IN (
          SELECT id FROM profiles
          WHERE department_id = (SELECT department_id FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL)
          AND deleted_at IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "leave_update_policy" ON public.leave_requests;
CREATE POLICY "leave_update_policy" ON public.leave_requests
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'superadmin')
      OR (
        public.has_role(auth.uid(), 'manager')
        AND user_id IN (
          SELECT id FROM profiles
          WHERE department_id = (SELECT department_id FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL)
          AND deleted_at IS NULL
        )
      )
    )
  );

-- Step 11: Update RLS policies on departments to use has_role function
DROP POLICY IF EXISTS "departments_modify_policy" ON public.departments;
CREATE POLICY "departments_modify_policy" ON public.departments
  FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Step 12: Update RLS policies on audit_logs to use has_role function
DROP POLICY IF EXISTS "audit_select_policy" ON public.audit_logs;
CREATE POLICY "audit_select_policy" ON public.audit_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Step 13: Update RLS policies on roles table to use has_role function
DROP POLICY IF EXISTS "roles_modify_superadmin" ON public.roles;
CREATE POLICY "roles_modify_superadmin" ON public.roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Step 14: Update RLS policies on deliverables to use has_role function
DROP POLICY IF EXISTS "Admins and Managers can view all deliverables" ON public.deliverables;
CREATE POLICY "deliverables_select_admin_manager" ON public.deliverables
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Step 15: Update handle_new_user function to also insert into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
BEGIN
  -- Determine the role
  user_role_value := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'member');
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name, role, department_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    user_role_value,
    (NEW.raw_user_meta_data->>'department_id')::uuid
  );
  
  -- Also insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value::text::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;