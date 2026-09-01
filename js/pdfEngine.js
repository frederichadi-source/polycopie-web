// Polycopié — Web
// Port fidèle de HandoutGenerator.swift (macOS) vers pdf-lib. La géométrie est portée
// telle quelle : le système de coordonnées PDF (origine en bas à gauche, Y vers le haut)
// est le même des deux côtés, donc chaque CGRect/calcul se traduit directement.

import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import { resolvedGrid, resolvedPageSize } from "./store.js";

export class HandoutError extends Error {
  constructor(key) {
    super(key);
    this.key = key; // clé i18n correspondante (voir i18n.js)
  }
}

const MIN_NOTES_WIDTH = 100;
const MIN_NOTES_HEIGHT = 50;
const GRAY_BORDER = rgb(0.6, 0.6, 0.6);
const GRAY_LINES = rgb(0.75, 0.75, 0.75);
const GRAY_LABEL = rgb(0.45, 0.45, 0.45);
const WHITE = rgb(1, 1, 1);

/** Rectangle simple {x, y, width, height} — équivalent maison de CGRect. */
function inset(rect, dx, dy) {
  return { x: rect.x + dx, y: rect.y + dy, width: rect.width - 2 * dx, height: rect.height - 2 * dy };
}

/** "Aspect fit" centré de `aspect` à l'intérieur de `outer` (équivalent de
 * getDrawingTransform(..., preserveAspectRatio: true)). */
function fitAspect(outer, aspect) {
  const outerAspect = outer.width / outer.height;
  if (aspect > outerAspect) {
    const width = outer.width;
    const height = width / aspect;
    return { x: outer.x, y: outer.y + (outer.height - height) / 2, width, height };
  }
  const height = outer.height;
  const width = height * aspect;
  return { x: outer.x + (outer.width - width) / 2, y: outer.y, width, height };
}

/** Port direct de `HandoutGenerator.layout(for:style:slideAspectRatio:slideScale:)`. */
function layoutCell(cell, style, aspectRatio, slideScale) {
  const scale = Math.min(Math.max(slideScale, 0.35), 1.0);

  if (style === "none") {
    return { slide: cell, notesRects: [] };
  }

  if (style === "linesBelow") {
    const gap = 8;
    const widthConstrainedHeight = cell.width / aspectRatio;
    const maxSlideHeight = cell.height * 0.75;
    const slideHeight = Math.min(widthConstrainedHeight, maxSlideHeight) * scale;
    const slideWidth = slideHeight * aspectRatio;
    const slide = { x: cell.x + (cell.width - slideWidth) / 2, y: cell.y + cell.height - slideHeight, width: slideWidth, height: slideHeight };
    const notesHeight = cell.height - slideHeight - gap;
    if (notesHeight < MIN_NOTES_HEIGHT) return { slide, notesRects: [] };
    return { slide, notesRects: [{ x: cell.x, y: cell.y, width: cell.width, height: notesHeight }] };
  }

  if (style === "linesBeside") {
    const gap = 12;
    const heightConstrainedWidth = cell.height * aspectRatio;
    const maxSlideWidth = cell.width * 0.75;
    const slideWidth = Math.min(heightConstrainedWidth, maxSlideWidth) * scale;
    const slideHeight = slideWidth / aspectRatio;
    const slide = { x: cell.x, y: cell.y + (cell.height - slideHeight) / 2, width: slideWidth, height: slideHeight };
    const notesWidth = cell.width - slideWidth - gap;
    if (notesWidth < MIN_NOTES_WIDTH) return { slide, notesRects: [] };
    return { slide, notesRects: [{ x: cell.x + slideWidth + gap, y: cell.y, width: notesWidth, height: cell.height }] };
  }

  // linesAround
  const gap = 10;
  const fitWidth = Math.min(cell.width, cell.height * aspectRatio);
  const fitHeight = fitWidth / aspectRatio;
  const slideWidth = fitWidth * scale;
  const slideHeight = fitHeight * scale;
  const slide = { x: cell.x, y: cell.y + cell.height - slideHeight, width: slideWidth, height: slideHeight };
  const notesRects = [];
  const rightWidth = cell.x + cell.width - (slide.x + slide.width) - gap;
  if (rightWidth >= MIN_NOTES_WIDTH) {
    notesRects.push({ x: slide.x + slide.width + gap, y: cell.y, width: rightWidth, height: cell.height });
  }
  const belowHeight = slide.y - cell.y - gap;
  if (belowHeight >= MIN_NOTES_HEIGHT) {
    notesRects.push({ x: cell.x, y: cell.y, width: cell.width, height: belowHeight });
  }
  return { slide, notesRects };
}

/** Découpe `text` en lignes qui tiennent dans `maxWidth`, à la manière d'un retour à la
 * ligne automatique (pas de gestion de césure de mots, comme NSAttributedString). */
function wrapText(text, font, fontSize, maxWidth) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Port de `drawWrappedText` : texte multi-lignes aligné et éventuellement centré
 * verticalement dans `rect`. */
function drawWrappedText(page, text, rect, font, fontSize, alignment, color, opacity, verticallyCentered) {
  if (rect.width <= 0 || rect.height <= 0) return;
  const lineHeight = fontSize * 1.25;
  const lines = wrapText(text, font, fontSize, rect.width);

  let y = verticallyCentered
    ? rect.y + rect.height / 2 + Math.min(lines.length * lineHeight, rect.height) / 2 - lineHeight
    : rect.y + rect.height - lineHeight;

  for (const line of lines) {
    if (y < rect.y - lineHeight) break;
    if (line !== "") {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      let x = rect.x;
      if (alignment === "center") x = rect.x + (rect.width - lineWidth) / 2;
      else if (alignment === "right") x = rect.x + rect.width - lineWidth;
      page.drawText(line, { x, y, size: fontSize, font, color, opacity });
    }
    y -= lineHeight;
  }
}

/** Port de `drawSlide` : cadre fin autour de `rect`, diapositive source dessinée en
 * "aspect fit" centré à l'intérieur, numéro de diapositive optionnel juste au-dessus. */
function drawSlideOnPage(page, embeddedPage, rect, showNumber, number, labelFont) {
  page.drawRectangle({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, borderColor: GRAY_BORDER, borderWidth: 0.75 });
  const fitted = fitAspect(rect, embeddedPage.width / embeddedPage.height);
  page.drawPage(embeddedPage, { x: fitted.x, y: fitted.y, width: fitted.width, height: fitted.height });
  if (showNumber) {
    page.drawText(String(number), { x: rect.x + 2, y: rect.y + rect.height + 2, size: 8, font: labelFont, color: GRAY_LABEL });
  }
}

/** Port de `drawNoteLines` : lignes horizontales ancrées sur la grille globale de la page
 * (`gridOriginY`), pour que deux zones adjacentes s'alignent parfaitement. */
function drawNoteLines(page, rect, spacing, gridOriginY) {
  if (rect.width <= 0 || rect.height <= 0 || spacing <= 0) return;
  let step = 0;
  while (true) {
    const y = gridOriginY - spacing * (step + 1);
    if (y < rect.y) break;
    if (y <= rect.y + rect.height) {
      page.drawLine({ start: { x: rect.x, y }, end: { x: rect.x + rect.width, y }, thickness: 0.5, color: GRAY_LINES });
    }
    step++;
  }
}

function drawPageNumber(page, number, pageSize, font) {
  const text = String(number);
  const width = font.widthOfTextAtSize(text, 9);
  page.drawText(text, { x: pageSize.width / 2 - width / 2, y: 12, size: 9, font, color: GRAY_LABEL });
}

/** Port de `drawTitlePage`. */
function drawTitlePage(page, embeddedSlide, aspectRatio, options, contentRect, titleFont, labelFont) {
  const text = options.titlePageText.trim();
  const fontSize = options.titlePageFontSize;
  const color = rgb(options.titlePageFontColor.r, options.titlePageFontColor.g, options.titlePageFontColor.b);
  const opacity = options.titlePageFontColor.a;
  const alignment = options.titlePageTextAlignment;

  if (!embeddedSlide) {
    if (!text) return;
    drawWrappedText(page, text, contentRect, titleFont, fontSize, alignment, color, opacity, true);
    return;
  }

  const textGap = 24;
  const textBlockHeight = text ? 100 : 0;
  const slideAreaHeight = contentRect.height - textBlockHeight - (text ? textGap : 0);
  const widthConstrainedHeight = contentRect.width / aspectRatio;
  const slideHeight = Math.min(widthConstrainedHeight, slideAreaHeight * 0.85, slideAreaHeight);
  const slideWidth = Math.min(slideHeight * aspectRatio, contentRect.width);
  const resolvedSlideHeight = slideWidth / aspectRatio;
  const slideY = options.titlePageTextPosition === "aboveSlide" ? contentRect.y : contentRect.y + contentRect.height - resolvedSlideHeight;
  const slideRect = { x: contentRect.x + (contentRect.width - slideWidth) / 2, y: slideY, width: slideWidth, height: resolvedSlideHeight };

  drawSlideOnPage(page, embeddedSlide, slideRect, false, 1, labelFont);
  if (!text) return;

  let textRect;
  if (options.titlePageTextPosition === "belowSlide") {
    textRect = { x: contentRect.x, y: contentRect.y, width: contentRect.width, height: slideRect.y - contentRect.y - textGap };
  } else {
    const slideTop = slideRect.y + slideRect.height;
    textRect = { x: contentRect.x, y: slideTop + textGap, width: contentRect.width, height: contentRect.y + contentRect.height - slideTop - textGap };
  }
  drawWrappedText(page, text, textRect, titleFont, fontSize, alignment, color, opacity, false);
}

/** Choisit puis embarque la police standard PDF la plus proche du choix de l'utilisateur.
 * pdf-lib ne dispose que des 14 polices standard : Georgia n'existe pas nativement, on
 * retombe sur une police serif (Times), comme le fait la version macOS quand une police
 * nommée n'est pas installée. */
async function embedTitleFont(pdfDoc, options) {
  const bold = options.titlePageFontWeight === "bold";
  const italic = options.titlePageFontItalic;
  const pick = (regular, boldF, italicF, boldItalicF) => {
    if (bold && italic) return boldItalicF;
    if (bold) return boldF;
    if (italic) return italicF;
    return regular;
  };
  let std;
  switch (options.titlePageFont) {
    case "serif":
    case "georgia":
      std = pick(StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic);
      break;
    case "courier":
      std = pick(StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique);
      break;
    default: // system, helvetica
      std = pick(StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique);
  }
  return pdfDoc.embedFont(std);
}

/**
 * Génère le PDF de polycopié à partir des octets du PDF source et des réglages.
 * @param {Uint8Array} sourceBytes
 * @param {object} options
 * @param {(pagesDone: number) => void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function generateHandout(sourceBytes, options, onProgress) {
  let srcDoc;
  try {
    srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  } catch {
    throw new HandoutError("Impossible d'ouvrir le PDF source.");
  }

  const pageCount = srcDoc.getPageCount();
  if (pageCount === 0) throw new HandoutError("Le PDF source ne contient aucune page.");

  const outDoc = await PDFDocument.create();
  const indices = Array.from({ length: pageCount }, (_, i) => i);
  const embeddedPages = await outDoc.embedPdf(srcDoc, indices);

  const aspectRatio = embeddedPages[0].width / embeddedPages[0].height || 4 / 3;
  const pageSize = resolvedPageSize(options);
  const { columns, rows } = resolvedGrid(options);
  const slotsPerPage = columns * rows;
  const margin = options.marginPoints;
  const footerReserve = options.showPageNumbers ? 18 : 0;
  const contentRect = {
    x: margin,
    y: margin + footerReserve,
    width: pageSize.width - 2 * margin,
    height: pageSize.height - 2 * margin - footerReserve
  };
  const cellWidth = contentRect.width / columns;
  const cellHeight = contentRect.height / rows;
  const cellPadding = 8;

  const labelFont = await outDoc.embedFont(StandardFonts.Helvetica);
  const titleFont = await embedTitleFont(outDoc, options);

  let sourcePageIndex = 0; // 0-based (embeddedPages[0] = diapositive 1)
  let outputPageNumber = 0;

  function newPage() {
    const page = outDoc.addPage([pageSize.width, pageSize.height]);
    page.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: WHITE });
    return page;
  }

  if (options.titlePageEnabled) {
    outputPageNumber++;
    const page = newPage();
    const titleSlide = options.titlePageIncludesFirstSlide ? embeddedPages[0] : null;
    drawTitlePage(page, titleSlide, aspectRatio, options, contentRect, titleFont, labelFont);
    if (options.showPageNumbers) drawPageNumber(page, outputPageNumber, pageSize, labelFont);
    if (options.titlePageIncludesFirstSlide) sourcePageIndex = 1;
    if (onProgress) onProgress(outputPageNumber);
  }

  while (sourcePageIndex < pageCount) {
    outputPageNumber++;
    const page = newPage();

    for (let slot = 0; slot < slotsPerPage; slot++) {
      if (sourcePageIndex >= pageCount) break;
      const embedded = embeddedPages[sourcePageIndex];

      const col = slot % columns;
      const row = Math.floor(slot / columns);
      const cellX = contentRect.x + col * cellWidth;
      const cellTop = contentRect.y + contentRect.height - row * cellHeight;
      const cellRect = inset({ x: cellX, y: cellTop - cellHeight, width: cellWidth, height: cellHeight }, cellPadding, cellPadding);

      const { slide, notesRects } = layoutCell(cellRect, options.noteStyle, aspectRatio, options.slideScale);

      for (const notesRect of notesRects) {
        drawNoteLines(page, notesRect, options.lineSpacingPoints, contentRect.y + contentRect.height);
      }
      drawSlideOnPage(page, embedded, slide, options.showSlideNumbers, sourcePageIndex + 1, labelFont);

      sourcePageIndex++;
    }

    if (options.showPageNumbers) drawPageNumber(page, outputPageNumber, pageSize, labelFont);
    if (onProgress) onProgress(outputPageNumber);
    // Laisse la main au thread UI entre deux pages sur les gros documents.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  try {
    return await outDoc.save();
  } catch {
    throw new HandoutError("Impossible de créer le fichier PDF de sortie.");
  }
}

// Réexporté pour usage ailleurs (ex: lire le nombre de pages du PDF source importé).
export { PDFDocument, degrees };
