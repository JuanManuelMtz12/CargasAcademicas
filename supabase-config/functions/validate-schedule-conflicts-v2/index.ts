/**
 * Edge Function: Validación Profesional de Conflictos de Horarios
 * 
 * Detecta empalmes en tiempo real entre:
 * - Maestros (mismo maestro en dos lugares al mismo tiempo, sin importar el programa)
 * - Grupos (mismo grupo con dos maestros al mismo tiempo)
 * - Disponibilidad (maestro no disponible en el horario solicitado)
 * 
 * Arquitectura: Validación robusta con manejo de errores, logs detallados
 * y respuestas estructuradas para una experiencia de usuario profesional.
 * 
 * @author MiniMax Agent
 * @version 2.0 - Refactorización profesional
 */

// ============================================================================
// CONFIGURACIÓN CORS
// ============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================
interface ValidationRequest {
  teacher_id: string;
  subject_id: string;
  group_id: string;
  day: string;
  start_hour: number;
  end_hour: number;
  school_cycle_id?: string;
  exclude_schedule_id?: string;
}

interface Conflict {
  type: string;
  message: string;
  severity: 'critical' | 'warning';
  details: Record<string, any>;
}

interface ValidationResponse {
  valid: boolean;
  message: string;
  conflicts: {
    teacher_conflicts: Conflict[];
    group_conflicts: Conflict[];
    availability_conflicts: Conflict[];
  };
  summary: {
    total_conflicts: number;
    critical_count: number;
    warning_count: number;
  };
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Verifica si dos rangos de tiempo se empalman
 */
function hasTimeOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return !(end1 <= start2 || start1 >= end2);
}

/**
 * Formatea una hora para mostrar
 */
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

/**
 * Crea una respuesta de error estandarizada
 */
function createErrorResponse(message: string, status: number = 500): Response {
  console.error(`[ERROR] ${message}`);
  return new Response(
    JSON.stringify({
      error: message,
      valid: false,
      conflicts: {
        teacher_conflicts: [],
        group_conflicts: [],
        availability_conflicts: [],
      },
      summary: {
        total_conflicts: 0,
        critical_count: 0,
        warning_count: 0,
      },
    }),
    {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Realiza una query a Supabase con manejo de errores
 */
async function querySupabase(endpoint: string): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configuración de Supabase no disponible');
  }

  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  console.log(`[QUERY] ${endpoint}`);

  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Query failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

/**
 * Valida conflictos de horario del maestro
 * Un maestro NO puede estar en dos lugares al mismo tiempo, sin importar el programa
 */
async function validateTeacherConflicts(
  request: ValidationRequest
): Promise<Conflict[]> {
  console.log(`[VALIDACIÓN] Verificando conflictos del maestro: ${request.teacher_id}`);
  
  const conflicts: Conflict[] = [];

  try {
    // Query para obtener todos los horarios del maestro en el mismo día
    let endpoint = `schedule?select=id,start_hour,end_hour,subject_id,group_id,subjects(name,clave,programs(name,type)),groups(name)&teacher_id=eq.${request.teacher_id}&day=eq.${request.day}`;
    
    if (request.school_cycle_id) {
      endpoint += `&school_cycle_id=eq.${request.school_cycle_id}`;
    }

    if (request.exclude_schedule_id) {
      endpoint += `&id=neq.${request.exclude_schedule_id}`;
    }

    const teacherSchedules = await querySupabase(endpoint);

    // Obtener información del maestro
    const teacherData = await querySupabase(`teachers?select=name&id=eq.${request.teacher_id}`);
    const teacherName = teacherData?.[0]?.name || 'Maestro desconocido';

    // Verificar empalmes
    for (const schedule of teacherSchedules) {
      if (hasTimeOverlap(request.start_hour, request.end_hour, schedule.start_hour, schedule.end_hour)) {
        const subjectName = schedule.subjects?.name || 'Materia desconocida';
        const subjectClave = schedule.subjects?.clave || '';
        const programName = schedule.subjects?.programs?.name || 'Programa desconocido';
        const groupName = schedule.groups?.name || 'Grupo desconocido';

        conflicts.push({
          type: 'teacher_time_overlap',
          severity: 'critical',
          message: `El maestro "${teacherName}" ya tiene clase de ${subjectClave} - ${subjectName} con el grupo ${groupName} en el programa ${programName} de ${formatHour(schedule.start_hour)} a ${formatHour(schedule.end_hour)} el ${request.day}`,
          details: {
            teacher: teacherName,
            day: request.day,
            requested_time: `${formatHour(request.start_hour)} - ${formatHour(request.end_hour)}`,
            conflicting_time: `${formatHour(schedule.start_hour)} - ${formatHour(schedule.end_hour)}`,
            conflicting_subject: `${subjectClave} - ${subjectName}`,
            conflicting_program: programName,
            conflicting_group: groupName,
          },
        });
      }
    }

    console.log(`[RESULTADO] Conflictos de maestro encontrados: ${conflicts.length}`);
  } catch (error) {
    console.error('[ERROR] Error al validar conflictos de maestro:', error);
    throw error;
  }

  return conflicts;
}

/**
 * Valida conflictos de horario del grupo DENTRO DEL MISMO PROGRAMA
 * Un grupo NO puede tener dos maestros al mismo tiempo EN EL MISMO PROGRAMA
 * Los grupos son específicos por programa (ej: 1A de Intervención ≠ 1A de Administración)
 */
async function validateGroupConflicts(
  request: ValidationRequest
): Promise<Conflict[]> {
  console.log(`[VALIDACIÓN] Verificando conflictos del grupo: ${request.group_id}`);
  
  const conflicts: Conflict[] = [];

  try {
    // PASO 1: Obtener el program_id de la materia que se está intentando asignar
    const requestSubjectData = await querySupabase(`subjects?select=program_id,programs(name,type)&id=eq.${request.subject_id}`);
    const requestProgramId = requestSubjectData?.[0]?.program_id;
    const requestProgramName = requestSubjectData?.[0]?.programs?.name || 'Programa desconocido';
    
    if (!requestProgramId) {
      console.warn('[ADVERTENCIA] No se pudo determinar el programa de la materia solicitada');
      return conflicts;
    }

    console.log(`[INFO] Validando grupo en programa: ${requestProgramName} (ID: ${requestProgramId})`);

    // PASO 2: Query para obtener horarios del grupo en el mismo día
    // Incluimos el program_id en la consulta para filtrar por programa
    let endpoint = `schedule?select=id,start_hour,end_hour,teacher_id,subject_id,teachers(name),subjects(name,clave,program_id,programs(name))&group_id=eq.${request.group_id}&day=eq.${request.day}`;
    
    if (request.school_cycle_id) {
      endpoint += `&school_cycle_id=eq.${request.school_cycle_id}`;
    }

    if (request.exclude_schedule_id) {
      endpoint += `&id=neq.${request.exclude_schedule_id}`;
    }

    const groupSchedules = await querySupabase(endpoint);

    // PASO 3: Filtrar solo los horarios que pertenecen al MISMO PROGRAMA
    const sameProgramSchedules = groupSchedules.filter(
      schedule => schedule.subjects?.program_id === requestProgramId
    );

    console.log(`[INFO] Horarios encontrados del grupo en el mismo programa: ${sameProgramSchedules.length}`);

    // Obtener información del grupo
    const groupData = await querySupabase(`groups?select=name&id=eq.${request.group_id}`);
    const groupName = groupData?.[0]?.name || 'Grupo desconocido';

    // PASO 4: Verificar empalmes SOLO dentro del mismo programa
    for (const schedule of sameProgramSchedules) {
      if (hasTimeOverlap(request.start_hour, request.end_hour, schedule.start_hour, schedule.end_hour)) {
        const teacherName = schedule.teachers?.name || 'Maestro desconocido';
        const subjectName = schedule.subjects?.name || 'Materia desconocida';
        const subjectClave = schedule.subjects?.clave || '';

        conflicts.push({
          type: 'group_time_overlap',
          severity: 'critical',
          message: `El grupo "${groupName}" ya tiene clase de ${subjectClave} - ${subjectName} con el maestro ${teacherName} de ${formatHour(schedule.start_hour)} a ${formatHour(schedule.end_hour)} el ${request.day} en el programa ${requestProgramName}`,
          details: {
            group: groupName,
            program: requestProgramName,
            day: request.day,
            requested_time: `${formatHour(request.start_hour)} - ${formatHour(request.end_hour)}`,
            conflicting_time: `${formatHour(schedule.start_hour)} - ${formatHour(schedule.end_hour)}`,
            conflicting_subject: `${subjectClave} - ${subjectName}`,
            conflicting_teacher: teacherName,
          },
        });
      }
    }

    console.log(`[RESULTADO] Conflictos de grupo encontrados en el programa: ${conflicts.length}`);
  } catch (error) {
    console.error('[ERROR] Error al validar conflictos de grupo:', error);
    throw error;
  }

  return conflicts;
}

/**
 * Valida la disponibilidad del maestro
 * Verifica si el maestro está marcado como NO disponible en el horario solicitado
 */
async function validateTeacherAvailability(
  request: ValidationRequest
): Promise<Conflict[]> {
  console.log(`[VALIDACIÓN] Verificando disponibilidad del maestro: ${request.teacher_id}`);
  
  const conflicts: Conflict[] = [];

  try {
    // Query para obtener periodos de NO disponibilidad
    const endpoint = `availability?select=id,start_hour,end_hour&teacher_id=eq.${request.teacher_id}&day=eq.${request.day}`;
    const unavailabilities = await querySupabase(endpoint);

    // Obtener información del maestro
    const teacherData = await querySupabase(`teachers?select=name&id=eq.${request.teacher_id}`);
    const teacherName = teacherData?.[0]?.name || 'Maestro desconocido';

    // Verificar si el horario cae en un periodo de no disponibilidad
    for (const unavail of unavailabilities) {
      if (hasTimeOverlap(request.start_hour, request.end_hour, unavail.start_hour, unavail.end_hour)) {
        conflicts.push({
          type: 'teacher_unavailable',
          severity: 'warning',
          message: `El maestro "${teacherName}" ha marcado NO estar disponible de ${formatHour(unavail.start_hour)} a ${formatHour(unavail.end_hour)} el ${request.day}`,
          details: {
            teacher: teacherName,
            day: request.day,
            requested_time: `${formatHour(request.start_hour)} - ${formatHour(request.end_hour)}`,
            unavailable_time: `${formatHour(unavail.start_hour)} - ${formatHour(unavail.end_hour)}`,
          },
        });
      }
    }

    console.log(`[RESULTADO] Conflictos de disponibilidad encontrados: ${conflicts.length}`);
  } catch (error) {
    console.error('[ERROR] Error al validar disponibilidad:', error);
    throw error;
  }

  return conflicts;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  console.log(`[INICIO] Nueva solicitud de validación - ${new Date().toISOString()}`);

  try {
    // ========================================================================
    // 1. PARSEAR Y VALIDAR ENTRADA
    // ========================================================================
    const requestData: ValidationRequest = await req.json();
    console.log('[REQUEST]', JSON.stringify(requestData, null, 2));

    // Validar parámetros requeridos
    if (!requestData.teacher_id || !requestData.subject_id || !requestData.group_id || 
        !requestData.day || requestData.start_hour === undefined || requestData.end_hour === undefined) {
      return createErrorResponse(
        'Faltan parámetros requeridos: teacher_id, subject_id, group_id, day, start_hour, end_hour',
        400
      );
    }

    // Validar lógica de horas
    if (requestData.start_hour >= requestData.end_hour) {
      return createErrorResponse('La hora de inicio debe ser menor que la hora de fin', 400);
    }

    if (requestData.start_hour < 0 || requestData.end_hour > 24) {
      return createErrorResponse('Las horas deben estar entre 0 y 24', 400);
    }

    // ========================================================================
    // 2. EJECUTAR VALIDACIONES EN PARALELO
    // ========================================================================
    const [teacherConflicts, groupConflicts, availabilityConflicts] = await Promise.all([
      validateTeacherConflicts(requestData),
      validateGroupConflicts(requestData),
      validateTeacherAvailability(requestData),
    ]);

    // ========================================================================
    // 3. CONSTRUIR RESPUESTA
    // ========================================================================
    const allConflicts = [...teacherConflicts, ...groupConflicts, ...availabilityConflicts];
    const criticalCount = allConflicts.filter(c => c.severity === 'critical').length;
    const warningCount = allConflicts.filter(c => c.severity === 'warning').length;
    const totalConflicts = allConflicts.length;

    const response: ValidationResponse = {
      valid: totalConflicts === 0,
      message: totalConflicts === 0
        ? '✅ No se encontraron conflictos. El horario puede ser asignado.'
        : `⚠️ Se encontraron ${totalConflicts} conflicto(s): ${criticalCount} crítico(s), ${warningCount} advertencia(s)`,
      conflicts: {
        teacher_conflicts: teacherConflicts,
        group_conflicts: groupConflicts,
        availability_conflicts: availabilityConflicts,
      },
      summary: {
        total_conflicts: totalConflicts,
        critical_count: criticalCount,
        warning_count: warningCount,
      },
    };

    console.log('[RESPUESTA]', JSON.stringify(response.summary, null, 2));
    console.log(`[FIN] Validación completada exitosamente`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ERROR FATAL]', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Error desconocido al validar el horario'
    );
  }
});
