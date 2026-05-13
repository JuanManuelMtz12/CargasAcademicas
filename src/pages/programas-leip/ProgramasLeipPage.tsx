import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
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
import { Plus, Edit, Trash2, Users, BookOpen, Calendar } from 'lucide-react';
import ManageTeachersModal from '@/components/ManageTeachersModal';
import CalendarioAcademicoModal from '@/components/CalendarioAcademicoModal';

interface LeipProgram {
  id: string;
  name: string;
  coordinator_id: string | null;
  sede_id: string | null;
  created_at?: string;
}

interface LeipProgramWithRelations extends LeipProgram {
  coordinador?: { id: string; name: string } | null;
  sede?: { id: string; name: string } | null;
  maestros_count: number;
  materias_count: number;
}

interface Sede {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  coordinator_id: string;
  sede_id: string;
}

export default function ProgramasLeipPage() {
  const [programs, setPrograms] = useState<LeipProgramWithRelations[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LeipProgramWithRelations | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<LeipProgramWithRelations | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isManageTeachersModalOpen, setIsManageTeachersModalOpen] = useState(false);
  const [managingProgram, setManagingProgram] = useState<LeipProgramWithRelations | null>(null);
  const [isCalendarioModalOpen, setIsCalendarioModalOpen] = useState(false);
  const [calendarioProgram, setCalendarioProgram] = useState<LeipProgramWithRelations | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    coordinator_id: '',
    sede_id: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPrograms(), loadSedes(), loadTeachers()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadPrograms = async () => {
    try {
      // Obtener programas LEIP con datos relacionados
      const { data: programsData, error: programsError } = await supabase
        .from('leip_programs')
        .select(`
          *,
          coordinador:coordinator_id (id, name),
          sede:sede_id (id, name)
        `)
        .order('name');

      if (programsError) throw programsError;

      // Obtener conteos para cada programa
      const programsWithCounts = await Promise.all(
        (programsData || []).map(async (program) => {
          // Contar maestros asignados
          const { count: maestrosCount } = await supabase
            .from('teacher_leip_program')
            .select('*', { count: 'exact', head: true })
            .eq('leip_program_id', program.id);

          // Contar materias
          const { count: materiasCount } = await supabase
            .from('leip_subjects')
            .select('*', { count: 'exact', head: true })
            .eq('leip_program_id', program.id);

          return {
            ...program,
            maestros_count: maestrosCount || 0,
            materias_count: materiasCount || 0,
          };
        })
      );

      setPrograms(programsWithCounts);
    } catch (error) {
      console.error('Error loading programs:', error);
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
    setEditingProgram(null);
    setFormData({
      name: '',
      coordinator_id: '',
      sede_id: '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (program: LeipProgramWithRelations) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      coordinator_id: program.coordinator_id || '',
      sede_id: program.sede_id || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProgram(null);
    setFormData({
      name: '',
      coordinator_id: '',
      sede_id: '',
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.sede_id) {
      newErrors.sede_id = 'La sede es requerida';
    }

    if (!formData.coordinator_id) {
      newErrors.coordinator_id = 'El coordinador es requerido';
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
      const programData = {
        name: formData.name.trim(),
        coordinator_id: formData.coordinator_id || null,
        sede_id: formData.sede_id || null,
      };

      if (editingProgram) {
        // Actualizar
        const { error } = await supabase
          .from('leip_programs')
          .update(programData)
          .eq('id', editingProgram.id);

        if (error) throw error;
        toast.success('Programa LEIP actualizado exitosamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('leip_programs')
          .insert([programData]);

        if (error) throw error;
        toast.success('Programa LEIP creado exitosamente');
      }

      closeModal();
      await loadPrograms();
    } catch (error: any) {
      console.error('Error saving program:', error);
      toast.error(error.message || 'Error al guardar el programa');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (program: LeipProgramWithRelations) => {
    setDeletingProgram(program);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingProgram(null);
  };

  const handleDelete = async () => {
    if (!deletingProgram) return;

    try {
      // Verificar si hay relaciones que impidan el borrado
      const { count: materiasCount } = await supabase
        .from('leip_subjects')
        .select('*', { count: 'exact', head: true })
        .eq('leip_program_id', deletingProgram.id);

      if (materiasCount && materiasCount > 0) {
        toast.error('No se puede eliminar el programa porque tiene materias asociadas');
        closeDeleteDialog();
        return;
      }

      const { count: maestrosCount } = await supabase
        .from('teacher_leip_program')
        .select('*', { count: 'exact', head: true })
        .eq('leip_program_id', deletingProgram.id);

      if (maestrosCount && maestrosCount > 0) {
        toast.error('No se puede eliminar el programa porque tiene maestros asignados');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('leip_programs')
        .delete()
        .eq('id', deletingProgram.id);

      if (error) throw error;

      toast.success('Programa LEIP eliminado exitosamente');
      closeDeleteDialog();
      await loadPrograms();
    } catch (error: any) {
      console.error('Error deleting program:', error);
      toast.error(error.message || 'Error al eliminar el programa');
    }
  };

  const openManageTeachersModal = (program: LeipProgramWithRelations) => {
    setManagingProgram(program);
    setIsManageTeachersModalOpen(true);
  };

  const closeManageTeachersModal = () => {
    setIsManageTeachersModalOpen(false);
    setManagingProgram(null);
  };

  const handleTeachersUpdate = async () => {
    // Recargar solo los programas para actualizar el contador
    await loadPrograms();
  };

  const openCalendarioModal = (program: LeipProgramWithRelations) => {
    setCalendarioProgram(program);
    setIsCalendarioModalOpen(true);
  };

  const closeCalendarioModal = () => {
    setIsCalendarioModalOpen(false);
    setCalendarioProgram(null);
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Programas LEIP</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de programas sabatinos
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Programa
        </Button>
      </div>

      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Lista de Programas LEIP</CardTitle>
          <CardDescription>
            {programs.length} programa{programs.length !== 1 ? 's' : ''} registrado{programs.length !== 1 ? 's' : ''}
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
                    <BookOpen className="w-4 h-4 inline mr-1" />
                    Módulos
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No hay programas LEIP registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  programs.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell className="font-medium">{program.name}</TableCell>
                      <TableCell>
                        {program.sede ? program.sede.name : '-'}
                      </TableCell>
                      <TableCell>
                        {program.coordinador ? program.coordinador.name : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => openManageTeachersModal(program)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-sm font-semibold hover:bg-green-200 hover:scale-110 transition-all cursor-pointer"
                          title="Gestionar maestros"
                        >
                          {program.maestros_count}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                          {program.materias_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCalendarioModal(program)}
                            className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Generar calendario académico"
                          >
                            <Calendar className="w-4 h-4" />
                            Calendario
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(program)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Link to={`/programas-leip/${program.id}/horarios`}>
  <Button variant="outline" size="sm" className="gap-1">
    <Clock className="w-4 h-4" />
    Horarios
  </Button>
</Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(program)}
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
                {editingProgram ? 'Editar Programa LEIP' : 'Nuevo Programa LEIP'}
              </DialogTitle>
              <DialogDescription>
                {editingProgram
                  ? 'Modifica los datos del programa LEIP'
                  : 'Completa los datos para crear un nuevo programa LEIP'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Nombre */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre del Programa <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: LEIP Preescolar"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
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

              {/* Coordinador */}
              <div className="grid gap-2">
                <Label htmlFor="coordinator">
                  Coordinador <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.coordinator_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, coordinator_id: value })
                  }
                >
                  <SelectTrigger
                    className={errors.coordinator_id ? 'border-red-500' : ''}
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
                {errors.coordinator_id && (
                  <p className="text-sm text-red-500">{errors.coordinator_id}</p>
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
                  : editingProgram
                  ? 'Actualizar'
                  : 'Crear Programa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Gestión de Maestros */}
      {managingProgram && (
        <ManageTeachersModal
          isOpen={isManageTeachersModalOpen}
          onClose={closeManageTeachersModal}
          programId={managingProgram.id}
          programName={managingProgram.name}
          onUpdate={handleTeachersUpdate}
          isLeipProgram={true}
        />
      )}

      {/* Modal de Generación de Calendario Académico */}
      {calendarioProgram && (
        <CalendarioAcademicoModal
          isOpen={isCalendarioModalOpen}
          onClose={closeCalendarioModal}
          programId={calendarioProgram.id}
          programName={calendarioProgram.name}
          isLeipProgram={true}
        />
      )}

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              programa <strong>{deletingProgram?.name}</strong>.
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
