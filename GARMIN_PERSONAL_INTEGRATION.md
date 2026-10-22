# Garmin Personal API — Fluidité

Fonction serveur : `garmin-personal-sync-function.js`.

Variables Netlify nécessaires :
- `GARMIN_PERSONAL_API_KEY` : clé privée Garmin ; ne jamais placer dans le JavaScript client.
- `FLUIDITE_GARMIN_SYNC_CODE` : secret distinct, 16 caractères minimum. À saisir dans Profil > Synchronisation Garmin.

Les anciennes variables `GARMIN_PERSONAL_HEALTH_URL` et `GARMIN_PERSONAL_ACTIVITY_URL` ne sont plus utilisées.

Le serveur échange la clé contre un jeton via `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token`, puis récupère des données en lecture seule. Chaque endpoint de métrique est isolé : une métrique manquante n'empêche pas les autres de remonter. L'application soumet les données au flux existant de prévisualisation avant enregistrement. Elle ne modifie pas les historiques sans confirmation.

Important : intégration non testée contre le vrai compte Garmin (aucune clé dans le livrable). Les noms de champs peuvent être différents selon les réponses ; inspecter la prévisualisation réelle. Ne pas déployer en supposant que les données sont exactes sans ce contrôle.

Références : https://github.com/garmin/connect-personal-api-python , README section Endpoint wrappers.
