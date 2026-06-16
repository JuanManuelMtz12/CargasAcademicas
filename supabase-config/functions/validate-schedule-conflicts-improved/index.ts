// Edge Function MEJORADA para validar conflictos de horarios
// Verifica empalmes de maestros (en cualquier programa), grupos y disponibilidad
// Retorna información detallada de los conflictos

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
    const { teacher_id, group_id, day, start_hour, end_hour, school_cycle_id, exclude_schedule_id } = await req.json();

    // Validar parámetros requeridos
    if (!teacher_id || !group_id || !day || start_hour === undefined || end_hour === undefined) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que start_hour < end_hour
    if (start_hour >= end_hour) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          conflicts: {
            teacher_conflicts: [],
            group_conflicts: [],
            availability_conflicts: [{
              type: 'invalid_hours',
              message: 'La hora de inicio debe ser menor que la hora de fin'
            }]
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teacher_conflicts: any[] = [];
    const group_conflicts: any[] = [];
    const availability_conflicts: any[] = [];

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Helper para hacer consultas a Supabase
    async function querySupabase(url: string) {
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

    // 1. VERIFICAR CONFLICTOS DEL MAESTRO (en cualquier programa/licenciatura)
    // El maestro no puede dar dos clases al mismo tiempo, sin importar el programa
    let teacherSchedulesUrl = `${supabaseUrl}/rest/v1/schedule?teacher_id=eq.${teacher_id}&day=eq.${day}`;
    teacherSchedulesUrl += `&select=id,start_hour,end_hour,group_id,subject_id,groups(name),subjects(name,clave,program_id,programs(name,type))`;
    
    if (school_cycle_id) {
      teacherSchedulesUrl += `&school_cycle_id=eq.${school_cycle_id}`;
    }

    if (exclude_schedule_id) {
      teacherSchedulesUrl += `&id=neq.${exclude_schedule_id}`;
    }

    const teacherSchedules = await querySupabase(teacherSchedulesUrl);

    // Verificar empalmes de horario del maestro
    for (const schedule of teacherSchedules) {
      // Verificar si hay empalme: dos horarios se empalman si NO (uno termina antes de que empiece el otro)
      const hasOverlap = !(end_hour <= schedule.start_hour || start_hour >= schedule.end_hour);
      
      if (hasOverlap) {
        const subjectInfo = schedule.subjects || {};
        const programInfo = subjectInfo.programs || {};
        const groupInfo = schedule.groups || {};
        
        teacher_conflicts.push({
          type: 'teacher_overlap',
          day: day,
          start_hour: schedule.start_hour,
          end_hour: schedule.end_hour,
          subject_name: subjectInfo.name || 'Materia desconocida',
          subject_clave: subjectInfo.clave || '',
          group_name: groupInfo.name || 'Grupo desconocido',
          program_name: programInfo.name || 'Programa desconocido',
          program_type: programInfo.type || '',
          message: `El maestro ya tiene clase de ${subjectInfo.clave || ''} - ${subjectInfo.name || 'Materia'} con el grupo ${groupInfo.name || 'Grupo'} en ${programInfo.name || 'Programa'} de ${schedule.start_hour}:00 a ${schedule.end_hour}:00`
        });
      }
    }

    // 2. VERIFICAR CONFLICTOS DEL GRUPO
    // El grupo no puede tener dos maestros al mismo tiempo
    let groupSchedulesUrl = `${supabaseUrl}/rest/v1/schedule?group_id=eq.${group_id}&day=eq.${day}`;
    groupSchedulesUrl += `&select=id,start_hour,end_hour,teacher_id,subject_id,teachers(name),subjects(name,clave,program_id,programs(name,type))`;
    
    if (school_cycle_id) {
      groupSchedulesUrl += `&school_cycle_id=eq.${school_cycle_id}`;
    }

    if (exclude_schedule_id) {
      groupSchedulesUrl += `&id=neq.${exclude_schedule_id}`;
    }

    const groupSchedules = await querySupabase(groupSchedulesUrl);

    // Verificar empalmes de horario del grupo
    for (const schedule of groupSchedules) {
      const hasOverlap = !(end_hour <= schedule.start_hour || start_hour >= schedule.end_hour);
      
      if (hasOverlap) {
        const teacherInfo = schedule.teachers || {};
        const subjectInfo = schedule.subjects || {};
        const programInfo = subjectInfo.programs || {};
        
        group_conflicts.push({
          type: 'group_overlap',
          day: day,
          start_hour: schedule.start_hour,
          end_hour: schedule.end_hour,
          teacher_name: teacherInfo.name || 'Maestro desconocido',
          subject_name: subjectInfo.name || 'Materia desconocida',
          subject_clave: subjectInfo.clave || '',
          program_name: programInfo.name || 'Programa desconocido',
          message: `El grupo ya tiene clase de ${subjectInfo.clave || ''} - ${subjectInfo.name || 'Materia'} con el maestro ${teacherInfo.name || 'Maestro'} de ${schedule.start_hour}:00 a ${schedule.end_hour}:00`
        });
      }
    }

    // 3. VERIFICAR DISPONIBILIDAD DEL MAESTRO
    // La tabla availability contiene horarios donde el maestro NO está disponible
    const unavailabilitiesUrl = `${supabaseUrl}/rest/v1/availability?teacher_id=eq.${teacher_id}&day=eq.${day}&select=id,start_hour,end_hour`;
    const unavailabilities = await querySupabase(unavailabilitiesUrl);

    // Verificar si el horario propuesto cae en un periodo de no disponibilidad
    for (const unavail of unavailabilities) {
      const hasOverlap = !(end_hour <= unavail.start_hour || start_hour >= unavail.end_hour);
      
      if (hasOverlap) {
        availability_conflicts.push({
          type: 'teacher_unavailable',
          day: day,
          start_hour: unavail.start_hour,
          end_hour: unavail.end_hour,
          message: `El maestro NO está disponible de ${unavail.start_hour}:00 a ${unavail.end_hour}:00 en ${day}`
        });
      }
    }

    // Retornar resultado de validación con información detallada
    const totalConflicts = teacher_conflicts.length + group_conflicts.length + availability_conflicts.length;
    
    return new Response(
      JSON.stringify({
        valid: totalConflicts === 0,
        message: totalConflicts === 0 ? 'No se encontraron conflictos' : `Se encontraron ${totalConflicts} conflicto(s)`,
        conflicts: {
          teacher_conflicts: teacher_conflicts,
          group_conflicts: group_conflicts,
          availability_conflicts: availability_conflicts,
        },
        summary: {
          total_conflicts: totalConflicts,
          teacher_conflicts_count: teacher_conflicts.length,
          group_conflicts_count: group_conflicts.length,
          availability_conflicts_count: availability_conflicts.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        valid: false,
        conflicts: {
          teacher_conflicts: [],
          group_conflicts: [],
          availability_conflicts: [{
            type: 'system_error',
            message: `Error del sistema: ${error.message}`
          }]
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
