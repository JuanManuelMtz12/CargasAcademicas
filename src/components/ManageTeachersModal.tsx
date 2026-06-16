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
import { TeacherCombobox } from "@/components/TeacherCombobox";
import { Button } from '@/components/ui/button';
import { Trash2, UserPlus, Users } from 'lucide-react';

interface Teacher {
  id: string;
  name: string;
}

interface AssignedTeacher extends Teacher {
  assigned_at: string;
}

interface ManageTeachersModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
  onUpdate: () => void;
  isLeipProgram?: boolean;
}

export default function ManageTeachersModal({
  isOpen,
  onClose,
  programId,
  programName,
  onUpdate,
  isLeipProgram = false,
}: ManageTeachersModalProps) {
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
  }, [isOpen, programId]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      // Determinar tabla y columna según tipo de programa
      const tableName = isLeipProgram ? 'teacher_leip_program' : 'teacher_program';
      const programIdColumn = isLeipProgram ? 'leip_program_id' : 'program_id';

      // Cargar maestros asignados
      const { data: assignedData, error: assignedError } = await supabase
        .from(tableName)
        .select(`
          teacher_id,
          created_at,
          teachers (
            id,
            name
          )
        `)
        .eq(programIdColumn, programId);

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
      const tableName = isLeipProgram ? 'teacher_leip_program' : 'teacher_program';
      const programIdColumn = isLeipProgram ? 'leip_program_id' : 'program_id';
      
      const insertData = {
        teacher_id: selectedTeacherId,
        [programIdColumn]: programId,
      };

      const { error } = await supabase.from(tableName).insert(insertData);

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
      const tableName = isLeipProgram ? 'teacher_leip_program' : 'teacher_program';
      const programIdColumn = isLeipProgram ? 'leip_program_id' : 'program_id';

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('teacher_id', deletingTeacherId)
        .eq(programIdColumn, programId);

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
              Gestionar Maestros - {programName}
            </DialogTitle>
            <DialogDescription>
              Agrega o remueve maestros asignados a este programa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Contador de maestros */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  Total de maestros asignados:
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  {assignedTeachers.length}
                </span>
              </div>
            </div>

            {/* Formulario para agregar maestro */}
            <div className="space-y-3">
<h3 className="text-sm font-semibold text-gray-900">
  Agregar Nuevo Maestro
</h3>

<div className="flex gap-2 mt-2">
  <div className="flex-1">
    <TeacherCombobox
      options={availableTeachers.map((teacher) => ({
        value: teacher.id,
        label: teacher.name,
      }))}
      value={selectedTeacherId}
      onChange={setSelectedTeacherId}
      placeholder={
        availableTeachers.length === 0
          ? "No hay maestros disponibles"
          : "Selecciona un maestro"
      }
      disabled={availableTeachers.length === 0}
    />
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
  <p className="mt-1 text-sm text-gray-500">
    Todos los maestros disponibles ya están asignados a este programa
  </p>
)}
            </div>

            {/* Lista de maestros asignados */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Maestros Asignados ({assignedTeachers.length})
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : assignedTeachers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No hay maestros asignados a este programa</p>
                  <p className="text-sm mt-1">Agrega maestros usando el formulario de arriba</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {assignedTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{teacher.name}</p>
                          <p className="text-xs text-gray-500">
                            Asignado: {new Date(teacher.assigned_at).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(teacher.id)}
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
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

          <div className="flex justify-end pt-4 border-t">
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
              ¿Deseas remover a <strong>{deletingTeacher?.name}</strong> del programa{' '}
              <strong>{programName}</strong>?
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
