export interface AsignacionAcademica {
  id: string;
  codigo: string; // ID personalizado MAE-001, MAE-002
  
  maestro_id: string;
  maestro_nombre?: string;
  especializacion_id: string;
  especializacion_nombre?: string;
  modulo_numero: string;
  modulo_nombre: string;
  modulo_id?: string;
  plantilla_grupal_id: string;
  plantilla_grupal_nombre?: string;
  sede_id: string;
  sede_nombre?: string;
  group_id: string;
  group_nombre?: string;
  periodo_inicio: string;
  periodo_fin: string;
  horario_inicio?: string;
  horario_fin?: string;
  modalidad?: string;


  created_at?: string;
  updated_at?: string;
}

export interface AsignacionFormData {
  maestro_id: string;
  especializacion_id: string;
  modulo_numero: string;
  modulo_id: string;
  plantilla_grupal_id: string;
  sede_id: string;
  group_id: string;


}

export interface PlantillaGrupalInfo {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
  work_modality: string;
  face_to_face_days?: string[];
}

export interface SedeInfo {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface GroupInfo {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}