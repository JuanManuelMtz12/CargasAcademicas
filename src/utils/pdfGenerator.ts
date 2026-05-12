import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

// Función para convertir fecha a formato español
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

interface ScheduleData {
  subject_key: string;
  subject_name: string;
  semester: string;
  day_of_week: string;
  start_hour: number;
  end_hour: number;
}

interface GroupedSchedule {
  subject_key: string;
  subject_name: string;
  semester: string;
  schedules: string; // "Martes De 10:00 a 12:00 Jueves De 08:00 a 10:00"
}

// Función para agrupar horarios por materia y semestre
const groupSchedules = (schedules: ScheduleData[]): GroupedSchedule[] => {
  const grouped = new Map<string, GroupedSchedule>();
  
  schedules.forEach((schedule) => {
    const key = `${schedule.subject_key}_${schedule.semester}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        subject_key: schedule.subject_key,
        subject_name: schedule.subject_name,
        semester: schedule.semester,
        schedules: ''
      });
    }
    
    const group = grouped.get(key)!;
    const timeRange = `${schedule.day_of_week} De ${formatHour(schedule.start_hour)} a ${formatHour(schedule.end_hour)}`;
    
    if (group.schedules) {
      group.schedules += ' ' + timeRange;
    } else {
      group.schedules = timeRange;
    }
  });
  
  return Array.from(grouped.values());
};

export const generateOficioPDF = async (teacherId: string): Promise<void> => {
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
    
    // Determinar tipo de personal según la categoría
    const personalType = teacherCategory === 'INVITADO' 
      ? 'PERSONAL DOCENTE INVITADO' 
      : 'PERSONAL DOCENTE DE BASE';

    // Obtener horarios del maestro con información de programa y periodo
    const { data: schedulesData, error: schedulesError } = await supabase
      .from('schedule')
      .select(`
        day,
        start_hour,
        end_hour,
        subjects (clave, name, programs (name)),
        groups (name),
        school_cycles (start_date, end_date)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });

    if (schedulesError) throw schedulesError;
    
    if (!schedulesData || schedulesData.length === 0) {
      throw new Error('El maestro no tiene horarios asignados');
    }

    // Obtener nombre de la licenciatura (del primer registro)
    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;
    
    // Obtener periodo (del primer registro)
    const schoolCycle = (schedulesData[0] as any).school_cycles;
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
      const startYear = startDate.getFullYear();
      
      const endDay = endDate.getDate();
      const endMonth = months[endDate.getMonth()];
      const endYear = endDate.getFullYear();
      
      periodoText = `del ${startDay} de ${startMonth} al ${endDay} de ${endMonth} del ${endYear}`;
    } else {
      periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    }

    // Transformar datos
    const schedules: ScheduleData[] = schedulesData.map((s: any) => ({
      subject_key: s.subjects.clave,
      subject_name: s.subjects.name,
      semester: s.groups.name,
      day_of_week: s.day,
      start_hour: s.start_hour,
      end_hour: s.end_hour
    }));

    // Agrupar horarios por materia
    const groupedSchedules = groupSchedules(schedules);

    // Crear PDF
    const doc = new jsPDF();
    const currentDate = formatDateToSpanish(new Date());

    // Cargar y agregar imagen de fondo
    const imgData = await loadBackgroundImage();
    if (imgData) {
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    // ASUNTO - Centrado, Negrita, Mayúsculas (Y: 50)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 105, 50, { align: 'center' });
    
    // Fecha - Centrado, Normal (Y: 57)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(`Teziutlán, Pue., ${currentDate}`, 105, 57, { align: 'center' });

    // Nombre del maestro - Centrado, Negrita, Mayúsculas, Tamaño mayor (Y: 70)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(teacherName, 105, 70, { align: 'center' });
    
    // Tipo de personal - Centrado, Negrita, Mayúsculas (Y: 76)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${personalType} DE LA UPN-212 TEZIUTLÁN`, 105, 76, { align: 'center' });
    
    // PRESENTE - Centrado, Negrita, Mayúsculas (Y: 82)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PRESENTE', 105, 82, { align: 'center' });

    // Párrafo introductorio - Justificado, Normal (Y: 95)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const introText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${licenciaturaName}, que corresponde al periodo ${periodoText}..`;
    const splitIntro = doc.splitTextToSize(introText, 155);
    doc.text(splitIntro, 27, 95, { align: 'justify' });

    // Tabla de horarios - Centrada (Y: 110)
    const tableData = groupedSchedules.map(schedule => [
      schedule.subject_key,
      schedule.subject_name,
      schedule.schedules,
      schedule.semester
    ]);

    autoTable(doc, {
      startY: 110,
      head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        halign: 'center',
        valign: 'middle',
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 58, halign: 'center' },
        2: { cellWidth: 78, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' }
      },
      margin: { left: 27, right: 27 }
    });

    // Obtener la posición Y después de la tabla
    const finalY = (doc as any).lastAutoTable.finalY || 140;

    // Párrafo de cierre - Justificado, Normal (espacio después de tabla)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const closingText = 'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';
    const splitClosing = doc.splitTextToSize(closingText, 155);
    doc.text(splitClosing, 27, finalY + 8, { align: 'justify' });

    // Calcular posición de firma
    const closingHeight = splitClosing.length * 4; // Aproximadamente 4mm por línea
    const signatureY = finalY + 8 + closingHeight + 15;

    // ATENTAMENTE - Centrado, Negrita, Mayúsculas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ATENTAMENTE', 105, signatureY, { align: 'center' });
    
    // Slogan - Centrado, Negrita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('"EDUCAR PARA TRANSFORMAR"', 105, signatureY + 6, { align: 'center' });
    
    // Espacio para firma manuscrita (aproximadamente 15mm)
    
    // Nombre del firmante - Centrado, Negrita, Mayúsculas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DR. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, signatureY + 21, { align: 'center' });
    
    // Cargo línea 1 - Centrado, Normal, Mayúsculas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN', 105, signatureY + 26, { align: 'center' });
    
    // Cargo línea 2 - Centrado, Normal, Mayúsculas
    doc.text('DE LA UNIVERSIDAD PEDAGÓGICA NACIONAL', 105, signatureY + 31, { align: 'center' });
    
    // Cargo línea 3 - Centrado, Normal, Mayúsculas
    //doc.text('UNIDAD 212 TEZIUTLÁN', 105, signatureY + 36, { align: 'center' });

    // Guardar PDF
    const fileName = `Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

// Función para cargar la imagen de fondo
const loadBackgroundImage = async (): Promise<string | null> => {
  try {
    const response = await fetch('/upnimg.jpg');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading background image:', error);
    return null;
  }
};
