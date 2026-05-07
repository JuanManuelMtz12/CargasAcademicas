// Tipos para el formulario de asignación multi-día
export interface DaySchedule {
  day: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | '';
  start_hour: number;
  end_hour: number;
  enabled: boolean;
}

export interface MultiDayScheduleFormData {
  teacher_id: string;
  subject_id: string;
  group_id: string;
  school_cycle_id: string;
  days: DaySchedule[];
}

export interface SaveResult {
  success: boolean;
  errors: Array<{
    day: string;
    error: string;
  }>;
  created_schedules: Array<{
    day: string;
    schedule_id: string;
  }>;
}

export interface ValidationError {
  day: string;
  message: string;
  field: 'day' | 'start_hour' | 'end_hour' | 'general';
}

export interface ScheduleValidationError {
  day: string;
  type: 'error' | 'warning';
  message: string;
}