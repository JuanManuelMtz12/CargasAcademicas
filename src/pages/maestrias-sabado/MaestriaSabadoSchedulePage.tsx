import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Edit, Trash2, Clock, CalendarCheck } from 'lucide-react';

interface MaestriaSabado {
  id: number;
  nombre: string;
}

interface Schedule {
  id: number;
  maestria_id: number;
  subject_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

interface FormData {
  subject_name: string;
  start_time: string;
  end_time: string;
}

export default function MaestriaSabadoSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [maestria, setMaestria] = useState<MaestriaSabado | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    subject_name: '',
    start_time: '09:00',
    end_time: '13:00',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMaestria(), loadSchedules()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadMaestria = async () => {
    try {
      const { data, error } = await supabase
        .from('maestrias_sabado')
        .select('id, nombre')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error('Maestría no encontrada');
        navigate('/maestrias-sabado');
        return;
      }

      setMaestria(data);
    } catch (error) {
      console.error('Error loading maestria:', error);
      throw error;
    }
  };

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('maestria_sabado_schedule')
        .select('*')
        .eq('maestria_id', id)
        .order('start_time');

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      throw error;
    }
  };

  const openCreateModal = () => {
    setEditingSchedule(null);
    setFormData({
      subject_name: '',
      start_time: '09:00',
      end_time: '13:00',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      subject_name: schedule.subject_name,
      start_time: schedule.start_time.substring(0, 5),
      end_time: schedule.end_time.substring(0, 5),
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSchedule(null);
    setFormData({
      subject_name: '',
      start_time: '09:00',
      end_time: '13:00',
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.subject_name.trim()) {
      newErrors.subject_name = 'El nombre de la materia es requerido';
    }

    if (!formData.start_time) {
      newErrors.start_time = 'La hora de inicio es requerida';
    }

    if (!formData.end_time) {
      newErrors.end_time = 'La hora de fin es requerida';
    }

    // Validar que la hora de inicio sea menor que la hora de fin
    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      newErrors.end_time = 'La hora de fin debe ser mayor que la hora de inicio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkScheduleConflicts = async (start: string, end: string, excludeId?: number): Promise<boolean> => {
    try {
      // Verificar empalmes con otros horarios de la misma maestría
      let query = supabase
        .from('maestria_sabado_schedule')
        .select('*')
        .eq('maestria_id', id);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Verificar empalmes
      const hasConflict = (data || []).some((schedule: Schedule) => {
        const scheduleStart = schedule.start_time.substring(0, 5);
        const scheduleEnd = schedule.end_time.substring(0, 5);

        // Verificar si hay empalme
        return (
          (start >= scheduleStart && start < scheduleEnd) ||
          (end > scheduleStart && end <= scheduleEnd) ||
          (start <= scheduleStart && end >= scheduleEnd)
        );
      });

      return hasConflict;
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor corrija los errores en el formulario');
      return;
    }

    setSubmitting(true);

    try {
      // Verificar empalmes antes de guardar
      const hasConflict = await checkScheduleConflicts(
        formData.start_time,
        formData.end_time,
        editingSchedule?.id
      );

      if (hasConflict) {
        toast.error('El horario se empalma con otro horario existente');
        setSubmitting(false);
        return;
      }

      const scheduleData = {
        maestria_id: parseInt(id!),
        subject_name: formData.subject_name.trim(),
        day_of_week: 6, // Siempre sábado
        start_time: formData.start_time + ':00',
        end_time: formData.end_time + ':00',
      };

      if (editingSchedule) {
        // Actualizar
        const { error } = await supabase
          .from('maestria_sabado_schedule')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (error) throw error;
        toast.success('Horario actualizado exitosamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('maestria_sabado_schedule')
          .insert([scheduleData]);

        if (error) throw error;
        toast.success('Horario creado exitosamente');
      }

      closeModal();
      await loadSchedules();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error(error.message || 'Error al guardar el horario');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (schedule: Schedule) => {
    setDeletingSchedule(schedule);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingSchedule(null);
  };

  const handleDelete = async () => {
    if (!deletingSchedule) return;

    try {
      const { error } = await supabase
        .from('maestria_sabado_schedule')
        .delete()
        .eq('id', deletingSchedule.id);

      if (error) throw error;

      toast.success('Horario eliminado exitosamente');
      closeDeleteDialog();
      await loadSchedules();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error(error.message || 'Error al eliminar el horario');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!maestria) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate('/maestrias-sabado')}
            className="mb-2 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Maestrías Sabatinas
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
            Horarios - {maestria.nombre}
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de horarios sabatinos (9:00 AM - 1:00 PM)
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Horario
        </Button>
      </div>

      {/* Info sobre horarios */}
      <Card className="dark:bg-slate-800 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <CalendarCheck className="w-5 h-5" />
            <p className="font-medium">
              Todas las clases se imparten los días sábado en el horario de 9:00 AM a 1:00 PM
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Lista de Horarios</CardTitle>
          <CardDescription>
            {schedules.length} horario{schedules.length !== 1 ? 's' : ''} registrado{schedules.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Materia</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Hora Inicio</TableHead>
                  <TableHead>Hora Fin</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No hay horarios registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{schedule.subject_name}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          Sábado
                        </span>
                      </TableCell>
                      <TableCell>{schedule.start_time.substring(0, 5)}</TableCell>
                      <TableCell>{schedule.end_time.substring(0, 5)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(schedule)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(schedule)}
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
                {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
              </DialogTitle>
              <DialogDescription>
                {editingSchedule
                  ? 'Modifica los datos del horario'
                  : 'Completa los datos para crear un nuevo horario sabatino'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Materia */}
              <div className="grid gap-2">
                <Label htmlFor="subject_name">
                  Nombre de la Materia <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subject_name"
                  value={formData.subject_name}
                  onChange={(e) =>
                    setFormData({ ...formData, subject_name: e.target.value })
                  }
                  placeholder="Ej: Metodología de la Investigación"
                  className={errors.subject_name ? 'border-red-500' : ''}
                />
                {errors.subject_name && (
                  <p className="text-sm text-red-500">{errors.subject_name}</p>
                )}
              </div>

              {/* Hora de Inicio */}
              <div className="grid gap-2">
                <Label htmlFor="start_time">
                  Hora de Inicio <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  className={errors.start_time ? 'border-red-500' : ''}
                />
                {errors.start_time && (
                  <p className="text-sm text-red-500">{errors.start_time}</p>
                )}
              </div>

              {/* Hora de Fin */}
              <div className="grid gap-2">
                <Label htmlFor="end_time">
                  Hora de Fin <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  className={errors.end_time ? 'border-red-500' : ''}
                />
                {errors.end_time && (
                  <p className="text-sm text-red-500">{errors.end_time}</p>
                )}
              </div>

              {/* Info sobre el día */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <Clock className="w-4 h-4 inline mr-1" />
                  El horario se asignará automáticamente para los días sábado
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
                  : editingSchedule
                  ? 'Actualizar'
                  : 'Crear Horario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el
              horario de <strong>{deletingSchedule?.subject_name}</strong>.
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
