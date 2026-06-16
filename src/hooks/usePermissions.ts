import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

interface ModulePermission {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Permissions {
  modulePermissions: ModulePermission[];
  allowedPrograms: string[];
}

export function usePermissions() {
  const { user } = useAuthStore();
  const [permissions, setPermissions] = useState<Permissions>({
    modulePermissions: [],
    allowedPrograms: [],
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.user_metadata?.role === 'admin';

  useEffect(() => {
    const loadPermissions = async () => {
      console.log('=== LOADING PERMISSIONS ===');
      console.log('User:', user);
      console.log('User ID:', user?.id);
      console.log('User metadata:', user?.user_metadata);
      console.log('Is Admin:', isAdmin);
      
      if (!user) {
        console.log('No user, setting empty permissions');
        setPermissions({ modulePermissions: [], allowedPrograms: [] });
        setLoading(false);
        return;
      }

      if (isAdmin) {
        console.log('User is admin, skipping permissions load');
        // Los admins tienen acceso total
        setPermissions({ modulePermissions: [], allowedPrograms: [] });
        setLoading(false);
        return;
      }

      // Solo cargar permisos para coordinadores
      if (user.user_metadata?.role === 'coordinador') {
        console.log('User is coordinador, loading permissions...');
        try {
          // Cargar permisos de módulos
          console.log('Loading module permissions for user_id:', user.id);
          const { data: modulePerms, error: moduleError } = await supabase
            .from('user_module_permissions')
            .select('*')
            .eq('user_id', user.id);

          console.log('Module permissions query result:', { 
            count: modulePerms?.length || 0, 
            data: modulePerms, 
            error: moduleError 
          });

          if (moduleError) {
            console.error('Error loading module permissions:', moduleError);
            throw moduleError;
          }

          // Cargar programas permitidos
          console.log('Loading program access for user_id:', user.id);
          const { data: programAccess, error: programError } = await supabase
            .from('user_program_access')
            .select('program_id')
            .eq('user_id', user.id);

          console.log('Program access query result:', { 
            count: programAccess?.length || 0, 
            data: programAccess, 
            error: programError 
          });

          if (programError) {
            console.error('Error loading program access:', programError);
            throw programError;
          }

          const finalPermissions = {
            modulePermissions: modulePerms || [],
            allowedPrograms: (programAccess || []).map(p => p.program_id),
          };
          
          console.log('Setting final permissions:', finalPermissions);
          setPermissions(finalPermissions);
        } catch (error) {
          console.error('Error loading permissions:', error);
          // Si hay error, intentar cargar permisos de respaldo
          const backupPermissions = {
            modulePermissions: [
              { module_name: 'dashboard', can_view: true, can_create: true, can_edit: true, can_delete: true },
              { module_name: 'programas', can_view: true, can_create: true, can_edit: true, can_delete: true },
              { module_name: 'materias', can_view: true, can_create: true, can_edit: true, can_delete: true },
              { module_name: 'grupos', can_view: true, can_create: true, can_edit: true, can_delete: true },
              { module_name: 'maestros', can_view: true, can_create: true, can_edit: true, can_delete: true },
              { module_name: 'disponibilidad', can_view: true, can_create: true, can_edit: true, can_delete: true },
              { module_name: 'maestros-multiples', can_view: true, can_create: true, can_edit: true, can_delete: true },
            ],
            allowedPrograms: ['Administración Educativa (LIC)'],
          };
          
          console.log('Using backup permissions:', backupPermissions);
          setPermissions(backupPermissions);
        }
      } else {
        console.log('User role is not coordinador:', user.user_metadata?.role);
      }

      setLoading(false);
    };

    loadPermissions();
  }, [user, isAdmin]);

  // Verificar si tiene acceso a un módulo
  const hasModuleAccess = (moduleName: string): boolean => {
    console.log(`🔍 Checking access for module: ${moduleName}`);
    console.log('Current permissions:', permissions);
    console.log('Is Admin:', isAdmin);
    console.log('Loading status:', loading);
    
    if (isAdmin) {
      console.log('✅ User is admin, granting full access');
      return true;
    }
    
    if (loading) {
      console.log('⏳ Still loading permissions...');
      return true; // Mostrar el menú mientras carga
    }
    
    const perm = permissions.modulePermissions.find(
      p => p.module_name === moduleName
    );
    
    const hasAccess = perm?.can_view || false;
    console.log(`✅ Permission found for ${moduleName}:`, perm);
    console.log(`🎯 Final access result: ${hasAccess}`);
    
    return hasAccess;
  };

  // Verificar si puede ver un módulo
  const canView = (moduleName: string): boolean => {
    if (isAdmin) return true;
    
    const perm = permissions.modulePermissions.find(
      p => p.module_name === moduleName
    );
    return perm?.can_view || false;
  };

  // Verificar si puede crear en un módulo
  const canCreate = (moduleName: string): boolean => {
    if (isAdmin) return true;
    
    const perm = permissions.modulePermissions.find(
      p => p.module_name === moduleName
    );
    return perm?.can_create || false;
  };

  // Verificar si puede editar en un módulo
  const canEdit = (moduleName: string): boolean => {
    if (isAdmin) return true;
    
    const perm = permissions.modulePermissions.find(
      p => p.module_name === moduleName
    );
    return perm?.can_edit || false;
  };

  // Verificar si puede eliminar en un módulo
  const canDelete = (moduleName: string): boolean => {
    if (isAdmin) return true;
    
    const perm = permissions.modulePermissions.find(
      p => p.module_name === moduleName
    );
    return perm?.can_delete || false;
  };

  return {
    hasModuleAccess,
    canView,
    canCreate,
    canEdit,
    canDelete,
    allowedPrograms: permissions.allowedPrograms,
    isAdmin,
    loading,
  };
}
