// Polycopié — Web
// Assemble l'UI (index.html) avec le moteur de génération (pdfEngine.js) et le modèle de
// réglages (store.js). Tout tourne dans le navigateur : aucun fichier n'est envoyé à un
// serveur.

import { t, getLang, setLang } from "./i18n.js?v=1.5.8";
import {
  defaultOptions, loadLastUsed, saveAsLastUsed, PresetStore, hasArrangementChoice,
  loadShowAdvancedOptions, saveShowAdvancedOptions,
  DEFAULT_TITLE_TEXT_COLOR, DEFAULT_NOTE_LINE_COLOR
} from "./store.js?v=1.5.8";
import { generateHandout, HandoutError, PDFDocument, notesAreaWouldBeEmpty, sourceAspectRatioOfDocument } from "./pdfEngine.js?v=1.5.8";
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
  // Ratio largeur/hauteur réel du PDF chargé, utilisé pour l'avertissement "zone de notes
  // trop réduite" — voir sourceAspectRatioOfDocument dans pdfEngine.js. 16:9 par défaut
  // tant qu'aucun PDF n'est chargé (comme côté Swift).
  sourceAspectRatio: 16 / 9,
  previewReady: false,
  // Sélection de pages — spécifique au fichier chargé (voir loadSourceFile/clearSourceBtn) :
  // jamais mémorisée dans les réglages ni les préréglages, contrairement au reste de
  // `options`. `includedPages` (1-based) n'a de sens que si `useAllPages` est faux.
  useAllPages: true,
  includedPages: new Set(),
  // Vignettes du PDF source pour la fenêtre de sélection, en cache pour ce fichier une fois
  // chargées la première fois (voir loadPageThumbnails) — dataURL indexées par numéro de
  // page 1-based.
  pageThumbDataUrls: {},
  batchFiles: [], // {id, file, status, errorMessage, outputBytes}
  batchOptionsSnapshot: null,
  batchProcessing: false,
  editingPresetId: null,
  // Mode Essentiel/Avancé du panneau — persisté séparément de HandoutOptions (voir
  // loadShowAdvancedOptions dans store.js).
  showAdvancedOptions: loadShowAdvancedOptions()
};

/** Sélection effective transmise à generateHandout : `null` (toutes les pages) quand
 * `useAllPages` est vrai, pour garder le comportement historique même si `includedPages`
 * contient une sélection résiduelle d'un PDF précédent. */
function effectiveIncludedPages() {
  return state.useAllPages ? null : state.includedPages;
}

let previewGeneration = 0;
let debounceTimer = null;
// Document pdf.js actuellement affiché dans l'aperçu. pdf.js gère un worker et des caches
// internes (polices, images décodées, pages rendues) qui ne sont PAS libérés par le simple
// ramasse-miettes JS quand la variable locale `pdf` d'un appel précédent sort de portée —
// il faut appeler explicitement `.destroy()`. Voir destroyCurrentPreviewDoc() plus bas.
let currentPreviewDoc = null;
// Même principe pour le document pdf.js utilisé par la fenêtre de sélection de pages
// (vignettes du PDF source, distinct de l'aperçu du polycopié généré ci-dessus).
let pageThumbDoc = null;
let pageThumbGeneration = 0;

// ---------------------------------------------------------------------------------------
// Raccourcis DOM
// ---------------------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const el = {
  langSelect: $("langSelect"),
  themeToggleBtn: $("themeToggleBtn"),
  themePopover: $("themePopover"),
  macDownloadPrompt: $("macDownloadPrompt"),
  macDownloadBtn: $("macDownloadBtn"),
  macDownloadPopover: $("macDownloadPopover"),
  macDownloadLink: $("macDownloadLink"),
  dropZone: $("dropZone"),
  dropEmpty: document.querySelector(".drop-zone-empty"),
  dropFilled: document.querySelector(".drop-zone-filled"),
  fileInput: $("fileInput"),
  pickFileBtn: $("pickFileBtn"),
  pickAnotherBtn: $("pickAnotherBtn"),
  clearSourceBtn: $("clearSourceBtn"),
  sourceFileName: $("sourceFileName"),
  sourceSlideCount: $("sourceSlideCount"),
  pageSelectRow: $("pageSelectRow"),
  useAllPagesBtn: $("useAllPagesBtn"),
  selectPagesBtn: $("selectPagesBtn"),
  editPageSelectionBtn: $("editPageSelectionBtn"),
  pageSelectionDialog: $("pageSelectionDialog"),
  pageThumbGrid: $("pageThumbGrid"),
  selectAllPagesBtn: $("selectAllPagesBtn"),
  deselectAllPagesBtn: $("deselectAllPagesBtn"),
  pageSelectionSummary: $("pageSelectionSummary"),

  optionsPanel: $("optionsPanel"),
  modeEssentialBtn: $("modeEssentialBtn"),
  modeAdvancedBtn: $("modeAdvancedBtn"),
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
  noteLineOpacityField: $("noteLineOpacityField"),
  noteLineOpacity: $("noteLineOpacity"),
  noteLineOpacityOut: $("noteLineOpacityOut"),
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
  titlePageColorField: $("titlePageColorField"),
  titlePageFontColor: $("titlePageFontColor"),
  resetTitlePageColorBtn: $("resetTitlePageColorBtn"),
  titlePageAddBlankPageAfter: $("titlePageAddBlankPageAfter"),
  titlePageEssentialHint: $("titlePageEssentialHint"),

  headerFooterSection: $("headerFooterSection"),
  headerEnabled: $("headerEnabled"),
  headerFields: $("headerFields"),
  headerUseTitleText: $("headerUseTitleText"),
  headerTextField: $("headerTextField"),
  headerText: $("headerText"),
  footerEnabled: $("footerEnabled"),
  footerFields: $("footerFields"),
  footerUseTitleText: $("footerUseTitleText"),
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
// Thème d'apparence (Classique / Académique / Imprimerie / Funky)
// ---------------------------------------------------------------------------------------
// Miroir du système de thèmes Xcode (voir AppTheme.swift) : "classique" ne pose aucun
// attribut (comportement/couleurs par défaut, mode sombre auto conservé), les 3 autres
// posent data-theme sur <html> et les couleurs sont définies dans style.css. Le choix
// est déjà appliqué de façon synchrone par le petit script inline dans index.html
// (avant le premier rendu) — ce bloc ne fait que garder le popover et le libellé
// "sélectionné" synchronisés avec ce choix.
const THEME_STORAGE_KEY = "polycopie-theme";

function getTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || "classique";
  } catch (e) {
    return "classique";
  }
}

function setTheme(value) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch (e) {}
  if (value === "classique") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", value);
  }
  updateThemeSwatchSelection();
}

function updateThemeSwatchSelection() {
  const current = getTheme();
  document.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.themeValue === current);
  });
}

function openThemePopover() {
  el.themePopover.hidden = false;
  el.themeToggleBtn.setAttribute("aria-expanded", "true");
}

function closeThemePopover() {
  el.themePopover.hidden = true;
  el.themeToggleBtn.setAttribute("aria-expanded", "false");
}

if (el.themeToggleBtn && el.themePopover) {
  updateThemeSwatchSelection();

  el.themeToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (el.themePopover.hidden) {
      openThemePopover();
    } else {
      closeThemePopover();
    }
  });

  document.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTheme(btn.dataset.themeValue);
      closeThemePopover();
    });
  });

  document.addEventListener("click", (event) => {
    if (!el.themePopover.hidden && !el.themePopover.contains(event.target) && event.target !== el.themeToggleBtn) {
      closeThemePopover();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.themePopover.hidden) {
      closeThemePopover();
    }
  });
}

// ---------------------------------------------------------------------------------------
// Proposition de téléchargement de l'app Mac (discrète, visible aux visiteurs Mac
// uniquement — l'icône reste dans l'en-tête en permanence, pour un accès différé si
// l'utilisateur ferme le popover sans télécharger tout de suite).
// ---------------------------------------------------------------------------------------
// TODO : remplacer par la vraie URL de téléchargement (ex. lien direct vers le .dmg,
// ou une page de renvoi) une fois l'app publiée quelque part.
const MAC_APP_DOWNLOAD_URL = "#";

function isMacVisitor() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /mac/i.test(platform) || /Macintosh/i.test(navigator.userAgent || "");
}

if (el.macDownloadPrompt && isMacVisitor()) {
  el.macDownloadPrompt.hidden = false;
  el.macDownloadLink.href = MAC_APP_DOWNLOAD_URL;

  el.macDownloadBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = el.macDownloadPopover.hidden;
    el.macDownloadPopover.hidden = !willOpen;
    el.macDownloadBtn.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (event) => {
    if (
      !el.macDownloadPopover.hidden &&
      !el.macDownloadPopover.contains(event.target) &&
      event.target !== el.macDownloadBtn
    ) {
      el.macDownloadPopover.hidden = true;
      el.macDownloadBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.macDownloadPopover.hidden) {
      el.macDownloadPopover.hidden = true;
      el.macDownloadBtn.setAttribute("aria-expanded", "false");
    }
  });
}

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
  el.noteLineOpacity.value = String(options.noteLineColor.a);

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
  el.titlePageAddBlankPageAfter.checked = options.titlePageAddBlankPageAfter;

  el.headerEnabled.checked = options.headerEnabled;
  el.headerUseTitleText.checked = options.headerSource === "titlePageText";
  el.headerText.value = options.headerText;
  el.footerEnabled.checked = options.footerEnabled;
  el.footerUseTitleText.checked = options.footerSource === "titlePageText";
  el.footerText.value = options.footerText;

  el.showPageNumbers.checked = options.showPageNumbers;
  el.pageNumberIncludesTitlePage.checked = options.pageNumberIncludesTitlePage;
  el.showSlideNumbers.checked = options.showSlideNumbers;

  updateConditionalVisibility();
}

/** Bascule tous les champs marqués `.advanced-only` / `.essential-only` selon le mode
 * courant — équivalent du `if showAdvancedOptions { ... } else { ... }` côté Swift. */
function applyModeVisibility() {
  const advanced = state.showAdvancedOptions;
  el.modeEssentialBtn.classList.toggle("active", !advanced);
  el.modeAdvancedBtn.classList.toggle("active", advanced);
  document.querySelectorAll(".advanced-only").forEach((node) => node.classList.toggle("hidden", !advanced));
  document.querySelectorAll(".essential-only").forEach((node) => node.classList.toggle("hidden", advanced));
}

function colorsRoughlyEqual(a, b) {
  return rgb01ToHex(a) === rgb01ToHex(b) && Math.abs(a.a - b.a) < 0.01;
}

function updateConditionalVisibility() {
  applyModeVisibility();

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
  el.noteLineColorField.classList.toggle("hidden", options.noteLineStyle === "none");
  el.noteLineOpacityField.classList.toggle("hidden", options.noteLineStyle === "none");
  el.resetNoteLineColorBtn.classList.toggle("hidden", colorsRoughlyEqual(options.noteLineColor, DEFAULT_NOTE_LINE_COLOR));

  const warn = notesAreaWouldBeEmpty(options, state.sourceAspectRatio);
  el.notesAreaWarning.classList.toggle("hidden", !warn);

  el.titlePageFields.classList.toggle("hidden", !options.titlePageEnabled);
  el.textPositionField.classList.toggle("hidden", !options.titlePageIncludesFirstSlide);
  el.titlePageEssentialHint.textContent = options.titlePageIncludesFirstSlide
    ? t("La première diapositive sera utilisée comme page de titre.")
    : t("Une page de titre sera ajoutée avant vos diapositives.");
  el.resetTitlePageColorBtn.classList.toggle("hidden", colorsRoughlyEqual(options.titlePageFontColor, DEFAULT_TITLE_TEXT_COLOR));

  el.headerFields.classList.toggle("hidden", !options.headerEnabled);
  el.headerTextField.classList.toggle("hidden", options.headerSource === "titlePageText");
  el.footerFields.classList.toggle("hidden", !options.footerEnabled);
  el.footerTextField.classList.toggle("hidden", options.footerSource === "titlePageText");
  el.headerFooterHint.classList.toggle("hidden", !(options.headerEnabled || options.footerEnabled));

  el.pageNumberIncludesTitlePageField.classList.toggle(
    "hidden",
    !(state.showAdvancedOptions && options.showPageNumbers && options.titlePageEnabled)
  );

  el.boldToggle.classList.toggle("active", options.titlePageFontWeight === "bold");
  el.italicToggle.classList.toggle("active", options.titlePageFontItalic);

  el.slideScaleOut.textContent = `${Math.round(options.slideScale * 100)} %`;
  el.lineSpacingOut.textContent = `${Math.round(options.lineSpacingPoints)} pt`;
  el.marginOut.textContent = `${Math.round(options.marginPoints)} pt`;
  el.titleFontSizeOut.textContent = `${Math.round(options.titlePageFontSize)} pt`;
  el.noteLineOpacityOut.textContent = `${Math.round(options.noteLineColor.a * 100)} %`;
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
  options.noteLineColor = { ...hexToRgb01(el.noteLineColor.value), a: options.noteLineColor.a };
  onOptionsChanged();
});
el.noteLineOpacity.addEventListener("input", () => {
  options.noteLineColor = { ...options.noteLineColor, a: parseFloat(el.noteLineOpacity.value) };
  onOptionsChanged();
});
el.resetNoteLineColorBtn.addEventListener("click", () => {
  options.noteLineColor = { ...DEFAULT_NOTE_LINE_COLOR };
  el.noteLineColor.value = rgb01ToHex(options.noteLineColor);
  el.noteLineOpacity.value = String(options.noteLineColor.a);
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
el.resetTitlePageColorBtn.addEventListener("click", () => {
  options.titlePageFontColor = { ...DEFAULT_TITLE_TEXT_COLOR };
  el.titlePageFontColor.value = rgb01ToHex(options.titlePageFontColor);
  onOptionsChanged();
});
bindCheckbox(el.titlePageAddBlankPageAfter, "titlePageAddBlankPageAfter");

el.boldToggle.addEventListener("click", () => {
  options.titlePageFontWeight = options.titlePageFontWeight === "bold" ? "regular" : "bold";
  onOptionsChanged();
});
el.italicToggle.addEventListener("click", () => {
  options.titlePageFontItalic = !options.titlePageFontItalic;
  onOptionsChanged();
});

bindCheckbox(el.showPageNumbers, "showPageNumbers");
bindCheckbox(el.pageNumberIncludesTitlePage, "pageNumberIncludesTitlePage");
bindCheckbox(el.showSlideNumbers, "showSlideNumbers");

// ---------------------------------------------------------------------------------------
// En-tête / Pied de page
// ---------------------------------------------------------------------------------------

bindCheckbox(el.headerEnabled, "headerEnabled");
el.headerUseTitleText.addEventListener("change", () => {
  options.headerSource = el.headerUseTitleText.checked ? "titlePageText" : "custom";
  onOptionsChanged();
});
el.headerText.addEventListener("input", () => {
  options.headerText = el.headerText.value;
  onOptionsChanged();
});

bindCheckbox(el.footerEnabled, "footerEnabled");
el.footerUseTitleText.addEventListener("change", () => {
  options.footerSource = el.footerUseTitleText.checked ? "titlePageText" : "custom";
  onOptionsChanged();
});
el.footerText.addEventListener("input", () => {
  options.footerText = el.footerText.value;
  onOptionsChanged();
});

// ---------------------------------------------------------------------------------------
// Mode Essentiel / Avancé
// ---------------------------------------------------------------------------------------

function setAdvancedMode(value) {
  state.showAdvancedOptions = value;
  saveShowAdvancedOptions(value);
  updateConditionalVisibility();
}
el.modeEssentialBtn.addEventListener("click", () => setAdvancedMode(false));
el.modeAdvancedBtn.addEventListener("click", () => setAdvancedMode(true));

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

// Certains clients mail (ex. glisser une pièce jointe depuis Apple Mail) exposent le
// nom de fichier tel quel depuis l'en-tête MIME, encodé en "encoded-word" RFC 2047
// (ex. "=?utf-8?B?....?=") — parfois replié sur plusieurs lignes avec des sauts
// quoted-printable ("=0D=0A" ou sa forme pourcent-encodée "=%0d%0a"). Le navigateur ne
// décode jamais ça lui-même : sans ce décodeur, le nom brut s'affiche tel quel.
function decodeMimeEncodedFilename(name) {
  if (!name || name.indexOf("=?") === -1) return name;
  try {
    const openingPattern = /=\?([\w-]+)\?([BbQq])\?/;
    const firstOpen = name.match(openingPattern);
    if (!firstOpen) return name;
    const [, charset, encoding] = firstOpen;

    const prefix = name.slice(0, firstOpen.index);
    let rest = name.slice(firstOpen.index);

    // Isole un éventuel suffixe non encodé après le DERNIER "?=" (ex. l'extension ".pdf").
    const lastClose = rest.lastIndexOf("?=");
    let suffix = "";
    if (lastClose !== -1) {
      suffix = rest.slice(lastClose + 2);
      rest = rest.slice(0, lastClose);
    }

    // Le pli (line folding) peut être malformé et rouvrir un nouveau marqueur
    // "=?charset?B?" en plein milieu d'un mot encodé, sans balise de fermeture propre
    // avant (voir capture d'écran) — plutôt que de chercher des paires "=?...?=" bien
    // formées, on retire tous les marqueurs d'ouverture/fermeture et artefacts de pli
    // rencontrés, et on décode le reste comme une seule charge utile continue.
    const payload = rest
      .replace(/=\?[\w-]+\?[BbQq]\?/g, "")
      .replace(/\?=/g, "")
      .replace(/=(?:0d|0D)=(?:0a|0A)/g, "")
      .replace(/=%(?:0d|0D)%(?:0a|0A)/g, "")
      .replace(/\s+/g, "");

    return prefix + decodeMimeWord(charset, encoding, payload) + suffix;
  } catch (e) {
    // En cas de format inattendu, on préfère afficher le nom brut plutôt que planter.
    return name;
  }
}

function decodeMimeWord(charset, encoding, text) {
  if (encoding.toLowerCase() === "b") {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder(charset || "utf-8").decode(bytes);
  }
  // Encodage "Q" (quoted-printable adapté aux en-têtes) : "_" = espace, "=XX" = octet hex.
  const withSpaces = text.replace(/_/g, " ");
  const byteValues = [];
  for (let i = 0; i < withSpaces.length; i++) {
    if (withSpaces[i] === "=" && i + 2 < withSpaces.length) {
      byteValues.push(parseInt(withSpaces.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      byteValues.push(withSpaces.charCodeAt(i));
    }
  }
  return new TextDecoder(charset || "utf-8").decode(Uint8Array.from(byteValues));
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
    state.sourceAspectRatio = sourceAspectRatioOfDocument(doc);
    state.previewReady = false;
    // Une sélection de pages est spécifique au fichier chargé : un nouveau PDF repart
    // systématiquement sur "toutes les pages" plutôt que de réutiliser une sélection qui
    // n'aurait plus de sens sur un autre document.
    state.useAllPages = true;
    state.includedPages = new Set();
    state.pageThumbDataUrls = {};

    el.dropEmpty.classList.add("hidden");
    el.dropFilled.classList.remove("hidden");
    el.sourceFileName.textContent = decodeMimeEncodedFilename(file.name);
    el.sourceSlideCount.textContent = slideCountLabel(pageCount);
    el.pageSelectRow.classList.toggle("hidden", pageCount <= 1);
    setUseAllPages(true, { silent: true });

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
  state.sourceAspectRatio = 16 / 9;
  state.previewReady = false;
  state.useAllPages = true;
  state.includedPages = new Set();
  state.pageThumbDataUrls = {};

  el.dropEmpty.classList.remove("hidden");
  el.dropFilled.classList.add("hidden");
  el.pageSelectRow.classList.add("hidden");
  setUseAllPages(true, { silent: true });
  el.optionsPanel.classList.add("hidden");
  el.exportBtn.classList.add("hidden");
  el.toolbar.classList.add("hidden");
  clearPreview();
  hideError();
  updateConditionalVisibility();
});

// ---------------------------------------------------------------------------------------
// Sélection de pages
// ---------------------------------------------------------------------------------------

function updatePageSelectionSummaryBtn() {
  const text = t("%d sur %d sélectionnées")
    .replace("%d", state.includedPages.size)
    .replace("%d", state.sourcePageCount);
  el.editPageSelectionBtn.textContent = text;
}

/** Bascule entre "toutes les pages" et "sélection manuelle". Ouvre automatiquement la
 * fenêtre de sélection la première fois qu'on passe en mode manuel (toutes les pages
 * cochées par défaut) — `silent` évite de redéclencher une régénération d'aperçu quand
 * l'appel vient d'une remise à zéro (nouveau PDF / retrait du PDF), qui va de toute façon
 * régénérer ou effacer l'aperçu juste après. */
function setUseAllPages(value, { silent = false } = {}) {
  state.useAllPages = value;
  el.useAllPagesBtn.classList.toggle("active", value);
  el.selectPagesBtn.classList.toggle("active", !value);
  el.editPageSelectionBtn.classList.toggle("hidden", value);

  if (!value) {
    if (state.includedPages.size === 0 && state.sourcePageCount > 0) {
      state.includedPages = new Set(Array.from({ length: state.sourcePageCount }, (_, i) => i + 1));
    }
    updatePageSelectionSummaryBtn();
  }

  if (!silent) {
    scheduleRegeneratePreview();
    if (!value) openPageSelectionDialog();
  }
}

el.useAllPagesBtn.addEventListener("click", () => setUseAllPages(true));
el.selectPagesBtn.addEventListener("click", () => setUseAllPages(false));
el.editPageSelectionBtn.addEventListener("click", () => openPageSelectionDialog());

function updatePageSelectionSummary() {
  el.pageSelectionSummary.textContent = t("%d sur %d diapositives sélectionnées")
    .replace("%d", state.includedPages.size)
    .replace("%d", state.sourcePageCount);
}

/** Bascule l'inclusion d'une page et met à jour la cellule concernée (classe CSS + coche)
 * sans reconstruire toute la grille, plus le résumé et l'aperçu. */
function togglePageIncluded(pageIndex, cellEl) {
  if (state.includedPages.has(pageIndex)) {
    state.includedPages.delete(pageIndex);
  } else {
    state.includedPages.add(pageIndex);
  }
  const included = state.includedPages.has(pageIndex);
  cellEl.classList.toggle("included", included);
  cellEl.classList.toggle("excluded", !included);
  cellEl.querySelector(".page-thumb-check").textContent = included ? "✓" : "";
  updatePageSelectionSummary();
  updatePageSelectionSummaryBtn();
  scheduleRegeneratePreview();
}

function buildThumbCell(pageIndex) {
  const included = state.includedPages.has(pageIndex);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `page-thumb ${included ? "included" : "excluded"}`;

  const frame = document.createElement("div");
  frame.className = "page-thumb-frame";

  const check = document.createElement("span");
  check.className = "page-thumb-check";
  check.textContent = included ? "✓" : "";
  frame.appendChild(check);

  const number = document.createElement("span");
  number.className = "page-thumb-number";
  number.textContent = String(pageIndex);

  button.append(frame, number);
  button.addEventListener("click", () => togglePageIncluded(pageIndex, button));
  return { button, frame };
}

/** Charge les vignettes du PDF source une par une (pdf.js), pour que la grille se remplisse
 * progressivement sur un document de plusieurs dizaines de pages sans geler l'ouverture de
 * la fenêtre — même principe que renderPreview. Les vignettes déjà rendues pour ce fichier
 * sont réutilisées (voir state.pageThumbDataUrls), donc rouvrir la fenêtre est instantané. */
async function loadPageThumbnails() {
  if (!state.sourceBytes) return;
  const myGeneration = ++pageThumbGeneration;

  el.pageThumbGrid.innerHTML = "";
  const cells = {};
  for (let pageIndex = 1; pageIndex <= state.sourcePageCount; pageIndex++) {
    const { button, frame } = buildThumbCell(pageIndex);
    el.pageThumbGrid.appendChild(button);
    cells[pageIndex] = frame;
    const cached = state.pageThumbDataUrls[pageIndex];
    if (cached) {
      const img = document.createElement("img");
      img.src = cached;
      img.alt = "";
      frame.appendChild(img);
    }
  }

  const missing = Array.from({ length: state.sourcePageCount }, (_, i) => i + 1)
    .filter((pageIndex) => !state.pageThumbDataUrls[pageIndex]);
  if (missing.length === 0) return;

  // On passe une copie à pdf.js : il arrive que pdf.js transfère (au lieu de copier) le
  // buffer sous-jacent vers son worker, ce qui viderait state.sourceBytes — or ce même
  // tableau est réutilisé ensuite par pdf-lib (generateHandout) pour produire le polycopié.
  const loadingTask = pdfjsLib.getDocument({ data: state.sourceBytes.slice() });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch {
    try { loadingTask.destroy(); } catch { /* déjà détruite/résolue, sans conséquence */ }
    return;
  }
  if (myGeneration !== pageThumbGeneration) { pdf.destroy(); return; }
  if (pageThumbDoc) pageThumbDoc.destroy();
  pageThumbDoc = pdf;

  const scale = 0.35;
  for (const pageIndex of missing) {
    if (myGeneration !== pageThumbGeneration) return;
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    if (myGeneration !== pageThumbGeneration) return;

    const dataUrl = canvas.toDataURL("image/png");
    state.pageThumbDataUrls[pageIndex] = dataUrl;
    const frame = cells[pageIndex];
    if (frame && !frame.querySelector("img")) {
      const img = document.createElement("img");
      img.src = dataUrl;
      img.alt = "";
      frame.appendChild(img);
    }
  }
}

function openPageSelectionDialog() {
  updatePageSelectionSummary();
  el.pageSelectionDialog.showModal();
  loadPageThumbnails();
}

el.selectAllPagesBtn.addEventListener("click", () => {
  state.includedPages = new Set(Array.from({ length: state.sourcePageCount }, (_, i) => i + 1));
  el.pageThumbGrid.querySelectorAll(".page-thumb").forEach((cellEl, i) => {
    cellEl.classList.add("included");
    cellEl.classList.remove("excluded");
    cellEl.querySelector(".page-thumb-check").textContent = "✓";
  });
  updatePageSelectionSummary();
  updatePageSelectionSummaryBtn();
  scheduleRegeneratePreview();
});
el.deselectAllPagesBtn.addEventListener("click", () => {
  state.includedPages = new Set();
  el.pageThumbGrid.querySelectorAll(".page-thumb").forEach((cellEl) => {
    cellEl.classList.remove("included");
    cellEl.classList.add("excluded");
    cellEl.querySelector(".page-thumb-check").textContent = "";
  });
  updatePageSelectionSummary();
  updatePageSelectionSummaryBtn();
  scheduleRegeneratePreview();
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

function destroyCurrentPreviewDoc() {
  if (!currentPreviewDoc) return;
  const doc = currentPreviewDoc;
  currentPreviewDoc = null;
  doc.destroy();
}

function clearPreview() {
  destroyCurrentPreviewDoc();
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
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    // Le chargement a échoué (ou a été abandonné) : rien à afficher, mais la tâche a pu
    // réserver des ressources (worker, tampons) qu'il faut quand même relâcher.
    try { loadingTask.destroy(); } catch { /* déjà détruite/résolue, sans conséquence */ }
    throw err;
  }
  if (myGeneration !== previewGeneration) {
    // Un aperçu plus récent a déjà été demandé pendant ce chargement : celui-ci est
    // obsolète avant même d'avoir servi, on le détruit tout de suite plutôt que d'attendre
    // le ramasse-miettes (qui ne libère jamais les ressources internes de pdf.js).
    pdf.destroy();
    return;
  }

  // Remplace le document affiché : l'ancien (s'il y en a un) n'est plus référencé nulle
  // part après ceci, donc on le détruit maintenant. C'est ce destroy() qui manquait et qui
  // causait la fuite mémoire — chaque réglage modifié régénère l'aperçu, donc sans lui un
  // nouveau document pdf.js (worker + caches) s'accumulait à chaque fois, jamais libéré.
  destroyCurrentPreviewDoc();
  currentPreviewDoc = pdf;

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
    const bytes = await generateHandout(state.sourceBytes, options, undefined, effectiveIncludedPages());
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
  const base = decodeMimeEncodedFilename(sourceName).replace(/\.pdf$/i, "");
  return `${base}${t("-polycopié.pdf")}`;
}

async function doExport() {
  if (!state.sourceBytes) return;
  hideError();
  try {
    const bytes = await generateHandout(state.sourceBytes, options, undefined, effectiveIncludedPages());
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
    name.textContent = decodeMimeEncodedFilename(entry.file.name);
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
