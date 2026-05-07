// Edge Function para validar conflictos de múltiples sesiones de horarios
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse request data
    const requestData = await req.json()
    const { 
      teacher_id, 
      subject_id, 
      group_id, 
      school_cycle_id,
      sessions // Array of { day, start_hour, end_hour, temp_id }
    } = requestData

    console.log('[VALIDACIÓN MULTI-SESIÓN] Datos recibidos:', {
      teacher_id,
      subject_id,
      group_id,
      school_cycle_id,
      sessions_count: sessions?.length || 0,
    })

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'No se recibieron sesiones para validar',
          sessionResults: [],
          summary: {
            total_sessions: 0,
            valid_sessions: 0,
            sessions_with_conflicts: 0,
            total_conflicts: 0,
            critical_count: 0,
            warning_count: 0,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Obtener información del programa (para validar conflictos de grupo)
    const { data: requestSubjectData, error: subjectError } = await supabase
      .from('subjects')
      .select('program_id, programs(name)')
      .eq('id', subject_id)
      .single()

    if (subjectError) {
      console.error('[VALIDACIÓN MULTI-SESIÓN] Error obteniendo datos de materia:', subjectError)
      throw subjectError
    }

    const requestProgramId = requestSubjectData?.program_id
    const requestProgramName = (requestSubjectData?.programs as any)?.name || 'Programa desconocido'

    console.log(`[VALIDACIÓN MULTI-SESIÓN] Validando en programa: ${requestProgramName} (ID: ${requestProgramId})`)

    // Array para almacenar resultados de cada sesión
    const sessionResults: any[] = []
    let totalConflicts = 0
    let criticalCount = 0
    let warningCount = 0

    // Validar cada sesión
    for (const session of sessions) {
      const { day, start_hour, end_hour, temp_id } = session

      console.log(`[VALIDACIÓN MULTI-SESIÓN] Validando sesión ${temp_id}: ${day} ${start_hour}:00-${end_hour}:00`)

      const sessionConflict = {
        sessionTempId: temp_id,
        day,
        start_hour,
        end_hour,
        conflicts: {
          teacher_conflicts: [] as any[],
          group_conflicts: [] as any[],
          availability_conflicts: [] as any[],
        },
      }

      // ======================================================================
      // 1. VALIDAR CONFLICTOS DEL MAESTRO (EMPALMES)
      // ======================================================================
      const { data: teacherSchedules, error: teacherError } = await supabase
        .from('schedule')
        .select('id, start_hour, end_hour, subject_id, group_id, subjects(name, clave, programs(name)), groups(name)')
        .eq('teacher_id', teacher_id)
        .eq('day', day)
        .eq('school_cycle_id', school_cycle_id)

      if (teacherError) {
        console.error('[VALIDACIÓN MULTI-SESIÓN] Error verificando conflictos de maestro:', teacherError)
        throw teacherError
      }

      // Verificar empalmes de tiempo con horarios existentes del maestro
      if (teacherSchedules) {
        for (const schedule of teacherSchedules) {
          const hasOverlap = !(end_hour <= schedule.start_hour || start_hour >= schedule.end_hour)
          
          if (hasOverlap) {
            const subjectName = (schedule.subjects as any)?.name || 'Materia'
            const subjectClave = (schedule.subjects as any)?.clave || ''
            const programName = (schedule.subjects as any)?.programs?.name || 'Programa'
            const groupName = (schedule.groups as any)?.name || 'Grupo'

            sessionConflict.conflicts.teacher_conflicts.push({
              type: 'teacher_time_overlap',
              severity: 'critical',
              message: `El maestro ya tiene clase de ${subjectClave} - ${subjectName} con el grupo ${groupName} en ${programName} de ${schedule.start_hour}:00 a ${schedule.end_hour}:00 el ${day}`,
              details: {
                conflicting_subject: `${subjectClave} - ${subjectName}`,
                conflicting_program: programName,
                conflicting_group: groupName,
                conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
              },
            })

            criticalCount++
            totalConflicts++
          }
        }
      }

      // ======================================================================
      // 2. VALIDAR CONFLICTOS DEL GRUPO (SOLO DENTRO DEL MISMO PROGRAMA)
      // ======================================================================
      if (requestProgramId) {
        const { data: groupSchedules, error: groupError } = await supabase
          .from('schedule')
          .select('id, start_hour, end_hour, teacher_id, subject_id, teachers(name), subjects(name, clave, program_id, programs(name))')
          .eq('group_id', group_id)
          .eq('day', day)
          .eq('school_cycle_id', school_cycle_id)

        if (groupError) {
          console.error('[VALIDACIÓN MULTI-SESIÓN] Error verificando conflictos de grupo:', groupError)
          throw groupError
        }

        // Filtrar solo los horarios que pertenecen al MISMO PROGRAMA
        const sameProgramSchedules = groupSchedules?.filter(
          schedule => (schedule.subjects as any)?.program_id === requestProgramId
        ) || []

        // Verificar empalmes SOLO dentro del mismo programa
        for (const schedule of sameProgramSchedules) {
          const hasOverlap = !(end_hour <= schedule.start_hour || start_hour >= schedule.end_hour)
          
          if (hasOverlap) {
            const teacherName = (schedule.teachers as any)?.name || 'Maestro'
            const subjectName = (schedule.subjects as any)?.name || 'Materia'
            const subjectClave = (schedule.subjects as any)?.clave || ''

            sessionConflict.conflicts.group_conflicts.push({
              type: 'group_time_overlap',
              severity: 'critical',
              message: `El grupo ya tiene clase de ${subjectClave} - ${subjectName} con el maestro ${teacherName} de ${schedule.start_hour}:00 a ${schedule.end_hour}:00 el ${day} en el programa ${requestProgramName}`,
              details: {
                program: requestProgramName,
                conflicting_subject: `${subjectClave} - ${subjectName}`,
                conflicting_teacher: teacherName,
                conflicting_time: `${schedule.start_hour}:00 - ${schedule.end_hour}:00`,
              },
            })

            criticalCount++
            totalConflicts++
          }
        }
      }

      // ======================================================================
      // 3. VALIDAR CONFLICTOS ENTRE SESIONES DEL MISMO FORMULARIO
      // ======================================================================
      for (const otherSession of sessions) {
        if (otherSession.temp_id !== temp_id && otherSession.day === day) {
          const hasOverlap = !(end_hour <= otherSession.start_hour || start_hour >= otherSession.end_hour)
          
          if (hasOverlap) {
            sessionConflict.conflicts.teacher_conflicts.push({
              type: 'internal_session_overlap',
              severity: 'critical',
              message: `Conflicto con otra sesión del mismo formulario: ${otherSession.day} ${otherSession.start_hour}:00-${otherSession.end_hour}:00`,
              details: {
                conflicting_time: `${otherSession.start_hour}:00 - ${otherSession.end_hour}:00`,
                internal_conflict: true,
              },
            })

            criticalCount++
            totalConflicts++
          }
        }
      }

      sessionResults.push(sessionConflict)
    }

    // ======================================================================
    // 4. CONSTRUIR RESULTADO FINAL
    // ======================================================================
    const validSessions = sessionResults.filter(
      sr => sr.conflicts.teacher_conflicts.length === 0 &&
            sr.conflicts.group_conflicts.length === 0 &&
            sr.conflicts.availability_conflicts.length === 0
    ).length

    const result = {
      valid: totalConflicts === 0,
      message: totalConflicts === 0
        ? `✅ Todas las ${sessions.length} sesiones son válidas`
        : `⚠️ Se encontraron ${totalConflicts} conflicto(s) en ${sessions.length - validSessions} sesión(es)`,
      sessionResults,
      summary: {
        total_sessions: sessions.length,
        valid_sessions: validSessions,
        sessions_with_conflicts: sessions.length - validSessions,
        total_conflicts: totalConflicts,
        critical_count: criticalCount,
        warning_count: warningCount,
      },
      validationMethod: 'edge-function' as const,
    }

    console.log('[VALIDACIÓN MULTI-SESIÓN] Resultado final:', result.summary)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('[VALIDACIÓN MULTI-SESIÓN] Error general:', error)
    
    const errorResponse = {
      valid: false,
      message: 'Error interno en validación',
      sessionResults: [],
      summary: {
        total_sessions: 0,
        valid_sessions: 0,
        sessions_with_conflicts: 0,
        total_conflicts: 0,
        critical_count: 0,
        warning_count: 0,
      },
      validationMethod: 'error' as const,
      error: error.message,
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
