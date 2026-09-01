// Polycopié (Handout Maker) — Web
// Dictionnaire de traduction fr/en. Les clés reprennent le texte français d'origine,
// exactement comme dans Localizable.strings de la version macOS, pour rester cohérent.

export const STRINGS = {
  // --- App ---
  "Polycopié": { fr: "Polycopié", en: "Handout Maker" },
  "Générateur de polycopiés à partir de vos diapositives PDF.": {
    fr: "Générateur de polycopiés à partir de vos diapositives PDF.",
    en: "Turns your slide PDFs into printable handouts."
  },
  "Copyright © 2026 Frédéric Hadi. Tous droits réservés.": {
    fr: "Copyright © 2026 Frédéric Hadi. Tous droits réservés.",
    en: "Copyright © 2026 Frédéric Hadi. All rights reserved."
  },

  // --- Panneau d'options ---
  "Mise en page": { fr: "Mise en page", en: "Layout" },
  "Diapositives par page": { fr: "Diapositives par page", en: "Slides per page" },
  "Disposition": { fr: "Disposition", en: "Arrangement" },
  "Actuellement : côte à côte (paysage)": { fr: "Actuellement : côte à côte (paysage)", en: "Currently: side by side (landscape)" },
  "Actuellement : empilées (portrait)": { fr: "Actuellement : empilées (portrait)", en: "Currently: stacked (portrait)" },
  "Prise de notes": { fr: "Prise de notes", en: "Note-taking" },
  "Taille de la diapositive": { fr: "Taille de la diapositive", en: "Slide size" },
  "Espacement des lignes": { fr: "Espacement des lignes", en: "Line spacing" },
  "Style de ligne": { fr: "Style de ligne", en: "Line style" },
  "Sans ligne (zone vierge)": { fr: "Sans ligne (zone vierge)", en: "No line (blank area)" },
  "Continue": { fr: "Continue", en: "Solid" },
  "Tirets": { fr: "Tirets", en: "Dashes" },
  "Pointillés": { fr: "Pointillés", en: "Dotted" },
  "Couleur des lignes": { fr: "Couleur des lignes", en: "Line color" },
  "Réinitialiser la couleur des lignes": { fr: "Réinitialiser la couleur des lignes", en: "Reset line color" },
  "Trop peu de place pour les lignes : la zone de notes restera vierge.": {
    fr: "Trop peu de place pour les lignes : la zone de notes restera vierge.",
    en: "Not enough room for lines: the notes area will remain blank."
  },
  "Papier": { fr: "Papier", en: "Paper" },
  "Format": { fr: "Format", en: "Size" },
  "Orientation": { fr: "Orientation", en: "Orientation" },
  "Marges": { fr: "Marges", en: "Margins" },
  "Options": { fr: "Options", en: "Options" },
  "Numéroter les pages": { fr: "Numéroter les pages", en: "Number the pages" },
  "La page de titre compte dans la numérotation": {
    fr: "La page de titre compte dans la numérotation",
    en: "Count the title page in the page numbering"
  },
  "Numéroter les diapositives": { fr: "Numéroter les diapositives", en: "Number the slides" },

  // --- Zone de dépôt du PDF source ---
  "Choisir un autre PDF": { fr: "Choisir un autre PDF", en: "Choose Another PDF" },
  "Glissez ici le PDF exporté de votre présentation": {
    fr: "Glissez ici le PDF exporté de votre présentation",
    en: "Drop the PDF exported from your presentation here"
  },
  "Choisir un fichier PDF...": { fr: "Choisir un fichier PDF...", en: "Choose a PDF File..." },
  "diapositive": { fr: "diapositive", en: "slide" },
  "diapositives": { fr: "diapositives", en: "slides" },

  // --- Vue principale / export ---
  "Aucun PDF sélectionné": { fr: "Aucun PDF sélectionné", en: "No PDF Selected" },
  "Choisissez un PDF pour voir l'aperçu du polycopié ici.": {
    fr: "Choisissez un PDF pour voir l'aperçu du polycopié ici.",
    en: "Choose a PDF to see the handout preview here."
  },
  "Exporter le polycopié...": { fr: "Exporter le polycopié...", en: "Export Handout..." },
  "Génération...": { fr: "Génération...", en: "Generating..." },
  "-polycopié.pdf": { fr: "-polycopié.pdf", en: "-handout.pdf" },
  "Appliquer les réglages actuels à plusieurs fichiers PDF à la fois.": {
    fr: "Appliquer les réglages actuels à plusieurs fichiers PDF à la fois.",
    en: "Apply the current settings to several PDF files at once."
  },
  "Générer et télécharger le PDF final avec les réglages actuels.": {
    fr: "Générer et télécharger le PDF final avec les réglages actuels.",
    en: "Generate and download the final PDF with the current settings."
  },

  // --- Page de titre ---
  "Page de titre": { fr: "Page de titre", en: "Title Page" },
  "Inclure la première diapositive": { fr: "Inclure la première diapositive", en: "Include the first slide" },
  "Texte additionnel (optionnel)": { fr: "Texte additionnel (optionnel)", en: "Additional text (optional)" },
  "Position du texte": { fr: "Position du texte", en: "Text position" },
  "Sous la diapositive": { fr: "Sous la diapositive", en: "Below the slide" },
  "Au-dessus de la diapositive": { fr: "Au-dessus de la diapositive", en: "Above the slide" },
  "Alignement": { fr: "Alignement", en: "Alignment" },
  "Gauche": { fr: "Gauche", en: "Left" },
  "Centré": { fr: "Centré", en: "Centered" },
  "Droite": { fr: "Droite", en: "Right" },
  "Police": { fr: "Police", en: "Font" },
  "Police système": { fr: "Police système", en: "System font" },
  "Serif": { fr: "Serif", en: "Serif" },
  "Helvetica": { fr: "Helvetica", en: "Helvetica" },
  "Georgia": { fr: "Georgia", en: "Georgia" },
  "Courier": { fr: "Courier", en: "Courier" },
  "Style": { fr: "Style", en: "Style" },
  "Gras": { fr: "Gras", en: "Bold" },
  "Italique": { fr: "Italique", en: "Italic" },
  "Taille du texte": { fr: "Taille du texte", en: "Text size" },
  "Couleur du texte": { fr: "Couleur du texte", en: "Text color" },

  // --- En-tête / Pied de page ---
  "En-tête / Pied de page": { fr: "En-tête / Pied de page", en: "Header / Footer" },
  "Afficher un texte en en-tête": { fr: "Afficher un texte en en-tête", en: "Show header text" },
  "Texte de l'en-tête": { fr: "Texte de l'en-tête", en: "Header text" },
  "Afficher un texte en pied de page": { fr: "Afficher un texte en pied de page", en: "Show footer text" },
  "Texte du pied de page": { fr: "Texte du pied de page", en: "Footer text" },
  "Utiliser le texte de la page de titre": { fr: "Utiliser le texte de la page de titre", en: "Use the title page text" },
  "Le texte est tronqué s'il ne tient pas sur une seule ligne. Jamais affiché sur la page de titre.": {
    fr: "Le texte est tronqué s'il ne tient pas sur une seule ligne. Jamais affiché sur la page de titre.",
    en: "Text is truncated if it doesn't fit on one line. Never shown on the title page."
  },

  // --- Traitement par lot ---
  "Traiter un lot...": { fr: "Traiter un lot...", en: "Process a Batch..." },
  "Traiter un lot de PDF": { fr: "Traiter un lot de PDF", en: "Process a Batch of PDFs" },
  "Aucun fichier sélectionné": { fr: "Aucun fichier sélectionné", en: "No File Selected" },
  "Choisissez ou glissez-déposez plusieurs PDF sources ici : les réglages actuels du panneau d'options leur seront appliqués à tous.": {
    fr: "Choisissez ou glissez-déposez plusieurs PDF sources ici : les réglages actuels du panneau d'options leur seront appliqués à tous.",
    en: "Choose or drag and drop multiple source PDFs here: the current settings from the options panel will be applied to all of them."
  },
  "Choisir des fichiers PDF...": { fr: "Choisir des fichiers PDF...", en: "Choose PDF Files..." },
  "Les fichiers générés seront réunis dans une archive .zip à télécharger.": {
    fr: "Les fichiers générés seront réunis dans une archive .zip à télécharger.",
    en: "The generated files will be bundled into a .zip archive to download."
  },
  "Ajouter des fichiers...": { fr: "Ajouter des fichiers...", en: "Add Files..." },
  "Fermer": { fr: "Fermer", en: "Close" },
  "Traitement...": { fr: "Traitement...", en: "Processing..." },
  "Générer tout": { fr: "Générer tout", en: "Generate All" },
  "réussi(s)": { fr: "réussi(s)", en: "succeeded" },
  "échec(s)": { fr: "échec(s)", en: "failed" },

  // --- Préréglages ---
  "Préréglages": { fr: "Préréglages", en: "Presets" },
  "Aucun préréglage": { fr: "Aucun préréglage", en: "No Presets" },
  "Enregistrer les réglages actuels...": { fr: "Enregistrer les réglages actuels...", en: "Save Current Settings..." },
  "Gérer les préréglages...": { fr: "Gérer les préréglages...", en: "Manage Presets..." },
  "Enregistrez vos réglages actuels depuis le panneau d'options pour les retrouver ici.": {
    fr: "Enregistrez vos réglages actuels depuis le panneau d'options pour les retrouver ici.",
    en: "Save your current settings from the options panel to find them here."
  },
  "Nommer le préréglage": { fr: "Nommer le préréglage", en: "Name the Preset" },
  "Nom du préréglage": { fr: "Nom du préréglage", en: "Preset name" },
  "Enregistrer": { fr: "Enregistrer", en: "Save" },
  "Dupliquer": { fr: "Dupliquer", en: "Duplicate" },
  "Renommer": { fr: "Renommer", en: "Rename" },
  "Supprimer": { fr: "Supprimer", en: "Delete" },
  "copie de": { fr: "copie de", en: "copy of" },
  "Appliquer": { fr: "Appliquer", en: "Apply" },

  // --- Langue ---
  "Langue": { fr: "Langue", en: "Language" },

  // --- Réinitialisation ---
  "Retirer le PDF": { fr: "Retirer le PDF", en: "Remove PDF" },
  "Réinitialiser les réglages": { fr: "Réinitialiser les réglages", en: "Reset Settings" },
  "Réinitialiser les réglages ?": { fr: "Réinitialiser les réglages ?", en: "Reset settings?" },
  "Réinitialiser": { fr: "Réinitialiser", en: "Reset" },
  "Annuler": { fr: "Annuler", en: "Cancel" },
  "Tous les réglages actuels seront remis à leurs valeurs par défaut. Le PDF chargé n'est pas affecté.": {
    fr: "Tous les réglages actuels seront remis à leurs valeurs par défaut. Le PDF chargé n'est pas affecté.",
    en: "All current settings will be reset to their default values. The loaded PDF is not affected."
  },

  // --- Options de mise en page (générateur) ---
  "1 diapositive / page": { fr: "1 diapositive / page", en: "1 slide / page" },
  "2 diapositives / page": { fr: "2 diapositives / page", en: "2 slides / page" },
  "3 diapositives / page": { fr: "3 diapositives / page", en: "3 slides / page" },
  "4 diapositives / page": { fr: "4 diapositives / page", en: "4 slides / page" },
  "6 diapositives / page": { fr: "6 diapositives / page", en: "6 slides / page" },
  "9 diapositives / page": { fr: "9 diapositives / page", en: "9 slides / page" },

  "Sans prise de notes": { fr: "Sans prise de notes", en: "No note-taking area" },
  "Lignes sous chaque diapositive": { fr: "Lignes sous chaque diapositive", en: "Lines below each slide" },
  "Lignes à droite (style Cornell)": { fr: "Lignes à droite (style Cornell)", en: "Lines on the right (Cornell style)" },
  "Lignes autour de la diapositive": { fr: "Lignes autour de la diapositive", en: "Lines around the slide" },

  "Letter (US)": { fr: "Letter (US)", en: "Letter (US)" },
  "A4": { fr: "A4", en: "A4" },
  "Legal (US)": { fr: "Legal (US)", en: "Legal (US)" },
  "Portrait": { fr: "Portrait", en: "Portrait" },
  "Paysage": { fr: "Paysage", en: "Landscape" },

  "Automatique": { fr: "Automatique", en: "Automatic" },
  "Empilées verticalement": { fr: "Empilées verticalement", en: "Stacked vertically" },
  "Côte à côte": { fr: "Côte à côte", en: "Side by side" },

  // --- Erreurs ---
  "Impossible d'ouvrir le PDF source.": { fr: "Impossible d'ouvrir le PDF source.", en: "Couldn't open the source PDF." },
  "Le PDF source ne contient aucune page.": { fr: "Le PDF source ne contient aucune page.", en: "The source PDF has no pages." },
  "Impossible de créer le fichier PDF de sortie.": { fr: "Impossible de créer le fichier PDF de sortie.", en: "Couldn't create the output PDF file." },
  "Ce fichier ne semble pas être un PDF valide.": { fr: "Ce fichier ne semble pas être un PDF valide.", en: "This file doesn't seem to be a valid PDF." },

  // --- Divers web ---
  "Réinitialiser": { fr: "Réinitialiser", en: "Reset" },
  "Aperçu": { fr: "Aperçu", en: "Preview" },
  "Page {n} sur {total}": { fr: "Page {n} sur {total}", en: "Page {n} of {total}" },
  "Chargement de l'aperçu...": { fr: "Chargement de l'aperçu...", en: "Loading preview..." },
  "Vos fichiers ne quittent jamais votre navigateur : tout le traitement se fait localement.": {
    fr: "Vos fichiers ne quittent jamais votre navigateur : tout le traitement se fait localement.",
    en: "Your files never leave your browser: everything is processed locally."
  }
};

let currentLang = localStorage.getItem("handoutLang") || (navigator.language || "fr").slice(0, 2);
if (currentLang !== "fr" && currentLang !== "en") currentLang = "fr";

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang === "en" ? "en" : "fr";
  localStorage.setItem("handoutLang", currentLang);
}

/** Traduit une clé (le texte français d'origine) vers la langue courante, avec
 * remplacement optionnel de jetons {clé} par les valeurs fournies. */
export function t(key, params) {
  const entry = STRINGS[key];
  let value = entry ? entry[currentLang] : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, v);
    }
  }
  return value;
}
