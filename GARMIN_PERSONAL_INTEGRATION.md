# Fluidité — Garmin Personal (pré-intégration sécurisée)

## État
L’interface, la protection de la clé côté serveur et le chemin vers la prévisualisation existante sont implémentés. **La synchronisation réelle n’est pas validée** : la documentation authentifiée des URL et des formats de l’API Personal est nécessaire. Ne pas déployer en prétendant que la connexion fonctionne déjà.

## Variables Netlify (Site configuration → Environment variables)
- `GARMIN_PERSONAL_API_KEY` : clé Garmin (ne jamais l’ajouter à GitHub)
- `FLUIDITE_GARMIN_SYNC_CODE` : code privé unique d’au moins 16 caractères, distinct de la clé Garmin
- `GARMIN_PERSONAL_HEALTH_URL` : URL HTTPS exacte donnée par la documentation Garmin (sur `apis.garmin.com`)
- `GARMIN_PERSONAL_ACTIVITY_URL` : facultatif, URL des activités selon la documentation Garmin

**Attention :** le type d’authentification et les paramètres réels de Garmin Personal restent à valider. Le prototype emploie `Authorization: Bearer` et accepte uniquement `apis.garmin.com`; ne pas activer avec une API dont le contrat est différent. Le code privé sert à protéger un usage personnel, et non à gérer plusieurs utilisateurs. Pour une exposition publique avec plusieurs utilisateurs, une authentification par session et des limitations de débit serveur seront nécessaires.

## Non-régressions attendues
Ancien import JSON conservé ; aucune suppression de données ; aucune modification d’Alimentation, Force, Cardio ou du schéma IndexedDB.

## Suite
Partager une capture de la documentation Garmin Personal montrant les URL, en-têtes, paramètres de date et exemple JSON **sans aucun secret**. Adapter ensuite ce pont, puis tester avec un jeu de données Garmin réel avant activation.
