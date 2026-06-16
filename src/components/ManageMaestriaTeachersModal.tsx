import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, UserPlus, Users } from 'lucide-react';

interface Teacher {
  id: string;
  name: string;
}

interface AssignedTeacher extends Teacher {
  assigned_at: string;
}

interface ManageMaestriaTeachersModalProps {
  isOpen: boolean;
  onClose: () => void;
  maestriaId: number;
  maestriaName: string;
  onUpdate: () => void;
}

export default function ManageMaestriaTeachersModal({
  isOpen,
  onClose,
  maestriaId,
  maestriaName,
  onUpdate,
}: ManageMaestriaTeachersModalProps) {
  const [assignedTeachers, setAssignedTeachers] = useState<AssignedTeacher[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTeachers();
    }
  }, [isOpen, maestriaId]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      // Cargar maestros asignados
      const { data: assignedData, error: assignedError } = await supabase
        .from('teacher_maestria_sabado')
        .select(`
          teacher_id,
          created_at,
          teachers (
            id,
            name
          )
        `)
        .eq('maestria_id', maestriaId);

      if (assignedError) throw assignedError;

      // Transformar los datos asignados
      const assigned = (assignedData || []).map((item: any) => ({
        id: item.teachers.id,
        name: item.teachers.name,
        assigned_at: item.created_at,
      }));

      setAssignedTeachers(assigned);

      // Cargar todos los maestros
      const { data: allTeachersData, error: allTeachersError } = await supabase
        .from('teachers')
        .select('id, name')
        .order('name');

      if (allTeachersError) throw allTeachersError;

      // Filtrar maestros disponibles (no asignados)
      const assignedIds = assigned.map((t) => t.id);
      const available = (allTeachersData || []).filter(
        (t) => !assignedIds.includes(t.id)
      );

      setAvailableTeachers(available);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('Error al cargar los maestros');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!selectedTeacherId) {
      toast.error('Por favor selecciona un maestro');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('teacher_maestria_sabado').insert({
        teacher_id: selectedTeacherId,
        maestria_id: maestriaId,
      });

      if (error) throw error;

      toast.success('Maestro agregado exitosamente');
      setSelectedTeacherId('');
      await loadTeachers();
      onUpdate(); // Notificar al componente padre para actualizar el contador
    } catch (error: any) {
      console.error('Error adding teacher:', error);
      toast.error(error.message || 'Error al agregar el maestro');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (teacherId: string) => {
    setDeletingTeacherId(teacherId);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingTeacherId(null);
  };

  const handleRemoveTeacher = async () => {
    if (!deletingTeacherId) return;

    try {
      const { error } = await supabase
        .from('teacher_maestria_sabado')
        .delete()
        .eq('teacher_id', deletingTeacherId)
        .eq('maestria_id', maestriaId);

      if (error) throw error;

      toast.success('Maestro removido exitosamente');
      closeDeleteDialog();
      await loadTeachers();
      onUpdate(); // Notificar al componente padre para actualizar el contador
    } catch (error: any) {
      console.error('Error removing teacher:', error);
      toast.error(error.message || 'Error al remover el maestro');
    }
  };

  const deletingTeacher = assignedTeachers.find((t) => t.id === deletingTeacherId);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Gestionar Maestros - {maestriaName}
            </DialogTitle>
            <DialogDescription>
              Agrega o remueve maestros asignados a esta maestría sabatina
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Contador de maestros */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  Total de maestros asignados:
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  {assignedTeachers.length}
                </span>
              </div>
            </div>

            {/* Formulario para agregar maestro */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Agregar Nuevo Maestro
              </h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={selectedTeacherId}
                    onValueChange={setSelectedTeacherId}
                    disabled={availableTeachers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          availableTeachers.length === 0
                            ? 'No hay maestros disponibles'
                            : 'Selecciona un maestro'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddTeacher}
                  disabled={!selectedTeacherId || submitting}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Agregar
                </Button>
              </div>
              {availableTeachers.length === 0 && assignedTeachers.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Todos los maestros disponibles ya están asignados a esta maestría
                </p>
              )}
            </div>

            {/* Lista de maestros asignados */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Maestros Asignados ({assignedTeachers.length})
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : assignedTeachers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-slate-500" />
                  <p>No hay maestros asignados a esta maestría</p>
                  <p className="text-sm mt-1">Agrega maestros usando el formulario de arriba</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {assignedTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-slate-100">{teacher.name}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Asignado: {new Date(teacher.assigned_at).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(teacher.id)}
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t dark:border-slate-700">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas remover a <strong>{deletingTeacher?.name}</strong> de la maestría{' '}
              <strong>{maestriaName}</strong>?
              <br />
              <br />
              Esta acción no afectará los horarios ya asignados a este maestro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveTeacher}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover Maestro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
