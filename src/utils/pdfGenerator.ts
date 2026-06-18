import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

// Semestres nones permitidos (primer carácter del nombre del grupo)
const ODD_SEMESTERS = ['1', '3', '5', '7'];

const isOddSemesterGroup = (groupName: string): boolean => {
  if (!groupName) return false;
  return ODD_SEMESTERS.includes(groupName.charAt(0));
};

// ── Control de espacio en la página (A4: 210 x 297mm, fondo a página completa) ──
// Límite vertical (mm) a partir del cual empieza el arte del pie de página
// (barra dorada con redes sociales y dirección) dentro de la imagen de fondo.
const FOOTER_SAFE_Y = 258;

// Altura estimada (mm) que ocupa el bloque ATENTAMENTE + frase + nombre + cargo.
const SIGNATURE_BLOCK_HEIGHT = 35;

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
  schedules: string;
}

const groupSchedules = (schedules: ScheduleData[]): GroupedSchedule[] => {
  const grouped = new Map<string, GroupedSchedule>();

  schedules.forEach((schedule) => {
    const key = `${schedule.subject_key}_${schedule.semester}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        subject_key: schedule.subject_key,
        subject_name: schedule.subject_name,
        semester: schedule.semester,
        schedules: '',
      });
    }

    const group = grouped.get(key)!;
    const timeRange = `${schedule.day_of_week} De ${formatHour(schedule.start_hour)} a ${formatHour(schedule.end_hour)}`;
    group.schedules = group.schedules ? `${group.schedules} ${timeRange}` : timeRange;
  });

  return Array.from(grouped.values());
};

export const generateOficioPDF = async (teacherId: string): Promise<void> => {
  try {
    // Obtener datos del maestro
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select(`name, categories (category)`)
      .eq('id', teacherId)
      .single();

    if (teacherError) throw teacherError;
    if (!teacherData) throw new Error('Maestro no encontrado');

    const teacher = teacherData as any;
    const teacherName = teacher.name.toUpperCase();
    const teacherCategory = teacher.categories.category.toUpperCase();
    const personalType = teacherCategory === 'INVITADO'
      ? 'PERSONAL DOCENTE INVITADO'
      : 'PERSONAL DOCENTE DE BASE';

    // Obtener horarios con ciclo escolar
    const { data: schedulesDataRaw, error: schedulesError } = await supabase
      .from('schedule')
      .select(`
        day,
        start_hour,
        end_hour,
        subjects (clave, name, programs (name)),
        groups (name),
        school_cycles (start_date, end_date, is_active)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });

    if (schedulesError) throw schedulesError;

    // ── FILTRO: solo ciclo activo y semestres nones (1, 3, 5, 7) ───────────
    const schedulesData = (schedulesDataRaw || []).filter((s: any) => {
      const groupName: string = s.groups?.name || '';
      const isActive: boolean = s.school_cycles?.is_active === true;
      return isActive && isOddSemesterGroup(groupName);
    });

    if (schedulesData.length === 0) {
      throw new Error('El maestro no tiene horarios asignados en semestres nones del ciclo activo');
    }

    // Nombre de la licenciatura y periodo
    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;

    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = '';
    if (schoolCycle?.start_date && schoolCycle?.end_date) {
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const startDate = new Date(schoolCycle.start_date);
      const endDate   = new Date(schoolCycle.end_date);
      periodoText = `del ${startDate.getDate()} de ${months[startDate.getMonth()]} al ${endDate.getDate()} de ${months[endDate.getMonth()]} del ${endDate.getFullYear()}`;
    } else {
      periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    }

    // Transformar y agrupar
    const schedules: ScheduleData[] = schedulesData.map((s: any) => ({
      subject_key:  s.subjects.clave,
      subject_name: s.subjects.name,
      semester:     s.groups.name,
      day_of_week:  s.day,
      start_hour:   s.start_hour,
      end_hour:     s.end_hour,
    }));

    const groupedSchedules = groupSchedules(schedules);

    // Crear PDF
    const doc = new jsPDF();
    const currentDate = formatDateToSpanish(new Date());

    // Imagen de fondo
    const imgData = await loadBackgroundImage();
    if (imgData) {
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    // ASUNTO
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 105, 50, { align: 'center' });

    // Fecha
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    doc.text(`Teziutlán, Pue., ${currentDate}`, 105, 57, { align: 'center' });

    // Nombre del maestro
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(teacherName, 105, 70, { align: 'center' });

    // Tipo de personal
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`${personalType} DE LA UPN-212 TEZIUTLÁN`, 105, 76, { align: 'center' });

    // PRESENTE
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('PRESENTE', 105, 82, { align: 'center' });

    // Párrafo introductorio
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const introText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${licenciaturaName}, que corresponde al periodo ${periodoText}.`;
    const splitIntro = doc.splitTextToSize(introText, 155);
    doc.text(splitIntro, 27, 95, { align: 'justify' });

    // Tabla de horarios
    const tableData = groupedSchedules.map(s => [s.subject_key, s.subject_name, s.schedules, s.semester]);

    autoTable(doc, {
      startY: 110,
      head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5, halign: 'center', valign: 'middle', lineColor: [0,0,0], lineWidth: 0.1 },
      headStyles: { fillColor: [220,220,220], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 58, halign: 'center' },
        2: { cellWidth: 78, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: 27, right: 27 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 140;

    // Párrafo de cierre
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const closingText = 'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';
    const splitClosing = doc.splitTextToSize(closingText, 155);

    // ── Si el cierre + firma no caben antes del pie de página, saltar a página nueva ──
    let closingY = finalY + 8;
    const requiredHeight = splitClosing.length * 4 + 15 + SIGNATURE_BLOCK_HEIGHT;

    if (closingY + requiredHeight > FOOTER_SAFE_Y) {
      doc.addPage();
      if (imgData) {
        try { doc.addImage(imgData, 'JPEG', 0, 0, 210, 297); } catch { /* noop */ }
      }
      closingY = 30;
    }

    doc.text(splitClosing, 27, closingY, { align: 'justify' });

    const signatureY = closingY + splitClosing.length * 4 + 15;

    // Firma
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('ATENTAMENTE', 105, signatureY, { align: 'center' });
    doc.text('"EDUCAR PARA TRANSFORMAR"', 105, signatureY + 6, { align: 'center' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('DR. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, signatureY + 21, { align: 'center' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN', 105, signatureY + 26, { align: 'center' });
    doc.text('DE LA UNIVERSIDAD PEDAGÓGICA NACIONAL', 105, signatureY + 31, { align: 'center' });

    // Guardar PDF
    doc.save(`Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

  } catch (error: any) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

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