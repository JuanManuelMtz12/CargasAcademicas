// src/utils/concentradoExcel.ts
// Genera el Excel "Concentrado General" al estilo de la imagen usando SheetJS + xlsx-style

import * as XLSX from 'xlsx';

export interface ConcentradoRow {
  teacherName: string;
  programName: string;
  contractType: string;   // BASE | INVITADO
  sede: string;
  subjectName: string;
  groupName: string;
  daySchedules: Partial<Record<'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado', { start: number; end: number }>>;
  hoursPerSubject: number;
  totalHoursTeacher?: number; // total del docente (solo en primera fila del bloque)
  additionalActivities?: string;
}

function fmtHour(start: number, end: number) {
  return `${String(start).padStart(2,'0')}:00-${String(end).padStart(2,'0')}:00`;
}

/**
 * Genera y descarga el concentrado en formato Excel (.xlsx)
 * @param rows  Filas ya procesadas del concentrado
 * @param title Título del archivo (ej. "Concentrado General 2026")
 */
export function downloadConcentradoExcel(rows: ConcentradoRow[], title = 'Concentrado General') {
  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];

  // ── Fila de encabezados ──────────────────────────────────────────────────
  const COLS = [
    'NOMBRE',
    'PROGRAMA EDUCATIVO',
    'TIPO DE CONTRATO',
    'SEDE',
    'MATERIA',
    'GRUPO',
    'LUNES',
    'MARTES',
    'MIÉRCOLES',
    'JUEVES',
    'VIERNES',
    'SÁBADO',
    'HORAS/SEM',
    'TOTAL',
    'ACTIVIDADES ADICIONALES',
  ];
  wsData.push(COLS);

  // ── Filas de datos ───────────────────────────────────────────────────────
  rows.forEach(row => {
    const days: ('Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado')[] =
      ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    wsData.push([
      row.teacherName,
      row.programName,
      row.contractType,
      row.sede,
      row.subjectName,
      row.groupName,
      ...days.map(d => {
        const s = row.daySchedules[d];
        return s ? fmtHour(s.start, s.end) : '';
      }),
      row.hoursPerSubject,
      row.totalHoursTeacher ?? '',
      row.additionalActivities ?? '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ── Anchos de columna ────────────────────────────────────────────────────
  ws['!cols'] = [
    { wch: 28 }, // NOMBRE
    { wch: 22 }, // PROGRAMA
    { wch: 14 }, // CONTRATO
    { wch: 12 }, // SEDE
    { wch: 40 }, // MATERIA
    { wch: 7  }, // GRUPO
    { wch: 13 }, // LUN
    { wch: 13 }, // MAR
    { wch: 13 }, // MIE
    { wch: 13 }, // JUE
    { wch: 13 }, // VIE
    { wch: 13 }, // SAB
    { wch: 10 }, // HRS/SEM
    { wch: 7  }, // TOTAL
    { wch: 25 }, // ACTIVIDADES
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Concentrado General');
  XLSX.writeFile(wb, `${title}.xlsx`);
}