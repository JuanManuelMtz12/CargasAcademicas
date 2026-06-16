// Edge Function optimizado para gestión de permisos
// Versión 2.0 - Senior Programmer Solution
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Configuración de timeout (30 segundos)
const TIMEOUT_MS = 30000;

serve(async (req) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const startTime = Date.now();
  let requestId = crypto.randomUUID();

  try {
    console.log(`[${requestId}] ${req.method} ${req.url} - Iniciado`);

    // Timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 30s')), TIMEOUT_MS);
    });

    const processRequest = async () => {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables');
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const requestData = await req.json();
      const { userId, modulePermissions, programAccess } = requestData;

      // Validaciones robustas
      if (!userId) {
        throw new Error('userId es requerido');
      }

      if (!modulePermissions || !Array.isArray(modulePermissions)) {
        throw new Error('modulePermissions debe ser un array válido');
      }

      console.log(`[${requestId}] Actualizando permisos para usuario: ${userId}`);
      console.log(`[${requestId}] Módulos a procesar: ${modulePermissions.length}`);

      // Iniciar transacción lógica
      let successCount = 0;
      const errors = [];

      // 1. Actualizar permisos de módulos
      try {
        console.log(`[${requestId}] Eliminando permisos existentes...`);
        const { error: deleteError } = await supabaseAdmin
          .from('user_module_permissions')
          .delete()
          .eq('user_id', userId);

        if (deleteError && deleteError.code !== 'PGRST116') {
          console.error(`[${requestId}] Error eliminando permisos:`, deleteError);
          throw new Error(`Error eliminando permisos: ${deleteError.message}`);
        }

        // Insertar nuevos permisos en lotes
        if (modulePermissions.length > 0) {
          console.log(`[${requestId}] Insertando ${modulePermissions.length} nuevos permisos...`);
          
          // Validar cada permiso antes de insertar
          const validPermissions = modulePermissions
            .filter(perm => perm && perm.module_name)
            .map(perm => ({
              user_id: userId,
              module_name: perm.module_name,
              can_view: Boolean(perm.can_view),
              can_create: Boolean(perm.can_create),
              can_edit: Boolean(perm.can_edit),
              can_delete: Boolean(perm.can_delete),
            }));

          if (validPermissions.length > 0) {
            const { error: insertError } = await supabaseAdmin
              .from('user_module_permissions')
              .insert(validPermissions);

            if (insertError) {
              console.error(`[${requestId}] Error insertando permisos:`, insertError);
              throw new Error(`Error insertando permisos: ${insertError.message}`);
            }

            console.log(`[${requestId}] ✅ ${validPermissions.length} permisos insertados correctamente`);
            successCount++;
          }
        }
      } catch (error) {
        console.error(`[${requestId}] Error en permisos de módulos:`, error);
        errors.push(`Permisos de módulos: ${error.message}`);
      }

      // 2. Actualizar acceso a programas
      try {
        if (programAccess && Array.isArray(programAccess)) {
          console.log(`[${requestId}] Eliminando accesos existentes...`);
          const { error: deleteError } = await supabaseAdmin
            .from('user_program_access')
            .delete()
            .eq('user_id', userId);

          if (deleteError && deleteError.code !== 'PGRST116') {
            console.error(`[${requestId}] Error eliminando accesos:`, deleteError);
            throw new Error(`Error eliminando accesos: ${deleteError.message}`);
          }

          if (programAccess.length > 0) {
            console.log(`[${requestId}] Insertando ${programAccess.length} accesos a programas...`);
            
            const programAccessToInsert = programAccess
              .filter(programId => programId && typeof programId === 'string')
              .map(program_id => ({
                user_id: userId,
                program_id: program_id,
              }));

            if (programAccessToInsert.length > 0) {
              const { error: insertError } = await supabaseAdmin
                .from('user_program_access')
                .insert(programAccessToInsert);

              if (insertError) {
                console.error(`[${requestId}] Error insertando accesos:`, insertError);
                throw new Error(`Error insertando accesos: ${insertError.message}`);
              }

              console.log(`[${requestId}] ✅ ${programAccessToInsert.length} accesos insertados correctamente`);
              successCount++;
            }
          }
        }
      } catch (error) {
        console.error(`[${requestId}] Error en acceso a programas:`, error);
        errors.push(`Acceso a programas: ${error.message}`);
      }

      // Resultado final
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ✅ Completado en ${duration}ms`);

      if (successCount === 0 && errors.length > 0) {
        throw new Error(`Fallos en la actualización: ${errors.join('; ')}`);
      }

      return {
        success: true,
        message: 'Permisos actualizados exitosamente',
        details: {
          userId,
          modulesProcessed: modulePermissions.length,
          programsProcessed: programAccess?.length || 0,
          duration: `${duration}ms`,
          errors: errors.length > 0 ? errors : undefined
        }
      };
    };

    // Ejecutar con timeout
    const result = await Promise.race([processRequest(), timeoutPromise]);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        } 
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Error en ${duration}ms:`, error);

    const errorResponse = {
      success: false,
      error: {
        code: 'PERMISSION_UPDATE_ERROR',
        message: error.message || 'Error desconocido al actualizar permisos',
        requestId,
        timestamp: new Date().toISOString()
      }
    };

    // Determinar código de estado HTTP
    let statusCode = 500;
    if (error.message.includes('timeout')) {
      statusCode = 408; // Request Timeout
    } else if (error.message.includes('Missing') || error.message.includes('requerido')) {
      statusCode = 400; // Bad Request
    } else if (error.message.includes('no existe')) {
      statusCode = 404; // Not Found
    }

    return new Response(
      JSON.stringify(errorResponse),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        status: statusCode
      }
    );
  }
});