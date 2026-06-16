/**
 * Hook: useScheduleValidation
 * 
 * Sistema de validación dual para horarios:
 * 1. Intenta validar mediante Edge Function (servidor)
 * 2. Si falla, usa validación client-side como fallback
 * 
 * @author MiniMax Agent
 * @version 2.0
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface ScheduleValidationRequest {
  teacher_id: string;
  subject_id: string;
  group_id: string;
  day: string;
  start_hour: number;
  end_hour: number;
  school_cycle_id?: string;
  program_id?: string; 
  exclude_schedule_id?: string; // @deprecated - use exclude_schedule_ids
  exclude_schedule_ids?: string[]; // Array de IDs a excluir (para edición multi-día)
}

export interface Conflict {
  type: string;
  message: string;
  severity: 'critical' | 'warning';
  details: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  conflicts: {
    teacher_conflicts: Conflict[];
    group_conflicts: Conflict[];
    availability_conflicts: Conflict[];
  };
  summary?: {
    total_conflicts: number;
    critical_count: number;
    warning_count: number;
  };
  validationMethod: 'edge-function' | 'client-side' | 'error';
  error?: string;
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Verifica si dos rangos de tiempo se empalman
 */
function hasTimeOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return !(end1 <= start2 || start1 >= end2);
}

/**
 * Formatea hora para mostrar
 */
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useScheduleValidation() {
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  /**
   * Validación mediante Edge Function (método preferido)
   */
  const validateViaEdgeFunction = async (
    request: ScheduleValidationRequest
  ): Promise<ValidationResult> => {
    console.log('[VALIDACIÓN EDGE] Llamando a Edge Function...');
    
    const { data, error } = await supabase.functions.invoke('validate-schedule-conflicts', {
      body: request
    });

    if (error) {
      console.error('[VALIDACIÓN EDGE] Error de Edge Function:', error);
      throw new Error(error.message || 'Edge Function falló');
    }

    if (!data) {
      console.error('[VALIDACIÓN EDGE] Edge Function no devolvió datos');
      throw new Error('Edge Function no devolvió datos');
    }

    console.log('[VALIDACIÓN EDGE] Respuesta recibida:', data);
    
    return {
      ...data,
      validationMethod: 'edge-function' as const,
    };
  };

  /**
   * Validación Client-Side Simplificada (fallback)
   * Versión más robusta y simple que la anterior
   */
  const validateClientSide = async (
    request: ScheduleValidationRequest
  ): Promise<ValidationResult> => {
    console.log('[VALIDACIÓN CLIENT-SIDE] Iniciando validación simplificada...');

    const conflicts: {
      teacher_conflicts: Conflict[];
      group_conflicts: Conflict[];
      availability_conflicts: Conflict[];
    } = {
      teacher_conflicts: [],
      group_conflicts: [],
      availability_conflicts: [],
    };

    try {
      // ======================================================================
      // 1. VALIDAR DUPLICADO EXACTO (simplificado)
      // ======================================================================
      let duplicateQuery = supabase
        .from('schedule')
        .select('id')
        .eq('teacher_id', request.teacher_id)
        .eq('subject_id', request.subject_id)
        .eq('group_id', request.group_id)
        .eq('day', request.day)
        .eq('start_hour', request.start_hour)
        .eq('end_hour', request.end_hour);

      if (request.school_cycle_id) {
        duplicateQuery = duplicateQuery.eq('school_cycle_id', request.school_cycle_id);
      }

      // Excluir IDs en edición (soporta array o ID único)
      const excludeIds = request.exclude_schedule_ids || (request.exclude_schedule_id ? [request.exclude_schedule_id] : []);
      if (excludeIds.length > 0) {
        duplicateQuery = duplicateQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: duplicates, error: duplicateError } = await duplicateQuery;

      if (duplicateError) {
        console.error('[VALIDACIÓN CLIENT-SIDE] Error verificando duplicados:', duplicateError);
        throw duplicateError;
      }

      if (duplicates && duplicates.length > 0) {
        conflicts.teacher_conflicts.push({
          type: 'duplicate_schedule',
          severity: 'critical',
          message: '❌ Esta asignación ya existe (duplicado exacto)',
          details: { reason: 'schedule_unique_constraint violation' },
        });
      }

      // ======================================================================
      // 2. VALIDAR CONFLICTOS DEL MAESTRO (con información completa + programa)
      // IMPORTANTE: NO filtrar por program_id - debe validar en TODAS las licenciaturas
      // ======================================================================
      let teacherQuery = supabase
        .from('schedule')
        .select(`
          id, 
          start_hour, 
          end_hour,
          day,
          teacher:teachers!schedule_teacher_id_fkey(id, name),
          subject:subjects!schedule_subject_id_fkey(id, name, program:programs(id, name)),
          group:groups!schedule_group_id_fkey(id, name)
        `)
        .eq('teacher_id', request.teacher_id)
        .eq('day', request.day);

      if (request.school_cycle_id) {
        teacherQuery = teacherQuery.eq('school_cycle_id', request.school_cycle_id);
      }

      // Excluir IDs en edición (soporta array o ID único)
      if (excludeIds.length > 0) {
        teacherQuery = teacherQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: teacherSchedules, error: teacherError } = await teacherQuery;

      if (teacherError) {
        console.error('[VALIDACIÓN CLIENT-SIDE] Error verificando conflictos de maestro:', teacherError);
        throw teacherError;
      }

      // Verificar empalmes de tiempo (cruza TODAS las licenciaturas)
      if (teacherSchedules) {
        for (const schedule of teacherSchedules) {
          if (hasTimeOverlap(request.start_hour, request.end_hour, schedule.start_hour, schedule.end_hour)) {
            const teacher = Array.isArray(schedule.teacher) ? schedule.teacher[0] : schedule.teacher;
            const subject = Array.isArray(schedule.subject) ? schedule.subject[0] : schedule.subject;
            const group = Array.isArray(schedule.group) ? schedule.group[0] : schedule.group;
            
            // Extraer información del programa
            const program = subject?.program ? 
              (Array.isArray(subject.program) ? subject.program[0] : subject.program) : 
              null;
            
            conflicts.teacher_conflicts.push({
              type: 'teacher_time_overlap',
              severity: 'critical',
              message: `El maestro tiene un horario que se empalma (${schedule.start_hour}:00 - ${schedule.end_hour}:00)`,
              details: {
                conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
                day: schedule.day,
                teacher_name: teacher?.name || 'Desconocido',
                subject_name: subject?.name || 'Desconocida',
                group_name: group?.name || 'Desconocido',
                program_name: program?.name || 'Licenciatura no especificada',
              },
            });
          }
        }
      }

      // ======================================================================
      // 3. VALIDAR CONFLICTOS DEL GRUPO (con información completa + programa)
      // ======================================================================
let groupQuery = supabase
        .from('schedule')
        .select(`
          id, 
          start_hour, 
          end_hour,
          day,
          teacher:teachers!schedule_teacher_id_fkey(id, name),
          subject:subjects!schedule_subject_id_fkey(id, name, program:programs(id, name)),
          group:groups!schedule_group_id_fkey(id, name)
        `)
        .eq('group_id', request.group_id)
        .eq('day', request.day);

      if (request.school_cycle_id) {
        groupQuery = groupQuery.eq('school_cycle_id', request.school_cycle_id);
      }

      // Excluir IDs en edición (soporta array o ID único)
      if (excludeIds.length > 0) {
        groupQuery = groupQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data: groupSchedules, error: groupError } = await groupQuery;

      if (groupError) {
        console.error('[VALIDACIÓN CLIENT-SIDE] Error verificando conflictos de grupo:', groupError);
        throw groupError;
      }

      const currentProgramId = request.program_id ?? null;

      // Verificar empalmes de tiempo para el grupo
      if (groupSchedules) {
        for (const schedule of groupSchedules) {
          if (!hasTimeOverlap(request.start_hour, request.end_hour, schedule.start_hour, schedule.end_hour)) {
            continue;
          }

          const teacher = Array.isArray(schedule.teacher) ? schedule.teacher[0] : schedule.teacher;
          const subject = Array.isArray(schedule.subject) ? schedule.subject[0] : schedule.subject;
          const group = Array.isArray(schedule.group) ? schedule.group[0] : schedule.group;

          // Extraer información del programa
          const program = subject?.program
            ? (Array.isArray(subject.program) ? subject.program[0] : subject.program)
            : null;

          const scheduleProgramId = program?.id ?? null;

          // ⚠️ Regla clave:
          // Si tenemos program_id en la solicitud, SOLO consideramos empalmes de grupo
          // dentro de la MISMA licenciatura. Empalmes de grupo con otras licenciaturas se ignoran.
          if (currentProgramId && scheduleProgramId && scheduleProgramId !== currentProgramId) {
            continue;
          }

          conflicts.group_conflicts.push({
            type: 'group_time_overlap',
            severity: 'critical',
            message: `El grupo tiene un horario que se empalma (${schedule.start_hour}:00 - ${schedule.end_hour}:00)`,
            details: {
              conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
              day: schedule.day,
              teacher_name: teacher?.name || 'Desconocido',
              subject_name: subject?.name || 'Desconocida',
              group_name: group?.name || 'Desconocido',
              program_name: program?.name || 'Licenciatura no especificada',
            },
          });
        }
      }

      // ======================================================================
      // 4. VALIDAR DISPONIBILIDAD DEL MAESTRO (simplificado)
      // ======================================================================
      try {
        const { data: unavailabilities, error: availError } = await supabase
          .from('availability')
          .select('start_hour, end_hour')
          .eq('teacher_id', request.teacher_id)
          .eq('day', request.day);

        if (availError) {
          console.warn('[VALIDACIÓN CLIENT-SIDE] Error verificando disponibilidad:', availError);
          // No lanzar error, solo registrar
        } else if (unavailabilities) {
          for (const unavail of unavailabilities) {
            if (hasTimeOverlap(request.start_hour, request.end_hour, unavail.start_hour, unavail.end_hour)) {
              conflicts.availability_conflicts.push({
                type: 'teacher_unavailable',
                severity: 'warning',
                message: `El maestro no está disponible en este horario (${unavail.start_hour}:00 - ${unavail.end_hour}:00)`,
                details: {
                  unavailable_time: `${unavail.start_hour}:00 - ${unavail.end_hour}:00`,
                },
              });
            }
          }
        }
      } catch (availabilityError) {
        console.warn('[VALIDACIÓN CLIENT-SIDE] Error verificando disponibilidad:', availabilityError);
        // No fallar por problemas de disponibilidad
      }

      // ======================================================================
      // 5. CONSTRUIR RESULTADO
      // ======================================================================
      const totalConflicts =
        conflicts.teacher_conflicts.length +
        conflicts.group_conflicts.length +
        conflicts.availability_conflicts.length;

      const criticalCount = [
        ...conflicts.teacher_conflicts,
        ...conflicts.group_conflicts,
        ...conflicts.availability_conflicts,
      ].filter((c) => c.severity === 'critical').length;

      const warningCount = [
        ...conflicts.teacher_conflicts,
        ...conflicts.group_conflicts,
        ...conflicts.availability_conflicts,
      ].filter((c) => c.severity === 'warning').length;

      const result = {
        valid: totalConflicts === 0,
        message:
          totalConflicts === 0
            ? '✅ No se encontraron conflictos'
            : `⚠️ Se encontraron ${totalConflicts} conflicto(s)`,
        conflicts,
        summary: {
          total_conflicts: totalConflicts,
          critical_count: criticalCount,
          warning_count: warningCount,
        },
        validationMethod: 'client-side' as const,
      };

      console.log('[VALIDACIÓN CLIENT-SIDE] Resultado final:', result);
      return result;

    } catch (error) {
      console.error('[ERROR] Validación client-side falló:', error);
      
      // Retornar resultado de error pero continuar
      const errorResult: ValidationResult = {
        valid: false,
        message: `Error en validación: ${error instanceof Error ? error.message : String(error)}`,
        conflicts: {
          teacher_conflicts: [],
          group_conflicts: [],
          availability_conflicts: [],
        },
        validationMethod: 'client-side' as const,
        error: error instanceof Error ? error.message : String(error),
      };

      return errorResult;
    }
  };

  /**
   * Validación principal con sistema de fallback automático
   */
  const validateSchedule = useCallback(
    async (request: ScheduleValidationRequest): Promise<ValidationResult> => {
      setValidating(true);

      try {
        // Intentar validación por Edge Function primero
        console.log('[VALIDACIÓN] Iniciando validación con Edge Function...');
        try {
          const result = await validateViaEdgeFunction(request);
          console.log('[✓] Validación exitosa via Edge Function');
          setValidationResult(result);
          return result;
        } catch (edgeFunctionError) {
          console.warn('[!] Edge Function falló, usando validación client-side...');
          console.warn('[!] Error Edge Function:', edgeFunctionError);

          // Fallback a validación client-side
          const result = await validateClientSide(request);
          console.log('[✓] Validación exitosa via Client-Side (fallback)');
          setValidationResult(result);
          return result;
        }
      } catch (error) {
        console.error('[ERROR] Ambos métodos de validación fallaron:', error);

        // Si todo falla, retornar un resultado que permita continuar pero con advertencia
        const errorResult: ValidationResult = {
          valid: false,
          message: '⚠️ No se pudo validar automáticamente. Verifique manualmente que no haya conflictos.',
          conflicts: {
            teacher_conflicts: [],
            group_conflicts: [],
            availability_conflicts: [],
          },
          validationMethod: 'error',
          error: error instanceof Error ? error.message : String(error)
        };

        setValidationResult(errorResult);
        return errorResult;
      } finally {
        setValidating(false);
      }
    },
    []
  );

  /**
   * Limpia el resultado de validación
   */
  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  return {
    validateSchedule,
    validating,
    validationResult,
    clearValidation,
  };
}
