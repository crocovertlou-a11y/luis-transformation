# Luis Transformation — Build 0.6

Première fondation exécutable issue du Product Book : PWA mobile-first, Fluidité/Connexion, Aujourd’hui ↔ Évolution, Entraînement, Compagnon local, Profil, IndexedDB, offline et export/import JSON.

## Tester localement

Servir le dossier avec un serveur HTTP (un service worker ne fonctionne pas correctement via `file://`). Exemple :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Déployer sur Netlify

Glisser-déposer le contenu de ce dossier dans Netlify Drop, ou connecter ce dossier/repository. Aucun build npm n’est nécessaire pour Build 0.6.

## iPhone / PWA

1. Ouvrir l’URL Netlify dans Safari.
2. Partager.
3. Ajouter à l’écran d’accueil.
4. L’app se lance ensuite en mode standalone.

## Données

- Stockage : IndexedDB.
- Offline : service worker + shell caché.
- Export : Profil > Exporter JSON.
- Import : Profil > Importer JSON.
- Une migration best-effort capture d’anciens snapshots localStorage si certaines anciennes clés sont présentes sur le même domaine.

## Ce que Build 0.6 fait déjà

- identité Fluidité/Connexion + initiales ;
- présence du Compagnon sur les écrans principaux ;
- Aujourd’hui et Évolution ;
- saisie quotidienne ;
- Force et Cardio simples ;
- Alimentation optionnelle ;
- Compagnon local transparent (pas encore d’API IA distante) ;
- « Je ne sais pas » plutôt qu’une fausse réponse ;
- export/import ;
- fonctionnement offline.

## Build suivant

0.2 : onboarding complet, graphes niveau 3, preview avant imports sportifs, mémoire modifiable plus riche, backend/API IA et contexte météo.


## Build 0.6
- Aujourd’hui devient compagnon-first : les données déjà saisies ne sont plus répétées.
- Force : séance exécutable avec séries, répétitions, récupération, charge saisie et accès Technique.
- Cardio : durée H:MM:SS saisissable sans caractère « : » sur le clavier iPhone.
- Alimentation : photo/photothèque en langage produit et suggestions de repas réellement alternatives.
- Le symbole du Compagnon remplace l’étoile générique.


## Build 0.6
Périmètre volontairement limité : suivi Alimentation visible après saisie + identité visuelle Compagnon. Aucun changement Force/Cardio/Évolution/navigation/check-in.


## Build 0.6 — périmètre contrôlé
- Fermeture permanente des fenêtres avec bouton × sticky.
- Alimentation : consulter, modifier, supprimer une saisie.
- Historique Force/Cardio : consulter et modifier/supprimer les entrées.
- Force : saisie série par série des répétitions et charges, avec récupération et ressenti.
- Aucun changement de l’architecture Aujourd’hui/Évolution ou du Compagnon.


## Build 0.6
- Correction du bug : édition Force/Cardio depuis l’écran principal désormais branchée.
- Force : modification série par série des reps/charges.
- Cardio : modification complète des métriques.
- Aujourd’hui devient une synthèse de Force, Cardio et Alimentation.
- Alimentation a désormais une porte d’entrée explicite dans Aujourd’hui.


## Build 0.6 — consolidation
- Force : anciennes séances et nouvelles séances modifiables série par série.
- Fenêtres légèrement abaissées sur iPhone, avec scroll conservé.
- Date modifiable à la saisie pour Ressenti, Force, Cardio et Alimentation.
- Date modifiable également lors de l’édition Force/Cardio/Alimentation.
- Correction de la sauvegarde Cardio H:M:S déjà présente dans le formulaire.


## Build 0.6 — consolidation avant IA
- Force legacy : une ancienne séance sans détails d’exercices retrouve la structure de la séance Haut du corps pour permettre l’édition séries/reps/charges.
- Alimentation : ajout du type Petit-déjeuner / Déjeuner / Dîner / Collation.
- Alimentation : date visible dans la liste des repas et modifiable.
- Aucun ajout IA dans cette version.


## Build 0.6 — IA Nutrition v1
- Icônes PWA déplacées à la racine (`icon-192.png`, `icon-512.png`) : plus de dossier `icons`.
- Code-barres : recherche réelle via Open Food Facts, valeurs nutritionnelles par portion, confirmation avant sauvegarde.
- Photo aliment ou repas : analyse via OpenAI côté Netlify Function, éléments détectés, portions/macros estimées, confirmation/correction obligatoire.
- La photo n’est envoyée à l’IA qu’après action explicite « Analyser avec le Compagnon ».
- Sources traçables : `Open Food Facts` ou `Compagnon IA`.

### Configuration IA sur Netlify
Ajouter la variable d’environnement `OPENAI_API_KEY` dans Netlify. Optionnel : `OPENAI_MODEL` pour choisir le modèle (défaut `gpt-5-mini`).
La clé n’est jamais stockée dans le navigateur : l’appel passe par `netlify/functions/analyze-food.js`.
