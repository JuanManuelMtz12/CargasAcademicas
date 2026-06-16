// Tipos para el sistema de plantillas grupales

export interface GroupTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: 'group' | 'individual';
  group_code?: string;
  display_order: number;
  start_date: string;
  end_date: string;
  academic_period_id?: string;
  start_time: string;
  end_time: string;
  work_modality: 'presencial' | 'en_linea' | 'hibrida';
  face_to_face_days: string[];
  face_to_face_schedule?: { [key: string]: number[] };
  program_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupTemplateComplete extends GroupTemplate {
  program_name?: string;
  academic_period_name?: string;
  assignments_count: number;
  generated_count: number;
}

export interface TemplateAssignment {
  id: string;
  template_id: string;
  specialization_id?: string;
  group_name: string;
  location: 'TEZIUTLÁN' | 'HUEYAPAN' | 'GUADALUPE VICTORIA';
  module_number: string;
  module_name: string;
  module_key: string;
  instructor_id?: string;
  assignment_order: number;
  notes?: string;
  is_generated: boolean;
  generated_load_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateAssignmentComplete extends TemplateAssignment {
  template_name: string;
  group_code?: string;
  template_type: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  work_modality: string;
  face_to_face_days: string[];
  face_to_face_schedule?: { [key: string]: number[] };
  specialization_name?: string;
  instructor_name?: string;
  program_name?: string;
}

// Request para generación masiva desde plantilla grupal
export interface GroupTemplateGenerationRequest {
  template_id: string;
  assignments: Array<{
    specialization_id?: string;
    group_name: string;
    location: 'TEZIUTLÁN' | 'HUEYAPAN' | 'GUADALUPE VICTORIA';
    module_number: string;
    module_name: string;
    module_key: string;
    instructor_id?: string;
    assignment_order?: number;
  }>;
}

// Para compatibilidad con código existente
export type LoadTemplate = GroupTemplate;
export type LoadTemplateComplete = GroupTemplateComplete;
export type LoadTemplateCombination = TemplateAssignment;
export type TemplateCombinationComplete = TemplateAssignmentComplete;
