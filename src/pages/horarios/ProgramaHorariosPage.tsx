import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import { useScheduleValidation, ValidationResult } from '@/hooks/useScheduleValidation';
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
import ConflictConfirmationModal from '@/components/ConflictConfirmationModal';
import RealTimeConflictChecker from '@/components/RealTimeConflictChecker';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Plus,
  Edit,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  User,
  BookOpen,
  Users,
  FileDown,
  TableProperties,
} from 'lucide-react';
import { generateOficioFromTemplate, downloadAllOficiosForAllTeachers } from '@/utils/oficioGenerator';
import { downloadTeacherSchedulePDF, TeacherScheduleRow, DayKey } from '@/utils/teacherSchedulePDF';
import { DaySchedule, MultiDayScheduleFormData, ScheduleValidationError, ValidationError } from '@/types/multi-day-schedule';

// Tipos de la base de datos
type Program = Database['public']['Tables']['programs']['Row'];
type SchoolCycle = Database['public']['Tables']['school_cycles']['Row'];
type Schedule = Database['public']['Tables']['schedule']['Row'];
type ScheduleInsert = Database['public']['Tables']['schedule']['Insert'];
type Teacher = Database['public']['Tables']['teachers']['Row'];
type Subject = Database['public']['Tables']['subjects']['Row'];
type Group = Database['public']['Tables']['groups']['Row'];

// Interfaces extendidas para datos relacionados
interface ProgramWithRelations extends Program {
  coordinador?: { id: string; name: string } | null;
  sede?: { id: string; name: string } | null;
}

interface TeacherWithCategory extends Teacher {
  category?: {
    id: string;
    category: string;
    subcategory: string | null;
    max_hours_week: number;
  } | null;
}

interface ScheduleWithRelations extends Schedule {
  teacher?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  group?: { id: string; name: string } | null;
}

// Configuración de días según el tipo de programa
const DAYS_BY_PROGRAM: Record<string, ('Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado')[]> = {
  'LIC': ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
  'LEIP': ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
  'MAE': ['Sábado'],
  'default': ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
};

export default function ProgramaHorariosPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();

  // Estados principales
  const [program, setProgram] = useState<ProgramWithRelations | null>(null);
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([]);
  const [schoolCycles, setSchoolCycles] = useState<SchoolCycle[]>([]);
  const [teachers, setTeachers] = useState<TeacherWithCategory[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del selector de período (persistente en la vista)
  const [selectedSchoolCycleId, setSelectedSchoolCycleId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // Estados del modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editingSchedules, setEditingSchedules] = useState<ScheduleWithRelations[]>([]); // Array completo de schedules en edición
  const [submitting, setSubmitting] = useState(false);
  const [hasRealTimeConflicts, setHasRealTimeConflicts] = useState(false);

  // Estados del modal de confirmación de eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schedulesToDelete, setSchedulesToDelete] = useState<ScheduleWithRelations[]>([]);

  // Formulario multi-día
  const [multiDayFormData, setMultiDayFormData] = useState<MultiDayScheduleFormData>({
    teacher_id: '',
    subject_id: '',
    group_id: '',
    school_cycle_id: '',
    days: []
  });

  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);

  // Hook de validación
  const { validateSchedule } = useScheduleValidation();

  // Efecto para cargar datos
  useEffect(() => {
    if (programId) {
      loadData();
    }
  }, [programId]);

  // Efecto para inicializar días según el tipo de programa
  useEffect(() => {
    if (program) {
      initializeDaySchedules();
    }
  }, [program]);

  // Función para cargar datos iniciales
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar programa
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select(`
          *,
          coordinator:teachers!programs_coordinator_id_fkey(id, name),
          sede:sedes(id, name)
        `)
        .eq('id', programId)
        .single();

      if (programError) throw programError;
      setProgram(programData);

      // Cargar horarios - filtrar a través de subjects que pertenecen al programa
      // Primero obtener los IDs de las materias del programa
      const { data: programSubjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id')
        .eq('program_id', programId);
      
      if (subjectsError) throw subjectsError;
      const subjectIds = programSubjects?.map(s => s.id) || [];
      
      // Luego obtener los horarios de esas materias
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule')
        .select(`
          *,
          teacher:teachers(id, name),
          subject:subjects(id, name),
          group:groups(id, name)
        `)
        .in('subject_id', subjectIds)
        .order('day')
        .order('start_hour');

      if (scheduleError) throw scheduleError;
      setSchedules(scheduleData || []);

      // Cargar ciclos escolares — solo los del tipo del programa actual
const { data: cyclesData, error: cyclesError } = await supabase
  .from('school_cycles')
  .select('*')
  .eq('is_active', true)
  .eq('cycle_type', programData.type)
  .order('name');

if (cyclesError) throw cyclesError;
setSchoolCycles(cyclesData || []);

// Cargar maestros SOLO del programa actual
const { data: teacherProgramData, error: teachersError } = await supabase
  .from('teacher_program')
  .select(`
    teacher:teachers(
      *,
      category:categories(id, category, subcategory, max_hours_week)
    )
  `)
  .eq('program_id', programId);

if (teachersError) throw teachersError;

// Aplanar y ordenar los maestros
const teachersForProgram: TeacherWithCategory[] =
  (teacherProgramData || [])
    .map((row: any) => row.teacher)
    .filter((t: any): t is TeacherWithCategory => !!t)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

setTeachers(teachersForProgram);

// Cargar materias del programa específico
const { data: subjectsDataFull, error: subjectsDataError } = await supabase
  .from('subjects')
  .select('*')
  .eq('program_id', programId)
  .order('name');

if (subjectsDataError) throw subjectsDataError;
setSubjects(subjectsDataFull || []);
      // Cargar grupos - los grupos son compartidos entre programas
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('name');

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Establecer ciclo activo por defecto
      const activeCycle = cyclesData?.find(cycle => cycle.is_active);
      if (activeCycle) {
        setSelectedSchoolCycleId(activeCycle.id);
        setMultiDayFormData(prev => ({ ...prev, school_cycle_id: activeCycle.id }));
      }

    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Función para inicializar los días según el programa
  const initializeDaySchedules = () => {
    if (!program) return;
    
    const programType = program.type || 'default';
    const availableDays = DAYS_BY_PROGRAM[programType] || DAYS_BY_PROGRAM.default;
    
    const initialDays: DaySchedule[] = availableDays.map(day => ({
      day,
      enabled: false,
      start_hour: 8,
      end_hour: 9
    }));
    
    setDaySchedules(initialDays);
  };

  // Función para actualizar horario de un día
  const updateDaySchedule = (index: number, updates: Partial<DaySchedule>) => {
    const newDays = [...daySchedules];
    newDays[index] = { ...newDays[index], ...updates };
    setDaySchedules(newDays);
    
    setMultiDayFormData(prev => ({
      ...prev,
      days: newDays
    }));
  };

  // Función para obtener errores de validación por día
  const getDayValidationErrors = (day: DaySchedule): ScheduleValidationError | null => {
    if (!day.enabled) return null;
    if (day.start_hour >= day.end_hour) {
      return { day: day.day, type: 'error', message: 'Hora de inicio debe ser menor a hora de fin' };
    }
    if (day.start_hour < 7 || day.end_hour > 21) {
      return { day: day.day, type: 'error', message: 'Horario debe estar entre 7:00 y 21:00' };
    }
    return null;
  };

  // Función para validar el formulario multi-día
  const validateMultiDayForm = (): ScheduleValidationError[] => {
    const enabledDays = daySchedules.filter(day => day.enabled);
    const errors: ScheduleValidationError[] = [];
    
    // Validaciones básicas
    if (!multiDayFormData.teacher_id || !multiDayFormData.subject_id || !multiDayFormData.group_id) {
      errors.push({ day: 'general', type: 'error', message: 'Debe completar todos los campos requeridos' });
      return errors;
    }
    
    // Validar días habilitados
    enabledDays.forEach(day => {
      const dayError = getDayValidationErrors(day);
      if (dayError) {
        errors.push(dayError);
      }
    });
    
    return errors;
  };

  // Función auxiliar para detectar tipo de conflicto
  const detectConflictType = async (
    teacher_id: string,
    subject_id: string,
    day: string,
    start_hour: number,
    end_hour: number,
    school_cycle_id: string | undefined,
    exclude_schedule_ids: string[] = []
  ): Promise<'none' | 'same_program' | 'different_program'> => {
    try {
      // Obtener el program_id de la materia actual
      const { data: currentSubject } = await supabase
        .from('subjects')
        .select('program_id')
        .eq('id', subject_id)
        .single();

      if (!currentSubject) return 'none';

      // Buscar schedules del mismo maestro en el mismo día que se empalman
      let query = supabase
        .from('schedule')
        .select(`
          id,
          start_hour,
          end_hour,
          subject:subjects!schedule_subject_id_fkey(id, program_id)
        `)
        .eq('teacher_id', teacher_id)
        .eq('day', day);

      if (school_cycle_id) {
        query = query.eq('school_cycle_id', school_cycle_id);
      }

      // Excluir schedules en edición
      if (exclude_schedule_ids.length > 0) {
        query = query.not('id', 'in', `(${exclude_schedule_ids.join(',')})`);
      }

      const { data: existingSchedules } = await query;

      if (!existingSchedules || existingSchedules.length === 0) {
        return 'none';
      }

      // Verificar empalmes
      let hasSameProgramConflict = false;
      let hasDifferentProgramConflict = false;

      for (const schedule of existingSchedules) {
        // Verificar si hay solapamiento de horas
        const hasOverlap = !(
          end_hour <= schedule.start_hour || start_hour >= schedule.end_hour
        );

        if (hasOverlap) {
          const subject = Array.isArray(schedule.subject)
            ? schedule.subject[0]
            : schedule.subject;

          if (subject?.program_id === currentSubject.program_id) {
            hasSameProgramConflict = true;
          } else {
            hasDifferentProgramConflict = true;
          }
        }
      }

      // Prioridad: same_program es más crítico que different_program
      if (hasSameProgramConflict) {
        return 'same_program';
      } else if (hasDifferentProgramConflict) {
        return 'different_program';
      }

      return 'none';
    } catch (error) {
      console.error('Error detecting conflict type:', error);
      return 'none';
    }
  };

  // Función para actualizar el conflict_type de schedules existentes que se empalman
  const updateConflictingSchedules = async (
    teacher_id: string,
    subject_id: string,
    day: string,
    start_hour: number,
    end_hour: number,
    school_cycle_id: string | undefined,
    new_program_id: string
  ) => {
    try {
      // Buscar schedules del mismo maestro en el mismo día
      let query = supabase
        .from('schedule')
        .select(`
          id,
          start_hour,
          end_hour,
          subject:subjects!schedule_subject_id_fkey(id, program_id)
        `)
        .eq('teacher_id', teacher_id)
        .eq('day', day);

      if (school_cycle_id) {
        query = query.eq('school_cycle_id', school_cycle_id);
      }

      const { data: existingSchedules } = await query;

      if (!existingSchedules || existingSchedules.length === 0) {
        return;
      }

      // Actualizar cada schedule que se empalme
      for (const schedule of existingSchedules) {
        // Verificar si hay solapamiento de horas
        const hasOverlap = !(
          end_hour <= schedule.start_hour || start_hour >= schedule.end_hour
        );

        if (hasOverlap) {
          const subject = Array.isArray(schedule.subject)
            ? schedule.subject[0]
            : schedule.subject;

          let newConflictType: 'none' | 'same_program' | 'different_program' = 'none';

          if (subject?.program_id === new_program_id) {
            newConflictType = 'same_program';
          } else {
            newConflictType = 'different_program';
          }

          // Actualizar el schedule existente
          await supabase
            .from('schedule')
            .update({ conflict_type: newConflictType })
            .eq('id', schedule.id);
        }
      }
    } catch (error) {
      console.error('Error updating conflicting schedules:', error);
    }
  };

  // Función para procesar envío multi-día
  const handleMultiDaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const enabledDays = daySchedules.filter(day => day.enabled);
    const validationErrors = validateMultiDayForm();
    
    // Verificar si hay errores fatales
    const fatalErrors = validationErrors.filter(err => err.type === 'error');
    if (fatalErrors.length > 0) {
      toast.error('Corrige los errores antes de continuar');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Si estamos editando, primero eliminar los schedules existentes del grupo
      if (editingSchedule) {
  const idsToDelete = editingSchedules.map((s) => s.id);

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('schedule')
      .delete()
      .in('id', idsToDelete); // 🔴 eliminamos por ID, no por los valores actuales del formulario

    if (deleteError) {
      toast.error(`Error al actualizar: ${deleteError.message}`);
      setSubmitting(false);
      return;
    }
  }
}
      
      const successResults: string[] = [];
      const errorResults: string[] = [];
      
      // Crear horarios para cada día habilitado con detección de conflictos
      for (const day of enabledDays) {
        try {
          // Obtener program_id de la materia
          const { data: currentSubject } = await supabase
            .from('subjects')
            .select('program_id')
            .eq('id', multiDayFormData.subject_id)
            .single();

          // Detectar tipo de conflicto para este día
          const conflictType = await detectConflictType(
            multiDayFormData.teacher_id,
            multiDayFormData.subject_id,
            day.day,
            day.start_hour,
            day.end_hour,
            multiDayFormData.school_cycle_id,
            editingSchedules.map(s => s.id)
          );

          const scheduleData: ScheduleInsert = {
            teacher_id: multiDayFormData.teacher_id,
            subject_id: multiDayFormData.subject_id,
            group_id: multiDayFormData.group_id,
            school_cycle_id: multiDayFormData.school_cycle_id,
            day: day.day,
            start_hour: day.start_hour,
            end_hour: day.end_hour,
            conflict_type: conflictType
          };
          
          const { data: insertedSchedule, error } = await supabase
            .from('schedule')
            .insert(scheduleData)
            .select('id')
            .single();
          
          if (error) {
            errorResults.push(`${day.day}: ${error.message}`);
          } else {
            // CRÍTICO: Recalcular conflict_type de TODOS los schedules del maestro en este día
            // Esto garantiza que todos los schedules (incluyendo el nuevo) tengan el conflict_type correcto
            // basándose en TODOS sus empalmes, no solo en el nuevo
            let scheduleQuery = supabase
              .from('schedule')
              .select('id')
              .eq('teacher_id', multiDayFormData.teacher_id)
              .eq('day', day.day);

            if (multiDayFormData.school_cycle_id) {
              scheduleQuery = scheduleQuery.eq('school_cycle_id', multiDayFormData.school_cycle_id);
            }

            const { data: allSchedulesThisDay } = await scheduleQuery;

            if (allSchedulesThisDay && allSchedulesThisDay.length > 0) {
              // Recalcular cada schedule (incluyendo el recién insertado)
              for (const sch of allSchedulesThisDay) {
                await recalculateConflictType(sch.id);
              }
            }

            const conflictLabel = conflictType === 'same_program' ? ' 🔴' : 
                                 conflictType === 'different_program' ? ' 🟡' : '';
            successResults.push(`${day.day} (${day.start_hour}:00-${day.end_hour}:00)${conflictLabel}`);
          }
        } catch (err: any) {
          errorResults.push(`${day.day}: ${err.message}`);
        }
      }
      
      // Mostrar resultados
      if (successResults.length > 0) {
        const action = editingSchedule ? 'Actualizados' : 'Creados';
        toast.success(`${action} exitosamente: ${successResults.join(', ')}`);
      }
      if (errorResults.length > 0) {
        toast.error(`Errores: ${errorResults.join(', ')}`);
      }
      
      // Recargar datos si hay éxitos
      if (successResults.length > 0) {
        await loadData();
        closeModal();
      }
      
    } catch (err: any) {
      console.error('Error saving schedules:', err);
      toast.error('Error al guardar los horarios');
    } finally {
      setSubmitting(false);
    }
  };

  // Función para recalcular el conflict_type de schedules específicos
  const recalculateConflictType = async (schedule_id: string) => {
    try {
      // Obtener el schedule
      const { data: schedule } = await supabase
        .from('schedule')
        .select(`
          id,
          teacher_id,
          subject_id,
          day,
          start_hour,
          end_hour,
          school_cycle_id,
          subject:subjects!schedule_subject_id_fkey(id, program_id)
        `)
        .eq('id', schedule_id)
        .single();

      if (!schedule) return;

      const subject = Array.isArray(schedule.subject) 
        ? schedule.subject[0] 
        : schedule.subject;

      if (!subject) return;

      // Buscar todos los schedules del mismo maestro en el mismo día (excluyendo el actual)
      let query = supabase
        .from('schedule')
        .select(`
          id,
          start_hour,
          end_hour,
          subject:subjects!schedule_subject_id_fkey(id, program_id)
        `)
        .eq('teacher_id', schedule.teacher_id)
        .eq('day', schedule.day)
        .neq('id', schedule_id);

      if (schedule.school_cycle_id) {
        query = query.eq('school_cycle_id', schedule.school_cycle_id);
      }

      const { data: otherSchedules } = await query;

      // Determinar conflict_type basado en empalmes
      let hasSameProgramConflict = false;
      let hasDifferentProgramConflict = false;

      if (otherSchedules) {
        for (const other of otherSchedules) {
          // Verificar solapamiento
          const hasOverlap = !(
            schedule.end_hour <= other.start_hour || 
            schedule.start_hour >= other.end_hour
          );

          if (hasOverlap) {
            const otherSubject = Array.isArray(other.subject)
              ? other.subject[0]
              : other.subject;

            if (otherSubject?.program_id === subject.program_id) {
              hasSameProgramConflict = true;
            } else {
              hasDifferentProgramConflict = true;
            }
          }
        }
      }

      // Determinar nuevo conflict_type
      const newConflictType = hasSameProgramConflict ? 'same_program' :
                              hasDifferentProgramConflict ? 'different_program' :
                              'none';

      // Actualizar schedule
      await supabase
        .from('schedule')
        .update({ conflict_type: newConflictType })
        .eq('id', schedule_id);

    } catch (error) {
      console.error('Error recalculating conflict type:', error);
    }
  };

  // Función para eliminar horario
  const handleDelete = async (schedules: ScheduleWithRelations[]) => {
    setSchedulesToDelete(schedules);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (schedulesToDelete.length === 0) return;
    
    try {
      // Obtener IDs únicos de schedules relacionados para recalcular después
      const relatedScheduleIds = new Set<string>();
      
      // Buscar schedules del mismo maestro en los mismos días para recalcular después
      for (const schedule of schedulesToDelete) {
        const { data: relatedSchedules } = await supabase
          .from('schedule')
          .select('id')
          .eq('teacher_id', schedule.teacher_id)
          .eq('day', schedule.day)
          .neq('id', schedule.id);

        if (relatedSchedules) {
          relatedSchedules.forEach(s => relatedScheduleIds.add(s.id));
        }
      }

      // Eliminar todos los schedules de esta asignación completa
      // Usar los IDs de todos los schedules a eliminar
      const idsToDelete = schedulesToDelete.map(s => s.id);
      
      const { error } = await supabase
        .from('schedule')
        .delete()
        .in('id', idsToDelete);
      
      if (error) {
        toast.error(`Error al eliminar: ${error.message}`);
      } else {
        // Recalcular conflict_type de schedules relacionados
        for (const relatedId of relatedScheduleIds) {
          await recalculateConflictType(relatedId);
        }

        toast.success('Asignación eliminada exitosamente');
        await loadData();
      }
      
    } catch (err: any) {
      console.error('Error deleting schedules:', err);
      toast.error('Error al eliminar la asignación');
    } finally {
      setDeleteDialogOpen(false);
      setSchedulesToDelete([]);
    }
  };

  // Función para abrir modal
  const openModal = (scheduleOrSchedules?: Schedule | ScheduleWithRelations[]) => {
    setIsModalOpen(true);
    
    // Si es un array de schedules (edición desde tabla agrupada)
    if (Array.isArray(scheduleOrSchedules)) {
      const schedulesToEdit = scheduleOrSchedules as ScheduleWithRelations[];
      
      if (schedulesToEdit.length > 0) {
        const firstSchedule = schedulesToEdit[0];
        
        // Establecer el primer schedule como editingSchedule para referencia
        setEditingSchedule(firstSchedule as Schedule);
        // Guardar TODOS los schedules que estamos editando (para excluir de validación)
        setEditingSchedules(schedulesToEdit);
        
        // Cargar datos del formulario
        setMultiDayFormData({
          teacher_id: firstSchedule.teacher_id,
          subject_id: firstSchedule.subject_id,
          group_id: firstSchedule.group_id,
          school_cycle_id: firstSchedule.school_cycle_id,
          days: []
        });
        
        // Inicializar días según el tipo de programa
        const programType = program?.type || 'default';
        const availableDays = DAYS_BY_PROGRAM[programType] || DAYS_BY_PROGRAM.default;
        
        // Crear mapa de schedules por día
        const schedulesByDay = new Map<string, ScheduleWithRelations>();
        schedulesToEdit.forEach(schedule => {
          schedulesByDay.set(schedule.day, schedule);
        });
        
        // Configurar daySchedules con los datos existentes
        const initialDays: DaySchedule[] = availableDays.map(day => {
          const existingSchedule = schedulesByDay.get(day);
          
          return {
            day,
            enabled: !!existingSchedule,
            start_hour: existingSchedule?.start_hour || 8,
            end_hour: existingSchedule?.end_hour || 10
          };
        });
        
        setDaySchedules(initialDays);
      }
    } 
    // Si es un solo schedule (edición legacy o desde otra parte)
    else if (scheduleOrSchedules) {
      const singleSchedule = scheduleOrSchedules as Schedule;
      setEditingSchedule(singleSchedule);
      
      // Buscar todos los schedules relacionados (mismo grupo, maestro, materia)
      const relatedSchedules = schedules.filter(s => 
        s.group_id === singleSchedule.group_id &&
        s.teacher_id === singleSchedule.teacher_id &&
        s.subject_id === singleSchedule.subject_id
      );
      
      // Guardar TODOS los schedules relacionados (para excluir de validación)
      setEditingSchedules(relatedSchedules);
      
      // Cargar datos del formulario
      setMultiDayFormData({
        teacher_id: singleSchedule.teacher_id,
        subject_id: singleSchedule.subject_id,
        group_id: singleSchedule.group_id,
        school_cycle_id: singleSchedule.school_cycle_id,
        days: []
      });
      
      // Inicializar días según el tipo de programa
      const programType = program?.type || 'default';
      const availableDays = DAYS_BY_PROGRAM[programType] || DAYS_BY_PROGRAM.default;
      
      // Crear mapa de schedules por día
      const schedulesByDay = new Map<string, ScheduleWithRelations>();
      relatedSchedules.forEach(schedule => {
        schedulesByDay.set(schedule.day, schedule);
      });
      
      // Configurar daySchedules con los datos existentes
      const initialDays: DaySchedule[] = availableDays.map(day => {
        const existingSchedule = schedulesByDay.get(day);
        
        return {
          day,
          enabled: !!existingSchedule,
          start_hour: existingSchedule?.start_hour || 8,
          end_hour: existingSchedule?.end_hour || 10
        };
      });
      
      setDaySchedules(initialDays);
    }
    // Si no hay schedule (nuevo)
    else {
      setEditingSchedule(null);
      setEditingSchedules([]); // Limpiar array de schedules en edición
      setMultiDayFormData({
        teacher_id: '',
        subject_id: '',
        group_id: '',
        school_cycle_id: selectedSchoolCycleId || schoolCycles.find(cycle => cycle.is_active)?.id || '',
        days: []
      });
      initializeDaySchedules();
    }
  };

  // Función para cerrar modal
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSchedule(null);
    setEditingSchedules([]); // Limpiar array de schedules en edición
    setMultiDayFormData({
      teacher_id: '',
      subject_id: '',
      group_id: '',
      school_cycle_id: '',
      days: []
    });
    setDaySchedules([]);
  };

  // Función para generar oficio de un maestro específico
  const handleGenerateOficio = async (teacherId: string) => {
    try {
      await generateOficioFromTemplate(teacherId, programId);
      toast.success('Oficio generado exitosamente');
    } catch (error: any) {
      console.error('Error generating oficio:', error);
      toast.error(error.message || 'Error al generar el oficio');
    }
  };

  // Función para generar todos los oficios de este programa
  const handleGenerateAllOficios = async () => {
    try {
      toast.info('Generando oficios... Este proceso puede tardar unos momentos', { duration: 3000 });
      await downloadAllOficiosForAllTeachers(programId!);
      toast.success('Todos los oficios generados exitosamente');
    } catch (error: any) {
      console.error('Error generating all oficios:', error);
      toast.error(error.message || 'Error al generar los oficios');
    }
  };

  // ── Descarga el horario individual del docente como PDF ───────────────────
  const handleDownloadTeacherSchedule = (teacherId: string, teacherName: string) => {
    try {
      // Filtrar asignaturas del docente en el ciclo seleccionado
      const teacherSchedules = schedules.filter(s => {
        if (s.teacher_id !== teacherId) return false;
        if (selectedSchoolCycleId && s.school_cycle_id !== selectedSchoolCycleId) return false;
        return true;
      });

      if (teacherSchedules.length === 0) {
        toast.error('El docente no tiene horarios asignados en este período');
        return;
      }

      // Detectar tipo de contrato desde la categoría
      const teacher = teachers.find(t => t.id === teacherId);
      const categoryStr = teacher?.category?.category?.toUpperCase() || '';
      const contractType = categoryStr.includes('BASE')
        ? 'BASE'
        : categoryStr.includes('INVITADO')
        ? 'INVITADO'
        : categoryStr || 'N/D';

      // Nombre del ciclo escolar
      const cycleName = schoolCycles.find(c => c.id === selectedSchoolCycleId)?.name || '';

      // Agrupar por materia + grupo (una fila por combinación)
      const grouped = new Map<string, TeacherScheduleRow>();

      teacherSchedules.forEach(s => {
        const key = `${s.subject_id}-${s.group_id}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            teacherName,
            contractType,
            programName: program?.name || '',
            sede: program?.sede?.name || '',
            subjectName: s.subject?.name || 'N/D',
            groupName: s.group?.name || 'N/D',
            daySchedules: {},
          });
        }
        const row = grouped.get(key)!;
        const day = s.day as DayKey;
        row.daySchedules[day] = { start: s.start_hour, end: s.end_hour };
      });

      downloadTeacherSchedulePDF(teacherName, contractType, Array.from(grouped.values()), cycleName);
      toast.success('Horario del docente descargado correctamente');
    } catch (error: any) {
      console.error('Error al descargar horario del docente:', error);
      toast.error('Error al generar el horario del docente');
    }
  };

  // Manejo de errores
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-red-600">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Error al cargar los datos</h2>
                <p>{error}</p>
                <Button onClick={loadData} className="mt-4">
                  Reintentar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const schedulesForFilters = selectedSchoolCycleId
    ? schedules.filter(s => s.school_cycle_id === selectedSchoolCycleId)
    : schedules;

  const uniqueGroupsInSchedules = [...new Map(
    schedulesForFilters.filter(s => s.group).map(s => [s.group_id, { id: s.group_id, name: s.group!.name }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const uniqueTeachersInSchedules = [...new Map(
    schedulesForFilters.filter(s => s.teacher).map(s => [s.teacher_id, { id: s.teacher_id, name: s.teacher!.name }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/programas')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                LICENCIATURA EN {program?.name}
              </h1>
              <p className="text-gray-600">
                {program?.sede?.name}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Asignación
            </Button>
            <Button
              onClick={handleGenerateAllOficios}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Generar Todos los Oficios
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-blue-900 min-w-fit">
                  Período Actual:
                </Label>
                <Select value={selectedSchoolCycleId} onValueChange={v => { setSelectedSchoolCycleId(v); setSelectedGroupId(''); setSelectedTeacherId(''); }}>
                  <SelectTrigger className="w-44 bg-white">
                    <SelectValue placeholder="Seleccione un período" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolCycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.name} {cycle.is_active && '(Activo)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-blue-900 min-w-fit">
                  Grupo:
                </Label>
                <Select value={selectedGroupId || 'all'} onValueChange={v => setSelectedGroupId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-44 bg-white">
                    <SelectValue placeholder="Todos los grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los grupos</SelectItem>
                    {uniqueGroupsInSchedules.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-blue-900 min-w-fit">
                  Maestro:
                </Label>
                <Select value={selectedTeacherId || 'all'} onValueChange={v => setSelectedTeacherId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-52 bg-white">
                    <SelectValue placeholder="Todos los maestros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los maestros</SelectItem>
                    {uniqueTeachersInSchedules.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de horarios */}
        <Card>
          <CardHeader>
            <CardTitle>Horarios Asignados</CardTitle>
            <CardDescription>
              Vista consolidada de horarios por grupo, maestro y materia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay horarios asignados</p>
                <p className="text-sm">Comienza asignando el primer horario</p>
              </div>
            ) : (
              (() => {
                // Agrupar schedules por grupo + maestro + materia
                interface GroupedSchedule {
  key: string;
  group: string;
  groupId: string;
  teacher: string;
  teacherId: string;
  subject: string;
  subjectId: string;
  schedules: ScheduleWithRelations[];
  daySchedules: {
    Lunes?: { start: number; end: number; scheduleId: string; conflictType: string };
    Martes?: { start: number; end: number; scheduleId: string; conflictType: string };
    Miércoles?: { start: number; end: number; scheduleId: string; conflictType: string };
    Jueves?: { start: number; end: number; scheduleId: string; conflictType: string };
    Viernes?: { start: number; end: number; scheduleId: string; conflictType: string };
  };
  totalHours: number;
}

// NUEVO: calcular empalmes de grupo
const conflictOverrides: Record<string, 'same_program' | 'different_program' | 'none'> = {};

const filteredByPeriod = selectedSchoolCycleId
  ? schedules.filter(s => s.school_cycle_id === selectedSchoolCycleId)
  : schedules;

for (let i = 0; i < filteredByPeriod.length; i++) {
  const a = filteredByPeriod[i];
  for (let j = i + 1; j < filteredByPeriod.length; j++) {
    const b = filteredByPeriod[j];

    if (a.group_id !== b.group_id || a.day !== b.day) continue;

    const hasOverlap = !(
      a.end_hour <= b.start_hour || a.start_hour >= b.end_hour
    );

    if (!hasOverlap) continue;

    conflictOverrides[a.id] = 'same_program';
    conflictOverrides[b.id] = 'same_program';
  }
}

                const grouped: Record<string, GroupedSchedule> = {};

                filteredByPeriod.forEach((schedule) => {
                  const key = `${schedule.group_id}-${schedule.teacher_id}-${schedule.subject_id}`;
                  
                  if (!grouped[key]) {
                    grouped[key] = {
                      key,
                      group: schedule.group?.name || 'N/A',
                      groupId: schedule.group_id,
                      teacher: schedule.teacher?.name || 'N/A',
                      teacherId: schedule.teacher_id,
                      subject: schedule.subject?.name || 'N/A',
                      subjectId: schedule.subject_id,
                      schedules: [],
                      daySchedules: {},
                      totalHours: 0
                    };
                  }

                  grouped[key].schedules.push(schedule);
                  
                  // Guardar horario por día con tipo de conflicto
                  const day = schedule.day as 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes';

const conflictType =
  conflictOverrides[schedule.id] || schedule.conflict_type || 'none';

grouped[key].daySchedules[day] = {
  start: schedule.start_hour,
  end: schedule.end_hour,
  scheduleId: schedule.id,
  conflictType,
};
                });

                // Calcular total de horas por maestro dentro del período seleccionado
                const teacherTotalHours: Record<string, number> = {};
                filteredByPeriod.forEach((schedule) => {
                  const hours = schedule.end_hour - schedule.start_hour;
                  if (!teacherTotalHours[schedule.teacher_id]) {
                    teacherTotalHours[schedule.teacher_id] = 0;
                  }
                  teacherTotalHours[schedule.teacher_id] += hours;
                });

                // Convertir a array, filtrar y ordenar
                const groupedArray = Object.values(grouped)
                  .filter(item => {
                    if (selectedGroupId && item.groupId !== selectedGroupId) return false;
                    if (selectedTeacherId && item.teacherId !== selectedTeacherId) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    if (a.group !== b.group) return a.group.localeCompare(b.group);
                    if (a.teacher !== b.teacher) return a.teacher.localeCompare(b.teacher);
                    return a.subject.localeCompare(b.subject);
                  });

                return (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Grupo</TableHead>
                          <TableHead className="w-48">Maestro</TableHead>
                          <TableHead className="w-48">Materia</TableHead>
                          <TableHead className="text-center w-24">Lun</TableHead>
                          <TableHead className="text-center w-24">Mar</TableHead>
                          <TableHead className="text-center w-24">Mie</TableHead>
                          <TableHead className="text-center w-24">Jue</TableHead>
                          <TableHead className="text-center w-24">Vie</TableHead>
                          <TableHead className="text-center w-28">Total Horas</TableHead>
                          <TableHead className="text-right w-32">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedArray.map((item) => (
                          <TableRow key={item.key}>
                            <TableCell className="font-medium">{item.group}</TableCell>
                            <TableCell>{item.teacher}</TableCell>
                            <TableCell>{item.subject}</TableCell>
                            
                            {/* Lunes */}
                            <TableCell className={`text-center text-xs ${
                              item.daySchedules.Lunes?.conflictType === 'same_program' ? 'bg-red-100' :
                              item.daySchedules.Lunes?.conflictType === 'different_program' ? 'bg-yellow-100' :
                              ''
                            }`}>
                              {item.daySchedules.Lunes ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-blue-600">
                                    {item.daySchedules.Lunes.start}-{item.daySchedules.Lunes.end}
                                  </span>
                                  {item.daySchedules.Lunes.conflictType !== 'none' && (
                                    <span className="text-xs mt-1">
                                      {item.daySchedules.Lunes.conflictType === 'same_program' ? '🔴 Empalme' : '🟡 Alerta'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            
                            {/* Martes */}
                            <TableCell className={`text-center text-xs ${
                              item.daySchedules.Martes?.conflictType === 'same_program' ? 'bg-red-100' :
                              item.daySchedules.Martes?.conflictType === 'different_program' ? 'bg-yellow-100' :
                              ''
                            }`}>
                              {item.daySchedules.Martes ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-blue-600">
                                    {item.daySchedules.Martes.start}-{item.daySchedules.Martes.end}
                                  </span>
                                  {item.daySchedules.Martes.conflictType !== 'none' && (
                                    <span className="text-xs mt-1">
                                      {item.daySchedules.Martes.conflictType === 'same_program' ? '🔴 Empalme' : '🟡 Alerta'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            
                            {/* Miércoles */}
                            <TableCell className={`text-center text-xs ${
                              item.daySchedules.Miércoles?.conflictType === 'same_program' ? 'bg-red-100' :
                              item.daySchedules.Miércoles?.conflictType === 'different_program' ? 'bg-yellow-100' :
                              ''
                            }`}>
                              {item.daySchedules.Miércoles ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-blue-600">
                                    {item.daySchedules.Miércoles.start}-{item.daySchedules.Miércoles.end}
                                  </span>
                                  {item.daySchedules.Miércoles.conflictType !== 'none' && (
                                    <span className="text-xs mt-1">
                                      {item.daySchedules.Miércoles.conflictType === 'same_program' ? '🔴 Empalme' : '🟡 Alerta'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            
                            {/* Jueves */}
                            <TableCell className={`text-center text-xs ${
                              item.daySchedules.Jueves?.conflictType === 'same_program' ? 'bg-red-100' :
                              item.daySchedules.Jueves?.conflictType === 'different_program' ? 'bg-yellow-100' :
                              ''
                            }`}>
                              {item.daySchedules.Jueves ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-blue-600">
                                    {item.daySchedules.Jueves.start}-{item.daySchedules.Jueves.end}
                                  </span>
                                  {item.daySchedules.Jueves.conflictType !== 'none' && (
                                    <span className="text-xs mt-1">
                                      {item.daySchedules.Jueves.conflictType === 'same_program' ? '🔴 Empalme' : '🟡 Alerta'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            
                            {/* Viernes */}
                            <TableCell className={`text-center text-xs ${
                              item.daySchedules.Viernes?.conflictType === 'same_program' ? 'bg-red-100' :
                              item.daySchedules.Viernes?.conflictType === 'different_program' ? 'bg-yellow-100' :
                              ''
                            }`}>
                              {item.daySchedules.Viernes ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-blue-600">
                                    {item.daySchedules.Viernes.start}-{item.daySchedules.Viernes.end}
                                  </span>
                                  {item.daySchedules.Viernes.conflictType !== 'none' && (
                                    <span className="text-xs mt-1">
                                      {item.daySchedules.Viernes.conflictType === 'same_program' ? '🔴 Empalme' : '🟡 Alerta'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            
                            {/* Total de horas del maestro */}
                            <TableCell className="text-center">
                              <span className="font-bold text-green-600 text-base">
                                {teacherTotalHours[item.teacherId] || 0}h
                              </span>
                            </TableCell>
                            
                            {/* Acciones */}
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadTeacherSchedule(item.teacherId, item.teacher)}
                                  title="Descargar Horario del Docente"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <TableProperties className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleGenerateOficio(item.teacherId)}
                                  title="Generar Oficio"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <FileDown className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openModal(item.schedules)}
                                  title="Editar"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(item.schedules)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()
            )}

          </CardContent>
        </Card>

        {/* Modal de horario */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Editar Horario' : 'Nueva Asignación'}
              </DialogTitle>
              <DialogDescription>
                Asigna una materia a uno o múltiples días de la semana. Activa los días que necesites y configura los horarios independientemente.
              </DialogDescription>
            </DialogHeader>

            <form id="multi-day-form" onSubmit={handleMultiDaySubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Maestro */}
                  <div className="space-y-2">
                    <Label htmlFor="multi-teacher">Maestro *</Label>
                    <Select
                      value={multiDayFormData.teacher_id}
                      onValueChange={(value) => setMultiDayFormData({ ...multiDayFormData, teacher_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar maestro" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Materia */}
                  <div className="space-y-2">
                    <Label htmlFor="multi-subject">Materia *</Label>
                    <Select
                      value={multiDayFormData.subject_id}
                      onValueChange={(value) => setMultiDayFormData({ ...multiDayFormData, subject_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar materia" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Grupo */}
                  <div className="space-y-2">
                    <Label htmlFor="multi-group">Grupo *</Label>
                    <Select
                      value={multiDayFormData.group_id}
                      onValueChange={(value) => setMultiDayFormData({ ...multiDayFormData, group_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tabla de días */}
                <div className="space-y-4">
                  <Label>Configurar Días de la Semana *</Label>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Activar</TableHead>
                          <TableHead>Día</TableHead>
                          <TableHead>Hora Inicio</TableHead>
                          <TableHead>Hora Fin</TableHead>
                          <TableHead className="w-20">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {daySchedules.map((day, index) => {
                          const error = getDayValidationErrors(day);
                          return (
                            <TableRow 
                              key={day.day}
                              className={!day.enabled ? 'opacity-50' : ''}
                            >
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={day.enabled}
                                  onChange={(e) => updateDaySchedule(index, { enabled: e.target.checked })}
                                  className="rounded border-gray-300"
                                />
                              </TableCell>
                              <TableCell className="font-medium">{day.day}</TableCell>
                              <TableCell>
                                <Select
                                  value={day.start_hour.toString()}
                                  onValueChange={(value) => updateDaySchedule(index, { start_hour: parseInt(value) })}
                                  disabled={!day.enabled}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => (
                                      <SelectItem key={hour} value={hour.toString()}>
                                        {hour}:00
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={day.end_hour.toString()}
                                  onValueChange={(value) => updateDaySchedule(index, { end_hour: parseInt(value) })}
                                  disabled={!day.enabled}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 14 }, (_, i) => i + 8).map((hour) => (
                                      <SelectItem key={hour} value={hour.toString()}>
                                        {hour}:00
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {error ? (
                                  <div className="flex items-center text-red-600">
                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Error</span>
                                  </div>
                                ) : day.enabled ? (
                                  <div className="flex items-center text-green-600">
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Listo</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Inactivo</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Resumen */}
                

                 {/* Validación en Tiempo Real para Multi-Día */}
{!submitting &&
  daySchedules.filter(day => day.enabled).length > 0 && 
  multiDayFormData.teacher_id &&
  multiDayFormData.subject_id &&
  multiDayFormData.group_id && (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900 text-sm">
        Verificación de Empalmes:
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {daySchedules
          .filter(day => day.enabled)
          .map(day => (
            <div
              key={day.day}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <p className="text-xs font-semibold text-gray-700 mb-1">
                {day.day}: {day.start_hour}:00 - {day.end_hour}:00
              </p>

<RealTimeConflictChecker
  teacher_id={multiDayFormData.teacher_id}
  subject_id={multiDayFormData.subject_id}
  group_id={multiDayFormData.group_id}
  day={day.day}
  start_hour={day.start_hour}
  end_hour={day.end_hour}
  school_cycle_id={multiDayFormData.school_cycle_id}
  program_id={programId}                                // 👈 PASAMOS LA LICENCIATURA ACTUAL
  exclude_schedule_ids={editingSchedules.map((s) => s.id)}
/>
            </div>
          ))}
      </div>
    </div>


                  )}
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
                  <Button
                    type="submit"
                    form="multi-day-form"
                    disabled={
                      submitting || 
                      !multiDayFormData.teacher_id || 
                      !multiDayFormData.subject_id || 
                      !multiDayFormData.group_id ||
                      daySchedules.filter(day => day.enabled).length === 0
                    }
                  >
                    {submitting ? 'Guardando...' : 'Guardar Horarios'}
                  </Button>
                </DialogFooter>
              </form>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmación de eliminación */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar asignación completa?</AlertDialogTitle>
              <AlertDialogDescription>
                {schedulesToDelete.length > 0 && schedulesToDelete[0] && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      Se eliminará la siguiente asignación completa:
                    </p>
                    <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                      <p>
                        <strong>Maestro:</strong> {schedulesToDelete[0].teacher?.name || 'N/A'}
                      </p>
                      <p>
                        <strong>Materia:</strong> {schedulesToDelete[0].subject?.name || 'N/A'}
                      </p>
                      <p>
                        <strong>Grupo:</strong> {schedulesToDelete[0].group?.name || 'N/A'}
                      </p>
                      <p>
                        <strong>Días:</strong> {schedulesToDelete.map(s => s.day).join(', ')}
                      </p>
                      <p>
                        <strong>Total de horas:</strong> {schedulesToDelete.reduce((acc, s) => acc + (s.end_hour - s.start_hour), 0)}h
                      </p>
                    </div>
                    <p className="text-sm text-red-600 font-medium mt-3">
                      Esta acción no se puede deshacer.
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar Asignación
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}