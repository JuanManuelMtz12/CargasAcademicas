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

// ── Control de espacio en la página ───────────────────────────────────────
// Límite vertical (mm) a partir del cual empieza el arte del pie de página
// (barra dorada con redes sociales y dirección) dentro de la imagen de fondo.
// Si el contenido pasa de aquí, se manda a una página nueva en vez de encimarse.
const FOOTER_SAFE_Y = 245;

// Altura estimada (mm) que ocupa el bloque ATENTAMENTE + frase + nombre + cargo.
const SIGNATURE_BLOCK_HEIGHT = 42;

const BG_SCALE = 0.97;
const BG_ORIGINAL_WIDTH = 215.9;
const BG_ORIGINAL_HEIGHT = 271.4;

const addBackgroundImage = (doc: jsPDF, bgImage: string) => {
  doc.addImage(
    bgImage,
    'JPEG',
    (BG_ORIGINAL_WIDTH - BG_ORIGINAL_WIDTH * BG_SCALE) / 2,
    8,
    BG_ORIGINAL_WIDTH * BG_SCALE,
    BG_ORIGINAL_HEIGHT * BG_SCALE
  );
};

// Si el contenido (closing + firma) no cabe antes del pie de página,
// agrega una página nueva con el mismo fondo y regresa la posición inicial segura.
const ensureSpaceForClosingBlock = (
  doc: jsPDF,
  currentY: number,
  closingLinesCount: number,
  bgImage: string | null
): number => {
  const requiredHeight = closingLinesCount * 6 + 15 + SIGNATURE_BLOCK_HEIGHT;
  if (currentY + requiredHeight <= FOOTER_SAFE_Y) return currentY;

  doc.addPage();
  if (bgImage) {
    try { addBackgroundImage(doc, bgImage); } catch { /* noop */ }
  }
  return 40;
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

const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`;
};

interface ScheduleRow {
  clave: string;
  asignatura: string;
  horario: string;
  semestre: string;
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
        day,
        start_hour,
        end_hour,
        subjects (clave, name, program_id, programs (name)),
        groups (name),
        school_cycles (start_date, end_date, is_active)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });

    if (schedulesError) throw schedulesError;

    let schedulesData = schedulesDataRaw;

    // Filtrar por programa
    if (programId && schedulesData) {
      schedulesData = schedulesData.filter((s: any) => s.subjects?.program_id === programId);
    }

    // ── FILTRO: solo ciclo activo y semestres nones (1,3,5,7) ──────────────
    if (schedulesData) {
      schedulesData = schedulesData.filter((s: any) => {
        const groupName: string = s.groups?.name || '';
        const isActive: boolean = s.school_cycles?.is_active === true;
        return isActive && isOddSemesterGroup(groupName);
      });
    }

    if (!schedulesData || schedulesData.length === 0) {
      throw new Error('El maestro no tiene horarios asignados en semestres nones del ciclo activo');
    }

    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;

    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = '';
    if (schoolCycle && schoolCycle.start_date && schoolCycle.end_date) {
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const startDate = new Date(schoolCycle.start_date);
      const endDate = new Date(schoolCycle.end_date);
      periodoText = `del ${startDate.getUTCDate()} de ${months[startDate.getUTCMonth()]} al ${endDate.getUTCDate()} de ${months[endDate.getUTCMonth()]} del ${endDate.getUTCFullYear()}`;
    } else {
      periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    }

    const groupedMap = new Map<string, any>();
    schedulesData.forEach((s: any) => {
      const key = `${s.subjects.clave}_${s.groups.name}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { clave: s.subjects.clave, asignatura: s.subjects.name, semestre: s.groups.name, schedules: [] });
      }
      groupedMap.get(key)!.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });

    const tableRows: ScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      clave: item.clave,
      asignatura: item.asignatura,
      horario: item.schedules.join('\n'),
      semestre: item.semestre,
    }));

    const doc = new jsPDF({ format: 'letter' });

    let bgImage: string | null = null;
    try {
      bgImage = await loadImageAsBase64('/images/upnimg.jpg');
      addBackgroundImage(doc, bgImage);
    } catch { console.warn('No se pudo cargar imagen de fondo'); }

    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 195, 35, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Teziutlán, Pue., ${formatDateToSpanish(new Date())}`, 195, 41, { align: 'right' });

    
    let yPos = 49;
    doc.setFont('helvetica', 'bold');
    doc.text(teacherName, 25, yPos); yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(personalType, 25, yPos); yPos += 5;
    doc.text('DE LA UPN-212 TEZIUTLÁN', 25, yPos); yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('P R E S E N T E', 25, yPos); yPos += 8;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const mainText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${licenciaturaName}, que corresponde al periodo ${periodoText}.`;
    const splitText = doc.splitTextToSize(mainText, 165);
    doc.text(splitText, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitText.length * 5 + 3;

    autoTable(doc, {
      startY: yPos,
      head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
      body: tableRows.map(r => [r.clave, r.asignatura, r.horario, r.semestre]),
      theme: 'grid',
      headStyles: { fillColor: [200,200,200], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', valign: 'middle', lineColor: [0,0,0], lineWidth: 0.5 },
      styles: { fontSize: 9, cellPadding: 3, lineColor: [0,0,0], lineWidth: 0.3, valign: 'middle' },
      columnStyles: { 0: { cellWidth: 22, halign: 'center' }, 1: { cellWidth: 55, halign: 'center' }, 2: { cellWidth: 70 }, 3: { cellWidth: 18, halign: 'center' } },
      margin: { left: 25, right: 25 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    const closingText = 'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';
    const splitClosing = doc.splitTextToSize(closingText, 165);

    // ── Si el cierre + firma no caben antes del pie de página, saltar a página nueva ──
    yPos = ensureSpaceForClosingBlock(doc, yPos, splitClosing.length, bgImage);

    doc.text(splitClosing, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitClosing.length * 6 + 15;

    doc.setFont('helvetica', 'bold');
    doc.text('ATENTAMENTE', 105, yPos, { align: 'center' }); yPos += 6;
    doc.text('"EDUCAR PARA TRANSFORMAR"', 105, yPos, { align: 'center' }); yPos += 15;
    doc.setFontSize(10);
    doc.text('DR. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, yPos, { align: 'center' }); yPos += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN', 105, yPos, { align: 'center' }); yPos += 4;
    doc.text('DE LA UNIVERSIDAD PEDAGÓGICA NACIONAL', 105, yPos, { align: 'center' });

    doc.save(`Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error: any) {
    console.error('Error generating oficio:', error);
    throw error;
  }
};

// ── Versión blob (para ZIP) ───────────────────────────────────────────────────

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
        day,
        start_hour,
        end_hour,
        subjects (clave, name, program_id, programs (name)),
        groups (name),
        school_cycles (start_date, end_date, is_active)
      `)
      .eq('teacher_id', teacherId)
      .order('day', { ascending: true });

    if (schedulesError) throw schedulesError;

    let schedulesData = schedulesDataRaw;

    if (programId && schedulesData) {
      schedulesData = schedulesData.filter((s: any) => s.subjects?.program_id === programId);
    }

    // ── FILTRO: solo ciclo activo y semestres nones (1,3,5,7) ──────────────
    if (schedulesData) {
      schedulesData = schedulesData.filter((s: any) => {
        const groupName: string = s.groups?.name || '';
        const isActive: boolean = s.school_cycles?.is_active === true;
        return isActive && isOddSemesterGroup(groupName);
      });
    }

    if (!schedulesData || schedulesData.length === 0) {
      console.warn(`Maestro ${teacher.name} no tiene horarios en semestres nones del ciclo activo`);
      return null;
    }

    const programName = (schedulesData[0] as any).subjects?.programs?.name || 'INTERVENCIÓN EDUCATIVA';
    const licenciaturaName = `LICENCIATURA EN ${programName.toUpperCase()}`;

    const schoolCycle = (schedulesData[0] as any).school_cycles;
    let periodoText = '';
    if (schoolCycle && schoolCycle.start_date && schoolCycle.end_date) {
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const startDate = new Date(schoolCycle.start_date);
      const endDate = new Date(schoolCycle.end_date);
      periodoText = `del ${startDate.getUTCDate()} de ${months[startDate.getUTCMonth()]} al ${endDate.getUTCDate()} de ${months[endDate.getUTCMonth()]} del ${endDate.getUTCFullYear()}`;
    } else {
      periodoText = 'del 11 de agosto al 5 de diciembre del 2025';
    }

    const groupedMap = new Map<string, any>();
    schedulesData.forEach((s: any) => {
      const key = `${s.subjects.clave}_${s.groups.name}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { clave: s.subjects.clave, asignatura: s.subjects.name, semestre: s.groups.name, schedules: [] });
      }
      groupedMap.get(key)!.schedules.push(`${s.day} De ${formatHour(s.start_hour)} a ${formatHour(s.end_hour)}`);
    });

    const tableRows: ScheduleRow[] = Array.from(groupedMap.values()).map(item => ({
      clave: item.clave,
      asignatura: item.asignatura,
      horario: item.schedules.join('\n'),
      semestre: item.semestre,
    }));

    const doc = new jsPDF({ format: 'letter' });

    let bgImage: string | null = null;
    try {
      bgImage = await loadImageAsBase64('/images/upnimg.jpg');
      addBackgroundImage(doc, bgImage);
    } catch { console.warn('No se pudo cargar imagen de fondo'); }

    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', 195, 35, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Teziutlán, Pue., ${formatDateToSpanish(new Date())}`, 195, 41, { align: 'right' });

    let yPos = 49;
    doc.setFont('helvetica', 'bold');
    doc.text(teacherName, 25, yPos); yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(personalType, 25, yPos); yPos += 5;
    doc.text('DE LA UPN-212 TEZIUTLÁN', 25, yPos); yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('P R E S E N T E', 25, yPos); yPos += 8;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const mainText = `En virtud de reunir características académicas y profesionales específicas; se le ha asignado el siguiente curso en la ${licenciaturaName}, que corresponde al periodo ${periodoText}.`;
    const splitText = doc.splitTextToSize(mainText, 165);
    doc.text(splitText, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitText.length * 5 + 3;

    autoTable(doc, {
      startY: yPos,
      head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
      body: tableRows.map(r => [r.clave, r.asignatura, r.horario, r.semestre]),
      theme: 'grid',
      headStyles: { fillColor: [200,200,200], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', valign: 'middle', lineColor: [0,0,0], lineWidth: 0.5 },
      styles: { fontSize: 9, cellPadding: 3, lineColor: [0,0,0], lineWidth: 0.3, valign: 'middle' },
      columnStyles: { 0: { cellWidth: 22, halign: 'center' }, 1: { cellWidth: 55, halign: 'center' }, 2: { cellWidth: 70 }, 3: { cellWidth: 18, halign: 'center' } },
      margin: { left: 25, right: 25 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    const closingText = 'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así como la vida institucional de nuestra universidad.';
    const splitClosing = doc.splitTextToSize(closingText, 165);

    // ── Si el cierre + firma no caben antes del pie de página, saltar a página nueva ──
    yPos = ensureSpaceForClosingBlock(doc, yPos, splitClosing.length, bgImage);

    doc.text(splitClosing, 25, yPos, { align: 'justify', maxWidth: 165 });
    yPos += splitClosing.length * 6 + 15;

    doc.setFont('helvetica', 'bold');
    doc.text('ATENTAMENTE', 105, yPos, { align: 'center' }); yPos += 6;
    doc.text('"EDUCAR PARA TRANSFORMAR"', 105, yPos, { align: 'center' }); yPos += 15;
    doc.setFontSize(10);
    doc.text('DR. JUAN IGNACIO HERNÁNDEZ VÁZQUEZ', 105, yPos, { align: 'center' }); yPos += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('DIRECTOR DE LA UNIDAD UPN 212 TEZIUTLÁN', 105, yPos, { align: 'center' }); yPos += 4;
    doc.text('DE LA UNIVERSIDAD PEDAGÓGICA NACIONAL', 105, yPos, { align: 'center' });

    const blob = doc.output('blob');
    const fileName = `Oficio_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    return { blob, fileName, teacherName: teacher.name };
  } catch (error: any) {
    console.error('Error generating oficio blob:', error);
    return null;
  }
};

// ── Descargar todos los oficios de un maestro ─────────────────────────────────

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

// ── Descargar todos los oficios de todos los maestros ────────────────────────

export const downloadAllOficiosForAllTeachers = async (programId?: string): Promise<void> => {
  try {
    const { data: schedules, error } = await supabase
      .from('schedule')
      .select('teacher_id, teachers(id, name), subjects(program_id)');

    if (error) throw error;
    if (!schedules || schedules.length === 0) throw new Error('No hay maestros con horarios asignados');

    let filteredSchedules = schedules;
    if (programId) {
      filteredSchedules = schedules.filter((s: any) => s.subjects?.program_id === programId);
    }
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