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


## Ressenti R2
Correctif isolé :
- le formulaire stable s'ouvre normalement puis recharge les valeurs du check-in du jour depuis IndexedDB ;
- cache PWA versionné uniquement pour garantir que l'iPhone charge réellement ce nouveau app.js.
Aucun changement fonctionnel aux modules Alimentation, Photos, Strava, Force, Cardio, IA ou Évolution.


## Évolution R1 — uniquement
- Évolution affiche désormais la dernière valeur réelle de poids et de tour de taille.
- Le delta n'apparaît qu'à partir de deux mesures.
- Le compteur Activités 30 j est inchangé.
- Aucun changement Alimentation, Photos, Strava, Force, Cardio, IA ou Ressenti.


## Cadence R1 — uniquement
- Strava : average_cadence d'une course/marche est convertie de foulées/min vers pas/min (x2).
- Fichiers GPX/TCX/FIT : une cadence course/marche plausible en cadence par jambe (<130) est normalisée x2 ; une valeur déjà en ppm n'est pas doublée.
- Vélo et saisie manuelle restent inchangés.
- Libellé UI : Cadence moyenne (ppm).
Cas de contrôle : Strava 86 -> 172 ppm pour une course ; 172 reste 172 ; vélo 86 reste 86.


## Alimentation UX R1 — écran principal + repas du jour
Bloc 1 uniquement, basé sur Cadence R1 validé.
- Résumé du jour : kcal + protéines/glucides/lipides.
- Quatre cartes fixes : Petit-déjeuner, Déjeuner, Collation, Dîner.
- Chaque repas affiche ses aliments actuels et permet d'ouvrir/modifier chaque saisie.
- Bouton Ajouter par repas avec les 4 méthodes existantes : recherche, scan, photo, saisie manuelle.
- La méthode choisie pré-sélectionne le bon moment du repas.
- Aucune recette, copie d'hier ou calendrier ajouté dans ce bloc.
- Aucun changement Force, Cardio, Strava, Photos, Ressenti, Évolution ou IA.


## Copier hier R1 — repas uniquement
Basé sur Alimentation UX R1 + Recherche R2 validé.
- Bouton « Copier hier » sur chaque carte repas.
- Copie uniquement les aliments/recettes enregistrés dans le même repas la veille.
- Si le repas du jour est vide : copie directe.
- Si le repas contient déjà des éléments : choix Ajouter ou Remplacer.
- Les copies reçoivent de nouveaux identifiants ; la journée précédente n'est jamais modifiée.
- Aucun changement au moteur Recherche, IA, scan, photo, Cardio, Strava, Force, Ressenti ou Évolution.


## Mes recettes + portions R1
Basé exclusivement sur Copier Hier R1 validé.
- Bibliothèque Mes recettes.
- Création/modification : nom, nombre de portions, ingrédients et macros.
- Nutrition calculée par portion.
- Ajout au repas avec ¼, ½, ¾, 1, 1½, 2 ou fraction personnalisée.
- Recalcul automatique des macros selon la portion consommée.
- Recherche/IA/scan/photo et Copier hier conservés.
- Aucun changement aux autres modules.


## Recettes + portions R2 — correctif ajout d'ingrédients
- « Ajouter » ouvre maintenant Recherche / Scan / Photo / Saisie manuelle.
- Recherche réutilise exactement le moteur alimentaire validé.
- Scan réutilise Open Food Facts.
- Photo réutilise le Compagnon IA.
- L'ingrédient choisi est ajouté à la recette, pas au repas du jour.
- Les macros de la recette et par portion se recalculent après chaque ingrédient.
- Aucun changement aux autres blocs validés.


## Historique + Calendrier Alimentation R1
Basé exclusivement sur Recettes + Portions R2 validé.
- Accès calendrier discret depuis Alimentation/Aujourd'hui.
- Jours contenant des données alimentaires marqués dans le calendrier.
- Navigation mois précédent/suivant.
- Détail d'une journée passée : kcal, macros et repas.
- Les aliments historiques restent ouvrables, modifiables et supprimables.
- Après modification d'une journée passée, retour sur cette même journée.
- Aucun ajout/copie dans les jours passés dans ce bloc pour limiter les risques.
- Recherche, IA, scan, Copier hier et Recettes/portions conservés.


## Alimentation UX V2 R1
Basé exclusivement sur Historique + Calendrier R1 validé.
- Nouvelle couche visuelle Alimentation conforme à la maquette validée.
- Palette existante : crème, orange fonctionnel, violet Fluidité.
- Résumé nutritionnel compact avec intervention Fluidité.
- 4 cartes repas : Ajouter + Copier hier sur chacune.
- Accès Mes recettes allégé.
- Calendrier conservé.
- Aucune modification des moteurs Recherche, IA, Scan, Recettes, Portions, Copier hier ou Historique.

## Fluidité IA V1 R1
Moteur déterministe Aujourd'hui, états validés, respiration du logo, commentaires nutritionnels contextuels et garde-fous de cohérence.


## V2.6.1 — Correctif Compagnon → Recette
- Le Compagnon propose désormais une action recette pour les demandes liées à l’alimentation/repas.
- La fonction `nutrition-recipes-v1` est bien incluse lors du build Netlify.
- Cache PWA incrémenté pour forcer la prise en compte du correctif.


## V2.6.2 — Correctif Mes recettes
- Confirmation visuelle immédiate après ajout d’une recette du Compagnon.
- Protection anti-multi-clic et anti-doublon pour une même suggestion.
- Bouton « Supprimer la recette » dans l’éditeur avec confirmation explicite.
- La suppression d’une recette ne supprime pas les repas déjà enregistrés dans le suivi.
- Cache PWA incrémenté pour forcer la mise à jour sur iPhone.


## V2.6.3 — Compagnon Cardio soft
- Ajout de « Mon cardio » dans les questions rapides du Compagnon.
- Le Compagnon observe l’équilibre Force/Cardio récent et la dernière activité Cardio sans inventer de séance.
- Si le cardio est peu sollicité face à la Force, il formule un rappel doux et contextualisé.
- Si le cardio est déjà régulier ou réalisé aujourd’hui, il valorise l’équilibre/récupération sans pousser à en faire davantage.
- Aucun bouton d’action Cardio : conseil volontairement léger, sans popup ni nouvelle mécanique.
- Contexte Cardio enrichi avec FC moyenne, cadence et calories lorsqu’elles existent.
- Cache PWA incrémenté pour forcer la mise à jour sur iPhone.


## V2.6.4 — UX Compagnon + Évolution
- L’écran principal du chat n’affiche plus que le dernier échange complet (question + réponse + action éventuelle).
- Tout l’historique, y compris les échanges du jour, reste accessible via « Historique ».
- Ajout de « Mon évolution » dans les accès rapides du Compagnon.
- Les photos restent stockées dans Évolution mais sont accessibles depuis le Compagnon, avec accès direct à la comparaison/analyse IA et à l’ajout d’une photo.
- Cache PWA incrémenté.


V2.7.2 Autopsy: suppression du fallback silencieux dailyDecision, double tentative Gemini, parsing JSON robuste, erreurs IA visibles pour diagnostic.


## V2.8 — Sécurité & sauvegarde

- IndexedDB passe en version 3 avec un store système `backups`.
- Instantané local automatique une fois par jour, rotation sur les 7 derniers instantanés.
- Instantané manuel et restauration locale depuis Profil.
- Avant tout import/restauration externe, Fluidité crée un instantané local de sécurité.
- Restauration transactionnelle en mode remplacement : validation complète avant écriture et pas de mélange silencieux avec les anciennes données.
- Export chiffré `.fluidite` : AES-256-GCM, clé dérivée du mot de passe via PBKDF2-SHA-256 (250 000 itérations). Le mot de passe n'est jamais stocké.
- Import compatible avec les sauvegardes chiffrées et les anciens exports JSON.
- Le JSON brut reste disponible uniquement dans les options avancées et est explicitement marqué non chiffré.
- En-têtes Netlify renforcés : CSP, anti-framing, nosniff, no-referrer et permissions minimales.
- Les clés Gemini et Strava restent uniquement côté Netlify (variables d'environnement), jamais dans le navigateur/GitHub.

Important : les 7 instantanés locaux protègent contre une erreur de manipulation sur l'appareil, mais pas contre la perte ou la réinitialisation de l'iPhone. Pour cela, conserver régulièrement un fichier `.fluidite` chiffré dans iCloud Drive ou un autre espace personnel.


## V2.10.1 — Force épurée + Core/Abdos
- Suppression des vignettes/visuels d’exercices dans Force et les fiches techniques.
- Conservation des conseils d’exécution et des liens vidéo.
- Core intégré aux programmes : Dead bug (Push), Pallof press (Pull), Gainage déjà présent sur Lower/Full/Upper.
- Aucun changement fonctionnel volontaire hors Force.

## V2.10.2 — Force réalignée après suppression des vignettes
- Rééquilibrage des cartes d’exercices désormais sans visuel : contenu aligné naturellement à gauche.
- Nom, séries/répétitions/repos puis accès Technique structurés sur toute la largeur utile.
- Conservation stricte des fiches techniques et liens vidéo.
- Aucun changement fonctionnel volontaire hors présentation Force.
- Cache PWA incrémenté pour forcer la mise à jour sur iPhone.

## V2.10.3 — Coffre Photos

- Les photos d’évolution sont masquées tant que le coffre est verrouillé.
- Premier accès : configuration d’une vérification locale via WebAuthn (authentificateur de plateforme iPhone) ou d’un code Fluidité de secours.
- Le coffre se verrouille à nouveau lorsque l’app passe en arrière-plan, lorsqu’on quitte la zone protégée, à la fermeture d’une fiche photo et après environ 3 minutes.
- Les images ne sont pas injectées dans le DOM de l’écran Évolution lorsque le coffre est verrouillé.
- La protection concerne uniquement les photos d’évolution ; les photos utilisées ponctuellement pour analyser un repas ne sont pas incluses dans ce coffre.
- Aucun changement sur Force, Cardio, Alimentation, Compagnon, Pilotage ou Sauvegardes.
