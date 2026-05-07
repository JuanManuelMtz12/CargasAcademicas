import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Crear usuario usando API de autenticación de Supabase
    const createUserResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({
          email: 'admin@upn.mx',
          password: 'admin123',
          email_confirm: true,
          user_metadata: {
            role: 'admin'
          }
        })
      }
    );

    const userData = await createUserResponse.json();
    
    if (!createUserResponse.ok) {
      throw new Error(userData.error?.message || 'Error al crear usuario en Auth');
    }

    const userId = userData.id;

    // Crear registro en tabla users
    const insertUserResponse = await fetch(
      `${supabaseUrl}/rest/v1/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id: userId,
          username: 'admin',
          first_name: 'Admin',
          last_name: 'UPN',
          role: 'admin'
        })
      }
    );

    if (!insertUserResponse.ok) {
      const errorData = await insertUserResponse.json();
      console.error('Error insertando en tabla users:', errorData);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Usuario administrador creado exitosamente',
        email: 'admin@upn.mx',
        userId: userId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Error al crear usuario'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
