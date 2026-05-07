import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, PUT, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Crear cliente de Supabase con service_role_key para operaciones administrativas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { action, ...params } = await req.json();

    switch (action) {
      case 'list':
        // Listar todos los usuarios
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) throw listError;
        
        // Obtener permisos de módulos para todos los usuarios
        const { data: modulePermissions, error: modulePermError } = await supabaseAdmin
          .from('user_module_permissions')
          .select('*')
          .order('user_id');
        
        if (modulePermError) console.error('Error loading module permissions:', modulePermError);
        
        // Obtener acceso a programas para todos los usuarios
        const { data: programAccess, error: programAccessError } = await supabaseAdmin
          .from('user_program_access')
          .select(`
            user_id, 
            program_id, 
            programs(id, name, type)
          `)
          .order('user_id');
        
        if (programAccessError) console.error('Error loading program access:', programAccessError);
        
        // Combinar datos
        const usersWithPermissions = listData.users.map(user => {
          const userModulePerms = (modulePermissions || []).filter(p => p.user_id === user.id);
          const userPrograms = (programAccess || []).filter(p => p.user_id === user.id);
          
          return {
            ...user,
            module_permissions: userModulePerms,
            allowed_programs: userPrograms.map(p => p.programs)
          };
        });
        
        return new Response(
          JSON.stringify({ success: true, users: usersWithPermissions }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'create':
        // Crear nuevo usuario
        const { email, password, role, module_permissions, program_ids } = params;
        
        if (!email || !password || !role) {
          throw new Error('Email, password y role son requeridos');
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error('El formato del email no es válido');
        }

        // Verificar que el email no esté ya registrado
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        if (existingUsers.users.some(user => user.email === email.trim())) {
          throw new Error('Ya existe un usuario con este email');
        }

        // Validar fortaleza de contraseña
        if (password.length < 8) {
          throw new Error('La contraseña debe tener al menos 8 caracteres');
        }
        
        if (!/[A-Z]/.test(password)) {
          throw new Error('La contraseña debe contener al menos una letra mayúscula');
        }
        
        if (!/[a-z]/.test(password)) {
          throw new Error('La contraseña debe contener al menos una letra minúscula');
        }
        
        if (!/[0-9]/.test(password)) {
          throw new Error('La contraseña debe contener al menos un número');
        }
        
        if (!/[!@#$%^&*()_+\-=\[\]{};'"\\|,.<>\/?]/.test(password)) {
          throw new Error('La contraseña debe contener al menos un carácter especial');
        }

        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim(),
          password: password,
          email_confirm: true,
          user_metadata: { role },
        });

        if (createError) throw createError;
        
        const userId = createData.user.id;
        
        // Crear registro en la tabla users
        const { error: userTableError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            username: email.split('@')[0],
            first_name: email.split('@')[0],
            last_name: '',
            role: role,
          });
        
        if (userTableError) {
          console.error('Error inserting into users table:', userTableError);
          // No lanzar error, continuar con el proceso
        }
        
        // Si es coordinador, insertar permisos de módulos y programas
        if (role === 'coordinador') {
          // Insertar permisos de módulos
          if (module_permissions && Array.isArray(module_permissions) && module_permissions.length > 0) {
            const modulePermsToInsert = module_permissions.map(perm => ({
              user_id: userId,
              module_name: perm.module_name,
              can_view: perm.can_view || false,
              can_create: perm.can_create || false,
              can_edit: perm.can_edit || false,
              can_delete: perm.can_delete || false,
            }));
            
            const { error: modulePermError } = await supabaseAdmin
              .from('user_module_permissions')
              .insert(modulePermsToInsert);
            
            if (modulePermError) {
              console.error('Error inserting module permissions:', modulePermError);
              throw new Error('Error al insertar permisos de módulos: ' + modulePermError.message);
            }
          }
          
          // Insertar acceso a programas
          if (program_ids && Array.isArray(program_ids) && program_ids.length > 0) {
            const programAccessToInsert = program_ids.map(program_id => ({
              user_id: userId,
              program_id: program_id,
            }));
            
            const { error: programAccessError } = await supabaseAdmin
              .from('user_program_access')
              .insert(programAccessToInsert);
            
            if (programAccessError) {
              console.error('Error inserting program access:', programAccessError);
              throw new Error('Error al insertar acceso a programas: ' + programAccessError.message);
            }
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, user: createData.user }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'update':
        // Actualizar rol de usuario y permisos
        const { userId, newRole, module_permissions: updateModulePerms, program_ids: updateProgramIds } = params;
        
        if (!userId) {
          throw new Error('userId es requerido');
        }

        // Verificar que el usuario existe
        const { data: targetUser, error: fetchUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (fetchUserError || !targetUser.user) {
          throw new Error('El usuario especificado no existe');
        }

        // Actualizar rol si se proporciona
        if (newRole) {
          const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: { role: newRole } }
          );

          if (updateError) throw updateError;
        }
        
        // Actualizar permisos de módulos si se proporcionan
        if (updateModulePerms !== undefined) {
          // Eliminar permisos existentes
          const { error: deleteModuleError } = await supabaseAdmin
            .from('user_module_permissions')
            .delete()
            .eq('user_id', userId);
          
          if (deleteModuleError) {
            console.error('Error deleting old module permissions:', deleteModuleError);
          }
          
          // Insertar nuevos permisos
          if (Array.isArray(updateModulePerms) && updateModulePerms.length > 0) {
            const modulePermsToInsert = updateModulePerms.map(perm => ({
              user_id: userId,
              module_name: perm.module_name,
              can_view: perm.can_view || false,
              can_create: perm.can_create || false,
              can_edit: perm.can_edit || false,
              can_delete: perm.can_delete || false,
            }));
            
            const { error: insertModuleError } = await supabaseAdmin
              .from('user_module_permissions')
              .insert(modulePermsToInsert);
            
            if (insertModuleError) {
              console.error('Error inserting new module permissions:', insertModuleError);
              throw new Error('Error al actualizar permisos de módulos: ' + insertModuleError.message);
            }
          }
        }
        
        // Actualizar acceso a programas si se proporciona
        if (updateProgramIds !== undefined) {
          // Eliminar accesos existentes
          const { error: deleteProgramError } = await supabaseAdmin
            .from('user_program_access')
            .delete()
            .eq('user_id', userId);
          
          if (deleteProgramError) {
            console.error('Error deleting old program access:', deleteProgramError);
          }
          
          // Insertar nuevos accesos
          if (Array.isArray(updateProgramIds) && updateProgramIds.length > 0) {
            const programAccessToInsert = updateProgramIds.map(program_id => ({
              user_id: userId,
              program_id: program_id,
            }));
            
            const { error: insertProgramError } = await supabaseAdmin
              .from('user_program_access')
              .insert(programAccessToInsert);
            
            if (insertProgramError) {
              console.error('Error inserting new program access:', insertProgramError);
              throw new Error('Error al actualizar acceso a programas: ' + insertProgramError.message);
            }
          }
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'delete':
        // Eliminar usuario
        const { userId: deleteUserId } = params;
        
        if (!deleteUserId) {
          throw new Error('userId es requerido');
        }

        // Verificar que el usuario existe
        const { data: targetUser, error: fetchUserError } = await supabaseAdmin.auth.admin.getUserById(deleteUserId);
        if (fetchUserError || !targetUser.user) {
          throw new Error('El usuario especificado no existe');
        }

        // Verificar que no se esté intentando eliminar el usuario actual
        // Nota: esto requeriría obtener el usuario autenticado desde el JWT
        // Por ahora, simplemente eliminamos el usuario

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(deleteUserId);

        if (deleteError) throw deleteError;
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Error en la operación'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
