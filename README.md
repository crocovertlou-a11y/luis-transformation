# Module Nutrition — Luis Transformation

## Ce que contient cette version
- journal par repas ;
- recherche locale d'aliments ;
- quantités en grammes ;
- calcul des calories, protéines, glucides et lipides ;
- objectif personnel de 2 400 kcal et 170 g de protéines ;
- création d'aliments personnalisés ;
- stockage hors ligne dans le navigateur ;
- fonctionnement PWA grâce au service worker.

## Installation la plus simple sur Netlify
1. Décompresser le ZIP.
2. Aller dans Netlify > Sites > Add new site > Deploy manually.
3. Glisser le dossier décompressé dans la zone de déploiement.
4. Ouvrir l'adresse Netlify sur l'iPhone.
5. Safari > Partager > Sur l'écran d'accueil.

## Intégration dans le projet existant
- Copier les fichiers dans un dossier `nutrition/` du dépôt existant.
- Ajouter un lien vers `nutrition/index.html` dans la navigation principale.
- Si le projet possède déjà un manifest et un service worker, conserver ceux du projet principal et ajouter les fichiers du dossier Nutrition à sa liste de cache.
- Pour fusionner l'écran directement dans une SPA React/Vue, reprendre la logique de `app.js` et le style de `styles.css` dans un composant dédié.

## Limites actuelles
Cette version utilise une base locale. Le scanner de code-barres et la recherche mondiale d'aliments nécessitent ensuite l'ajout d'une API alimentaire, par exemple Open Food Facts.
