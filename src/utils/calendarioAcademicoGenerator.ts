import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

// ════════════════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════════════════

interface ScheduleData {
  subject: string;
  code: string;
  teacher: string;
  LUN?: string;
  MAR?: string;
  MIE?: string;
  JUE?: string;
  VIE?: string;
  SAB?: string;
}

interface GroupData {
  groupName: string;
  schedules: ScheduleData[];
}

interface LeipModuleRow {
  materia: string;
  modulo: string;
  grupo: string;
  sede: string;
  asesor: string;
  inicio: string; // ya formateada: "25 de julio"
  termino: string; // ya formateada: "26 de septiembre"
}

// ════════════════════════════════════════════════════════════════════════════
// Punto de entrada
// ════════════════════════════════════════════════════════════════════════════

export const generateCalendarioAcademico = async (
  programId: string,
  cycleId: string,
  isLeipProgram: boolean = false
) => {
  try {
    if (isLeipProgram) {
      await generateLeipCalendario(programId, cycleId);
    } else {
      await generateRegularCalendario(programId, cycleId);
    }
  } catch (error) {
    console.error('Error generando calendario:', error);
    throw error;
  }
};

// ════════════════════════════════════════════════════════════════════════════
// Utilidades compartidas
// ════════════════════════════════════════════════════════════════════════════

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatPeriodo(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `del ${start.getDate()} de ${MESES[start.getMonth()]} al ${end.getDate()} de ${MESES[end.getMonth()]} del ${end.getFullYear()}`;
}

function formatFechaCorta(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/D';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/D';
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

async function loadImageAsBase64(path: string): Promise<string> {
  try {
    const response = await fetch(path);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error cargando imagen:', path, error);
    return '';
  }
}

function addHeaderLogosAndTitle(
  doc: jsPDF,
  logoPueblaBase64: string,
  logoUPNBase64: string,
  titleLine3: string,
  titleLine4: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 10;

  if (logoPueblaBase64) doc.addImage(logoPueblaBase64, 'PNG', 15, yPosition, 46, 21);
  if (logoUPNBase64) doc.addImage(logoUPNBase64, 'PNG', pageWidth - 40, yPosition, 25, 21);

  const centerX = pageWidth / 2;
  let textY = yPosition + 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIVERSIDAD PEDAGÓGICA NACIONAL', centerX, textY, { align: 'center' }); textY += 5;
  doc.text('UNIDAD 212 TEZIUTLÁN, PUE.', centerX, textY, { align: 'center' }); textY += 5;
  doc.text(titleLine3, centerX, textY, { align: 'center' }); textY += 6;
  doc.setFontSize(12);
  doc.text(titleLine4, centerX, textY, { align: 'center' });

  return textY + 10;
}

// ════════════════════════════════════════════════════════════════════════════
// LEIP — Cruce de Módulos por Grupo
// ════════════════════════════════════════════════════════════════════════════

async function generateLeipCalendario(programId: string, cycleId: string) {
  // ── 1. Programa ──────────────────────────────────────────────────────
  const { data: progRows, error: progError } = await supabase
    .from('leip_programs')
    .select('name, coordinator_id')
    .eq('id', programId)
    .limit(1);
  if (progError) throw progError;
  if (!progRows || progRows.length === 0) throw new Error('Programa LEIP no encontrado');
  const programName = progRows[0].name;
  const coordinatorId = progRows[0].coordinator_id;

  // ── 2. Ciclo escolar ─────────────────────────────────────────────────
  const { data: cycleRows, error: cycleError } = await supabase
    .from('school_cycles')
    .select('name, start_date, end_date')
    .eq('id', cycleId)
    .limit(1);
  if (cycleError) throw cycleError;
  if (!cycleRows || cycleRows.length === 0) throw new Error('Ciclo no encontrado');
  const periodoFormateado = formatPeriodo(cycleRows[0].start_date, cycleRows[0].end_date);

  // ── 3. Coordinador ───────────────────────────────────────────────────
  let coordinatorName = 'N/D';
  if (coordinatorId) {
    const { data: teacherRows } = await supabase
      .from('teachers')
      .select('name')
      .eq('id', coordinatorId)
      .limit(1);
    if (teacherRows && teacherRows.length > 0) coordinatorName = teacherRows[0].name;
  }

  // ── 4. Grupos del programa ───────────────────────────────────────────
  const { data: groupRows, error: groupError } = await supabase
    .from('groups')
    .select('id, name, sede:sede_id(name)')
    .eq('leip_program_id', programId)
    .order('name');
  if (groupError) throw groupError;
  if (!groupRows || groupRows.length === 0)
    throw new Error('El programa LEIP no tiene grupos asignados');

  const groups = groupRows.map((g: any) => ({
    id: g.id,
    name: g.name,
    sede: (Array.isArray(g.sede) ? g.sede[0]?.name : g.sede?.name) || 'N/D',
  }));

  // ── 5. Módulos (materias) del programa ───────────────────────────────
  const { data: subjectRows, error: subjectError } = await supabase
    .from('leip_subjects')
    .select('id, name, module_name, start_date, end_date')
    .eq('leip_program_id', programId)
    .order('start_date');
  if (subjectError) throw subjectError;
  if (!subjectRows || subjectRows.length === 0)
    throw new Error('El programa LEIP no tiene módulos asignados');

  const subjects = subjectRows;
  const subjectIds = subjects.map(s => s.id);
  const groupIds = groups.map(g => g.id);

  // ── 6. Maestros asignados por grupo+módulo (vía leip_schedule) ───────
  const { data: scheduleRows, error: scheduleError } = await supabase
    .from('leip_schedule')
    .select('group_id, leip_subject_id, teacher:teachers(name)')
    .eq('school_cycle_id', cycleId)
    .in('group_id', groupIds)
    .in('leip_subject_id', subjectIds);
  if (scheduleError) throw scheduleError;

  const teacherMap = new Map<string, string>();
  (scheduleRows || []).forEach((row: any) => {
    const key = `${row.group_id}-${row.leip_subject_id}`;
    if (!teacherMap.has(key)) {
      const teacherRaw = Array.isArray(row.teacher) ? row.teacher[0] : row.teacher;
      if (teacherRaw?.name) teacherMap.set(key, teacherRaw.name);
    }
  });

  // ── 7. Cruce total: cada módulo x cada grupo ─────────────────────────
  const rows: LeipModuleRow[] = [];
  subjects.forEach(subject => {
    groups.forEach(group => {
      const key = `${group.id}-${subject.id}`;
      const teacherName = teacherMap.get(key) || 'PENDIENTE';
      rows.push({
        materia: subject.name,
        modulo: subject.module_name || subject.name,
        grupo: group.name,
        sede: group.sede,
        asesor: teacherName,
        inicio: formatFechaCorta(subject.start_date),
        termino: formatFechaCorta(subject.end_date),
      });
    });
  });

  await generateLeipPDF({
    program: programName,
    cycle: periodoFormateado,
    coordinator: coordinatorName,
    rows,
  });
}

async function generateLeipPDF({
  program,
  cycle,
  coordinator,
  rows,
}: {
  program: string;
  cycle: string;
  coordinator: string;
  rows: LeipModuleRow[];
}) {
  const logoPueblaBase64 = await loadImageAsBase64('/logos/puebla.png');
  const logoUPNBase64 = await loadImageAsBase64('/logos/upn.png');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  let yPosition = addHeaderLogosAndTitle(
    doc,
    logoPueblaBase64,
    logoUPNBase64,
    'ASIGNACIÓN DE CARGAS ACADÉMICAS',
    `PROGRAMA: ${program.toUpperCase()}`
  );

  // Tabla de información básica (LICENCIATURA / PLAN / PERIODO + UNIDAD / COORDINADOR)
  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: [
      ['LICENCIATURA:', program.toUpperCase(), 'PLAN:', 'MODULAR', 'PERIODO:', cycle.toUpperCase()],
      ['UNIDAD:', '212 TEZIUTLÁN\nSEDES REGIONALES', 'COORDINADOR:', { content: coordinator.toUpperCase(), colSpan: 3 }],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28, fillColor: [28, 69, 135], textColor: [255, 255, 255] },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 18, fillColor: [28, 69, 135], textColor: [255, 255, 255] },
      3: { cellWidth: 25 },
      4: { fontStyle: 'bold', cellWidth: 22, fillColor: [28, 69, 135], textColor: [255, 255, 255] },
      5: { cellWidth: 'auto' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === 1 && data.column.index === 2) {
        data.cell.styles.fillColor = [28, 69, 135];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 15, right: 15 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 6;

  // ── Tabla principal: MATERIA (merged por módulo) / MÓDULO / ASESOR / INICIO / TÉRMINO ──
  const body: any[] = [];
  let i = 0;
  while (i < rows.length) {
    const materia = rows[i].materia;
    // contar cuántas filas consecutivas comparten la misma materia (mismo módulo)
    let span = 1;
    while (i + span < rows.length && rows[i + span].materia === materia) span++;

    for (let j = 0; j < span; j++) {
      const r = rows[i + j];
      const moduloCell = `${r.modulo}\nGRUPO "${r.grupo}"\n${r.sede.toUpperCase()}`;

      if (j === 0) {
        body.push([
          {
            content: materia.toUpperCase(),
            rowSpan: span,
            styles: {
              halign: 'center', valign: 'middle', fontStyle: 'bold',
              fillColor: [28, 69, 135], textColor: [255, 255, 255],
            },
          },
          moduloCell,
          r.asesor.toUpperCase(),
          r.inicio,
          r.termino,
        ]);
      } else {
        body.push([moduloCell, r.asesor.toUpperCase(), r.inicio, r.termino]);
      }
    }
    i += span;
  }

  autoTable(doc, {
    startY: yPosition,
    head: [['MATERIA', 'MÓDULO', 'ASESOR', 'INICIO DE MÓDULO', 'TÉRMINO DE MÓDULO']],
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
    headStyles: {
      fillColor: [28, 69, 135], textColor: [255, 255, 255],
      fontStyle: 'bold', halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 50 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
    },
    margin: { left: 15, right: 15 },
  });

  const fileName = `Calendario_Academico_${program.replace(/\s+/g, '_')}_${cycle.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

// ════════════════════════════════════════════════════════════════════════════
// Programas regulares — Horario por Grupo (LUN-VIE)
// ════════════════════════════════════════════════════════════════════════════

async function generateRegularCalendario(programId: string, cycleId: string) {
  // ── 1. Programa ──────────────────────────────────────────────────────
  const { data: rows, error } = await supabase
    .from('programs')
    .select('name, coordinator_id')
    .eq('id', programId)
    .limit(1);
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error('Programa no encontrado');
  const programName = rows[0].name;
  const coordinatorId = rows[0].coordinator_id;

  // ── 2. Ciclo ─────────────────────────────────────────────────────────
  const { data: cycleRows, error: cycleError } = await supabase
    .from('school_cycles')
    .select('name, start_date, end_date')
    .eq('id', cycleId)
    .limit(1);
  if (cycleError) throw cycleError;
  if (!cycleRows || cycleRows.length === 0) throw new Error('Ciclo no encontrado');
  const periodoFormateado = formatPeriodo(cycleRows[0].start_date, cycleRows[0].end_date);

  // ── 3. Coordinador ───────────────────────────────────────────────────
  let coordinatorName = 'N/D';
  if (coordinatorId) {
    const { data: teacherRows } = await supabase
      .from('teachers')
      .select('name')
      .eq('id', coordinatorId)
      .limit(1);
    if (teacherRows && teacherRows.length > 0) coordinatorName = teacherRows[0].name;
  }

  // ── 4. Materias del programa ──────────────────────────────────────────
  const { data: subjects, error: subjectsError } = await supabase
    .from('subjects')
    .select('id')
    .eq('program_id', programId);
  if (subjectsError) throw subjectsError;
  if (!subjects || subjects.length === 0)
    throw new Error('El programa no tiene materias asignadas');
  const subjectIds = subjects.map(s => s.id);

  // ── 5. Grupos únicos con horarios ─────────────────────────────────────
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('schedule')
    .select('group_id, groups(id, name)')
    .in('subject_id', subjectIds)
    .eq('school_cycle_id', cycleId);
  if (scheduleError) throw scheduleError;
  if (!scheduleData || scheduleData.length === 0)
    throw new Error('No hay horarios asignados para este programa y ciclo escolar');

  const groupsMap = new Map<string, { id: string; name: string }>();
  scheduleData.forEach((item: any) => {
    const g = Array.isArray(item.groups) ? item.groups[0] : item.groups;
    if (g && !groupsMap.has(g.id)) groupsMap.set(g.id, { id: g.id, name: g.name });
  });
  const groups = Array.from(groupsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // ── 6. Horarios por grupo ─────────────────────────────────────────────
  const groupsWithSchedules: GroupData[] = await Promise.all(
    groups.map(async (group) => {
      const { data: schedules } = await supabase
        .from('schedule')
        .select(`id, day, start_hour, end_hour, teachers(name), subjects(name, clave)`)
        .eq('group_id', group.id)
        .eq('school_cycle_id', cycleId)
        .in('subject_id', subjectIds);

      const schedulesBySubject: { [key: string]: ScheduleData } = {};

      schedules?.forEach((schedule: any) => {
        const subjectRaw = Array.isArray(schedule.subjects) ? schedule.subjects[0] : schedule.subjects;
        const teacherRaw = Array.isArray(schedule.teachers) ? schedule.teachers[0] : schedule.teachers;
        if (!subjectRaw) return;

        const subjectName = subjectRaw.name || 'N/D';
        const subjectCode = subjectRaw.clave || '-';
        const teacherName = teacherRaw?.name || 'N/D';

        const key = `${subjectName}-${subjectCode}-${teacherName}`;
        if (!schedulesBySubject[key]) {
          schedulesBySubject[key] = { subject: subjectName, code: subjectCode, teacher: teacherName };
        }

        const dayMap: Record<string, string> = {
          'Lunes': 'LUN', 'Martes': 'MAR', 'Miércoles': 'MIE', 'Jueves': 'JUE', 'Viernes': 'VIE',
        };
        const dayKey = dayMap[schedule.day];
        if (dayKey) {
          (schedulesBySubject[key] as any)[dayKey] =
            `${String(schedule.start_hour).padStart(2, '0')}:00-${String(schedule.end_hour).padStart(2, '0')}:00`;
        }
      });

      return { groupName: group.name, schedules: Object.values(schedulesBySubject) };
    })
  );

  await generateRegularPDF({
    program: programName,
    cycle: periodoFormateado,
    coordinator: coordinatorName,
    groupsWithSchedules,
  });
}

async function generateRegularPDF({
  program,
  cycle,
  coordinator,
  groupsWithSchedules,
}: {
  program: string;
  cycle: string;
  coordinator: string;
  groupsWithSchedules: GroupData[];
}) {
  const logoPueblaBase64 = await loadImageAsBase64('/logos/puebla.png');
  const logoUPNBase64 = await loadImageAsBase64('/logos/upn.png');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  let yPosition = addHeaderLogosAndTitle(
    doc,
    logoPueblaBase64,
    logoUPNBase64,
    'ASIGNACIÓN DE CARGAS ACADÉMICAS',
    `HORARIO POR GRUPO: ${program.toUpperCase()}`
  );

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: [
      ['LICENCIATURA:', program.toUpperCase(), 'PERIODO:', cycle.toUpperCase(), 'PLAN:', 'N/D'],
      ['UNIDAD:', '212 TEZIUTLÁN', 'COORDINADOR:', { content: coordinator.toUpperCase(), colSpan: 3 }],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, fillColor: [28, 69, 135], textColor: [255, 255, 255] },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', cellWidth: 25, fillColor: [28, 69, 135], textColor: [255, 255, 255] },
      3: { cellWidth: 55 },
      4: { fontStyle: 'bold', cellWidth: 20, fillColor: [28, 69, 135], textColor: [255, 255, 255] },
      5: { cellWidth: 'auto' },
    },
    didDrawCell: (data: any) => {
      if (data.row.index === 1 && data.column.index === 2) {
        data.cell.styles.fillColor = [28, 69, 135];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 15, right: 15 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 6;

  const dayHeaders = ['GRUPO', 'ASIGNATURA', 'CLAVE', 'ASESOR', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE'];

  groupsWithSchedules.forEach((group, groupIndex) => {
    const scheduleRows: any[] = [];

    group.schedules.forEach((schedule, index) => {
      const dayValues = [
        schedule.LUN || '', schedule.MAR || '', schedule.MIE || '',
        schedule.JUE || '', schedule.VIE || '',
      ];

      if (index === 0) {
        scheduleRows.push([
          {
            content: group.groupName,
            rowSpan: group.schedules.length,
            styles: {
              halign: 'center', valign: 'middle', fontStyle: 'bold',
              fillColor: [28, 69, 135], textColor: [255, 255, 255],
            },
          },
          schedule.subject, schedule.code, schedule.teacher,
          ...dayValues,
        ]);
      } else {
        scheduleRows.push([schedule.subject, schedule.code, schedule.teacher, ...dayValues]);
      }
    });

    autoTable(doc, {
      startY: yPosition,
      head: [dayHeaders],
      body: scheduleRows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: {
        fillColor: [28, 69, 135], textColor: [255, 255, 255],
        fontStyle: 'bold', halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 60 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 50 },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 22, halign: 'center' },
        7: { cellWidth: 22, halign: 'center' },
        8: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });

    yPosition = (doc as any).lastAutoTable.finalY;
    if (groupIndex < groupsWithSchedules.length - 1) yPosition += 5;
  });

  const fileName = `Calendario_Academico_${program.replace(/\s+/g, '_')}_${cycle.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}