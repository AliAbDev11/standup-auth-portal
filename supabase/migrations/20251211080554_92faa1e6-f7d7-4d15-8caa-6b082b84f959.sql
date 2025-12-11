-- Fix mutable search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix mutable search_path for soft_delete_user function
CREATE OR REPLACE FUNCTION public.soft_delete_user(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.profiles
  SET 
    deleted_at = NOW(),
    deleted_by = auth.uid(),
    is_active = false
  WHERE id = user_id_param AND deleted_at IS NULL;
  
  -- Log the deletion
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'soft_deleted',
    'user',
    user_id_param,
    jsonb_build_object('deleted_at', NOW())
  );
END;
$function$;

-- Fix mutable search_path for restore_user function
CREATE OR REPLACE FUNCTION public.restore_user(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.profiles
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    is_active = true
  WHERE id = user_id_param AND deleted_at IS NOT NULL;
  
  -- Log the restoration
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'restored',
    'user',
    user_id_param,
    jsonb_build_object('restored_at', NOW())
  );
END;
$function$;