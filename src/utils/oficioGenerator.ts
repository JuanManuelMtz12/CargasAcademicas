import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import JSZip from 'jszip';

// Semestres nones permitidos (primer carácter del nombre del grupo)
const ODD_SEMESTERS = ['1', '3', '5', '7'];

const isOddSemesterGroup = (groupName: string): boolean => {
  if (!groupName) return false;
  return ODD_SEMESTERS.includes(groupName.charAt(0));
};

// Y mínima para la firma cuando todo cabe en página 1
const SIGNATURE_MIN_Y = 190;
// Límite inferior: la ÚLTIMA línea del cargo del director no debe pasar de aquí.
// La dirección del membrete (fondo) empieza a ~245 mm. Si todavía se encima, baja este valor.
const FOOTER_SAFE_Y = 242;

// Hoja carta: 215.9 x 279.4 mm
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;

// Ajusta estos valores para estirar/encoger el membrete
// BG_SCALE: 1 = membrete a hoja completa; 0.97 = 3% más chico (se ve completo, con un
// pequeño margen blanco alrededor). Baja a 0.95 si todavía se ve cortado.
const BG_SCALE = 0.97;
// BG_ANCHOR_Y: dónde queda el membrete reducido en vertical.
//   0 = pegado arriba, 0.5 = centrado, 1 = pegado abajo.
const BG_ANCHOR_Y = 0.5;
const BG_WIDTH = PAGE_WIDTH * BG_SCALE;
const BG_HEIGHT = PAGE_HEIGHT * BG_SCALE;
const BG_X = (PAGE_WIDTH - BG_WIDTH) / 2;
const BG_Y = (PAGE_HEIGHT - BG_HEIGHT) * BG_ANCHOR_Y;

const addBackgroundImage = (doc: jsPDF, bgImage: string) => {
  doc.addImage(bgImage, 'JPEG', BG_X, BG_Y, BG_WIDTH, BG_HEIGHT);
};

const formatDateToSpanish = (date: Date): string => {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
};

const formatHour = (hour: number): string => `${hour.toString().padStart(2, '0')}:00`;

interface ScheduleRow {
  clave: string;
  asignatura: string;
  horario: string;
  semestre: string;
}

interface LeipScheduleRow {
  modulo: string;
  asignatura: string;
  horario: string;
  grupo: string;
}

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

// ════════════════════════════════════════════════════════════════════════════
// NIVELES DE COMPACTACIÓN
// ════════════════════════════════════════════════════════════════════════════
// El oficio se prueba en una hoja de borrador con cada nivel, de arriba hacia abajo.
// Se usa el PRIMERO en el que todo cabe en una hoja y la firma termina antes de
// FOOTER_SAFE_Y. El nivel 0 es tu formato original.
//
//  fontSize   tamaño de letra de la tabla (pt)
//  pad        relleno interno de cada celda (mm)
//  headGap    espacio después de "P R E S E N T E" (mm)
//  introGap   espacio después del párrafo de apertura (mm)
//  afterTable espacio entre la tabla y el párrafo de cierre (mm)
//  closeGap   espacio entre el cierre y ATENTAMENTE (mm)
//  nameOffset distancia de ATENTAMENTE al nombre del director (mm) = espacio de firma
//  cargo1/2   distancia de ATENTAMENTE a las dos líneas del cargo (mm)
interface Layout {
  fontSize: number;
  pad: number;
  headGap: number;
  introGap: number;
  afterTable: number;
  closeGap: number;
  nameOffset: number;
  cargo1: number;
  cargo2: number;
}

const LAYOUTS: Layout[] = [
  { fontSize: 9,   pad: 3,   headGap: 8, introGap: 3,   afterTable: 10, closeGap: 6, nameOffset: 24, cargo1: 29, cargo2: 33 }, // original
  // 1-3: letra 9 igual que el original; solo se recortan espacios y un poco de relleno
  { fontSize: 9,   pad: 3,   headGap: 7, introGap: 3,   afterTable: 8,  closeGap: 5, nameOffset: 20, cargo1: 25, cargo2: 29 },
  { fontSize: 9,   pad: 2.5, headGap: 7, introGap: 3,   afterTable: 8,  closeGap: 5, nameOffset: 20, cargo1: 25, cargo2: 29 },
  { fontSize: 9,   pad: 2,   headGap: 7, introGap: 3,   afterTable: 7,  closeGap: 4, nameOffset: 19, cargo1: 24, cargo2: 28 },
  // 4 en adelante: la letra de la tabla empieza a bajar
  { fontSize: 8.5, pad: 1.8, headGap: 6, introGap: 3,   afterTable: 6,  closeGap: 4, nameOffset: 18, cargo1: 23, cargo2: 27 },
  { fontSize: 8,   pad: 1.5, headGap: 6, introGap: 2,   afterTable: 5,  closeGap: 4, nameOffset: 17, cargo1: 22, cargo2: 26 },
  { fontSize: 7.5, pad: 1.5, headGap: 6, introGap: 2,   afterTable: 5,  closeGap: 4, nameOffset: 17, cargo1: 22, cargo2: 26 },
  { fontSize: 7,   pad: 1.2, headGap: 5, introGap: 2,   afterTable: 4,  closeGap: 3, nameOffset: 15, cargo1: 20, cargo2: 24 },
  { fontSize: 6.5, pad: 1,   headGap: 4, introGap: 1.5, afterTable: 3,  closeGap: 3, nameOffset: 14, cargo1: 19, cargo2: 23 },
];

// ── Dibuja encabezado (asunto + fecha + destinatario) ─────────────────────
const drawHeader = (
  doc: jsPDF,
  teacherName: string,
  personalType: string,
  date: string,
  headGap: number = 8
) => {
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 195, 35, { align: 'right' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Teziutlán, Pue., ${date}`, 195, 41, { align: 'right' });

  let y = 49;
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, 25, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(personalType, 25, y); y += 5;
  doc.text('DE LA UPN-212 TEZIUTLÁN', 25, y); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('P R E S E N T E', 25, y); y += headGap;
  return y;
};

// ── Dibuja párrafo introductorio ──────────────────────────────────────────
const drawIntroText = (
  doc: jsPDF,
  y: number,
  licenciaturaName: string,
  periodoText: string,
  introGap: number = 3
): number => {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const mainText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${licenciaturaName}, que corresponde al periodo ${periodoText}.`;
  const split = doc.splitTextToSize(mainText, 165);
  doc.text(split, 25, y, { align: 'justify', maxWidth: 165 });
  return y + split.length * 5 + introGap;
};

// ── Dibuja el cierre + firma. Devuelve la Y de la última línea del cargo ──
const drawClosingAndSignature = (
  doc: jsPDF,
  y: number,
  forcedMinY = false,
  layout: Layout = LAYOUTS[0]
): number => {
  const closingText = 'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const split = doc.splitTextToSize(closingText, 165);
  doc.text(split, 25, y, { align: 'justify', maxWidth: 165 });
  y += split.length * 5 + layout.closeGap;

  // En página 1 usar Math.max para que la firma no suba encima del contenido
  const signatureY = forcedMinY ? Math.max(y, SIGNATURE_MIN_Y) : y;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('ATENTAMENTE', 105, signatureY, { align: 'center' });
  doc.text('"EDUCAR PARA TRANSFORMAR"', 105, signatureY + 6, { align: 'center' });
  doc.text('C. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, signatureY + layout.nameOffset, { align: 'center' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN DE LA UNIVERSIDAD', 105, signatureY + layout.cargo1, { align: 'center' });
  doc.text('PEDAGÓGICA NACIONAL', 105, signatureY + layout.cargo2, { align: 'center' });

  return signatureY + layout.cargo2;
};

// ════════════════════════════════════════════════════════════════════════════
// RENDER COMPARTIDO (regular y LEIP)
// ════════════════════════════════════════════════════════════════════════════

interface TableSpec {
  head: string[];
  body: string[][];
  columnStyles: Record<number, any>;
}

interface OficioArgs {
  teacherName: string;
  personalType: string;
  licenciaturaName: string;
  periodoText: string;
  spec: TableSpec;
  dateStr: string;
}

const drawTable = (doc: jsPDF, startY: number, spec: TableSpec, layout: Layout) => {
  autoTable(doc, {
    startY,
    head: [spec.head],
    body: spec.body,
    theme: 'grid',
    headStyles: { fillColor: [200,200,200], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', valign: 'middle', lineColor: [0,0,0], lineWidth: 0.5 },
    styles: { fontSize: layout.fontSize, cellPadding: layout.pad, lineColor: [0,0,0], lineWidth: 0.3, valign: 'middle' },
    columnStyles: spec.columnStyles,
    margin: { left: 25, right: 25 },
  });
};

// Dibuja TODO en una hoja con un nivel dado. Devuelve la Y de la última línea del cargo.
const drawSinglePage = (
  doc: jsPDF,
  args: OficioArgs,
  layout: Layout,
  bgImage: string | null
): number => {
  if (bgImage) {
    try { addBackgroundImage(doc, bgImage); } catch { /* noop */ }
  }
  let y = drawHeader(doc, args.teacherName, args.personalType, args.dateStr, layout.headGap);
  y = drawIntroText(doc, y, args.licenciaturaName, args.periodoText, layout.introGap);
  drawTable(doc, y, args.spec, layout);
  y = (doc as any).lastAutoTable.finalY + layout.afterTable;
  return drawClosingAndSignature(doc, y, true, layout);
};

const renderOficio = (doc: jsPDF, args: OficioArgs, bgImage: string | null) => {
  // 1) Busca el primer nivel donde TODO cabe en una hoja sin invadir el fondo
  for (const layout of LAYOUTS) {
    const probe = new jsPDF({ format: 'letter' });
    const bottom = drawSinglePage(probe, args, layout, null);
    if (probe.getNumberOfPages() === 1 && bottom <= FOOTER_SAFE_Y) {
      drawSinglePage(doc, args, layout, bgImage);
      return;
    }
  }

  // 2) Respaldo (demasiadas filas aun con el nivel más compacto):
  //    tabla en página 1; cierre y firma en página 2 con fondo, encabezado e intro.
  const layout = LAYOUTS[LAYOUTS.length - 1];
  if (bgImage) {
    try { addBackgroundImage(doc, bgImage); } catch { /* noop */ }
  }
  let yPos = drawHeader(doc, args.teacherName, args.personalType, args.dateStr, layout.headGap);
  yPos = drawIntroText(doc, yPos, args.licenciaturaName, args.periodoText, layout.introGap);
  drawTable(doc, yPos, args.spec, layout);

  doc.addPage();
  if (bgImage) {
    try { addBackgroundImage(doc, bgImage); } catch { /* noop */ }
  }
  let y2 = drawHeader(doc, args.teacherName, args.personalType, args.dateStr, layout.headGap);
  y2 = drawIntroText(doc, y2, args.licenciaturaName, args.periodoText, layout.introGap);
  drawClosingAndSignature(doc, y2, false, layout);
};

// ════════════════════════════════════════════════════════════════════════════
// PROGRAMAS REGULARES (escolarizados)
// ════════════════════════════════════════════════════════════════════════════

const buildOficioPdf = async (
  doc: jsPDF,
  teacherName: string,
  personalType: string,
  licenciaturaName: string,
  periodoText: string,
  tableRows: ScheduleRow[],
  bgImage: string | null
) => {
  renderOficio(
    doc,
    {
      teacherName,
      personalType,
      licenciaturaName,
      periodoText,
      dateStr: formatDateToSpanish(new Date()),
      spec: {
        head: ['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM'],
        body: tableRows.map(r => [r.clave, r.asignatura, r.horario, r.semestre]),
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 55, halign: 'center' },
          2: { cellWidth: 70 },
          3: { cellWidth: 18, halign: 'center' }
        },
      },
    },
    bgImage
  );
};

// ── Función principal: genera y descarga ──────────────────────────────────
export const generateOficioFromTemplate = async (teacherId: string, programId?: string): Promise<void> => {
  try {
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

    const { data: schedulesDataRaw, error: schedulesError } = await supabase
      .from('schedule')
      .select(`
        day, start_hour, end_hour,
        subjects (clave, name, program_id, programs (name)),
        groups (name),
        school_cycles (start_date, end_date, is_active)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });
    if (schedulesError) throw schedulesError;

    let schedulesData = schedulesDataRaw;
    if (programId && schedulesData)
      schedulesData = schedulesData.filter((s: any) => s.subjects?.program_id === programId);
    if (schedulesData)
      schedulesData = schedulesData.filter((s: any) =>
        s.school_cycles?.is_active === true && isOddSemesterGroup(s.groups?.name || '')
      );
    if (!schedulesData || schedulesData.length === 0)
      throw new Error('El maestro no tiene horarios asignados en semestres nones del ciclo activo');

    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;

    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    if (schoolCycle?.start_date && schoolCycle?.end_date) {
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const s = new Date(schoolCycle.start_date);
      const e = new Date(schoolCycle.end_date);
      periodoText = `del ${s.getUTCDate()} de ${months[s.getUTCMonth()]} al ${e.getUTCDate()} de ${months[e.getUTCMonth()]} del ${e.getUTCFullYear()}`;
    }

    const groupedMap = new Map<string, any>();
    schedulesData.forEach((s: any) => {
      const key = `${s.subjects.clave}_${s.groups.name}`;
      if (!groupedMap.has(key))
        groupedMap.set(key, { clave: s.subjects.clave, asignatura: s.subjects.name, semestre: s.groups.name, schedules: [] });
      groupedMap.get(key)!.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });
    const tableRows: ScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      clave: item.clave, asignatura: item.asignatura,
      horario: item.schedules.join('\n'), semestre: item.semestre,
    }));

    const doc = new jsPDF({ format: 'letter' });
    let bgImage: string | null = null;
    try { bgImage = await loadImageAsBase64('/images/upnimg.jpg'); } catch { console.warn('No se pudo cargar imagen de fondo'); }

    await buildOficioPdf(doc, teacherName, personalType, licenciaturaName, periodoText, tableRows, bgImage);
    doc.save(`Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error: any) {
    console.error('Error generating oficio:', error);
    throw error;
  }
};

// ── Versión blob (para ZIP) ───────────────────────────────────────────────
const generateOficioBlob = async (teacherId: string, programId?: string): Promise<{ blob: Blob; fileName: string; teacherName: string } | null> => {
  try {
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

    const { data: schedulesDataRaw, error: schedulesError } = await supabase
      .from('schedule')
      .select(`
        day, start_hour, end_hour,
        subjects (clave, name, program_id, programs (name)),
        groups (name),
        school_cycles (start_date, end_date, is_active)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });
    if (schedulesError) throw schedulesError;

    let schedulesData = schedulesDataRaw;
    if (programId && schedulesData)
      schedulesData = schedulesData.filter((s: any) => s.subjects?.program_id === programId);
    if (schedulesData)
      schedulesData = schedulesData.filter((s: any) =>
        s.school_cycles?.is_active === true && isOddSemesterGroup(s.groups?.name || '')
      );
    if (!schedulesData || schedulesData.length === 0) {
      console.warn(`Maestro ${teacher.name} no tiene horarios en semestres nones del ciclo activo`);
      return null;
    }

    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;

    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    if (schoolCycle?.start_date && schoolCycle?.end_date) {
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const s = new Date(schoolCycle.start_date);
      const e = new Date(schoolCycle.end_date);
      periodoText = `del ${s.getUTCDate()} de ${months[s.getUTCMonth()]} al ${e.getUTCDate()} de ${months[e.getUTCMonth()]} del ${e.getUTCFullYear()}`;
    }

    const groupedMap = new Map<string, any>();
    schedulesData.forEach((s: any) => {
      const key = `${s.subjects.clave}_${s.groups.name}`;
      if (!groupedMap.has(key))
        groupedMap.set(key, { clave: s.subjects.clave, asignatura: s.subjects.name, semestre: s.groups.name, schedules: [] });
      groupedMap.get(key)!.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });
    const tableRows: ScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      clave: item.clave, asignatura: item.asignatura,
      horario: item.schedules.join('\n'), semestre: item.semestre,
    }));

    const doc = new jsPDF({ format: 'letter' });
    let bgImage: string | null = null;
    try { bgImage = await loadImageAsBase64('/images/upnimg.jpg'); } catch { console.warn('No se pudo cargar imagen de fondo'); }

    await buildOficioPdf(doc, teacherName, personalType, licenciaturaName, periodoText, tableRows, bgImage);

    const blob = doc.output('blob');
    const fileName = `Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    return { blob, fileName, teacherName: teacher.name };
  } catch (error: any) {
    console.error('Error generating oficio blob:', error);
    return null;
  }
};

// ── Descargar todos los oficios de un maestro ────────────────────────────
export const downloadAllOficiosForTeacher = async (teacherId: string): Promise<void> => {
  try {
    const { data: schedules, error } = await supabase
      .from('schedule')
      .select('subjects(program_id, programs(name))')
      .eq('teacher_id', teacherId);
    if (error) throw error;
    if (!schedules || schedules.length === 0) throw new Error('El maestro no tiene horarios asignados');

    const programIds = new Set<string>();
    schedules.forEach((s: any) => { if (s.subjects?.program_id) programIds.add(s.subjects.program_id); });
    if (programIds.size === 0) throw new Error('No se encontraron programas para este maestro');

    if (programIds.size === 1) {
      await generateOficioFromTemplate(teacherId, Array.from(programIds)[0]);
      return;
    }

    const zip = new JSZip();
    for (const programId of Array.from(programIds)) {
      const result = await generateOficioBlob(teacherId, programId);
      if (result) zip.file(result.fileName, result.blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const teacherData = await supabase.from('teachers').select('name').eq('id', teacherId).single();
    const teacherName = teacherData.data?.name.replace(/\s+/g, '_') || 'maestro';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `Oficios_${teacherName}_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error: any) {
    console.error('Error:', error);
    throw error;
  }
};

// ── Descargar todos los oficios de todos los maestros ────────────────────
export const downloadAllOficiosForAllTeachers = async (programId?: string): Promise<void> => {
  try {
    const { data: schedules, error } = await supabase
      .from('schedule')
      .select('teacher_id, teachers(id, name), subjects(program_id)');
    if (error) throw error;
    if (!schedules || schedules.length === 0) throw new Error('No hay maestros con horarios asignados');

    let filteredSchedules = schedules;
    if (programId)
      filteredSchedules = schedules.filter((s: any) => s.subjects?.program_id === programId);
    if (filteredSchedules.length === 0) throw new Error('No hay maestros con horarios asignados para este programa');

    const teacherIds = new Set<string>();
    filteredSchedules.forEach((s: any) => { if (s.teacher_id) teacherIds.add(s.teacher_id); });
    if (teacherIds.size === 0) throw new Error('No se encontraron maestros');

    const zip = new JSZip();
    let successCount = 0;
    for (const teacherId of Array.from(teacherIds)) {
      const result = await generateOficioBlob(teacherId, programId);
      if (result) { zip.file(result.fileName, result.blob); successCount++; }
    }
    if (successCount === 0) throw new Error('No se pudo generar ningún oficio');

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `Oficios_Todos_Maestros_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error: any) {
    console.error('Error:', error);
    throw error;
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PROGRAMAS LEIP (sabatinos / modulares)
// ════════════════════════════════════════════════════════════════════════════
// Diferencias clave respecto al oficio regular:
//   • NO se filtra por semestre "non" — se incluyen TODOS los grupos/módulos
//     asignados al maestro en el ciclo activo de tipo LEIP.
//   • La tabla usa columnas MÓDULO / ASIGNATURA / HORARIO Y DÍA / GRUPO
//     en vez de CLAVE / ASIGNATURA / HORARIO Y DÍA / SEM, ya que leip_subjects
//     no tiene "clave" y el concepto de "semestre" no aplica en LEIP.
//   • El nombre de la licenciatura se toma directamente de leip_programs.name
//     (ya viene completo, no se le antepone "LICENCIATURA EN").

const buildOficioLeipPdf = async (
  doc: jsPDF,
  teacherName: string,
  personalType: string,
  licenciaturaName: string,
  periodoText: string,
  tableRows: LeipScheduleRow[],
  bgImage: string | null
) => {
  renderOficio(
    doc,
    {
      teacherName,
      personalType,
      licenciaturaName,
      periodoText,
      dateStr: formatDateToSpanish(new Date()),
      spec: {
        head: ['MÓDULO', 'ASIGNATURA', 'HORARIO Y DÍA', 'GRUPO'],
        body: tableRows.map(r => [r.modulo, r.asignatura, r.horario, r.grupo]),
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 50, halign: 'center' },
          2: { cellWidth: 65 },
          3: { cellWidth: 20, halign: 'center' }
        },
      },
    },
    bgImage
  );
};

// ── Helper interno: obtiene y normaliza los datos de horario LEIP de un maestro ──
const fetchLeipScheduleData = async (teacherId: string, programId?: string) => {
  const { data: schedulesDataRaw, error: schedulesError } = await supabase
    .from('leip_schedule')
    .select(`
      day, start_hour, end_hour,
      leip_subjects (name, module_name, leip_program_id, leip_programs (name)),
      groups (name),
      school_cycles (start_date, end_date, is_active)
    `)
    .eq('teacher_id', teacherId)
    .order('day', { ascending: true });
  if (schedulesError) throw schedulesError;

  let schedulesData = schedulesDataRaw;
  if (programId && schedulesData)
    schedulesData = schedulesData.filter((s: any) => s.leip_subjects?.leip_program_id === programId);
  // En LEIP NO se filtra por semestre: se incluyen todos los grupos asignados,
  // solo se exige que el ciclo escolar esté activo.
  if (schedulesData)
    schedulesData = schedulesData.filter((s: any) => s.school_cycles?.is_active === true);

  return schedulesData;
};

// ── Función principal: genera y descarga el oficio LEIP de un maestro ────
export const generateOficioLeipFromTemplate = async (teacherId: string, programId?: string): Promise<void> => {
  try {
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

    const schedulesData = await fetchLeipScheduleData(teacherId, programId);
    if (!schedulesData || schedulesData.length === 0)
      throw new Error('El maestro no tiene horarios LEIP asignados en el ciclo activo');

    const licenciaturaName = ((schedulesData[0] as any).leip_subjects?.leip_programs?.name || 'LEIP').toUpperCase();

    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = 'del 21 de noviembre al 30 de enero del 2026';
    if (schoolCycle?.start_date && schoolCycle?.end_date) {
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const s = new Date(schoolCycle.start_date);
      const e = new Date(schoolCycle.end_date);
      periodoText = `del ${s.getUTCDate()} de ${months[s.getUTCMonth()]} al ${e.getUTCDate()} de ${months[e.getUTCMonth()]} del ${e.getUTCFullYear()}`;
    }

    const groupedMap = new Map<string, any>();
    schedulesData.forEach((s: any) => {
      const moduloLabel = s.leip_subjects?.module_name || s.leip_subjects?.name || 'N/D';
      const key = `${moduloLabel}_${s.groups?.name}_${s.leip_subjects?.name}`;
      if (!groupedMap.has(key))
        groupedMap.set(key, {
          modulo: moduloLabel,
          asignatura: s.leip_subjects?.name || 'N/D',
          grupo: s.groups?.name || 'N/D',
          schedules: [],
        });
      groupedMap.get(key)!.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });
    const tableRows: LeipScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      modulo: item.modulo, asignatura: item.asignatura,
      horario: item.schedules.join('\n'), grupo: item.grupo,
    }));

    const doc = new jsPDF({ format: 'letter' });
    let bgImage: string | null = null;
    try { bgImage = await loadImageAsBase64('/images/upnimg.jpg'); } catch { console.warn('No se pudo cargar imagen de fondo'); }

    await buildOficioLeipPdf(doc, teacherName, personalType, licenciaturaName, periodoText, tableRows, bgImage);
    doc.save(`Oficio_LEIP_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error: any) {
    console.error('Error generating oficio LEIP:', error);
    throw error;
  }
};

// ── Versión blob LEIP (para ZIP) ──────────────────────────────────────────
const generateOficioLeipBlob = async (teacherId: string, programId?: string): Promise<{ blob: Blob; fileName: string; teacherName: string } | null> => {
  try {
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

    const schedulesData = await fetchLeipScheduleData(teacherId, programId);
    if (!schedulesData || schedulesData.length === 0) {
      console.warn(`Maestro ${teacher.name} no tiene horarios LEIP en el ciclo activo`);
      return null;
    }

    const licenciaturaName = ((schedulesData[0] as any).leip_subjects?.leip_programs?.name || 'LEIP').toUpperCase();

    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = 'del 21 de noviembre al 30 de enero del 2026';
    if (schoolCycle?.start_date && schoolCycle?.end_date) {
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const s = new Date(schoolCycle.start_date);
      const e = new Date(schoolCycle.end_date);
      periodoText = `del ${s.getUTCDate()} de ${months[s.getUTCMonth()]} al ${e.getUTCDate()} de ${months[e.getUTCMonth()]} del ${e.getUTCFullYear()}`;
    }

    const groupedMap = new Map<string, any>();
    schedulesData.forEach((s: any) => {
      const moduloLabel = s.leip_subjects?.module_name || s.leip_subjects?.name || 'N/D';
      const key = `${moduloLabel}_${s.groups?.name}_${s.leip_subjects?.name}`;
      if (!groupedMap.has(key))
        groupedMap.set(key, {
          modulo: moduloLabel,
          asignatura: s.leip_subjects?.name || 'N/D',
          grupo: s.groups?.name || 'N/D',
          schedules: [],
        });
      groupedMap.get(key)!.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });
    const tableRows: LeipScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      modulo: item.modulo, asignatura: item.asignatura,
      horario: item.schedules.join('\n'), grupo: item.grupo,
    }));

    const doc = new jsPDF({ format: 'letter' });
    let bgImage: string | null = null;
    try { bgImage = await loadImageAsBase64('/images/upnimg.jpg'); } catch { console.warn('No se pudo cargar imagen de fondo'); }

    await buildOficioLeipPdf(doc, teacherName, personalType, licenciaturaName, periodoText, tableRows, bgImage);

    const blob = doc.output('blob');
    const fileName = `Oficio_LEIP_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    return { blob, fileName, teacherName: teacher.name };
  } catch (error: any) {
    console.error('Error generating oficio LEIP blob:', error);
    return null;
  }
};

// ── Descargar todos los oficios LEIP de un maestro (uno por programa LEIP) ──
export const downloadAllOficiosLeipForTeacher = async (teacherId: string): Promise<void> => {
  try {
    const { data: schedules, error } = await supabase
      .from('leip_schedule')
      .select('leip_subjects(leip_program_id, leip_programs(name))')
      .eq('teacher_id', teacherId);
    if (error) throw error;
    if (!schedules || schedules.length === 0) throw new Error('El maestro no tiene horarios LEIP asignados');

    const programIds = new Set<string>();
    schedules.forEach((s: any) => { if (s.leip_subjects?.leip_program_id) programIds.add(s.leip_subjects.leip_program_id); });
    if (programIds.size === 0) throw new Error('No se encontraron programas LEIP para este maestro');

    if (programIds.size === 1) {
      await generateOficioLeipFromTemplate(teacherId, Array.from(programIds)[0]);
      return;
    }

    const zip = new JSZip();
    for (const programId of Array.from(programIds)) {
      const result = await generateOficioLeipBlob(teacherId, programId);
      if (result) zip.file(result.fileName, result.blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const teacherData = await supabase.from('teachers').select('name').eq('id', teacherId).single();
    const teacherName = teacherData.data?.name.replace(/\s+/g, '_') || 'maestro';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `Oficios_LEIP_${teacherName}_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error: any) {
    console.error('Error:', error);
    throw error;
  }
};

// ── Descargar todos los oficios LEIP de todos los maestros (de un programa o de todos) ──
export const downloadAllOficiosLeipForAllTeachers = async (programId?: string): Promise<void> => {
  try {
    const { data: schedules, error } = await supabase
      .from('leip_schedule')
      .select('teacher_id, teachers(id, name), leip_subjects(leip_program_id)');
    if (error) throw error;
    if (!schedules || schedules.length === 0) throw new Error('No hay maestros con horarios LEIP asignados');

    let filteredSchedules = schedules;
    if (programId)
      filteredSchedules = schedules.filter((s: any) => s.leip_subjects?.leip_program_id === programId);
    if (filteredSchedules.length === 0) throw new Error('No hay maestros con horarios LEIP asignados para este programa');

    const teacherIds = new Set<string>();
    filteredSchedules.forEach((s: any) => { if (s.teacher_id) teacherIds.add(s.teacher_id); });
    if (teacherIds.size === 0) throw new Error('No se encontraron maestros');

    const zip = new JSZip();
    let successCount = 0;
    for (const teacherId of Array.from(teacherIds)) {
      const result = await generateOficioLeipBlob(teacherId, programId);
      if (result) { zip.file(result.fileName, result.blob); successCount++; }
    }
    if (successCount === 0) throw new Error('No se pudo generar ningún oficio LEIP');

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `Oficios_LEIP_Todos_Maestros_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error: any) {
    console.error('Error:', error);
    throw error;
  }
};