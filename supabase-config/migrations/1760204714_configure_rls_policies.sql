-- Migration: configure_rls_policies
-- Created at: 1760204714

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

-- Función helper para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (auth.jwt() -> 'user_metadata' ->> 'role')::TEXT = 'admin'),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para school_cycles
CREATE POLICY "select_school_cycles" ON school_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_school_cycles" ON school_cycles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_school_cycles" ON school_cycles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_school_cycles" ON school_cycles FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para categories
CREATE POLICY "select_categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "all_categories" ON categories FOR ALL TO authenticated USING (public.is_admin());

-- Políticas para sedes
CREATE POLICY "select_sedes" ON sedes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sedes" ON sedes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_sedes" ON sedes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_sedes" ON sedes FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para teachers
CREATE POLICY "select_teachers" ON teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_teachers" ON teachers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_teachers" ON teachers FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_teachers" ON teachers FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para programs
CREATE POLICY "select_programs" ON programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_programs" ON programs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_programs" ON programs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_programs" ON programs FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para teacher_program
CREATE POLICY "select_teacher_program" ON teacher_program FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_teacher_program" ON teacher_program FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "delete_teacher_program" ON teacher_program FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para groups
CREATE POLICY "select_groups" ON groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_groups" ON groups FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_groups" ON groups FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_groups" ON groups FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para modules
CREATE POLICY "select_modules" ON modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_modules" ON modules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_modules" ON modules FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_modules" ON modules FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para subjects
CREATE POLICY "select_subjects" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_subjects" ON subjects FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_subjects" ON subjects FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_subjects" ON subjects FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para schedule
CREATE POLICY "select_schedule" ON schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_schedule" ON schedule FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_schedule" ON schedule FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_schedule" ON schedule FOR DELETE TO authenticated USING (public.is_admin());

-- Políticas para availability
CREATE POLICY "select_availability" ON availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_availability" ON availability FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "update_availability" ON availability FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "delete_availability" ON availability FOR DELETE TO authenticated USING (public.is_admin());;