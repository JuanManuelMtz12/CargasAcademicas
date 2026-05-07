import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Función para formatear fecha a español
const formatDateToSpanish = (date: Date): string => {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} de ${month} de ${year}`;
};

// Función para formatear hora
const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { teacherId } = await req.json();
    
    if (!teacherId) {
      throw new Error('teacherId es requerido');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Obtener datos del maestro
    const teacherResponse = await fetch(
      `${supabaseUrl}/rest/v1/teachers?id=eq.${teacherId}&select=name,categories(category)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );

    const teacherData = await teacherResponse.json();
    if (!teacherData || teacherData.length === 0) {
      throw new Error('Maestro no encontrado');
    }

    const teacher = teacherData[0];
    const teacherName = teacher.name.toUpperCase();
    const teacherCategory = teacher.categories.category.toUpperCase();
    
    const personalType = teacherCategory === 'INVITADO' 
      ? 'PERSONAL DOCENTE INVITADO' 
      : 'PERSONAL DOCENTE DE BASE';

    // Obtener horarios del maestro
    const schedulesResponse = await fetch(
      `${supabaseUrl}/rest/v1/schedule?teacher_id=eq.${teacherId}&select=day,start_hour,end_hour,subjects(clave,name,programs(name)),groups(name),school_cycles(start_date,end_date)&order=day.asc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );

    const schedulesData = await schedulesResponse.json();
    
    if (!schedulesData || schedulesData.length === 0) {
      throw new Error('El maestro no tiene horarios asignados');
    }

    // Obtener nombre de la licenciatura
    const programName = schedulesData[0].subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;
    
    // Obtener periodo
    const schoolCycle = schedulesData[0].school_cycles;
    let periodoText = '';
    if (schoolCycle && schoolCycle.start_date && schoolCycle.end_date) {
      const startDate = new Date(schoolCycle.start_date);
      const endDate = new Date(schoolCycle.end_date);
      
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const startDay = startDate.getDate();
      const startMonth = months[startDate.getMonth()];
      
      const endDay = endDate.getDate();
      const endMonth = months[endDate.getMonth()];
      const endYear = endDate.getFullYear();
      
      periodoText = `del ${startDay} de ${startMonth} al ${endDay} de ${endMonth} del ${endYear}`;
    } else {
      periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    }

    // Agrupar horarios por materia
    const groupedMap = new Map();
    schedulesData.forEach((s: any) => {
      const key = `${s.subjects.clave}_${s.groups.name}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          clave: s.subjects.clave,
          asignatura: s.subjects.name,
          semestre: s.groups.name,
          schedules: []
        });
      }
      const group = groupedMap.get(key);
      group.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });

    // Convertir a array de filas para la tabla
    const tableRows = Array.from(groupedMap.values()).map((item: any) => ({
      clave: item.clave,
      asignatura: item.asignatura,
      horario: item.schedules.join(' '),
      semestre: item.semestre
    }));

    // Preparar datos para la plantilla
    const templateData = {
      fecha: formatDateToSpanish(new Date()),
      teacherName: teacherName,
      personalType: personalType,
      licenciatura: licenciaturaName,
      periodo: periodoText,
      horarios: tableRows
    };

    // Devolver los datos para procesamiento en el cliente
    // El cliente usará docxtemplater para generar el documento y luego lo convertirá a PDF
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: templateData,
        fileName: `Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error generando oficio'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
