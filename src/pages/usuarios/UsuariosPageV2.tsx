import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, X, AlertCircle, CheckCircle, RefreshCw, Trash, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

// Configuración de timeout y reintentos
const API_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 segundos

// Módulos disponibles con validaciones de rol
const AVAILABLE_MODULES = [
  { id: 'dashboard', name: 'Dashboard', adminOnly: false },
  { id: 'ciclos', name: 'Ciclos Escolares', adminOnly: true },
  { id: 'programas', name: 'Programas', adminOnly: false },
  { id: 'materias', name: 'Materias', adminOnly: false },
  { id: 'grupos', name: 'Grupos', adminOnly: false },
  { id: 'maestros', name: 'Maestros', adminOnly: false },
  { id: 'categorias', name: 'Categorías', adminOnly: true },
  { id: 'sedes', name: 'Sedes', adminOnly: true },
  { id: 'disponibilidad', name: 'Disponibilidad', adminOnly: false },
  { id: 'maestros-multiples', name: 'Maestros Múltiples Prog.', adminOnly: false },
  { id: 'maestros-excedidos', name: 'Maestros Excedidos', adminOnly: true },
  { id: 'usuarios', name: 'Usuarios', adminOnly: true },
  { id: 'modulos', name: 'Módulos', adminOnly: true },
];

interface User {
  id: string;
  email: string;
  user_metadata: {
    role?: 'admin' | 'coordinador';
    [key: string]: any;
  };
  created_at: string;
  last_sign_in_at?: string;
}

interface ModulePermission {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Program {
  id: string;
  name: string;
  type: 'LIC' | 'LEIP' | 'MAE';
}

interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
}

function getDefaultCoordinatorPermissions(programType: string) {
  const view = (module_name: string) => ({
    module_name, can_view: true, can_create: false, can_edit: false, can_delete: false,
  });
  const manage = (module_name: string) => ({
    module_name, can_view: true, can_create: true, can_edit: true, can_delete: false,
  });

  const full = (module_name: string) => ({
    module_name, can_view: true, can_create: true, can_edit: true, can_delete: true,
  });

  const licPerms = [
    view('dashboard'),
    view('programas'),
    full('materias'),
    manage('grupos'),
    view('maestros'),
    manage('disponibilidad'),
    manage('maestros-multiples'),
  ];

  const leipPerms = [
    view('dashboard'),
    manage('programas-leip'),
    manage('materias-leip'),
    manage('cargas-academicas'),
    manage('maestros'),
    manage('disponibilidad'),
  ];

  if (programType === 'LIC') return licPerms;
  if (programType === 'LEIP') return leipPerms;
  return licPerms;
}

// Hook personalizado para API calls con reintentos
const useApiCall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const apiCall = useCallback(async (url: string, options: RequestInit, retryAttempt = 0): Promise<any> => {
    setIsLoading(true);
    setRetryCount(retryAttempt);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Error desconocido' } }));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setRetryCount(0);
      return data;

    } catch (error: any) {
      clearTimeout(timeoutId);

      // Si es un error de timeout o red y no hemos agotado los reintentos
      if ((error.name === 'AbortError' || error.message.includes('Failed to send')) && retryAttempt < MAX_RETRIES) {
        console.log(`Reintentando... intento ${retryAttempt + 1}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryAttempt + 1)));
        return apiCall(url, options, retryAttempt + 1);
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { apiCall, isLoading, retryCount };
};

export default function UsuariosPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [modulePermissions, setModulePermissions] = useState<{[key: string]: ModulePermission}>({});
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'coordinador'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'coordinador' as 'admin' | 'coordinador',
  });
  
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { apiCall, isLoading: isApiLoading } = useApiCall();

  // Función para validar coherencia de permisos
  const validatePermissionConsistency = useCallback((moduleId: string, permissions: ModulePermission) => {
    const errors = [];
    
    // Validar que si hay otros permisos, Ver esté habilitado
    if ((permissions.can_create || permissions.can_edit || permissions.can_delete) && !permissions.can_view) {
      errors.push(`El permiso "Ver" debe estar habilitado para asignar otros permisos en ${moduleId}`);
    }
    
    // Validar que no se pueden asignar permisos edit/delete sin create (lógica de negocio)
    if ((permissions.can_edit || permissions.can_delete) && !permissions.can_create) {
      errors.push(`No se recomienda asignar Editar/Eliminar sin Crear en ${moduleId}`);
    }
    
    return errors;
  }, []);

  // Función mejorada para validar permisos según rol
  const validateModuleForRole = useCallback((moduleId: string, role: 'admin' | 'coordinador'): {
    isAllowed: boolean;
    reason?: string;
    restrictions?: string[];
  } => {
    const module = AVAILABLE_MODULES.find(m => m.id === moduleId);
    if (!module) {
      return { isAllowed: false, reason: 'Módulo no encontrado' };
    }
    
    // Los administradores pueden configurar permisos para cualquier módulo
    if (role === 'admin') {
      return { isAllowed: true };
    }
    
    // Los coordinadores no pueden acceder a módulos adminOnly
    if (module.adminOnly) {
      return { 
        isAllowed: false, 
        reason: 'Solo administradores pueden acceder a este módulo',
        restrictions: ['can_view', 'can_create', 'can_edit', 'can_delete']
      };
    }
    
    // Para coordinador, validar permisos específicos
    const restrictions = [];
    if (role === 'coordinador') {
      // Los coordinadores no pueden tener permisos de eliminar por defecto
      restrictions.push('can_delete');
    }
    
    return { 
      isAllowed: true,
      restrictions: restrictions.length > 0 ? restrictions : undefined
    };
  }, []);

  // Componente para estados de módulo con lógica de prioridad
  const ModuleStatusBadge = ({ module, role, isAllowed }: {
    module: typeof AVAILABLE_MODULES[0];
    role: 'admin' | 'coordinador';
    isAllowed: boolean;
  }) => {
    // Lógica de prioridad de estados - CORREGIDA
    const getStatus = () => {
      // Prioridad 1: Restricción de administrador (solo para adminOnly)
      if (module.adminOnly && role === 'coordinador') {
        return {
          text: 'Solo Admin',
          className: 'bg-red-100 text-red-800 px-2 py-1 rounded font-medium',
          priority: 1,
          description: 'Solo los administradores pueden acceder'
        };
      }
      
      // Prioridad 2: Configurable por admin (módulos adminOnly para admin)
      if (module.adminOnly && role === 'admin') {
        return {
          text: 'Configurable',
          className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium',
          priority: 2,
          description: 'El administrador puede asignar permisos'
        };
      }
      
      // Prioridad 3: Disponible para coordinador (módulos NO adminOnly)
      if (!module.adminOnly && role === 'coordinador') {
        return {
          text: 'Disponible',
          className: 'bg-green-100 text-green-800 px-2 py-1 rounded font-medium',
          priority: 3,
          description: 'Accesible para este rol'
        };
      }
      
      // Prioridad 4: Disponible para admin (módulos NO adminOnly)
      if (!module.adminOnly && role === 'admin') {
        return {
          text: 'Accesible',
          className: 'bg-green-100 text-green-800 px-2 py-1 rounded font-medium',
          priority: 4,
          description: 'Completamente accesible'
        };
      }
      
      // Prioridad 5: No disponible (caso excepcional)
      if (!isAllowed && !module.adminOnly) {
        return {
          text: 'No Disponible',
          className: 'bg-gray-100 text-gray-600 px-2 py-1 rounded',
          priority: 5,
          description: 'No accesible para este rol'
        };
      }
      
      return null;
    };
    
    const status = getStatus();
    
    if (!status) return null;
    
    return (
      <span 
        className={`text-xs ${status.className} cursor-help`}
        title={status.description}
      >
        {status.text}
      </span>
    );
  };
  const loadData = useCallback(async (showToast = false) => {
    try {
      setError(null);
      
      // Cargar usuarios directamente desde auth.users usando RPC
      // Primero intentamos con una función RPC para acceder a auth.users
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_auth_users', {})

      if (usersError) {
        console.error('Error cargando usuarios:', usersError);
        throw new Error('Error al cargar usuarios: ' + usersError.message);
      }

      if (usersError) {
        console.error('Error cargando usuarios:', usersError);
        throw new Error('Error al cargar usuarios: ' + usersError.message);
      }

      setUsers(usersData || []);
      
      // Cargar programas
      const { data: programs, error: programsError } = await supabase
        .from('programs')
        .select('id, name, type')
        .order('name');

      if (programsError) {
        console.error('Error cargando programas:', programsError);
        // No es crítico, usar datos por defecto
        setAllPrograms([
          { id: '1', name: 'Administración Educativa', type: 'LIC' },
          { id: '2', name: 'Intervención Educativa', type: 'LIC' }
        ]);
      } else {
        setAllPrograms(programs || []);
      }

      if (showToast) {
        toast.success('Datos cargados correctamente');
      }

    } catch (error: any) {
      const errorInfo: ErrorInfo = {
        code: 'DATA_LOAD_ERROR',
        message: error.message || 'Error al cargar los datos',
        details: error
      };
      
      setError(errorInfo);
      console.error('Error cargando datos:', error);
      
      if (showToast) {
        toast.error(errorInfo.message);
      }
    }
  }, []);

  // Función para actualizar permisos con nueva lógica
  const updatePermissions = useCallback(async (userId: string, permissions: ModulePermission[], programs: string[]) => {
    try {
      // Filtrar permisos válidos según el rol del usuario
      const user = users.find(u => u.id === userId);
      if (!user) throw new Error('Usuario no encontrado');

      const userRole = user.user_metadata?.role || 'coordinador';
      const validPermissions = permissions.filter(perm => 
        validateModuleForRole(perm.module_name, userRole).isAllowed
      );

      if (validPermissions.length !== permissions.length) {
        toast.warning('Algunos permisos fueron filtrados por restricciones de rol');
      }

      // Usar función RPC directa
      const { data: result, error: rpcError } = await supabase.rpc('update_user_permissions', {
        p_user_id: userId,
        p_module_permissions: validPermissions,
        p_program_access: programs
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al actualizar permisos');
      }

      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar permisos');
      }

      return result;
    } catch (error: any) {
      console.error('Error actualizando permisos:', error);
      throw error;
    }
  }, [validateModuleForRole, users]);

  // Función para editar usuario
  const handleEditUser = useCallback((user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      role: user.user_metadata?.role || 'coordinador'
    });
    
    // Cargar permisos del usuario desde las tablas
    loadUserPermissions(user.id);
    setIsDialogOpen(true);
  }, []);

  // Función para cargar permisos de un usuario específico
  const loadUserPermissions = useCallback(async (userId: string) => {
    try {
      // Cargar permisos de módulos
      const { data: modulePerms, error: moduleError } = await supabase
        .from('user_module_permissions')
        .select('*')
        .eq('user_id', userId);

      if (moduleError) {
        console.error('Error loading user permissions:', moduleError);
        return;
      }

      // Cargar programas asignados
      const { data: programAccess, error: programError } = await supabase
        .from('user_program_access')
        .select('program_id')
        .eq('user_id', userId);

      if (programError) {
        console.error('Error loading program access:', programError);
        return;
      }

      const userModulePerms: {[key: string]: ModulePermission} = {};

      (modulePerms || []).forEach(perm => {
        userModulePerms[perm.module_name] = {
          module_name: perm.module_name,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete
        };
      });

      setModulePermissions(userModulePerms);
      setSelectedProgram(programAccess?.[0]?.program_id ?? '');
    } catch (error) {
      console.error('Error loading user permissions:', error);
    }
  }, []);

  // Función para actualizar usuario
  const handleUpdateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) return;

    setIsSubmitting(true);

    try {
      // Convertir permisos del objeto a array
      const permissionsArray = Object.values(modulePermissions).map(perm => ({
        module_name: perm.module_name,
        can_view: perm.can_view,
        can_create: perm.can_create,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
      }));

      // Validar permisos según rol
      const validatedPermissions = permissionsArray.filter(perm => 
        validateModuleForRole(perm.module_name, formData.role).isAllowed
      );

      const { data: result, error: rpcError } = await supabase.rpc('update_user_permissions', {
        p_user_id: editingUser.id,
        p_module_permissions: validatedPermissions,
        p_program_ids: formData.role === 'coordinador' && selectedProgram ? [selectedProgram] : []
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al actualizar usuario');
      }

      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar permisos');
      }

      toast.success('Usuario actualizado exitosamente');
      setIsDialogOpen(false);
      setEditingUser(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Error al actualizar usuario');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingUser, formData, modulePermissions, selectedProgram, validateModuleForRole, loadData]);

  // Función para confirmar eliminación
  const handleDeleteUser = useCallback((user: User) => {
    if (user.email === 'admin@upn.mx') {
      toast.error('No se puede eliminar el usuario administrador principal');
      return;
    }
    setUserToDelete(user);
    setShowDeleteDialog(true);
  }, []);

  // Función para eliminar usuario
  const confirmDeleteUser = useCallback(async () => {
    if (!userToDelete) return;

    setIsDeleting(true);

    try {
      const { data: result, error: rpcError } = await supabase.rpc('delete_user', {
        p_user_id: userToDelete.id
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Error al eliminar usuario');
      }

      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar usuario');
      }

      toast.success('Usuario eliminado exitosamente');
      setShowDeleteDialog(false);
      setUserToDelete(null);
      loadData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Error al eliminar usuario');
    } finally {
      setIsDeleting(false);
    }
  }, [userToDelete, loadData]);

  // Función para resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      email: '',
      password: '',
      role: 'coordinador'
    });
    setModulePermissions({});
    setSelectedProgram('');
  }, []);

  // Crear usuario con validaciones robustas
  const handleCreateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('Email y contraseña son requeridos');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (formData.role === 'coordinador' && !selectedProgram) {
      toast.error('Los coordinadores deben tener un programa asignado');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { role: formData.role } },
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      const newUserId = authData.user.id;

      await supabase.from('users').insert({
        id: newUserId,
        username: formData.email.split('@')[0],
        first_name: formData.email.split('@')[0],
        last_name: '',
        role: formData.role,
      });

      if (formData.role === 'coordinador' && selectedProgram) {
        await supabase.from('user_program_access').insert({
          user_id: newUserId,
          program_id: selectedProgram,
        });

        // Permisos por defecto según el tipo de programa del coordinador
        const programData = allPrograms.find(p => p.id === selectedProgram);
        const defaultPerms = getDefaultCoordinatorPermissions(programData?.type ?? 'LIC');
        if (defaultPerms.length > 0) {
          await supabase.from('user_module_permissions').insert(
            defaultPerms.map(p => ({ user_id: newUserId, ...p }))
          );
        }
      }

      toast.success('Usuario creado. Se le envió un email para activar su cuenta.');
      resetForm();
      setIsDialogOpen(false);
      await loadData();

    } catch (error: any) {
      console.error('Error creando usuario:', error);
      toast.error(error.message || 'Error al crear usuario');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, selectedProgram, loadData, resetForm]);

  // Manejar cambio de permisos de módulo con validaciones mejoradas
  const handleModulePermissionChange = useCallback((moduleId: string, permission: keyof ModulePermission, value: boolean) => {
    const validation = validateModuleForRole(moduleId, formData.role);
    
    if (!validation.isAllowed) {
      toast.warning(`No puede asignar permisos para ${moduleId} al rol ${formData.role}: ${validation.reason}`);
      return;
    }
    
    // Validar restricciones específicas
    if (validation.restrictions?.includes(permission)) {
      toast.warning(`El rol ${formData.role} no puede tener permisos de ${permission} para ${moduleId}`);
      return;
    }
    
    // Validación adicional para "Ver" como obligatorio
    if (permission !== 'can_view' && value) {
      const viewPermission = modulePermissions[moduleId]?.can_view;
      if (!viewPermission) {
        toast.warning(`Debe habilitar "Ver" antes de asignar otros permisos para ${moduleId}`);
        return;
      }
    }
    
    setModulePermissions(prev => {
      const current = prev[moduleId] || {
        module_name: moduleId,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
      
      return {
        ...prev,
        [moduleId]: {
          ...current,
          [permission]: value,
          // Si se deshabilita "Ver", deshabilitar todos los demás permisos
          ...(permission === 'can_view' && !value ? {
            can_create: false,
            can_edit: false,
            can_delete: false,
          } : {})
        },
      };
    });
  }, [formData.role, modulePermissions, validateModuleForRole]);

  // Filtrar usuarios
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_metadata?.role?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.user_metadata?.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  // Efectos
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Gestión de Usuarios
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Administra usuarios y sus permisos del sistema
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Usuario
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-6">
              {/* Sección de información básica */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Información Básica
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="usuario@ejemplo.com"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Contraseña <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                      required
                    />
                    {formData.password && (
                      <div className="mt-1 space-y-1">
                        <div className={`text-xs flex items-center gap-1 ${
                          /[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {/[A-Z]/.test(formData.password) ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Una mayúscula
                        </div>
                        <div className={`text-xs flex items-center gap-1 ${
                          /[a-z]/.test(formData.password) ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {/[a-z]/.test(formData.password) ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Una minúscula
                        </div>
                        <div className={`text-xs flex items-center gap-1 ${
                          /\d/.test(formData.password) ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {/\d/.test(formData.password) ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Un número
                        </div>
                        <div className={`text-xs flex items-center gap-1 ${
                          /[^a-zA-Z0-9]/.test(formData.password) ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {/[^a-zA-Z0-9]/.test(formData.password) ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          Un carácter especial
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Rol <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: 'admin' | 'coordinador') =>
                        setFormData(prev => ({ ...prev, role: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coordinador">Coordinador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.role === 'coordinador' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Programa <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={selectedProgram || 'none'}
                        onValueChange={v => setSelectedProgram(v === 'none' ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar programa..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allPrograms.length === 0 ? (
                            <SelectItem value="none" disabled>No hay programas disponibles</SelectItem>
                          ) : (
                            allPrograms.map(program => (
                              <SelectItem key={program.id} value={program.id}>
                                {program.name} ({program.type})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección de permisos de módulos — solo en edición */}
              {editingUser && <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Permisos de Módulos
                  {formData.role && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      (Rol: {formData.role})
                    </span>
                  )}
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-gray-900 dark:text-slate-100">Módulo</th>
                        <th className="text-center py-2 px-2 text-gray-900 dark:text-slate-100">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              Ver 
                              <span 
                                className="text-red-500 font-semibold cursor-help" 
                                title="Ver es la base de todos los permisos. Debe estar habilitado antes de asignar Crear, Editar o Eliminar."
                              >
                                *
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 bg-red-50 px-1 rounded">
                              Obligatorio
                            </div>
                          </div>
                        </th>
                        <th className="text-center py-2 px-2 text-gray-900 dark:text-slate-100">Crear</th>
                        <th className="text-center py-2 px-2 text-gray-900 dark:text-slate-100">Editar</th>
                        <th className="text-center py-2 px-2 text-gray-900 dark:text-slate-100">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {AVAILABLE_MODULES.map((module) => {
                        const validation = validateModuleForRole(module.id, formData.role);
                        const isAllowed = validation.isAllowed;
                        // Usar permisos por defecto basados en rol si no están configurados
                        const defaultPermissions = formData.role === 'admin' ? {
                          can_view: true, can_create: true, can_edit: true, can_delete: true
                        } : !module.adminOnly ? {
                          can_view: true, can_create: true, can_edit: true, can_delete: false
                        } : {
                          can_view: false, can_create: false, can_edit: false, can_delete: false
                        };
                        
                        const perm = modulePermissions[module.id] || {
                          module_name: module.id,
                          ...defaultPermissions,
                        };
                        
                        // Función para renderizar checkbox con validaciones mejoradas
                        const renderPermissionCheckbox = (permission: keyof ModulePermission, label: string) => {
                          const isDisabled = !isAllowed || validation.restrictions?.includes(permission);
                          
                          return (
                            <input
                              type="checkbox"
                              checked={Boolean(perm[permission])}
                              disabled={isDisabled}
                              onChange={(e) =>
                                !isDisabled && handleModulePermissionChange(module.id, permission, e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isDisabled ? `No disponible para rol ${formData.role}` : undefined}
                            />
                          );
                        };
                        
                        return (
                          <tr key={module.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-gray-900 dark:text-slate-100 ${!isAllowed ? 'opacity-50' : ''}`}>
                                  {module.name}
                                </span>
                                <ModuleStatusBadge 
                                  module={module} 
                                  role={formData.role} 
                                  isAllowed={isAllowed} 
                                />
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {renderPermissionCheckbox('can_view', 'Ver')}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {renderPermissionCheckbox('can_create', 'Crear')}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {renderPermissionCheckbox('can_edit', 'Editar')}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {renderPermissionCheckbox('can_delete', 'Eliminar')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Advertencias de validación de consistencia */}
                {Object.entries(modulePermissions).map(([moduleId, perms]) => {
                  const errors = validatePermissionConsistency(moduleId, perms);
                  return errors.map((error, index) => (
                    <div key={`${moduleId}-${index}`} className="text-xs text-orange-600 bg-orange-50 p-2 rounded mt-1 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ));
                })}
                
                {/* Leyenda explicativa mejorada */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Estados de Módulos:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 p-2 bg-white rounded">
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-medium">Solo Admin</span>
                      <span className="text-gray-600">Restringido exclusivamente para administradores</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">Configurable</span>
                      <span className="text-gray-600">El admin puede asignar permisos específicos</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-medium">Disponible/Accesible</span>
                      <span className="text-gray-600">Completamente accesible para el rol</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">No Disponible</span>
                      <span className="text-gray-600">No se puede acceder con este rol</span>
                    </div>
                  </div>
                </div>
              </div>}

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {editingUser ? 'Actualizando...' : 'Creando...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Diálogo de confirmación de eliminación */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  ¿Estás seguro de que deseas eliminar este usuario?
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Esta acción eliminará permanentemente al usuario <strong>{userToDelete?.email}</strong> y todos sus permisos asociados.
                </p>
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDeleteUser}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash className="w-4 h-4 mr-2" />
                    Eliminar Usuario
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alertas de error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-medium text-red-800">Error</h3>
          </div>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
          <Button
            onClick={() => loadData(true)}
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={isApiLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isApiLoading ? 'animate-spin' : ''}`} />
            Reintentar
          </Button>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            id="search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por email o rol..."
            className="pl-10"
          />
        </div>
        
        <Select value={filterRole} onValueChange={(value: any) => setFilterRole(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="coordinador">Coordinadores</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resultados de búsqueda */}
      {(searchTerm || filterRole !== 'all') && (
        <div className="mb-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
          <span>
            Mostrando {filteredUsers.length} de {users.length} usuarios
            {searchTerm && ` para "${searchTerm}"`}
            {filterRole !== 'all' && ` filtrados por ${filterRole === 'admin' ? 'administradores' : 'coordinadores'}`}
          </span>
          {(searchTerm || filterRole !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('all');
              }}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Fecha Creación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Último Acceso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.user_metadata?.role === 'admin' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.user_metadata?.role === 'admin' ? 'Administrador' : 'Coordinador'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Nunca'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.email === 'admin@upn.mx'}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-slate-400">
              {users.length === 0 ? 'No hay usuarios registrados' : 'No se encontraron usuarios con los filtros aplicados'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}