# Ariane 4.9.0 — notes de version pour Mic

Version candidate stable, préparée le 15 octobre 2026. **C'est le code de la test 17, celle que tu as essayée sur la
partie 27** : seuls le numéro de version et les documents changent. Rien ne change dans ce qu'Ariane décide, pose ou valide
par rapport à la test 17. La fusion dans `main`, l'étiquette `v4.9.0` et la publication restent ta décision.

- Paquet : `ariane-v4.9.0.zip` (l'empreinte SHA-256 est dans mon message : ce fichier est dans le paquet et ne peut pas
  porter sa propre empreinte).
- À l'écran : « 4.9.0 » sur la carte de l'extension, « ARIANE 4.9.0 » dans le panneau, « Ariane 4.9.0 · ouvrir » sur le
  bouton blanc d'ESV. Plus de « test ».
- Installation : comme pour les tests. Tout exporté d'abord ; décompresser par-dessus, dans le même dossier ; « Recharger »
  sur la carte ; **F5 sur ESV**. Ne désinstalle pas (ça efface le cache).
- Porte de version, critère par critère : `fiches/PORTE_4.9.0.md`.

## 1. Ce qui change pour toi depuis la 4.8.6

- **Ariane va environ deux fois plus vite.** Le « mode rapide » lit la vue d'ESV dès qu'elle a fini de charger, choisit le
  rail tout de suite et pose sans recentrer la caméra. Neuf cuts sur dix passent en rapide ; un sur dix reste en mode
  « référence » (l'ancienne façon), tiré d'après son numéro, pour surveiller la qualité.
- **Elle ne ralentit plus au fil des lots**, même si tu ne vides pas le cache (avant, l'état grossissait à chaque lot).
- **Écartement** : Ariane ne pose une paire qu'entre 1420 et 1470 mm (ta consigne du 12 octobre).
- **Le panneau** est celui que tu as choisi (« Accueil ») : grande tuile du lot, cartes des départs, thèmes clair et sombre.
  Sur un lot qui va du premier cut à la fin de la partie, la tuile compte **les invalides traités** (« 39 / 514 invalides ») ;
  sur les autres lots, la position dans la plage.
- **Départs des parties** : au départ de chaque partie, Ariane note validés, invalides et total. Ces fiches restent quand tu
  vides le cache et partent dans chaque export, avec l'historique par partie.
- **Toutes les heures sont celles de Paris**, à l'écran et dans `CONTENU.txt`.
- **Export** : un seul bouton, « Tout télécharger pour l'analyse ». Si c'est gros, il sort tout seul en volumes de 17 Mo au
  plus (`…-volume01-sur03.zip`), chacun lisible seul. Envoie tous les volumes. Le cache ne se vide que si tous les volumes
  sont bien enregistrés.
- **Pause, Reprendre, Arrêter, F5** sont plus solides (B3) : après la fin d'un lot, « Reprendre » dit « Lot déjà terminé » et
  ne rejoue rien ; après un arrêt en plein cut, « Reprendre » refuse si tu as bougé un rail entre-temps.
- Les raccourcis d'ESV `D` (cut de droite) et `Maj + Espace` (valider) ne sont ni doublés ni détournés par Ariane.

## 2. Ce qui est mesuré

Chaque chiffre compare, **dans le même lot**, les cuts en rapide aux cuts en référence (cycle médian par cut).

| Séance | Version | Partie | Rapide | Référence | Gain | Part posée (C1) rapide / référence |
|---|---|---|---|---|---|---|
| Test 15 | 4.9.0.15 | 24 | 2,65 s | 5,71 s | **−54 %** | 79,2 % / 79,6 % |
| Test 16 | 4.9.0.16 | 26 | 1,69 s | 5,91 s | **−71 %** | 84,0 % / 84,6 % |
| Test 16 | 4.9.0.16 | 25 | 3,12 s | 6,00 s | **−48 %** | 81,0 % / 83,0 % |
| Test 17 | 4.9.0.17 | 27 (séance entière) | 2,51 s | 5,80 s | **−57 %** | au niveau de la référence |
| Test 17 | 4.9.0.17 | 27 (lot 2, page ESV fraîche) | 1,72 s | — | **−71 %** | — |

- La porte demandait **−25 %** ; l'objectif était **−40 %**. Les deux sont dépassés sur toutes les séances.
- **Fourchette honnête : −48 % à −58 % en durée, jusqu'à −71 % quand ESV signale proprement la fin du chargement** (voir § 5).
- **Part posée (C1)** : au niveau de la référence (écarts de 0,4 à 2 points, dans le bruit mesuré entre deux moitiés d'un même lot).
- **0 capture perdue** sur les lots de terrain de la 4.9 reçus.
- **B3 sur le terrain** : pause et reprise, F5 en plein lot, arrêt en plein cut, fin de partie : tenus. Tu as aussi confirmé que
  pause/reprise et F5 reprennent automatiquement au bon endroit, même après une mise en veille du PC.
- Test 16 sur la partie 26 : 370 invalides traités, 0 arrêt, 16,8 minutes, sans intervention.

## 3. Ce qui reste en ombre

- **B1 (voisins validés lus dans la liste des coupes d'ESV)** : calculé et noté dans le journal à chaque cut, **sans aucun
  effet sur la pose**. Raison : sur les lots relus, B1 aurait aussi retiré une bonne pose (partie 18, cut 5290), et la pose qu'il proposerait n'est pas encore consignée. Il ne sera activé qu'après lecture de ces notes.
- **Retour à une coupe** : présent dans le code, en lecture seule, **sans bouton et jamais appelé**. Pas vérifié sur le vrai ESV.

## 4. Limites connues

- **La vitesse dépend d'ESV** : au bout d'environ 10 minutes sur la même page ESV, le signal de fin de chargement disparaît
  souvent ; Ariane attend alors 800 ms par rail, et le gain retombe vers −50 %. Un F5 sur ESV a rétabli le signal sur les
  pages observées (à confirmer, voir § 5).
- **Pas de petit fichier séparé « Préparer pour analyse »** : il n'y a qu'un export, découpé en volumes. Le gain de poids
  mesuré est d'environ un tiers sur les nuages LiDAR (le −40 % du cahier n'est pas démontré).
- **Pause de sécurité « Lecture LiDAR instable, vue non recentrée »** : elle peut arriver (partie 25, partie 27). C'est voulu :
  Ariane s'arrête plutôt que de poser sur une lecture douteuse. « Reprendre » repart.
- **Un cut peut être posé deux fois** si un F5 tombe en pleine validation (cut 5440, partie 27) : sans effet nuisible vu.
- **Mesuré sur Chrome seulement** ; Edge n'a pas été essayé sur le terrain. Navigateur 111 ou plus exigé.
- **Banc complet des 633 cuts** (corpus privé) : pas relancé pour cette version ; les essais du dépôt passent tous.
- **C4 (exactitude des poses) n'est plus une porte de la 4.9** (ta décision du 12 octobre) ; il reste à retravailler pour la 5.0.
- Deux petits défauts connus de la sauvegarde V5, sans perte de données (validation d'un cut vidé après un redémarrage ;
  archive d'une migration jamais relue) : notés dans les problèmes connus.

**Encore à essayer lors de la séance finale** : Arrêter puis Reprendre en ayant bougé un rail (refus attendu) ; Reprendre
après la fin (« Lot déjà terminé ») ; un lot à plage fixe jusqu'à son dernier cut ; une erreur dans l'avis (démarrer sans
onglet ESV prêt).

## 5. Ce qui est prévu pour la 4.9.5

**Le signal de fin de chargement (D-109)** : sur cinq pages ESV (tests 15 à 17), la plupart des vues sont lues au signal
pendant les dix premières minutes, puis plus aucune ; un F5 le rétablit. Hypothèse : le compteur de chargements de Potree
ne revient plus à zéro au bout d'un moment. Si c'est confirmé, garder le signal (ou recharger la page au bon moment)
donnerait **−70 % durable au lieu d'environ −50 %**. On commence hors ligne : noter, à chaque repli sur 800 ms, l'état du
compteur et la raison du repli, sans rien changer à la pose. Aussi au programme de la 4.9.5 : B1 (activation selon
l'ombre) et le retour à une coupe.

## 6. Retour arrière : la 4.8.6

Cible : **Ariane 4.8.6**, étiquette `v4.8.6`, paquet `ariane-v4.8.6.zip`.

1. **Termine ou arrête le lot, exporte tout et vérifie que tous les volumes sont bien enregistrés.** La 4.9 range ses visites
   autrement : la 4.8.6 relira son état sans planter, mais elle ne verra pas les visites enregistrées par la 4.9.
2. Remplace le contenu du dossier de l'extension par la 4.8.6, puis « Recharger ». **Ne désinstalle pas.**
3. **F5 sur ESV, obligatoire** (l'adaptateur de la 4.9.0 resté dans la page n'obéit qu'à la 4.9.0).
4. Vérifie « 4.8.6 » dans le panneau et sur le bouton blanc.

Ce que le retour annule : le mode rapide, la sauvegarde à taille constante, les départs des parties, le nouveau panneau,
l'export en volumes et la borne d'écartement de 1420 mm (la 4.8.6 garde son contrat d'avant, à partir de 1405 mm).
