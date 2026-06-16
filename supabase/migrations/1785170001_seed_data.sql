-- Migración para poblar datos iniciales del sistema
-- Versión 2.0 - Datos iniciales

-- Insertar módulos básicos del sistema
INSERT INTO public.user_module_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete) VALUES
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'dashboard', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'programas', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'maestros', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'grupos', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'materias', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'usuarios', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'calendario', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'reportes', true, true, true, true),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 'configuracion', true, true, true, true)
ON CONFLICT (user_id, module_name) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

-- Insertar programas por defecto
INSERT INTO public.user_program_access (user_id, program_id) VALUES
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 1),
(8694c64a-2890-4ae7-974a-4ec0cda030b4, 2)
ON CONFLICT (user_id, program_id) DO NOTHING;

-- Crear usuario coordinador de ejemplo
INSERT INTO public.users (id, email, nombre_completo, role, created_at, updated_at) VALUES
('11111111-2222-3333-4444-555555555555', 'coordinador@upn.mx', 'Coordinador Ejemplo', 'coordinador', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  nombre_completo = EXCLUDED.nombre_completo,
  role = EXCLUDED.role;

-- Aplicar plantilla de permisos al coordinador
SELECT public.apply_permission_template('11111111-2222-3333-4444-555555555555', 'coordinador');

-- Insertar acceso a programas para el coordinador
INSERT INTO public.user_program_access (user_id, program_id) VALUES
('11111111-2222-3333-4444-555555555555', 1)
ON CONFLICT (user_id, program_id) DO NOTHING;

-- Insertar programas básicos si no existen
INSERT INTO public.programas (id, nombre, sede_id, created_at, updated_at) VALUES
(1, 'Administración Educativa', 1, NOW(), NOW()),
(2, 'Intervención Educativa', 1, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  updated_at = NOW();

-- Insertar sedes básicas si no existen
INSERT INTO public.sedes (id, nombre, direccion, created_at, updated_at) VALUES
(1, 'UPN Puebla', 'Av. Universidad 1200, Col. Santa María', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  updated_at = NOW();

-- Actualizar contador de permisos en users
UPDATE public.users 
SET permisos_contador = (
  SELECT COUNT(*) 
  FROM public.user_module_permissions 
  WHERE user_id = public.users.id
)
WHERE id = '8694c64a-2890-4ae7-974a-4ec0cda030b4';