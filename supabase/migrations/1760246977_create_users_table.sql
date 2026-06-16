-- Migration: create_users_table
-- Created at: 1760246977

-- Crear tabla users en public para información adicional del usuario
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'coordinador')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver su propia información
CREATE POLICY "Users can view own data"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- Política: Solo admins pueden ver todos los usuarios
CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Política: Solo admins pueden insertar usuarios
CREATE POLICY "Admins can insert users"
ON public.users FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Política: Solo admins pueden actualizar usuarios
CREATE POLICY "Admins can update users"
ON public.users FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);;