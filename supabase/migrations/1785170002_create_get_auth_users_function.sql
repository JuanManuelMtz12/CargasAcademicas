-- Función para obtener usuarios de auth.users de manera segura
-- Esta función permite al frontend acceder a información básica de usuarios

CREATE OR REPLACE FUNCTION get_auth_users()
RETURNS TABLE (
  id uuid,
  email text,
  user_metadata jsonb,
  created_at timestamptz,
  last_sign_in_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario actual es administrador
  IF NOT auth.jwt() ->> 'email' = 'admin@upn.mx' THEN
    RAISE EXCEPTION 'No autorizado para acceder a la información de usuarios';
  END IF;
  
  -- Devolver información básica de usuarios
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data as user_metadata,
    au.created_at,
    au.last_sign_in_at
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;