# Examen vierge : 12/11, parties 3 et 4 (CH-116, 13/11 ; ÉTABLI sauf mention)
Lot `1211v` (Constellation 0 → 4 du 12/11 ; Échos du 12/11 p3 et p4, banane-data c163651). Hors du corpus commun : à ne transmettre à aucun autre chantier (examen des réglages figés de CH-117 et de CH-119 à CH-122).

## Corpus (`corpus.jsonl`, `resume.md`)
152 cuts (p3 : 59 posés ; p4 : 86 posés, 7 différés). Jugés (visites et validations sans mouvement < 1,5 s écartées, D-285) : 21 posés, 16 à 10 mm ou moins, 4 de 10 à 50, 1 mauvaise voie (4/6916, 133,5 mm) ; 7 différés, 7 corrigés (6604, 6915, 6917-6919, 6945, 6946). Le banc classe 6916 en zone `abords` (6917 et suivants en `adv`). 5 poses de la deuxième passe sans décalage au journal (6686, 6920, 6944, 6950, 6952), non jugées.

## Fidélité du rejeu livré (`fidelite-*.txt`)
- Passe éteinte : décisions 147/152, poses à 1 mm 140/140. Les 5 écarts sont les 5 poses de la deuxième passe.
- Passe livrée (`deuxiemePasse` 2, `sansVoieRien`) : décisions 152/152, poses 140/145 (les 5 poses de la passe n'ont pas de décalage au journal, rien à comparer).
- Effet de seuil : 3/5321 et 3/5653 sont posés par le lot à 9,8 et 9,9 mm ; le rejeu (à moins de 1 mm du lot) les place à 10,2 et 10,1 mm, donc en « 10-50 » au banc.

## Jugement unique du réglage figé C2 + C5 (`chantiers/CH-117/reglage-c25.json`, patch `gcv2-voie-adv.patch`, tel quel)
Voir `par-partie.md` et `juger-c25-*.md`. Partie 3 : aucun changement. Partie 4 : 6947 (posé à 0,4 mm, juste) devient différé, avec ou sans passe ; à passe éteinte seulement, 6952 passe de différé à posé (pose de la deuxième passe au lot réel, non jugée). 6916 reste posé à 133,7 mm : décision GCV2 ordinaire (« valider », p = 0,448 au-dessus de τ = 0,44 ; aucun appui), en zone `abords` au banc ; C2 ne touche que les paires sous τ en ADV, et la garde C5 ne s'est pas déclenchée. Ses voisins 6915, 6917 à 6919 restent différés.
