-- Migration: create_all_school_tables
-- Created at: 1760246923

-- Tabla de Ciclos Escolares
CREATE TABLE school_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    cycle_type TEXT NOT NULL CHECK (cycle_type IN ('LIC', 'LEIP', 'MAE-MS', 'MAE-B')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Categorías de Maestros
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('BASE', 'INVITADO', 'INTERINO')),
    subcategory TEXT CHECK (subcategory IN ('TC', 'MT', 'HC') OR subcategory IS NULL),
    max_hours_week INTEGER NOT NULL,
    UNIQUE(category, subcategory),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Sedes
CREATE TABLE sedes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Maestros
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Programas (Licenciaturas y Maestrías)
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('LIC', 'LEIP', 'MAE')),
    coordinator_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL,
    especialidad TEXT CHECK (especialidad IN ('Media Superior', 'Básica') OR especialidad IS NULL),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Relación Maestros-Programas (muchos a muchos)
CREATE TABLE teacher_program (
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(teacher_id, program_id)
);

-- Tabla de Grupos
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Módulos (para programas LEIP y Maestrías)
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_num INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Materias
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    clave TEXT NOT NULL,
    name TEXT NOT NULL,
    credits INTEGER,
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Horarios
CREATE TABLE schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    day TEXT NOT NULL CHECK (day IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado')),
    start_hour INTEGER NOT NULL CHECK (start_hour >= 7 AND start_hour <= 22),
    end_hour INTEGER NOT NULL CHECK (end_hour >= 8 AND end_hour <= 23),
    school_cycle_id UUID REFERENCES school_cycles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (start_hour < end_hour)
);

-- Tabla de Disponibilidad de Maestros (NO disponibles)
CREATE TABLE availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    day TEXT NOT NULL CHECK (day IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado')),
    start_hour INTEGER NOT NULL CHECK (start_hour >= 7 AND start_hour <= 22),
    end_hour INTEGER NOT NULL CHECK (end_hour >= 8 AND end_hour <= 23),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (start_hour < end_hour)
);

-- Insertar datos iniciales de categorías
INSERT INTO categories (category, subcategory, max_hours_week) VALUES
    ('BASE', 'TC', 18),
    ('BASE', 'MT', 12),
    ('INVITADO', NULL, 22),
    ('INTERINO', 'HC', 20);

-- Insertar datos iniciales de sedes
INSERT INTO sedes (name) VALUES
    ('Hueyapan'),
    ('Victoria'),
    ('Ayotoxco'),
    ('Teziutlan'),
    ('Huehuetla'),
    ('Zapotitlan');

-- Crear índices para optimizar consultas
CREATE INDEX idx_schedule_teacher ON schedule(teacher_id);
CREATE INDEX idx_schedule_subject ON schedule(subject_id);
CREATE INDEX idx_schedule_group ON schedule(group_id);
CREATE INDEX idx_schedule_cycle ON schedule(school_cycle_id);
CREATE INDEX idx_schedule_day ON schedule(day);
CREATE INDEX idx_teacher_program_teacher ON teacher_program(teacher_id);
CREATE INDEX idx_teacher_program_program ON teacher_program(program_id);
CREATE INDEX idx_subjects_program ON subjects(program_id);
CREATE INDEX idx_modules_program ON modules(program_id);;