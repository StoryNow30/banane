# CH-120 : rappel du pool au livré (mesure ÉTABLIE, banc de CH-116, 13/11)

Pool « H » = hypothèses H0-H6 de la GCV2 ; « eff » = H plus les cellules de la recherche recentrée livrée. A* = bonne paire présente et d'écartement admissible. Vérité : pose finale du corpus de CH-116 (hors D-285). Cuts jugés sans nuage (44) non mesurés.

### Total
| groupe | n | H : A* / A / B / C | eff : A* / A / B / C | rappel eff (A+A*) |
|---|---|---|---|---|
| tous | 747 | 535 / 4 / 125 / 83 | 615 / 4 / 96 / 32 | 82.9 % |

### Par zone
| groupe | n | H : A* / A / B / C | eff : A* / A / B / C | rappel eff (A+A*) |
|---|---|---|---|---|
| abords | 289 | 246 / 2 / 33 / 8 | 254 / 2 / 25 / 8 | 88.6 % |
| adv | 388 | 235 / 2 / 82 / 69 | 307 / 2 / 61 / 18 | 79.6 % |
| pn | 70 | 54 / 0 / 10 / 6 | 54 / 0 / 10 / 6 | 77.1 % |

### Par sort au lot
| groupe | n | H : A* / A / B / C | eff : A* / A / B / C | rappel eff (A+A*) |
|---|---|---|---|---|
| 10-50 | 36 | 23 / 0 / 8 / 5 | 31 / 0 / 5 / 0 | 86.1 % |
| differe-corrige | 189 | 59 / 2 / 78 / 50 | 84 / 2 / 76 / 27 | 45.5 % |
| differe-juste | 13 | 11 / 2 / 0 / 0 | 11 / 2 / 0 / 0 | 100.0 % |
| juste | 479 | 437 / 0 / 25 / 17 | 475 / 0 / 4 / 0 | 99.2 % |
| mauvaise-voie | 30 | 5 / 0 / 14 / 11 | 14 / 0 / 11 / 5 | 46.7 % |

### ADV par sort
| groupe | n | H : A* / A / B / C | eff : A* / A / B / C | rappel eff (A+A*) |
|---|---|---|---|---|
| 10-50 | 28 | 18 / 0 / 5 / 5 | 24 / 0 / 4 / 0 | 85.7 % |
| differe-corrige | 122 | 40 / 2 / 44 / 36 | 61 / 2 / 46 / 13 | 51.6 % |
| juste | 208 | 172 / 0 / 19 / 17 | 208 / 0 / 0 / 0 | 100.0 % |
| mauvaise-voie | 30 | 5 / 0 / 14 / 11 | 14 / 0 / 11 / 5 | 46.7 % |

### Causes d'absence d'un rail (pool effectif ; rails)
| zone, cause | rails |
|---|---|
| adv hors-fenetre-soutenu | 44 |
| hors-adv hors-fenetre-soutenu | 33 |
| adv hors-cadre-soutenu | 28 |
| hors-adv moteur-sans-repere | 13 |
| hors-adv hors-cadre-soutenu | 11 |
| adv cellule-ecartee-flank | 7 |
| adv tronquee | 6 |
| adv non-detecte-cellule-10-20 | 4 |
| adv hors-fenetre-sans-soutien | 3 |
| hors-adv sans-soutien | 3 |
| adv sans-soutien | 3 |
| hors-adv cellule-ecartee-flank | 2 |
| hors-adv hors-fenetre-sans-soutien | 1 |
| adv cellule-ecartee-minTop | 1 |
| adv cellule-ecartee-slope | 1 |

### Par étage du lot réel (pool effectif)
| étage | n | A | B | C |
|---|---|---|---|---|
| deferred, ADV | 219 | 144 | 59 | 16 |
| deferred, hors ADV | 225 | 178 | 33 | 14 |
| first-pass, ADV | 110 | 108 | 1 | 1 |
| first-pass, hors ADV | 88 | 88 | 0 | 0 |
| window, ADV / hors | 29 / 7 | 28 / 7 | 0 / 0 | 1 / 0 |
| choice, ADV / hors | 29 / 20 | 28 / 20 | 1 / 0 | 0 / 0 |
| crossing | 20 | 18 | 2 | 0 |
