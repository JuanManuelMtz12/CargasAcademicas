/**
 * Tipos para el sistema de formulario multi-sesión de horarios
 * @author MiniMax Agent
 * @version 1.0
 */

export interface ScheduleSession {
  // Identificador temporal para el frontend
  tempId: string;
  
  // Datos de la sesión
  day: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado';
  start_hour: number;
  end_hour: number;
}

export interface MultiSessionScheduleFormData {
  // Datos comunes (no se repiten)
  teacher_id: string;
  subject_id: string;
  group_id: string;
  school_cycle_id: string;
  
  // Múltiples sesiones variables
  sessions: ScheduleSession[];
}

export interface SessionConflict {
  sessionTempId: string;
  day: string;
  start_hour: number;
  end_hour: number;
  conflicts: {
    teacher_conflicts: Array<{
      type: string;
      message: string;
      severity: 'critical' | 'warning';
      details: Record<string, any>;
    }>;
    group_conflicts: Array<{
      type: string;
      message: string;
      severity: 'critical' | 'warning';
      details: Record<string, any>;
    }>;
    availability_conflicts: Array<{
      type: string;
      message: string;
      severity: 'critical' | 'warning';
      details: Record<string, any>;
    }>;
  };
}

export interface MultipleValidationResult {
  valid: boolean;
  message: string;
  sessionResults: SessionConflict[];
  summary: {
    total_sessions: number;
    valid_sessions: number;
    sessions_with_conflicts: number;
    total_conflicts: number;
    critical_count: number;
    warning_count: number;
  };
  validationMethod: 'edge-function' | 'client-side' | 'error';
  error?: string;
}

export interface CreateMultipleSchedulesRequest {
  teacher_id: string;
  subject_id: string;
  group_id: string;
  school_cycle_id: string;
  sessions: Array<{
    day: string;
    start_hour: number;
    end_hour: number;
  }>;
  force_save: boolean; // Para guardar aunque haya conflictos
}

export interface CreateMultipleSchedulesResponse {
  success: boolean;
  message: string;
  created_count: number;
  failed_count: number;
  created_ids: string[];
  errors?: Array<{
    session: { day: string; start_hour: number; end_hour: number };
    error: string;
  }>;
}
