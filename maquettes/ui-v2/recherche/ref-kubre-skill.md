# Référence : skill « design-refinement » (dépôt kubre/skills) — famille « info- » (signalétique et design d'information)

## Ce que j'ai ouvert exactement (ÉTABLI = lu en entier)
Clone anonyme `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1` dans /home/user/kubre/skills. Lus en entier :
- `README.md` (trois skills : design-refinement, review-pr, council ; note : la skill renvoie à une skill `dataviz` non fournie, et le script de capture demande Playwright et un état de connexion) — ÉTABLI.
- `design-refinement/SKILL.md` (règles, boucle en 7 temps, livraison) — ÉTABLI.
- `design-refinement/references/craft.md` (grille : type, forme, icônes, couleur, graphes, tableaux, états, petits écrans, copie) — ÉTABLI.
- `design-refinement/references/capture.md` (capture clair/sombre, un préfixe par tour, regarder chaque capture avant tout auditeur, pièges) — ÉTABLI.
- `design-refinement/scripts/shot.mjs` (Playwright : capture chaque élément porteur d'un attribut bloc, préfixe-thème-index) — ÉTABLI.
- `council/SKILL.md`, `council/references/brief.md`, `council/references/rubrics.md` — ÉTABLI.
- `review-pr/SKILL.md` — ÉTABLI (hors sujet ici : revue de pull request).
- La skill `dataviz` à laquelle elle renvoie : je l'ai chargée depuis les skills locales (procédure en 7 temps, choosing-a-form, marks-and-anatomy, anti-patterns) — ÉTABLI.

## Ce que j'en retiens, et comment je l'applique à la lettre
1. **Notes de départ** (but, ligne d'arrivée, surfaces, journal des scores) : chaque fiche maquette ouvre sur le but et la ligne d'arrivée « vérificateur 0 écart / 0 erreur, et aucune des 9 rubriques de craft.md en défaut sur les captures clair et sombre ». Le journal des tours est dans la fiche.
2. **Surfaces** : les 20 scènes du vérificateur couvrent écran principal, états vides/erreurs (ESV absent, onglet, reprise, alertes de file), vues secondaires (ce qui reste, examen), et trois largeurs (360/420/600). C'est exactement la liste « main screen, drawers, empty and error states, phone widths » de la skill.
3. **Capture** : clair et sombre, un préfixe par tour (`r0-`, `r1-`, `r2-`…) dans mon dossier de captures ; je recopie le principe de shot.mjs (une capture par surface, nommée préfixe-thème-surface) via le vérificateur commun.
4. **Autocritique écrite avant correction** : pour chaque tour, j'écris les pires problèmes dans la fiche maquette avant de toucher au code.
5. **Corriger 5 à 10 problèmes par tour, les pires d'abord**, recapturer, vérifier l'autre thème et les largeurs (régressions).
6. **Graphes** : je lis dataviz avant tout graphe (fait) — une seule série = pas de légende, trait de 2 px, grille discrète, première et dernière étiquette gardées, chiffres en encre de texte jamais en couleur de série, couleurs d'état réservées et toujours avec un mot ou une forme.
7. **Règle « garder la marque »** : il n'y a pas de marque imposée (propositions neuves). Je l'interprète comme : une fois le système de signes d'une maquette posé, les tours de raffinement l'ajustent sans le réinventer.

## Ce que je ne peux pas appliquer tel quel (et ce que je fais à la place)
- **council** exige deux auditeurs indépendants (deux autres modèles via des outils d'orchestration que ma session n'a pas). Je n'ai ni outil de délégation ni droit de nommer ces modèles. À la place : un « tour d'auditeur » où je relis les captures avec la grille rubrics.md (design : hiérarchie, espacement, rayons et icônes, sobriété, couleur et contraste, graphes, états vides et erreurs, largeurs, copie), en notant chaque point « confirmé / partiel / faux / artefact » comme le demande council, et je le dis dans la fiche. C'est une substitution, pas l'application de council : SUPPOSÉ qu'elle approche son effet, pas mesuré.
- Le navigateur « T3 » de capture.md n'existe pas ici : j'utilise Chromium via Playwright (verifier.cjs et un script de captures à moi).

## Ce que j'écarte
- La livraison en pull request (« Ship ») : le contrat interdit commit, push et pull request ; l'intégrateur s'en charge.
- review-pr : hors sujet.

## Erreurs d'accès
Aucune : le clone anonyme a réussi.
