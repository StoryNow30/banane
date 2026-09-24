# Pistes d'interface retenues : A, E, H

**24 septembre 2026.** La direction a retenu trois pistes parmi celles du canevas
de design. Chaque piste est déclinée sur les trois modes de Banane : Natif,
Pilote et Assisté. Cela donne 9 écrans, exportés en PNG au format de la
fenêtre (420 × 880, rendu ×2).

| Piste | Natif | Pilote | Assisté |
|---|---|---|---|
| **A · TCO**, poste de commande | `A-Natif.png` | `A-Pilote.png` | `A-Assiste.png` |
| **E · Tableau des départs**, affichage matriciel | `E-Natif.png` | `E-Pilote.png` | `E-Assiste.png` |
| **H · Sans le skill**, noir et traits fins | `H-Natif.png` | `H-Pilote.png` | `H-Assiste.png` |

Les exports sont en thème sombre. Sur le canevas, chaque écran est interactif :

- bascule **sombre / clair** ;
- bouton **bandeau** (activer ou désactiver le bandeau dans ESV) ;
- onglets reliés entre eux : Natif, Pilote et Assisté s'enchaînent en lecture.

## Ce que montre chaque mode

Les données sont fictives, mais les mêmes pour les trois pistes, pour que la
comparaison porte sur le design seul.

- **Natif** : collecte en cours, 187 visites de cuts. Santé de la collecte
  (captures, volume, file d'envoi, qualité). Temps passé par cut sur les
  40 derniers, avec la médiane et le p90. Derniers cuts visités.
- **Pilote** : lot en cours sur la partie 34, cut 8455, 19 % de la plage.
  Posés, différés et couverture. La ligne cut par cut : moteur, voie,
  différé. L'écart à la voie, avec la garde de 30 mm et le cut 8431, dont
  le premier passage a été retiré à 36 mm puis repris par la voie.
  Dernière commande et journal.
- **Assisté** : proposition sur le cut affiché. Déplacement proposé pour
  chaque rail (latéral, vertical), indice LiDAR, écartement de la
  proposition.

**Écartement (contrat 4.8, §3.6 et §7).** La barre montre seulement la plage
admissible [1405, 1470] mm et la valeur de la proposition. Elle n'a ni repère
central ni cible.

## Animations

Les animations sont légères et jouent une seule fois, à l'ouverture :

- entrée des blocs en cascade, 70 ms d'écart entre deux blocs ;
- remplissage de la barre de progression ;
- barres des graphiques qui montent ;
- courbe de l'écart à la voie tracée de gauche à droite ;
- flèches de déplacement tracées ;
- point d'écartement qui apparaît ;
- sur E, chiffres qui basculent comme un tableau à palettes ;
- sur H, compteur de visites qui défile.

Deux animations tournent en continu : le point « en direct » pulse, et le cut
courant clignote doucement sur la ligne.

Le changement de thème est instantané, sans fondu. Avec « réduire les
animations » activé dans le système, tout est figé.

## Régénérer

```
python3 generer.py        # écrit dans $SORTIE (défaut : dossier temporaire)
```

La commande produit les planches `.dc.html` du canevas et les pages statiques
servant aux exports. Les PNG sont faits avec Chromium (Playwright), en chargeant
les polices en local.
