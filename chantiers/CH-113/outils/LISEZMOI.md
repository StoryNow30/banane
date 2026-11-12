# Outils de CH-113 (hors ligne, lecture seule)
- `juge-rejeu.cjs` : juge un ou plusieurs rejeux du banc contre les vérités d'Écho (pire rail, 3D, 10 et 50 mm), profils au choix, `reel` compris ; CSV par cut.
- `fidelite.cjs` : décisions et poses d'un profil contre le lot réel, cut par cut.
- `diff-rejeux.cjs` : cuts changés entre deux rejeux, jugés ; voie choisie et écart au départ.
- `mesure-consensus.cjs` : poses du chemin « consensus » de la GCV2 selon les voisins posés plus tôt.
Les leviers se règlent au banc par `BANC_LEVIERS` (JSON), une fois `../leviers-ch113.patch` appliqué dans une copie de travail hors dépôt :
`departHorsContratExclu`, `completionSansSoutien` (+ `completionZones`, `completionFenetre`, `completionEcartRefMm`, `completionDevers`, `completionEcartement`, `completionRecherche`, `completionPasMm`, `completionFenetreLatMm`, `completionFenetreVertMm`), `sousTauCoherentAbordsMm`.
`../mesure-cascade-banc.patch` (banc seulement) : `BANC_COMPLETION_ISOLEE=1`, une pose de la complétion n'est voisine de personne.
