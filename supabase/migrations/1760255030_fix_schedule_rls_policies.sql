-- Migration: fix_schedule_rls_policies
-- Descripción: Corrige las políticas RLS de la tabla schedule para permitir
-- que todos los usuarios autenticados puedan realizar operaciones CRUD

-- Eliminar políticas existentes de schedule
DROP POLICY IF EXISTS "select_schedule" ON schedule;
DROP POLICY IF EXISTS "insert_schedule" ON schedule;
DROP POLICY IF EXISTS "update_schedule" ON schedule;
DROP POLICY IF EXISTS "delete_schedule" ON schedule;

-- Crear nuevas políticas más permisivas
-- Todos los usuarios autenticados pueden ver los horarios
CREATE POLICY "schedule_select_policy" ON schedule
    FOR SELECT 
    TO authenticated
    USING (true);

-- Todos los usuarios autenticados pueden insertar horarios
CREATE POLICY "schedule_insert_policy" ON schedule
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Todos los usuarios autenticados pueden actualizar horarios
CREATE POLICY "schedule_update_policy" ON schedule
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Todos los usuarios autenticados pueden eliminar horarios
CREATE POLICY "schedule_delete_policy" ON schedule
    FOR DELETE
    TO authenticated
    USING (true);

-- Comentario explicativo
COMMENT ON TABLE schedule IS 'Tabla de horarios del sistema académico. Acceso completo para usuarios autenticados.';
