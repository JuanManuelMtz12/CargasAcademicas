-- Migración para nueva lógica de permisos jerárquica
-- Versión 2.0 - Sistema Senior Programmer

-- 1. Tabla de roles con jerarquía
CREATE TABLE IF NOT EXISTS public.user_roles_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  hierarchy_level INTEGER NOT NULL, -- 1=Admin, 2=Coordinador, 3=Maestro, 4=Invitado
  can_manage_users BOOLEAN DEFAULT false,
  can_manage_permissions BOOLEAN DEFAULT false,
  can_access_all_programs BOOLEAN DEFAULT false,
  max_programs_access INTEGER DEFAULT 1,
  allowed_modules TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insertar roles por defecto
INSERT INTO public.user_roles_hierarchy (role_name, hierarchy_level, can_manage_users, can_manage_permissions, can_access_all_programs, max_programs_access, allowed_modules) VALUES
('admin', 1, true, true, true, 999, ARRAY['dashboard', 'programas', 'maestros', 'grupos', 'materias', 'calendario', 'usuarios', 'reportes', 'configuracion']),
('coordinador', 2, false, true, false, 5, ARRAY['dashboard', 'programas', 'maestros', 'grupos', 'materias', 'calendario', 'reportes']),
('maestro', 3, false, false, false, 3, ARRAY['dashboard', 'grupos', 'materias', 'calendario']),
('invitado', 4, false, false, false, 1, ARRAY['dashboard']);

-- 3. Tabla de plantillas de permisos por rol
CREATE TABLE IF NOT EXISTS public.permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  role_hierarchy_id UUID REFERENCES public.user_roles_hierarchy(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_name, module_name)
);

-- 4. Insertar plantillas por defecto para cada rol
INSERT INTO public.permission_templates (template_name, role_hierarchy_id, module_name, can_view, can_create, can_edit, can_delete, is_default)
SELECT 
  hr.role_name,
  hr.id,
  module,
  CASE 
    WHEN hr.role_name = 'admin' THEN true
    WHEN hr.role_name = 'coordinador' AND module IN ('dashboard', 'programas', 'maestros', 'grupos', 'materias', 'calendario', 'reportes') THEN true
    WHEN hr.role_name = 'maestro' AND module IN ('dashboard', 'grupos', 'materias', 'calendario') THEN true
    WHEN hr.role_name = 'invitado' AND module = 'dashboard' THEN true
    ELSE false
  END as can_view,
  CASE 
    WHEN hr.role_name = 'admin' THEN true
    WHEN hr.role_name = 'coordinador' AND module IN ('programas', 'maestros', 'grupos', 'materias') THEN true
    WHEN hr.role_name = 'maestro' AND module IN ('grupos', 'materias') THEN true
    ELSE false
  END as can_create,
  CASE 
    WHEN hr.role_name = 'admin' THEN true
    WHEN hr.role_name = 'coordinador' AND module IN ('programas', 'maestros', 'grupos', 'materias') THEN true
    WHEN hr.role_name = 'maestro' AND module IN ('grupos', 'materias') THEN true
    ELSE false
  END as can_edit,
  CASE 
    WHEN hr.role_name = 'admin' THEN true
    WHEN hr.role_name = 'coordinador' AND module IN ('maestros', 'grupos') THEN true
    ELSE false
  END as can_delete,
  true as is_default
FROM public.user_roles_hierarchy hr
CROSS JOIN (
  VALUES 
    ('dashboard'), ('programas'), ('maestros'), ('grupos'), 
    ('materias'), ('calendario'), ('usuarios'), ('reportes'), ('configuracion')
) AS modules(module);

-- 5. Función para aplicar plantilla de permisos automáticamente
CREATE OR REPLACE FUNCTION public.apply_permission_template(user_uuid UUID, role_name TEXT)
RETURNS VOID AS $$
DECLARE
  template_permissions RECORD;
BEGIN
  -- Eliminar permisos existentes del usuario
  DELETE FROM public.user_module_permissions WHERE user_id = user_uuid;
  
  -- Insertar permisos según la plantilla del rol
  INSERT INTO public.user_module_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete)
  SELECT 
    user_uuid,
    pt.module_name,
    pt.can_view,
    pt.can_create,
    pt.can_edit,
    pt.can_delete
  FROM public.permission_templates pt
  JOIN public.user_roles_hierarchy urh ON pt.role_hierarchy_id = urh.id
  WHERE urh.role_name = role_name AND pt.is_default = true;
  
  RAISE NOTICE 'Plantilla de permisos aplicada para usuario % con rol %', user_uuid, role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función para validar permisos antes de insertar
CREATE OR REPLACE FUNCTION public.validate_user_permissions(user_uuid UUID, requested_permissions JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  hierarchy_level INTEGER;
  module_name TEXT;
  perm_record RECORD;
BEGIN
  -- Obtener rol del usuario
  SELECT role INTO user_role 
  FROM public.users 
  WHERE id = user_uuid;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  
  -- Obtener nivel jerárquico
  SELECT hierarchy_level INTO hierarchy_level
  FROM public.user_roles_hierarchy
  WHERE role_name = user_role;
  
  -- Validar cada permiso solicitado
  FOR perm_record IN SELECT * FROM jsonb_to_recordset(requested_permissions) AS x(module_name TEXT, can_view BOOLEAN, can_create BOOLEAN, can_edit BOOLEAN, can_delete BOOLEAN)
  LOOP
    module_name := perm_record.module_name;
    
    -- Validar que el rol puede acceder a este módulo
    IF NOT EXISTS (
      SELECT 1 FROM public.permission_templates pt
      JOIN public.user_roles_hierarchy urh ON pt.role_hierarchy_id = urh.id
      WHERE urh.role_name = user_role AND pt.module_name = module_name AND pt.can_view = true
    ) THEN
      RAISE EXCEPTION 'Rol % no tiene acceso al módulo %', user_role, module_name;
    END IF;
    
    -- Para coordinadores y maestros, validar límites de permisos
    IF hierarchy_level > 1 THEN
      -- Solo pueden tener permisos que están en su plantilla
      IF NOT EXISTS (
        SELECT 1 FROM public.permission_templates pt
        JOIN public.user_roles_hierarchy urh ON pt.role_hierarchy_id = urh.id
        WHERE urh.role_name = user_role 
        AND pt.module_name = module_name
        AND (pt.can_create = perm_record.can_create OR NOT perm_record.can_create)
        AND (pt.can_edit = perm_record.can_edit OR NOT perm_record.can_edit)
        AND (pt.can_delete = perm_record.can_delete OR NOT perm_record.can_delete)
      ) THEN
        RAISE EXCEPTION 'Permisos solicitados para módulo % exceden los límites del rol %', module_name, user_role;
      END IF;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger para aplicar automáticamente plantilla al crear usuario coordinador
CREATE OR REPLACE FUNCTION public.auto_apply_coordinator_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'coordinador' THEN
    PERFORM public.apply_permission_template(NEW.id, 'coordinador');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_apply_coordinator_template ON public.users;
CREATE TRIGGER trigger_auto_apply_coordinator_template
  AFTER INSERT OR UPDATE ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'coordinador')
  EXECUTE FUNCTION public.auto_apply_coordinator_template();

-- 8. Función para auditoría de cambios de permisos
CREATE TABLE IF NOT EXISTS public.permissions_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  admin_user_id UUID,
  old_permissions JSONB,
  new_permissions JSONB,
  change_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- 9. Función para logging de cambios
CREATE OR REPLACE FUNCTION public.log_permissions_change(
  target_user_id UUID,
  admin_user_id UUID,
  old_perms JSONB,
  new_perms JSONB,
  change_type TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.permissions_audit_log (
    user_id, admin_user_id, old_permissions, new_permissions, change_type
  ) VALUES (
    target_user_id, admin_user_id, old_perms, new_perms, change_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Políticas RLS mejoradas
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_program_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_templates ENABLE ROW LEVEL SECURITY;

-- Políticas para roles jerárquicos
CREATE POLICY "Admins can manage all permissions"
  ON public.user_module_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles_hierarchy urh ON u.role = urh.role_name
      WHERE u.id = auth.uid() AND urh.hierarchy_level = 1
    )
  );

CREATE POLICY "Coordinators can view own permissions"
  ON public.user_module_permissions FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles_hierarchy urh ON u.role = urh.role_name
      WHERE u.id = auth.uid() AND urh.hierarchy_level = 1
    )
  );

CREATE POLICY "All users can read role hierarchy"
  ON public.user_roles_hierarchy FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage templates"
  ON public.permission_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles_hierarchy urh ON u.role = urh.role_name
      WHERE u.id = auth.uid() AND urh.hierarchy_level = 1
    )
  );