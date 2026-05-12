import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import JSZip from 'jszip';

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

// Función para formatear hora (8 -> "08:00")
const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`;
};

interface ScheduleRow {
  clave: string;
  asignatura: string;
  horario: string;
  semestre: string;
}

// Función para cargar imagen y convertirla a base64
const loadImageAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateOficioFromTemplate = async (teacherId: string, programId?: string): Promise<void> => {
  try {
    // Obtener datos del maestro
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select(`
        name,
        categories (category)
      `)
      .eq('id', teacherId)
      .single();

    if (teacherError) throw teacherError;
    if (!teacherData) throw new Error('Maestro no encontrado');

    const teacher = teacherData as any;
    const teacherName = teacher.name.toUpperCase();
    const teacherCategory = teacher.categories.category.toUpperCase();
    
    // Determinar tipo de personal
    const personalType = teacherCategory === 'INVITADO' 
      ? 'PERSONAL DOCENTE INVITADO' 
      : 'PERSONAL DOCENTE DE BASE';

    // Obtener horarios del maestro
    const { data: schedulesDataRaw, error: schedulesError } = await supabase
      .from('schedule')
      .select(`
        day,
        start_hour,
        end_hour,
        subjects (clave, name, program_id, programs (name)),
        groups (name),
        school_cycles (start_date, end_date)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });
    
    if (schedulesError) throw schedulesError;
    
    // Filtrar por programa si se proporciona
    let schedulesData = schedulesDataRaw;
    if (programId && schedulesDataRaw) {
      schedulesData = schedulesDataRaw.filter((schedule: any) => 
        schedule.subjects?.program_id === programId
      );
    }

    if (!schedulesData || schedulesData.length === 0) {
      throw new Error('El maestro no tiene horarios asignados');
    }

    // Obtener nombre de la licenciatura del primer horario
    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;
    
    // Obtener periodo
    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = '';
    if (schoolCycle && schoolCycle.start_date && schoolCycle.end_date) {
      const startDate = new Date(schoolCycle.start_date);
      const endDate = new Date(schoolCycle.end_date);
      
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const startDay = startDate.getUTCDate();
      const startMonth = months[startDate.getUTCMonth()];
      
      const endDay = endDate.getUTCDate();
      const endMonth = months[endDate.getUTCMonth()];
      const endYear = endDate.getUTCFullYear();
      
      periodoText = `del ${startDay} de ${startMonth} al ${endDay} de ${endMonth} del ${endYear}`;
    } else {
      periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    }

    // Agrupar horarios por materia
    const groupedMap = new Map<string, any>();
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
      const group = groupedMap.get(key)!;
      group.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });

    // Convertir a array de filas para la tabla
    const tableRows: ScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      clave: item.clave,
      asignatura: item.asignatura,
      horario: item.schedules.join('\n'),
      semestre: item.semestre
    }));

    // Crear el PDF en tamaño CARTA (letter)
    const doc = new jsPDF({
      format: 'letter'
    });
    
    // Cargar imagen de fondo (reducida al 90% y centrada)
    try {
      const bgImage = await loadImageAsBase64('/images/upnimg.jpg');
      // Reducir al 97% y centrar
      const scale = 0.97;
      const originalWidth = 215.9;
      const originalHeight = 271.4;
      const newWidth = originalWidth * scale;  // 194.31mm
      const newHeight = originalHeight * scale; // 244.26mm
      const offsetX = (originalWidth - newWidth) / 2; // 10.795mm para centrar
      const offsetY = 8; // Mantener desplazamiento hacia abajo
      
      doc.addImage(bgImage, 'JPEG', offsetX, offsetY, newWidth, newHeight);
    } catch (error) {
      console.warn('No se pudo cargar la imagen de fondo:', error);
    }

    // Encabezado - ASUNTO (alineado a la derecha, muy cerca de los logos)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 195, 35, { align: 'right' });
    
    // Fecha (alineada a la derecha)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Teziutlán, Pue., ${formatDateToSpanish(new Date())}`, 195, 41, { align: 'right' });
    
    // Nombre del maestro (muy cerca de la fecha)
    let yPos = 49;
    doc.setFont('helvetica', 'bold');
    doc.text(teacherName, 25, yPos);
    
    // Tipo de personal
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(personalType, 25, yPos);
    
    // Institución
    yPos += 5;
    doc.text('DE LA UPN-212 TEZIUTLÁN', 25, yPos);
    
    // PRESENTE
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('P R E S E N T E', 25, yPos);
    
    // Párrafo principal (justificado, más compacto)
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const mainText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${licenciaturaName}, que corresponde al periodo ${periodoText}.`;
    const splitText = doc.splitTextToSize(mainText, 165);
    doc.text(splitText, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitText.length * 5;
    
    // Tabla de horarios (más compacta, menos espacio arriba)
    yPos += 3;
    const tableData = tableRows.map(row => [row.clave, row.asignatura, row.horario, row.semestre]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],  // Gris más oscuro para mejor contraste
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineColor: [0, 0, 0],
        lineWidth: 0.5
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],  // Bordes negros
        lineWidth: 0.3,  // Bordes más visibles
        valign: 'middle'  // Centrado vertical
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 55, halign: 'center' },
        2: { cellWidth: 70 },
        3: { cellWidth: 18, halign: 'center' }
      },
      margin: { left: 25, right: 25 }
    });
    
    // Obtener posición después de la tabla
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 30;
    yPos = finalY + 10;
    
    // Párrafo de cierre (justificado)
    doc.setFontSize(10);
    const closingText = 'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';
    const splitClosing = doc.splitTextToSize(closingText, 165);
    doc.text(splitClosing, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitClosing.length * 6 + 15;
    
    // Firma
    doc.setFont('helvetica', 'bold');
    doc.text('ATENTAMENTE', 105, yPos, { align: 'center' });
    yPos += 6;
    doc.text('"EDUCAR PARA TRANSFORMAR"', 105, yPos, { align: 'center' });
    yPos += 15;
    
    doc.setFontSize(10);
    doc.text('DR. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, yPos, { align: 'center' });
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN', 105, yPos, { align: 'center' });
    yPos += 4;
    doc.text('DE LA UNIVERSIDAD PEDAGÓGICA NACIONAL', 105, yPos, { align: 'center' });
   // yPos += 4;
  //  doc.text('UNIDAD 212 TEZIUTLÁN', 105, yPos, { align: 'center' });
    
    // Guardar el PDF
    const fileName = `Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
  } catch (error: any) {
    console.error('Error generating oficio:', error);
    throw error;
  }
};

// Función auxiliar para generar un PDF y retornarlo como blob
const generateOficioBlob = async (teacherId: string, programId?: string): Promise<{ blob: Blob; fileName: string; teacherName: string } | null> => {
  try {
    // Obtener datos del maestro
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select(`
        name,
        categories (category)
      `)
      .eq('id', teacherId)
      .single();

    if (teacherError) throw teacherError;
    if (!teacherData) throw new Error('Maestro no encontrado');

    const teacher = teacherData as any;
    const teacherName = teacher.name.toUpperCase();
    const teacherCategory = teacher.categories.category.toUpperCase();
    
    // Determinar tipo de personal
    const personalType = teacherCategory === 'INVITADO' 
      ? 'PERSONAL DOCENTE INVITADO' 
      : 'PERSONAL DOCENTE DE BASE';

    // Obtener horarios del maestro
    const { data: schedulesDataRaw, error: schedulesError } = await supabase
      .from('schedule')
      .select(`
        day,
        start_hour,
        end_hour,
        subjects (clave, name, program_id, programs (name)),
        groups (name),
        school_cycles (start_date, end_date)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });
    
    if (schedulesError) throw schedulesError;
    
    // Filtrar por programa si se proporciona
    let schedulesData = schedulesDataRaw;
    if (programId && schedulesDataRaw) {
      schedulesData = schedulesDataRaw.filter((schedule: any) => 
        schedule.subjects?.program_id === programId
      );
    }

    if (!schedulesData || schedulesData.length === 0) {
      console.warn(`Maestro ${teacher.name} no tiene horarios asignados`);
      return null;
    }

    // Obtener nombre de la licenciatura del primer horario
    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;
    
    // Obtener periodo
    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = '';
    if (schoolCycle && schoolCycle.start_date && schoolCycle.end_date) {
      const startDate = new Date(schoolCycle.start_date);
      const endDate = new Date(schoolCycle.end_date);
      
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const startDay = startDate.getUTCDate();
      const startMonth = months[startDate.getUTCMonth()];
      
      const endDay = endDate.getUTCDate();
      const endMonth = months[endDate.getUTCMonth()];
      const endYear = endDate.getUTCFullYear();
      
      periodoText = `del ${startDay} de ${startMonth} al ${endDay} de ${endMonth} del ${endYear}`;
    } else {
      periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    }

    // Agrupar horarios por materia
    const groupedMap = new Map<string, any>();
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
      const group = groupedMap.get(key)!;
      group.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });

    // Convertir a array de filas para la tabla
    const tableRows: ScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      clave: item.clave,
      asignatura: item.asignatura,
      horario: item.schedules.join('\n'),
      semestre: item.semestre
    }));

    // Crear el PDF en tamaño CARTA (letter)
    const doc = new jsPDF({
      format: 'letter'
    });
    
    // Cargar imagen de fondo (reducida al 97% y centrada)
    try {
      const bgImage = await loadImageAsBase64('/images/upnimg.jpg');
      // Reducir al 97% y centrar
      const scale = 0.97;
      const originalWidth = 215.9;
      const originalHeight = 271.4;
      const newWidth = originalWidth * scale;  // 209.42mm
      const newHeight = originalHeight * scale; // 263.26mm
      const offsetX = (originalWidth - newWidth) / 2; // para centrar
      const offsetY = 8; // Mantener desplazamiento hacia abajo
      
      doc.addImage(bgImage, 'JPEG', offsetX, offsetY, newWidth, newHeight);
    } catch (error) {
      console.warn('No se pudo cargar la imagen de fondo:', error);
    }

    // Encabezado - ASUNTO
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 195, 35, { align: 'right' });
    
    // Fecha
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Teziutlán, Pue., ${formatDateToSpanish(new Date())}`, 195, 41, { align: 'right' });
    
    // Nombre del maestro
    let yPos = 49;
    doc.setFont('helvetica', 'bold');
    doc.text(teacherName, 25, yPos);
    
    // Tipo de personal
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(personalType, 25, yPos);
    
    // Institución
    yPos += 5;
    doc.text('DE LA UPN-212 TEZIUTLÁN', 25, yPos);
    
    // PRESENTE
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('P R E S E N T E', 25, yPos);
    
    // Párrafo principal
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const mainText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${licenciaturaName}, que corresponde al periodo ${periodoText}.`;
    const splitText = doc.splitTextToSize(mainText, 165);
    doc.text(splitText, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitText.length * 5;
    
    // Tabla de horarios
    yPos += 3;
    const tableData = tableRows.map(row => [row.clave, row.asignatura, row.horario, row.semestre]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        lineColor: [0, 0, 0],
        lineWidth: 0.5
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
        valign: 'middle'  // Centrado vertical
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 55, halign: 'center' },
        2: { cellWidth: 70 },
        3: { cellWidth: 18, halign: 'center' }
      },
      margin: { left: 25, right: 25 }
    });
    
    // Obtener posición después de la tabla
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 30;
    yPos = finalY + 10;
    
    // Párrafo de cierre
    doc.setFontSize(10);
    const closingText = 'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';
    const splitClosing = doc.splitTextToSize(closingText, 165);
    doc.text(splitClosing, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitClosing.length * 6 + 15;
    
    // Firma
    doc.setFont('helvetica', 'bold');
    doc.text('ATENTAMENTE', 105, yPos, { align: 'center' });
    yPos += 6;
    doc.text('"EDUCAR PARA TRANSFORMAR"', 105, yPos, { align: 'center' });
    yPos += 15;
    
    doc.setFontSize(10);
    doc.text('DR. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, yPos, { align: 'center' });
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN', 105, yPos, { align: 'center' });
    yPos += 4;
    doc.text('DE LA UNIVERSIDAD PEDAGÓGICA NACIONAL', 105, yPos, { align: 'center' });
  //  yPos += 4;
  // doc.text('UNIDAD 212 TEZIUTLÁN', 105, yPos, { align: 'center' });
    
    // Retornar el PDF como blob
    const blob = doc.output('blob');
    const fileName = `Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    return { blob, fileName, teacherName: teacher.name };
  } catch (error: any) {
    console.error('Error generating oficio blob:', error);
    return null;
  }
};

// Función para descargar todos los oficios de un maestro (todos los programas)
export const downloadAllOficiosForTeacher = async (teacherId: string): Promise<void> => {
  try {
    // Obtener todos los programas en los que el maestro tiene horarios
    const { data: schedules, error } = await supabase
      .from('schedule')
      .select('subjects(program_id, programs(name))')
      .eq('teacher_id', teacherId);

    if (error) throw error;

    if (!schedules || schedules.length === 0) {
      throw new Error('El maestro no tiene horarios asignados');
    }

    // Obtener programas únicos
    const programIds = new Set<string>();
    schedules.forEach((s: any) => {
      if (s.subjects?.program_id) {
        programIds.add(s.subjects.program_id);
      }
    });

    if (programIds.size === 0) {
      throw new Error('No se encontraron programas para este maestro');
    }

    // Si solo hay un programa, descargar directamente sin ZIP
    if (programIds.size === 1) {
      await generateOficioFromTemplate(teacherId, Array.from(programIds)[0]);
      return;
    }

    // Si hay múltiples programas, generar todos y comprimir en ZIP
    const zip = new JSZip();
    const programsArray = Array.from(programIds);
    
    for (const programId of programsArray) {
      const result = await generateOficioBlob(teacherId, programId);
      if (result) {
        zip.file(result.fileName, result.blob);
      }
    }

    // Generar el ZIP y descargarlo
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const teacherData = await supabase
      .from('teachers')
      .select('name')
      .eq('id', teacherId)
      .single();
    
    const teacherName = teacherData.data?.name.replace(/\s+/g, '_') || 'maestro';
    const zipFileName = `Oficios_${teacherName}_${new Date().toISOString().split('T')[0]}.zip`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = zipFileName;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error: any) {
    console.error('Error downloading all oficios for teacher:', error);
    throw error;
  }
};

// Función para descargar todos los oficios de todos los maestros
export const downloadAllOficiosForAllTeachers = async (programId?: string): Promise<void> => {
  try {
    // Obtener todos los maestros que tienen horarios
    const { data: schedules, error } = await supabase
      .from('schedule')
      .select('teacher_id, teachers(id, name), subjects(program_id)');

    if (error) throw error;

    if (!schedules || schedules.length === 0) {
      throw new Error('No hay maestros con horarios asignados');
    }

    // Filtrar por programa si se proporciona
    let filteredSchedules = schedules;
    if (programId) {
      filteredSchedules = schedules.filter((s: any) => s.subjects?.program_id === programId);
    }

    if (filteredSchedules.length === 0) {
      throw new Error('No hay maestros con horarios asignados para este programa');
    }

    // Obtener IDs únicos de maestros
    const teacherIds = new Set<string>();
    filteredSchedules.forEach((s: any) => {
      if (s.teacher_id) {
        teacherIds.add(s.teacher_id);
      }
    });

    if (teacherIds.size === 0) {
      throw new Error('No se encontraron maestros');
    }

    // Generar todos los oficios y comprimir en ZIP
    const zip = new JSZip();
    const teachersArray = Array.from(teacherIds);
    
    let successCount = 0;
    for (const teacherId of teachersArray) {
      const result = await generateOficioBlob(teacherId, programId);
      if (result) {
        zip.file(result.fileName, result.blob);
        successCount++;
      }
    }

    if (successCount === 0) {
      throw new Error('No se pudo generar ningún oficio');
    }

    // Generar el ZIP y descargarlo
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `Oficios_Todos_Maestros_${new Date().toISOString().split('T')[0]}.zip`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = zipFileName;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error: any) {
    console.error('Error downloading all oficios for all teachers:', error);
    throw error;
  }
};
