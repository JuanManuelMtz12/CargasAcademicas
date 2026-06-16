-- Migration: prevent_duplicate_schedules
-- Created at: 1760247036

-- Primero, identificamos y eliminamos los duplicados usando ROW_NUMBER()
WITH ranked_schedules AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY teacher_id, subject_id, group_id, day, start_hour, end_hour, school_cycle_id 
      ORDER BY created_at ASC
    ) as row_num
  FROM schedule
)
DELETE FROM schedule
WHERE id IN (
  SELECT id 
  FROM ranked_schedules 
  WHERE row_num > 1
);

-- Crear constraint UNIQUE que previene horarios completamente duplicados
ALTER TABLE schedule
ADD CONSTRAINT schedule_unique_constraint
UNIQUE (teacher_id, subject_id, group_id, day, start_hour, end_hour, school_cycle_id);

-- Agregar comentario explicativo
COMMENT ON CONSTRAINT schedule_unique_constraint ON schedule IS
'Previene la creación de horarios completamente duplicados. Un horario es considerado duplicado si tiene el mismo maestro, materia, grupo, día, hora de inicio, hora de fin y ciclo escolar que otro horario existente. Este constraint asegura la integridad de los datos a nivel de base de datos.';;