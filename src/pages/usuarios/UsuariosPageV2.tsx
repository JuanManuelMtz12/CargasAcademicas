import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, X, AlertCircle, CheckCircle, RefreshCw, Trash, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

// Roles soportados. 'invitado' es de solo lectura: nunca puede tener
// can_create / can_edit / can_delete, sin importar qué módulos se le asignen.
type UserRole = 'admin' | 'coordinador' | 'invitado';

const READ_ONLY_ROLES: UserRole[] = ['invitado'];
// El invitado no pertenece a una licenciatura (program), sino a un departamento
// administrativo (Recursos Humanos, Servicios Escolares, etc.)
const ROLES_REQUIRING_PROGRAM: UserRole[] = ['coordinador'];
const ROLES_REQUIRING_DEPARTMENT: UserRole[] = ['invitado'];

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
    role?: UserRole;
    [key: string]: any;
  };
  created_at: string;
  last_sign_in_at?: string;
  module_permissions?: ModulePermission[];
  allowed_programs?: Program[];
  allowed_departments?: Departamento[];
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

interface Departamento {
  id: string;
  name: string;
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

// Permisos por defecto para un invitado nuevo: solo lectura del dashboard.
// El admin puede ampliar los módulos visibles después, desde "Editar".
function getDefaultInvitadoPermissions() {
  return [
    { module_name: 'dashboard', can_view: true, can_create: false, can_edit: false, can_delete: false },
  ];
}

export default function UsuariosPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [modulePermissions, setModulePermissions] = useState<{[key: string]: ModulePermission}>({});
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [allDepartamentos, setAllDepartamentos] = useState<Departamento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'coordinador' as UserRole,
  });

  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Función para validar coherencia de permisos
  const validatePermissionConsistency = useCallback((moduleId: string, permissions: ModulePermission) => {
    const errors = [];

    if ((permissions.can_create || permissions.can_edit || permissions.can_delete) && !permissions.can_view) {
      errors.push(`El permiso "Ver" debe estar habilitado para asignar otros permisos en ${moduleId}`);
    }

    if ((permissions.can_edit || permissions.can_delete) && !permissions.can_create) {
      errors.push(`No se recomienda asignar Editar/Eliminar sin Crear en ${moduleId}`);
    }

    return errors;
  }, []);

  // Función mejorada para validar permisos según rol
  const validateModuleForRole = useCallback((moduleId: string, role: UserRole): {
    isAllowed: boolean;
    reason?: string;
    restrictions?: string[];
  } => {
    const module = AVAILABLE_MODULES.find(m => m.id === moduleId);
    if (!module) {
      return { isAllowed: false, reason: 'Módulo no encontrado' };
    }

    if (role === 'admin') {
      return { isAllowed: true };
    }

    if (module.adminOnly) {
      return {
        isAllowed: false,
        reason: 'Solo administradores pueden acceder a este módulo',
        restrictions: ['can_view', 'can_create', 'can_edit', 'can_delete']
      };
    }

    // Invitado: solo lectura, sin excepción, en cualquier módulo no-adminOnly
    if (role === 'invitado') {
      return {
        isAllowed: true,
        restrictions: ['can_create', 'can_edit', 'can_delete'],
      };
    }

    const restrictions = [];
    if (role === 'coordinador') {
      restrictions.push('can_delete');
    }

    return {
      isAllowed: true,
      restrictions: restrictions.length > 0 ? restrictions : undefined
    };
  }, []);

  const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    coordinador: 'Coordinador',
    invitado: 'Invitado',
  };

  const ROLE_BADGE_CLASS: Record<UserRole, string> = {
    admin: 'bg-red-100 text-red-800',
    coordinador: 'bg-blue-100 text-blue-800',
    invitado: 'bg-gray-200 text-gray-700',
  };

  // Componente para estados de módulo con lógica de prioridad
  const ModuleStatusBadge = ({ module, role, isAllowed }: {
    module: typeof AVAILABLE_MODULES[0];
    role: UserRole;
    isAllowed: boolean;
  }) => {
    const getStatus = () => {
      if (module.adminOnly && role !== 'admin') {
        return {
          text: 'Solo Admin',
          className: 'bg-red-100 text-red-800 px-2 py-1 rounded font-medium',
          description: 'Solo los administradores pueden acceder'
        };
      }

      if (module.adminOnly && role === 'admin') {
        return {
          text: 'Configurable',
          className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium',
          description: 'El administrador puede asignar permisos'
        };
      }

      if (!module.adminOnly && role === 'invitado') {
        return {
          text: 'Solo lectura',
          className: 'bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium',
          description: 'El invitado solo puede ver este módulo, sin crear/editar/eliminar'
        };
      }

      if (!module.adminOnly) {
        return {
          text: 'Disponible',
          className: 'bg-green-100 text-green-800 px-2 py-1 rounded font-medium',
          description: 'Accesible para este rol'
        };
      }

      if (!isAllowed) {
        return {
          text: 'No Disponible',
          className: 'bg-gray-100 text-gray-600 px-2 py-1 rounded',
          description: 'No accesible para este rol'
        };
      }

      return null;
    };

    const status = getStatus();
    if (!status) return null;

    return (
      <span className={`text-xs ${status.className} cursor-help`} title={status.description}>
        {status.text}
      </span>
    );
  };

  const loadData = useCallback(async (showToast = false) => {
    try {
      setError(null);

      // Listar usuarios vía la Edge Function manage-users (valida que quien
      // llama sea admin y trae rol + permisos + programas ya combinados).
      const { data, error: fnError } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data.success) throw new Error(data.error || 'Error al cargar usuarios');

      setUsers(data.users || []);

      const [{ data: programs, error: programsError }, { data: departamentos, error: departamentosError }] = await Promise.all([
        supabase.from('programs').select('id, name, type').order('name'),
        supabase.from('departamentos').select('id, name').order('name'),
      ]);

      if (programsError) {
        console.error('Error cargando programas:', programsError);
        setAllPrograms([]);
      } else {
        setAllPrograms(programs || []);
      }

      if (departamentosError) {
        console.error('Error cargando departamentos:', departamentosError);
        setAllDepartamentos([]);
      } else {
        setAllDepartamentos(departamentos || []);
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

  // Función para editar usuario — usa los permisos y programas que ya
  // vinieron incluidos en la lista (evita depender de RLS en tablas internas).
  const handleEditUser = useCallback((targetUser: User) => {
    setEditingUser(targetUser);
    setFormData({
      email: targetUser.email,
      password: '',
      role: targetUser.user_metadata?.role || 'coordinador',
    });

    const permsMap: {[key: string]: ModulePermission} = {};
    (targetUser.module_permissions || []).forEach(perm => {
      permsMap[perm.module_name] = perm;
    });
    setModulePermissions(permsMap);
    setSelectedProgram(targetUser.allowed_programs?.[0]?.id ?? '');
    setSelectedDepartamento(targetUser.allowed_departments?.[0]?.id ?? '');

    setIsDialogOpen(true);
  }, []);

  // Función para actualizar usuario (rol, permisos, programa y opcionalmente contraseña)
  const handleUpdateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) return;

    if (formData.password && formData.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (ROLES_REQUIRING_PROGRAM.includes(formData.role) && !selectedProgram) {
      toast.error(`Los usuarios con rol "${ROLE_LABELS[formData.role]}" deben tener un programa asignado`);
      return;
    }

    if (ROLES_REQUIRING_DEPARTMENT.includes(formData.role) && !selectedDepartamento) {
      toast.error(`Los usuarios con rol "${ROLE_LABELS[formData.role]}" deben tener un departamento asignado`);
      return;
    }

    setIsSubmitting(true);

    try {
      const permissionsArray = Object.values(modulePermissions)
        .map(perm =>
          READ_ONLY_ROLES.includes(formData.role)
            ? { ...perm, can_view: true, can_create: false, can_edit: false, can_delete: false }
            : perm
        )
        .filter(perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete)
        .filter(perm => validateModuleForRole(perm.module_name, formData.role).isAllowed);

      const { data: result, error: fnError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update',
          userId: editingUser.id,
          newRole: formData.role,
          module_permissions: permissionsArray,
          program_ids: selectedProgram ? [selectedProgram] : [],
          department_ids: selectedDepartamento ? [selectedDepartamento] : [],
          // Solo se envía si el admin escribió una nueva contraseña
          password: formData.password ? formData.password : undefined,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (!result.success) throw new Error(result.error || 'Error al actualizar usuario');

      toast.success(
        formData.password
          ? 'Usuario y contraseña actualizados exitosamente'
          : 'Usuario actualizado exitosamente'
      );
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
  }, [editingUser, formData, modulePermissions, selectedProgram, selectedDepartamento, validateModuleForRole, loadData]);

  const handleDeleteUser = useCallback((targetUser: User) => {
    if (targetUser.email === 'admin@upn.mx') {
      toast.error('No se puede eliminar el usuario administrador principal');
      return;
    }
    setUserToDelete(targetUser);
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteUser = useCallback(async () => {
    if (!userToDelete) return;

    setIsDeleting(true);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', userId: userToDelete.id },
      });

      if (fnError) throw new Error(fnError.message);
      if (!result.success) throw new Error(result.error || 'Error al eliminar usuario');

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

  const resetForm = useCallback(() => {
    setFormData({
      email: '',
      password: '',
      role: 'coordinador',
    });
    setModulePermissions({});
    setSelectedProgram('');
    setSelectedDepartamento('');
  }, []);

  // Crear usuario vía la Edge Function manage-users (creación administrada,
  // no auto-registro público).
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

    if (ROLES_REQUIRING_PROGRAM.includes(formData.role) && !selectedProgram) {
      toast.error(`Los usuarios con rol "${ROLE_LABELS[formData.role]}" deben tener un programa asignado`);
      return;
    }

    if (ROLES_REQUIRING_DEPARTMENT.includes(formData.role) && !selectedDepartamento) {
      toast.error(`Los usuarios con rol "${ROLE_LABELS[formData.role]}" deben tener un departamento asignado`);
      return;
    }

    setIsSubmitting(true);

    try {
      let module_permissions: ModulePermission[] | undefined;

      if (formData.role === 'coordinador' && selectedProgram) {
        const programData = allPrograms.find(p => p.id === selectedProgram);
        module_permissions = getDefaultCoordinatorPermissions(programData?.type ?? 'LIC');
      } else if (formData.role === 'invitado') {
        module_permissions = getDefaultInvitadoPermissions();
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: formData.email,
          password: formData.password,
          role: formData.role,
          module_permissions,
          program_ids: selectedProgram ? [selectedProgram] : undefined,
          department_ids: selectedDepartamento ? [selectedDepartamento] : undefined,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (!result.success) throw new Error(result.error || 'Error al crear usuario');

      toast.success('Usuario creado exitosamente');
      resetForm();
      setIsDialogOpen(false);
      await loadData();

    } catch (error: any) {
      console.error('Error creando usuario:', error);
      toast.error(error.message || 'Error al crear usuario');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, selectedProgram, selectedDepartamento, allPrograms, loadData, resetForm]);

  const handleModulePermissionChange = useCallback((moduleId: string, permission: keyof ModulePermission, value: boolean) => {
    const validation = validateModuleForRole(moduleId, formData.role);

    if (!validation.isAllowed) {
      toast.warning(`No puede asignar permisos para ${moduleId} al rol ${ROLE_LABELS[formData.role]}: ${validation.reason}`);
      return;
    }

    if (validation.restrictions?.includes(permission)) {
      toast.warning(`El rol ${ROLE_LABELS[formData.role]} no puede tener permisos de ${permission} para ${moduleId}`);
      return;
    }

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
          ...(permission === 'can_view' && !value ? {
            can_create: false,
            can_edit: false,
            can_delete: false,
          } : {})
        },
      };
    });
  }, [formData.role, modulePermissions, validateModuleForRole]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = searchTerm === '' ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.user_metadata?.role?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'all' || u.user_metadata?.role === filterRole;

    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const requiresProgram = ROLES_REQUIRING_PROGRAM.includes(formData.role);
  const requiresDepartment = ROLES_REQUIRING_DEPARTMENT.includes(formData.role);
  const isReadOnlyRoleSelected = READ_ONLY_ROLES.includes(formData.role);

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
                      disabled={!!editingUser}
                    />
                    {editingUser && (
                      <p className="mt-1 text-xs text-gray-500">El email no se puede modificar</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Contraseña {!editingUser && <span className="text-red-500">*</span>}
                    </label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={editingUser ? 'Dejar en blanco para no cambiarla' : 'Mínimo 8 caracteres'}
                      minLength={8}
                      required={!editingUser}
                      autoComplete="new-password"
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
                    {editingUser && !formData.password && (
                      <p className="mt-1 text-xs text-gray-500">
                        Solo se actualizará si escribes una nueva contraseña
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Rol <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: UserRole) =>
                        setFormData(prev => ({ ...prev, role: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coordinador">Coordinador</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="invitado">Invitado (solo lectura)</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.role === 'invitado' && (
                      <p className="mt-1 text-xs text-gray-500">
                        Acceso de solo lectura a los módulos que le asignes. No puede crear, editar ni eliminar.
                      </p>
                    )}
                  </div>

                  {requiresProgram && (
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

                  {requiresDepartment && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Departamento <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={selectedDepartamento || 'none'}
                        onValueChange={v => setSelectedDepartamento(v === 'none' ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar departamento..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allDepartamentos.length === 0 ? (
                            <SelectItem value="none" disabled>No hay departamentos disponibles</SelectItem>
                          ) : (
                            allDepartamentos.map(dep => (
                              <SelectItem key={dep.id} value={dep.id}>
                                {dep.name}
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
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    (Rol: {ROLE_LABELS[formData.role]})
                  </span>
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
                        const defaultPermissions = formData.role === 'admin' ? {
                          can_view: true, can_create: true, can_edit: true, can_delete: true
                        } : formData.role === 'invitado' ? {
                          can_view: false, can_create: false, can_edit: false, can_delete: false
                        } : !module.adminOnly ? {
                          can_view: true, can_create: true, can_edit: true, can_delete: false
                        } : {
                          can_view: false, can_create: false, can_edit: false, can_delete: false
                        };

                        const perm = modulePermissions[module.id] || {
                          module_name: module.id,
                          ...defaultPermissions,
                        };

                        const renderPermissionCheckbox = (permission: keyof ModulePermission) => {
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
                              title={isDisabled ? `No disponible para rol ${ROLE_LABELS[formData.role]}` : undefined}
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
                                <ModuleStatusBadge module={module} role={formData.role} isAllowed={isAllowed} />
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">{renderPermissionCheckbox('can_view')}</td>
                            <td className="py-2 px-2 text-center">{renderPermissionCheckbox('can_create')}</td>
                            <td className="py-2 px-2 text-center">{renderPermissionCheckbox('can_edit')}</td>
                            <td className="py-2 px-2 text-center">{renderPermissionCheckbox('can_delete')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {Object.entries(modulePermissions).map(([moduleId, perms]) => {
                  const errors = validatePermissionConsistency(moduleId, perms);
                  return errors.map((error, index) => (
                    <div key={`${moduleId}-${index}`} className="text-xs text-orange-600 bg-orange-50 p-2 rounded mt-1 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ));
                })}

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
                      <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium">Solo lectura</span>
                      <span className="text-gray-600">El invitado puede ver, pero no crear/editar/eliminar</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">No Disponible</span>
                      <span className="text-gray-600">No se puede acceder con este rol</span>
                    </div>
                  </div>
                </div>
              </div>}

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
          >
            <RefreshCw className="w-4 h-4 mr-2" />
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
            <SelectItem value="invitado">Invitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(searchTerm || filterRole !== 'all') && (
        <div className="mb-4 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
          <span>
            Mostrando {filteredUsers.length} de {users.length} usuarios
            {searchTerm && ` para "${searchTerm}"`}
            {filterRole !== 'all' && ` filtrados por ${ROLE_LABELS[filterRole]}`}
          </span>
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
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Fecha Creación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Último Acceso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      u.user_metadata?.role ? ROLE_BADGE_CLASS[u.user_metadata.role] : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.user_metadata?.role ? ROLE_LABELS[u.user_metadata.role] : 'Sin rol'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Nunca'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditUser(u)}>
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.email === 'admin@upn.mx'}
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