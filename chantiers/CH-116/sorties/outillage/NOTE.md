# Outillage (audit GCV2.1, R5 et passe) : zones et passe fidèle (CH-116, 13-14/11 ; ÉTABLI)
## Zones (`outils/zones.cjs`, `zones-corpus.md`)
Trois définitions : banc (mémoire recalculée avant le cut), lot (zone du service worker à la décision, événement `regles-metier-ombre`), fin (union des plages de contrôle du lot = « verts à contrôler »).
- Corpus (4 016 cuts) : banc ≠ lot sur 7 % des cuts hors 0411 (surtout banc `abords` → lot `adv`) ; 0411 : 362 cuts sans nuage, sans zone au banc. Les 30 mauvaises voies du corpus sont `adv` dans les trois définitions.
- Examens vierges : 4/6916 abords / abords / adv ; 6/462 abords / ADV / adv.
- Cause PROBABLE : le service worker nourrit sa mémoire de la décision réelle et des lignes de la liste d'ESV ; le banc, d'un résumé sans décision ni liste.
- Option du banc `BANC_ZONES=journal` (zone du lot). Rejeu livré : fidélité des décisions 98,6 % (98,7 % sans) ; jugés : 2 changements d'état sur le corpus, 4 poses déplacées sur 1312v.
## Passe fidèle (`BANC_PASSE_PLAFOND=10`, `fidelite-livre-passe-fidele.txt`)
Écriture de la passe comme le service worker : ordre de décision, 10 au plus, arrêt à la première pose non écrite (seul refus visible au banc : cible hors de la vue).
- Fidélité des décisions, corpus + examens (5 475 cuts) : 99,2 % (livré sans passe 98,7 % ; passe sans plafond 98,8 %) ; 1111 p16 419/421 (405 sans plafond) ; 1312v 6/463 reste posé par la passe du banc (différé au réel : la passe réelle ne l'a pas écrit pour une raison que le banc ne voit pas).
