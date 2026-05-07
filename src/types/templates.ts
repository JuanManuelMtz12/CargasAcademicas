// Tipos para el sistema de plantillas de cargas académicas

export interface LoadTemplate {
  id: string;
  name: string;
  description?: string;
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
  created_by?: string;
}

export interface LoadTemplateComplete extends LoadTemplate {
  program_name?: string;
  academic_period_name?: string;
  combinations_count: number;
  generated_count: number;
}

export interface LoadTemplateCombination {
  id: string;
  template_id: string;
  specialization_id?: string;
  group_name: string;
  location: 'TEZIUTLÁN' | 'HUEYAPAN' | 'GUADALUPE VICTORIA';
  module_number: string;
  module_name: string;
  module_key: string;
  instructor_id?: string;
  is_generated: boolean;
  generated_load_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateCombinationComplete extends LoadTemplateCombination {
  template_name: string;
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

export interface MassiveGenerationRequest {
  template_id: string;
  combinations: Array<{
    specialization_id?: string;
    group_name: string;
    location: 'TEZIUTLÁN' | 'HUEYAPAN' | 'GUADALUPE VICTORIA';
    module_number: string;
    module_name: string;
    module_key: string;
    instructor_id?: string;
  }>;
}
