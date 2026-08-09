# Luis Transformation — Build 0.6.4

## IA Nutrition
- Photo d’un aliment ou d’un repas → analyse Gemini Vision.
- Identification des éléments visibles, estimation des portions et des macros.
- Écran de confirmation entièrement modifiable avant enregistrement.
- Enregistrement dans Alimentation avec source `Compagnon IA`.
- Le scan code-barres Open Food Facts reste inchangé.
- Identité Compagnon orange harmonisée, y compris la carte « Je suis là ».
- Cache PWA renouvelé : `luis-build-0.6.4-ai-nutrition`.

## Netlify
Conserver `GEMINI_API_KEY` en variable d’environnement Production. Optionnel : `GEMINI_MODEL`; sinon `gemini-2.5-flash-lite` est utilisé. Ne jamais mettre la clé dans GitHub.

Tous les fichiers de ce package sont destinés à la racine du dépôt.


## Build 0.6.4.1
Diagnostic IA: affiche le code HTTP, le code d'erreur et le détail renvoyé par Netlify/Gemini. Aucun changement du scanner.


## Build 0.6.4.2 — Gemini 3
- Base exacte : 0.6.4.1 Diagnostic IA.
- Modèle Gemini par défaut : `gemini-3-flash-preview`.
- Diagnostic HTTP/erreur détaillé conservé.
- Scanner code-barres / Open Food Facts inchangé.
- Nouveau cache PWA : `luis-build-0.6.4.2-gemini3`.
- Si `GEMINI_MODEL` existe dans Netlify, sa valeur reste prioritaire : la supprimer ou la régler sur `gemini-3-flash-preview`.


## Build 0.6.4.3 — Gemini endpoint neuf
- Nouveau fichier Netlify Function : `analyze-food-v2.js`.
- Nouveau endpoint : `/api/analyze-food-v2`.
- Modèle verrouillé dans cette release : `gemini-3-flash-preview`.
- `GEMINI_MODEL` n'est plus lu : aucune ancienne variable ne peut forcer un modèle obsolète.
- Le diagnostic renvoie aussi le modèle réellement appelé.
- Scanner code-barres / Open Food Facts inchangé.
- Nouveau cache PWA : `luis-build-0.6.4.3-gemini3fresh`.


## Build 0.6.4.4 — correction routage Netlify
- Functions placées dans le dossier conventionnel `netlify/functions`.
- `netlify.toml` pointe explicitement vers ce dossier.
- Route `/api/analyze-food-v2` -> `/.netlify/functions/analyze-food-v2`.
- Modèle Gemini inchangé : `gemini-3-flash-preview`.
- Cache PWA renouvelé.


## Build 0.6.4.5 — appel direct Netlify Function
- Suppression complète du routage custom `/api/analyze-food-v2`.
- L'application appelle directement `/.netlify/functions/analyze-food-v2`.
- `netlify.toml` ne contient plus de redirect pour l'IA.
- La Function reste dans `netlify/functions/analyze-food-v2.js`.
- Gemini reste verrouillé sur `gemini-3-flash-preview`.
- Scanner code-barres / Open Food Facts inchangé.
- Cache PWA renouvelé.


## Build 0.6.4.6 — Functions à la racine
- Tous les fichiers sont à nouveau à la racine du ZIP.
- `analyze-food-v2.js` et `product-lookup.js` sont copiés automatiquement dans `.netlify-functions` pendant le build.
- Cette méthode a déjà été validée par un déploiement Netlify avec 2 Functions.
- L'app appelle directement `/.netlify/functions/analyze-food-v2`.
- Aucun redirect custom.
- Gemini : `gemini-3-flash-preview`.
- Nouveau cache PWA.


## Build 0.7 — Compagnon intelligent v1 + Journal Photos
- Évolution > Photos : caméra ou photothèque.
- Recadrage 3:4 avec zoom, déplacement tactile et guides.
- Historisation locale par date et vue Face / Profil / Dos.
- Petites vignettes regroupées par date, consultation et suppression.
- Compagnon : résumé contextuel local + réponses Gemini à partir des données réellement enregistrées.
- Fallback local si Gemini est indisponible.
- Architecture Functions 0.6.4.6 conservée, avec ajout de `companion-v1.js`.
- Scanner et IA Nutrition inchangés.


## Build 0.7.2 — Photos iPhone stabilisées
- "Prendre une photo" utilise maintenant getUserMedia dans l'app, comme le scanner.
- Aperçu caméra live + déclencheur explicite.
- Photothèque inchangée.
- Recadrage tactile renforcé : glisser + zoom + recentrer.
- Bouton Enregistrer sticky et retour utilisateur pendant la sauvegarde.
- Scanner / Nutrition IA / Compagnon inchangés.


## Build 0.7.3 — Comparaison Photos v1
- Sélection de deux dates depuis Évolution > Photos.
- Comparaison côte à côte Avant / Après.
- Onglets Face / Profil / Dos selon les photos disponibles.
- Gestion explicite d'une vue manquante à l'une des dates.
- Aucune IA sur les photos à ce stade.
- Capture, recadrage, scanner, Nutrition IA et Compagnon inchangés.


## Build 0.7.3.1 — Comparaison visible
- Bouton `Comparer` affiché en permanence à côté de `Ajouter`.
- Suppression de l'ancien bouton de comparaison en bas de la galerie.
- Si moins de deux dates existent, message explicite.
- Comparaison Avant / Après inchangée.


## Build 0.7.4.1 — Anti-cache
- Aucune modification fonctionnelle de l'IA comparaison.
- `app.js`, `db.js`, `styles.css` et service worker chargés avec version `v=0741`.
- Nouveau cache PWA `luis-build-0.7.4.1-force-refresh`.
- Suppression automatique des anciens caches à l'activation.
- Headers Netlify `no-cache/no-store` sur le shell de l'app.
- Comparaison manuelle, photo, scanner, nutrition et Compagnon inchangés.


## Build 0.8.0 — Entraînement v2
- Écran Entraînement simplifié en 3 cartes : suggestion du jour + historique Force + historique Cardio.
- Suggestion basée sur l’historique récent, sans IA.
- Bibliothèque élargie : Haut, Bas, Full body, Push, Pull, orienté poussée/tirage, séance courte.
- Détail de séance dans un sous-écran.
- Possibilité de remplacer un exercice dans la séance choisie.
- L’utilisateur reste libre de changer totalement de séance.
- Historique Force et Cardio séparés.
- Aucun chrono.
- IA volontairement repoussée à une version suivante.

## Build 0.8.1 — Import Cardio
- Ajout manuel conservé.
- Import GPX/TCX/FIT avec écran de vérification avant sauvegarde.
- Historique Cardio toujours modifiable/supprimable.
- Aucun enregistrement automatique sans confirmation utilisateur.

## Build 0.8.2 — Strava à la demande
Variables Netlify requises : STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET. Optionnel : STRAVA_COOKIE_SECRET. Connexion OAuth, récupération manuelle des 10 dernières activités, prévisualisation et confirmation avant sauvegarde. Manuel, fichier et historique modifiable conservés.


## Build 0.9.0 — Entraînement intelligent V1
- La recommandation Force peut être affinée par Gemini à la demande.
- Contexte utilisé: 14 jours Force, 14 jours Cardio, 7 jours récupération/check-in, 3 jours alimentation.
- L'IA génère 4 à 6 exercices: la bibliothèque n'est plus limitée aux séances prédéfinies.
- Cardio influence la proposition Force; alimentation reste un signal de contexte, jamais un verrou.
- Explication courte de la recommandation.
- Voir la séance / autre proposition / choisir soi-même.
- Modification d'exercices et validation utilisateur conservées.
- Fallback local conservé si Gemini est indisponible.
- Aucun chrono.

## Build 0.9.1 — Recherche alimentaire
Ajout isolé dans Alimentation : recherche par nom/marque via Open Food Facts, complétée par une petite référence générique locale. Quantité, macros recalculées, correction et confirmation avant enregistrement. Scan, photo IA, saisie manuelle, Strava, entraînement IA et historiques conservés.


## Build 0.9.1.2 — Correctif Photos structurel
- Cause confirmée : les boutons Évolution existaient mais les routes `photoCompare` et `progressPhoto` avaient disparu de `openSheet`.
- Routes restaurées.
- Boutons dynamiques rebondés de façon robuste.
- Cache PWA et fichiers JS/CSS forcés en v0912.
- Aucun changement fonctionnel sur Alimentation, Strava ou Entraînement IA.


## Build 0.9.1.4.1 — Emergency stable
Repart de 0.9.1.3. Corrige uniquement :
- identité Luis dans le header et Évolution ;
- valeur actuelle Poids/Tour de taille dans Évolution + delta seulement si plusieurs mesures ;
- service worker simplifié et sécurisé : plus de double listener hérité, plus de fallback HTML pour un fichier JS/CSS.
Aucune refonte Alimentation ni nouvelle logique IA.
