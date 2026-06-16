-- Migración: Simplificar tabla modules para usar solo nombre, grupo y sede

-- Paso 1: Verificar y eliminar restricciones foreign key existentes
DO $$ 
BEGIN
    -- Eliminar foreign key de program_id si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'modules_program_id_fkey' 
        AND table_name = 'modules'
    ) THEN
        ALTER TABLE modules DROP CONSTRAINT modules_program_id_fkey;
    END IF;

    -- Eliminar foreign key de maestria_sabatina_id si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'modules_maestria_sabatina_id_fkey' 
        AND table_name = 'modules'
    ) THEN
        ALTER TABLE modules DROP CONSTRAINT modules_maestria_sabatina_id_fkey;
    END IF;
END $$;

-- Paso 2: Eliminar columnas antiguas
ALTER TABLE modules DROP COLUMN IF EXISTS program_id;
ALTER TABLE modules DROP COLUMN IF EXISTS maestria_sabatina_id;
ALTER TABLE modules DROP COLUMN IF EXISTS order_num;

-- Paso 3: Agregar nuevas columnas
ALTER TABLE modules ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS sede_id uuid;

-- Paso 4: Crear foreign keys para las nuevas columnas
ALTER TABLE modules 
  ADD CONSTRAINT modules_group_id_fkey 
  FOREIGN KEY (group_id) 
  REFERENCES groups(id) 
  ON DELETE CASCADE;

ALTER TABLE modules 
  ADD CONSTRAINT modules_sede_id_fkey 
  FOREIGN KEY (sede_id) 
  REFERENCES sedes(id) 
  ON DELETE CASCADE;

-- Paso 5: Hacer NOT NULL las nuevas columnas (después de que haya datos)
-- Comentado porque primero necesitamos migrar datos existentes
-- ALTER TABLE modules ALTER COLUMN group_id SET NOT NULL;
-- ALTER TABLE modules ALTER COLUMN sede_id SET NOT NULL;

-- Paso 6: Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS modules_group_id_idx ON modules(group_id);
CREATE INDEX IF NOT EXISTS modules_sede_id_idx ON modules(sede_id);

-- Comentario: Los registros existentes quedarán con group_id y sede_id NULL
-- Se recomienda limpiar la tabla o migrar los datos manualmente
