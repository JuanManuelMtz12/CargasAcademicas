-- Migration: cleanup_duplicate_schedules
-- Created at: 1760247036

-- Limpiar horarios duplicados causados por bug de Realtime + loadSchedules()
-- Eliminar horarios duplicados, conservando el mas reciente
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY teacher_id, subject_id, group_id, day, start_hour, end_hour, school_cycle_id 
      ORDER BY created_at DESC
    ) as rn
  FROM schedule
)
DELETE FROM schedule
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);;