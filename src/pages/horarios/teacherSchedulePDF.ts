// src/utils/oficioCargaAcademicaPDF.ts
// Genera el oficio "ASIGNACIÓN DE CARGA ACADÉMICA" (hoja carta vertical).
//
// Diferencias clave frente a un layout con posiciones fijas:
//  - La firma y el pie se colocan según donde termina el contenido (no con números fijos).
//  - El cargo del director se parte en líneas medidas, así nunca se encima con la dirección.
//  - Si la firma no cabe antes del pie, pasa automáticamente a una página nueva.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OficioScheduleSlot {
  /** Día de la semana, ej. "jueves" o "Jueves" */
  day: string;
  /** Hora de inicio, ej. "10:00" */
  start: string;
  /** Hora de fin, ej. "12:00" */
  end: string;
}

export interface OficioSubject {
  /** Clave de la asignatura, ej. "5284" */
  key: string;
  /** Nombre de la asignatura */
  name: string;
  /** Horarios por día */
  schedule: OficioScheduleSlot[];
  /** Semestre y grupo, ej. "3B" */
  semester: string;
}

export interface OficioData {
  /** Ej. "MTRA. NALLELY YENITZA ROMERO SALAZAR" */
  teacherName: string;
  /** Ej. "PERSONAL DOCENTE INVITADO" */
  contractLabel: string;
  /** Ej. "DE LA UPN-212 TEZIUTLÁN" */
  unitLabel: string;
  /** Ej. "LICENCIATURA EN INTERVENCIÓN EDUCATIVA" */
  programName: string;
  /** Fecha de inicio del periodo (YYYY-MM-DD) */
  periodStart: string;
  /** Fecha de fin del periodo (YYYY-MM-DD) */
  periodEnd: string;
  /** Fecha del oficio (YYYY-MM-DD). Por defecto, hoy. */
  oficioDate?: string;
  /** Ciudad del oficio. Por defecto "Teziutlán, Pue." */
  city?: string;
  subjects: OficioSubject[];
  director: {
    name: string;
    /** Cargo completo; se parte solo en las líneas necesarias */
    title: string;
  };
  /** Línea(s) del pie: dirección. */
  addressLine?: string;
  /** Línea del pie: teléfono y correo. */
  contactLine?: string;
  /** Imagen de encabezado (data URL PNG/JPEG) con los logos. Opcional. */
  headerImage?: string;
  /** Imagen de pie (data URL PNG/JPEG) con la greca. Opcional. */
  footerImage?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

function longDate(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return `${d} de ${MONTHS[m]} de ${y}`;
}

function periodText(startISO: string, endISO: string): string {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (s.y === e.y) {
    return `del ${s.d} de ${MONTHS[s.m]} al ${e.d} de ${MONTHS[e.m]} del ${e.y}`;
  }
  return `del ${s.d} de ${MONTHS[s.m]} del ${s.y} al ${e.d} de ${MONTHS[e.m]} del ${e.y}`;
}

function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function formatSlot(s: OficioScheduleSlot): string {
  return `${cap(s.day)} De ${s.start} a ${s.end}`;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const MARGIN_X = 20;           // mm
const TOP = 40;                // inicio del contenido (debajo del encabezado)
const LINE_H = 4.6;            // interlineado del texto, mm
const BODY_SIZE = 9;           // pt
const TABLE_SIZE = 7.5;        // pt  ← baja a 7 o 6.5 si el texto de la tabla aún no cabe

/** Dibuja un párrafo justificado (la última línea queda alineada a la izquierda). */
function drawJustified(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number
): number {
  const lines: string[] = doc.splitTextToSize(text, width);
  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    if (isLast || !line.includes(' ')) {
      doc.text(line, x, y);
    } else {
      doc.text(line, x, y, { align: 'justify', maxWidth: width });
    }
    y += LINE_H;
  });
  return y;
}

// ─── Función principal ────────────────────────────────────────────────────────

export function generateOficioCargaAcademicaPDF(data: OficioData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();   // 215.9
  const pageH = doc.internal.pageSize.getHeight();  // 279.4
  const contentW = pageW - MARGIN_X * 2;
  const centerX = pageW / 2;

  // Alto reservado al pie (imagen de greca + 2 líneas de dirección/contacto)
  let footerImgH = 0;
  let footerImgW = 0;
  if (data.footerImage) {
    const p = doc.getImageProperties(data.footerImage);
    footerImgW = pageW - 20;
    footerImgH = (p.height / p.width) * footerImgW;
  }
  const footerTextH = 11;                                 // 2 líneas de texto + aire
  const bottomReserve = footerImgH + footerTextH + 4;
  const footerTop = pageH - bottomReserve;                // el contenido nunca pasa de aquí
  const contentLimit = footerTop - 3;

  let y = TOP;

  const ensureSpace = (h: number) => {
    if (y + h > contentLimit) {
      doc.addPage();
      y = TOP;
    }
  };

  // ── Asunto y fecha ────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_SIZE + 0.5);
  doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', pageW - MARGIN_X, y, { align: 'right' });
  y += LINE_H + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE);
  const city = data.city ?? 'Teziutlán, Pue.';
  doc.text(`${city}, ${longDate(data.oficioDate ?? todayISO())}`, pageW - MARGIN_X, y, {
    align: 'right',
  });
  y += LINE_H * 2.5;

  // ── Destinatario ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.text(data.teacherName.toUpperCase(), MARGIN_X, y);
  y += LINE_H;
  doc.setFont('helvetica', 'normal');
  doc.text(data.contractLabel.toUpperCase(), MARGIN_X, y);
  y += LINE_H;
  doc.text(data.unitLabel.toUpperCase(), MARGIN_X, y);
  y += LINE_H * 1.4;
  doc.setFont('helvetica', 'bold');
  doc.text('P R E S E N T E', MARGIN_X, y);
  y += LINE_H * 2;

  // ── Párrafo de apertura ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE - 0.5);
  const intro =
    `En virtud de reunir características académicas y profesionales específicas; ` +
    `se le ha asignado el siguiente curso en la ${data.programName.toUpperCase()}, ` +
    `que corresponde al periodo ${periodText(data.periodStart, data.periodEnd)}.`;
  y = drawJustified(doc, intro, MARGIN_X, y, contentW);
  y += LINE_H;

  // ── Tabla de asignaturas ──────────────────────────────────────────────────
  const body = data.subjects.map((s) => [
    s.key,
    s.name.toUpperCase(),
    s.schedule.map(formatSlot).join('\n'),
    s.semester,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['CLAVE', 'ASIGNATURA', 'HORARIO Y DÍA', 'SEM']],
    body,
    theme: 'grid',
    margin: { left: MARGIN_X, right: MARGIN_X, top: TOP, bottom: bottomReserve + 2 },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_SIZE,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
      lineColor: [90, 90, 90],
      lineWidth: 0.2,
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [225, 225, 225],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: TABLE_SIZE + 0.5,
    },
    // Suma = contentW (175.9 mm)
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 68 },
      2: { cellWidth: 66 },
      3: { cellWidth: contentW - 22 - 68 - 66 },
    },
    rowPageBreak: 'avoid',
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Párrafo de cierre ─────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE - 0.5);
  const closing =
    'Deseándole el mayor de los éxitos en el desempeño de esta tarea, aprovecho la oportunidad ' +
    'para invitarle a que, en el ejercicio de sus funciones, ponga lo mejor de su esfuerzo y ' +
    'dedicación al servicio de la Universidad Pedagógica Nacional Unidad 212 Teziutlán, siguiendo ' +
    'las indicaciones institucionales, estableciendo comunicación permanente con su coordinador(a) ' +
    'y apoyando en las diversas actividades que fortalecen la formación de nuestros alumnos, así ' +
    'como la vida institucional de nuestra universidad.';
  const closingLines: string[] = doc.splitTextToSize(closing, contentW);
  ensureSpace(closingLines.length * LINE_H + 4);
  y = drawJustified(doc, closing, MARGIN_X, y, contentW);
  y += LINE_H * 2;

  // ── Bloque de firma (medido antes de dibujar) ─────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_SIZE - 0.5);
  const cargoLines: string[] = doc.splitTextToSize(data.director.title.toUpperCase(), contentW - 10);
  const SIGN_GAP = 12;                                    // espacio para la firma
  const signBlockH =
    LINE_H * 2 + 2 +            // ATENTAMENTE + lema
    SIGN_GAP +
    LINE_H +                    // nombre
    cargoLines.length * LINE_H; // cargo (1, 2 o más líneas)

  // Si no cabe antes del pie, el bloque completo pasa a otra página
  ensureSpace(signBlockH);

  doc.setFontSize(BODY_SIZE);
  doc.text('ATENTAMENTE', centerX, y, { align: 'center' });
  y += LINE_H;
  doc.text('"EDUCAR PARA TRANSFORMAR"', centerX, y, { align: 'center' });
  y += LINE_H + 2 + SIGN_GAP;

  doc.setFontSize(BODY_SIZE - 0.5);
  doc.text(data.director.name.toUpperCase(), centerX, y, { align: 'center' });
  y += LINE_H;
  cargoLines.forEach((line) => {
    doc.text(line, centerX, y, { align: 'center' });
    y += LINE_H;
  });

  // ── Encabezado y pie en TODAS las páginas ─────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  const address =
    data.addressLine ??
    'Calle Principal Ignacio Zaragoza s/n, Col. Maxtaco, Teziutlán, Pue. C.P 73820';
  const contact =
    data.contactLine ??
    'Tel. (231) 31 2 23 02 ext 101   upn212@seppue.gob.mx / sep.puebla.gob.mx';

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (data.headerImage) {
      const p = doc.getImageProperties(data.headerImage);
      const w = pageW - 30;
      const h = (p.height / p.width) * w;
      doc.addImage(data.headerImage, 'PNG', 15, 8, w, Math.min(h, TOP - 12));
    }

    // Texto del pie, siempre en la zona reservada (nunca choca con la firma)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    const fy = footerTop + 4;
    doc.text(address, centerX, fy, { align: 'center', maxWidth: contentW });
    doc.text(contact, centerX, fy + 4, { align: 'center', maxWidth: contentW });

    if (data.footerImage) {
      doc.addImage(data.footerImage, 'PNG', 10, pageH - footerImgH - 4, footerImgW, footerImgH);
    }
  }

  return doc;
}

/** Descarga el oficio directamente en el navegador. */
export function downloadOficioCargaAcademicaPDF(data: OficioData): void {
  const doc = generateOficioCargaAcademicaPDF(data);
  const safe = data.teacherName
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '')
    .replace(/\s+/g, '_');
  doc.save(`oficio_carga_${safe}.pdf`);
}