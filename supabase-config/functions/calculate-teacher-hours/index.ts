// Edge Function para calcular horas semanales de un maestro
// Verifica si excede el límite de su categoría

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
    const { teacher_id, school_cycle_id, additional_hours } = await req.json();

    if (!teacher_id) {
      return new Response(
        JSON.stringify({ error: 'teacher_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // 1. Obtener información del maestro y su categoría
    const teacherUrl = `${supabaseUrl}/rest/v1/teachers?id=eq.${teacher_id}&select=id,name,category_id,categories(id,category,subcategory,max_hours_week)`;
    const teachers = await querySupabase(teacherUrl);

    if (!teachers || teachers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Maestro no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teacher = teachers[0];
    const maxHours = teacher.categories.max_hours_week;

    // 2. Calcular horas actuales del maestro en el ciclo escolar
    let schedulesUrl = `${supabaseUrl}/rest/v1/schedule?teacher_id=eq.${teacher_id}&select=start_hour,end_hour`;
    
    if (school_cycle_id) {
      schedulesUrl += `&school_cycle_id=eq.${school_cycle_id}`;
    }

    const schedules = await querySupabase(schedulesUrl);

    // Calcular total de horas semanales
    let totalHours = 0;
    for (const schedule of schedules) {
      totalHours += (schedule.end_hour - schedule.start_hour);
    }

    // Agregar las horas adicionales si se proporcionan
    const additionalHoursValue = additional_hours || 0;
    const projectedHours = totalHours + additionalHoursValue;

    // Determinar si excede el límite
    const exceeds = projectedHours > maxHours;
    const remaining = maxHours - projectedHours;

    return new Response(
      JSON.stringify({
        teacher_id: teacher.id,
        teacher_name: teacher.name,
        category: teacher.categories.category,
        subcategory: teacher.categories.subcategory || null,
        current_hours: totalHours,
        additional_hours: additionalHoursValue,
        total_hours: projectedHours,
        max_hours: maxHours,
        remaining_hours: remaining,
        exceeds_limit: exceeds,
        warning: exceeds ? `El maestro excedería el límite de ${maxHours} horas semanales` : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});