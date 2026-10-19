# Candidate L1 sur les différés du lot : banc conjoint, prédictions scellées, test 10 (D-217, D-219) — 19 octobre 2026

Ce document ne contient que des numéros de parties, de lots et de cuts, des millimètres et des comptes. « 2:1 » veut dire : projet 2, partie 1.

La candidate L1 est déclarée en D-219. Elle n'est pas changée d'après les résultats. Les détails que D-219 n'écrit pas sont tranchés au § 2, **avant toute mesure** (ce paragraphe est déposé seul, dans un commit qui précède le premier calcul du banc).

## 1. La candidate L1 (rappel de D-219)

- **P2** : la GCV2 (hypothèses H0 à H6, paramètres figés) agit sur les différés du lot **sans le couloir de 45 mm** depuis la pose de départ ; τ, δ et l'écartement de la paire sont gardés. Une cible hors de la vue : on déplace la vue, puis on pose. La garde de paire du lot est éteinte. Les appuis de reprise sont élargis à 10 cuts.
- **Sous τ** : on **pose sans valider**. Le cut reste invalide (rouge) ; Mic repart d'une pose approchée. Exception : si la meilleure paire est à plus de 150 mm de la pose de départ, on ne pose rien.
- **Variante L1-v** (chiffrée, jamais activée sans décision écrite) : sous τ, on valide et on inscrit le cut aux verts à contrôler (hors cas à plus de 150 mm).
- **Inchangés** : le contrat d'écartement du moteur, τ, l'écartement de la paire, la géométrie (`src/geometry*.js`).

## 2. Détails tranchés avant la mesure

1. **Paramètres de la GCV2** : `datasets/gcv2-parametres-h6.json`, usage « lot » (SHA-256 `679015ef515547287fdb0fbdde4cdf5a015c8644ef6a170005d67a2ab6eee5f8`). La demande citait `datasets/gcv2-parametres.json`. Ce fichier ne connaît pas l'origine H6 (il a été appris avant H6, sur H0 à H5) : il ne peut pas noter les hypothèses H6 que L1 doit lire. Le fichier « h6 » est le seul appris avec H6, sur le jeu « lot » sans appui humain, et c'est lui que le diagnostic a utilisé pour chiffrer P1 et P2. Aucun réglage n'est changé.
2. **Meilleure paire** : le produit des scores à 10 mm des deux rails, sur toutes les paires d'hypothèses dont l'écartement tient (médiane de la partie ± 15 mm, ou contrat 1 420–1 470 mm), la paire de départ comprise. Pas de couloir, pas de contrôle de dévers (comme la variante « aucun couloir » du diagnostic).
3. **Poser et valider** : la meilleure paire est au-dessus de τ (seuil de la zone) et s'écarte d'au moins δ (seuil de la zone) de la pose de départ, en latéral ou en vertical, sur un rail au moins.
4. **Ne rien poser** : la paire de départ est la plus probable ; ou la meilleure paire s'écarte de moins de δ (déplacement inutile).
5. **Sous τ** (et à δ au moins) : poser sans valider, sauf si la paire est à plus de 150 mm de la pose de départ. Cette distance est mesurée en 3D, sur le pire des deux rails.
6. **L1-v** : sous τ, à 150 mm au plus : valider, et inscrire le cut aux verts à contrôler.
7. **Appuis** : une pose validée par la GCV2 devient un appui de la chaîne du lot et un voisin pour les cuts suivants (comme un premier passage). Une pose non validée n'est ni l'un ni l'autre.
8. **Options du lot sous L1** : garde de paire éteinte, et appuis à 10 cuts au plus au lieu de 3. Comme dans le diagnostic, ce seuil sert à la fois à la garde de continuité du premier passage et à la reprise depuis la voie (c'est le même réglage du code).
9. **Cible hors de la vue** (commande du lot, de tout étage, et poses de la GCV2) : si la cible tombe dans la vue élargie (`camerasLarges`), la vue est déplacée puis la pose est faite. Le banc compte ces déplacements et suppose qu'ils réussissent. Hors de la vue élargie : rien n'est posé.
10. **Contrôles de la commande** gardés pour les poses de la GCV2 : position relue à 0,01 mm, écartement admissible pour la commande du moteur.
11. **Règle « grappe de différés »** : gardée telle que chaque lot l'avait (active seulement en 2:8 et 2:9). Elle vaut aussi pour les poses validées de la GCV2.
12. **Zone** (PN, ADV, abords) : le moteur de zones du dépôt, rejoué dans l'ordre du lot, évalué avant la décision du cut. La zone ne dépend que des captures : elle est la même pour tous les profils.
13. **Rejeu par lot** : chaque lot est rejoué seul, du premier au dernier cut, avec les appuis de départ qu'il avait (lots de reprise). Le dénominateur est celui du lot réel (ses cuts traités). Une reprise réelle est donc rejouée comme si le lot précédent avait été celui d'aujourd'hui, avec ses cuts réels : c'est la définition de la base du diagnostic.
14. **Moteur** : la science de chaque cut est recalculée avec le moteur d'aujourd'hui, comme la test 10 le ferait. Un cut sans nuage garde son sort réel.
15. **Différé après L1** : un cut que le lot ne valide pas. Un cut « posé sans valider » reste un différé ; il est compté à part (« approché »).
16. **Jugement contre Mic** : les règles du diagnostic (Écho de la même séance, pose de départ vérifiée à 2 mm, nuage, cut non posé ensuite par un autre lot). Écart entre deux poses : le pire des deux rails, en 3D. Gain d'un cut = écart de la pose de départ à Mic − écart de la pose L1 à Mic (0 si L1 ne pose rien). **Rappel** : parmi les jugés dont la pose de départ est à plus de 10 mm de Mic, la part que L1 pose à 10 mm au plus.
17. **Base** : le sort réel de chaque cut dans le journal (inventaire du diagnostic). À côté, la **base rejouée** (le code d'aujourd'hui, sans L1) dit si le rejeu est fidèle.
18. **B1** (voisins de la liste d'ESV) : ignoré ; il n'était qu'en ombre dans tous les lots.
