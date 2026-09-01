// Polycopié — Web
// Assemble l'UI (index.html) avec le moteur de génération (pdfEngine.js) et le modèle de
// réglages (store.js). Tout tourne dans le navigateur : aucun fichier n'est envoyé à un
// serveur.

import { t, getLang, setLang } from "./i18n.js";
import { defaultOptions, loadLastUsed, saveAsLastUsed, PresetStore, hasArrangementChoice, DEFAULT_NOTE_LINE_COLOR } from "./store.js";
import { generateHandout, HandoutError, PDFDocument, notesAreaWouldBeEmpty, sourceAspectRatio } from "./pdfEngine.js";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs";
import JSZip from "https://esm.sh/jszip@3.10.1";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs";

// ---------------------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------------------

let options = loadLastUsed();
const presetStore = new PresetStore();

const state = {
  sourceFile: null,
  sourceBytes: null,
  sourcePageCount: 0,
  sourceAspectRatio: 16 / 9,
  previewReady: false,
  batchFiles: [], // {id, file, status, errorMessage, outputBytes}
  batchOptionsSnapshot: null,
  batchProcessing: false,
  editingPresetId: null
};

let previewGeneration = 0;
let debounceTimer = null;

// ---------------------------------------------------------------------------------------
// Raccourcis DOM
// ---------------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const el = {
  langSelect: $("langSelect"),
  dropZone: $("dropZone"),
  dropEmpty: document.querySelector(".drop-zone-empty"),
  dropFilled: document.querySelector(".drop-zone-filled"),
  fileInput: $("fileInput"),
  pickFileBtn: $("pickFileBtn"),
  pickAnotherBtn: $("pickAnotherBtn"),
  clearSourceBtn: $("clearSourceBtn"),
  sourceFileName: $("sourceFileName"),
  sourceSlideCount: $("sourceSlideCount"),

  optionsPanel: $("optionsPanel"),
  exportBtn: $("exportBtn"),
  exportBtnToolbar: $("exportBtnToolbar"),
  toolbar: $("toolbar"),
  batchBtn: $("batchBtn"),

  errorBanner: $("errorBanner"),
  errorText: $("errorText"),
  previewEmpty: $("previewEmpty"),
  previewScroll: $("previewScroll"),
  previewPages: $("previewPages"),
  previewOverlay: $("previewOverlay"),

  presetSelect: $("presetSelect"),
  savePresetBtn: $("savePresetBtn"),
  managePresetsBtn: $("managePresetsBtn"),
  savePresetDialog: $("savePresetDialog"),
  newPresetName: $("newPresetName"),
  confirmSavePresetBtn: $("confirmSavePresetBtn"),
  managePresetsDialog: $("managePresetsDialog"),
  presetList: $("presetList"),
  presetListEmpty: $("presetListEmpty"),

  slidesPerPage: $("slidesPerPage"),
  gridArrangement: $("gridArrangement"),
  arrangementField: $("arrangementField"),
  arrangementHint: $("arrangementHint"),
  noteStyle: $("noteStyle"),
  noteDependentFields: $("noteDependentFields"),
  slideScale: $("slideScale"),
  slideScaleOut: $("slideScaleOut"),
  lineSpacingPoints: $("lineSpacingPoints"),
  lineSpacingOut: $("lineSpacingOut"),
  noteLineStyle: $("noteLineStyle"),
  noteLineColorField: $("noteLineColorField"),
  noteLineColor: $("noteLineColor"),
  resetNoteLineColorBtn: $("resetNoteLineColorBtn"),
  notesAreaWarning: $("notesAreaWarning"),

  pageSize: $("pageSize"),
  orientation: $("orientation"),
  marginPoints: $("marginPoints"),
  marginOut: $("marginOut"),

  titlePageEnabled: $("titlePageEnabled"),
  titlePageFields: $("titlePageFields"),
  titlePageIncludesFirstSlide: $("titlePageIncludesFirstSlide"),
  titlePageText: $("titlePageText"),
  textPositionField: $("textPositionField"),
  titlePageTextPosition: $("titlePageTextPosition"),
  titlePageTextAlignment: $("titlePageTextAlignment"),
  titlePageFont: $("titlePageFont"),
  boldToggle: $("boldToggle"),
  italicToggle: $("italicToggle"),
  titlePageFontSize: $("titlePageFontSize"),
  titleFontSizeOut: $("titleFontSizeOut"),
  titlePageFontColor: $("titlePageFontColor"),

  headerEnabled: $("headerEnabled"),
  headerFields: $("headerFields"),
  headerUseTitlePageText: $("headerUseTitlePageText"),
  headerTextField: $("headerTextField"),
  headerText: $("headerText"),
  footerEnabled: $("footerEnabled"),
  footerFields: $("footerFields"),
  footerUseTitlePageText: $("footerUseTitlePageText"),
  footerTextField: $("footerTextField"),
  footerText: $("footerText"),
  headerFooterHint: $("headerFooterHint"),

  showPageNumbers: $("showPageNumbers"),
  pageNumberIncludesTitlePageField: $("pageNumberIncludesTitlePageField"),
  pageNumberIncludesTitlePage: $("pageNumberIncludesTitlePage"),
  showSlideNumbers: $("showSlideNumbers"),

  resetSettingsBtn: $("resetSettingsBtn"),
  resetSettingsDialog: $("resetSettingsDialog"),
  confirmResetSettingsBtn: $("confirmResetSettingsBtn"),

  batchDialog: $("batchDialog"),
  batchEmpty: $("batchEmpty"),
  batchList: $("batchList"),
  batchChooseBtn: $("batchChooseBtn"),
  batchAddBtn: $("batchAddBtn"),
  batchCloseBtn: $("batchCloseBtn"),
  batchRunBtn: $("batchRunBtn"),
  batchFileInput: $("batchFileInput"),
  batchSummary: $("batchSummary"),
  batchZipHint: $("batchZipHint")
};

// ---------------------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------------------

function applyI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.getAttribute("data-i18n-placeholder"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.title = t(node.getAttribute("data-i18n-title"));
  });
  updateConditionalVisibility();
  renderPresetList();
  renderBatchList();
}

el.langSelect.value = getLang();
el.langSelect.addEventListener("change", () => {
  setLang(el.langSelect.value);
  applyI18n();
});

// ---------------------------------------------------------------------------------------
// Réglages <-> formulaire
// ---------------------------------------------------------------------------------------

function hexToRgb01(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16) / 255,
    g: parseInt(clean.substring(2, 4), 16) / 255,
    b: parseInt(clean.substring(4, 6), 16) / 255,
    a: 1
  };
}

function rgb01ToHex({ r, g, b }) {
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function populateFieldsFromOptions() {
  el.slidesPerPage.value = String(options.slidesPerPage);
  el.gridArrangement.value = options.gridArrangement;
  el.noteStyle.value = options.noteStyle;
  el.slideScale.value = String(options.slideScale);
  el.lineSpacingPoints.value = String(options.lineSpacingPoints);
  el.noteLineStyle.value = options.noteLineStyle;
  el.noteLineColor.value = rgb01ToHex(options.noteLineColor);

  el.pageSize.value = options.pageSize;
  el.orientation.value = options.orientation;
  el.marginPoints.value = String(options.marginPoints);

  el.titlePageEnabled.checked = options.titlePageEnabled;
  el.titlePageIncludesFirstSlide.checked = options.titlePageIncludesFirstSlide;
  el.titlePageText.value = options.titlePageText;
  el.titlePageTextPosition.value = options.titlePageTextPosition;
  el.titlePageTextAlignment.value = options.titlePageTextAlignment;
  el.titlePageFont.value = options.titlePageFont;
  el.titlePageFontSize.value = String(options.titlePageFontSize);
  el.titlePageFontColor.value = rgb01ToHex(options.titlePageFontColor);

  el.headerEnabled.checked = options.headerEnabled;
  el.headerUseTitlePageText.checked = options.headerSource === "titlePageText";
  el.headerText.value = options.headerText;
  el.footerEnabled.checked = options.footerEnabled;
  el.footerUseTitlePageText.checked = options.footerSource === "titlePageText";
  el.footerText.value = options.footerText;

  el.showPageNumbers.checked = options.showPageNumbers;
  el.pageNumberIncludesTitlePage.checked = options.pageNumberIncludesTitlePage;
  el.showSlideNumbers.checked = options.showSlideNumbers;

  updateConditionalVisibility();
}

/** Compare deux couleurs RGBA {r,g,b,a} avec une tolérance flottante — port de la
 * comparaison `Equatable` utilisée côté Swift/SwiftUI pour l'affichage du bouton de
 * réinitialisation de la couleur des lignes. */
function colorsEqual(a, b) {
  const eps = 0.002;
  return Math.abs(a.r - b.r) < eps && Math.abs(a.g - b.g) < eps && Math.abs(a.b - b.b) < eps && Math.abs(a.a - b.a) < eps;
}

function updateConditionalVisibility() {
  const showArrangement = hasArrangementChoice(options.slidesPerPage);
  el.arrangementField.classList.toggle("hidden", !showArrangement);
  const showHint = showArrangement && options.gridArrangement === "automatic";
  el.arrangementHint.classList.toggle("hidden", !showHint);
  if (showHint) {
    el.arrangementHint.textContent =
      options.orientation === "landscape"
        ? t("Actuellement : côte à côte (paysage)")
        : t("Actuellement : empilées (portrait)");
  }

  el.noteDependentFields.classList.toggle("hidden", options.noteStyle === "none");
  el.titlePageFields.classList.toggle("hidden", !options.titlePageEnabled);
  el.textPositionField.classList.toggle("hidden", !options.titlePageIncludesFirstSlide);

  el.boldToggle.classList.toggle("active", options.titlePageFontWeight === "bold");
  el.italicToggle.classList.toggle("active", options.titlePageFontItalic);

  const showLineColor = options.noteStyle !== "none" && options.noteLineStyle !== "none";
  el.noteLineColorField.classList.toggle("hidden", !showLineColor);
  const isDefaultLineColor = colorsEqual(options.noteLineColor, DEFAULT_NOTE_LINE_COLOR);
  el.resetNoteLineColorBtn.classList.toggle("hidden", isDefaultLineColor);

  const showWarning = options.noteStyle !== "none"
    && notesAreaWouldBeEmpty(options, state.sourceAspectRatio);
  el.notesAreaWarning.classList.toggle("hidden", !showWarning);

  el.headerFields.classList.toggle("hidden", !options.headerEnabled);
  el.headerTextField.classList.toggle("hidden", options.headerSource === "titlePageText");
  el.footerFields.classList.toggle("hidden", !options.footerEnabled);
  el.footerTextField.classList.toggle("hidden", options.footerSource === "titlePageText");
  el.headerFooterHint.classList.toggle("hidden", !(options.headerEnabled || options.footerEnabled));

  el.pageNumberIncludesTitlePageField.classList.toggle(
    "hidden",
    !(options.showPageNumbers && options.titlePageEnabled)
  );

  el.slideScaleOut.textContent = `${Math.round(options.slideScale * 100)} %`;
  el.lineSpacingOut.textContent = `${Math.round(options.lineSpacingPoints)} pt`;
  el.marginOut.textContent = `${Math.round(options.marginPoints)} pt`;
  el.titleFontSizeOut.textContent = `${Math.round(options.titlePageFontSize)} pt`;
}

function onOptionsChanged() {
  updateConditionalVisibility();
  saveAsLastUsed(options);
  scheduleRegeneratePreview();
}

function bindSelect(node, key, transform = (v) => v) {
  node.addEventListener("change", () => {
    options[key] = transform(node.value);
    onOptionsChanged();
  });
}

function bindCheckbox(node, key) {
  node.addEventListener("change", () => {
    options[key] = node.checked;
    onOptionsChanged();
  });
}

function bindRange(node, key) {
  node.addEventListener("input", () => {
    options[key] = parseFloat(node.value);
    onOptionsChanged();
  });
}

bindSelect(el.slidesPerPage, "slidesPerPage", (v) => parseInt(v, 10));
bindSelect(el.gridArrangement, "gridArrangement");
bindSelect(el.noteStyle, "noteStyle");
bindRange(el.slideScale, "slideScale");
bindRange(el.lineSpacingPoints, "lineSpacingPoints");
bindSelect(el.noteLineStyle, "noteLineStyle");
el.noteLineColor.addEventListener("input", () => {
  // <input type="color"> ne permet pas de régler l'opacité (contrairement au ColorPicker
  // SwiftUI) : même limitation déjà acceptée pour titlePageFontColor ci-dessous.
  options.noteLineColor = hexToRgb01(el.noteLineColor.value);
  onOptionsChanged();
});
el.resetNoteLineColorBtn.addEventListener("click", () => {
  options.noteLineColor = { ...DEFAULT_NOTE_LINE_COLOR };
  el.noteLineColor.value = rgb01ToHex(options.noteLineColor);
  onOptionsChanged();
});

bindSelect(el.pageSize, "pageSize");
bindSelect(el.orientation, "orientation");
bindRange(el.marginPoints, "marginPoints");

bindCheckbox(el.titlePageEnabled, "titlePageEnabled");
bindCheckbox(el.titlePageIncludesFirstSlide, "titlePageIncludesFirstSlide");
el.titlePageText.addEventListener("input", () => {
  options.titlePageText = el.titlePageText.value;
  onOptionsChanged();
});
bindSelect(el.titlePageTextPosition, "titlePageTextPosition");
bindSelect(el.titlePageTextAlignment, "titlePageTextAlignment");
bindSelect(el.titlePageFont, "titlePageFont");
bindRange(el.titlePageFontSize, "titlePageFontSize");
el.titlePageFontColor.addEventListener("input", () => {
  options.titlePageFontColor = hexToRgb01(el.titlePageFontColor.value);
  onOptionsChanged();
});

el.boldToggle.addEventListener("click", () => {
  options.titlePageFontWeight = options.titlePageFontWeight === "bold" ? "regular" : "bold";
  onOptionsChanged();
});
el.italicToggle.addEventListener("click", () => {
  options.titlePageFontItalic = !options.titlePageFontItalic;
  onOptionsChanged();
});

bindCheckbox(el.headerEnabled, "headerEnabled");
el.headerUseTitlePageText.addEventListener("change", () => {
  options.headerSource = el.headerUseTitlePageText.checked ? "titlePageText" : "custom";
  onOptionsChanged();
});
el.headerText.addEventListener("input", () => {
  options.headerText = el.headerText.value;
  onOptionsChanged();
});
bindCheckbox(el.footerEnabled, "footerEnabled");
el.footerUseTitlePageText.addEventListener("change", () => {
  options.footerSource = el.footerUseTitlePageText.checked ? "titlePageText" : "custom";
  onOptionsChanged();
});
el.footerText.addEventListener("input", () => {
  options.footerText = el.footerText.value;
  onOptionsChanged();
});

bindCheckbox(el.showPageNumbers, "showPageNumbers");
bindCheckbox(el.pageNumberIncludesTitlePage, "pageNumberIncludesTitlePage");
bindCheckbox(el.showSlideNumbers, "showSlideNumbers");

// ---------------------------------------------------------------------------------------
// Préréglages
// ---------------------------------------------------------------------------------------

function populatePresetSelect() {
  const current = el.presetSelect.value;
  el.presetSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("Appliquer") + "\u2026";
  el.presetSelect.appendChild(placeholder);
  for (const preset of presetStore.presets) {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.name;
    el.presetSelect.appendChild(opt);
  }
  el.presetSelect.value = presetStore.presets.some((p) => p.id === current) ? current : "";
}

el.presetSelect.addEventListener("change", () => {
  const id = el.presetSelect.value;
  if (!id) return;
  const preset = presetStore.presets.find((p) => p.id === id);
  if (preset) {
    options = { ...defaultOptions(), ...preset.options };
    populateFieldsFromOptions();
    saveAsLastUsed(options);
    scheduleRegeneratePreview();
  }
  el.presetSelect.value = "";
});

el.savePresetBtn.addEventListener("click", () => {
  el.newPresetName.value = "";
  el.savePresetDialog.showModal();
  el.newPresetName.focus();
});
el.confirmSavePresetBtn.addEventListener("click", () => {
  if (presetStore.save(el.newPresetName.value, options)) {
    el.savePresetDialog.close();
  }
});
el.newPresetName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    el.confirmSavePresetBtn.click();
  }
});

el.managePresetsBtn.addEventListener("click", () => {
  renderPresetList();
  el.managePresetsDialog.showModal();
});

function renderPresetList() {
  el.presetList.innerHTML = "";
  el.presetListEmpty.classList.toggle("hidden", presetStore.presets.length > 0);
  el.presetList.classList.toggle("hidden", presetStore.presets.length === 0);

  for (const preset of presetStore.presets) {
    const li = document.createElement("li");

    if (state.editingPresetId === preset.id) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = preset.name;
      const confirmBtn = document.createElement("button");
      confirmBtn.className = "icon-btn";
      confirmBtn.textContent = "✓";
      confirmBtn.title = t("Enregistrer");
      const commit = () => {
        presetStore.rename(preset.id, input.value);
        state.editingPresetId = null;
      };
      confirmBtn.addEventListener("click", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") commit();
      });
      li.append(input, confirmBtn);
    } else {
      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent = preset.name;

      const dupBtn = document.createElement("button");
      dupBtn.className = "icon-btn";
      dupBtn.textContent = "⧉";
      dupBtn.title = t("Dupliquer");
      dupBtn.addEventListener("click", () => presetStore.duplicate(preset.id, t("copie de")));

      const renameBtn = document.createElement("button");
      renameBtn.className = "icon-btn";
      renameBtn.textContent = "✎";
      renameBtn.title = t("Renommer");
      renameBtn.addEventListener("click", () => {
        state.editingPresetId = preset.id;
        renderPresetList();
      });

      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn danger";
      delBtn.textContent = "✕";
      delBtn.title = t("Supprimer");
      delBtn.addEventListener("click", () => presetStore.delete(preset.id));

      li.append(name, dupBtn, renameBtn, delBtn);
    }
    el.presetList.appendChild(li);
  }
}

presetStore.addEventListener("change", () => {
  populatePresetSelect();
  renderPresetList();
});

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => $(btn.getAttribute("data-close")).close());
});

// ---------------------------------------------------------------------------------------
// Source PDF (dépôt / sélection)
// ---------------------------------------------------------------------------------------

function slideCountLabel(count) {
  const unit = t(count > 1 ? "diapositives" : "diapositive");
  return `${count} ${unit}`;
}

async function loadSourceFile(file) {
  if (!file || (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    return;
  }
  hideError();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    if (pageCount === 0) throw new Error("empty");

    state.sourceFile = file;
    state.sourceBytes = bytes;
    state.sourcePageCount = pageCount;
    state.sourceAspectRatio = await sourceAspectRatio(bytes);
    state.previewReady = false;

    el.dropEmpty.classList.add("hidden");
    el.dropFilled.classList.remove("hidden");
    el.sourceFileName.textContent = file.name;
    el.sourceSlideCount.textContent = slideCountLabel(pageCount);

    el.optionsPanel.classList.remove("hidden");
    el.exportBtn.classList.remove("hidden");
    el.toolbar.classList.remove("hidden");
    updateExportEnabled();
    updateConditionalVisibility();

    scheduleRegeneratePreview();
  } catch {
    showError(t("Ce fichier ne semble pas être un PDF valide."));
  }
}

el.pickFileBtn.addEventListener("click", () => el.fileInput.click());
el.pickAnotherBtn.addEventListener("click", () => el.fileInput.click());
el.fileInput.addEventListener("change", () => {
  if (el.fileInput.files[0]) loadSourceFile(el.fileInput.files[0]);
  el.fileInput.value = "";
});

el.dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    el.fileInput.click();
  }
});
["dragenter", "dragover"].forEach((evt) =>
  el.dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    el.dropZone.classList.add("drag-over");
  })
);
["dragleave", "drop"].forEach((evt) =>
  el.dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    el.dropZone.classList.remove("drag-over");
  })
);
el.dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) loadSourceFile(file);
});

// Retire le PDF chargé et revient à l'état vide, comme au premier lancement de l'app —
// sans toucher aux réglages actuels (voir resetSettingsBtn plus bas pour ça). Action
// immédiate, sans confirmation : contrairement à une réinitialisation des réglages, perdre
// le PDF chargé n'est pas destructif (il suffit de le redéposer).
el.clearSourceBtn.addEventListener("click", () => {
  state.sourceFile = null;
  state.sourceBytes = null;
  state.sourcePageCount = 0;
  state.previewReady = false;

  el.dropEmpty.classList.remove("hidden");
  el.dropFilled.classList.add("hidden");
  el.optionsPanel.classList.add("hidden");
  el.exportBtn.classList.add("hidden");
  el.toolbar.classList.add("hidden");
  clearPreview();
  hideError();
});

// Vit dans la section Préréglages plutôt qu'à côté du PDF chargé : son action porte
// uniquement sur les réglages, pas sur le PDF (qui reste chargé, avec son aperçu régénéré
// selon les réglages par défaut).
el.resetSettingsBtn.addEventListener("click", () => el.resetSettingsDialog.showModal());
el.confirmResetSettingsBtn.addEventListener("click", () => {
  options = defaultOptions();
  saveAsLastUsed(options);
  populateFieldsFromOptions();
  if (state.sourceFile) scheduleRegeneratePreview();
  el.resetSettingsDialog.close();
});

// ---------------------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------------------

function showError(message) {
  el.errorText.textContent = message;
  el.errorBanner.classList.remove("hidden");
}
function hideError() {
  el.errorBanner.classList.add("hidden");
}

// ---------------------------------------------------------------------------------------
// Aperçu (rendu via pdf.js)
// ---------------------------------------------------------------------------------------

function clearPreview() {
  el.previewPages.innerHTML = "";
  el.previewScroll.classList.add("hidden");
  el.previewEmpty.classList.remove("hidden");
}

function showOverlay(visible) {
  el.previewOverlay.classList.toggle("hidden", !visible);
}

function updateExportEnabled() {
  const enabled = !!state.sourceBytes;
  el.exportBtn.disabled = !enabled;
  el.exportBtnToolbar.disabled = !enabled;
  el.batchBtn.disabled = !enabled;
}

async function renderPreview(bytes, myGeneration) {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  if (myGeneration !== previewGeneration) return;

  el.previewPages.innerHTML = "";
  const outputScale = window.devicePixelRatio || 1;
  const baseScale = 1.25;

  for (let i = 1; i <= pdf.numPages; i++) {
    if (myGeneration !== previewGeneration) return;
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: baseScale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const ctx = canvas.getContext("2d");
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

    el.previewPages.appendChild(canvas);
    await page.render({ canvasContext: ctx, viewport, transform }).promise;
  }

  if (myGeneration !== previewGeneration) return;
  el.previewEmpty.classList.add("hidden");
  el.previewScroll.classList.remove("hidden");
  state.previewReady = true;
  updateExportEnabled();
}

function scheduleRegeneratePreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(regeneratePreviewNow, 180);
}

async function regeneratePreviewNow() {
  if (!state.sourceBytes) return;
  const myGeneration = ++previewGeneration;
  showOverlay(true);
  hideError();
  try {
    const bytes = await generateHandout(state.sourceBytes, options);
    if (myGeneration !== previewGeneration) return;
    await renderPreview(bytes, myGeneration);
  } catch (err) {
    if (myGeneration !== previewGeneration) return;
    showError(err instanceof HandoutError ? t(err.key) : String(err?.message || err));
  } finally {
    if (myGeneration === previewGeneration) showOverlay(false);
  }
}

// ---------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function suggestedFilename(sourceName) {
  const base = sourceName.replace(/\.pdf$/i, "");
  return `${base}${t("-polycopié.pdf")}`;
}

async function doExport() {
  if (!state.sourceBytes) return;
  hideError();
  try {
    const bytes = await generateHandout(state.sourceBytes, options);
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), suggestedFilename(state.sourceFile.name));
  } catch (err) {
    showError(err instanceof HandoutError ? t(err.key) : String(err?.message || err));
  }
}

el.exportBtn.addEventListener("click", doExport);
el.exportBtnToolbar.addEventListener("click", doExport);

// ---------------------------------------------------------------------------------------
// Traitement par lot
// ---------------------------------------------------------------------------------------

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

el.batchBtn.addEventListener("click", () => {
  state.batchOptionsSnapshot = { ...options }; // figés à l'ouverture, comme côté macOS
  el.batchDialog.showModal();
});

function addBatchFiles(files) {
  const existing = new Set(state.batchFiles.map((f) => `${f.file.name}:${f.file.size}`));
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") continue;
    const key = `${file.name}:${file.size}`;
    if (existing.has(key)) continue;
    existing.add(key);
    state.batchFiles.push({ id: uid(), file, status: "pending", errorMessage: null, outputBytes: null });
  }
  el.batchSummary.textContent = "";
  renderBatchList();
}

el.batchChooseBtn.addEventListener("click", () => el.batchFileInput.click());
el.batchAddBtn.addEventListener("click", () => el.batchFileInput.click());
el.batchFileInput.addEventListener("change", () => {
  addBatchFiles(Array.from(el.batchFileInput.files || []));
  el.batchFileInput.value = "";
});

["dragenter", "dragover"].forEach((evt) => el.batchDialog.addEventListener(evt, (e) => e.preventDefault()));
el.batchDialog.addEventListener("drop", (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length) addBatchFiles(files);
});

function renderBatchList() {
  const hasFiles = state.batchFiles.length > 0;
  el.batchEmpty.classList.toggle("hidden", hasFiles);
  el.batchList.classList.toggle("hidden", !hasFiles);
  el.batchZipHint.classList.toggle("hidden", !hasFiles);
  el.batchRunBtn.disabled = !hasFiles || state.batchProcessing;
  el.batchAddBtn.disabled = state.batchProcessing;
  el.batchCloseBtn.disabled = state.batchProcessing;

  el.batchList.innerHTML = "";
  for (const entry of state.batchFiles) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = `status-dot ${entry.status}`;
    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = entry.file.name;
    li.append(dot, name);
    if (entry.status === "failed" && entry.errorMessage) {
      const err = document.createElement("span");
      err.className = "item-error";
      err.textContent = entry.errorMessage;
      li.appendChild(err);
    }
    el.batchList.appendChild(li);
  }
}

el.batchRunBtn.addEventListener("click", async () => {
  if (state.batchFiles.length === 0 || state.batchProcessing) return;
  state.batchProcessing = true;
  el.batchSummary.textContent = "";
  renderBatchList();

  const opts = state.batchOptionsSnapshot || options;
  const zip = new JSZip();
  const usedNames = new Set();
  let successCount = 0;
  let failureCount = 0;

  for (const entry of state.batchFiles) {
    entry.status = "processing";
    renderBatchList();
    try {
      const bytes = new Uint8Array(await entry.file.arrayBuffer());
      const output = await generateHandout(bytes, opts);
      entry.status = "done";
      successCount++;

      let outName = suggestedFilename(entry.file.name);
      let dedupeIndex = 2;
      while (usedNames.has(outName)) {
        outName = `${suggestedFilename(entry.file.name).replace(/\.pdf$/i, "")}-${dedupeIndex}.pdf`;
        dedupeIndex++;
      }
      usedNames.add(outName);
      zip.file(outName, output);
    } catch (err) {
      entry.status = "failed";
      entry.errorMessage = err instanceof HandoutError ? t(err.key) : String(err?.message || err);
      failureCount++;
    }
    renderBatchList();
  }

  if (successCount > 0) {
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "polycopies.zip");
  }

  el.batchSummary.textContent =
    failureCount === 0
      ? `${successCount} ${t("réussi(s)")}.`
      : `${successCount} ${t("réussi(s)")}, ${failureCount} ${t("échec(s)")}.`;

  state.batchProcessing = false;
  renderBatchList();
});

el.batchDialog.addEventListener("close", () => {
  if (state.batchProcessing) return;
  state.batchFiles = [];
  el.batchSummary.textContent = "";
  renderBatchList();
});

// ---------------------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------------------

populateFieldsFromOptions();
populatePresetSelect();
renderBatchList();
applyI18n();
updateExportEnabled();
