import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import { Filter, Plus, Pencil, Trash2, X } from 'lucide-react';
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

type Availability = Database['public']['Tables']['availability']['Row'] & {
  teachers: Database['public']['Tables']['teachers']['Row'];
};

type Teacher = Database['public']['Tables']['teachers']['Row'];

type DayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado';

const DAYS_ORDER: DayOfWeek[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const HOURS_START = Array.from({ length: 16 }, (_, i) => i + 7); // 7-22
const HOURS_END = Array.from({ length: 16 }, (_, i) => i + 8); // 8-23

export default function DisponibilidadPage() {
  const { allowedPrograms, isAdmin, loading: permissionsLoading } = usePermissions();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeacherId, setFilterTeacherId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<Availability | null>(null);
  const [formData, setFormData] = useState({
    teacher_id: '',
    day: '' as DayOfWeek | '',
    start_hour: '',
    end_hour: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para el diálogo de confirmación de eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [availabilityToDelete, setAvailabilityToDelete] = useState<Availability | null>(null);

  useEffect(() => {
    if (!permissionsLoading) loadData();
  }, [permissionsLoading, allowedPrograms, isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      let allowedTeacherIds: string[] | null = null;

      // Para coordinadores, obtener solo los maestros de sus programas
      if (!isAdmin && allowedPrograms.length > 0) {
        const { data: teacherPrograms, error: tpError } = await supabase
          .from('teacher_program')
          .select('teacher_id')
          .in('program_id', allowedPrograms);

        if (tpError) throw tpError;
        allowedTeacherIds = [...new Set((teacherPrograms || []).map(tp => tp.teacher_id))];
      }

      // Cargar maestros (filtrados si es coordinador)
      let teachersQuery = supabase.from('teachers').select('*').order('name', { ascending: true });
      if (allowedTeacherIds !== null) {
        teachersQuery = allowedTeacherIds.length > 0
          ? teachersQuery.in('id', allowedTeacherIds)
          : teachersQuery.in('id', ['']);
      }
      const { data: teachersData, error: teachersError } = await teachersQuery;
      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

      // Cargar disponibilidad (filtrada si es coordinador)
      let availQuery = supabase.from('availability').select('*, teachers (*)');
      if (allowedTeacherIds !== null) {
        availQuery = allowedTeacherIds.length > 0
          ? availQuery.in('teacher_id', allowedTeacherIds)
          : availQuery.in('teacher_id', ['']);
      }
      const { data: availabilityData, error: availabilityError } = await availQuery;
      if (availabilityError) throw availabilityError;
      setAvailabilities(availabilityData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (availability?: Availability) => {
    if (availability) {
      setEditingAvailability(availability);
      setFormData({
        teacher_id: availability.teacher_id,
        day: availability.day as DayOfWeek,
        start_hour: availability.start_hour.toString(),
        end_hour: availability.end_hour.toString(),
      });
    } else {
      setEditingAvailability(null);
      setFormData({
        teacher_id: '',
        day: '',
        start_hour: '',
        end_hour: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAvailability(null);
    setFormData({
      teacher_id: '',
      day: '',
      start_hour: '',
      end_hour: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.teacher_id) {
      toast.error('El maestro es requerido');
      return;
    }

    if (!formData.day) {
      toast.error('El día es requerido');
      return;
    }

    if (!formData.start_hour) {
      toast.error('La hora de inicio es requerida');
      return;
    }

    if (!formData.end_hour) {
      toast.error('La hora de fin es requerida');
      return;
    }

    const startHour = parseInt(formData.start_hour);
    const endHour = parseInt(formData.end_hour);

    if (startHour >= endHour) {
      toast.error('La hora de inicio debe ser menor que la hora de fin');
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingAvailability) {
        // Actualizar
        const { error } = await supabase
          .from('availability')
          .update({
            teacher_id: formData.teacher_id,
            day: formData.day as DayOfWeek,
            start_hour: startHour,
            end_hour: endHour,
          })
          .eq('id', editingAvailability.id);

        if (error) throw error;
        toast.success('Disponibilidad actualizada correctamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('availability')
          .insert({
            teacher_id: formData.teacher_id,
            day: formData.day as DayOfWeek,
            start_hour: startHour,
            end_hour: endHour,
          });

        if (error) throw error;
        toast.success('Disponibilidad creada correctamente');
      }

      handleCloseModal();
      loadData();
    } catch (error: any) {
      console.error('Error saving availability:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (availability: Availability) => {
    setAvailabilityToDelete(availability);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!availabilityToDelete) return;

    try {
      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('id', availabilityToDelete.id);

      if (error) throw error;

      toast.success('Disponibilidad eliminada correctamente');
      loadData();
    } catch (error: any) {
      console.error('Error deleting availability:', error);
      toast.error('Error al eliminar: ' + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setAvailabilityToDelete(null);
    }
  };

  // Filtrar disponibilidad por maestro
  const filteredAvailabilities = availabilities.filter((availability) =>
    filterTeacherId ? availability.teacher_id === filterTeacherId : true
  );

  // Ordenar por maestro y día
  const sortedAvailabilities = [...filteredAvailabilities].sort((a, b) => {
    // Primero por nombre de maestro
    const teacherCompare = a.teachers.name.localeCompare(b.teachers.name);
    if (teacherCompare !== 0) return teacherCompare;

    // Luego por día
    const dayIndexA = DAYS_ORDER.indexOf(a.day as DayOfWeek);
    const dayIndexB = DAYS_ORDER.indexOf(b.day as DayOfWeek);
    return dayIndexA - dayIndexB;
  });

  const formatHour = (hour: number): string => {
    return `${hour.toString().padStart(2, '0')}:00`;
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Disponibilidad de Maestros</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de horarios disponibles de los docentes
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nueva Disponibilidad
        </button>
      </div>

      {/* Filtro por Maestro */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
          <select
            value={filterTeacherId}
            onChange={(e) => setFilterTeacherId(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          >
            <option value="">Todos los maestros</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          Total: {filteredAvailabilities.length} disponibilidad
          {filteredAvailabilities.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Maestro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Día
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Hora Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Hora Fin
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {sortedAvailabilities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    {filterTeacherId
                      ? 'No hay disponibilidad para el maestro seleccionado'
                      : 'No hay disponibilidad registrada'}
                  </td>
                </tr>
              ) : (
                sortedAvailabilities.map((availability) => (
                  <tr key={availability.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {availability.teachers.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-slate-100">{availability.day}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-slate-100">
                        {formatHour(availability.start_hour)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-slate-100">
                        {formatHour(availability.end_hour)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(availability)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(availability)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar"
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                {editingAvailability ? 'Editar Disponibilidad' : 'Nueva Disponibilidad'}
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
                {/* Maestro */}
                <div>
                  <label
                    htmlFor="teacher_id"
                    className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    Maestro <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="teacher_id"
                    value={formData.teacher_id}
                    onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  >
                    <option value="">Seleccione un maestro</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Día */}
                <div>
                  <label htmlFor="day" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Día <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="day"
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value as DayOfWeek })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  >
                    <option value="">Seleccione un día</option>
                    {DAYS_ORDER.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hora Inicio */}
                <div>
                  <label
                    htmlFor="start_hour"
                    className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    Hora Inicio <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="start_hour"
                    value={formData.start_hour}
                    onChange={(e) => setFormData({ ...formData, start_hour: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  >
                    <option value="">Seleccione hora de inicio</option>
                    {HOURS_START.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatHour(hour)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hora Fin */}
                <div>
                  <label
                    htmlFor="end_hour"
                    className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    Hora Fin <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="end_hour"
                    value={formData.end_hour}
                    onChange={(e) => setFormData({ ...formData, end_hour: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  >
                    <option value="">Seleccione hora de fin</option>
                    {HOURS_END.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatHour(hour)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Validación visual */}
                {formData.start_hour && formData.end_hour && (
                  <div
                    className={`border rounded-lg p-3 ${
                      parseInt(formData.start_hour) >= parseInt(formData.end_hour)
                        ? 'bg-red-50 border-red-200'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        parseInt(formData.start_hour) >= parseInt(formData.end_hour)
                          ? 'text-red-800'
                          : 'text-green-800'
                      }`}
                    >
                      {parseInt(formData.start_hour) >= parseInt(formData.end_hour)
                        ? '⚠️ La hora de inicio debe ser menor que la hora de fin'
                        : `✓ Disponibilidad: ${formatHour(parseInt(formData.start_hour))} - ${formatHour(parseInt(formData.end_hour))}`}
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
                  {isSubmitting ? 'Guardando...' : editingAvailability ? 'Actualizar' : 'Crear'}
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
            <AlertDialogTitle>¿Está seguro de eliminar esta disponibilidad?</AlertDialogTitle>
            <AlertDialogDescription>
              {availabilityToDelete && (
                <>
                  Se eliminará la disponibilidad de{' '}
                  <strong>{availabilityToDelete.teachers.name}</strong> el día{' '}
                  <strong>{availabilityToDelete.day}</strong>. Esta acción no se puede deshacer.
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
