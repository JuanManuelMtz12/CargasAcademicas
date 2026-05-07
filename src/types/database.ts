export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academic_loads: {
        Row: {
          academic_period_id: string | null
          asignacion_codigo: string | null
          created_at: string | null
          end_date: string
          end_time: string
          face_to_face_days: Json
          face_to_face_schedule: Json | null
          group_name: string
          group_template_id: string | null
          id: string
          instructor_id: string | null
          location: string
          module_key: string
          module_name: string
          module_number: string
          program_id: string | null
          specialization_id: string | null
          start_date: string
          start_time: string
          status: string | null
          updated_at: string | null
          work_modality: string
        }
        Insert: {
          academic_period_id?: string | null
          asignacion_codigo?: string | null
          created_at?: string | null
          end_date: string
          end_time: string
          face_to_face_days: Json
          face_to_face_schedule?: Json | null
          group_name: string
          group_template_id?: string | null
          id?: string
          instructor_id?: string | null
          location: string
          module_key: string
          module_name: string
          module_number: string
          program_id?: string | null
          specialization_id?: string | null
          start_date: string
          start_time: string
          status?: string | null
          updated_at?: string | null
          work_modality: string
        }
        Update: {
          academic_period_id?: string | null
          asignacion_codigo?: string | null
          created_at?: string | null
          end_date?: string
          end_time?: string
          face_to_face_days?: Json
          face_to_face_schedule?: Json | null
          group_name?: string
          group_template_id?: string | null
          id?: string
          instructor_id?: string | null
          location?: string
          module_key?: string
          module_name?: string
          module_number?: string
          program_id?: string | null
          specialization_id?: string | null
          start_date?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
          work_modality?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_loads_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_group_template_id_fkey"
            columns: ["group_template_id"]
            isOneToOne: false
            referencedRelation: "group_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_group_template_id_fkey"
            columns: ["group_template_id"]
            isOneToOne: false
            referencedRelation: "group_templates_complete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_specialization_id_fkey"
            columns: ["specialization_id"]
            isOneToOne: false
            referencedRelation: "specializations"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          module_key: string
          name: string
          order_num: number | null
          specialization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          module_key: string
          name: string
          order_num?: number | null
          specialization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          module_key?: string
          name?: string
          order_num?: number | null
          specialization_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      academic_periods: {
        Row: {
          coordinator_general: string | null
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean | null
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          coordinator_general?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          coordinator_general?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      academic_sessions: {
        Row: {
          academic_load_id: string | null
          created_at: string | null
          end_time: string
          id: string
          is_cancelled: boolean | null
          location: string | null
          session_date: string
          session_notes: string | null
          session_type: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          academic_load_id?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          is_cancelled?: boolean | null
          location?: string | null
          session_date: string
          session_notes?: string | null
          session_type: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          academic_load_id?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_cancelled?: boolean | null
          location?: string | null
          session_date?: string
          session_notes?: string | null
          session_type?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_sessions_academic_load_id_fkey"
            columns: ["academic_load_id"]
            isOneToOne: false
            referencedRelation: "academic_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_sessions_academic_load_id_fkey"
            columns: ["academic_load_id"]
            isOneToOne: false
            referencedRelation: "academic_loads_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          created_at: string | null
          day: string
          end_hour: number
          id: string
          start_hour: number
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day: string
          end_hour: number
          id?: string
          start_hour: number
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day?: string
          end_hour?: number
          id?: string
          start_hour?: number
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          category: string
          created_at: string | null
          id: string
          max_hours_week: number
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          max_hours_week: number
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          max_hours_week?: number
          subcategory?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      group_templates: {
        Row: {
          academic_period_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          end_date: string
          end_time: string
          face_to_face_days: Json
          face_to_face_schedule: Json | null
          group_code: string | null
          id: string
          is_active: boolean | null
          name: string
          program_id: string | null
          start_date: string
          start_time: string
          template_type: string | null
          updated_at: string | null
          work_modality: string
        }
        Insert: {
          academic_period_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          end_date: string
          end_time: string
          face_to_face_days?: Json
          face_to_face_schedule?: Json | null
          group_code?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          program_id?: string | null
          start_date: string
          start_time: string
          template_type?: string | null
          updated_at?: string | null
          work_modality: string
        }
        Update: {
          academic_period_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string
          end_time?: string
          face_to_face_days?: Json
          face_to_face_schedule?: Json | null
          group_code?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          program_id?: string | null
          start_date?: string
          start_time?: string
          template_type?: string | null
          updated_at?: string | null
          work_modality?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_templates_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      maestria_sabado_schedule: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          end_time: string | null
          id: number
          maestria_id: number | null
          start_time: string | null
          subject_name: string
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: number
          maestria_id?: number | null
          start_time?: string | null
          subject_name: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: number
          maestria_id?: number | null
          start_time?: string | null
          subject_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "maestria_sabado_schedule_maestria_id_fkey"
            columns: ["maestria_id"]
            isOneToOne: false
            referencedRelation: "maestrias_sabado"
            referencedColumns: ["id"]
          },
        ]
      }
      maestrias_sabado: {
        Row: {
          activo: boolean | null
          ciclo_id: string | null
          coordinador_id: string | null
          created_at: string | null
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: number
          nombre: string
          sede_id: string | null
        }
        Insert: {
          activo?: boolean | null
          ciclo_id?: string | null
          coordinador_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          nombre: string
          sede_id?: string | null
        }
        Update: {
          activo?: boolean | null
          ciclo_id?: string | null
          coordinador_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: number
          nombre?: string
          sede_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_maestrias_sabado_ciclo"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "school_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_maestrias_sabado_coordinador"
            columns: ["coordinador_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_maestrias_sabado_sede"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedes"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          id: string
          maestria_sabatina_id: number | null
          name: string
          order_num: number | null
          program_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          maestria_sabatina_id?: number | null
          name: string
          order_num?: number | null
          program_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          maestria_sabatina_id?: number | null
          name?: string
          order_num?: number | null
          program_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_maestria_sabatina_id_fkey"
            columns: ["maestria_sabatina_id"]
            isOneToOne: false
            referencedRelation: "maestrias_sabado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          coordinator_id: string | null
          created_at: string | null
          especialidad: string | null
          id: string
          name: string
          sede_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          coordinator_id?: string | null
          created_at?: string | null
          especialidad?: string | null
          id?: string
          name: string
          sede_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          coordinator_id?: string | null
          created_at?: string | null
          especialidad?: string | null
          id?: string
          name?: string
          sede_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedes"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule: {
        Row: {
          conflict_type: string
          created_at: string | null
          day: string
          end_hour: number
          group_id: string
          id: string
          school_cycle_id: string | null
          start_hour: number
          subject_id: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          conflict_type?: string
          created_at?: string | null
          day: string
          end_hour: number
          group_id: string
          id?: string
          school_cycle_id?: string | null
          start_hour: number
          subject_id: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          conflict_type?: string
          created_at?: string | null
          day?: string
          end_hour?: number
          group_id?: string
          id?: string
          school_cycle_id?: string | null
          start_hour?: number
          subject_id?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_school_cycle_id_fkey"
            columns: ["school_cycle_id"]
            isOneToOne: false
            referencedRelation: "school_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      school_cycles: {
        Row: {
          created_at: string | null
          cycle_type: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_type: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_type?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sedes: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      specializations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          program_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          program_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          program_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specializations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          clave: string
          created_at: string | null
          credits: number | null
          id: string
          module_id: string | null
          name: string
          program_id: string
          updated_at: string | null
        }
        Insert: {
          clave: string
          created_at?: string | null
          credits?: number | null
          id?: string
          module_id?: string | null
          name: string
          program_id: string
          updated_at?: string | null
        }
        Update: {
          clave?: string
          created_at?: string | null
          credits?: number | null
          id?: string
          module_id?: string | null
          name?: string
          program_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_maestria_sabado: {
        Row: {
          created_at: string | null
          id: number
          maestria_id: number | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          maestria_id?: number | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          maestria_id?: number | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_maestria_sabado_maestria_id_fkey"
            columns: ["maestria_id"]
            isOneToOne: false
            referencedRelation: "maestrias_sabado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_maestria_sabado_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_program: {
        Row: {
          created_at: string | null
          program_id: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          program_id: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          program_id?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_program_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_program_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          name: string
          name_normalized: string | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          name: string
          name_normalized?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          name?: string
          name_normalized?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      template_assignments: {
        Row: {
          assignment_order: number | null
          created_at: string | null
          generated_load_id: string | null
          group_name: string
          id: string
          instructor_id: string | null
          is_generated: boolean | null
          location: string
          module_key: string
          module_name: string
          module_number: string
          notes: string | null
          specialization_id: string | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_order?: number | null
          created_at?: string | null
          generated_load_id?: string | null
          group_name: string
          id?: string
          instructor_id?: string | null
          is_generated?: boolean | null
          location: string
          module_key: string
          module_name: string
          module_number: string
          notes?: string | null
          specialization_id?: string | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_order?: number | null
          created_at?: string | null
          generated_load_id?: string | null
          group_name?: string
          id?: string
          instructor_id?: string | null
          is_generated?: boolean | null
          location?: string
          module_key?: string
          module_name?: string
          module_number?: string
          notes?: string | null
          specialization_id?: string | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_template_combinations_generated_load_id_fkey"
            columns: ["generated_load_id"]
            isOneToOne: false
            referencedRelation: "academic_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_generated_load_id_fkey"
            columns: ["generated_load_id"]
            isOneToOne: false
            referencedRelation: "academic_loads_complete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_specialization_id_fkey"
            columns: ["specialization_id"]
            isOneToOne: false
            referencedRelation: "specializations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "group_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "group_templates_complete"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          module_name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module_name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module_name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_program_access: {
        Row: {
          created_at: string | null
          id: string
          program_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          program_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          program_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          first_name: string
          id: string
          last_name: string
          program_id: string | null
          role: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          first_name: string
          id: string
          last_name: string
          program_id?: string | null
          role: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          program_id?: string | null
          role?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      academic_loads_complete: {
        Row: {
          academic_period_id: string | null
          academic_period_name: string | null
          coordinator_general: string | null
          created_at: string | null
          end_date: string | null
          end_time: string | null
          face_to_face_days: Json | null
          face_to_face_schedule: Json | null
          group_name: string | null
          id: string | null
          instructor_id: string | null
          instructor_name: string | null
          location: string | null
          module_key: string | null
          module_name: string | null
          module_number: string | null
          program_id: string | null
          program_name: string | null
          specialization_id: string | null
          specialization_name: string | null
          start_date: string | null
          start_time: string | null
          status: string | null
          updated_at: string | null
          work_modality: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_loads_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_loads_specialization_id_fkey"
            columns: ["specialization_id"]
            isOneToOne: false
            referencedRelation: "specializations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_templates_complete: {
        Row: {
          academic_period_id: string | null
          academic_period_name: string | null
          assignments_count: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          end_date: string | null
          end_time: string | null
          face_to_face_days: Json | null
          face_to_face_schedule: Json | null
          generated_count: number | null
          group_code: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          program_id: string | null
          program_name: string | null
          start_date: string | null
          start_time: string | null
          template_type: string | null
          updated_at: string | null
          work_modality: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_templates_academic_period_id_fkey"
            columns: ["academic_period_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      template_assignments_complete: {
        Row: {
          assignment_order: number | null
          created_at: string | null
          end_date: string | null
          end_time: string | null
          face_to_face_days: Json | null
          face_to_face_schedule: Json | null
          generated_load_id: string | null
          group_code: string | null
          group_name: string | null
          id: string | null
          instructor_id: string | null
          instructor_name: string | null
          is_generated: boolean | null
          location: string | null
          module_key: string | null
          module_name: string | null
          module_number: string | null
          notes: string | null
          program_name: string | null
          specialization_id: string | null
          specialization_name: string | null
          start_date: string | null
          start_time: string | null
          template_id: string | null
          template_name: string | null
          template_type: string | null
          updated_at: string | null
          work_modality: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_template_combinations_generated_load_id_fkey"
            columns: ["generated_load_id"]
            isOneToOne: false
            referencedRelation: "academic_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_generated_load_id_fkey"
            columns: ["generated_load_id"]
            isOneToOne: false
            referencedRelation: "academic_loads_complete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_specialization_id_fkey"
            columns: ["specialization_id"]
            isOneToOne: false
            referencedRelation: "specializations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "group_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_template_combinations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "group_templates_complete"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_teacher_hours: {
        Args: {
          p_end_hour: number
          p_program_id: string
          p_start_hour: number
          p_teacher_id: string
        }
        Returns: Json
      }
      create_coordinator_with_auth: {
        Args: {
          p_email: string
          p_module_permissions: Json
          p_password: string
          p_program_ids: string[]
        }
        Returns: Json
      }
      delete_user: { Args: { p_user_id: string }; Returns: Json }
      generate_asignacion_codigo: { Args: never; Returns: string }
      get_auth_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          user_metadata: Json
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_coordinator: { Args: never; Returns: boolean }
      test_user_permissions: {
        Args: { p_action: string; p_module: string; p_user_id: string }
        Returns: Json
      }
      update_user_permissions: {
        Args: {
          p_module_permissions: Json
          p_program_ids?: string[]
          p_user_id: string
        }
        Returns: Json
      }
      validate_schedule_conflicts: {
        Args: { p_schedule_data: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
