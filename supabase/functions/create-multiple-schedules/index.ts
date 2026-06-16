// Edge Function para crear múltiples sesiones de horarios de forma atómica
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
      sessions, // Array of { day, start_hour, end_hour }
      force_save, // Boolean to force save with conflicts
    } = requestData

    console.log('[CREAR MULTI-SESIÓN] Datos recibidos:', {
      teacher_id,
      subject_id,
      group_id,
      school_cycle_id,
      sessions_count: sessions?.length || 0,
      force_save,
    })

    // Validar datos básicos
    if (!teacher_id || !subject_id || !group_id || !school_cycle_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Faltan campos requeridos: teacher_id, subject_id, group_id, school_cycle_id',
          created_count: 0,
          failed_count: 0,
          created_ids: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No se recibieron sesiones para crear',
          created_count: 0,
          failed_count: 0,
          created_ids: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Preparar datos para inserción
    const scheduleRecords = sessions.map((session: any) => ({
      teacher_id,
      subject_id,
      group_id,
      school_cycle_id,
      day: session.day,
      start_hour: session.start_hour,
      end_hour: session.end_hour,
      has_conflict: !force_save, // Si no está forzando, marcar como posible conflicto
    }))

    console.log('[CREAR MULTI-SESIÓN] Registros preparados:', scheduleRecords.length)

    // IMPORTANTE: Inserción atómica usando transacción
    // Si alguna falla, todas fallan (rollback automático)
    const { data: createdSchedules, error: insertError } = await supabase
      .from('schedule')
      .insert(scheduleRecords)
      .select('id')

    if (insertError) {
      console.error('[CREAR MULTI-SESIÓN] Error al insertar:', insertError)
      
      // Detectar tipo de error específico
      let errorMessage = 'Error al crear las sesiones'
      
      if (insertError.code === '23505') {
        errorMessage = 'Algunas sesiones ya existen en la base de datos (duplicados)'
      } else if (insertError.code === '23503') {
        errorMessage = 'Referencias inválidas (maestro, materia, grupo o ciclo no existen)'
      } else if (insertError.message.includes('violates check constraint')) {
        errorMessage = 'Horarios inválidos (verifique que hora inicio < hora fin)'
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: errorMessage,
          created_count: 0,
          failed_count: sessions.length,
          created_ids: [],
          errors: [{
            session: 'Todas las sesiones',
            error: insertError.message,
          }],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const createdIds = createdSchedules?.map((s: any) => s.id) || []

    console.log('[CREAR MULTI-SESIÓN] Sesiones creadas exitosamente:', createdIds.length)

    // Resultado exitoso
    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ ${createdIds.length} sesión(es) creada(s) exitosamente`,
        created_count: createdIds.length,
        failed_count: 0,
        created_ids: createdIds,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('[CREAR MULTI-SESIÓN] Error general:', error)
    
    const errorResponse = {
      success: false,
      message: 'Error interno al crear las sesiones',
      created_count: 0,
      failed_count: 0,
      created_ids: [],
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
