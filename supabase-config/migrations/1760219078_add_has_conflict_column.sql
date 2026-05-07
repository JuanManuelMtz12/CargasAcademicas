-- Migration: Agregar columna has_conflict a la tabla schedule
-- Propósito: Marcar permanentemente los horarios que tienen conflictos (empalmes)
-- Autor: MiniMax Agent
-- Fecha: 2025-10-12

-- Agregar columna has_conflict a la tabla schedule
ALTER TABLE public.schedule
ADD COLUMN IF NOT EXISTS has_conflict BOOLEAN DEFAULT false NOT NULL;

-- Agregar comentario a la columna para documentación
COMMENT ON COLUMN public.schedule.has_conflict IS 
'Indica si este horario tiene conflictos (empalmes) con otros horarios. True = tiene conflictos, False = sin conflictos';

-- Crear índice para mejorar el rendimiento de consultas que filtren por conflictos
CREATE INDEX IF NOT EXISTS idx_schedule_has_conflict 
ON public.schedule(has_conflict);

-- Actualizar horarios existentes: marcar como conflictivos si detectamos empalmes
-- Esta es una verificación inicial para datos ya existentes
UPDATE public.schedule s1
SET has_conflict = true
WHERE EXISTS (
  -- Buscar conflictos de maestro (mismo maestro en dos lugares al mismo tiempo)
  SELECT 1
  FROM public.schedule s2
  WHERE s2.id != s1.id
    AND s2.teacher_id = s1.teacher_id
    AND s2.day = s1.day
    AND s2.school_cycle_id = s1.school_cycle_id
    AND (
      (s2.start_hour >= s1.start_hour AND s2.start_hour < s1.end_hour)
      OR (s2.end_hour > s1.start_hour AND s2.end_hour <= s1.end_hour)
      OR (s2.start_hour <= s1.start_hour AND s2.end_hour >= s1.end_hour)
    )
)
OR EXISTS (
  -- Buscar conflictos de grupo (mismo grupo con dos materias al mismo tiempo)
  SELECT 1
  FROM public.schedule s3
  WHERE s3.id != s1.id
    AND s3.group_id = s1.group_id
    AND s3.day = s1.day
    AND s3.school_cycle_id = s1.school_cycle_id
    AND (
      (s3.start_hour >= s1.start_hour AND s3.start_hour < s1.end_hour)
      OR (s3.end_hour > s1.start_hour AND s3.end_hour <= s1.end_hour)
      OR (s3.start_hour <= s1.start_hour AND s3.end_hour >= s1.end_hour)
    )
);
