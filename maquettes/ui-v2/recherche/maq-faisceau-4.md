# Frise de lumière 4a, 4b, 4c : notes de raffinement (méthode kubre « design-refinement »)

Méthode lue à la source le 29/10 : dépôt kubre/skills cloné anonymement (`design-refinement/SKILL.md`, `references/craft.md`, `references/capture.md`, `council/references/rubrics.md`, lus en entier). ÉTABLI.

## 1. Notes (étape 1 de la boucle)
- **But.** Simplifier la piste 4 et la rendre plus haut de gamme, en trois niveaux comparables, sans retirer de fonction.
- **Ligne d'arrivée.** Sur les captures clair et sombre de toutes les surfaces : aucune rubrique de `craft.md` en défaut ; vérificateur à 0 écart, 0 erreur ; contraste ≥ 4,5:1 au pixel ; moins d'éléments par scène que la piste 4.
- **Surfaces (étape 2).** Écran principal (en cours, pause, arrêt, fin), états d'erreur (ESV non connecté, onglet à choisir, alertes de file, reprise), vues secondaires (ce qui reste, examen), réglage (prêt, file), Écho ; largeurs 360, 420, 600.
- **Journal des tours.** r0 (captures « avant », piste simplifiée), r1 (grille craft.md), r2 (gestes heydamir, 4c). Captures `r0-`, `r1-`, `r2-` par niveau, thème et surface, dans le dossier de travail (jamais dans le dépôt).

## 2. Autocritique r0 (étape 4 : écrite avant toute correction)
Grille `craft.md` passée sur les captures r0, clair puis sombre, pires d'abord :
1. *Règles* : « Do not remove a feature to make a screenshot look better » ; « Préparer un autre lot » avait été retiré de Prêt alors qu'il propose les bornes suivantes. **Défaut.**
2. *States* : « their copy does not repeat the button » ; l'alerte « ESV non connecté » disait « … puis chercher à nouveau » au-dessus du bouton « Chercher l'onglet ESV » ; sous le bouton grisé, « ESV doit être relié avant de lancer » répétait l'alerte, et la ligne d'état aussi (« ESV non relié »). **Défaut.**
3. *Colour* : « Keep numbers neutral and show direction with a small coloured mark » ; le compte « ◆ 3 » était tout en vert d'eau. **Défaut.**
4. *Copy* : « the same noun for the same thing » ; « vert à examiner » dans la liste et l'examen, « à examiner » sur la frise. **Défaut.**
5. *Shape* : « one radius scale » ; sept rayons (24, 20, 16, 14, 12, 10, 8) et une pastille. **Défaut.**
6. *Charts* : les marques ○ ◆ flottaient sur leurs étages sans lien visible avec leur place sur la règle. **Partiel.**
7. *Copy* : « Detail goes in a drawer or tooltip, not on the card face » ; en pause, « continuer reprend ce même lot » redisait le bouton « Continuer ce lot ». **Défaut.**
8. *Tables* : « Numbers right-aligned and tabular where they are compared » ; colonne des numéros de cut de « ce qui reste » alignée à gauche. **Défaut.**
9. *States* : « no fake data in empty states … one sentence » ; « ce qui reste » vidé n'affichait rien. **Défaut.**
10. *Type, small screens, dark mode* : tailles et graisses déjà réduites, 360 px sans débordement, contraste sombre ≥ 5,68:1. **Confirmé.**

## 3. Corrections r1 (étape 5 : 8 problèmes, pires d'abord) puis r2
- r1 : (1) « Préparer un autre lot » revient dans Prêt, en texte ; (2) textes d'incident raccourcis (« Aucun onglet ESV ne répond dans ce navigateur. »), raison du bouton grisé et mention d'état masquées quand l'incident les dit ; (3) comptes en encre neutre, seule la marque est colorée ; (4) « à examiner » partout ; (5) rayons : 20 pour les panneaux, 12 pour les contrôles (26 pour le cadre d'appareil de 4c, concentrique) ; (6) une tige fine relie chaque marque à la règle ; (7) la pause dit seulement « au cut 252 » ; (8) numéros alignés à droite, tabulaires ; et l'état vide « Rien à reprendre ».
- Recapture r1, clair et sombre, 420 px, et vérificateur sur 360/420/600 : pas de régression.
- r2 (4c seulement, voir `ref-heydamir.md` et la visite du 29/10) : un seul mot en lumière, double cadre, bouton plein à liseré chaud, ombres en couches, texte légèrement ouvert.

## 4. Note (étape 6), et ce qui n'a pas pu être appliqué
`council` demande deux auditeurs indépendants d'autres modèles, lancés par un outil d'orchestration dont la session ne dispose pas : **non appliqué**. À la place, relecture des captures r2 avec la grille `rubrics.md` (substitution, SUPPOSÉ approcher l'effet, non mesuré) :
| Rubrique | Verdict |
|---|---|
| Hiérarchie du texte | confirmé (mot d'état, grand nombre, phrase, comptes) |
| Espacement et alignement | confirmé (grille de 4 px, marges 20/24) |
| Rayons et icônes | confirmé après r1 |
| Habillage discret | confirmé (un bouton plein, le reste en texte) |
| Couleur et contraste | confirmé (≥ 5,68:1 vérificateur, ≥ 5,74:1 au pixel ; arrêts du mot en lumière ≥ 5,12:1) |
| Graphe lisible (frise) | partiel : marques de 24 px, petites mais aux normes ; serrées en fin de lot (quatre étages) |
| États vides et erreurs | confirmé après r1 |
| Largeurs étroites | confirmé (360 px, 0 débordement) |
| Copie | confirmé après r1 |
Ce que les captures ne montrent pas : le mouvement (lent, joué à part), les sélecteurs Police et Avancement, une liste « ce qui reste » longue.
