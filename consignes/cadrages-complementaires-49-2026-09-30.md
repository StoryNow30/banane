# Ariane 4.9 — trois cadrages complémentaires proposés

30 septembre 2026. **Proposition initiale, adoptée avec modification par D-066.**
Les points 1 et 2 sont validés. Le report de l'apprentissage ci-dessous est
remplacé par son entrée dans la 4.9 : voir `avenant-49-d066-2026-09-30.md`.
Le texte initial reste lisible pour tracer la proposition et son évolution.
Aucun développement engagé. Le cahier signé n'est pas réécrit.

## État vérifié et ordre proposé

Lecture sur `main` au commit `18a355eb02a00b20b2adaeb1d84648854664972e`.
L'étiquette `v4.8.6` désigne `042aee649bc25b89c46a26def481f87f46d047ac`,
ancêtre de ce `main`. Son contenu est identique à celui de `654209d`, base
adoptée au cahier § 2.4. La précondition d'étiquetage avant V1 est levée.
Cela ne prouve ni une installation sur le poste ni une publication du paquet.

Les trois cadrages sont demandés par `BANANE_4.9_CAHIER.md:140-147`.
Proposition : conserver P2 puis V1, V2 avec KI-068, V4, V3, U1 à U3 en série,
V5 seulement si nécessaire ; ensuite, au début de la 4.9.5, traiter le retour
à un cut, puis l'étude des faux 398/402 ; poursuivre B1, B2, B3 conditionnel.
L'apprentissage de positions vient après la 4.9, **4.9.5 comprise**, si la
direction confirme ce report. Chaque passage requiert son accord.

Les seuils ci-dessous sont soit des règles existantes citées, soit des
**critères proposés**, à adopter. Aucun résultat nouveau n'est annoncé.

## 1. Revenir à un cut

**Objectif.** Atteindre un cut précis de la partie, y compris un cut précédent
ou déjà validé, et confirmer son identité. Cela prépare la consultation des
voisins pour B1 et une conception de reprise des différés. La consultation
d'un voisin validé reste en lecture seule. Brancher une nouvelle reprise
automatique complète n'est pas inclus dans cette livraison : ce serait une
extension à soumettre séparément.

**Porte proposée.** Réussir les sept familles de cas déjà demandées : précédent
normal, commande absente, commande désactivée, mauvaise cible atteinte, cible
déjà validée, double appel, annulation (`consignes/chantier-1-ingenieur.md:161-164`).
Zéro validation, zéro SKIP, zéro modification des rails par la navigation ;
une seule émission par demande ; zéro succès déclaré sans confirmation de la
partie et du cut. Ces zéros expriment les invariants existants, pas une mesure
terrain (`consignes/chantier-1-ingenieur.md:148-160`). Une identité absente ou
inattendue impose une pause explicite, sans réémission automatique.

**Mesure.** Pour chaque essai : cible demandée, identité avant et après,
commande réellement émise, résultat et durée. Simuler les sept familles,
puis vérifier dans Edge chaque chemin effectivement retenu, dont un retour
sur un cut validé ; comparer les deux rails avant/après. Publier les échecs et
les chemins non disponibles. Le banc des 633 cuts et huit jeux reste inchangé
(`BANANE_4.9_CAHIER.md:31-34`). Aucun gain de vitesse ou de couverture promis.

**Dépendances.** Inventaire terrain des commandes : les observations historiques
de touches ne prouvent pas un chemin utilisable par l'extension
(`consignes/chantier-1-ingenieur.md:98-118`). Priorité aux boutons vérifiés ; un
appel interne d'ESV ou une commande clavier exige une décision spécifique
(`:133-140`). Aucun code ou capture d'ESV dans les dépôts. Pour B1, vérifier
également validation, coordonnées et fraîcheur des voisins ; conserver D-054 :
au moins trois voisins cohérents, à ±5 cuts et 8 mm sur les deux axes et rails
(`DECISIONS.md:363-378`). Une source fiable sans navigation peut aussi convenir.

**Place proposée.** Premier complément de la 4.9.5, avant B1. L'inventaire et sa
faisabilité précèdent tout code ; une commande indisponible ne devient pas une
fonction livrée. La direction reçoit alors les possibilités et limites.

## 2. Faux 398 et 402 de la partie 20

**Objectif.** Trouver une protection qui empêche les deux mauvaises poses sans
retirer de bonnes poses ni créer d'erreurs sur les cuts suivants. Commencer
par une étude hors ligne ; aucune nouvelle garde activée sans décision.

**Base sourcée.** Étude du 24 septembre, code `155dbec` : 711 décisions,
524 jugées ; quatre faux, dont 398 à 159,9 mm et 402 à 273 mm
(`audit/chantiers/faux-sans-appui.md:27-49`). Il s'agit de la session historique
« p20 longue », pas du lot récent de 84 cuts dont la relecture est inutilisable
(`audit/lots-20-24-33-2026-09-29.md:12,29-30`).
Ces résultats ne prouvent pas que les mêmes faux persistent sous 4.8.6.
Les six gardes simples ont échoué ; l'écart ESV > 50 mm perd 110 justes et
crée deux autres faux (`:87-100`). D-051 impose actuellement d'observer sans
activer de garde (`DECISIONS.md:465-479`).

**Porte proposée pour un candidat.** Les deux faux ciblés arrêtés, zéro juste
perdu directement **ou par effet sur les appuis**, zéro nouveau faux sur toutes
les références jugées. Les cuts non jugés restent séparés, jamais déclarés
justes. Si la base 4.8.6 les arrête déjà, expliquer et vérifier pourquoi avant
de chercher une modification. Ces critères prolongent la demande de qualité
et les colonnes de l'étude ; ce ne sont pas des résultats acquis.

**Mesure.** Reproduire d'abord le résultat historique, puis rejouer les mêmes
entrées qualifiées avec les règles de 4.8.6. Toute différence est expliquée.
Comparer chaque candidat à cette base, en un seul passage et en recalculant
les appuis : faux arrêtés, justes perdus, nouveaux faux, décisions changées,
couverture et erreurs par partie. Inclure 983, 137, 405 et 114 dans le bilan,
sans limiter le contrôle aux deux cibles (`faux-sans-appui.md:78-106`). Une
future activation exige aussi les portes générales du cahier, notamment C3=0
et C4 : au moins 100 poses jugées, au moins 80 % des posées jugées, au plus
deux faux pour 100, dans l'ordre sans sélection
(`BANANE_4.9_CAHIER.md:234-250`), et une partie neuve réservée avant réglage.
Le banc des 633 cuts et huit jeux est rapporté ; toute variation attendue est
justifiée cut par cut, aucune autre variation n'est acceptée.

**Dépendances.** Corpus privé intact, tailles et empreintes vérifiées
(`faux-sans-appui.md:18-25`), références humaines qualifiées, rotation D-057 et
P2. L'étude est confiée à une session d'analyse hors ligne disposant du corpus ;
l'orchestrateur lit seulement le résumé et les tableaux. Elle ne modifie pas
le moteur épinglé. Si une piste exige son changement, arrêt et décision écrite.

**Place proposée.** Après le chantier de retour à un cut, avant B1, une étude
à la fois. Livrable accepté : base reproduite et comparaison documentée,
y compris un résultat négatif. L'activation éventuelle reste un chantier
séparé de 4.9.5, à autoriser après cette étude ; aucune garde inefficace ajoutée
pour déclarer les deux cuts « corrigés ».

## 3. Apprentissage des positions de rails

**Objectif.** Étudier si une méthode apprise peut proposer de meilleures
positions que le moteur actuel. D'abord des essais hors ligne, sans commandes
dans ESV et sans remplacement du moteur épinglé.

**Point à trancher.** Le cahier demande le cadrage maintenant mais les besoins
renvoient l'apprentissage après la 4.9 (`BANANE_4.9_CAHIER.md:140-147` ;
`consignes/besoins-4.9-2026-09-30.md:101` ; `PLAN_SUITE.md:142`). Proposition :
garder ce cadrage préparatoire et démarrer l'étude seulement après la 4.9.5.

**Portes proposées pour l'étude future.** Audit de disponibilité d'au moins
1 000 rails exploitables : c'est le minimum historique du cahier 4.8, pas un
volume disponible vérifié ni une preuve de suffisance
(`BANANE_4.8_CAHIER.md:201-212`). Une revisite ne crée pas un nouvel exemple.
Séparer réglage et validation par parties, figer la méthode avant d'ouvrir les
parties réservées. Aucune donnée de validation utilisée pour apprendre.

Avant toute intégration : C1 non dégradé, C3=0, C4 conforme au cahier 4.9 ;
erreur médiane et queue haute non dégradées sur les mêmes références, avec le
plancher humain P2 publié (`BANANE_4.8_CAHIER.md:317-320`, principe historique,
base de comparaison à actualiser). Une amélioration mesurée est nécessaire
pour justifier l'intégration. **Son seuil chiffré et la définition de la queue
haute restent à fixer après P2 et la mesure de référence**, avant apprentissage ;
aucun gain en millimètres ou pourcentage n'est inventé. Les 1 000 rails seuls
n'autorisent aucune intégration.

**Mesure et dépendances.** Inventaire des exemples distincts et qualifiés,
répartition par partie, origine des références, exclusions et incertitude des
unités ; comparaison hors ligne sur une partie jamais utilisée pour régler.
Rapporter couverture, erreurs médiane et queue haute, faux et hors contrat,
temps de calcul, avec méthode et entrées reproductibles. P2, registre de
rotation et décision spécifique pour toute modification du moteur sont requis.
Les données humaines d'apprentissage ne deviennent jamais la réponse du cut
en cours pendant une pose automatique.

## Décisions demandées ensemble

1. Adopter les cadrages du retour à un cut et de l'étude 398/402, leurs portes
   proposées et leur place au début de la 4.9.5, avant B1.
2. Confirmer que l'apprentissage des positions reste après la 4.9.5, avec un
   cadrage préparatoire seulement maintenant et les seuils d'amélioration à
   décider sur les mesures.

Après la réponse, consigner D-066 et l'avenant adopté ; puis faire lancer l'audit
séparé prévu par `consignes/audit-cahier-49.md`. Aucun chantier ne commence ici.
