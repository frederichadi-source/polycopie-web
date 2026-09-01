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

/** Motif de tirets pour pdf-lib (option `dashArray`), équivalent de `NoteLineStyle.dashPattern`
 * côté Swift ; `null` = trait continu. */
const DASH_PATTERNS = {
  solid: null,
  dashed: [6, 4],
  dotted: [1.5, 3]
};

/** Port de `drawNoteLines` : lignes horizontales ancrées sur la grille globale de la page
 * (`gridOriginY`), pour que deux zones adjacentes s'alignent parfaitement. `style === "none"`
 * conserve la zone de notes (l'espace reste réservé) mais ne dessine aucun trait — une zone
 * vierge plutôt qu'une zone lignée. */
function drawNoteLines(page, rect, spacing, gridOriginY, style, color) {
  if (style === "none") return;
  if (rect.width <= 0 || rect.height <= 0 || spacing <= 0) return;
  const dashArray = DASH_PATTERNS[style] || undefined;
  const lineColor = rgb(color.r, color.g, color.b);
  let step = 0;
  while (true) {
    const y = gridOriginY - spacing * (step + 1);
    if (y < rect.y) break;
    if (y <= rect.y + rect.height) {
      page.drawLine({
        start: { x: rect.x, y },
        end: { x: rect.x + rect.width, y },
        thickness: 0.5,
        color: lineColor,
        opacity: color.a,
        dashArray
      });
    }
    step++;
  }
}

/** Hauteur réservée pour chaque bandeau d'en-tête/pied de page (texte et/ou numéro de page). */
const HEADER_FOOTER_BAND_HEIGHT = 20;
const HEADER_FOOTER_FONT_SIZE = 8.5;
/** Marge de sécurité entre le texte/numéro et le bord physique de la page (haut pour
 * l'en-tête, bas pour le pied de page) : sans cette marge, le texte se retrouvait collé au
 * bord, dans la zone que beaucoup d'imprimantes ne reproduisent pas fidèlement. */
const HEADER_FOOTER_EDGE_INSET = 8;

/** Texte à afficher dans l'en-tête/le pied de page, résolu selon `headerSource`/`footerSource`
 * — vide si non activé ou si le texte source (personnalisé ou page de titre) est vide. */
function resolvedHeaderText(options) {
  if (!options.headerEnabled) return "";
  const text = options.headerSource === "titlePageText" ? options.titlePageText : options.headerText;
  return text.trim();
}
function resolvedFooterText(options) {
  if (!options.footerEnabled) return "";
  const text = options.footerSource === "titlePageText" ? options.titlePageText : options.footerText;
  return text.trim();
}

/** Tronque `text` avec des points de suspension pour qu'il tienne dans `maxWidth`, à la
 * manière de `lineBreakMode = .byTruncatingTail` côté Swift — jamais de retour à la ligne ni
 * de débordement, contrairement à `drawWrappedText`. */
function truncateToWidth(text, font, fontSize, maxWidth) {
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && font.widthOfTextAtSize(`${truncated}…`, fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? `${truncated}…` : "";
}

/** Dessine `text` sur une seule ligne, tronquée si besoin, alignée dans `rect`. */
function drawSingleLine(page, text, rect, font, alignment) {
  if (!text || rect.width <= 0 || rect.height <= 0) return;
  const truncated = truncateToWidth(text, font, HEADER_FOOTER_FONT_SIZE, rect.width);
  if (!truncated) return;
  const textWidth = font.widthOfTextAtSize(truncated, HEADER_FOOTER_FONT_SIZE);
  let x = rect.x;
  if (alignment === "center") x = rect.x + (rect.width - textWidth) / 2;
  else if (alignment === "right") x = rect.x + rect.width - textWidth;
  page.drawText(truncated, { x, y: rect.y, size: HEADER_FOOTER_FONT_SIZE, font, color: GRAY_LABEL });
}

/** Bandeau de texte en haut de page (jamais sur la page de titre). L'inset horizontal
 * reprend la marge de page choisie par l'utilisateur, pour que le texte s'aligne avec les
 * bords gauche/droite de la grille de diapositives plutôt que d'être excentré. */
function drawHeaderBand(page, text, pageSize, margin, font) {
  if (!text) return;
  const rect = {
    x: margin,
    y: pageSize.height - HEADER_FOOTER_BAND_HEIGHT,
    width: pageSize.width - 2 * margin,
    height: HEADER_FOOTER_BAND_HEIGHT - HEADER_FOOTER_EDGE_INSET
  };
  drawSingleLine(page, text, rect, font, "center");
}

/** Bandeau de pied de page : texte et numéro de page partagent la même bande plutôt que d'en
 * réserver une chacun.
 * - Si les deux sont présents, le numéro est ancré dans le coin en bas à droite, dans une
 *   zone de largeur fixe séparée du texte par une vraie marge (`numberGap`) : les deux zones
 *   ne se touchent jamais, donc aucun chevauchement possible même si le texte est long (il
 *   est de toute façon tronqué avant d'atteindre cette limite).
 * - Si le texte seul ou le numéro seul est présent, il reste centré, comme avant.
 */
function drawFooterBand(page, pageNumber, footerText, pageSize, margin, font) {
  if (pageNumber === null && !footerText) return;
  const bandRect = {
    x: margin,
    y: HEADER_FOOTER_EDGE_INSET,
    width: pageSize.width - 2 * margin,
    height: HEADER_FOOTER_BAND_HEIGHT - HEADER_FOOTER_EDGE_INSET
  };

  if (!footerText) {
    if (pageNumber !== null) drawSingleLine(page, String(pageNumber), bandRect, font, "center");
    return;
  }
  if (pageNumber === null) {
    drawSingleLine(page, footerText, bandRect, font, "center");
    return;
  }

  const numberWidth = 28;
  const numberGap = 6;
  const textRect = { x: bandRect.x, y: bandRect.y, width: bandRect.width - numberWidth - numberGap, height: bandRect.height };
  const numberRect = { x: bandRect.x + bandRect.width - numberWidth, y: bandRect.y, width: numberWidth, height: bandRect.height };
  drawSingleLine(page, footerText, textRect, font, "center");
  drawSingleLine(page, String(pageNumber), numberRect, font, "right");
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
 * Indique si, avec ces réglages, la zone de prise de notes serait trop réduite pour qu'une
 * ligne y soit dessinée — elle resterait vide alors que `noteStyle` prévoit une zone de
 * notes. Reproduit la géométrie exacte de `generateHandout`/`layoutCell` sans avoir besoin
 * d'un PDF source réel, pour un avertissement en direct dans le panneau de réglages.
 * `aspectRatio` doit être le ratio réel du PDF chargé quand il est disponible ; à défaut,
 * 16:9 est une hypothèse raisonnable.
 */
export function notesAreaWouldBeEmpty(options, aspectRatio = 16 / 9) {
  if (options.noteStyle === "none") return false;
  const { columns, rows } = resolvedGrid(options);
  if (columns <= 0 || rows <= 0) return false;

  const pageSize = resolvedPageSize(options);
  const margin = options.marginPoints;
  const headerText = resolvedHeaderText(options);
  const footerText = resolvedFooterText(options);
  const footerReserve = footerText || options.showPageNumbers ? HEADER_FOOTER_BAND_HEIGHT : 0;
  const headerReserve = headerText ? HEADER_FOOTER_BAND_HEIGHT : 0;

  const contentWidth = pageSize.width - margin * 2;
  const contentHeight = pageSize.height - margin * 2 - footerReserve - headerReserve;
  if (contentWidth <= 0 || contentHeight <= 0) return true;

  const cellWidth = contentWidth / columns;
  const cellHeight = contentHeight / rows;
  const cell = inset({ x: 0, y: 0, width: cellWidth, height: cellHeight }, 8, 8);

  const { notesRects } = layoutCell(cell, options.noteStyle, aspectRatio, options.slideScale);
  return notesRects.length === 0;
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

  // Texte résolu de l'en-tête/pied de page (source "personnalisé" ou reprise du texte de la
  // page de titre) — vide si la case correspondante n'est pas cochée.
  const headerText = resolvedHeaderText(options);
  const footerText = resolvedFooterText(options);
  // Un bandeau de pied de page est réservé dès que du texte OU la numérotation y figurent :
  // les deux se partagent alors la même bande (voir drawFooterBand), plutôt que d'empiler
  // deux espaces réservés distincts.
  const footerReserve = footerText || options.showPageNumbers ? HEADER_FOOTER_BAND_HEIGHT : 0;
  const headerReserve = headerText ? HEADER_FOOTER_BAND_HEIGHT : 0;
  const contentRect = {
    x: margin,
    y: margin + footerReserve,
    width: pageSize.width - 2 * margin,
    height: pageSize.height - 2 * margin - footerReserve - headerReserve
  };
  const cellWidth = contentRect.width / columns;
  const cellHeight = contentRect.height / rows;
  const cellPadding = 8;

  const labelFont = await outDoc.embedFont(StandardFonts.Helvetica);
  const titleFont = await embedTitleFont(outDoc, options);

  let sourcePageIndex = 0; // 0-based (embeddedPages[0] = diapositive 1)
  let outputPageNumber = 0;
  let titlePageWasDrawn = false;

  function newPage() {
    const page = outDoc.addPage([pageSize.width, pageSize.height]);
    page.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: WHITE });
    return page;
  }

  // Page de titre optionnelle. L'en-tête/pied de page ne sont jamais dessinés sur la page de
  // titre (qui a sa propre mise en page) ; seul son numéro peut y figurer, si
  // `pageNumberIncludesTitlePage` est coché.
  if (options.titlePageEnabled) {
    outputPageNumber++;
    titlePageWasDrawn = true;
    const page = newPage();
    const titleSlide = options.titlePageIncludesFirstSlide ? embeddedPages[0] : null;
    const titleShowsNumber = options.showPageNumbers && options.pageNumberIncludesTitlePage;
    const titleFooterReserve = titleShowsNumber ? HEADER_FOOTER_BAND_HEIGHT : 0;
    const titleContentRect = {
      x: margin,
      y: margin + titleFooterReserve,
      width: pageSize.width - 2 * margin,
      height: pageSize.height - 2 * margin - titleFooterReserve
    };
    drawTitlePage(page, titleSlide, aspectRatio, options, titleContentRect, titleFont, labelFont);
    if (titleShowsNumber) drawFooterBand(page, outputPageNumber, "", pageSize, margin, labelFont);
    if (options.titlePageIncludesFirstSlide) sourcePageIndex = 1;
    if (onProgress) onProgress(outputPageNumber);

    // Page blanche optionnelle après la page de titre (impression recto-verso) : entièrement
    // vierge, sans numéro ni en-tête/pied de page, et volontairement exclue de la
    // numérotation (outputPageNumber n'est pas incrémenté) pour que la première page de
    // contenu garde le même numéro qu'en son absence.
    if (options.titlePageAddBlankPageAfter) {
      newPage();
    }
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
        drawNoteLines(page, notesRect, options.lineSpacingPoints, contentRect.y + contentRect.height, options.noteLineStyle, options.noteLineColor);
      }
      drawSlideOnPage(page, embedded, slide, options.showSlideNumbers, sourcePageIndex + 1, labelFont);

      sourcePageIndex++;
    }

    if (headerText) drawHeaderBand(page, headerText, pageSize, margin, labelFont);
    if (footerText || options.showPageNumbers) {
      // Si la page de titre n'est pas comptée dans la numérotation, la première page de
      // contenu redémarre à 1 (voir pageNumberIncludesTitlePage).
      const displayNumber = titlePageWasDrawn && !options.pageNumberIncludesTitlePage ? outputPageNumber - 1 : outputPageNumber;
      drawFooterBand(page, options.showPageNumbers ? displayNumber : null, footerText, pageSize, margin, labelFont);
    }
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

/** Ratio largeur/hauteur de la première page du document, en tenant compte de sa rotation
 * éventuelle (une page pivotée à 90°/270° a ses dimensions effectivement inversées). Repli
 * sur 4:3 si le document est illisible pour une raison quelconque. Port de
 * `HandoutGenerator.sourceAspectRatio(of:)` : utilisé pour que l'avertissement "trop peu de
 * place" (voir `notesAreaWouldBeEmpty`) reflète la géométrie réelle du PDF chargé. */
export function sourceAspectRatio(doc) {
  try {
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    const angle = ((page.getRotation().angle % 360) + 360) % 360;
    const rotated = angle === 90 || angle === 270;
    const w = rotated ? height : width;
    const h = rotated ? width : height;
    return h > 0 ? w / h : 4 / 3;
  } catch {
    return 4 / 3;
  }
}
