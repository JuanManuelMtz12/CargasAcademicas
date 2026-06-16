-- Habilitar pgcrypto si no está habilitado
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función corregida para crear usuario con permisos
-- Reemplaza la versión anterior que tenía lógica incorrecta (buscaba en lugar de crear)
CREATE OR REPLACE FUNCTION create_user_with_permissions(
  p_email text,
  p_password text,
  p_role text,
  p_module_permissions jsonb DEFAULT '[]',
  p_program_ids text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  new_user_id uuid;
  perm_record RECORD;
  prog_id text;
BEGIN
  -- Validar que el usuario que llama es admin
  IF (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
  END IF;

  -- Validar que el email no exista ya
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya existe un usuario con ese correo');
  END IF;

  -- Generar UUID para el nuevo usuario
  new_user_id := gen_random_uuid();

  -- Insertar en auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_sso_user,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('role', p_role),
    false,
    false,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Insertar en auth.identities (necesario para login por email)
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id::text,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email),
    'email',
    now(),
    now(),
    now()
  );

  -- Insertar en public.users
  INSERT INTO public.users (id, username, first_name, last_name, role)
  VALUES (
    new_user_id,
    split_part(p_email, '@', 1),
    split_part(p_email, '@', 1),
    '',
    p_role
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insertar permisos de módulos
  FOR perm_record IN
    SELECT
      (perm->>'module_name')::text  AS module_name,
      (perm->>'can_view')::boolean  AS can_view,
      (perm->>'can_create')::boolean AS can_create,
      (perm->>'can_edit')::boolean  AS can_edit,
      (perm->>'can_delete')::boolean AS can_delete
    FROM jsonb_array_elements(p_module_permissions) AS perm
  LOOP
    INSERT INTO user_module_permissions (
      user_id, module_name, can_view, can_create, can_edit, can_delete
    ) VALUES (
      new_user_id,
      perm_record.module_name,
      perm_record.can_view,
      perm_record.can_create,
      perm_record.can_edit,
      perm_record.can_delete
    );
  END LOOP;

  -- Insertar acceso a programas
  FOREACH prog_id IN ARRAY p_program_ids
  LOOP
    INSERT INTO user_program_access (user_id, program_id)
    VALUES (new_user_id, prog_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Usuario creado correctamente',
    'user_id', new_user_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
