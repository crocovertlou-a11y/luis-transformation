# Luis Transformation — MVP PWA

Application web mobile statique pour suivre la recomposition corporelle, la musculation, la course, la nutrition et les compléments.

## Ce qui est réellement inclus

- Tableau de bord quotidien et objectifs hebdomadaires
- Saisie du poids, tour de taille, sommeil, stress, énergie, faim et eau
- Suivi de la créatine, protéines en poudre et autres compléments
- Journal de musculation et journal de course
- Suivi simplifié des protéines et de la qualité alimentaire
- Historique et graphiques sur les 30 dernières valeurs
- Export et import au format JSON
- Enregistrement local dans le navigateur, sans compte
- Mode hors ligne après la première ouverture
- Manifest PWA et icônes pour installation sur iPhone
- Configuration Netlify incluse

## Déploiement Netlify — méthode la plus simple

1. Décompresser le dossier `luis-transformation`.
2. Se connecter à Netlify.
3. Ouvrir **Sites** puis **Add new site** / **Deploy manually**.
4. Glisser-déposer le dossier complet dans la zone de déploiement.
5. Attendre l’affichage de l’adresse HTTPS fournie par Netlify.
6. Ouvrir cette adresse sur l’iPhone dans Safari.

Aucune commande de build n’est nécessaire. Le dossier publié est la racine du projet.

## Déploiement via GitHub

1. Créer un dépôt GitHub vide.
2. Ajouter tous les fichiers du dossier à la racine du dépôt.
3. Dans Netlify : **Add new site** > **Import an existing project** > GitHub.
4. Sélectionner le dépôt.
5. Laisser la commande de build vide.
6. Mettre le répertoire de publication sur `.` si Netlify le demande.
7. Déployer.

## Installation sur l’écran d’accueil de l’iPhone

1. Ouvrir l’URL Netlify dans **Safari**.
2. Toucher l’icône **Partager** en bas de l’écran.
3. Faire défiler et choisir **Sur l’écran d’accueil**.
4. Vérifier le nom « Luis Transformation » puis toucher **Ajouter**.
5. Lancer ensuite l’application depuis son icône.

## Stockage et sauvegarde

Les données sont stockées dans le navigateur de l’appareil avec `localStorage`.

Important :
- Supprimer les données Safari du site efface les données de l’application.
- Changer de téléphone ne transfère pas automatiquement les données.
- Utiliser régulièrement **Plus > Exporter mes données** pour créer une sauvegarde JSON.
- Le bouton **Importer des données** permet de restaurer une sauvegarde compatible.

## Fonctionnement hors ligne

Après une première ouverture réussie avec Internet, le service worker met en cache les fichiers essentiels. L’application peut ensuite être ouverte hors ligne. Les données restent locales.

## Limites volontaires du MVP

- Pas de compte utilisateur ni synchronisation cloud
- Pas de partage entre plusieurs appareils
- Pas de notifications automatiques
- Pas de connexion à Apple Health, Garmin ou Strava
- Pas de calcul avancé des calories ou macronutriments

Ces fonctions ne sont pas incluses dans cette version.
