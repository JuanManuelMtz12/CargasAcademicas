import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Group = Database['public']['Tables']['groups']['Row'];

export default function GruposPage() {
  const { isAdmin } = usePermissions();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para el diálogo de confirmación de eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  const itemsPerPage = 5;

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('groups')
        .select('*');

      if (error) throw error;
      
      // Ordenamiento personalizado: primero por número, luego por letra
      const sortedData = (data || []).sort((a, b) => {
        // Extraer número y letra del nombre del grupo usando regex
        const matchA = a.name.match(/^(\d+)([A-Za-z]*)$/);
        const matchB = b.name.match(/^(\d+)([A-Za-z]*)$/);

        // Si ambos tienen el formato número+letra
        if (matchA && matchB) {
          const numA = parseInt(matchA[1], 10);
          const numB = parseInt(matchB[1], 10);
          const letterA = matchA[2] || '';
          const letterB = matchB[2] || '';

          // Primero comparar por número
          if (numA !== numB) {
            return numA - numB;
          }
          // Si los números son iguales, comparar por letra alfabéticamente
          return letterA.localeCompare(letterB);
        }

        // Si alguno no coincide con el formato, usar orden alfabético normal
        return a.name.localeCompare(b.name);
      });

      setGroups(sortedData);
    } catch (error: any) {
      console.error('Error loading groups:', error);
      toast.error('Error al cargar los grupos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (group?: Group) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
      });
    } else {
      setEditingGroup(null);
      setFormData({
        name: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
    setFormData({
      name: '',
    });
  };

  const validateUniqueName = async (name: string): Promise<boolean> => {
    const trimmedName = name.trim();
    
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id')
        .ilike('name', trimmedName);

      if (error) throw error;

      // Si estamos editando, excluir el grupo actual
      if (editingGroup) {
        const duplicates = data?.filter(g => g.id !== editingGroup.id) || [];
        return duplicates.length === 0;
      }

      return !data || data.length === 0;
    } catch (error: any) {
      console.error('Error validating name:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      setIsSubmitting(true);

      // Validar nombre único
      const isUnique = await validateUniqueName(formData.name);
      if (!isUnique) {
        toast.error('Ya existe un grupo con este nombre');
        setIsSubmitting(false);
        return;
      }

      if (editingGroup) {
        // Actualizar
        const { error } = await supabase
          .from('groups')
          .update({
            name: formData.name.trim(),
          })
          .eq('id', editingGroup.id);

        if (error) throw error;
        toast.success('Grupo actualizado correctamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('groups')
          .insert({
            name: formData.name.trim(),
          });

        if (error) throw error;
        toast.success('Grupo creado correctamente');
      }

      handleCloseModal();
      loadGroups();
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (group: Group) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!groupToDelete) return;

    try {
      // Validar que no tenga horarios asignados
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule')
        .select('id')
        .eq('group_id', groupToDelete.id)
        .limit(1);

      if (scheduleError) throw scheduleError;

      if (scheduleData && scheduleData.length > 0) {
        toast.error('No se puede eliminar: el grupo tiene horarios asignados');
        setDeleteDialogOpen(false);
        setGroupToDelete(null);
        return;
      }

      // Eliminar
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupToDelete.id);

      if (error) throw error;

      toast.success('Grupo eliminado correctamente');
      loadGroups();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error('Error al eliminar: ' + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  // Filtrar grupos por búsqueda
  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentGroups = filteredGroups.slice(startIndex, endIndex);

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Grupos</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Gestión de grupos del sistema</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Grupo
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          Total: {filteredGroups.length} grupo{filteredGroups.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Nombre
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {currentGroups.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 2 : 1} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    {searchTerm ? 'No se encontraron grupos' : 'No hay grupos registrados'}
                  </td>
                </tr>
              ) : (
                currentGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{group.name}</div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(group)}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(group)}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-slate-400">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredGroups.length)} de{' '}
                {filteredGroups.length} resultados
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 border rounded transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}
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
                {/* Nombre */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: 101, A1, Grupo Matutino"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    El nombre del grupo debe ser único en el sistema
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Guardando...' : editingGroup ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              {groupToDelete && (
                <>
                  Se eliminará el grupo <strong>{groupToDelete.name}</strong>. Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
