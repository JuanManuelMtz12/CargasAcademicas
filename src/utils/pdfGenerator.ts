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

// La ÚLTIMA línea del cargo del director no debe pasar de aquí (un poco antes del pie).
// Si todavía se encima con el fondo, baja este margen (ej. 5 o 6).
const SIGNATURE_BOTTOM_MARGIN = 3;
const SIGNATURE_BOTTOM_LIMIT = FOOTER_SAFE_Y - SIGNATURE_BOTTOM_MARGIN;

// ── Niveles de compactación ─────────────────────────────────────────────────
// El oficio se prueba en una hoja de borrador con cada nivel, de arriba hacia abajo,
// y se usa el PRIMERO donde todo cabe en una hoja sin invadir el pie.
// El nivel 0 es el formato original.
//
//  fontSize   tamaño de letra de la tabla (pt)
//  pad        relleno interno de cada celda (mm)
//  tableGap   espacio entre el párrafo de apertura y la tabla (mm)
//  afterTable espacio entre la tabla y el párrafo de cierre (mm)
//  sigGap     espacio entre el cierre y ATENTAMENTE (mm)
//  nameOffset distancia de ATENTAMENTE al nombre del director (mm) = espacio para firmar
//  cargo1/2   distancia de ATENTAMENTE a las dos líneas del cargo (mm)
interface Layout {
  fontSize: number;
  pad: number;
  tableGap: number;
  afterTable: number;
  sigGap: number;
  nameOffset: number;
  cargo1: number;
  cargo2: number;
}

const LAYOUTS: Layout[] = [
  { fontSize: 9,   pad: 2.5, tableGap: 3.5, afterTable: 8, sigGap: 15, nameOffset: 21, cargo1: 26, cargo2: 31 }, // original
  { fontSize: 9,   pad: 2.5, tableGap: 3.5, afterTable: 8, sigGap: 11, nameOffset: 19, cargo1: 24, cargo2: 28 },
  { fontSize: 9,   pad: 2.2, tableGap: 3,   afterTable: 7, sigGap: 9,  nameOffset: 18, cargo1: 23, cargo2: 27 },
  { fontSize: 8.5, pad: 1.8, tableGap: 3,   afterTable: 6, sigGap: 8,  nameOffset: 17, cargo1: 22, cargo2: 26 },
  { fontSize: 8,   pad: 1.5, tableGap: 2.5, afterTable: 5, sigGap: 7,  nameOffset: 16, cargo1: 21, cargo2: 25 },
  { fontSize: 7.5, pad: 1.4, tableGap: 2.5, afterTable: 5, sigGap: 8,  nameOffset: 16, cargo1: 21, cargo2: 26 },
  { fontSize: 7,   pad: 1.1, tableGap: 2,   afterTable: 4, sigGap: 6,  nameOffset: 14, cargo1: 19, cargo2: 24 },
  { fontSize: 6.5, pad: 0.9, tableGap: 2,   afterTable: 3, sigGap: 5,  nameOffset: 13, cargo1: 18, cargo2: 23 },
];

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
    // Un horario por línea (antes iban todos seguidos y se partían donde caía el ancho)
    group.schedules = group.schedules ? `${group.schedules}\n${timeRange}` : timeRange;
  });

  return Array.from(grouped.values());
};

interface OficioInput {
  teacherName: string;
  personalType: string;
  licenciaturaName: string;
  periodoText: string;
  currentDate: string;
  tableData: string[][];
}

const CLOSING_TEXT =
  'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';

/**
 * Dibuja TODO el oficio con un nivel de compactación dado.
 * Devuelve la Y de la última línea del cargo del director.
 * allowFallbackPage = true solo en el último recurso (si ni el nivel más compacto cabe):
 * entonces el cierre y la firma pasan a una página nueva con fondo.
 */
const drawOficio = (
  doc: jsPDF,
  d: OficioInput,
  layout: Layout,
  imgData: string | null,
  allowFallbackPage: boolean
): number => {
  // Imagen de fondo
  if (imgData) {
    try { doc.addImage(imgData, 'JPEG', 0, 0, 210, 297); } catch { /* noop */ }
  }

  // ASUNTO
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 105, 50, { align: 'center' });

  // Fecha
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.text(`Teziutlán, Pue., ${d.currentDate}`, 105, 57, { align: 'center' });

  // Nombre del maestro
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(d.teacherName, 105, 70, { align: 'center' });

  // Tipo de personal
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(`${d.personalType} DE LA UPN-212 TEZIUTLÁN`, 105, 76, { align: 'center' });

  // PRESENTE
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('PRESENTE', 105, 82, { align: 'center' });

  // Párrafo introductorio
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const introText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${d.licenciaturaName}, que corresponde al periodo ${d.periodoText}.`;
  const splitIntro = doc.splitTextToSize(introText, 155);
  doc.text(splitIntro, 27, 95, { align: 'justify' });

  // La tabla empieza justo después del párrafo (antes era fija en 110)
  const tableStartY = 95 + splitIntro.length * 4.2 + layout.tableGap;

  autoTable(doc, {
    startY: tableStartY,
    head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
    body: d.tableData,
    theme: 'grid',
    styles: { fontSize: layout.fontSize, cellPadding: layout.pad, halign: 'center', valign: 'middle', lineColor: [0,0,0], lineWidth: 0.1 },
    headStyles: { fillColor: [220,220,220], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', fontSize: layout.fontSize },
    bodyStyles: { fontSize: layout.fontSize },
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
  const splitClosing = doc.splitTextToSize(CLOSING_TEXT, 155);

  let closingY = finalY + layout.afterTable;
  const closingH = splitClosing.length * 4;

  // ¿La última línea del cargo cabe antes del pie del membrete?
  let lastLineY = closingY + closingH + layout.sigGap + layout.cargo2;

  if (lastLineY > SIGNATURE_BOTTOM_LIMIT && allowFallbackPage) {
    // Último recurso: cierre y firma en página nueva con fondo
    doc.addPage();
    if (imgData) {
      try { doc.addImage(imgData, 'JPEG', 0, 0, 210, 297); } catch { /* noop */ }
    }
    closingY = 30;
    lastLineY = closingY + closingH + layout.sigGap + layout.cargo2;
  }

  doc.text(splitClosing, 27, closingY, { align: 'justify' });

  const signatureY = closingY + closingH + layout.sigGap;

  // Firma
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('ATENTAMENTE', 105, signatureY, { align: 'center' });
  doc.text('"EDUCAR PARA TRANSFORMAR"', 105, signatureY + 6, { align: 'center' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('C. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, signatureY + layout.nameOffset, { align: 'center' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN DE LA UNIVERSIDAD', 105, signatureY + layout.cargo1, { align: 'center' });
  doc.text('PEDAGÓGICA NACIONAL', 105, signatureY + layout.cargo2, { align: 'center' });

  return lastLineY;
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
    const tableData = groupedSchedules.map(s => [s.subject_key, s.subject_name, s.schedules, s.semester]);

    const input: OficioInput = {
      teacherName,
      personalType,
      licenciaturaName,
      periodoText,
      currentDate: formatDateToSpanish(new Date()),
      tableData,
    };

    // Crear PDF
    const doc = new jsPDF();
    const imgData = await loadBackgroundImage();

    // 1) Busca el primer nivel donde TODO cabe en una hoja sin invadir el pie del fondo
    let drawn = false;
    for (const layout of LAYOUTS) {
      const probe = new jsPDF();
      const bottom = drawOficio(probe, input, layout, null, false);
      if (probe.getNumberOfPages() === 1 && bottom <= SIGNATURE_BOTTOM_LIMIT) {
        drawOficio(doc, input, layout, imgData, false);
        drawn = true;
        break;
      }
    }

    // 2) Último recurso: demasiadas filas aun con el nivel más compacto
    if (!drawn) {
      drawOficio(doc, input, LAYOUTS[LAYOUTS.length - 1], imgData, true);
    }

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