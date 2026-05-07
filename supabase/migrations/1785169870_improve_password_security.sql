-- Migration: improve_password_security
-- Created at: 1785169870
-- Description: Mejorar seguridad de contraseñas y validaciones

-- Crear función para validar fortaleza de contraseña
CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS boolean AS $$
BEGIN
    -- La contraseña debe tener al menos 8 caracteres
    -- Al menos una letra mayúscula, una letra minúscula, un número y un carácter especial
    RETURN (
        LENGTH(password) >= 8 AND
        password ~ '[A-Z]' AND
        password ~ '[a-z]' AND
        password ~ '[0-9]' AND
        password ~ '[!@#$%^&*()_+\-=\[\]{};'':"\\|,.<>\/?]'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear función para obtener módulos disponibles
CREATE OR REPLACE FUNCTION public.get_available_modules()
RETURNS TABLE(module_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT unnest(ARRAY['Dashboard', 'Programas', 'Maestros', 'Maestros Múltiples', 'Materias', 'Módulos', 'Grupos', 'Disponibilidad'])::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear función para verificar permisos de usuario
CREATE OR REPLACE FUNCTION public.check_user_permission(user_id_param uuid, module_name_param text, action_param text)
RETURNS boolean AS $$
DECLARE
    user_role text;
BEGIN
    -- Obtener rol del usuario
    SELECT role INTO user_role FROM public.users WHERE id = user_id_param;
    
    -- Si es admin, tiene todos los permisos
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Si es coordinador, verificar permisos específicos
    IF user_role = 'coordinador' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.user_module_permissions
            WHERE user_id = user_id_param 
            AND module_name = module_name_param
            AND CASE 
                WHEN action_param = 'view' THEN can_view
                WHEN action_param = 'create' THEN can_create
                WHEN action_param = 'edit' THEN can_edit
                WHEN action_param = 'delete' THEN can_delete
                ELSE false
            END
        );
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;