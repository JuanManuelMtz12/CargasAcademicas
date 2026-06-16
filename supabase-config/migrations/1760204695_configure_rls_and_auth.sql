-- Migration: configure_rls_and_auth
-- Created at: 1760204695

-- Habilitar RLS en todas las tablas
ALTER TABLE school_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

-- Función helper para verificar si el usuario está autenticado
CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función helper para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'role')::TEXT = 'admin',
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para school_cycles
CREATE POLICY "Usuarios autenticados pueden ver ciclos escolares"
  ON school_cycles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear ciclos escolares"
  ON school_cycles FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar ciclos escolares"
  ON school_cycles FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar ciclos escolares"
  ON school_cycles FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para categories (solo lectura para todos, admin para modificar)
CREATE POLICY "Usuarios autenticados pueden ver categorías"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden modificar categorías"
  ON categories FOR ALL
  TO authenticated
  USING (auth.is_admin());

-- Políticas para sedes
CREATE POLICY "Usuarios autenticados pueden ver sedes"
  ON sedes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear sedes"
  ON sedes FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar sedes"
  ON sedes FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar sedes"
  ON sedes FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para teachers
CREATE POLICY "Usuarios autenticados pueden ver maestros"
  ON teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear maestros"
  ON teachers FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar maestros"
  ON teachers FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar maestros"
  ON teachers FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para programs
CREATE POLICY "Usuarios autenticados pueden ver programas"
  ON programs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear programas"
  ON programs FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar programas"
  ON programs FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar programas"
  ON programs FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para teacher_program
CREATE POLICY "Usuarios autenticados pueden ver asignaciones maestro-programa"
  ON teacher_program FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear asignaciones maestro-programa"
  ON teacher_program FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar asignaciones maestro-programa"
  ON teacher_program FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para groups
CREATE POLICY "Usuarios autenticados pueden ver grupos"
  ON groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear grupos"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar grupos"
  ON groups FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar grupos"
  ON groups FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para modules
CREATE POLICY "Usuarios autenticados pueden ver módulos"
  ON modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear módulos"
  ON modules FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar módulos"
  ON modules FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar módulos"
  ON modules FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para subjects
CREATE POLICY "Usuarios autenticados pueden ver materias"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear materias"
  ON subjects FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar materias"
  ON subjects FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar materias"
  ON subjects FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para schedule
CREATE POLICY "Usuarios autenticados pueden ver horarios"
  ON schedule FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear horarios"
  ON schedule FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar horarios"
  ON schedule FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar horarios"
  ON schedule FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Políticas para availability
CREATE POLICY "Usuarios autenticados pueden ver disponibilidad"
  ON availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear disponibilidad"
  ON availability FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Solo admins pueden actualizar disponibilidad"
  ON availability FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Solo admins pueden eliminar disponibilidad"
  ON availability FOR DELETE
  TO authenticated
  USING (auth.is_admin());;