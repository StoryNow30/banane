# Ariane 4.9 — avenant D-072 : développement parallèle

**2 octobre 2026, 08 h 09 (Europe/Paris), décision de la direction.**
Mic autorise l'orchestrateur à avancer d'autres chantiers en développement :
« Si on peut mettre d'autres chantiers en cours de route en développement,
n'hésite pas. Nous avons plusieurs développeurs à disposition avec une grande
force de calcul. »

## But et portée

But : utiliser plusieurs développeurs sur des travaux indépendants et réduire
l'attente entre chantiers. Cet accord autorise l'orchestrateur à distribuer
ces travaux dans le programme adopté, sans redemander le principe du parallèle.
Il ne dispense pas de cadrage, d'essais, de relecture ou d'acceptation.

Le présent avenant remplace la restriction à un seul exécutant du cahier
§2.3, la mise en série systématique d'U1 à U3 (§2.4, point 5), les besoins
historiques de développement en série et la restriction de D-067 pour les
travaux de développement indépendants. Les textes historiques restent intacts.
Les dépendances fonctionnelles et les conditions terrain restent en vigueur.

## Première répartition retenue par l'orchestrateur

| Développeur | Travail autorisé | Fichiers de production réservés |
|---|---|---|
| V1, déjà autorisé par D-071 | Mesure par phase ; périmètre et portes inchangés | `background.js`, `src/adapter-page.js`, `src/bridge.js` et instrumentation hors fichiers gelés ; `tools/perf-lot.cjs` |
| U1 | Développement du résumé de partie et essais associés | `panel.js`, `panel.html`, `panel.css` ; éventuel nouveau module pur de résumé |
| U2 | Préparation du banc et essais du panneau réel ; diagnostic des défauts | Aucun fichier de production : outil et scénarios U2 nouveaux, séparés des essais U1 |

U1 et U2 n'ont pas de dépendance fonctionnelle dans le cahier (§6).
U2 reste limité aux outils/tests : les corrections du panneau sont attribuées
à U1 pendant cette phase. U2 vérifiera ensuite la livraison U1 ; la préparation
de son banc n'est pas une acceptation anticipée du panneau final.

Missions : `mission-u1-2026-10-02.md`,
`mission-u2-preparation-2026-10-02.md` ; complément à remettre au développeur
V1 : `complement-v1-parallele-2026-10-02.md`.

## Coordination

- Un checkout ou une copie isolée et une branche par développeur, depuis
  `v4.8.6` = `042aee649bc25b89c46a26def481f87f46d047ac`. Jamais deux sessions
  écrivant dans le même arbre de travail. Les nouvelles missions joignent
  les avenants locaux : ne pas supposer qu'ils sont sur GitHub.
- Un propriétaire par fichier de production. V1 ne modifie pas le panneau ;
  U1 ne modifie pas background, adaptateur, bridge, mesure, stockage ou moteur.
  U2 ne corrige pas le panneau. Si le périmètre réservé ne suffit pas,
  soumettre la dépendance à l'orchestrateur avant de toucher au fichier partagé.
- Les fichiers de vérification générés peuvent diverger entre branches.
  Conserver les preuves dans chaque rapport et les traiter selon le cahier ;
  le contrôle de l'assemblage sera rejoué sur son commit exact.
- Aucune intégration silencieuse d'U1 ou d'U2 dans le commit de référence V1.
  Cette référence reste identifiée et fixe pour les comparaisons de vitesse.
  Une branche terminée peut attendre son intégration et ses essais.
- Les essais de Mic restent organisés successivement, avec une seule Ariane
  active. Les parties réservées et les conditions de comparaison sont conservées.
- Chaque développeur livre son propre rapport et s'arrête. L'orchestrateur
  relit chaque diff ; la relecture indépendante demeure distincte de son auteur
  et du travail U2. La direction accepte les chantiers et réalise les fusions.

## Dépendances conservées

V2, V4 et V3 ne sont pas démarrés par cette première répartition : leurs
mesures, préconditions et missions restent à traiter. U3 attend U2 et la
définition des actions clavier. V5 et B3 gardent leurs conditions.
L'inventaire D-067 reste après acceptation de V1, avant V2 ; aucun entraînement
ou activation d'apprentissage n'est autorisé ici.

Règles conservées : fichiers gelés et moteur épinglé ; deux rails ou rien ;
aucune validation ni SKIP automatique d'un cut non résolu ; écartement
[1405, 1470] mm en admissibilité ; exclusions 9033/9241 ; rotation des parties ;
verify à zéro échec avant chaque commit ; lecture de banane-data autorisée,
écriture interdite ; aucun identifiant de modèle, capture d'écran ou code
d'ESV dans les dépôts. Aucun envoi, publication, fusion, étiquette ou paquet
terrain autorisé par le présent avenant.

L'orchestrateur prépare et remet les missions ; il n'écrit pas le code de
l'extension et ne prétend pas avoir lancé les sessions externes.
