import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, User, Users, Calendar, RefreshCw } from 'lucide-react';
import { ValidationResult } from '@/hooks/useScheduleValidation';

interface ConflictValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (formData: ScheduleFormData) => void;
  editingSchedule?: any;
  isSubmitting: boolean;
}

// Interfaces
interface ScheduleFormData {
  teacher_id: string;
  subject_id: string;
  group_id: string;
  day: string;
  start_hour: number;
  end_hour: number;
  school_cycle_id: string;
}

interface Option {
  id: string;
  name: string;
}

/**
 * Modal de validación de conflictos en tiempo real
 * Incluye formulario completo y validación mientras el usuario escribe
 */
export default function ConflictValidationModal({
  isOpen,
  onClose,
  onConfirm,
  editingSchedule,
  isSubmitting
}: ConflictValidationModalProps) {
  // Estados del formulario
  const [formData, setFormData] = useState<ScheduleFormData>({
    teacher_id: '',
    subject_id: '',
    group_id: '',
    day: '',
    start_hour: 8,
    end_hour: 10,
    school_cycle_id: '',
  });

  // Estados de opciones
  const [teacherOptions, setTeacherOptions] = useState<Option[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<Option[]>([]);
  const [groupOptions, setGroupOptions] = useState<Option[]>([]);
  const [cycleOptions, setCycleOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de validación
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (editingSchedule) {
        loadEditingData();
      }
    }
  }, [isOpen, editingSchedule]);

  // Función de ordenamiento personalizado para grupos (número + letra)
  const sortGroupsByNumberAndLetter = (groups: Option[]) => {
    return groups.sort((a, b) => {
      const matchA = a.name.match(/^(\d+)([A-Za-z]*)$/);
      const matchB = b.name.match(/^(\d+)([A-Za-z]*)$/);

      if (matchA && matchB) {
        const numA = parseInt(matchA[1], 10);
        const numB = parseInt(matchB[1], 10);
        const letterA = matchA[2] || '';
        const letterB = matchB[2] || '';

        if (numA !== numB) {
          return numA - numB;
        }
        return letterA.localeCompare(letterB);
      }
      return a.name.localeCompare(b.name);
    });
  };

  // Cargar datos del modal
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Cargar opciones disponibles
      const [teachers, subjects, groups, cycles] = await Promise.all([
        supabase.from('teachers').select('id, name').order('name'),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('groups').select('id, name'),
        supabase.from('school_cycles').select('id, name').order('created_at', { ascending: false })
      ]);

      if (teachers.data) setTeacherOptions(teachers.data);
      if (subjects.data) setSubjectOptions(subjects.data);
      if (groups.data) setGroupOptions(sortGroupsByNumberAndLetter(groups.data));
      if (cycles.data) {
        setCycleOptions(cycles.data);
        // Seleccionar el ciclo más reciente por defecto
        if (cycles.data.length > 0) {
          setFormData(prev => ({ ...prev, school_cycle_id: cycles.data[0].id }));
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos del horario a editar
  const loadEditingData = () => {
    if (editingSchedule) {
      setFormData({
        teacher_id: editingSchedule.teacher_id || '',
        subject_id: editingSchedule.subject_id || '',
        group_id: editingSchedule.group_id || '',
        day: editingSchedule.day || '',
        start_hour: editingSchedule.start_hour || 8,
        end_hour: editingSchedule.end_hour || 10,
        school_cycle_id: editingSchedule.school_cycle_id || '',
      });
    }
  };

  // Validación en tiempo real
  useEffect(() => {
    if (isFormValid()) {
      validateInRealTime();
    } else {
      setValidationResult(null);
    }
  }, [formData.teacher_id, formData.subject_id, formData.group_id, formData.day, formData.start_hour, formData.end_hour, formData.school_cycle_id]);

  // Verificar si el formulario tiene datos suficientes para validar
  const isFormValid = () => {
    return formData.teacher_id && 
           formData.subject_id && 
           formData.group_id && 
           formData.day && 
           formData.start_hour < formData.end_hour &&
           formData.school_cycle_id;
  };

  // Validación en tiempo real
  const validateInRealTime = async () => {
    if (!isFormValid()) return;

    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-schedule-conflicts', {
        body: {
          ...formData,
          exclude_schedule_id: editingSchedule?.id,
        }
      });

      if (error) {
        console.warn('Edge Function no disponible, usando validación simplificada');
        await validateClientSide();
      } else {
        setValidationResult({
          ...data,
          validationMethod: 'edge-function'
        });
      }
    } catch (error) {
      console.warn('Error en validación:', error);
      await validateClientSide();
    } finally {
      setValidating(false);
    }
  };

  // Validación client-side como fallback
  const validateClientSide = async () => {
    try {
      const conflicts = {
        teacher_conflicts: [] as any[],
        group_conflicts: [] as any[],
        availability_conflicts: [] as any[],
      };

      // Verificar conflictos de maestro
      const { data: teacherSchedules } = await supabase
        .from('schedule')
        .select('id, start_hour, end_hour, day, teachers(name), subjects(name), groups(name)')
        .eq('teacher_id', formData.teacher_id)
        .eq('day', formData.day)
        .neq('id', editingSchedule?.id || '');

      if (teacherSchedules) {
        for (const schedule of teacherSchedules) {
          if (hasTimeOverlap(formData.start_hour, formData.end_hour, schedule.start_hour, schedule.end_hour)) {
            conflicts.teacher_conflicts.push({
              type: 'teacher_time_overlap',
              severity: 'critical',
              message: `El maestro ya tiene una clase en este horario`,
              details: {
                conflicting_schedule: schedule,
                conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
                day: formData.day,
                subject_name: 'Materia no especificada',
                group_name: 'Grupo no especificado'
              }
            });
          }
        }
      }

      // Verificar conflictos de grupo
      const { data: groupSchedules } = await supabase
        .from('schedule')
        .select('id, start_hour, end_hour, day, teachers(name), subjects(name), groups(name)')
        .eq('group_id', formData.group_id)
        .eq('day', formData.day)
        .neq('id', editingSchedule?.id || '');

      if (groupSchedules) {
        for (const schedule of groupSchedules) {
          if (hasTimeOverlap(formData.start_hour, formData.end_hour, schedule.start_hour, schedule.end_hour)) {
            conflicts.group_conflicts.push({
              type: 'group_time_overlap',
              severity: 'critical',
              message: `El grupo ya tiene una clase en este horario`,
              details: {
                conflicting_schedule: schedule,
                conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
                day: formData.day,
                teacher_name: 'Maestro no especificado',
                subject_name: 'Materia no especificada'
              }
            });
          }
        }
      }

      const totalConflicts = conflicts.teacher_conflicts.length + conflicts.group_conflicts.length;
      
      setValidationResult({
        valid: totalConflicts === 0,
        message: totalConflicts === 0 ? '✅ Horario disponible' : `⚠️ Se detectaron ${totalConflicts} conflicto(s)`,
        conflicts,
        summary: {
          total_conflicts: totalConflicts,
          critical_count: totalConflicts,
          warning_count: 0
        },
        validationMethod: 'client-side'
      });
    } catch (error) {
      console.error('Error en validación client-side:', error);
    }
  };

  // Verificar si dos rangos de tiempo se empalman
  const hasTimeOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
    return !(end1 <= start2 || start1 >= end2);
  };

  // Formatear día
  const formatDay = (day: string) => {
    const days: { [key: string]: string } = {
      'monday': 'Lunes', 'tuesday': 'Martes', 'wednesday': 'Miércoles',
      'thursday': 'Jueves', 'friday': 'Viernes', 'saturday': 'Sábado', 'sunday': 'Domingo'
    };
    return days[day.toLowerCase()] || day;
  };

  // Formatear hora
  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  // Manejar cambios en el formulario
  const handleInputChange = (field: keyof ScheduleFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Confirmar y enviar
  const handleConfirm = () => {
    onConfirm(formData);
  };

  if (loading) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Cargando datos...</span>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Complete todos los campos y valide antes de guardar. La validación se ejecuta automáticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
          {/* Formulario */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg mb-4">📋 Datos del Horario</h4>
            
            {/* Maestro */}
            <div>
              <label className="block text-sm font-medium mb-2">Maestro *</label>
              <select
                value={formData.teacher_id}
                onChange={(e) => handleInputChange('teacher_id', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Seleccionar maestro</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Materia */}
            <div>
              <label className="block text-sm font-medium mb-2">Materia/Módulo *</label>
              <select
                value={formData.subject_id}
                onChange={(e) => handleInputChange('subject_id', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Seleccionar materia</option>
                {subjectOptions.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Grupo */}
            <div>
              <label className="block text-sm font-medium mb-2">Grupo *</label>
              <select
                value={formData.group_id}
                onChange={(e) => handleInputChange('group_id', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Seleccionar grupo</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Día */}
            <div>
              <label className="block text-sm font-medium mb-2">Día *</label>
              <select
                value={formData.day}
                onChange={(e) => handleInputChange('day', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Seleccionar día</option>
                <option value="monday">Lunes</option>
                <option value="tuesday">Martes</option>
                <option value="wednesday">Miércoles</option>
                <option value="thursday">Jueves</option>
                <option value="friday">Viernes</option>
                <option value="saturday">Sábado</option>
                <option value="sunday">Domingo</option>
              </select>
            </div>

            {/* Horarios */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Hora Inicio *</label>
                <select
                  value={formData.start_hour}
                  onChange={(e) => handleInputChange('start_hour', parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  {Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => (
                    <option key={hour} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Hora Fin *</label>
                <select
                  value={formData.end_hour}
                  onChange={(e) => handleInputChange('end_hour', parseInt(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  {Array.from({ length: 14 }, (_, i) => i + 8).map((hour) => (
                    <option key={hour} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ciclo */}
            <div>
              <label className="block text-sm font-medium mb-2">Ciclo Escolar *</label>
              <select
                value={formData.school_cycle_id}
                onChange={(e) => handleInputChange('school_cycle_id', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Seleccionar ciclo</option>
                {cycleOptions.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Panel de Validación */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">🔍 Estado de Validación</h4>
              {validating && (
                <div className="flex items-center gap-2 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Validando...</span>
                </div>
              )}
            </div>

            {validationResult && (
              <div className={`p-4 rounded-lg border ${
                validationResult.valid 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className={`font-semibold ${
                  validationResult.valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {validationResult.message}
                </div>
                
                {/* Resumen de conflictos */}
                {validationResult.summary && (
                  <div className="text-sm mt-2">
                    <span className="text-gray-600">
                      Total: {validationResult.summary.total_conflicts} conflictos
                    </span>
                    {validationResult.validationMethod && (
                      <span className="ml-2 text-xs text-gray-500">
                        (Validación: {validationResult.validationMethod})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Detalles de Conflictos */}
            {!validationResult?.valid && validationResult?.conflicts && (
              <div className="space-y-3">
                {/* Conflictos de Maestro */}
                {validationResult.conflicts.teacher_conflicts.map((conflict, index) => (
                  <div key={`teacher-${index}`} className="bg-red-50 p-3 rounded border border-red-200">
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-red-800 font-medium">{conflict.message}</p>
                        {conflict.details && (
                          <div className="text-red-600 text-xs mt-2 space-y-1">
                            <div className="font-medium">Detalles del conflicto:</div>
                            {conflict.details.conflicting_schedule && (
                              <div>
                                <strong>Conflicto con:</strong><br />
                                📚 {conflict.details.subject_name}<br />
                                👥 {conflict.details.group_name}<br />
                                ⏰ {conflict.details.conflicting_time}<br />
                                📅 {formatDay(conflict.details.day)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Conflictos de Grupo */}
                {validationResult.conflicts.group_conflicts.map((conflict, index) => (
                  <div key={`group-${index}`} className="bg-red-50 p-3 rounded border border-red-200">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-red-800 font-medium">{conflict.message}</p>
                        {conflict.details && (
                          <div className="text-red-600 text-xs mt-2 space-y-1">
                            <div className="font-medium">Detalles del conflicto:</div>
                            {conflict.details.conflicting_schedule && (
                              <div>
                                <strong>Conflicto con:</strong><br />
                                👨‍🏫 {conflict.details.teacher_name}<br />
                                📚 {conflict.details.subject_name}<br />
                                ⏰ {conflict.details.conflicting_time}<br />
                                📅 {formatDay(conflict.details.day)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={isSubmitting || validating}
            className={validationResult?.valid ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {isSubmitting ? 'Guardando...' : validationResult?.valid ? '✅ Guardar' : '⚠️ Guardar con Conflictos'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}