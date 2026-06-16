-- Migration: enable_realtime_on_all_tables
-- Created at: 1760247036

-- Habilitar Realtime para sincronización automática de datos en tiempo real
-- Esta migración activa la replicación en tiempo real para todas las tablas del sistema

-- Habilitar Realtime en tabla teachers
ALTER PUBLICATION supabase_realtime ADD TABLE teachers;

-- Habilitar Realtime en tabla subjects
ALTER PUBLICATION supabase_realtime ADD TABLE subjects;

-- Habilitar Realtime en tabla programs
ALTER PUBLICATION supabase_realtime ADD TABLE programs;

-- Habilitar Realtime en tabla groups
ALTER PUBLICATION supabase_realtime ADD TABLE groups;

-- Habilitar Realtime en tabla school_cycles
ALTER PUBLICATION supabase_realtime ADD TABLE school_cycles;

-- Habilitar Realtime en tabla schedule
ALTER PUBLICATION supabase_realtime ADD TABLE schedule;

-- Habilitar Realtime en tabla modules
ALTER PUBLICATION supabase_realtime ADD TABLE modules;

-- Habilitar Realtime en tabla availability
ALTER PUBLICATION supabase_realtime ADD TABLE availability;

-- Habilitar Realtime en tabla teacher_program (para actualizar conteos en ProgramasPage)
ALTER PUBLICATION supabase_realtime ADD TABLE teacher_program;

-- Habilitar Realtime en tabla categories (por si se actualiza desde otro lugar)
ALTER PUBLICATION supabase_realtime ADD TABLE categories;

-- Comentario explicativo
COMMENT ON PUBLICATION supabase_realtime IS 'Publicación Realtime para sincronización automática de datos en el frontend';;