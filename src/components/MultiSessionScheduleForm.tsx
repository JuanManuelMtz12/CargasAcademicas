/**
 * Componente: MultiSessionScheduleForm
 * 
 * Formulario inteligente para crear múltiples sesiones de una materia en una sola operación
 * con interfaz visual de cuadrícula de días de la semana
 * 
 * Características:
 * - Campos comunes (maestro, materia, grupo) que se llenan una sola vez
 * - Cuadrícula visual de días LUNES a VIERNES con campos de horario
 * - Solo llenar horarios en días que tienen asignaciones (2-3 días típicamente)
 * - Validación unificada de todas las sesiones
 * - Feedback visual de conflictos por sesión
 * - Operación atómica de guardado (todas o ninguna)
 * 
 * @author MiniMax Agent
 * @version 2.0 - Cuadrícula de días de la semana
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useMultipleScheduleValidation } from '@/hooks/useMultipleScheduleValidation';
import {
  ScheduleSession,
  MultiSessionScheduleFormData,
  CreateMultipleSchedulesRequest,
  CreateMultipleSchedulesResponse,
} from '@/types/multi-session-schedule';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CheckCircle, AlertCircle, AlertTriangle, Loader2, Calendar, Clock } from 'lucide-react';

// Días de la semana predefinidos
const WEEKDAYS = [
  { value: 'monday', label: 'LUNES', short: 'LUN' },
  { value: 'tuesday', label: 'MARTES', short: 'MAR' },
  { value: 'wednesday', label: 'MIÉRCOLES', short: 'MIÉ' },
  { value: 'thursday', label: 'JUEVES', short: 'JUE' },
  { value: 'friday', label: 'VIERNES', short: 'VIE' },
];

// Horas disponibles
const AVAILABLE_HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 a 21:00

interface DaySchedule {
  day: string;
  enabled: boolean;
  start_hour: number | null;
  end_hour: number | null;
}

interface MultiSessionScheduleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MultiSessionScheduleForm({
  isOpen,
  onClose,
  onSuccess,
}: MultiSessionScheduleFormProps) {
  // Estados del formulario
  const [formData, setFormData] = useState<MultiSessionScheduleFormData>({
    teacher_id: '',
    subject_id: '',
    group_id: '',
    school_cycle_id: '',
    sessions: [],
  });

  // Nuevo estado para la cuadrícula de días
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>(
    WEEKDAYS.map(day => ({
      day: day.value,
      enabled: false,
      start_hour: null,
      end_hour: null,
    }))
  );

  // Estados de validación y guardado
  const [submitting, setSubmitting] = useState(false);
  const { validateMultipleSessions } = useMultipleScheduleValidation();
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  // Estados para opciones de dropdowns
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [schoolCycles, setSchoolCycles] = useState<any[]>([]);

  // Cargar opciones para los dropdowns
  useEffect(() => {
    if (isOpen) {
      loadDropDownOptions();
    }
  }, [isOpen]);

  const loadDropDownOptions = async () => {
    try {
      // Cargar maestros
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('id, name')
        .order('name');

      // Cargar materias
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name');

      // Cargar grupos
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name')
        .order('name');

      // Cargar ciclos escolares
      const { data: cyclesData } = await supabase
        .from('school_cycles')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setTeachers(teachersData || []);
      setSubjects(subjectsData || []);
      setGroups(groupsData || []);
      setSchoolCycles(cyclesData || []);
    } catch (error) {
      console.error('Error cargando opciones:', error);
      toast.error('Error cargando opciones del formulario');
    }
  };

  /**
   * Actualiza un campo del formulario común
   */
  const updateFormData = (field: keyof MultiSessionScheduleFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Actualiza la programación de un día específico
   */
  const updateDaySchedule = (day: string, field: keyof DaySchedule, value: any) => {
    setDaySchedules(prev =>
      prev.map(ds => {
        if (ds.day === day) {
          const updated = { ...ds, [field]: value };
          
          // Si está habilitando el día, asegurar que tenga horarios válidos
          if (field === 'enabled' && value === true) {
            if (!updated.start_hour || !updated.end_hour) {
              updated.start_hour = 8;
              updated.end_hour = 9;
            }
          }
          
          // Si está deshabilitando, limpiar horarios
          if (field === 'enabled' && value === false) {
            updated.start_hour = null;
            updated.end_hour = null;
          }
          
          return updated;
        }
        return ds;
      })
    );
  };

  /**
   * Convierte las sesiones de días a sesiones válidas para el backend
   */
  const getActiveSessions = (): ScheduleSession[] => {
    return daySchedules
      .filter(ds => ds.enabled && ds.start_hour !== null && ds.end_hour !== null)
      .map(ds => ({
        tempId: `temp_${ds.day}_${ds.start_hour}_${ds.end_hour}`,
        day: ds.day as 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado',
        start_hour: ds.start_hour!,
        end_hour: ds.end_hour!
      }));
  };

  /**
   * Valida todas las sesiones activas
   */
  const handleValidate = async () => {
    if (!formData.teacher_id || !formData.subject_id || !formData.group_id) {
      toast.error('Complete todos los campos comunes');
      return;
    }

    const activeSessions = getActiveSessions();
    
    if (activeSessions.length === 0) {
      toast.error('Seleccione al menos un día con horarios');
      return;
    }

    setValidating(true);

    try {
      console.log('[VALIDAR] Validando sesiones:', activeSessions);
      
      const result = await validateMultipleSessions({
        teacher_id: formData.teacher_id,
        subject_id: formData.subject_id,
        group_id: formData.group_id,
        school_cycle_id: formData.school_cycle_id,
        sessions: activeSessions,
      });

      setValidationResult(result);
      
      if (result.valid) {
        toast.success('✅ Todas las sesiones son válidas');
      } else {
        toast.warning(`⚠️ ${result.summary.sessions_with_conflicts} sesión(es) tienen conflictos`);
      }
    } catch (error: any) {
      console.error('[ERROR] Error validando sesiones:', error);
      toast.error(error.message || 'Error al validar las sesiones');
    } finally {
      setValidating(false);
    }
  };

  /**
   * Guarda todas las sesiones en una operación atómica
   */
  const handleSubmit = async (forceSave = false) => {
    if (!formData.teacher_id || !formData.subject_id || !formData.group_id) {
      toast.error('Complete todos los campos comunes');
      return;
    }

    const activeSessions = getActiveSessions();
    
    if (activeSessions.length === 0) {
      toast.error('Seleccione al menos un día con horarios');
      return;
    }

    // Si no está forzando y tiene conflictos críticos, pedir confirmación
    if (!forceSave && validationResult && !validationResult.valid) {
      const hasCritical = validationResult.summary.critical_count > 0;
      
      if (hasCritical) {
        toast.error('Debe resolver los conflictos críticos antes de guardar o use "Guardar de todos modos"');
        return;
      }
    }

    setSubmitting(true);

    try {
      // Intentar guardar mediante Edge Function
      console.log('[GUARDAR MULTI-SESIÓN] Llamando a Edge Function...');
      
      const request: CreateMultipleSchedulesRequest = {
        teacher_id: formData.teacher_id,
        subject_id: formData.subject_id,
        group_id: formData.group_id,
        school_cycle_id: formData.school_cycle_id,
        sessions: activeSessions.map(s => ({
          day: s.day,
          start_hour: s.start_hour,
          end_hour: s.end_hour,
        })),
        force_save: forceSave || (validationResult?.summary.critical_count === 0),
      };

      const { data, error } = await supabase.functions.invoke('create-multiple-schedules', {
        body: request
      });

      if (error) {
        console.error('[GUARDAR MULTI-SESIÓN] Error Edge Function:', error);
        throw new Error(error.message || 'Error al crear las sesiones');
      }

      const result = data as CreateMultipleSchedulesResponse;

      if (!result.success) {
        throw new Error(result.message || 'Error al crear las sesiones');
      }

      console.log('[GUARDAR MULTI-SESIÓN] Respuesta:', result);

      toast.success(
        `✅ ${result.created_count} sesión(es) creada(s) exitosamente`,
        { duration: 3000 }
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[ERROR] Error guardando sesiones:', error);
      toast.error(error.message || 'Error al guardar las sesiones');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Obtiene los conflictos de una sesión específica
   */
  const getSessionConflicts = (day: string) => {
    if (!validationResult) return null;
    
    return validationResult.sessionResults.find(sr => sr.sessionTempId === `day-${day}`);
  };

  /**
   * Determina si una sesión tiene conflictos
   */
  const sessionHasConflicts = (day: string): boolean => {
    const conflicts = getSessionConflicts(day);
    if (!conflicts) return false;
    
    const { teacher_conflicts, group_conflicts, availability_conflicts } = conflicts.conflicts;
    return teacher_conflicts.length > 0 || group_conflicts.length > 0 || availability_conflicts.length > 0;
  };

  const activeSessions = getActiveSessions();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-6 w-6 text-green-600" />
            Nueva Asignación Multi-Sesión
          </DialogTitle>
          <DialogDescription>
            Complete la información común una sola vez y seleccione los días con sus horarios
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* SECCIÓN 1: DATOS COMUNES */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos Comunes</CardTitle>
              <CardDescription>
                Complete estos campos una sola vez para todas las sesiones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Maestro */}
                <div className="space-y-2">
                  <Label>Maestro *</Label>
                  <Select
                    value={formData.teacher_id}
                    onValueChange={(value) => updateFormData('teacher_id', value)}
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
                  <Label>Materia *</Label>
                  <Select
                    value={formData.subject_id}
                    onValueChange={(value) => updateFormData('subject_id', value)}
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
                  <Label>Grupo *</Label>
                  <Select
                    value={formData.group_id}
                    onValueChange={(value) => updateFormData('group_id', value)}
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

                {/* Ciclo Escolar */}
                <div className="space-y-2">
                  <Label>Ciclo Escolar *</Label>
                  <Select
                    value={formData.school_cycle_id}
                    onValueChange={(value) => updateFormData('school_cycle_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ciclo" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolCycles.map((cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id}>
                          {cycle.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECCIÓN 2: CUADRÍCULA DE DÍAS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Programación Semanal
              </CardTitle>
              <CardDescription>
                Seleccione los días que tendrán asignaciones y configure sus horarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Encabezados de días */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {WEEKDAYS.map((day) => (
                  <div key={day.value} className="text-center">
                    <Label className="text-sm font-semibold text-gray-700">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Cuadrícula de horarios */}
              <div className="space-y-4">
                {WEEKDAYS.map((weekday) => {
                  const daySchedule = daySchedules.find(ds => ds.day === weekday.value)!;
                  const conflicts = getSessionConflicts(weekday.value);
                  const hasConflicts = sessionHasConflicts(weekday.value);

                  return (
                    <div
                      key={weekday.value}
                      className={`grid grid-cols-5 gap-2 p-4 rounded-lg border-2 transition-all ${
                        daySchedule.enabled
                          ? hasConflicts
                            ? 'border-red-300 bg-red-50'
                            : 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {/* Checkbox para habilitar día */}
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={daySchedule.enabled}
                          onChange={(e) => updateDaySchedule(weekday.value, 'enabled', e.target.checked)}
                          className="h-5 w-5 text-green-600 rounded focus:ring-green-500"
                        />
                      </div>

                      {/* Hora Inicio */}
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Inicio</Label>
                        <Select
                          value={daySchedule.start_hour?.toString() || ''}
                          onValueChange={(value) =>
                            updateDaySchedule(weekday.value, 'start_hour', parseInt(value))
                          }
                          disabled={!daySchedule.enabled}
                        >
                          <SelectTrigger className={!daySchedule.enabled ? 'opacity-50' : ''}>
                            <SelectValue placeholder="--:--" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_HOURS.map((hour) => (
                              <SelectItem key={hour} value={hour.toString()}>
                                {hour.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Hora Fin */}
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Fin</Label>
                        <Select
                          value={daySchedule.end_hour?.toString() || ''}
                          onValueChange={(value) =>
                            updateDaySchedule(weekday.value, 'end_hour', parseInt(value))
                          }
                          disabled={!daySchedule.enabled}
                        >
                          <SelectTrigger className={!daySchedule.enabled ? 'opacity-50' : ''}>
                            <SelectValue placeholder="--:--" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_HOURS.map((hour) => (
                              <SelectItem key={hour} value={hour.toString()}>
                                {hour.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Estado visual */}
                      <div className="flex items-center justify-center">
                        {daySchedule.enabled ? (
                          hasConflicts ? (
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                          ) : (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          )
                        ) : (
                          <span className="text-gray-400 text-sm">Sin asignar</span>
                        )}
                      </div>

                      {/* Conflictos */}
                      <div className="col-span-1">
                        {hasConflicts && (
                          <div className="text-xs text-red-700">
                            <p className="font-semibold">Conflictos:</p>
                            <ul className="list-disc list-inside space-y-0.5 mt-1">
                              {conflicts?.conflicts.teacher_conflicts.map((c: any, idx: number) => (
                                <li key={`teacher-${idx}`}>{c.message}</li>
                              ))}
                              {conflicts?.conflicts.group_conflicts.map((c: any, idx: number) => (
                                <li key={`group-${idx}`}>{c.message}</li>
                              ))}
                              {conflicts?.conflicts.availability_conflicts.map((c: any, idx: number) => (
                                <li key={`avail-${idx}`}>{c.message}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumen de sesiones activas */}
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800">
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">
                    {activeSessions.length} sesión(es) activa(s) configurada(s)
                  </span>
                </div>
                {activeSessions.length > 0 && (
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Días configurados: {activeSessions.map(s => 
                      WEEKDAYS.find(w => w.value === s.day)?.short
                    ).join(', ')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SECCIÓN 3: RESUMEN DE VALIDACIÓN */}
          {validationResult && (
            <Card className={`border-2 ${validationResult.valid ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {validationResult.valid ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  Resultado de Validación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className={`font-medium ${validationResult.valid ? 'text-green-800' : 'text-yellow-800'}`}>
                    {validationResult.message}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="p-2 bg-white rounded border">
                      <div className="font-semibold">Total Sesiones</div>
                      <div className="text-2xl">{validationResult.summary.total_sessions}</div>
                    </div>
                    <div className="p-2 bg-green-100 rounded border border-green-300">
                      <div className="font-semibold text-green-800">Válidas</div>
                      <div className="text-2xl text-green-800">{validationResult.summary.valid_sessions}</div>
                    </div>
                    <div className="p-2 bg-red-100 rounded border border-red-300">
                      <div className="font-semibold text-red-800">Con Conflictos</div>
                      <div className="text-2xl text-red-800">{validationResult.summary.sessions_with_conflicts}</div>
                    </div>
                    <div className="p-2 bg-yellow-100 rounded border border-yellow-300">
                      <div className="font-semibold text-yellow-800">Total Conflictos</div>
                      <div className="text-2xl text-yellow-800">{validationResult.summary.total_conflicts}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Estado de validación en progreso */}
          {validating && (
            <div className="flex items-center justify-center gap-2 text-blue-600 p-4 bg-blue-50 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Validando todas las sesiones...</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting || validating}
          >
            Cancelar
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleValidate}
            disabled={
              submitting ||
              validating ||
              !formData.teacher_id ||
              !formData.subject_id ||
              !formData.group_id ||
              activeSessions.length === 0
            }
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            {validating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              'Validar Sesiones'
            )}
          </Button>

          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={
              submitting ||
              validating ||
              !formData.teacher_id ||
              !formData.subject_id ||
              !formData.group_id ||
              activeSessions.length === 0
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              `Guardar ${activeSessions.length} Sesión(es)`
            )}
          </Button>

          {!validationResult?.valid && validationResult?.summary.critical_count === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={submitting || validating}
              className="border-orange-600 text-orange-600 hover:bg-orange-50"
            >
              Guardar de Todos Modo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}