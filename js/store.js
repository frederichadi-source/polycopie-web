// Polycopié — Web
// Port de HandoutOptions + PresetStore (macOS) : modèle de réglages, valeurs par défaut,
// et persistance dans localStorage (préréglages + derniers réglages utilisés).

/** Valeurs par défaut, identiques à `HandoutOptions()` côté Swift. */
export function defaultOptions() {
  return {
    slidesPerPage: 3,
    noteStyle: "linesBeside", // none | linesBelow | linesBeside | linesAround
    pageSize: "letter", // letter | a4 | legal
    orientation: "portrait", // portrait | landscape
    gridArrangement: "automatic", // automatic | stacked | sideBySide
    showPageNumbers: true,
    showSlideNumbers: true,
    marginPoints: 28,
    lineSpacingPoints: 22,
    slideScale: 0.8,
    titlePageEnabled: false,
    titlePageIncludesFirstSlide: true,
    titlePageText: "",
    titlePageTextPosition: "belowSlide", // belowSlide | aboveSlide
    titlePageTextAlignment: "center", // left | center | right
    titlePageFont: "system", // system | serif | helvetica | georgia | courier
    titlePageFontWeight: "regular", // regular | bold
    titlePageFontItalic: false,
    titlePageFontSize: 15,
    titlePageFontColor: { r: 0, g: 0, b: 0, a: 1 },
    // Page entièrement blanche insérée après la page de titre (impression recto-verso) —
    // n'incrémente pas la numérotation des pages, voir pdfEngine.js.
    titlePageAddBlankPageAfter: false,

    // Style/couleur des lignes de la zone de notes — indépendant de `noteStyle`, qui ne
    // décrit que la disposition. "none" = zone réservée mais laissée vierge.
    noteLineStyle: "solid", // none | solid | dashed | dotted
    noteLineColor: { r: 0.75, g: 0.75, b: 0.75, a: 1 },

    // En-tête / pied de page : jamais affichés sur la page de titre (voir pdfEngine.js).
    headerEnabled: false,
    headerText: "",
    headerSource: "custom", // custom | titlePageText
    footerEnabled: false,
    footerText: "",
    footerSource: "custom", // custom | titlePageText

    // Si vrai (comportement historique), la page de titre est la page 1 et le contenu
    // continue à partir de 2. Si faux, la page de titre n'affiche aucun numéro et le
    // contenu redémarre à 1.
    pageNumberIncludesTitlePage: true
  };
}

// Couleurs par défaut, réutilisées par les boutons de réinitialisation du panneau.
export const DEFAULT_TITLE_TEXT_COLOR = { r: 0, g: 0, b: 0, a: 1 };
export const DEFAULT_NOTE_LINE_COLOR = { r: 0.75, g: 0.75, b: 0.75, a: 1 };

// --- Grilles par nombre de diapositives/page (columns, rows), voir SlidesPerPage.swift ---
const STACKED_GRID = { 1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [2, 2], 6: [2, 3], 9: [3, 3] };

function sideBySideGrid(n) {
  const [c, r] = STACKED_GRID[n];
  return [r, c];
}

export function hasArrangementChoice(n) {
  const [c, r] = STACKED_GRID[n];
  return c !== r;
}

export function resolvedGrid(options) {
  const n = options.slidesPerPage;
  switch (options.gridArrangement) {
    case "stacked": {
      const [c, r] = STACKED_GRID[n];
      return { columns: c, rows: r };
    }
    case "sideBySide": {
      const [c, r] = sideBySideGrid(n);
      return { columns: c, rows: r };
    }
    default: {
      const [c, r] = options.orientation === "landscape" ? sideBySideGrid(n) : STACKED_GRID[n];
      return { columns: c, rows: r };
    }
  }
}

// Tailles en points (72 pts/pouce), en orientation portrait — voir HandoutPageSize côté Swift.
const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 },
  legal: { width: 612, height: 1008 }
};

export function resolvedPageSize(options) {
  const base = PAGE_SIZES[options.pageSize] || PAGE_SIZES.letter;
  return options.orientation === "portrait" ? base : { width: base.height, height: base.width };
}

// --- Mode Essentiel / Avancé du panneau d'options ---
// Volontairement hors de HandoutOptions (comme @AppStorage côté Swift) : c'est un réglage
// d'affichage du panneau, pas un réglage de mise en page — il ne doit pas être enregistré
// dans les préréglages ni voyager avec eux.

const ADVANCED_MODE_KEY = "handoutShowAdvancedOptions";

export function loadShowAdvancedOptions() {
  try {
    return localStorage.getItem(ADVANCED_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveShowAdvancedOptions(value) {
  try {
    localStorage.setItem(ADVANCED_MODE_KEY, value ? "true" : "false");
  } catch {
    // Stockage indisponible : on continue sans persister.
  }
}

// --- Derniers réglages utilisés (auto-sauvegardés à chaque changement) ---

const LAST_USED_KEY = "handoutLastUsedOptions";

export function loadLastUsed() {
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    if (!raw) return defaultOptions();
    const decoded = { ...defaultOptions(), ...JSON.parse(raw) };
    // Le texte de la page de titre n'est volontairement jamais conservé d'une session à
    // l'autre (voir le commentaire équivalent dans HandoutOptions.loadLastUsed côté Swift).
    decoded.titlePageText = "";
    return decoded;
  } catch {
    return defaultOptions();
  }
}

export function saveAsLastUsed(options) {
  try {
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(options));
  } catch {
    // Stockage plein ou indisponible (navigation privée) : on continue sans persister.
  }
}

// --- Préréglages nommés ---

const PRESETS_KEY = "handoutPresets";

function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class PresetStore extends EventTarget {
  constructor() {
    super();
    this.presets = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _persist() {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(this.presets));
    } catch {
      // ignore
    }
    this.dispatchEvent(new Event("change"));
  }

  save(name, options) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const preset = { id: uuid(), name: trimmed, options: { ...options } };
    this.presets.push(preset);
    this._persist();
    return preset;
  }

  rename(id, newName) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    preset.name = trimmed;
    this._persist();
  }

  duplicate(id, copyWord) {
    const index = this.presets.findIndex((p) => p.id === id);
    if (index === -1) return null;
    const original = this.presets[index];
    const copy = { id: uuid(), name: `${copyWord} ${original.name}`, options: { ...original.options } };
    this.presets.splice(index + 1, 0, copy);
    this._persist();
    return copy;
  }

  delete(id) {
    this.presets = this.presets.filter((p) => p.id !== id);
    this._persist();
  }
}
