import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AcademicLoadData {
  id: string;
  group_name: string;
  location: string;
  module_number: string;
  module_name: string;
  module_key: string;
  start_time: string;
  end_time: string;
  work_modality: string;
  face_to_face_days: string[];
  face_to_face_schedule: Record<string, number[]>;
  start_date: string;
  end_date: string;
  status: string;
  program_name: string;
  specialization_name: string;
  instructor_name: string;
  academic_period_name: string;
}

const MONTHS_ES: Record<string, string> = {
  'enero': 'ENERO',
  'febrero': 'FEBRERO',
  'marzo': 'MARZO',
  'abril': 'ABRIL',
  'mayo': 'MAYO',
  'junio': 'JUNIO',
  'julio': 'JULIO',
  'agosto': 'AGOSTO',
  'septiembre': 'SEPTIEMBRE',
  'octubre': 'OCTUBRE',
  'noviembre': 'NOVIEMBRE',
  'diciembre': 'DICIEMBRE',
};

export const generateAcademicLoadPDF = (loads: AcademicLoadData[], periodName: string = '') => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter',
  });

  let yPosition = 15;

  // Encabezado institucional
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIVERSIDAD PEDAGÓGICA NACIONAL', doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 6;
  
  doc.setFontSize(12);
  doc.text('UNIDAD 212 TEZIUTLÁN, PUE.', doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(11);
  doc.text('ASIGNACIÓN DE CARGAS ACADÉMICAS', doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Información del período
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const period = periodName || loads[0]?.academic_period_name || '';
  doc.text(`Período: ${period}`, 15, yPosition);
  yPosition += 6;
  doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 15, yPosition);
  yPosition += 10;

  // Preparar datos para la tabla
  const tableData = loads.map(load => {
    const scheduleText = formatSchedule(load.face_to_face_schedule, load.face_to_face_days);
    
    return [
      load.specialization_name.substring(0, 60) + (load.specialization_name.length > 60 ? '...' : ''),
      `${load.module_number}\n${load.module_name}\n(${load.module_key})`,
      load.instructor_name,
      `${load.group_name}\n${load.location}`,
      `${load.start_time.substring(0, 5)}-${load.end_time.substring(0, 5)}\n${load.work_modality}`,
      scheduleText,
    ];
  });

  // Generar tabla
  (doc as any).autoTable({
    head: [['Especialización', 'Módulo', 'Asesor', 'Grupo/Ubicación', 'Horario', 'Sesiones']],
    body: tableData,
    startY: yPosition,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 45 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
      4: { cellWidth: 30 },
      5: { cellWidth: 45 },
    },
    margin: { left: 15, right: 15 },
  });

  // Pie de página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  return doc;
};

export const generateGroupCalendarPDF = (load: AcademicLoadData) => {
  const doc = new jsPDF();

  let yPosition = 20;

  // Encabezado
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CALENDARIO DE SESIONES', doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.text(load.group_name, doc.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Información del módulo
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${load.module_number}: ${load.module_name}`, 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Asesor: ${load.instructor_name}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Horario: ${load.start_time.substring(0, 5)} - ${load.end_time.substring(0, 5)}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Modalidad: ${load.work_modality}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Ubicación: ${load.location}`, 20, yPosition);
  yPosition += 10;

  // Calendario de sesiones
  doc.setFont('helvetica', 'bold');
  doc.text('Sesiones Presenciales:', 20, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  if (load.face_to_face_schedule && Object.keys(load.face_to_face_schedule).length > 0) {
    Object.entries(load.face_to_face_schedule).forEach(([month, days]) => {
      const monthName = MONTHS_ES[month.toLowerCase()] || month.toUpperCase();
      const daysText = (days as number[]).map(d => d.toString().padStart(2, '0')).join(', ');
      
      doc.text(`${monthName}: ${daysText}`, 25, yPosition);
      yPosition += 6;
    });
  } else {
    doc.text('No hay sesiones programadas', 25, yPosition);
    yPosition += 6;
  }

  yPosition += 10;

  // Período
  doc.setFont('helvetica', 'bold');
  doc.text('Período:', 20, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Inicio: ${new Date(load.start_date).toLocaleDateString('es-MX')}`, 25, yPosition);
  yPosition += 6;
  doc.text(`Fin: ${new Date(load.end_date).toLocaleDateString('es-MX')}`, 25, yPosition);

  // Pie de página
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Generado: ${new Date().toLocaleDateString('es-MX')} - Sistema UPN`,
    doc.internal.pageSize.width / 2,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );

  return doc;
};

const formatSchedule = (schedule: Record<string, number[]>, days: string[]): string => {
  if (!schedule || Object.keys(schedule).length === 0) {
    return days.join(', ');
  }

  const lines: string[] = [];
  Object.entries(schedule).forEach(([month, daysList]) => {
    const monthName = MONTHS_ES[month.toLowerCase()] || month;
    const daysText = (daysList as number[]).map(d => d.toString().padStart(2, '0')).join(', ');
    lines.push(`${monthName}: ${daysText}`);
  });

  return lines.join('\n');
};

export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};
