import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

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

export const generateCalendarioAcademico = async (
  programId: string,
  cycleId: string,
  isLeipProgram: boolean = false
) => {
  try {
    // ── 1. Obtener información del programa ──────────────────────────────
    let programName = '';
    let coordinatorId: string | null = null;

    if (isLeipProgram) {
      const { data: rows, error } = await supabase
        .from('leip_programs')
        .select('name, coordinator_id')
        .eq('id', programId)
        .limit(1);
      if (error) throw error;
      if (!rows || rows.length === 0) throw new Error('Programa LEIP no encontrado');
      programName  = rows[0].name;
      coordinatorId = rows[0].coordinator_id;
    } else {
      const { data: rows, error } = await supabase
        .from('programs')
        .select('name, coordinator_id')
        .eq('id', programId)
        .limit(1);
      if (error) throw error;
      if (!rows || rows.length === 0) throw new Error('Programa no encontrado');
      programName  = rows[0].name;
      coordinatorId = rows[0].coordinator_id;
    }

    // ── 2. Obtener información del ciclo ─────────────────────────────────
    const { data: cycleRows, error: cycleError } = await supabase
      .from('school_cycles')
      .select('name, start_date, end_date')
      .eq('id', cycleId)
      .limit(1);
    if (cycleError) throw cycleError;
    if (!cycleRows || cycleRows.length === 0) throw new Error('Ciclo no encontrado');
    const cycle = cycleRows[0];

    // Formatear periodo con fechas
    const formatPeriodo = (startDate: string, endDate: string): string => {
      const meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      const start = new Date(startDate);
      const end   = new Date(endDate);
      return `del ${start.getDate()} de ${meses[start.getMonth()]} al ${end.getDate()} de ${meses[end.getMonth()]} del ${end.getFullYear()}`;
    };

    const periodoFormateado = formatPeriodo(cycle.start_date, cycle.end_date);

    // ── 3. Obtener coordinador ───────────────────────────────────────────
    let coordinatorName = 'N/D';
    if (coordinatorId) {
      const { data: teacherRows } = await supabase
        .from('teachers')
        .select('name')
        .eq('id', coordinatorId)
        .limit(1);
      if (teacherRows && teacherRows.length > 0) {
        coordinatorName = teacherRows[0].name;
      }
    }

    // ── 4. Obtener materias del programa ─────────────────────────────────
    let subjectIds: string[] = [];

    if (isLeipProgram) {
      const { data: subjects, error: subjectsError } = await supabase
        .from('leip_subjects')
        .select('id')
        .eq('leip_program_id', programId);
      if (subjectsError) throw subjectsError;
      if (!subjects || subjects.length === 0)
        throw new Error('El programa LEIP no tiene materias asignadas');
      subjectIds = subjects.map(s => s.id);
    } else {
      const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id')
        .eq('program_id', programId);
      if (subjectsError) throw subjectsError;
      if (!subjects || subjects.length === 0)
        throw new Error('El programa no tiene materias asignadas');
      subjectIds = subjects.map(s => s.id);
    }

    // ── 5. Obtener grupos únicos con horarios ────────────────────────────
    const scheduleTable = isLeipProgram ? 'leip_schedule' : 'schedule';
    const subjectFk     = isLeipProgram ? 'leip_subject_id' : 'subject_id';

    const { data: scheduleData, error: scheduleError } = await supabase
      .from(scheduleTable)
      .select('group_id, groups(id, name)')
      .in(subjectFk, subjectIds)
      .eq('school_cycle_id', cycleId);

    if (scheduleError) throw scheduleError;
    if (!scheduleData || scheduleData.length === 0)
      throw new Error('No hay horarios asignados para este programa y ciclo escolar');

    // Extraer grupos únicos
    const groupsMap = new Map<string, { id: string; name: string }>();
    scheduleData.forEach((item: any) => {
      const g = Array.isArray(item.groups) ? item.groups[0] : item.groups;
      if (g && !groupsMap.has(g.id)) {
        groupsMap.set(g.id, { id: g.id, name: g.name });
      }
    });

    const groups = Array.from(groupsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // ── 6. Para cada grupo, obtener sus horarios ─────────────────────────
    const groupsWithSchedules: GroupData[] = await Promise.all(
      groups.map(async (group) => {
        const selectFields = isLeipProgram
          ? `id, day, start_hour, end_hour, teachers(name), leip_subjects(name, id)`
          : `id, day, start_hour, end_hour, teachers(name), subjects(name, clave)`;

        const { data: schedules } = await supabase
          .from(scheduleTable)
          .select(selectFields)
          .eq('group_id', group.id)
          .eq('school_cycle_id', cycleId)
          .in(subjectFk, subjectIds);

        const schedulesBySubject: { [key: string]: ScheduleData } = {};

        schedules?.forEach((schedule: any) => {
          const subjectRaw = isLeipProgram
            ? (Array.isArray(schedule.leip_subjects) ? schedule.leip_subjects[0] : schedule.leip_subjects)
            : (Array.isArray(schedule.subjects)      ? schedule.subjects[0]      : schedule.subjects);

          const teacherRaw = Array.isArray(schedule.teachers)
            ? schedule.teachers[0]
            : schedule.teachers;

          if (!subjectRaw) return;

          const subjectName = subjectRaw.name || 'N/D';
          const subjectCode = isLeipProgram
            ? (subjectRaw.id?.slice(0, 6) || '-')
            : (subjectRaw.clave || '-');
          const teacherName = teacherRaw?.name || 'N/D';

          const key = `${subjectName}-${subjectCode}-${teacherName}`;
          if (!schedulesBySubject[key]) {
            schedulesBySubject[key] = {
              subject: subjectName,
              code: subjectCode,
              teacher: teacherName,
            };
          }

          const dayMap: Record<string, string> = {
            'Lunes': 'LUN', 'Martes': 'MAR', 'Miércoles': 'MIE',
            'Jueves': 'JUE', 'Viernes': 'VIE', 'Sábado': 'SAB',
          };
          const dayKey = dayMap[schedule.day];
          if (dayKey) {
            (schedulesBySubject[key] as any)[dayKey] =
              `${String(schedule.start_hour).padStart(2, '0')}:00-${String(schedule.end_hour).padStart(2, '0')}:00`;
          }
        });

        return {
          groupName: group.name,
          schedules: Object.values(schedulesBySubject),
        };
      })
    );

    // ── 7. Generar el PDF ────────────────────────────────────────────────
    await generatePDF({
      program: programName,
      cycle: periodoFormateado,
      coordinator: coordinatorName,
      groupsWithSchedules,
      isLeipProgram,
    });

  } catch (error) {
    console.error('Error generando calendario:', error);
    throw error;
  }
};

// ── Cargar imagen como base64 ──────────────────────────────────────────────────
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

// ── Generador de PDF ───────────────────────────────────────────────────────────
async function generatePDF({
  program,
  cycle,
  coordinator,
  groupsWithSchedules,
  isLeipProgram = false,
}: {
  program: string;
  cycle: string;
  coordinator: string;
  groupsWithSchedules: GroupData[];
  isLeipProgram?: boolean;
}) {
  const logoPueblaBase64 = await loadImageAsBase64('/logos/puebla.png');
  const logoUPNBase64    = await loadImageAsBase64('/logos/upn.png');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 10;

  // Logos
  if (logoPueblaBase64) doc.addImage(logoPueblaBase64, 'PNG', 15, yPosition, 46, 21);
  if (logoUPNBase64)    doc.addImage(logoUPNBase64, 'PNG', pageWidth - 40, yPosition, 25, 21);

  // Encabezado de texto
  const centerX = pageWidth / 2;
  let textY = yPosition + 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIVERSIDAD PEDAGÓGICA NACIONAL', centerX, textY, { align: 'center' }); textY += 5;
  doc.text('UNIDAD 212 TEZIUTLÁN, PUE.', centerX, textY, { align: 'center' }); textY += 5;
  doc.text('ASIGNACIÓN DE CARGAS ACADÉMICAS', centerX, textY, { align: 'center' }); textY += 6;
  doc.setFontSize(12);
  doc.text(`HORARIO POR GRUPO: ${program.toUpperCase()}`, centerX, textY, { align: 'center' });
  yPosition = textY + 10;

  // Tabla de información básica
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

  // Encabezados de días según tipo de programa
  const dayHeaders = isLeipProgram
    ? ['GRUPO', 'ASIGNATURA', 'CLAVE', 'ASESOR', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SÁB']
    : ['GRUPO', 'ASIGNATURA', 'CLAVE', 'ASESOR', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE'];

  // Tabla por grupo
  groupsWithSchedules.forEach((group, groupIndex) => {
    const scheduleRows: any[] = [];

    group.schedules.forEach((schedule, index) => {
      const dayValues = isLeipProgram
        ? [schedule.LUN || '', schedule.MAR || '', schedule.MIE || '',
           schedule.JUE || '', schedule.VIE || '', (schedule as any).SAB || '']
        : [schedule.LUN || '', schedule.MAR || '', schedule.MIE || '',
           schedule.JUE || '', schedule.VIE || ''];

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

    const colStyles: any = {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: isLeipProgram ? 55 : 60 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: isLeipProgram ? 45 : 50 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 22, halign: 'center' },
    };
    if (isLeipProgram) colStyles[9] = { cellWidth: 20, halign: 'center' };

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
      columnStyles: colStyles,
      margin: { left: 15, right: 15 },
    });

    yPosition = (doc as any).lastAutoTable.finalY;
    if (groupIndex < groupsWithSchedules.length - 1) yPosition += 5;
  });

  const fileName = `Calendario_Academico_${program.replace(/\s+/g, '_')}_${cycle.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}