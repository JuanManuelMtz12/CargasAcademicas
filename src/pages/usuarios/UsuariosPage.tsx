import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Plus, Trash2, X, Shield, ShieldCheck, Eye, Edit, Trash, PlusCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

type UserWithMetadata = User & {
  user_metadata: {
    role?: 'admin' | 'coordinador';
  };
  module_permissions?: ModulePermission[];
  allowed_programs?: Program[];
};

type ModulePermission = {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type Program = {
  id: string;
  name: string;
  type: string;
};

const AVAILABLE_MODULES = [
  { id: 'Dashboard', name: 'Dashboard' },
  { id: 'Programas', name: 'Programas' },
  { id: 'Maestros', name: 'Maestros' },
  { id: 'Maestros Múltiples', name: 'Maestros Múltiples Prog.' },
  { id: 'Materias', name: 'Materias' },
  { id: 'Módulos', name: 'Módulos' },
  { id: 'Grupos', name: 'Grupos' },
  { id: 'Disponibilidad', name: 'Disponibilidad' },
];

export default function UsuariosPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<UserWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithMetadata | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: '' as 'admin' | 'coordinador' | '',
  });
  const [modulePermissions, setModulePermissions] = useState<Record<string, ModulePermission>>({});
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'coordinador'>('all');

  useEffect(() => {
    loadUsers();
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, type')
        .order('name');

      if (error) throw error;
      setAllPrograms(data || []);
    } catch (error: any) {
      console.error('Error loading programs:', error);
      toast.error('Error al cargar programas: ' + error.message);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setUsers(data.users as UserWithMetadata[]);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error('Error al cargar los usuarios: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar usuarios basado en búsqueda y rol
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_metadata?.role?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || 
      user.user_metadata?.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  // Validar fortaleza de contraseña
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    
    if (!/[A-Z]/.test(password)) {
      return 'La contraseña debe contener al menos una letra mayúscula';
    }
    
    if (!/[a-z]/.test(password)) {
      return 'La contraseña debe contener al menos una letra minúscula';
    }
    
    if (!/[0-9]/.test(password)) {
      return 'La contraseña debe contener al menos un número';
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};'"\\|,.<>\/?]/.test(password)) {
      return 'La contraseña debe contener al menos un carácter especial';
    }
    
    return null;
  };

  const handleOpenModal = (user?: UserWithMetadata) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email || '',
        password: '',
        role: user.user_metadata?.role || '',
      });
      
      // Cargar permisos de módulos
      const permsMap: Record<string, ModulePermission> = {};
      if (user.module_permissions) {
        user.module_permissions.forEach(perm => {
          permsMap[perm.module_name] = perm;
        });
      }
      setModulePermissions(permsMap);
      
      // Cargar programas permitidos
      if (user.allowed_programs) {
        setSelectedPrograms(user.allowed_programs.map(p => p.id));
      } else {
        setSelectedPrograms([]);
      }
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        role: '',
      });
      setModulePermissions({});
      setSelectedPrograms([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      role: '',
    });
    setModulePermissions({});
    setSelectedPrograms([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim()) {
      toast.error('El email es requerido');
      return;
    }

    if (!formData.role) {
      toast.error('El rol es requerido');
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error('La contraseña es requerida para crear un usuario');
      return;
    }

    // Validar contraseña si se está creando un usuario
    if (!editingUser && formData.password) {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        toast.error(passwordError);
        return;
      }
    }

    // Validaciones para coordinadores
    if (formData.role === 'coordinador') {
      const hasAnyModulePermission = Object.values(modulePermissions).some(
        perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete
      );
      
      if (!hasAnyModulePermission) {
        toast.error('Debe asignar al menos un módulo al coordinador');
        return;
      }

      if (selectedPrograms.length === 0) {
        toast.error('Debe asignar al menos un programa al coordinador');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Preparar permisos de módulos para enviar
      const module_permissions = formData.role === 'coordinador'
        ? Object.values(modulePermissions).filter(
            perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete
          )
        : undefined;

      // Preparar IDs de programas
      const program_ids = formData.role === 'coordinador' ? selectedPrograms : undefined;

      if (editingUser) {
        // Editar
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'update',
            userId: editingUser.id,
            newRole: formData.role,
            module_permissions,
            program_ids,
          }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        toast.success('Usuario actualizado correctamente');
      } else {
        // Crear nuevo usuario
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'create',
            email: formData.email.trim(),
            password: formData.password,
            role: formData.role,
            module_permissions,
            program_ids,
          }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        
        toast.success('Usuario creado correctamente');
      }

      handleCloseModal();
      loadUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: UserWithMetadata) => {
    // No permitir eliminar al usuario actual
    if (user.id === currentUser?.id) {
      toast.error('No puedes eliminar tu propia cuenta');
      return;
    }

    if (!confirm(`¿Está seguro de eliminar al usuario "${user.email}"?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId: user.id
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      toast.success('Usuario eliminado correctamente');
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Error al eliminar: ' + error.message);
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleModulePermissionChange = (
    moduleName: string,
    permissionType: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
    value: boolean
  ) => {
    setModulePermissions(prev => {
      const current = prev[moduleName] || {
        module_name: moduleName,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };

      const updated = { ...current, [permissionType]: value };

      // Si se desmarca "Ver", desmarcar todos los demás
      if (permissionType === 'can_view' && !value) {
        updated.can_create = false;
        updated.can_edit = false;
        updated.can_delete = false;
      }

      // Si se marca cualquier permiso, marcar automáticamente "Ver"
      if (permissionType !== 'can_view' && value) {
        updated.can_view = true;
      }

      return { ...prev, [moduleName]: updated };
    });
  };

  const handleProgramToggle = (programId: string) => {
    setSelectedPrograms(prev => {
      if (prev.includes(programId)) {
        return prev.filter(id => id !== programId);
      } else {
        return [...prev, programId];
      }
    });
  };

  const getRoleBadge = (role: 'admin' | 'coordinador' | undefined) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <ShieldCheck className="w-3 h-3" />
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Shield className="w-3 h-3" />
        Coordinador
      </span>
    );
  };

  const getPermissionsDisplay = (user: UserWithMetadata) => {
    if (user.user_metadata?.role === 'admin') {
      return (
        <span className="text-sm text-gray-600 dark:text-slate-400">
          Acceso total
        </span>
      );
    }
    
    const moduleCount = user.module_permissions?.length || 0;
    const programCount = user.allowed_programs?.length || 0;
    
    return (
      <span className="text-sm text-gray-600 dark:text-slate-400">
        {moduleCount} módulo{moduleCount !== 1 ? 's' : ''}, {programCount} programa{programCount !== 1 ? 's' : ''}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Usuarios</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Gestión de usuarios del sistema</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total de usuarios</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{filteredUsers.length}</p>
            </div>
            <div className="h-12 w-px bg-gray-300"></div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Administradores</p>
              <p className="text-2xl font-bold text-purple-700">
                {filteredUsers.filter((u) => u.user_metadata?.role === 'admin').length}
              </p>
            </div>
            <div className="h-12 w-px bg-gray-300"></div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Coordinadores</p>
              <p className="text-2xl font-bold text-blue-700">
                {filteredUsers.filter((u) => u.user_metadata?.role === 'coordinador').length}
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-slate-400">
            Usuario actual: <span className="font-semibold text-gray-900 dark:text-slate-100">{currentUser?.email}</span>
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Buscar usuarios
            </label>
            <div className="relative">
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por email o rol..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Filtro por rol */}
          <div className="sm:w-48">
            <label htmlFor="filter-role" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Filtrar por rol
            </label>
            <select
              id="filter-role"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as 'all' | 'admin' | 'coordinador')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Solo Administradores</option>
              <option value="coordinador">Solo Coordinadores</option>
            </select>
          </div>
        </div>
        
        {/* Resultados de búsqueda */}
        {(searchTerm || filterRole !== 'all') && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
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
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Permisos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Fecha de Creación
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    {users.length === 0 ? 'No hay usuarios registrados' : 'No se encontraron usuarios con los filtros aplicados'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-gray-50 ${user.id === currentUser?.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{user.email}</div>
                        {user.id === currentUser?.id && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Tú
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.user_metadata?.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPermissionsDisplay(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-slate-100">{formatDate(user.created_at)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          disabled={user.id === currentUser?.id}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                          title={user.id === currentUser?.id ? 'No puedes editar tu propia cuenta' : 'Editar usuario'}
                        >
                          <Edit className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={user.id === currentUser?.id}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={user.id === currentUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@ejemplo.com"
                    required
                    disabled={!!editingUser}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {editingUser && (
                    <p className="mt-1 text-xs text-gray-500">
                      El email no se puede modificar
                    </p>
                  )}
                </div>

                {/* Password - Solo en creación */}
                {!editingUser && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Contraseña <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial
                    </p>
                  </div>
                )}

                {/* Rol */}
                <div>
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    Rol <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'coordinador' })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  >
                    <option value="">Seleccione un rol</option>
                    <option value="admin">Administrador</option>
                    <option value="coordinador">Coordinador</option>
                  </select>
                </div>

                {/* Info del rol */}
                {formData.role && (
                  <div className={`rounded-lg p-3 border ${
                    formData.role === 'admin' 
                      ? 'bg-purple-50 border-purple-200' 
                      : 'bg-blue-50 border-blue-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      formData.role === 'admin' ? 'text-purple-800' : 'text-blue-800'
                    }`}>
                      {formData.role === 'admin' ? 'Administrador' : 'Coordinador'}
                    </p>
                    <p className={`text-xs mt-1 ${
                      formData.role === 'admin' ? 'text-purple-700' : 'text-blue-700'
                    }`}>
                      {formData.role === 'admin' 
                        ? 'Acceso completo al sistema, puede gestionar usuarios y toda la configuración'
                        : 'Acceso a gestión de horarios, maestros, materias y programas según permisos asignados'
                      }
                    </p>
                  </div>
                )}

                {/* Sección de Permisos de Módulos - Solo para coordinadores */}
                {formData.role === 'coordinador' && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Permisos de Módulos <span className="text-red-500">*</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700">
                            <th className="text-left py-2 px-2 font-medium text-gray-700">Módulo</th>
                            <th className="text-center py-2 px-2 font-medium text-gray-700">
                              <div className="flex items-center justify-center gap-1">
                                <Eye className="w-4 h-4" />
                                <span>Ver</span>
                              </div>
                            </th>
                            <th className="text-center py-2 px-2 font-medium text-gray-700">
                              <div className="flex items-center justify-center gap-1">
                                <PlusCircle className="w-4 h-4" />
                                <span>Crear</span>
                              </div>
                            </th>
                            <th className="text-center py-2 px-2 font-medium text-gray-700">
                              <div className="flex items-center justify-center gap-1">
                                <Edit className="w-4 h-4" />
                                <span>Editar</span>
                              </div>
                            </th>
                            <th className="text-center py-2 px-2 font-medium text-gray-700">
                              <div className="flex items-center justify-center gap-1">
                                <Trash className="w-4 h-4" />
                                <span>Eliminar</span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {AVAILABLE_MODULES.map((module) => {
                            const perm = modulePermissions[module.name] || {
                              module_name: module.name,
                              can_view: false,
                              can_create: false,
                              can_edit: false,
                              can_delete: false,
                            };
                            return (
                              <tr key={module.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-2 px-2 text-gray-900 dark:text-slate-100">{module.name}</td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm.can_view}
                                    onChange={(e) =>
                                      handleModulePermissionChange(module.name, 'can_view', e.target.checked)
                                    }
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm.can_create}
                                    onChange={(e) =>
                                      handleModulePermissionChange(module.name, 'can_create', e.target.checked)
                                    }
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm.can_edit}
                                    onChange={(e) =>
                                      handleModulePermissionChange(module.name, 'can_edit', e.target.checked)
                                    }
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm.can_delete}
                                    onChange={(e) =>
                                      handleModulePermissionChange(module.name, 'can_delete', e.target.checked)
                                    }
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sección de Programas Permitidos - Solo para coordinadores */}
                {formData.role === 'coordinador' && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Programas Permitidos <span className="text-red-500">*</span>
                    </h3>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {allPrograms.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay programas disponibles</p>
                      ) : (
                        allPrograms.map((program) => (
                          <label
                            key={program.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPrograms.includes(program.id)}
                              onChange={() => handleProgramToggle(program.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                            />
                            <span className="text-sm text-gray-900 dark:text-slate-100">
                              {program.name} ({program.type})
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Seleccionados: {selectedPrograms.length} de {allPrograms.length}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
