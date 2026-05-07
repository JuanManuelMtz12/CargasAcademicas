-- Migration: fix_duplicates_and_add_normalized_constraint
-- Created at: 1760247015

-- Paso 1: Eliminar el constraint anterior si existe
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_name_category_unique;

-- Paso 2: Agregar columna generada temporal para versión normalizada del nombre
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS name_normalized TEXT 
GENERATED ALWAYS AS (
  LOWER(
    translate(
      name,
      'áéíóúÁÉÍÓÚñÑäëïöüÄËÏÖÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛãõÃÕ',
      'aeiouAEIOUnNaeiouAEIOUaeiouAEIOUaeiouAEIOUaoAO'
    )
  )
) STORED;

-- Paso 3: Eliminar duplicados (manteniendo el más antiguo)
-- Usamos la columna normalizada para identificar duplicados
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY name_normalized, category_id 
      ORDER BY created_at
    ) as rn
  FROM teachers
)
DELETE FROM teachers
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Paso 4: Crear índice único en la combinación de nombre normalizado + categoría
CREATE UNIQUE INDEX IF NOT EXISTS teachers_normalized_name_category_unique 
ON teachers (name_normalized, category_id);;