-- Script SQL para crear tablas del módulo Maestrías Sabatinas
-- Fecha: 2025-11-03
-- Sistema: UPN Académico

-- =========================================
-- TABLA: maestrias_sabado
-- =========================================
CREATE TABLE IF NOT EXISTS maestrias_sabado (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sede_id INTEGER REFERENCES sedes(id) ON DELETE SET NULL,
    coordinator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- TABLA: teacher_maestria_sabado
-- =========================================
CREATE TABLE IF NOT EXISTS teacher_maestria_sabado (
    id SERIAL PRIMARY KEY,
    maestria_id INTEGER REFERENCES maestrias_sabado(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(maestria_id, teacher_id)
);

-- =========================================
-- TABLA: maestria_sabado_schedule
-- =========================================
CREATE TABLE IF NOT EXISTS maestria_sabado_schedule (
    id SERIAL PRIMARY KEY,
    maestria_id INTEGER REFERENCES maestrias_sabado(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    day_of_week INTEGER DEFAULT 6 CHECK (day_of_week = 6),
    start_time TIME DEFAULT '09:00:00',
    end_time TIME DEFAULT '13:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- HABILITAR RLS
-- =========================================
ALTER TABLE maestrias_sabado ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_maestria_sabado ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestria_sabado_schedule ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLÍTICAS RLS: maestrias_sabado
-- =========================================
CREATE POLICY "Allow authenticated users to view maestrias_sabado"
    ON maestrias_sabado FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert maestrias_sabado"
    ON maestrias_sabado FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update maestrias_sabado"
    ON maestrias_sabado FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete maestrias_sabado"
    ON maestrias_sabado FOR DELETE
    TO authenticated
    USING (true);

-- =========================================
-- POLÍTICAS RLS: teacher_maestria_sabado
-- =========================================
CREATE POLICY "Allow authenticated users to view teacher_maestria_sabado"
    ON teacher_maestria_sabado FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert teacher_maestria_sabado"
    ON teacher_maestria_sabado FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update teacher_maestria_sabado"
    ON teacher_maestria_sabado FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete teacher_maestria_sabado"
    ON teacher_maestria_sabado FOR DELETE
    TO authenticated
    USING (true);

-- =========================================
-- POLÍTICAS RLS: maestria_sabado_schedule
-- =========================================
CREATE POLICY "Allow authenticated users to view maestria_sabado_schedule"
    ON maestria_sabado_schedule FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert maestria_sabado_schedule"
    ON maestria_sabado_schedule FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update maestria_sabado_schedule"
    ON maestria_sabado_schedule FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete maestria_sabado_schedule"
    ON maestria_sabado_schedule FOR DELETE
    TO authenticated
    USING (true);

-- =========================================
-- ÍNDICES PARA RENDIMIENTO
-- =========================================
CREATE INDEX IF NOT EXISTS idx_maestrias_sabado_sede ON maestrias_sabado(sede_id);
CREATE INDEX IF NOT EXISTS idx_maestrias_sabado_coordinator ON maestrias_sabado(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_teacher_maestria_sabado_maestria ON teacher_maestria_sabado(maestria_id);
CREATE INDEX IF NOT EXISTS idx_teacher_maestria_sabado_teacher ON teacher_maestria_sabado(teacher_id);
CREATE INDEX IF NOT EXISTS idx_maestria_sabado_schedule_maestria ON maestria_sabado_schedule(maestria_id);

-- =========================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =========================================
-- INSERT INTO maestrias_sabado (name, activo) VALUES
-- ('Maestría en Educación Básica', true),
-- ('Maestría en Gestión Educativa', true);
