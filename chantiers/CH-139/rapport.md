# CH-139 — effet net du retrait du passage « branche » — mesuré, écarté

**Méthode.** Rejeu fidèle du corpus (4 016 cuts, banc à zones de lot `BANC_ZONES=journal`, passe plafonnée à 10, profil L1-se, écriture du passage actuelle) sur trois variantes de l'écriture de la passe, sans rien changer à `src/` :

| Variant | Différés | Justes ≤ 10 mm | Fausses > 10 mm | > 50 mm |
|---|---:|---:|---:|---:|
| Livré (`ch139-livre-zjp`) | **564** | **506** | 36 | **29** |
| Contrôle départ (ancre, `ch139-N-zjp`) | 596 | 508 | 36 | 0 |
| Sans branche (variante CH-139) | **602** | **505** | 36 | 0 |

**Question :** que donnerait « la deuxième passe ne pose plus quand son motif est `branche` » ?

**Réponse :** la passe sans branche écrit **12 décisions en moins** (non posées), comme attendu — le passage est aussi protégé par les décisions « rien » du livré (56 sans approche, 42 sans voie, 28 départs probables…).

**Differentiel départ → « sans branche »** (même corpus, même banc) : **+6 différés, −3 justes, 0 erreur évitée, 0 nouvelle juste** ; 5 justes perdues (0511/2005, 0511/4974, 0511/9335, 0411/170, 1211/5285). **Conclusion : le retrait augmenterait les différés (596 → 602) et ferait perdre 3 justes, sans rien éviter.**

Note : le terrain du 16 et 17/11 avait montré 6 fausses sur 6 sur « branche » (26 à 50 mm) — ce n'est pas le corpus du 18/11 : le retrait y a costé **5 justes perdues et 0 erreur évitée**, et n'a supprimé aucune pose « branche » commise par le livré (à jeter, pas à traiter ici).

## Reste à faire

- **A1** : les chiffres de cette mesure terminent les questions du plan : sur le banc actuel **564 différés**, 596 avec l'ancre. Le plan cite 571 → 603 (écriture du 14/11, voir ci-dessous).
- **A3** : les trois inconnues — la page d'ESV muette 3 min après Maj+Espace, la cause de la fragilité des essais, Glacier/vue fil/Mix en crochet visuel. La mesure du 19/11 : le silence ne reproduit pas (rapport du journal, CH-140).
- **A2/A4** en file.

**Vérifications du plan** (LIRE_EN_PREMIER) : la figure publiée du 14/11 (603 différés, 29 → 0, 503 ≤ 10 mm) date de l'écriture avant D-363 ; le passant actuel débouche à **564 différés** (sans ancre), ou **596** avec l'ancre, **29 > 50 mm** dans les deux.

**Pointers** : sorties sous `banane-data/outils/analyse-lots/CH-139/sortouts/` (`differentiel.md`, `differentiel.csv`, `resume.json`, `motifs-*.md`, `*-tableau.md`) ; scripts sous `banane-data/outils/analyse-lots/CH-139/` (`mesure.cjs`, `rejeux.sh`, `rejeux-v18.sh`, `plafond-arret-v18.patch`, `NOTE.md`), rejouables depuis `/home/opencode/.ariane/tmp-CH-139/travail/`.

## Ce que le banc ne juge pas
- Justesse des poses « branche » écrites par le livré : non jugées, et non lue par le banc.
- La raison pour laquelle le passage existe : c'est une opération conçue, non mesurée ici.
