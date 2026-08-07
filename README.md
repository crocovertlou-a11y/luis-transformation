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
