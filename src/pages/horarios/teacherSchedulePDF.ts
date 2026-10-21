// src/utils/teacherSchedulePDF.ts
// Genera el PDF de horario del docente al estilo del "Concentrado General 2026"

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TeacherScheduleRow {
  /** Nombre completo del docente */
  teacherName: string;
  /** Tipo de contrato: BASE | INVITADO */
  contractType: string;
  /** Nombre del programa educativo (licenciatura) */
  programName: string;
  /** Sede */
  sede: string;
  /** Nombre de la materia/asignatura */
  subjectName: string;
  /** Nombre del grupo (ej. "2A") */
  groupName: string;
  /** Horario por día: { Lunes: { start: 16, end: 18 }, Martes: ... } */
  daySchedules: Partial<Record<DayKey, { start: number; end: number }>>;
  /** Horas de esta asignatura (calculadas automáticamente si no se pasan) */
  hoursPerWeek?: number;
}

export type DayKey = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Formatea un rango de horas como "16:00-18:00" */
function fmtRange(start: number, end: number): string {
  return `${String(start).padStart(2, '0')}:00-${String(end).padStart(2, '0')}:00`;
}

/** Calcula las horas semanales sumando todos los días */
function calcHours(daySchedules: TeacherScheduleRow['daySchedules']): number {
  return Object.values(daySchedules).reduce((acc, d) => {
    if (d) return acc + (d.end - d.start);
    return acc;
  }, 0);
}

// ─── Colores ──────────────────────────────────────────────────────────────────

const COLORS = {
  headerBg: [0, 70, 127] as [number, number, number],       // Azul oscuro encabezado
  headerText: [255, 255, 255] as [number, number, number],   // Blanco
  rowBg1: [255, 255, 255] as [number, number, number],       // Blanco filas pares
  rowBg2: [240, 248, 255] as [number, number, number],       // Azul muy claro filas impares
  groupBg: [255, 250, 230] as [number, number, number],      // Amarillo claro bloque docente
  totalBg: [204, 229, 255] as [number, number, number],      // Azul claro total
  borderColor: [180, 180, 180] as [number, number, number],
  totalText: [0, 70, 127] as [number, number, number],
};

// ─── Ajustes de tamaño (cambia aquí si todavía necesitas reducir la letra) ────

const BODY_FONT_SIZE = 6.5;
const HEAD_FONT_SIZE = 6.5;
// Padding horizontal pequeño para que los horarios "16:00-18:00" no se partan
const CELL_PADDING = { top: 2, bottom: 2, left: 1, right: 1 };

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Genera un PDF con el horario completo del docente al estilo del concentrado general.
 *
 * @param teacherName  Nombre del docente
 * @param contractType 'BASE' | 'INVITADO'
 * @param rows         Filas de asignaturas del docente
 * @param cycleName    Nombre del ciclo escolar (ej. "2026-1")
 */
export function generateTeacherSchedulePDF(
  teacherName: string,
  contractType: string,
  rows: TeacherScheduleRow[],
  cycleName: string = ''
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  const DAYS: DayKey[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Ancho útil de la página (carta horizontal = 279.4 mm, menos márgenes de 10 mm)
  const MARGIN = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2; // ≈ 259.4 mm
  const centerX = pageWidth / 2;

  // ── Encabezado institucional ───────────────────────────────────────────────
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGIN, 8, contentWidth, 16, 'F');

  doc.setTextColor(...COLORS.headerText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CONCENTRADO DE CARGA ACADÉMICA', centerX, 15, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('BENEMÉRITA UNIVERSIDAD AUTÓNOMA DE PUEBLA', centerX, 21, { align: 'center' });

  // ── Bloque de datos del docente ────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(...COLORS.groupBg);
  doc.rect(MARGIN, 26, contentWidth, 10, 'F');
  doc.setDrawColor(...COLORS.borderColor);
  doc.rect(MARGIN, 26, contentWidth, 10, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`DOCENTE:`, 13, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(teacherName.toUpperCase(), 35, 32);

  doc.setFont('helvetica', 'bold');
  doc.text(`TIPO:`, 140, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(contractType.toUpperCase(), 153, 32);

  doc.setFont('helvetica', 'bold');
  doc.text(`CICLO:`, 190, 32);
  doc.setFont('helvetica', 'normal');
  doc.text(cycleName, 204, 32);

  // ── Calcular total de horas semanales del docente ─────────────────────────
  const totalHoursAll = rows.reduce((acc, row) => {
    const h = row.hoursPerWeek ?? calcHours(row.daySchedules);
    return acc + h;
  }, 0);

  // ── Construir cuerpo de la tabla ───────────────────────────────────────────
  // Columnas: Programa | Sede | Materia | Grupo | Lun | Mar | Mie | Jue | Vie | Sab | Hras/sem
  const head = [
    [
      { content: 'PROGRAMA EDUCATIVO', styles: { halign: 'center' as const } },
      { content: 'SEDE', styles: { halign: 'center' as const } },
      { content: 'MATERIA', styles: { halign: 'center' as const } },
      { content: 'GRUPO', styles: { halign: 'center' as const } },
      { content: 'LUNES', styles: { halign: 'center' as const } },
      { content: 'MARTES', styles: { halign: 'center' as const } },
      { content: 'MIÉRCOLES', styles: { halign: 'center' as const } },
      { content: 'JUEVES', styles: { halign: 'center' as const } },
      { content: 'VIERNES', styles: { halign: 'center' as const } },
      { content: 'SÁBADO', styles: { halign: 'center' as const } },
      { content: 'HRS/SEM', styles: { halign: 'center' as const } },
    ],
  ];

  const body: any[] = rows.map((row, idx) => {
    const hrs = row.hoursPerWeek ?? calcHours(row.daySchedules);
    return [
      { content: row.programName, styles: { fillColor: idx % 2 === 0 ? COLORS.rowBg1 : COLORS.rowBg2 } },
      { content: row.sede, styles: { halign: 'center', fillColor: idx % 2 === 0 ? COLORS.rowBg1 : COLORS.rowBg2 } },
      { content: row.subjectName, styles: { fillColor: idx % 2 === 0 ? COLORS.rowBg1 : COLORS.rowBg2 } },
      { content: row.groupName, styles: { halign: 'center', fillColor: idx % 2 === 0 ? COLORS.rowBg1 : COLORS.rowBg2 } },
      ...DAYS.map(day => {
        const d = row.daySchedules[day];
        return {
          content: d ? fmtRange(d.start, d.end) : '',
          styles: {
            halign: 'center',
            fillColor: d
              ? (idx % 2 === 0 ? [230, 245, 255] : [210, 235, 255])
              : (idx % 2 === 0 ? COLORS.rowBg1 : COLORS.rowBg2),
            textColor: d ? [0, 80, 160] : [160, 160, 160],
            fontStyle: d ? 'bold' : 'normal',
          } as any,
        };
      }),
      {
        content: `${hrs}h`,
        styles: {
          halign: 'center',
          fontStyle: 'bold',
          fillColor: COLORS.totalBg,
          textColor: COLORS.totalText,
        },
      },
    ];
  });

  // Fila de total
  body.push([
    {
      content: 'TOTAL HORAS SEMANALES',
      colSpan: 10,
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fillColor: COLORS.headerBg,
        textColor: COLORS.headerText,
      },
    },
    {
      content: `${totalHoursAll}h`,
      styles: {
        halign: 'center',
        fontStyle: 'bold',
        fillColor: [0, 120, 0],
        textColor: [255, 255, 255],
      },
    },
  ]);

  autoTable(doc, {
    startY: 38,
    head,
    body,
    theme: 'grid',
    styles: {
      overflow: 'linebreak',
      cellPadding: CELL_PADDING,
      valign: 'middle',
    },
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.headerText,
      fontStyle: 'bold',
      fontSize: HEAD_FONT_SIZE,
      halign: 'center',
      valign: 'middle',
      cellPadding: CELL_PADDING,
    },
    bodyStyles: {
      fontSize: BODY_FONT_SIZE,
      cellPadding: CELL_PADDING,
      valign: 'middle',
    },
    // Suma = 258 mm (cabe en los 259.4 mm útiles de la hoja)
    columnStyles: {
      0: { cellWidth: 34 },  // Programa
      1: { cellWidth: 18 },  // Sede
      2: { cellWidth: 56 },  // Materia
      3: { cellWidth: 14 },  // Grupo
      4: { cellWidth: 20 },  // Lunes
      5: { cellWidth: 20 },  // Martes
      6: { cellWidth: 20 },  // Miércoles
      7: { cellWidth: 20 },  // Jueves
      8: { cellWidth: 20 },  // Viernes
      9: { cellWidth: 20 },  // Sábado
      10: { cellWidth: 16 }, // Hrs/sem
    },
    margin: { left: MARGIN, right: MARGIN },
    tableLineColor: COLORS.borderColor,
    tableLineWidth: 0.1,
  });

  // ── Pie de página ──────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generado: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    MARGIN,
    finalY
  );
  doc.text('Documento generado automáticamente por el sistema de gestión académica', centerX, finalY, {
    align: 'center',
  });

  return doc;
}

/**
 * Descarga el PDF directamente en el navegador.
 */
export function downloadTeacherSchedulePDF(
  teacherName: string,
  contractType: string,
  rows: TeacherScheduleRow[],
  cycleName: string = ''
): void {
  const doc = generateTeacherSchedulePDF(teacherName, contractType, rows, cycleName);
  const safeName = teacherName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').replace(/\s+/g, '_');
  doc.save(`horario_${safeName}_${cycleName || 'ciclo'}.pdf`);
}