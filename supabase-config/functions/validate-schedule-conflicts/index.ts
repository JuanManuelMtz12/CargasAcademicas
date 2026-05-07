// Edge Function para validar conflictos de horarios (VERSIÓN MEJORADA)
// Verifica empalmes de maestros, grupos, disponibilidad y asignación de maestro-programa
// Retorna mensajes detallados con nombres reales de maestros, materias y grupos

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teacher_id, subject_id, group_id, day, start_hour, end_hour, school_cycle_id, exclude_schedule_id } = await req.json();

    // Validar parámetros requeridos
    if (!teacher_id || !subject_id || !group_id || !day || start_hour === undefined || end_hour === undefined) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos: teacher_id, subject_id, group_id, day, start_hour, end_hour' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que start_hour < end_hour
    if (start_hour >= end_hour) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          conflicts: [{ type: 'invalid_hours', message: 'La hora de inicio debe ser menor que la hora de fin' }] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teacher_conflicts: any[] = [];
    const group_conflicts: any[] = [];
    const availability_conflicts: any[] = [];
    const program_assignment_conflicts: any[] = [];

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Helper para hacer consultas a Supabase con soporte para joins
    async function querySupabase(endpoint: string) {
      const url = `${supabaseUrl}/rest/v1/${endpoint}`;

      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error en consulta: ${errorText}`);
      }

      return await response.json();
    }

    // VALIDACIÓN ELIMINADA: Ya no se verifica la asignación maestro-programa
    // Permitimos que cualquier maestro pueda ser asignado a cualquier materia
    // Las validaciones reales son: conflictos de horario y disponibilidad

    // 1. Verificar conflictos con otros horarios del maestro (EN CUALQUIER PROGRAMA)
    let teacherSchedulesEndpoint = `schedule?select=id,start_hour,end_hour,day,subject_id,group_id,subjects(name,clave,programs(name)),groups(name)&teacher_id=eq.${teacher_id}&day=eq.${day}`;
    
    if (school_cycle_id) {
      teacherSchedulesEndpoint += `&school_cycle_id=eq.${school_cycle_id}`;
    }

    if (exclude_schedule_id) {
      teacherSchedulesEndpoint += `&id=neq.${exclude_schedule_id}`;
    }

    const teacherSchedules = await querySupabase(teacherSchedulesEndpoint);

    // Obtener datos del maestro para mensajes
    const teacherData = await querySupabase(`teachers?select=name&id=eq.${teacher_id}`);
    const teacher_name = teacherData?.[0]?.name || 'Maestro desconocido';

    // Verificar empalmes de horario del maestro (en cualquier programa)
    for (const schedule of teacherSchedules) {
      if (!(end_hour <= schedule.start_hour || start_hour >= schedule.end_hour)) {
        const conflict_subject_name = schedule.subjects?.name || 'Materia desconocida';
        const conflict_subject_clave = schedule.subjects?.clave || '';
        const conflict_program_name = schedule.subjects?.programs?.name || 'Programa desconocido';
        const conflict_group_name = schedule.groups?.name || 'Grupo desconocido';

        teacher_conflicts.push({
          type: 'teacher_time_conflict',
          message: `El maestro "${teacher_name}" ya tiene programada la materia "${conflict_subject_name} (${conflict_subject_clave})" del programa "${conflict_program_name}" con el grupo "${conflict_group_name}" de ${schedule.start_hour}:00 a ${schedule.end_hour}:00 el ${day}`,
          teacher: teacher_name,
          day: day,
          conflicting_hours: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
          conflicting_subject: conflict_subject_name,
          conflicting_subject_code: conflict_subject_clave,
          conflicting_program: conflict_program_name,
          conflicting_group: conflict_group_name,
        });
      }
    }

    // 2. Verificar conflictos con otros horarios del grupo
    let groupSchedulesEndpoint = `schedule?select=id,start_hour,end_hour,day,teacher_id,subject_id,teachers(name),subjects(name,clave)&group_id=eq.${group_id}&day=eq.${day}`;
    
    if (school_cycle_id) {
      groupSchedulesEndpoint += `&school_cycle_id=eq.${school_cycle_id}`;
    }

    if (exclude_schedule_id) {
      groupSchedulesEndpoint += `&id=neq.${exclude_schedule_id}`;
    }

    const groupSchedules = await querySupabase(groupSchedulesEndpoint);

    // Obtener datos del grupo para mensajes
    const groupData = await querySupabase(`groups?select=name&id=eq.${group_id}`);
    const group_name = groupData?.[0]?.name || 'Grupo desconocido';

    // Verificar empalmes de horario del grupo
    for (const schedule of groupSchedules) {
      if (!(end_hour <= schedule.start_hour || start_hour >= schedule.end_hour)) {
        const conflict_teacher_name = schedule.teachers?.name || 'Maestro desconocido';
        const conflict_subject_name = schedule.subjects?.name || 'Materia desconocida';
        const conflict_subject_clave = schedule.subjects?.clave || '';

        group_conflicts.push({
          type: 'group_time_conflict',
          message: `El grupo "${group_name}" ya tiene programada la materia "${conflict_subject_name} (${conflict_subject_clave})" con el maestro "${conflict_teacher_name}" de ${schedule.start_hour}:00 a ${schedule.end_hour}:00 el ${day}`,
          group: group_name,
          day: day,
          conflicting_hours: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
          conflicting_subject: conflict_subject_name,
          conflicting_subject_code: conflict_subject_clave,
          conflicting_teacher: conflict_teacher_name,
        });
      }
    }

    // 3. Verificar disponibilidad del maestro (horarios NO disponibles)
    const unavailabilities = await querySupabase(
      `availability?select=id,start_hour,end_hour&teacher_id=eq.${teacher_id}&day=eq.${day}`
    );

    // Verificar si el horario propuesto cae en un periodo de no disponibilidad
    for (const unavail of unavailabilities) {
      if (!(end_hour <= unavail.start_hour || start_hour >= unavail.end_hour)) {
        availability_conflicts.push({
          type: 'teacher_unavailable',
          message: `El maestro "${teacher_name}" NO está disponible de ${unavail.start_hour}:00 a ${unavail.end_hour}:00 el ${day}`,
          teacher: teacher_name,
          day: day,
          unavailable_hours: `${unavail.start_hour}:00 - ${unavail.end_hour}:00`,
        });
      }
    }

    // Retornar resultado de validación
    const totalConflicts = teacher_conflicts.length + group_conflicts.length + availability_conflicts.length;
    
    return new Response(
      JSON.stringify({
        valid: totalConflicts === 0,
        message: totalConflicts === 0 ? 'No se encontraron conflictos. El horario puede ser programado.' : `Se encontraron ${totalConflicts} conflicto(s)`,
        conflicts: {
          program_assignment_conflicts: program_assignment_conflicts,
          teacher_conflicts: teacher_conflicts,
          group_conflicts: group_conflicts,
          availability_conflicts: availability_conflicts,
        },
        summary: {
          total_conflicts: totalConflicts,
          has_teacher_conflicts: teacher_conflicts.length > 0,
          has_group_conflicts: group_conflicts.length > 0,
          has_availability_conflicts: availability_conflicts.length > 0,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        valid: false,
        message: 'Error al validar conflictos'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});