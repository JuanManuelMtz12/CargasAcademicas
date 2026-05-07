-- Migration: create_permission_tables
-- Created at: 1785169860
-- Description: Crear tablas de permisos de usuario y acceso a programas

-- Crear tabla para permisos de módulos por usuario
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_name TEXT NOT NULL,
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, module_name)
);

-- Crear tabla para acceso a programas por usuario
CREATE TABLE IF NOT EXISTS public.user_program_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, program_id)
);

-- Habilitar RLS en ambas tablas
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_program_access ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_module_permissions
-- Admins pueden hacer todo
CREATE POLICY "Admins can manage all module permissions"
ON public.user_module_permissions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Coordinadores pueden ver sus propios permisos
CREATE POLICY "Coordinators can view own module permissions"
ON public.user_module_permissions FOR SELECT
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Políticas RLS para user_program_access
-- Admins pueden hacer todo
CREATE POLICY "Admins can manage all program access"
ON public.user_program_access FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Usuarios pueden ver su propio acceso a programas
CREATE POLICY "Users can view own program access"
ON public.user_program_access FOR SELECT
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);