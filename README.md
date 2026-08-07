# Luis Transformation — Build 0.4.3

Première fondation exécutable issue du Product Book : PWA mobile-first, Fluidité/Connexion, Aujourd’hui ↔ Évolution, Entraînement, Compagnon local, Profil, IndexedDB, offline et export/import JSON.

## Tester localement

Servir le dossier avec un serveur HTTP (un service worker ne fonctionne pas correctement via `file://`). Exemple :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Déployer sur Netlify

Glisser-déposer le contenu de ce dossier dans Netlify Drop, ou connecter ce dossier/repository. Aucun build npm n’est nécessaire pour Build 0.4.3.

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

## Ce que Build 0.4.3 fait déjà

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


## Build 0.4.3
- Aujourd’hui devient compagnon-first : les données déjà saisies ne sont plus répétées.
- Force : séance exécutable avec séries, répétitions, récupération, charge saisie et accès Technique.
- Cardio : durée H:MM:SS saisissable sans caractère « : » sur le clavier iPhone.
- Alimentation : photo/photothèque en langage produit et suggestions de repas réellement alternatives.
- Le symbole du Compagnon remplace l’étoile générique.


## Build 0.4.3
- Destination visible pour les données saisies.
- Aujourd’hui raconte Force, Cardio et Alimentation.
- Évolution : dernières valeurs + historique des ressentis, sans faux zéros.
- Alimentation : suivi du jour, entrées visibles et provenance.
- Sources prévues : Saisie manuelle, Compagnon, Import, Garmin, Strava.


## Build 0.4.3
Correctif critique : appel réel de `init()` au démarrage + alignement des sauvegardes Force/Cardio + service worker nettoyé.
