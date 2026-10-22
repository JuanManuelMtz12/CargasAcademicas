// src/utils/oficioCargaAcademicaPDF.ts
// Genera el oficio "ASIGNACIÓN DE CARGA ACADÉMICA" (hoja carta vertical).
//
// Diseño:
//  - Si pasas `letterheadImage` (membrete a página completa con logos, marca de agua,
//    dirección y greca), se dibuja como FONDO de cada página y el contenido se detiene
//    antes de la zona de abajo (`letterheadBottomMm`), para no encimarse con el texto del fondo.
//  - Si no pasas membrete, dibuja encabezado/pie con las imágenes sueltas.
//  - La firma se mide antes de dibujarla; si no cabe, pasa completa a otra página.

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

  // ── Opción A: membrete completo como fondo (recomendada) ──────────────────
  /** Imagen de página completa (data URL PNG/JPEG) con logos, marca de agua, dirección y greca. */
  letterheadImage?: string;
  /**
   * Alto (mm) de la zona inferior del membrete que el contenido NO debe tocar
   * (donde está la dirección y la greca). Por defecto 36 mm.
   * Si todavía se encima, súbelo (38, 40...); si sobra espacio, bájalo.
   */
  letterheadBottomMm?: number;
  /** Donde empieza el contenido (mm desde arriba), debajo de los logos. Por defecto 38. */
  letterheadTopMm?: number;

  // ── Opción B: piezas sueltas (se usan solo si no hay letterheadImage) ─────
  headerImage?: string;
  footerImage?: string;
  watermarkImage?: string;
  addressLine?: string;
  contactLine?: string;
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

/** Detecta PNG/JPEG a partir del data URL. */
function imgFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
}

// ─── Layout (todo en mm / pt) ─────────────────────────────────────────────────

const MARGIN_X = 20;
const LINE_H = 4.4;            // interlineado del texto
const BODY_SIZE = 9;           // pt
const TABLE_SIZE = 7;          // pt  ← baja a 6.5 si el texto de la tabla aún no cabe

// Espacios verticales (bájalos para ganar lugar, súbelos si se ve muy apretado)
const GAP_AFTER_DATE = 2;      // entre la fecha y el destinatario (× LINE_H)
const GAP_BEFORE_INTRO = 1.4;  // entre "P R E S E N T E" y el párrafo (× LINE_H)
const GAP_BEFORE_TABLE = 0.6;  // entre el párrafo y la tabla (× LINE_H)
const GAP_AFTER_TABLE = 5;     // mm entre la tabla y el párrafo de cierre
const GAP_BEFORE_SIGN = 1.4;   // entre el cierre y ATENTAMENTE (× LINE_H)
const SIGN_GAP = 9;            // mm de espacio para la firma entre el lema y el nombre

/** Dibuja un párrafo justificado (la última línea queda a la izquierda). */
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

  const hasLetterhead = !!data.letterheadImage;
  const TOP = hasLetterhead ? data.letterheadTopMm ?? 38 : 40;

  // Zona inferior que el contenido nunca debe invadir
  let footerImgH = 0;
  let footerImgW = 0;
  if (!hasLetterhead && data.footerImage) {
    const p = doc.getImageProperties(data.footerImage);
    footerImgW = pageW - 20;
    footerImgH = (p.height / p.width) * footerImgW;
  }
  const bottomReserve = hasLetterhead
    ? data.letterheadBottomMm ?? 36
    : footerImgH + 11 + 4;
  const footerTop = pageH - bottomReserve;
  const contentLimit = footerTop - 2;

  const address =
    data.addressLine ??
    'Calle Principal Ignacio Zaragoza s/n, Col. Maxtaco, Teziutlán, Pue. C.P 73820';
  const contact =
    data.contactLine ??
    'Tel. (231) 31 2 23 02 ext 101   upn212@seppue.gob.mx / sep.puebla.gob.mx';

  /** Fondo / encabezado / pie de la página ACTUAL. Se llama al crear cada página. */
  const drawDecor = () => {
    if (hasLetterhead) {
      doc.addImage(data.letterheadImage!, imgFormat(data.letterheadImage!), 0, 0, pageW, pageH);
      return;
    }
    if (data.watermarkImage) {
      const p = doc.getImageProperties(data.watermarkImage);
      const w = pageW * 0.8;
      const h = (p.height / p.width) * w;
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
      doc.addImage(
        data.watermarkImage,
        imgFormat(data.watermarkImage),
        (pageW - w) / 2,
        (pageH - h) / 2,
        w,
        h
      );
      doc.restoreGraphicsState();
    }
    if (data.headerImage) {
      const p = doc.getImageProperties(data.headerImage);
      const w = pageW - 30;
      const h = (p.height / p.width) * w;
      doc.addImage(data.headerImage, imgFormat(data.headerImage), 15, 8, w, Math.min(h, TOP - 12));
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(address, centerX, footerTop + 4, { align: 'center', maxWidth: contentW });
    doc.text(contact, centerX, footerTop + 8, { align: 'center', maxWidth: contentW });
    if (data.footerImage) {
      doc.addImage(
        data.footerImage,
        imgFormat(data.footerImage),
        10,
        pageH - footerImgH - 4,
        footerImgW,
        footerImgH
      );
    }
  };

  // Página 1
  drawDecor();

  let y = TOP;

  const ensureSpace = (h: number) => {
    if (y + h > contentLimit) {
      doc.addPage();
      drawDecor();
      y = TOP;
    }
  };

  // ── Asunto y fecha ────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_SIZE + 0.5);
  doc.text('ASUNTO: ASIGNACIÓN DE CARGA ACADÉMICA', pageW - MARGIN_X, y, { align: 'right' });
  y += LINE_H + 1.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE);
  const city = data.city ?? 'Teziutlán, Pue.';
  doc.text(`${city}, ${longDate(data.oficioDate ?? todayISO())}`, pageW - MARGIN_X, y, {
    align: 'right',
  });
  y += LINE_H * GAP_AFTER_DATE;

  // ── Destinatario ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.text(data.teacherName.toUpperCase(), MARGIN_X, y);
  y += LINE_H;
  doc.setFont('helvetica', 'normal');
  doc.text(data.contractLabel.toUpperCase(), MARGIN_X, y);
  y += LINE_H;
  doc.text(data.unitLabel.toUpperCase(), MARGIN_X, y);
  y += LINE_H;
  doc.setFont('helvetica', 'bold');
  doc.text('P R E S E N T E', MARGIN_X, y);
  y += LINE_H * GAP_BEFORE_INTRO;

  // ── Párrafo de apertura ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE - 0.5);
  const intro =
    `En virtud de reunir características académicas y profesionales específicas; ` +
    `se le ha asignado el siguiente curso en la ${data.programName.toUpperCase()}, ` +
    `que corresponde al periodo ${periodText(data.periodStart, data.periodEnd)}.`;
  y = drawJustified(doc, intro, MARGIN_X, y, contentW);
  y += LINE_H * GAP_BEFORE_TABLE;

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
      cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 },
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
    // Si la tabla salta de página, la página nueva también lleva el fondo
    didAddPage: () => {
      drawDecor();
    },
  });

  y = (doc as any).lastAutoTable.finalY + GAP_AFTER_TABLE;

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
  y += LINE_H * GAP_BEFORE_SIGN;

  // ── Bloque de firma (medido antes de dibujarlo) ───────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_SIZE - 0.5);
  const cargoLines: string[] = doc.splitTextToSize(data.director.title.toUpperCase(), contentW - 10);
  const signBlockH =
    LINE_H * 2 + 2 +            // ATENTAMENTE + lema
    SIGN_GAP +
    LINE_H +                    // nombre
    cargoLines.length * LINE_H; // cargo (1, 2 o más líneas)

  // Si no cabe antes de la zona del pie/fondo, el bloque completo pasa a otra página
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