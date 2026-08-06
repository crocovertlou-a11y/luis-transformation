# Luis Transformation v7 — Data Safe

Cette version conserve la clé historique `luis-transformation-v1` et ajoute :

- migration et normalisation automatiques des anciennes structures ;
- copie de sécurité locale avant chaque écriture ;
- restauration automatique depuis une copie locale si les données principales sont illisibles ;
- écriture transactionnelle temporaire avant validation ;
- export complet JSON incluant les photos IndexedDB ;
- import complet des données et des photos ;
- message explicite en cas de quota ou d’échec de stockage.

## Règle impérative
Utiliser toujours la même origine : `https://luis-transformation.netlify.app`. Une URL de déploiement Netlify du type `xxxx--luis-transformation.netlify.app` possède un stockage distinct.

## Récupération des anciennes données
Ouvrir chaque ancienne URL utilisée, exporter une sauvegarde, puis importer la sauvegarde depuis l’URL principale. Les anciennes versions n’incluent pas les fichiers photo dans leur export ; les photos doivent être récupérées depuis leur URL d’origine avant suppression des données Safari.


## Correctif v7.1
- Date du jour préremplie automatiquement sur tous les formulaires.
- Calcul selon le fuseau local de l’iPhone, sans décalage UTC.
- Réapplication automatique si un champ date est vide à l’ouverture d’un module.


## v7.2
- Les cartes du Dashboard ouvrent maintenant directement leur catégorie.
- Navigation tactile et clavier ajoutée aux indicateurs Poids, Taille, Calories, Protéines, objectifs hebdomadaires et Photos.
