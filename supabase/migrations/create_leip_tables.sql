-- =====================================================
-- MIGRACIÓN: Tablas para Módulo Programas LEIP
-- Descripción: Sistema de gestión de programas LEIP (sabatinos 9am-1pm)
-- Fecha: 2025-11-04
-- =====================================================

-- 1. Tabla de Programas LEIP
-- Programas sabatinos sin campo 'type' ni 'especialidad'
CREATE TABLE leip_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    coordinator_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Relación Maestros-Programas LEIP (muchos a muchos)
CREATE TABLE teacher_leip_program (
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    leip_program_id UUID NOT NULL REFERENCES leip_programs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(teacher_id, leip_program_id)
);

-- 3. Tabla de Módulos LEIP
-- Módulos asociados a cada programa LEIP
CREATE TABLE leip_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leip_program_id UUID NOT NULL REFERENCES leip_programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_num INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Grupos LEIP
-- Grupos para organización de estudiantes LEIP
CREATE TABLE leip_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    leip_module_id UUID REFERENCES leip_modules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Materias LEIP
-- Materias con módulo asociado (SIN campo credits)
CREATE TABLE leip_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leip_program_id UUID NOT NULL REFERENCES leip_programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    module_name TEXT NOT NULL,
    leip_module_id UUID REFERENCES leip_modules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de Horarios LEIP
-- Horarios sabatinos (9am-1pm típicamente)
CREATE TABLE leip_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    leip_subject_id UUID NOT NULL REFERENCES leip_subjects(id) ON DELETE CASCADE,
    leip_group_id UUID NOT NULL REFERENCES leip_groups(id) ON DELETE CASCADE,
    day TEXT NOT NULL DEFAULT 'Sábado' CHECK (day = 'Sábado'),
    start_hour INTEGER NOT NULL DEFAULT 9 CHECK (start_hour >= 7 AND start_hour <= 22),
    end_hour INTEGER NOT NULL DEFAULT 13 CHECK (end_hour >= 8 AND end_hour <= 23),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (start_hour < end_hour)
);

-- 7. Tabla de Calendario Académico LEIP
-- Períodos académicos específicos para programas LEIP
CREATE TABLE leip_academic_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leip_program_id UUID NOT NULL REFERENCES leip_programs(id) ON DELETE CASCADE,
    module_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (start_date < end_date)
);

-- =====================================================
-- ÍNDICES para optimización de consultas
-- =====================================================

CREATE INDEX idx_leip_programs_coordinator ON leip_programs(coordinator_id);
CREATE INDEX idx_leip_programs_sede ON leip_programs(sede_id);
CREATE INDEX idx_teacher_leip_program_teacher ON teacher_leip_program(teacher_id);
CREATE INDEX idx_teacher_leip_program_program ON teacher_leip_program(leip_program_id);
CREATE INDEX idx_leip_modules_program ON leip_modules(leip_program_id);
CREATE INDEX idx_leip_groups_module ON leip_groups(leip_module_id);
CREATE INDEX idx_leip_subjects_program ON leip_subjects(leip_program_id);
CREATE INDEX idx_leip_subjects_module ON leip_subjects(leip_module_id);
CREATE INDEX idx_leip_schedule_teacher ON leip_schedule(teacher_id);
CREATE INDEX idx_leip_schedule_subject ON leip_schedule(leip_subject_id);
CREATE INDEX idx_leip_schedule_group ON leip_schedule(leip_group_id);
CREATE INDEX idx_leip_calendar_program ON leip_academic_calendar(leip_program_id);

-- =====================================================
-- COMENTARIOS para documentación
-- =====================================================

COMMENT ON TABLE leip_programs IS 'Programas académicos LEIP (sabatinos 9am-1pm)';
COMMENT ON TABLE teacher_leip_program IS 'Relación muchos a muchos entre maestros y programas LEIP';
COMMENT ON TABLE leip_modules IS 'Módulos académicos de programas LEIP';
COMMENT ON TABLE leip_groups IS 'Grupos de estudiantes para programas LEIP';
COMMENT ON TABLE leip_subjects IS 'Materias de programas LEIP con módulo asociado';
COMMENT ON TABLE leip_schedule IS 'Horarios sabatinos de clases LEIP';
COMMENT ON TABLE leip_academic_calendar IS 'Calendario académico de programas LEIP';
