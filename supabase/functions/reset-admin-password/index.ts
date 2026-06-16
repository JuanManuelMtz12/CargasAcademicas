Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error('Missing Supabase credentials');
    }

    // Actualizar contraseña del usuario admin
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/8694c64a-2890-4ae7-974a-4ec0cda030b4`, {
      method: 'PUT',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: 'admin123'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update password: ${error}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Contraseña actualizada exitosamente',
        user: {
          id: data.id,
          email: data.email
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
