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
