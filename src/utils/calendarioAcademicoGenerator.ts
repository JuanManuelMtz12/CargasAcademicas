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
}

interface GroupData {
  groupName: string;
  schedules: ScheduleData[];
}

export const generateCalendarioAcademico = async (programId: string, cycleId: string) => {
  try {
    // Obtener información del programa
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('name, coordinator_id')
      .eq('id', programId)
      .single();

    if (programError) throw programError;

    // Obtener información del ciclo
    const { data: cycle, error: cycleError } = await supabase
      .from('school_cycles')
      .select('name, start_date, end_date')
      .eq('id', cycleId)
      .single();

    if (cycleError) throw cycleError;

    // Formatear periodo con fechas
    const formatPeriodo = (startDate: string, endDate: string): string => {
      const meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const startDay = start.getDate();
      const startMonth = meses[start.getMonth()];
      const endDay = end.getDate();
      const endMonth = meses[end.getMonth()];
      const endYear = end.getFullYear();
      
      return `del ${startDay} de ${startMonth} al ${endDay} de ${endMonth} del ${endYear}`;
    };
    
    const periodoFormateado = formatPeriodo(cycle.start_date, cycle.end_date);

    // Obtener coordinador del programa
    let coordinatorName = 'N/D';
    if (program.coordinator_id) {
      const { data: coordinatorData } = await supabase
        .from('teachers')
        .select('name')
        .eq('id', program.coordinator_id)
        .single();
      
      if (coordinatorData) {
        coordinatorName = coordinatorData.name;
      }
    }

    // Obtener los grupos del programa en este ciclo a través de la tabla schedule
    // 1. Primero obtenemos las materias del programa
    const { data: subjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('id')
      .eq('program_id', programId);

    if (subjectsError) throw subjectsError;
    if (!subjects || subjects.length === 0) {
      throw new Error('El programa no tiene materias asignadas');
    }

    const subjectIds = subjects.map(s => s.id);

    // 2. Obtener los grupos únicos que tienen horarios de estas materias en este ciclo
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('schedule')
      .select('group_id, groups(id, name)')
      .in('subject_id', subjectIds)
      .eq('school_cycle_id', cycleId);

    if (scheduleError) throw scheduleError;
    if (!scheduleData || scheduleData.length === 0) {
      throw new Error('No hay horarios asignados para este programa y ciclo escolar');
    }

    // 3. Extraer grupos únicos
    const groupsMap = new Map();
    scheduleData.forEach((item: any) => {
      if (item.groups && !groupsMap.has(item.groups.id)) {
        groupsMap.set(item.groups.id, {
          id: item.groups.id,
          name: item.groups.name
        });
      }
    });

    const groups = Array.from(groupsMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    // Para cada grupo, obtener sus horarios
    const groupsWithSchedules: GroupData[] = await Promise.all(
      groups.map(async (group) => {
        const { data: schedules } = await supabase
          .from('schedule')
          .select(`
            id,
            day,
            start_hour,
            end_hour,
            teachers (name),
            subjects (name, clave)
          `)
          .eq('group_id', group.id)
          .eq('school_cycle_id', cycleId)
          .in('subject_id', subjectIds);

        // Agrupar horarios por asignatura
        const schedulesBySubject: { [key: string]: ScheduleData } = {};
        
        schedules?.forEach((schedule: any) => {
          if (!schedule.subjects) return;
          
          const key = `${schedule.subjects.name}-${schedule.subjects.clave}-${schedule.teachers?.name || 'ND'}`;
          if (!schedulesBySubject[key]) {
            const teacherName = schedule.teachers?.name || 'N/D';
            
            schedulesBySubject[key] = {
              subject: schedule.subjects.name,
              code: schedule.subjects.clave,
              teacher: teacherName,
            };
          }
          
          // Convertir día a código
          const dayMap: { [key: string]: 'LUN' | 'MAR' | 'MIE' | 'JUE' | 'VIE' } = {
            'Lunes': 'LUN',
            'Martes': 'MAR',
            'Miércoles': 'MIE',
            'Jueves': 'JUE',
            'Viernes': 'VIE'
          };
          const dayKey = dayMap[schedule.day];
          if (dayKey) {
            schedulesBySubject[key][dayKey] = `${String(schedule.start_hour).padStart(2, '0')}:00-${String(schedule.end_hour).padStart(2, '0')}:00`;
          }
        });

        return {
          groupName: group.name,
          schedules: Object.values(schedulesBySubject)
        };
      })
    );

    // Debug: Imprimir datos antes de generar PDF
    console.log('=== DATOS PARA PDF ===');
    console.log('Programa:', program.name);
    console.log('Ciclo:', cycle.name);
    console.log('Coordinador:', coordinatorName);
    console.log('Grupos con horarios:', groupsWithSchedules);
    console.log('Cantidad de grupos:', groupsWithSchedules.length);
    groupsWithSchedules.forEach((g, i) => {
      console.log(`Grupo ${i}:`, g.groupName, '- Horarios:', g.schedules.length);
      console.log('Horarios detalle:', g.schedules);
    });

    // Generar el PDF
    await generatePDF({
      program: program.name,
      cycle: periodoFormateado,
      coordinator: coordinatorName,
      groupsWithSchedules
    });

  } catch (error) {
    console.error('Error generando calendario:', error);
    throw error;
  }
};

// Función auxiliar para cargar imagen y convertir a base64
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

async function generatePDF({
  program,
  cycle,
  coordinator,
  groupsWithSchedules
}: {
  program: string;
  cycle: string;
  coordinator: string;
  groupsWithSchedules: GroupData[];
}) {
  // Cargar logos
  const logoPueblaBase64 = await loadImageAsBase64('/logos/puebla.png');
  const logoUPNBase64 = await loadImageAsBase64('/logos/upn.png');

  // Crear documento PDF en formato horizontal (Letter)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 10;

  // NUEVO ENCABEZADO CON LOGOS Y TEXTO CENTRADO
  
  // Logo izquierdo - Gobierno de Puebla (aumentado ~30%: 35x16 → 46x21)
  if (logoPueblaBase64) {
    doc.addImage(logoPueblaBase64, 'PNG', 15, yPosition, 46, 21);
  }

  // Logo derecho - UPN (mantener proporción original 1200x1020 = 1.18:1)
  // Altura: 21mm, Ancho: 25mm (proporcional, aumentado ~30%)
  if (logoUPNBase64) {
    const upnHeight = 21;
    const upnWidth = 25;  // Proporcional a dimensiones originales 1200x1020
    doc.addImage(logoUPNBase64, 'PNG', pageWidth - 15 - upnWidth, yPosition, upnWidth, upnHeight);
  }

  // Bloque de texto central (4 líneas)
  const centerX = pageWidth / 2;
  let textY = yPosition + 7;  // Ajustado por logos más grandes

  // Línea 1
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIVERSIDAD PEDAGÓGICA NACIONAL', centerX, textY, { align: 'center' });
  textY += 5;

  // Línea 2
  doc.text('UNIDAD 212 TEZIUTLÁN, PUE.', centerX, textY, { align: 'center' });
  textY += 5;

  // Línea 3
  doc.text('ASIGNACIÓN DE CARGAS ACADÉMICAS', centerX, textY, { align: 'center' });
  textY += 6;

  // Línea 4 (más destacada)
  doc.setFontSize(12);
  doc.text(`HORARIO POR GRUPO: ${program.toUpperCase()}`, centerX, textY, { align: 'center' });
  
  yPosition = textY + 10;  // Espaciado aumentado por logos más grandes

  // TABLA DE INFORMACIÓN BÁSICA (según plantilla)
  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: [
      [
        'LICENCIATURA:',
        program.toUpperCase(),
        'PERIODO:',
        cycle.toUpperCase(),
        'PLAN:',
        'N/D'
      ],
      [
        'UNIDAD:',
        '212 TEZIUTLÁN',
        'COORDINADOR:',
        { content: coordinator.toUpperCase(), colSpan: 3 }
      ]
    ],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, fillColor: [28, 69, 135], textColor: [255, 255, 255] },  // Azul oscuro con texto blanco
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', cellWidth: 25, fillColor: [28, 69, 135], textColor: [255, 255, 255] },  // Azul oscuro con texto blanco
      3: { cellWidth: 55 },
      4: { fontStyle: 'bold', cellWidth: 20, fillColor: [28, 69, 135], textColor: [255, 255, 255] },  // Azul oscuro con texto blanco
      5: { cellWidth: 'auto' }
    },
    didDrawCell: (data: any) => {
      // Aplicar color azul a la celda COORDINADOR en fila 2, columna 2 (índice 1, 2)
      if (data.row.index === 1 && data.column.index === 2) {
        data.cell.styles.fillColor = [28, 69, 135];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 15, right: 15 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 6;

  // GENERAR UNA TABLA SEPARADA PARA CADA GRUPO (con su propio encabezado)
  groupsWithSchedules.forEach((group, groupIndex) => {
    // Crear las filas de este grupo
    const scheduleRows: any[] = [];
    
    group.schedules.forEach((schedule, index) => {
      if (index === 0) {
        // Primera fila del grupo: incluir el nombre del grupo con rowSpan
        scheduleRows.push([
          {
            content: group.groupName,
            rowSpan: group.schedules.length,
            styles: {
              halign: 'center',
              valign: 'middle',
              fontStyle: 'bold',
              fillColor: [28, 69, 135],
              textColor: [255, 255, 255]
            }
          },
          schedule.subject,
          schedule.code,
          schedule.teacher,
          schedule.LUN || '',
          schedule.MAR || '',
          schedule.MIE || '',
          schedule.JUE || '',
          schedule.VIE || ''
        ]);
      } else {
        // Filas subsiguientes del mismo grupo: no incluir el nombre del grupo (el rowSpan lo maneja)
        scheduleRows.push([
          schedule.subject,
          schedule.code,
          schedule.teacher,
          schedule.LUN || '',
          schedule.MAR || '',
          schedule.MIE || '',
          schedule.JUE || '',
          schedule.VIE || ''
        ]);
      }
    });

    // Generar tabla para este grupo
    autoTable(doc, {
      startY: yPosition,
      head: [['GRUPO', 'ASIGNATURA', 'CLAVE', 'ASESOR', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE']],
      body: scheduleRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [28, 69, 135],  // Azul oscuro como en la plantilla
        textColor: [255, 255, 255],  // Texto blanco
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },  // Grupo
        1: { cellWidth: 60 },  // Asignatura
        2: { cellWidth: 15, halign: 'center' },  // Clave
        3: { cellWidth: 50 },  // Asesor
        4: { cellWidth: 22, halign: 'center' },  // LUN
        5: { cellWidth: 22, halign: 'center' },  // MAR
        6: { cellWidth: 22, halign: 'center' },  // MIE
        7: { cellWidth: 22, halign: 'center' },  // JUE
        8: { cellWidth: 22, halign: 'center' }   // VIE
      },
      margin: { left: 15, right: 15 }
    });

    // Actualizar yPosition para la siguiente tabla y agregar espacio entre grupos
    yPosition = (doc as any).lastAutoTable.finalY;
    
    // Agregar espacio después de cada grupo (excepto el último)
    if (groupIndex < groupsWithSchedules.length - 1) {
      yPosition += 5;  // Espacio de 5mm entre grupos
    }
  });

  // Guardar el PDF
  const fileName = `Calendario_Academico_${program.replace(/\s+/g, '_')}_${cycle.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
