import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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
import { Plus, Edit, Trash2, Clock, Users, FileText, CalendarCheck } from 'lucide-react';
import ManageMaestriaTeachersModal from '@/components/ManageMaestriaTeachersModal';

interface MaestriaSabado {
  id: number;
  nombre: string;
  sede_id: number | null;
  coordinador_id: string | null;
  ciclo_id: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  coordinador?: { id: string; name: string } | null;
  sede?: { id: number; name: string } | null;
  maestros_count: number;
  horarios_count: number;
}

interface Sede {
  id: number;
  name: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface FormData {
  nombre: string;
  coordinador_id: string;
  sede_id: string;
}

export default function MaestriasSabatinasPage() {
  const [maestrias, setMaestrias] = useState<MaestriaSabado[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingMaestria, setEditingMaestria] = useState<MaestriaSabado | null>(null);
  const [deletingMaestria, setDeletingMaestria] = useState<MaestriaSabado | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isManageTeachersModalOpen, setIsManageTeachersModalOpen] = useState(false);
  const [managingMaestria, setManagingMaestria] = useState<MaestriaSabado | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    coordinador_id: '',
    sede_id: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMaestrias(), loadSedes(), loadTeachers()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadMaestrias = async () => {
    try {
      const { data: maestriasData, error: maestriasError } = await supabase
        .from('maestrias_sabado')
        .select(`
          *,
          coordinador:coordinador_id (id, name),
          sede:sede_id (id, name)
        `)
        .order('nombre');

      if (maestriasError) throw maestriasError;

      // Obtener conteos para cada maestría
      const maestriasWithCounts = await Promise.all(
        (maestriasData || []).map(async (maestria) => {
          // Contar maestros asignados
          const { count: maestrosCount } = await supabase
            .from('teacher_maestria_sabado')
            .select('*', { count: 'exact', head: true })
            .eq('maestria_id', maestria.id);

          // Contar horarios
          const { count: horariosCount } = await supabase
            .from('maestria_sabado_schedule')
            .select('*', { count: 'exact', head: true })
            .eq('maestria_id', maestria.id);

          return {
            ...maestria,
            maestros_count: maestrosCount || 0,
            horarios_count: horariosCount || 0,
          };
        })
      );

      setMaestrias(maestriasWithCounts);
    } catch (error) {
      console.error('Error loading maestrias:', error);
      throw error;
    }
  };

  const loadSedes = async () => {
    try {
      const { data, error } = await supabase
        .from('sedes')
        .select('*')
        .order('name');

      if (error) throw error;
      setSedes(data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
      throw error;
    }
  };

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('name');

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
      throw error;
    }
  };

  const openCreateModal = () => {
    setEditingMaestria(null);
    setFormData({
      nombre: '',
      coordinador_id: '',
      sede_id: '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (maestria: MaestriaSabado) => {
    setEditingMaestria(maestria);
    setFormData({
      nombre: maestria.nombre,
      coordinador_id: maestria.coordinador_id || '',
      sede_id: maestria.sede_id?.toString() || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMaestria(null);
    setFormData({
      nombre: '',
      coordinador_id: '',
      sede_id: '',
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.sede_id) {
      newErrors.sede_id = 'La sede es requerida';
    }

    if (!formData.coordinador_id) {
      newErrors.coordinador_id = 'El coordinador es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor corrija los errores en el formulario');
      return;
    }

    setSubmitting(true);

    try {
      const maestriaData = {
        nombre: formData.nombre.trim(),
        coordinador_id: formData.coordinador_id || null,
        sede_id: formData.sede_id || null,
      };

      if (editingMaestria) {
        // Actualizar
        const { error } = await supabase
          .from('maestrias_sabado')
          .update(maestriaData)
          .eq('id', editingMaestria.id);

        if (error) throw error;
        toast.success('Maestría actualizada exitosamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('maestrias_sabado')
          .insert([maestriaData]);

        if (error) throw error;
        toast.success('Maestría creada exitosamente');
      }

      closeModal();
      await loadMaestrias();
    } catch (error: any) {
      console.error('Error saving maestria:', error);
      toast.error(error.message || 'Error al guardar la maestría');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (maestria: MaestriaSabado) => {
    setDeletingMaestria(maestria);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingMaestria(null);
  };

  const handleDelete = async () => {
    if (!deletingMaestria) return;

    try {
      // Verificar si hay relaciones que impidan el borrado
      const { count: horariosCount } = await supabase
        .from('maestria_sabado_schedule')
        .select('*', { count: 'exact', head: true })
        .eq('maestria_id', deletingMaestria.id);

      if (horariosCount && horariosCount > 0) {
        toast.error('No se puede eliminar la maestría porque tiene horarios asociados');
        closeDeleteDialog();
        return;
      }

      const { count: maestrosCount } = await supabase
        .from('teacher_maestria_sabado')
        .select('*', { count: 'exact', head: true })
        .eq('maestria_id', deletingMaestria.id);

      if (maestrosCount && maestrosCount > 0) {
        toast.error('No se puede eliminar la maestría porque tiene maestros asignados');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('maestrias_sabado')
        .delete()
        .eq('id', deletingMaestria.id);

      if (error) throw error;

      toast.success('Maestría eliminada exitosamente');
      closeDeleteDialog();
      await loadMaestrias();
    } catch (error: any) {
      console.error('Error deleting maestria:', error);
      toast.error(error.message || 'Error al eliminar la maestría');
    }
  };

  const openManageTeachersModal = (maestria: MaestriaSabado) => {
    setManagingMaestria(maestria);
    setIsManageTeachersModalOpen(true);
  };

  const closeManageTeachersModal = () => {
    setIsManageTeachersModalOpen(false);
    setManagingMaestria(null);
  };

  const handleTeachersUpdate = async () => {
    // Recargar solo las maestrías para actualizar el contador
    await loadMaestrias();
  };

  // Filtrar maestrías por búsqueda
  const filteredMaestrias = maestrias.filter((maestria) =>
    maestria.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Maestrías Sabatinas</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de maestrías que se imparten los días sábado
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Maestría
        </Button>
      </div>

      {/* Búsqueda */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre de maestría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Lista de Maestrías Sabatinas</CardTitle>
          <CardDescription>
            {filteredMaestrias.length} maestría{filteredMaestrias.length !== 1 ? 's' : ''} encontrada{filteredMaestrias.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Coordinador</TableHead>
                  <TableHead className="text-center">
                    <Users className="w-4 h-4 inline mr-1" />
                    Maestros
                  </TableHead>
                  <TableHead className="text-center">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Horarios
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaestrias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No hay maestrías registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaestrias.map((maestria) => (
                    <TableRow key={maestria.id}>
                      <TableCell className="font-medium">{maestria.nombre}</TableCell>
                      <TableCell>
                        {maestria.sede ? maestria.sede.name : '-'}
                      </TableCell>
                      <TableCell>
                        {maestria.coordinador ? maestria.coordinador.name : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => openManageTeachersModal(maestria)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-sm font-semibold hover:bg-green-200 hover:scale-110 transition-all cursor-pointer"
                          title="Gestionar maestros"
                        >
                          {maestria.maestros_count}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-800 text-sm font-semibold">
                          {maestria.horarios_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            maestria.activo
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {maestria.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/maestrias-sabado/${maestria.id}/horarios`}>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Clock className="w-4 h-4" />
                              Horarios
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(maestria)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(maestria)}
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
                {editingMaestria ? 'Editar Maestría' : 'Nueva Maestría Sabatina'}
              </DialogTitle>
              <DialogDescription>
                {editingMaestria
                  ? 'Modifica los datos de la maestría sabatina'
                  : 'Completa los datos para crear una nueva maestría sabatina'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Nombre */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre de la Maestría <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  placeholder="Ej: Maestría en Educación Básica"
                  className={errors.nombre ? 'border-red-500' : ''}
                />
                {errors.nombre && (
                  <p className="text-sm text-red-500">{errors.nombre}</p>
                )}
              </div>

              {/* Sede */}
              <div className="grid gap-2">
                <Label htmlFor="sede">
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
                      <SelectItem key={sede.id} value={sede.id.toString()}>
                        {sede.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sede_id && (
                  <p className="text-sm text-red-500">{errors.sede_id}</p>
                )}
              </div>

              {/* Coordinador */}
              <div className="grid gap-2">
                <Label htmlFor="coordinator">
                  Coordinador <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.coordinador_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, coordinador_id: value })
                  }
                >
                  <SelectTrigger
                    className={errors.coordinador_id ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Selecciona el coordinador" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.coordinador_id && (
                  <p className="text-sm text-red-500">{errors.coordinador_id}</p>
                )}
              </div>

              {/* Info sobre horarios */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <CalendarCheck className="w-4 h-4 inline mr-1" />
                  Las clases se imparten los días sábado de 9:00 AM a 1:00 PM
                </p>
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
                  : editingMaestria
                  ? 'Actualizar'
                  : 'Crear Maestría'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Gestión de Maestros */}
      {managingMaestria && (
        <ManageMaestriaTeachersModal
          isOpen={isManageTeachersModalOpen}
          onClose={closeManageTeachersModal}
          maestriaId={managingMaestria.id}
          maestriaName={managingMaestria.nombre}
          onUpdate={handleTeachersUpdate}
        />
      )}

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la
              maestría <strong>{deletingMaestria?.nombre}</strong>.
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
