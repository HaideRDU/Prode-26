import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RoomClosureReport } from './buildRoomClosureReport'

const MARGIN = 14
const PAGE_W = 210
const CONTENT_W = PAGE_W - MARGIN * 2

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, '').replace(/\s+/g, '-').slice(0, 48)
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed > pageH - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

export function downloadRoomClosurePdf(report: RoomClosureReport): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Acta de cierre de predicciones', MARGIN, y)
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const intro = [
    `Sala: ${report.roomName}`,
    report.roomDescription?.trim() ? `Descripción: ${report.roomDescription.trim()}` : null,
    `Cierre del plazo de edición: ${report.lockLabel}`,
    `Participantes registrados: ${report.participantsRegistered}`,
    `Jugadores en clasificación: ${report.standingsCount}`,
    `Documento generado: ${report.generatedAtLabel}`,
  ].filter(Boolean) as string[]

  for (const line of intro) {
    y = ensureSpace(doc, y, 6)
    const wrapped = doc.splitTextToSize(line, CONTENT_W)
    doc.text(wrapped, MARGIN, y)
    y += wrapped.length * 4.5 + 1
  }

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  y = ensureSpace(doc, y, 8)
  doc.text('Bolsa de premios', MARGIN, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const prizes = report.podiumPrizes
  const prizeLines = prizes
    ? [
        `1.er lugar: ${prizes.first?.trim() || 'Sin premio registrado'}`,
        `2.º lugar: ${prizes.second?.trim() || 'Sin premio registrado'}`,
        `3.er lugar: ${prizes.third?.trim() || 'Sin premio registrado'}`,
        `Base de participantes: ${report.participantsRegistered} usuario(s) registrado(s) en la sala al momento del acta.`,
      ]
    : [
        'Sala sin premios de podio configurados.',
        `Participantes registrados: ${report.participantsRegistered}.`,
      ]

  for (const line of prizeLines) {
    y = ensureSpace(doc, y, 6)
    const wrapped = doc.splitTextToSize(line, CONTENT_W)
    doc.text(wrapped, MARGIN, y)
    y += wrapped.length * 4.5 + 1
  }

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  y = ensureSpace(doc, y, 8)
  doc.text('Resumen de participantes', MARGIN, y)
  y += 2

  autoTable(doc, {
    startY: y + 4,
    margin: { left: MARGIN, right: MARGIN },
    head: [['#', 'Jugador', 'Pts']],
    body: report.participants.map((p) => [String(p.rank), p.displayName, String(p.points)]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 120] },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20
  y += 8

  for (const participant of report.participants) {
    y = ensureSpace(doc, y, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`#${participant.rank} · ${participant.displayName} (${participant.points} pts)`, MARGIN, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    y = ensureSpace(doc, y, 6)
    doc.text('Podio y especiales', MARGIN, y)
    y += 2

    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Pregunta', 'Predicción']],
      body: [
        ...participant.extras.map((e) => [e.label, e.value]),
        ...participant.bonusQuestions.map((q) => [q.label, q.value]),
      ],
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 'auto' } },
    })

    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 10
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    y = ensureSpace(doc, y, 6)
    doc.text('Partidos y jugador bonus', MARGIN, y)
    y += 2

    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGIN, right: MARGIN },
      head: [['#', 'Partido', 'Marcador', 'Jugador bonus']],
      body: participant.matchRows.map((r) => [
        String(r.matchNum),
        r.matchup,
        r.prediction,
        r.playerBonus,
      ]),
      styles: { fontSize: 6.5, cellPadding: 1.2 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 58 },
        2: { cellWidth: 22 },
        3: { cellWidth: 'auto' },
      },
    })

    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 10
    y += 10
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100)
    const footer = `SHA-256 acta: ${report.contentHash} · Pág. ${i}/${pageCount}`
    const lines = doc.splitTextToSize(footer, CONTENT_W)
    doc.text(lines, MARGIN, doc.internal.pageSize.getHeight() - 6)
    doc.setTextColor(0)
  }

  const filename = `acta-cierre-${sanitizeFilename(report.roomName)}.pdf`
  doc.save(filename)
}
