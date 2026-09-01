# Polycopié — Web

Version 100% web (HTML/CSS/JS, sans étape de build) de l'app macOS **Polycopié / Handout
Maker** : génère un polycopié imprimable (diapositives + zone de prise de notes) à partir
d'un PDF exporté depuis PowerPoint/Keynote/Slides.

Tout le traitement se fait **dans le navigateur** (pdf-lib pour générer le PDF, pdf.js pour
l'aperçu, JSZip pour le traitement par lot) : aucun fichier n'est envoyé à un serveur.

## Nouveautés v1.3

- Mode **Essentiel / Avancé** (comme la version macOS) : le panneau d'options masque par
  défaut les réglages fins (police/couleur/position du texte de la page de titre, style et
  couleur des lignes de notes, en-tête/pied de page, numérotation de la page de titre) et ne
  les affiche qu'en mode Avancé. Le choix est mémorisé (`localStorage`), comme le reste des
  réglages.
- Page blanche optionnelle après la page de titre, pratique pour l'impression recto-verso
  (le contenu démarre alors toujours sur une page de droite) — port de
  `titlePageAddBlankPageAfter`.
- Corrections d'affichage : un `<fieldset>` ou un `<select>` n'a plus de largeur minimale
  imposée par son contenu, ce qui pouvait provoquer un débordement horizontal de la barre
  latérale avec un libellé long (l'anglais est souvent plus long que le français) ; sur
  petit écran, le panneau d'options est maintenant plafonné en hauteur (avec son propre
  défilement) pour que l'aperçu du PDF reste visible sans avoir à tout faire défiler d'abord.

## Nouveautés v1.2

- Style de ligne des zones de notes : continue, tirets, pointillés, ou sans ligne (zone
  vierge) — avec couleur et opacité personnalisables.
- En-tête et pied de page texte, avec option de reprendre automatiquement le texte de la
  page de titre ; jamais affichés sur la page de titre elle-même.
- La page de titre peut être exclue de la numérotation des pages (les pages de contenu
  redémarrent alors à 1).
- Format de papier Legal (US).
- Avertissement dans le panneau de réglages quand la zone de notes serait trop réduite pour
  afficher des lignes.
- Numéro de page ancré dans le coin en bas à droite (avec marge de sécurité) quand un texte
  de pied de page est également affiché, pour éviter tout chevauchement.

## Déploiement sur GitHub Pages

1. Poussez le contenu de ce dossier à la racine d'un dépôt GitHub (ou dans un sous-dossier
   `/docs`, voir plus bas).
2. Sur GitHub : **Settings → Pages**.
3. Sous **Build and deployment → Source**, choisissez **Deploy from a branch**.
4. Choisissez la branche (`main`) et le dossier (`/root` si les fichiers sont à la racine,
   `/docs` si vous les avez mis dans un sous-dossier `docs/`).
5. Enregistrez. L'app est publiée en 1 à 2 minutes à l'adresse
   `https://<votre-utilisateur>.github.io/<nom-du-dépôt>/`.

Aucune étape de build, aucun `npm install` : ce sont des fichiers statiques, servis tels
quels.

## Structure

```
index.html          Page principale
css/style.css        Styles
js/i18n.js            Traductions fr/en
js/store.js           Modèle des réglages + préréglages (localStorage)
js/pdfEngine.js        Génération du PDF (port de HandoutGenerator.swift)
js/app.js              UI, aperçu, export, traitement par lot
```

## Notes techniques

- Les librairies (pdf-lib, pdf.js, JSZip) sont chargées depuis un CDN (esm.sh) : une
  connexion Internet est nécessaire au premier chargement de la page. Le navigateur les met
  ensuite en cache.
- Rendu du texte de page de titre : pdf-lib ne dispose que des polices PDF standard
  (Helvetica, Times, Courier...). « Georgia » n'existe pas nativement et retombe sur une
  police serif (Times), comme le ferait macOS avec une police non installée.
- Les préréglages et les derniers réglages utilisés sont stockés dans le `localStorage` du
  navigateur (par domaine) — ils ne sont pas synchronisés entre appareils.
