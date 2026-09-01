# Polycopié — Web

Version 100% web (HTML/CSS/JS, sans étape de build) de l'app macOS **Polycopié / Handout
Maker** : génère un polycopié imprimable (diapositives + zone de prise de notes) à partir
d'un PDF exporté depuis PowerPoint/Keynote/Slides.

Tout le traitement se fait **dans le navigateur** (pdf-lib pour générer le PDF, pdf.js pour
l'aperçu, JSZip pour le traitement par lot) : aucun fichier n'est envoyé à un serveur.

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
