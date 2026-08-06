# Luis Transformation v8

Ajoute photo depuis photothèque, coach nutrition IA, vidéos techniques et synthèse positive des progrès.

Configurer `OPENAI_API_KEY` dans Netlify > Site configuration > Environment variables. Ne jamais mettre la clé dans GitHub.

## Version 9 — Nutrition IA visuelle

Nouveau parcours dans Nutrition :

1. saisir le nom/la marque, photographier le produit ou choisir une photo enregistrée ;
2. analyse via une fonction Netlify protégée ;
3. recherche web et lecture de l’étiquette par le modèle ;
4. fiche préremplie avec marque, portion, calories et macros ;
5. confirmation ou correction manuelle avant ajout au repas ;
6. mémorisation du produit dans les aliments personnels.

### Variables Netlify

Obligatoire : `OPENAI_API_KEY`

Facultatives :
- `OPENAI_MODEL` pour le coach repas ;
- `OPENAI_VISION_MODEL` pour l’identification alimentaire visuelle.

Par défaut, les fonctions utilisent `gpt-5-mini`.

La clé API reste exclusivement côté serveur dans Netlify. Ne jamais la placer dans `app.js` ou dans GitHub.
