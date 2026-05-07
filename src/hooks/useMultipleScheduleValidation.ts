/**
 * Hook: useMultipleScheduleValidation
 * 
 * Sistema de validación para múltiples sesiones de horarios
 * Valida todas las sesiones en una sola operación y detecta conflictos cruzados
 * 
 * @author MiniMax Agent
 * @version 1.0
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  MultipleValidationResult,
  SessionConflict,
  ScheduleSession,
} from '@/types/multi-session-schedule';

interface ValidateMultipleSessionsRequest {
  teacher_id: string;
  subject_id: string;
  group_id: string;
  school_cycle_id: string;
  sessions: ScheduleSession[];
}

export function useMultipleScheduleValidation() {
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<MultipleValidationResult | null>(null);

  /**
   * Validación mediante Edge Function
   */
  const validateViaEdgeFunction = async (
    request: ValidateMultipleSessionsRequest
  ): Promise<MultipleValidationResult> => {
    console.log('[VALIDACIÓN MULTI-SESIÓN EDGE] Llamando a Edge Function...');
    
    const { data, error } = await supabase.functions.invoke('validate-multiple-schedule-conflicts', {
      body: {
        teacher_id: request.teacher_id,
        subject_id: request.subject_id,
        group_id: request.group_id,
        school_cycle_id: request.school_cycle_id,
        sessions: request.sessions.map(s => ({
          day: s.day,
          start_hour: s.start_hour,
          end_hour: s.end_hour,
          temp_id: s.tempId,
        })),
      }
    });

    if (error) {
      console.error('[VALIDACIÓN MULTI-SESIÓN EDGE] Error:', error);
      throw new Error(error.message || 'Edge Function falló');
    }

    if (!data) {
      throw new Error('Edge Function no devolvió datos');
    }

    console.log('[VALIDACIÓN MULTI-SESIÓN EDGE] Respuesta recibida:', data);
    
    return {
      ...data,
      validationMethod: 'edge-function' as const,
    };
  };

  /**
   * Validación client-side (fallback)
   * Simplificada - valida sesiones de forma independiente
   */
  const validateClientSide = async (
    request: ValidateMultipleSessionsRequest
  ): Promise<MultipleValidationResult> => {
    console.log('[VALIDACIÓN MULTI-SESIÓN CLIENT-SIDE] Iniciando...');

    const sessionResults: SessionConflict[] = [];
    let totalConflicts = 0;
    let criticalCount = 0;
    let warningCount = 0;

    try {
      // Validar cada sesión individualmente
      for (const session of request.sessions) {
        const sessionConflict: SessionConflict = {
          sessionTempId: session.tempId,
          day: session.day,
          start_hour: session.start_hour,
          end_hour: session.end_hour,
          conflicts: {
            teacher_conflicts: [],
            group_conflicts: [],
            availability_conflicts: [],
          },
        };

        // 1. Validar conflictos de maestro
        const { data: teacherSchedules, error: teacherError } = await supabase
          .from('schedule')
          .select('id, start_hour, end_hour, subjects(name, clave)')
          .eq('teacher_id', request.teacher_id)
          .eq('day', session.day)
          .eq('school_cycle_id', request.school_cycle_id);

        if (!teacherError && teacherSchedules) {
          for (const schedule of teacherSchedules) {
            // Verificar overlap: !(end1 <= start2 || start1 >= end2)
            const hasOverlap = !(session.end_hour <= schedule.start_hour || session.start_hour >= schedule.end_hour);
            
            if (hasOverlap) {
              const subjectName = (schedule.subjects as any)?.name || 'Materia';
              const subjectClave = (schedule.subjects as any)?.clave || '';
              
              sessionConflict.conflicts.teacher_conflicts.push({
                type: 'teacher_time_overlap',
                severity: 'critical',
                message: `El maestro ya tiene clase de ${subjectClave} - ${subjectName} de ${schedule.start_hour}:00 a ${schedule.end_hour}:00`,
                details: {
                  conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
                },
              });
              criticalCount++;
              totalConflicts++;
            }
          }
        }

        // 2. Validar conflictos de grupo
        const { data: groupSchedules, error: groupError } = await supabase
          .from('schedule')
          .select('id, start_hour, end_hour, subjects(name, clave, program_id)')
          .eq('group_id', request.group_id)
          .eq('day', session.day)
          .eq('school_cycle_id', request.school_cycle_id);

        // Obtener program_id de la materia solicitada
        const { data: requestSubject } = await supabase
          .from('subjects')
          .select('program_id')
          .eq('id', request.subject_id)
          .single();

        if (!groupError && groupSchedules && requestSubject) {
          // Filtrar solo horarios del mismo programa
          const sameProgramSchedules = groupSchedules.filter(
            s => (s.subjects as any)?.program_id === requestSubject.program_id
          );

          for (const schedule of sameProgramSchedules) {
            const hasOverlap = !(session.end_hour <= schedule.start_hour || session.start_hour >= schedule.end_hour);
            
            if (hasOverlap) {
              const subjectName = (schedule.subjects as any)?.name || 'Materia';
              const subjectClave = (schedule.subjects as any)?.clave || '';
              
              sessionConflict.conflicts.group_conflicts.push({
                type: 'group_time_overlap',
                severity: 'critical',
                message: `El grupo ya tiene clase de ${subjectClave} - ${subjectName} de ${schedule.start_hour}:00 a ${schedule.end_hour}:00`,
                details: {
                  conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
                },
              });
              criticalCount++;
              totalConflicts++;
            }
          }
        }

        // 3. Validar conflictos entre las sesiones que se están agregando
        for (const otherSession of request.sessions) {
          if (otherSession.tempId !== session.tempId && otherSession.day === session.day) {
            const hasOverlap = !(session.end_hour <= otherSession.start_hour || session.start_hour >= otherSession.end_hour);
            
            if (hasOverlap) {
              sessionConflict.conflicts.teacher_conflicts.push({
                type: 'internal_session_overlap',
                severity: 'critical',
                message: `Conflicto con otra sesión del mismo formulario: ${otherSession.day} ${otherSession.start_hour}:00-${otherSession.end_hour}:00`,
                details: {
                  conflicting_time: `${otherSession.start_hour}:00 - ${otherSession.end_hour}:00`,
                  internal_conflict: true,
                },
              });
              criticalCount++;
              totalConflicts++;
            }
          }
        }

        sessionResults.push(sessionConflict);
      }

      const validSessions = sessionResults.filter(
        sr => sr.conflicts.teacher_conflicts.length === 0 &&
              sr.conflicts.group_conflicts.length === 0 &&
              sr.conflicts.availability_conflicts.length === 0
      ).length;

      const result: MultipleValidationResult = {
        valid: totalConflicts === 0,
        message: totalConflicts === 0
          ? `✅ Todas las ${request.sessions.length} sesiones son válidas`
          : `⚠️ Se encontraron ${totalConflicts} conflicto(s) en ${request.sessions.length - validSessions} sesión(es)`,
        sessionResults,
        summary: {
          total_sessions: request.sessions.length,
          valid_sessions: validSessions,
          sessions_with_conflicts: request.sessions.length - validSessions,
          total_conflicts: totalConflicts,
          critical_count: criticalCount,
          warning_count: warningCount,
        },
        validationMethod: 'client-side',
      };

      console.log('[VALIDACIÓN MULTI-SESIÓN CLIENT-SIDE] Resultado:', result);
      return result;

    } catch (error) {
      console.error('[ERROR] Validación client-side falló:', error);
      
      return {
        valid: false,
        message: `Error en validación: ${error instanceof Error ? error.message : String(error)}`,
        sessionResults: [],
        summary: {
          total_sessions: request.sessions.length,
          valid_sessions: 0,
          sessions_with_conflicts: request.sessions.length,
          total_conflicts: 0,
          critical_count: 0,
          warning_count: 0,
        },
        validationMethod: 'client-side',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  /**
   * Validación principal con fallback automático
   */
  const validateMultipleSessions = useCallback(
    async (request: ValidateMultipleSessionsRequest): Promise<MultipleValidationResult> => {
      setValidating(true);

      try {
        // Intentar Edge Function primero
        console.log('[VALIDACIÓN MULTI-SESIÓN] Intentando Edge Function...');
        try {
          const result = await validateViaEdgeFunction(request);
          console.log('[✓] Validación exitosa via Edge Function');
          setValidationResult(result);
          return result;
        } catch (edgeFunctionError) {
          console.warn('[!] Edge Function falló, usando validación client-side...');
          console.warn('[!] Error:', edgeFunctionError);

          // Fallback a client-side
          const result = await validateClientSide(request);
          console.log('[✓] Validación exitosa via Client-Side (fallback)');
          setValidationResult(result);
          return result;
        }
      } catch (error) {
        console.error('[ERROR] Ambos métodos de validación fallaron:', error);

        const errorResult: MultipleValidationResult = {
          valid: false,
          message: '⚠️ No se pudo validar automáticamente. Verifique manualmente los conflictos.',
          sessionResults: [],
          summary: {
            total_sessions: request.sessions.length,
            valid_sessions: 0,
            sessions_with_conflicts: request.sessions.length,
            total_conflicts: 0,
            critical_count: 0,
            warning_count: 0,
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

  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  return {
    validateMultipleSessions,
    validating,
    validationResult,
    clearValidation,
  };
}
