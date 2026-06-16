// Edge Function para validar conflictos de horarios
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
      day, 
      start_hour, 
      end_hour, 
      school_cycle_id,
      exclude_schedule_id 
    } = requestData

    console.log('[VALIDACIÓN EDGE] Datos recibidos:', requestData)

    // ======================================================================
    // 1. VALIDAR DUPLICADO EXACTO
    // ======================================================================
    let duplicateQuery = supabase
      .from('schedule')
      .select('id, teachers(name), subjects(name, clave), groups(name)')
      .eq('teacher_id', teacher_id)
      .eq('subject_id', subject_id)
      .eq('group_id', group_id)
      .eq('day', day)
      .eq('start_hour', start_hour)
      .eq('end_hour', end_hour)

    if (school_cycle_id) {
      duplicateQuery = duplicateQuery.eq('school_cycle_id', school_cycle_id)
    }

    if (exclude_schedule_id) {
      duplicateQuery = duplicateQuery.neq('id', exclude_schedule_id)
    }

    const { data: duplicates, error: duplicateError } = await duplicateQuery

    if (duplicateError) {
      console.error('[VALIDACIÓN EDGE] Error verificando duplicados:', duplicateError)
      throw duplicateError
    }

    const conflicts = {
      teacher_conflicts: [] as any[],
      group_conflicts: [] as any[],
      availability_conflicts: [] as any[]
    }

    if (duplicates && duplicates.length > 0) {
      const duplicate = duplicates[0]
      const teacherName = (duplicate.teachers as any)?.name || 'Maestro'
      const subjectName = (duplicate.subjects as any)?.name || 'Materia'
      const subjectClave = (duplicate.subjects as any)?.clave || ''
      const groupName = (duplicate.groups as any)?.name || 'Grupo'

      conflicts.teacher_conflicts.push({
        type: 'duplicate_schedule',
        severity: 'critical',
        message: `❌ Esta asignación ya existe: ${teacherName} imparte ${subjectClave} - ${subjectName} al grupo ${groupName} el ${day} de ${start_hour}:00 a ${end_hour}:00`,
        details: {
          teacher: teacherName,
          subject: `${subjectClave} - ${subjectName}`,
          group: groupName,
          day: day,
          time: `${start_hour}:00 - ${end_hour}:00`,
          reason: 'Duplicado exacto - violación de restricción única de base de datos',
        },
      })

      console.warn('[VALIDACIÓN EDGE] Duplicado exacto detectado:', duplicate)
    }

    // ======================================================================
    // 2. VALIDAR CONFLICTOS DEL MAESTRO (EMPALMES)
    // ======================================================================
    let teacherQuery = supabase
      .from('schedule')
      .select('id, start_hour, end_hour, subject_id, group_id, subjects(name, clave, programs(name)), groups(name)')
      .eq('teacher_id', teacher_id)
      .eq('day', day)

    if (school_cycle_id) {
      teacherQuery = teacherQuery.eq('school_cycle_id', school_cycle_id)
    }

    if (exclude_schedule_id) {
      teacherQuery = teacherQuery.neq('id', exclude_schedule_id)
    }

    const { data: teacherSchedules, error: teacherError } = await teacherQuery

    if (teacherError) {
      console.error('[VALIDACIÓN EDGE] Error verificando conflictos de maestro:', teacherError)
      throw teacherError
    }

    // Verificar empalmes usando lógica de tiempo overlap
    if (teacherSchedules) {
      for (const schedule of teacherSchedules) {
        const scheduleStart = schedule.start_hour
        const scheduleEnd = schedule.end_hour
        
        // Verificar si hay overlap: !(end1 <= start2 || start1 >= end2)
        const hasOverlap = !(end_hour <= scheduleStart || start_hour >= scheduleEnd)
        
        if (hasOverlap) {
          const subjectName = (schedule.subjects as any)?.name || 'Materia'
          const subjectClave = (schedule.subjects as any)?.clave || ''
          const programName = (schedule.subjects as any)?.programs?.name || 'Programa'
          const groupName = (schedule.groups as any)?.name || 'Grupo'

          conflicts.teacher_conflicts.push({
            type: 'teacher_time_overlap',
            severity: 'critical',
            message: `El maestro ya tiene clase de ${subjectClave} - ${subjectName} con el grupo ${groupName} en ${programName} de ${scheduleStart}:00 a ${scheduleEnd}:00 el ${day}`,
            details: {
              conflicting_subject: `${subjectClave} - ${subjectName}`,
              conflicting_program: programName,
              conflicting_group: groupName,
              conflicting_time: `${scheduleStart}:00 - ${scheduleEnd}:00`,
            },
          })
        }
      }
    }

    // ======================================================================
    // 3. VALIDAR CONFLICTOS DEL GRUPO (SOLO DENTRO DEL MISMO PROGRAMA)
    // ======================================================================
    
    // PASO 1: Obtener el program_id de la materia que se está intentando asignar
    const { data: requestSubjectData, error: subjectError } = await supabase
      .from('subjects')
      .select('program_id, programs(name)')
      .eq('id', subject_id)
      .single()

    if (subjectError) {
      console.error('[VALIDACIÓN EDGE] Error obteniendo datos de materia:', subjectError)
      throw subjectError
    }

    const requestProgramId = requestSubjectData?.program_id
    const requestProgramName = (requestSubjectData?.programs as any)?.name || 'Programa desconocido'

    console.log(`[VALIDACIÓN EDGE] Validando grupo en programa: ${requestProgramName} (ID: ${requestProgramId})`)

    // Solo continuar si se pudo determinar el programa
    if (requestProgramId) {
      // PASO 2: Query para obtener horarios del grupo, incluyendo el program_id
      let groupQuery = supabase
        .from('schedule')
        .select('id, start_hour, end_hour, teacher_id, subject_id, teachers(name), subjects(name, clave, program_id, programs(name))')
        .eq('group_id', group_id)
        .eq('day', day)

      if (school_cycle_id) {
        groupQuery = groupQuery.eq('school_cycle_id', school_cycle_id)
      }

      if (exclude_schedule_id) {
        groupQuery = groupQuery.neq('id', exclude_schedule_id)
      }

      const { data: groupSchedules, error: groupError } = await groupQuery

      if (groupError) {
        console.error('[VALIDACIÓN EDGE] Error verificando conflictos de grupo:', groupError)
        throw groupError
      }

      // PASO 3: Filtrar solo los horarios que pertenecen al MISMO PROGRAMA
      const sameProgramSchedules = groupSchedules?.filter(
        schedule => (schedule.subjects as any)?.program_id === requestProgramId
      ) || []

      console.log(`[VALIDACIÓN EDGE] Horarios del grupo en el mismo programa: ${sameProgramSchedules.length}`)

      // PASO 4: Verificar empalmes SOLO dentro del mismo programa
      for (const schedule of sameProgramSchedules) {
        const scheduleStart = schedule.start_hour
        const scheduleEnd = schedule.end_hour
        
        // Verificar si hay overlap
        const hasOverlap = !(end_hour <= scheduleStart || start_hour >= scheduleEnd)
        
        if (hasOverlap) {
          const teacherName = (schedule.teachers as any)?.name || 'Maestro'
          const subjectName = (schedule.subjects as any)?.name || 'Materia'
          const subjectClave = (schedule.subjects as any)?.clave || ''

          conflicts.group_conflicts.push({
            type: 'group_time_overlap',
            severity: 'critical',
            message: `El grupo ya tiene clase de ${subjectClave} - ${subjectName} con el maestro ${teacherName} de ${scheduleStart}:00 a ${scheduleEnd}:00 el ${day} en el programa ${requestProgramName}`,
            details: {
              program: requestProgramName,
              conflicting_subject: `${subjectClave} - ${subjectName}`,
              conflicting_teacher: teacherName,
              conflicting_time: `${scheduleStart}:00 - ${scheduleEnd}:00`,
            },
          })
        }
      }
    }

        // ======================================================================
    // 4. VALIDAR DISPONIBILIDAD DEL MAESTRO (ADVERTENCIA, NO BLOQUEA)
    // ======================================================================
    try {
      // ⚠️ Reemplaza 'teacher_availability' por el NOMBRE REAL de tu tabla de disponibilidad
      const { data: availabilityRows, error: availabilityError } = await supabase
        .from('teacher_availability')          // <-- NOMBRE DE TABLA
        .select('start_hour, end_hour')
        .eq('teacher_id', teacher_id)
        .eq('day', day);

      if (availabilityError) {
        console.warn('[VALIDACIÓN EDGE] Error verificando disponibilidad del maestro:', availabilityError);
      } else if (availabilityRows && availabilityRows.length > 0) {
        for (const row of availabilityRows as any[]) {
          const unavailableStart = row.start_hour;
          const unavailableEnd = row.end_hour;

          // overlap: !(end1 <= start2 || start1 >= end2)
          const hasOverlap = !(end_hour <= unavailableStart || start_hour >= unavailableEnd);

          if (hasOverlap) {
            conflicts.availability_conflicts.push({
              type: 'teacher_unavailable',
              severity: 'warning', // 👈 SOLO ADVERTENCIA
              message: `El maestro no está disponible en este horario (${unavailableStart}:00 - ${unavailableEnd}:00)`,
              details: {
                day,
                unavailable_time: `${unavailableStart}:00 - ${unavailableEnd}:00`,
              },
            });
          }
        }
      }
    } catch (availabilityError) {
      console.warn('[VALIDACIÓN EDGE] Error verificando disponibilidad del maestro:', availabilityError);
    }

    // ======================================================================
    // 5. CONSTRUIR RESULTADO FINAL
    // ======================================================================


    // ======================================================================
    // 4. CONSTRUIR RESULTADO FINAL
    // ======================================================================
    const totalConflicts =
      conflicts.teacher_conflicts.length +
      conflicts.group_conflicts.length +
      conflicts.availability_conflicts.length

    const criticalCount = [
      ...conflicts.teacher_conflicts,
      ...conflicts.group_conflicts,
      ...conflicts.availability_conflicts,
    ].filter((c: any) => c.severity === 'critical').length

    const warningCount = [
      ...conflicts.teacher_conflicts,
      ...conflicts.group_conflicts,
      ...conflicts.availability_conflicts,
    ].filter((c: any) => c.severity === 'warning').length

    const result = {
      valid: totalConflicts === 0,
      message:
        totalConflicts === 0
          ? '✅ No se encontraron conflictos'
          : `⚠️ Se encontraron ${totalConflicts} conflicto(s)`,
      conflicts,
      summary: {
        total_conflicts: totalConflicts,
        critical_count: criticalCount,
        warning_count: warningCount,
      },
      validationMethod: 'edge-function' as const,
    }

    console.log('[VALIDACIÓN EDGE] Resultado final:', result)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('[VALIDACIÓN EDGE] Error general:', error)
    
    const errorResponse = {
      valid: false,
      message: 'Error interno en validación',
      conflicts: {
        teacher_conflicts: [],
        group_conflicts: [],
        availability_conflicts: [],
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
