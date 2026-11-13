# Autopsie CH-123 : 128 cuts hors du pool (B ou C), 160 rails manquants


## Terrain × cause
| clé | rails |
|---|---|
| CH-120 adv hors-fenetre-soutenu | 44 |
| CH-123 hors-adv hors-fenetre-soutenu | 33 |
| CH-120 adv hors-cadre-soutenu | 28 |
| CH-123 hors-adv moteur-sans-repere | 13 |
| CH-123 hors-adv hors-cadre-soutenu | 11 |
| CH-123 adv cellule-ecartee-flank | 7 |
| CH-123 adv tronquee | 6 |
| CH-123 adv non-detecte-cellule-10-20 | 4 |
| CH-120 adv hors-fenetre-sans-soutien | 3 |
| CH-123 hors-adv sans-soutien | 3 |
| CH-123 adv sans-soutien | 3 |
| CH-123 hors-adv cellule-ecartee-flank | 2 |
| CH-123 hors-adv hors-fenetre-sans-soutien | 1 |
| CH-123 adv cellule-ecartee-minTop | 1 |
| CH-123 adv cellule-ecartee-slope | 1 |

## Terrain × diagnostic
| clé | rails |
|---|---|
| CH-123 oracle-ok compagnon-non | 42 |
| CH-120 oracle-ok | 36 |
| CH-120 oracle-ok compagnon-non | 25 |
| CH-123 oracle-ok | 18 |
| CH-120 oracle-ok compagnon-ok | 11 |
| CH-123 oracle-ok compagnon-ok | 10 |
| CH-123 vide | 9 |
| CH-123 oracle-loin compagnon-non | 4 |
| CH-120 oracle-loin compagnon-non | 2 |
| CH-120 vide compagnon-non | 1 |
| CH-123 vide compagnon-non | 1 |
| CH-123 oracle-loin | 1 |

## Cause × diagnostic (mon terrain)
| clé | rails |
|---|---|
| CH-120 | 75 |
| hors-fenetre-soutenu → oracle-ok | 33 |
| hors-cadre-soutenu → oracle-ok | 11 |
| moteur-sans-repere → vide | 10 |
| cellule-ecartee-flank → oracle-ok | 9 |
| tronquee → oracle-ok | 6 |
| sans-soutien → oracle-ok | 5 |
| non-detecte-cellule-10-20 → oracle-ok | 4 |
| moteur-sans-repere → oracle-loin | 3 |
| hors-fenetre-sans-soutien → oracle-loin | 1 |
| cellule-ecartee-minTop → oracle-ok | 1 |
| sans-soutien → oracle-loin | 1 |
| cellule-ecartee-slope → oracle-ok | 1 |

## Détail (une ligne par rail)
| lot | p | cut | zone | sort | cl | rail | cause | terrain | dmin | lat/vert vérité | dessus/flanc | cellule la plus proche | oracle | diag | compagnon | graines | réf | décision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0411 | 14 | 170 | adv | differe-corrige | B | r | cellule-ecartee-flank | CH-123 | 37.3 | -37.3/-1.4 | 70/4 | 3.3mm t71 f4  flank | 1.3mm t70 f4 r5.961 | oracle-ok | g5.1 cel2.1/3 t67 f4 r5.154 ✓ | proche+va+h0 | 1435.9L | rien/depart-le-plus-probable |
| 0411 | 14 | 4131 | pn | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 68.6 | 110.1/0.4 | 83/19 | 31.6mm t46 f0  flank | 3.7mm t79 f22 r1.381 F | oracle-ok | g3.7 cel3.6/7 t78 f22 r1.259 ✓ |  | 1444.5L | rien/veto-voie-absolue |
| 0411 | 14 | 4132 | pn | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 66.4 | 106.3/7.5 | 73/27 | 25.2mm t72 f3  flank | 2.2mm t77 f23 r4.228 | oracle-ok | g7.4 cel2/5.5 t77 f21 r1.547 ✓ |  | 1444.3L | rien/depart-le-plus-probable |
| 0411 | 14 | 4133 | pn | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 37.5 | 105.4/7.1 | 84/20 | 26.4mm t69 f0  flank | 1.9mm t85 f17 r1.765 | oracle-ok | g5.7 cel1.8/7 t83 f17 r2.516 ✓ |  | 1444.2L | rien/sans-approche |
| 0411 | 14 | 4134 | pn | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 52.1 | 102.6/11.2 | 88/18 | 23.4mm t41 f0  flank | 1.9mm t87 f14 r1.972 | oracle-ok | g9.4 cel2.3/11.4 t75 f4 r25.126 |  | 1444.1L | rien/veto-voie-absolue |
| 0411 | 14 | 5340 | abords | differe-corrige | C | l | moteur-sans-repere | CH-123 | 12.6 | -12/-3.7 | 0/0 |  | rien | vide |  | h0 | 1433.8L | rien/depart-le-plus-probable |
| 0411 | 14 | 5340 | abords | differe-corrige | C | r | moteur-sans-repere | CH-123 | 42.8 | 42.8/-2.6 | 1/0 |  | rien | oracle-loin |  | h0 | 1433.8L | rien/depart-le-plus-probable |
| 0411 | 15 | 443 | abords | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 30 | 141.7/8.4 | 75/9 | 34.7mm t23 f0 C flank | 2.2mm t77 f5 r56.648 | oracle-ok | g14.1 cel2.2/16.3 t77 f5 r56.978 | d0+h0 | 1441.3L | rien/sans-approche |
| 0411 | 15 | 463 | pn | differe-corrige | C | l | hors-fenetre-soutenu | CH-123 | 17.3 | 94.9/7.8 | 76/11 | 18.4mm t18 f5  flank | 4.4mm t77 f15 r1.181 F | oracle-ok |  |  | 1440.7L | rien/sans-approche |
| 0411 | 15 | 463 | pn | differe-corrige | C | r | hors-fenetre-soutenu | CH-123 | 64.4 | 149.8/20.1 | 77/24 | 62.9mm t82 f5 C flank | 1.5mm t81 f24 r1 F | oracle-ok |  |  | 1440.7L | rien/sans-approche |
| 0411 | 15 | 464 | pn | differe-corrige | C | l | hors-fenetre-soutenu | CH-123 | 14 | 95.8/7.4 | 82/20 | 15.6mm t78 f29 CS candidate | 4mm t79 f18 r1.324 F | oracle-ok |  |  | 1441.2L | rien/sans-approche |
| 0411 | 15 | 464 | pn | differe-corrige | C | r | hors-fenetre-soutenu | CH-123 | 74.2 | 150/15.8 | 77/16 | 70.4mm t63 f0  flank | 1.8mm t81 f18 r1.255 F | oracle-ok |  |  | 1441.2L | rien/sans-approche |
| 0411 | 15 | 468 | pn | differe-corrige | C | l | hors-fenetre-soutenu | CH-123 | 11.9 | 90.7/1.1 | 83/14 | 14.7mm t85 f25 CS candidate | 0.6mm t79 f16 r1 F | oracle-ok |  |  | 1442L | rien/sans-approche |
| 0411 | 15 | 468 | pn | differe-corrige | C | r | hors-fenetre-soutenu | CH-123 | 61.4 | 145.5/11.2 | 77/17 | 63.2mm t65 f0 C flank | 4.8mm t78 f15 r1.599 | oracle-ok |  |  | 1442L | rien/sans-approche |
| 0411 | 15 | 469 | pn | differe-corrige | C | l | hors-fenetre-soutenu | CH-123 | 14.6 | 91.9/-1.1 | 73/18 | 17.6mm t84 f35 S candidate | 6mm t78 f13 r2.192 | oracle-ok |  |  | 1441.4L | rien/sans-approche |
| 0411 | 15 | 469 | pn | differe-corrige | C | r | hors-fenetre-soutenu | CH-123 | 63.5 | 145.1/10.3 | 80/20 | 64.5mm t86 f9 CS candidate | 3.9mm t84 f24 r1.787 | oracle-ok |  |  | 1441.4L | rien/sans-approche |
| 0411 | 15 | 470 | pn | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 67.2 | 143.4/9.4 | 81/14 | 57.8mm t79 f3  flank | 2.5mm t82 f15 r1 F | oracle-ok | g18.6 cel2.3/20.2 t82 f15 r2.877 |  | 1442L | rien/sans-approche |
| 0411 | 15 | 472 | pn | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 71.3 | 145.4/3.4 | 84/12 | 59.9mm t74 f5  flank | 3.1mm t77 f15 r1.9 | oracle-ok | g18.6 cel3.2/20.8 t80 f22 r4.429 |  | 1442.7L | rien/sans-approche |
| 0411 | 15 | 3495 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 145 | -133.2/-57.3 | 69/18 | 56mm t0 f0  rsf | 2.2mm t65 f13 r2.287 | oracle-ok | g57.3 cel105.3/101.2 t7 f0 r50.353 | h0 | 1445L | rien/depart-le-plus-probable |
| 0511 | 10 | 2005 | abords | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 117.7 | 113.3/-31.9 | 74/3 | 33.5mm t18 f0  flank | 1.2mm t74 f0 r1.07 | oracle-ok | g32.3 cel1.2/31.1 t74 f0 r1.475 | h0 | 1443.7L | rien/depart-le-plus-probable |
| 0511 | 10 | 8780 | abords | differe-corrige | C | l | moteur-sans-repere | CH-123 | 42.5 | 41.1/-10.8 | 0/0 |  | rien | vide |  | h0 | 1441.2L | rien/depart-le-plus-probable |
| 0511 | 10 | 8780 | abords | differe-corrige | C | r | moteur-sans-repere | CH-123 | 106.4 | 106.1/8 | 0/0 |  | rien | vide |  | h0 | 1441.2L | rien/depart-le-plus-probable |
| 0511 | 12 | 9335 | abords | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 94.7 | 113.4/-34.3 | 58/7 | 22.9mm t25 f0  flank | 1.6mm t57 f5 r1 | oracle-ok | g34.3 cel1.4/35.4 t58 f5 r1.035 | h0 | 1440L | rien/depart-le-plus-probable |
| 0511 | 9 | 8726 | abords | differe-corrige | C | l | moteur-sans-repere | CH-123 | 27.1 | -27.1/-1.7 | 0/0 |  | rien | vide |  | h0 | 1444.3L | rien/depart-le-plus-probable |
| 0511 | 9 | 8726 | abords | differe-corrige | C | r | moteur-sans-repere | CH-123 | 31.3 | 31/-4.3 | 0/0 |  | rien | vide |  | h0 | 1444.3L | rien/depart-le-plus-probable |
| 0611 | 13 | 2744 | abords | differe-corrige | B | l | moteur-sans-repere | CH-123 | 88.8 | -88.8/-0.9 | 1/2 |  | rien | oracle-loin |  | proche+va+h0 | 1449.2L | rien/depart-le-plus-probable |
| 0611 | 13 | 2747 | abords | differe-corrige | B | l | moteur-sans-repere | CH-123 | 87.7 | -87.6/-4.3 | 2/2 |  | rien | oracle-loin |  | h0 | 1448.6L | rien/depart-le-plus-probable |
| 0611 | 13 | 8923 | abords | juste | B | l | cellule-ecartee-flank | CH-123 | 14.3 | -32.7/-11.2 | 34/3 | 1.4mm t35 f0  flank | 1mm t35 f0 r10.859 | oracle-ok | g2.8 cel0.8/2.7 t34 f0 r15.824 ✓ | d0+h0 | 1437.9L | rien/sans-approche |
| 0611 | 15 | 7258 | adv | differe-corrige | B | r | hors-fenetre-soutenu | CH-120 | 25.6 | 101.5/19.1 | 42/6 | 25.5mm t16 f0  flank | 2.9mm t41 f4 r1.133 | oracle-ok | g21.4 cel3/23.9 t41 f4 r1.113 | d0+h0 | 1443.8L | rien/sans-approche |
| 0611 | 15 | 7259 | adv | differe-corrige | B | r | hors-fenetre-soutenu | CH-120 | 101.3 | 100.4/13.8 | 46/5 | 22.3mm t24 f0  flank | 4.2mm t45 f5 r1.353 | oracle-ok | g20.6 cel4.7/24.9 t45 f5 r1 | d0+h0 | 1443.5L | rien/sans-approche |
| 0611 | 15 | 7260 | adv | mauvaise-voie | B | r | cellule-ecartee-flank | CH-123 | 59 | 59/-0.3 | 44/5 | 4.8mm t44 f3  flank | 4.4mm t44 f3 r1.014 | oracle-ok | g6.1 cel4.5/8.6 t44 f3 r1 ✓ | d0=dd+h0 | 1443.5L | valider/sous-tau-coherent |
| 0611 | 15 | 7263 | adv | differe-corrige | B | l | cellule-ecartee-flank | CH-123 | 72.9 | 70.9/-17 | 43/3 | 4mm t42 f0  flank | 1.1mm t43 f0 r1.067 | oracle-ok | g17 cel1/16.2 t42 f0 r1.015 | proche=va+h0 | 1442.2L | rien/depart-le-plus-probable |
| 0611 | 15 | 7264 | adv | differe-corrige | B | l | sans-soutien | CH-123 | 49.1 | 46.3/-16.2 | 41/2 | 2.7mm t40 f0  flank | 4.2mm t39 f0 r1.339 | oracle-ok | g25.7 cel3.2/23.9 t40 f0 r1 | d0+proche=va+h0 | 1441.9L | rien/sans-approche |
| 0611 | 15 | 7401 | abords | differe-corrige | B | l | sans-soutien | CH-123 | 14.3 | 20.4/-3.6 | 44/2 | 4.3mm t44 f0  flank | 4.2mm t41 f0 r2.977 | oracle-ok | g13 cel4.4/10.3 t38 f0 r2.721 | d0+h0 | 1440L | rien/sans-approche |
| 0611 | 15 | 7423 | adv | mauvaise-voie | B | l | sans-soutien | CH-123 | 13.4 | 27.4/-6.3 | 40/2 | 3.4mm t39 f0  flank | 2mm t38 f0 r1.384 | oracle-ok | g16.5 cel1.7/14.8 t37 f0 r2.688 | d0=dd+h0 | 1440L | valider/sous-tau-coherent |
| 0611 | 15 | 7426 | adv | differe-corrige | B | l | cellule-ecartee-flank | CH-123 | 65.8 | 64.4/-13.4 | 41/4 | 3.7mm t40 f3  flank | 3.2mm t40 f3 r2.49 | oracle-ok | g13.4 cel2.4/11.9 t39 f3 r3.317 | d0+proche=va+h0 | 1440.5L | rien/sans-approche |
| 0611 | 15 | 7428 | adv | differe-corrige | B | l | cellule-ecartee-flank | CH-123 | 41.2 | 40/-9.8 | 41/4 | 6.3mm t29 f0  flank | 2.3mm t32 f0 r1.078 | oracle-ok | g14.3 cel2.3/12.5 t31 f0 r1 | d0+proche=va+h0 | 1440.8L | rien/sans-approche |
| 0611 | 15 | 7634 | adv | differe-corrige | B | l | cellule-ecartee-flank | CH-123 | 15.8 | -13.9/-7.5 | 42/4 | 3.8mm t39 f3  flank | 1.7mm t42 f4 r6.804 | oracle-ok | g5.3 cel1.7/6.7 t42 f4 r8.82 ✓ | d0+proche+va+h0 | 1437.6L | rien/sans-approche |
| 0611 | 15 | 8407 | abords | differe-corrige | C | l | moteur-sans-repere | CH-123 | 29.6 | -28.1/-9.2 | 0/0 |  | rien | vide |  | h0 | 1438.6L | rien/depart-le-plus-probable |
| 0611 | 15 | 8407 | abords | differe-corrige | C | r | moteur-sans-repere | CH-123 | 36.9 | 36.5/-5.5 | 0/1 |  | rien | vide |  | h0 | 1438.6L | rien/depart-le-plus-probable |
| 0611 | 16 | 3407 | abords | differe-corrige | C | l | moteur-sans-repere | CH-123 | 40.9 | -40/-8.6 | 0/0 |  | rien | vide |  | h0 | 1441.2L | rien/depart-le-plus-probable |
| 0611 | 16 | 3407 | abords | differe-corrige | C | r | moteur-sans-repere | CH-123 | 20.6 | 20.5/1.8 | 0/0 |  | rien | vide |  | h0 | 1441.2L | rien/depart-le-plus-probable |
| 0611 | 16 | 7045 | abords | differe-corrige | B | r | cellule-ecartee-flank | CH-123 | 40.9 | 40.3/-6.7 | 41/5 | 1.9mm t42 f4  flank | 1.1mm t43 f4 r3.201 | oracle-ok | g12.5 cel0.8/12.4 t43 f4 r2.926 | d0+h0 | 1437.4L | rien/sans-approche |
| 0611 | 16 | 9119 | pn | differe-corrige | C | l | hors-cadre-soutenu | CH-123 | 174.7 | -191.5/98.6 | 130/18 | 142.1mm t9 f32  minTop | 2.1mm t133 f14 r1 F | oracle-ok |  |  | 1443.9L | rien/veto-voie |
| 0611 | 16 | 9119 | pn | differe-corrige | C | r | hors-cadre-soutenu | CH-123 | 176.2 | -182.6/64.1 | 125/22 | 134.7mm t21 f41 S candidate | 2.1mm t121 f19 r4.005 | oracle-ok |  |  | 1443.9L | rien/veto-voie |
| 0611 | 16 | 9122 | pn | juste | B | l | hors-cadre-soutenu | CH-123 | 114.2 | -199.3/9.6 | 130/19 | 90.3mm t38 f5  flank | 2.9mm t132 f16 r1 F | oracle-ok | g13.6 cel2.9/13.9 t130 f16 r2.283 |  | 1443.9L | rien/sans-approche |
| 0611 | 16 | 9123 | pn | differe-corrige | C | l | hors-fenetre-soutenu | CH-123 | 63.9 | -98.5/-4.9 | 130/17 | 18mm t101 f0  flank | 2.5mm t132 f15 r3.26 | oracle-ok |  |  | 1443.9L | rien/depart-le-plus-probable |
| 0611 | 16 | 9123 | pn | differe-corrige | C | r | hors-cadre-soutenu | CH-123 | 199 | -210.1/77.9 | 117/22 | 172.8mm t62 f16 S candidate | 1.7mm t76 f4 r110.531 | oracle-ok |  |  | 1443.9L | rien/depart-le-plus-probable |
| 0611 | 16 | 9168 | pn | 10-50 | B | l | hors-cadre-soutenu | CH-123 | 10.6 | -197.1/16.2 | 130/31 | 9.6mm t92 f0  flank | 2.3mm t137 f9 r1.109 F | oracle-ok | g23.2 cel2.2/21 t138 f9 r1.077 |  | 1436.8L | valider/ecartement-corrige |
| 0611 | 16 | 9169 | pn | juste | B | l | hors-cadre-soutenu | CH-123 | 11.5 | -198.5/15.7 | 136/21 | 144.7mm t0 f0  rsf | 0.6mm t107 f3 r77.616 | oracle-ok | g19.1 cel1.8/19.4 t140 f10 r2.447 |  | 1436.8L | valider/consensus |
| 0611 | 16 | 9173 | adv | differe-corrige | B | l | hors-cadre-soutenu | CH-120 | 15.2 | -203.7/7.2 | 144/12 | 2.3mm t105 f0  flank | 2.9mm t139 f12 r2.636 | oracle-ok |  | d0+dd+proche+va+h0 | 1436.8L | rien/recherche-adv-contredite-rien |
| 0611 | 16 | 9181 | adv | 10-50 | B | r | non-detecte-cellule-10-20 | CH-123 | 20.3 | -145.1/4.2 | 118/26 | 19.7mm t113 f19 S candidate | 3.8mm t136 f28 r5.281 | oracle-ok |  | d0 | 1436.8L | valider/recherche-adv |
| 0611 | 16 | 9268 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 118.1 | -162.9/2.7 | 149/45 | 83.5mm t0 f0  rsf | 3.1mm t150 f22 r1.846 | oracle-ok | g30.1 cel3.1/27.7 t153 f21 r1.095 | d0+proche+va+h0 | 1435.9L | rien/sans-approche |
| 0611 | 16 | 9269 | adv | differe-corrige | C | l | hors-fenetre-soutenu | CH-120 | 158.9 | -160.1/-1.8 | 131/57 | 80.1mm t0 f0  rsf | 5.7mm t153 f19 r1.735 | oracle-ok |  | d0 | 1435.9L | rien/veto-voie-absolue |
| 0611 | 16 | 9269 | adv | differe-corrige | C | r | hors-fenetre-soutenu | CH-120 | 114.9 | -112.7/-22.4 | 144/31 | 36.7mm t69 f0  flank | 0.4mm t153 f23 r1 F | oracle-ok |  | d0 | 1435.9L | rien/veto-voie-absolue |
| 0611 | 16 | 9270 | adv | mauvaise-voie | C | l | hors-fenetre-soutenu | CH-120 | 156.4 | -156/-10.8 | 151/23 | 76.4mm t0 f0  rsf | 1.5mm t155 f18 r1 F | oracle-ok |  | d0 | 1435.9L | rien/veto-voie-absolue |
| 0611 | 16 | 9270 | adv | mauvaise-voie | C | r | hors-fenetre-soutenu | CH-120 | 111.5 | -110.2/-17 | 138/35 | 33.1mm t90 f0  flank | 0.4mm t146 f19 r1.486 F | oracle-ok |  | d0 | 1435.9L | rien/veto-voie-absolue |
| 0611 | 16 | 9271 | adv | mauvaise-voie | B | l | hors-fenetre-soutenu | CH-120 | 147.9 | -147.8/-6.1 | 155/34 | 49.5mm t0 f0  rsf | 0.3mm t156 f17 r2.404 | oracle-ok | g16.9 cel0.2/17 t156 f17 r3.151 | d0=dd+proche+va+h0 | 1435.5L | valider/null |
| 0611 | 16 | 9272 | adv | mauvaise-voie | B | l | hors-fenetre-soutenu | CH-120 | 38.6 | -139.6/-4.1 | 150/29 | 30.2mm t65 f0  flank | 2.4mm t157 f30 r3.079 | oracle-ok | g23.4 cel2.4/24.2 t157 f28 r1 | d0 | 1435.5L | valider/sous-tau-coherent |
| 0611 | 16 | 9273 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 18.7 | -126.6/0.7 | 156/13 | 18.7mm t149 f13 S candidate | 5.6mm t155 f5 r76.346 | oracle-ok | g16.7 cel4.5/21.1 t148 f4 r76.748 | d0=dd+proche+va+h0 | 1435.5L | rien/recherche-adv-contredite-rien |
| 0811a | 3 | 4831 | adv | 10-50 | B | l | cellule-ecartee-slope | CH-123 | 10.2 | -37/-23.2 | 92/74 | 1.3mm t91 f69  slope | 4.1mm t92 f65 r4.896 | oracle-ok | g23.9 cel2.3/22.2 t90 f68 r5.272 | d0+dd+h0 | 1433.2L | valider/null |
| 0811a | 4 | 1115 | abords | differe-corrige | B | r | moteur-sans-repere | CH-123 | 54.5 | 54.5/0.8 | 0/0 |  | rien | vide |  | h0 | 1437.2L | rien/depart-le-plus-probable |
| 0811a | 4 | 1116 | abords | differe-corrige | B | r | sans-soutien | CH-123 | 56 | 56/-3 | 1/0 | 2.9mm t1 f0  rsf | 87.5mm t4 f0 r3.486 | oracle-loin | g7.7 cel85.9/78.4 t4 f0 r3.243 | h0 | 1437L | rien/depart-le-plus-probable |
| 0811b | 6 | 174 | abords | differe-corrige | C | l | hors-cadre-soutenu | CH-123 | 86.9 | -221.5/2.8 | 236/86 | 19.8mm t119 f0  flank | 4.7mm t231 f72 r3.615 | oracle-ok |  | h0 | 1435.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 174 | abords | differe-corrige | C | r | hors-fenetre-soutenu | CH-123 | 142.4 | -172/-24.7 | 29/21 | 55.3mm t12 f0  minTop | 3.9mm t27 f16 r1.76 | oracle-ok |  | h0 | 1435.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 176 | abords | differe-corrige | C | l | hors-cadre-soutenu | CH-123 | 58.6 | -185.9/3.8 | 228/46 | 41.7mm t46 f0  flank | 4.3mm t232 f40 r1 F | oracle-ok |  | d0+h0 | 1435.7L | rien/sans-approche |
| 0811b | 6 | 176 | abords | differe-corrige | C | r | hors-cadre-soutenu | CH-123 | 166.6 | -228.9/-14.3 | 230/29 | 149.9mm t69 f0  flank | 1.9mm t226 f25 r4.439 | oracle-ok |  | d0+h0 | 1435.7L | rien/sans-approche |
| 0811b | 6 | 177 | abords | differe-corrige | C | l | hors-cadre-soutenu | CH-123 | 87.6 | -246.4/11.4 | 232/28 | 60.2mm t111 f0  flank | 1.2mm t233 f6 r1.495 F | oracle-ok |  | h0 | 1435.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 177 | abords | differe-corrige | C | r | hors-cadre-soutenu | CH-123 | 37.4 | -188.9/-18.2 | 228/81 | 15.9mm t0 f0  rsf | 3.9mm t214 f4 r134.634 | oracle-ok |  | h0 | 1435.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 178 | adv | differe-corrige | C | l | hors-cadre-soutenu | CH-120 | 77.7 | -246.7/15.2 | 233/14 | 38.7mm t9 f0  minTop | 3.3mm t237 f5 r13.399 | oracle-ok |  | h0 | 1435.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 178 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 26.8 | -186.6/-13.1 | 229/53 | 8mm t0 f0  rsf | 8.3mm t223 f56 r2.121 | oracle-ok |  | h0 | 1435.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 179 | adv | differe-corrige | B | l | hors-cadre-soutenu | CH-120 | 97.9 | -232.4/17.1 | 231/24 | 47.4mm t39 f0  flank | 2.8mm t74 f5 r94.218 | oracle-ok | g25.2 cel3.2/25.1 t84 f5 r72.556 | d0+h0 | 1435.7L | rien/sans-approche |
| 0811b | 6 | 180 | adv | differe-corrige | B | l | hors-cadre-soutenu | CH-120 | 36.9 | -212.9/15.3 | 227/37 | 8.4mm t150 f0  flank | 2.3mm t234 f19 r1 F | oracle-ok | g20.6 cel2.2/19.8 t235 f19 r4.367 | h0 | 1435.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 203 | adv | differe-corrige | B | r | tronquee | CH-123 | 44.5 | 123.7/14.6 | 225/26 | 9.8mm t217 f13 S candidate | 0.1mm t228 f15 r8.182 | oracle-ok | g15.8 cel0.6/16.2 t229 f13 r7.423 | d0+proche=va+h0 | 1435.7L | rien/sans-approche |
| 0811b | 6 | 219 | adv | differe-corrige | C | l | hors-fenetre-soutenu | CH-120 | 134.2 | 171.1/-18.3 | 203/29 | 25.7mm t72 f0  flank | 3mm t209 f19 r2.573 | oracle-ok |  | proche+va+h0 | 1436.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 219 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 14.9 | 197.3/0.9 | 209/9 | 21.9mm t219 f3 C flank | 2.4mm t216 f6 r2.314 | oracle-ok |  | proche+va+h0 | 1436.7L | rien/depart-le-plus-probable |
| 0811b | 6 | 353 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 41.9 | -121.9/-4.1 | 224/23 | 42mm t72 f16 S candidate | 1.3mm t223 f19 r1 F | oracle-ok | g2.9 cel1.2/3.8 t224 f19 r1.058 ✓ | h0 | 1436.3L | rien/depart-le-plus-probable |
| 0811b | 6 | 354 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 39.5 | -119.5/1.5 | 224/33 | 39.5mm t87 f10 S candidate | 0.4mm t219 f20 r3.389 | oracle-ok | g5.1 cel0.6/5.2 t220 f25 r2.39 ✓ | h0 | 1436.4L | rien/depart-le-plus-probable |
| 0811b | 6 | 355 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 39.2 | -119.2/4.4 | 223/46 | 39.2mm t91 f8 S candidate | 1.2mm t222 f22 r2.655 | oracle-ok | g8 cel1.2/7.6 t223 f22 r1.828 ✓ | h0 | 1436.3L | rien/depart-le-plus-probable |
| 0811b | 6 | 356 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 70.9 | -120.6/6.3 | 223/41 | 40.7mm t90 f3  flank | 0.5mm t218 f21 r1 F | oracle-ok | g8.9 cel0.4/8.6 t218 f21 r1 ✓ | d0+h0 | 1436.3L | rien/sans-approche |
| 0811b | 6 | 357 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 33.4 | -120.3/8.3 | 224/46 | 28mm t156 f0  flank | 0.8mm t225 f27 r3.154 | oracle-ok | g9.7 cel0.5/9.6 t225 f24 r2.244 ✓ | d0+h0 | 1436.3L | rien/sans-approche |
| 0811b | 6 | 363 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 24.3 | -117.2/-6.3 | 215/88 | 22.2mm t194 f3  flank | 2.2mm t214 f77 r1 F | oracle-ok | g1.9 cel2/3.9 t215 f73 r1.009 ✓ | d0+proche+va+h0 | 1436.1L | rien/veto-voie-absolue |
| 1111 | 15 | 5075 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 138.2 | -128.7/-50.5 | 71/9 | 24.7mm t3 f0  minTop | 2.3mm t75 f4 r1.054 | oracle-ok | g51 cel23.3/42.4 t4 f0 r2.501 | h0 | 1442L | rien/depart-le-plus-probable |
| 1111 | 15 | 5105 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 74.2 | -117.9/-66.7 | 75/7 | 58.1mm t5 f27  minTop | 1.7mm t76 f5 r2.149 | oracle-ok | g67.1 cel90/88.1 t7 f0 r2.016 | h0 | 1441.1L | rien/depart-le-plus-probable |
| 1111 | 15 | 5109 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 120.7 | -111.8/-45.4 | 73/7 | 41.2mm t4 f0  minTop | 3.4mm t74 f5 r1 | oracle-ok | g45.9 cel5.3/46.5 t52 f4 r16.534 | h0 | 1441.2L | rien/depart-le-plus-probable |
| 1111 | 15 | 5111 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 124.9 | -126.1/-59.7 | 19/5 | 50.1mm t0 f0  rsf | 4.1mm t21 f4 r1.106 | oracle-ok | g64.4 cel88.4/71.4 t6 f0 r26.056 | h0 | 1441.2L | rien/depart-le-plus-probable |
| 1111 | 15 | 5243 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 165.7 | -156.1/-55.7 | 81/9 | 42.8mm t0 f0  rsf | 2.3mm t79 f4 r26.612 | oracle-ok | g59.7 cel97.2/73.5 t3 f0 r20.042 | h0 | 1442.9L | rien/depart-le-plus-probable |
| 1111 | 15 | 5247 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 151.3 | -160.7/-48.4 | 80/7 | 87.1mm t8 f5  minTop | 4.7mm t84 f5 r3.128 | oracle-ok | g50.6 cel24.3/40.8 t3 f0 r31.957 | h0 | 1442.7L | rien/depart-le-plus-probable |
| 1111 | 16 | 3956 | adv | differe-corrige | B | r | tronquee | CH-123 | 12 | 121/11.9 | 183/11 | 8.5mm t207 f21 S candidate | 2mm t39 f3 r463.23 | oracle-ok | g16 cel2/14.3 t192 f3 r318.937 | d0+proche=va+h0 | 1435.6L | rien/sans-approche |
| 1111 | 16 | 3957 | adv | differe-corrige | B | r | hors-fenetre-sans-soutien | CH-120 | 16.1 | 154/14.6 | 174/0 | 49.5mm t67 f4  flank | 10.3mm t201 f5 r82.308 | oracle-loin | g18 cel4/15.7 t194 f3 r88.378 | d0=dd+proche=va+h0 | 1435.9L | rien/veto-voie-absolue |
| 1111 | 16 | 3960 | adv | mauvaise-voie | C | l | hors-fenetre-soutenu | CH-120 | 129.7 | 137.1/-12.7 | 207/37 | 64.2mm t0 f0  rsf | 2.9mm t210 f34 r3.227 | oracle-ok |  | d0+dd+proche+va+h0 | 1436.1L | valider/ecartement-corrige |
| 1111 | 16 | 3960 | adv | mauvaise-voie | C | r | hors-cadre-soutenu | CH-120 | 170.3 | 184.2/6.4 | 214/44 | 106.6mm t5 f10  minTop | 2.6mm t214 f45 r1.16 F | oracle-ok |  | d0+dd+proche+va+h0 | 1436.1L | valider/ecartement-corrige |
| 1111 | 16 | 3961 | adv | mauvaise-voie | C | l | hors-fenetre-soutenu | CH-120 | 143.7 | 151.3/-8.6 | 207/44 | 104.2mm t0 f0  rsf | 2.3mm t209 f27 r1 F | oracle-ok |  | d0+proche+va+h0 | 1436.1L | rien/veto-voie-absolue |
| 1111 | 16 | 3961 | adv | mauvaise-voie | C | r | hors-cadre-soutenu | CH-120 | 184.8 | 198.7/3.1 | 207/39 | 124.9mm t69 f4  flank | 2.3mm t208 f31 r1 F | oracle-ok |  | d0+proche+va+h0 | 1436.1L | rien/veto-voie-absolue |
| 1111 | 16 | 3964 | adv | differe-corrige | C | l | hors-fenetre-soutenu | CH-120 | 35.5 | 153.2/-5.7 | 203/45 | 21.3mm t139 f0  flank | 1.2mm t205 f29 r1 F | oracle-ok |  | proche+va+h0 | 1436.1L | rien/depart-le-plus-probable |
| 1111 | 16 | 3964 | adv | differe-corrige | C | r | hors-fenetre-soutenu | CH-120 | 73.6 | 124.4/5 | 211/53 | 20.5mm t19 f3  flank | 2mm t211 f40 r36.87 | oracle-ok |  | proche+va+h0 | 1436.1L | rien/depart-le-plus-probable |
| 1111 | 16 | 3965 | adv | differe-corrige | C | l | hors-cadre-soutenu | CH-120 | 107 | 182.9/0.3 | 185/49 | 52.1mm t0 f0  rsf | 2.8mm t84 f5 r72.716 | oracle-ok |  | d0+proche+va+h0 | 1436.1L | rien/sans-approche |
| 1111 | 16 | 3965 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 58 | 231.6/16.8 | 213/53 | 63.9mm t201 f8 S candidate | 1.3mm t182 f37 r39.934 | oracle-ok |  | d0+proche+va+h0 | 1436.1L | rien/sans-approche |
| 1111 | 16 | 3966 | adv | mauvaise-voie | C | l | hors-cadre-soutenu | CH-120 | 112.5 | 189.4/-5.9 | 201/34 | 50.6mm t0 f0  rsf | 1.1mm t204 f15 r4.218 | oracle-ok |  | d0=dd+proche+va+h0 | 1436.1L | valider/sous-tau-coherent |
| 1111 | 16 | 3966 | adv | mauvaise-voie | C | r | hors-cadre-soutenu | CH-120 | 41.8 | 237.2/22.4 | 149/56 | 65.1mm t156 f3  flank | 2.4mm t162 f34 r12.91 | oracle-ok |  | d0=dd+proche+va+h0 | 1436.1L | valider/sous-tau-coherent |
| 1111 | 16 | 3967 | adv | differe-corrige | C | l | hors-cadre-soutenu | CH-120 | 140.1 | 193.4/-7 | 200/30 | 93.1mm t0 f0  rsf | 1.5mm t202 f9 r1 F | oracle-ok |  | d0+proche+va+h0 | 1436.1L | rien/sans-approche |
| 1111 | 16 | 3967 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 100.9 | 238.7/24.7 | 190/75 | 73.6mm t0 f0  rsf | 4.8mm t191 f74 r1 F | oracle-ok |  | d0+proche+va+h0 | 1436.1L | rien/sans-approche |
| 1111 | 16 | 3969 | adv | differe-corrige | B | l | hors-cadre-soutenu | CH-120 | 136.3 | 204/-6 | 204/39 | 62mm t0 f0  rsf | 1.7mm t211 f21 r1 F | oracle-ok |  | d0+proche+va+h0 | 1436.1L | rien/sans-approche |
| 1111 | 16 | 3974 | adv | differe-corrige | B | r | hors-cadre-soutenu | CH-120 | 197 | 196.8/9.5 | 210/24 | 129.6mm t0 f0  rsf | 2.6mm t216 f14 r3.637 | oracle-ok | g24.2 cel2.6/23 t214 f14 r4.591 | proche+va+h0 | 1436.5L | rien/depart-le-plus-probable |
| 1111 | 16 | 3999 | adv | differe-corrige | B | r | hors-fenetre-sans-soutien | CH-120 | 16.7 | -156.7/-16.9 | 1/3 | 14.1mm t2 f0  rsf | 32.2mm t3 f0 r12.616 | oracle-loin |  | d0+proche+va+h0 | 1439.5L | rien/plus-de-150-mm |
| 1111 | 16 | 4000 | adv | differe-corrige | B | r | hors-fenetre-sans-soutien | CH-120 | 14 | -156.2/-12.3 | 0/4 | 53.9mm t0 f0  rsf | 12.2mm t3 f3 r1.196 | vide |  | d0+proche+va+h0 | 1439.5L | rien/sans-approche |
| 1111 | 16 | 4510 | adv | differe-corrige | C | l | hors-fenetre-soutenu | CH-120 | 67.8 | 165.7/-8.6 | 299/36 | 49.8mm t19 f5  flank | 3.4mm t290 f28 r1.027 F | oracle-ok |  | d0=h0+proche=va | 1434.5L | rien/sous-delta |
| 1111 | 16 | 4510 | adv | differe-corrige | C | r | hors-fenetre-soutenu | CH-120 | 43.3 | 141.2/5.4 | 299/73 | 38.9mm t81 f6 S candidate | 2mm t303 f50 r4.105 | oracle-ok |  | d0=h0+proche=va | 1434.5L | rien/sous-delta |
| 1111 | 16 | 4511 | adv | differe-corrige | C | l | hors-fenetre-soutenu | CH-120 | 38.5 | 150.5/-4.7 | 287/52 | 15.9mm t226 f0  flank | 3.3mm t291 f38 r1.226 F | oracle-ok |  | proche=va+h0 | 1434.5L | rien/depart-le-plus-probable |
| 1111 | 16 | 4511 | adv | differe-corrige | C | r | hors-fenetre-soutenu | CH-120 | 68 | 115.9/2.9 | 300/67 | 17.6mm t267 f13 S candidate | 3.9mm t305 f50 r1 F | oracle-ok |  | proche=va+h0 | 1434.5L | rien/depart-le-plus-probable |
| 1111 | 16 | 4512 | adv | differe-corrige | C | l | hors-fenetre-soutenu | CH-120 | 40.5 | 171.9/1.1 | 285/38 | 32.5mm t45 f0  flank | 2.7mm t291 f27 r1 F | oracle-ok |  | d0+proche=va+h0 | 1434.5L | rien/sans-approche |
| 1111 | 16 | 4512 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 60.8 | 216.7/27.4 | 298/119 | 64.5mm t287 f12 S candidate | 3mm t288 f78 r3.278 | oracle-ok |  | d0+proche=va+h0 | 1434.5L | rien/sans-approche |
| 1111 | 16 | 4514 | adv | differe-corrige | C | l | hors-cadre-soutenu | CH-120 | 139.8 | 180.3/2.7 | 292/29 | 96.1mm t0 f0  rsf | 2.2mm t287 f18 r1 F | oracle-ok |  | d0=dd+proche=va+h0 | 1434.4L | rien/recherche-adv-contredite-rien |
| 1111 | 16 | 4514 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 148 | 223.7/19.1 | 302/142 | 49.6mm t82 f0  flank | 2.6mm t304 f78 r6.461 | oracle-ok |  | d0=dd+proche=va+h0 | 1434.4L | rien/recherche-adv-contredite-rien |
| 1111 | 16 | 4515 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 118 | 172.1/-0.7 | 286/38 | 117.3mm t0 f0  rsf | 1.2mm t279 f26 r3.156 | oracle-ok |  | d0+h0 | 1434.4L | rien/sans-approche |
| 1111 | 16 | 4571 | adv | mauvaise-voie | B | l | hors-cadre-soutenu | CH-120 | 31.3 | -224.2/4.8 | 269/138 | 42.2mm t63 f0  flank | 1.4mm t269 f71 r10.984 | oracle-ok |  | d0=dd+proche+va+h0 | 1436.7L | rien/veto-voie-absolue |
| 1111 | 16 | 4574 | adv | differe-corrige | B | l | hors-cadre-soutenu | CH-120 | 155.2 | -256.1/18.7 | 259/32 | 73.9mm t155 f0  flank | 3.2mm t261 f10 r1 F | oracle-ok |  | d0+h0 | 1436.1L | rien/sans-approche |
| 1111 | 16 | 4575 | adv | differe-corrige | C | l | hors-cadre-soutenu | CH-120 | 83.6 | -248.5/20 | 263/28 | 58.7mm t155 f0  flank | 2.1mm t269 f5 r7.572 | oracle-ok |  | h0 | 1436.1L | rien/depart-le-plus-probable |
| 1111 | 16 | 4575 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 24.9 | -180/-17.2 | 253/99 | 1.8mm t0 f0  rsf | 1.8mm t257 f56 r3.346 | oracle-ok |  | h0 | 1436.1L | rien/depart-le-plus-probable |
| 1111 | 16 | 4576 | adv | differe-corrige | B | l | hors-cadre-soutenu | CH-120 | 92 | -233.3/23 | 262/26 | 47.8mm t38 f0  flank | 4.1mm t268 f3 r76.913 | oracle-ok | g43.5 cel5.3/40.9 t274 f3 r40.709 | d0+h0 | 1436.1L | rien/sans-approche |
| 1111 | 16 | 4577 | adv | differe-corrige | B | l | hors-cadre-soutenu | CH-120 | 77.5 | -213.4/23.7 | 258/54 | 12.5mm t194 f0  flank | 1.3mm t265 f38 r1.065 F | oracle-ok | g36 cel1.1/34.9 t268 f34 r2.013 | h0 | 1436.1L | rien/depart-le-plus-probable |
| 1111 | 16 | 4899 | abords | differe-corrige | B | l | hors-fenetre-sans-soutien | CH-123 | 147.1 | 140.5/-43.4 | 2/0 | 81.4mm t0 f0  rsf | rien | oracle-loin |  | h0 | 1443.3L | rien/depart-le-plus-probable |
| 1111 | 16 | 4900 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 135.3 | 129.1/-40.3 | 143/19 | 13.3mm t130 f0  flank | 2.2mm t147 f5 r54.312 | oracle-ok | g35.8 cel2.4/37.2 t142 f7 r1 | h0 | 1443.3L | rien/depart-le-plus-probable |
| 1111 | 16 | 5847 | abords | differe-corrige | B | r | sans-soutien | CH-123 | 37.8 | -42.9/-16.4 | 97/1 | 5.8mm t95 f0  flank | 1.1mm t93 f0 r1.386 | oracle-ok | g16.1 cel1.6/14.6 t95 f0 r1.168 | d0+proche=va+h0 | 1442.8L | rien/sans-approche |
| 1111 | 16 | 5851 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 24.8 | -104.7/6.1 | 91/24 | 25.2mm t52 f0  flank | 0.7mm t93 f12 r1 F | oracle-ok | g15.3 cel0.6/14.8 t93 f12 r2.045 | h0 | 1441.8L | rien/depart-le-plus-probable |
| 1111 | 16 | 5852 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 81 | -100.3/14.9 | 86/25 | 20.9mm t52 f0  flank | 0.9mm t90 f10 r1 F | oracle-ok | g16.2 cel0.9/15.3 t89 f10 r1.579 | h0 | 1441.6L | rien/depart-le-plus-probable |
| 1111 | 16 | 5853 | abords | differe-corrige | B | l | hors-fenetre-soutenu | CH-123 | 39.1 | -97.5/19.8 | 92/24 | 17.8mm t86 f0  flank | 1mm t91 f13 r1.338 F | oracle-ok | g16.8 cel1/15.9 t90 f13 r1.918 | h0 | 1441.4L | rien/depart-le-plus-probable |
| 1111 | 16 | 5894 | abords | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 135.1 | -128.6/-41.3 | 95/16 | 19.1mm t74 f0  flank | 2mm t90 f12 r1.805 | oracle-ok | g43.3 cel0.8/43.8 t92 f10 r18.484 | h0 | 1441.5L | rien/depart-le-plus-probable |
| 1111 | 16 | 5895 | adv | differe-corrige | B | r | hors-fenetre-soutenu | CH-120 | 128.2 | -122.2/-39 | 92/23 | 15.5mm t80 f0  flank | 3mm t92 f12 r1 F | oracle-ok | g40.3 cel3/43.4 t92 f12 r1 | h0 | 1441.7L | rien/depart-le-plus-probable |
| 1111 | 17 | 1675 | adv | 10-50 | B | r | sans-soutien | CH-123 | 11.3 | 52.5/-6.4 | 32/0 | 9.2mm t16 f9 S candidate | 8.9mm t17 f13 r88.1 | oracle-ok | g11 cel8.9/8.6 t23 f18 r68.416 ✓ | d0=dd+proche=va+h0 | 1439.4L | valider/null |
| 1211 | 2 | 7808 | adv | differe-corrige | B | l | cellule-ecartee-flank | CH-123 | 12.5 | 9/8.7 | 52/7 | 2.5mm t44 f0  flank | 2.3mm t71 f0 r19.89 | oracle-ok | g6.4 cel3.1/4.3 t40 f0 r8.224 ✓ | d0+h0 | 1440.7L | rien/sans-approche |
| 1211 | 23 | 3681 | adv | differe-corrige | B | l | cellule-ecartee-minTop | CH-123 | 11.1 | 28.5/-12.2 | 7/25 | 3.8mm t8 f21  minTop | 4mm t10 f23 r8.941 | oracle-ok | g3.6 cel2.9/3.7 t10 f23 r23.358 ✓ | d0+dd+proche+va+h0 | 1437.9L | rien/recherche-adv-contredite-rien |
| 1211 | 23 | 3692 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 135.2 | 128/-43.8 | 126/25 | 22.7mm t68 f0  flank | 3.9mm t138 f18 r1.486 F | oracle-ok | g40.9 cel3.6/44.2 t138 f18 r1 | h0 | 1438.6L | rien/depart-le-plus-probable |
| 1211 | 23 | 3693 | adv | differe-corrige | B | l | non-detecte-cellule-10-20 | CH-123 | 101.9 | 128.4/-45.8 | 129/18 | 12mm t91 f0  flank | 0.7mm t131 f17 r1.056 F | oracle-ok | g43.1 cel2.3/43.3 t130 f17 r4.657 | h0 | 1439.1L | rien/depart-le-plus-probable |
| 1211 | 23 | 3694 | adv | mauvaise-voie | B | l | non-detecte-cellule-10-20 | CH-123 | 136.6 | 129.5/-43.6 | 126/25 | 10.4mm t105 f10 S candidate | 3mm t132 f18 r1.893 | oracle-ok | g40.8 cel2/42.9 t124 f17 r10.045 | d0=dd+h0 | 1439.1L | valider/sous-tau-coherent |
| 1211 | 23 | 3695 | adv | mauvaise-voie | B | l | tronquee | CH-123 | 136.4 | 130.2/-45.6 | 138/16 | 9.6mm t102 f9 S candidate | 0.3mm t132 f14 r1.776 | oracle-ok | g42 cel0.3/41.7 t128 f14 r1.597 | d0+dd+proche=va+h0 | 1439.4L | valider/null |
| 1211 | 23 | 3697 | adv | differe-corrige | B | l | tronquee | CH-123 | 130.8 | 123.5/-43.1 | 125/29 | 3.6mm t104 f13 S candidate | 2.7mm t131 f20 r1 F | oracle-ok | g47.5 cel2.5/49.9 t128 f17 r2.26 | proche+va+h0 | 1440L | rien/depart-le-plus-probable |
| 1211 | 23 | 3698 | adv | differe-corrige | B | l | tronquee | CH-123 | 127.7 | 120.5/-42.4 | 128/20 | 4mm t128 f18 S candidate | 0.6mm t137 f19 r1.143 F | oracle-ok | g41.5 cel0.5/41.9 t130 f19 r2.845 | proche+va+h0 | 1440L | rien/depart-le-plus-probable |
| 1211 | 23 | 3700 | adv | differe-corrige | B | l | tronquee | CH-123 | 134.6 | 128.7/-39.3 | 127/24 | 8.4mm t133 f10 S candidate | 2.4mm t132 f17 r1 F | oracle-ok | g40.9 cel2.4/43.2 t131 f18 r5.062 | proche+va+h0 | 1443.5L | rien/depart-le-plus-probable |
| 1211 | 23 | 3701 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 137.7 | 131/-42.4 | 130/23 | 18.2mm t99 f0  flank | 2mm t134 f18 r2.121 | oracle-ok | g44.5 cel1.8/46.2 t128 f18 r4.132 | proche=va+h0 | 1443.8L | rien/depart-le-plus-probable |
| 1211 | 23 | 3736 | abords | differe-corrige | B | r | hors-fenetre-soutenu | CH-123 | 140.3 | 140.3/-1.2 | 144/50 | 65.8mm t0 f0  rsf | 0.6mm t156 f24 r1.914 | oracle-ok | g10.6 cel0.6/10.6 t154 f24 r3.071 | h0 | 1443.5L | rien/depart-le-plus-probable |
| 1211 | 23 | 3737 | adv | differe-corrige | B | r | hors-fenetre-soutenu | CH-120 | 133.7 | 145.4/-2.5 | 149/31 | 66.7mm t0 f0  rsf | 1.7mm t147 f25 r1.96 | oracle-ok | g10.9 cel1.5/11 t151 f18 r3.148 | d0+h0 | 1443.7L | rien/sans-approche |
| 1211 | 23 | 3742 | adv | differe-corrige | B | r | hors-fenetre-soutenu | CH-120 | 80.7 | 136.4/-4.4 | 147/38 | 42.8mm t54 f45 S candidate | 2.7mm t149 f20 r1.103 F | oracle-ok | g1.1 cel1.5/1.1 t151 f23 r2.776 ✓ | d0+h0 | 1445.4L | rien/sans-approche |
| 1211 | 23 | 3750 | adv | mauvaise-voie | B | r | hors-fenetre-soutenu | CH-120 | 43.8 | 127.1/-0.1 | 140/52 | 47.4mm t103 f0  flank | 1.5mm t144 f48 r1.071 F | oracle-ok | g3.4 cel1/4 t147 f50 r1.314 ✓ | d0=va+dd+proche+h0 | 1442.8L | valider/null |
| 1211 | 23 | 4667 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 38.2 | -120.1/-9.8 | 204/60 | 40.1mm t70 f26 S candidate | 1.7mm t206 f29 r1 F | oracle-ok | g9.8 cel1.6/10.1 t204 f29 r2.267 | d0+h0 | 1443.1L | rien/sans-approche |
| 1211 | 23 | 4668 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 36.9 | -118.2/-11.9 | 208/49 | 38.5mm t86 f21 S candidate | 2.4mm t212 f35 r1 F | oracle-ok | g14.1 cel2.4/12.7 t212 f35 r1.306 | d0+h0 | 1443.6L | rien/sans-approche |
| 1211 | 23 | 4669 | adv | differe-corrige | B | l | hors-fenetre-soutenu | CH-120 | 36.3 | -117/-7.9 | 197/76 | 29.2mm t64 f7 S candidate | 0.9mm t203 f40 r1 F | oracle-ok | g3.9 cel1.9/5.6 t204 f39 r1 ✓ | d0+h0 | 1443.6L | rien/sans-approche |
| 1211 | 23 | 4672 | adv | mauvaise-voie | B | l | hors-fenetre-soutenu | CH-120 | 53.9 | -112.7/-6.1 | 191/85 | 19.6mm t137 f0  flank | 4.3mm t203 f54 r1 F | oracle-ok | g4.5 cel3.7/8.3 t198 f58 r3.62 ✓ | d0=dd+h0 | 1444.9L | valider/sous-tau-coherent |
| 1211 | 23 | 4673 | adv | mauvaise-voie | B | l | hors-fenetre-soutenu | CH-120 | 40.7 | -106.7/-6.3 | 151/87 | 32.3mm t59 f5  flank | 5.5mm t121 f3 r366.71 | oracle-ok | g8.7 cel5.9/8.9 t115 f3 r257.722 ✓ | d0 | 1445.9L | valider/recherche-adv-remplace |
| 1211 | 23 | 5130 | adv | differe-corrige | B | l | non-detecte-cellule-10-20 | CH-123 | 50.7 | 125.9/-34.6 | 183/53 | 10.1mm t201 f22 S candidate | 1.6mm t197 f33 r1.539 | oracle-ok | g30.4 cel1.6/31.6 t200 f34 r1.869 | h0 | 1437.1L | rien/depart-le-plus-probable |
| 1211 | 23 | 5133 | adv | mauvaise-voie | B | l | hors-fenetre-soutenu | CH-120 | 127.7 | 124.1/-29.9 | 169/41 | 12.1mm t186 f0  flank | 3.9mm t191 f18 r1.946 | oracle-ok | g31.7 cel3.3/33 t191 f18 r1.628 | d0 | 1437.4L | valider/recherche-adv-remplace |
| 1211 | 23 | 5193 | adv | 10-50 | B | l | hors-cadre-soutenu | CH-120 | 16.7 | -226/2.9 | 203/11 | 22.2mm t151 f0  flank | 0.9mm t196 f5 r16.429 | oracle-ok |  | d0+proche+va | 1436L | valider/recherche-adv |
| 1211 | 23 | 5196 | adv | differe-corrige | C | l | hors-cadre-soutenu | CH-120 | 87.4 | -244.2/-0.3 | 188/80 | 34.3mm t13 f0  minTop | 2.7mm t185 f52 r6.816 | oracle-ok |  | d0+dd+proche+va+h0 | 1436L | rien/veto-voie-absolue |
| 1211 | 23 | 5196 | adv | differe-corrige | C | r | hors-cadre-soutenu | CH-120 | 85.9 | -189.6/-26.9 | 197/9 | 108.9mm t0 f0  rsf | 3mm t193 f4 r9.088 | oracle-ok |  | d0+dd+proche+va+h0 | 1436L | rien/veto-voie-absolue |
| 1211 | 23 | 5204 | adv | mauvaise-voie | C | l | hors-fenetre-soutenu | CH-120 | 179.1 | -179.1/-2.2 | 199/37 | 106mm t0 f0  rsf | 1mm t205 f32 r1 F | oracle-ok |  | d0+dd+h0 | 1436L | valider/ecartement-corrige |
| 1211 | 23 | 5204 | adv | mauvaise-voie | C | r | hors-fenetre-soutenu | CH-120 | 131.9 | -129/-27.1 | 199/31 | 51.7mm t4 f0  minTop | 1.1mm t199 f28 r1.402 F | oracle-ok |  | d0+dd+h0 | 1436L | valider/ecartement-corrige |
| 1211 | 23 | 5207 | adv | differe-corrige | C | l | hors-fenetre-soutenu | CH-120 | 33 | -120.5/6.6 | 205/43 | 30.4mm t68 f0  flank | 1.2mm t215 f31 r1 F | oracle-ok |  | proche=va+h0 | 1436L | rien/depart-le-plus-probable |
| 1211 | 23 | 5207 | adv | differe-corrige | C | r | hors-fenetre-soutenu | CH-120 | 137 | -167.1/-4.3 | 207/30 | 53.5mm t14 f8  minTop | 2.6mm t207 f22 r1 F | oracle-ok |  | proche=va+h0 | 1436L | rien/depart-le-plus-probable |
| 1211 | 23 | 5208 | adv | differe-corrige | B | r | hors-fenetre-soutenu | CH-120 | 39.4 | -156/-5.4 | 206/19 | 27.7mm t114 f0  flank | 1.5mm t210 f18 r1.726 | oracle-ok | g24.4 cel1.6/25.5 t207 f18 r1 | proche=va+h0 | 1436L | rien/depart-le-plus-probable |
| 1211 | 23 | 5282 | pn | juste | B | l | hors-fenetre-soutenu | CH-123 | 18.8 | -113.4/21.6 | 260/59 | 25.1mm t191 f3  flank | 1.1mm t264 f43 r2.792 | oracle-ok | g21.8 cel1.6/20.4 t263 f44 r1.4 |  | 1433.4L | rien/veto-voie |
