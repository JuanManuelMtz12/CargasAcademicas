-- Función RPC para eliminar usuarios
CREATE OR REPLACE FUNCTION delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
  user_role text;
BEGIN
  -- Verificar que el usuario actual es administrador
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
  END IF;
  
  IF user_email != 'admin@upn.mx' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado para eliminar usuarios');
  END IF;
  
  -- Verificar que el usuario a eliminar no es el admin principal
  SELECT email, raw_user_meta_data->>'role' 
  INTO user_email, user_role
  FROM auth.users 
  WHERE id = p_user_id;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;
  
  IF user_email = 'admin@upn.mx' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede eliminar el administrador principal');
  END IF;
  
  -- Eliminar permisos de módulos
  DELETE FROM user_module_permissions WHERE user_id = p_user_id;
  
  -- Eliminar acceso a programas
  DELETE FROM user_program_access WHERE user_id = p_user_id;
  
  -- Eliminar usuario de auth.users
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado correctamente');
END;
$$;

-- Función RPC para actualizar permisos de usuario
CREATE OR REPLACE FUNCTION update_user_permissions(
  p_user_id uuid,
  p_module_permissions jsonb,
  p_program_ids text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_email text;
  permissions_array jsonb;
  program_id text;
  perm_record RECORD;
BEGIN
  -- Verificar que el usuario actual es administrador
  SELECT email INTO current_user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  IF current_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
  END IF;
  
  IF current_user_email != 'admin@upn.mx' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado para actualizar permisos');
  END IF;
  
  -- Eliminar permisos existentes
  DELETE FROM user_module_permissions WHERE user_id = p_user_id;
  DELETE FROM user_program_access WHERE user_id = p_user_id;
  
  -- Insertar nuevos permisos de módulos
  FOR perm_record IN 
    SELECT 
      (perm->>'module_name')::text as module_name,
      (perm->>'can_view')::boolean as can_view,
      (perm->>'can_create')::boolean as can_create,
      (perm->>'can_edit')::boolean as can_edit,
      (perm->>'can_delete')::boolean as can_delete
    FROM jsonb_array_elements(p_module_permissions) perm
  LOOP
    INSERT INTO user_module_permissions (
      user_id, module_name, can_view, can_create, can_edit, can_delete
    ) VALUES (
      p_user_id, perm_record.module_name, perm_record.can_view, 
      perm_record.can_create, perm_record.can_edit, perm_record.can_delete
    );
  END LOOP;
  
  -- Insertar acceso a programas
  FOREACH program_id IN ARRAY p_program_ids
  LOOP
    INSERT INTO user_program_access (user_id, program_id) 
    VALUES (p_user_id, program_id);
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'message', 'Permisos actualizados correctamente');
END;
$$;

-- Función RPC para crear usuario con permisos
CREATE OR REPLACE FUNCTION create_user_with_permissions(
  p_email text,
  p_password text,
  p_role text,
  p_module_permissions jsonb DEFAULT '{}',
  p_program_ids text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
  current_user_email text;
  perm_record RECORD;
  program_id text;
BEGIN
  -- Verificar que el usuario actual es administrador
  SELECT email INTO current_user_email 
  FROM auth.users 
  WHERE id = auth.uid();
  
  IF current_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
  END IF;
  
  IF current_user_email != 'admin@upn.mx' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado para crear usuarios');
  END IF;
  
  -- Crear usuario en auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('role', p_role),
    NOW(),
    NOW(),
    '',
    ''
  ) RETURNING id INTO user_id;
  
  -- Insertar permisos de módulos
  FOR perm_record IN 
    SELECT 
      (perm->>'module_name')::text as module_name,
      (perm->>'can_view')::boolean as can_view,
      (perm->>'can_create')::boolean as can_create,
      (perm->>'can_edit')::boolean as can_edit,
      (perm->>'can_delete')::boolean as can_delete
    FROM jsonb_array_elements(p_module_permissions) perm
  LOOP
    INSERT INTO user_module_permissions (
      user_id, module_name, can_view, can_create, can_edit, can_delete
    ) VALUES (
      user_id, perm_record.module_name, perm_record.can_view, 
      perm_record.can_create, perm_record.can_edit, perm_record.can_delete
    );
  END LOOP;
  
  -- Insertar acceso a programas
  FOREACH program_id IN ARRAY p_program_ids
  LOOP
    INSERT INTO user_program_access (user_id, program_id) 
    VALUES (user_id, program_id);
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'message', 'Usuario creado correctamente', 'user_id', user_id);
END;
$$;