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
