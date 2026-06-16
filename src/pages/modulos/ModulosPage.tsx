import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Edit, Trash2, BookOpen, Users, Building } from 'lucide-react';

type Module = Database['public']['Tables']['modules']['Row'];

interface ModuleWithRelations {
  id: string;
  name: string;
  group_id: string | null;
  sede_id: string | null;
  created_at?: string;
  group?: {
    id: string;
    name: string;
  } | null;
  sede?: {
    id: string;
    name: string;
  } | null;
}

interface Group {
  id: string;
  name: string;
}

interface Sede {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  group_id: string;
  sede_id: string;
}

export default function ModulosPage() {
  const [modules, setModules] = useState<ModuleWithRelations[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleWithRelations | null>(null);
  const [deletingModule, setDeletingModule] = useState<ModuleWithRelations | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    group_id: '',
    sede_id: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadModules(), loadGroups(), loadSedes()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select(`
          *,
          group:group_id (
            id,
            name
          ),
          sede:sede_id (
            id,
            name
          )
        `)
        .order('name');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error loading modules:', error);
      throw error;
    }
  };

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
      throw error;
    }
  };

  const loadSedes = async () => {
    try {
      const { data, error } = await supabase
        .from('sedes')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSedes(data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
      throw error;
    }
  };

  const openCreateModal = () => {
    setEditingModule(null);
    setFormData({
      name: '',
      group_id: '',
      sede_id: '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (module: ModuleWithRelations) => {
    setEditingModule(module);
    setFormData({
      name: module.name,
      group_id: module.group_id || '',
      sede_id: module.sede_id || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingModule(null);
    setFormData({
      name: '',
      group_id: '',
      sede_id: '',
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.group_id) {
      newErrors.group_id = 'El grupo es requerido';
    }

    if (!formData.sede_id) {
      newErrors.sede_id = 'La sede es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setSubmitting(true);

    try {
      const moduleData = {
        name: formData.name.trim(),
        group_id: formData.group_id,
        sede_id: formData.sede_id,
      };

      if (editingModule) {
        // Actualizar
        const { error } = await supabase
          .from('modules')
          .update(moduleData)
          .eq('id', editingModule.id);

        if (error) throw error;
        toast.success('Módulo actualizado exitosamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('modules')
          .insert([moduleData]);

        if (error) throw error;
        toast.success('Módulo creado exitosamente');
      }

      closeModal();
      await loadModules();
    } catch (error: any) {
      console.error('Error saving module:', error);
      toast.error(error.message || 'Error al guardar el módulo');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (module: ModuleWithRelations) => {
    setDeletingModule(module);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingModule(null);
  };

  const handleDelete = async () => {
    if (!deletingModule) return;

    try {
      // Verificar si hay materias asociadas
      const { count: subjectsCount } = await supabase
        .from('subjects')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', deletingModule.id);

      if (subjectsCount && subjectsCount > 0) {
        toast.error('No se puede eliminar el módulo porque tiene materias asociadas');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', deletingModule.id);

      if (error) throw error;

      toast.success('Módulo eliminado exitosamente');
      closeDeleteDialog();
      await loadModules();
    } catch (error: any) {
      console.error('Error deleting module:', error);
      toast.error(error.message || 'Error al eliminar el módulo');
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Módulos</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de módulos académicos
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Módulo
        </Button>
      </div>

      {/* Tabla de Módulos */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Lista de Módulos</CardTitle>
          <CardDescription>
            {modules.length} módulo{modules.length !== 1 ? 's' : ''} registrado{modules.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>
                    <Users className="w-4 h-4 inline mr-1" />
                    Grupo
                  </TableHead>
                  <TableHead>
                    <Building className="w-4 h-4 inline mr-1" />
                    Sede
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpen className="w-12 h-12 text-gray-400" />
                        <p>No hay módulos registrados</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  modules.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-gray-500" />
                          {module.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {module.group ? (
                          <span className="text-sm">{module.group.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {module.sede ? (
                          <span className="text-sm">{module.sede.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(module)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(module)}
                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Creación/Edición */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingModule ? 'Editar Módulo' : 'Nuevo Módulo'}
              </DialogTitle>
              <DialogDescription>
                {editingModule
                  ? 'Modifica los datos del módulo'
                  : 'Completa los datos para crear un nuevo módulo'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Nombre */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre del Módulo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: Módulo I, Módulo de Investigación"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Grupo */}
              <div className="grid gap-2">
                <Label htmlFor="group_id">
                  Grupo <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.group_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, group_id: value })
                  }
                >
                  <SelectTrigger className={errors.group_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona el grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.group_id && (
                  <p className="text-sm text-red-500">{errors.group_id}</p>
                )}
              </div>

              {/* Sede */}
              <div className="grid gap-2">
                <Label htmlFor="sede_id">
                  Sede <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.sede_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, sede_id: value })
                  }
                >
                  <SelectTrigger className={errors.sede_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes.map((sede) => (
                      <SelectItem key={sede.id} value={sede.id}>
                        {sede.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sede_id && (
                  <p className="text-sm text-red-500">{errors.sede_id}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? 'Guardando...'
                  : editingModule
                  ? 'Actualizar'
                  : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el módulo
              <strong> {deletingModule?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
