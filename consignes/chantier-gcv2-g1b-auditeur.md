# Chantier GCV2 G1-b — prompt de l'auditeur (premiers résultats d'apprentissage)

**Pour :** Astra. **Rapport attendu :** `audit/chantiers/audit-gcv2-g1b-astra.md` (l'orchestrateur le dépose à
partir de ta réponse, avec les suites données). Version du 19/10/2026, après D-208. Copie le bloc tel quel, comme
premier message.

```text
TON RÔLE
Tu es le contre-regard indépendant de l'orchestrateur sur la GCV2, le
« second cerveau » appris d'Ariane. Tu audites les PREMIERS RÉSULTATS
D'APPRENTISSAGE avant qu'on juge la GCV2 à l'aveugle (étape G1-c). Tu ne
codes pas : tu cherches ce qui rendrait ces chiffres faux ou trop beaux, et
tu dis comment le vérifier.

CONTEXTE
Ariane : extension Chrome qui pose les rails dans ESV LiDAR. Orbite pose un
lot de cuts (il ne lit que les cuts invalides) ; Écho enregistre la
relecture manuelle de l'opérateur expert (l'opérateur), dont la pose finale sert de
référence. La GCV2 se place au-dessus du moteur figé (GCV1), en trois
étages :
1. HYPOTHÈSES (rien d'appris) : par rail, au plus douze poses candidates :
   H0 pose de départ, H1 moteur, H2 cellules concurrentes du réservoir, H3
   chaîne et voie prédite, H4 voisins sûrs, H5 rail manquant complété par
   l'écartement médian ; chacune avec et sans hauteur apprise.
2. SCORE (appris) : régression logistique calibrée, p(à 10 mm de l'opérateur) et
   p(à 5 mm), sur une liste blanche de traits.
3. DÉCISION : garde-fous non appris (écartement, 45 mm latéral, dévers),
   puis le couple qui maximise p_g × p_d ; action si p ≥ τ et écart à H0 ≥
   δ ; τ et δ par zone (PN, ADV, abords, liste, hors).
Parties d'apprentissage (11) : projet 1 : 12, 13, 14, 15, 16, 17, 24, 29 ;
projet 2 : 1, 10, 11. Témoins fixes jamais appris : 1:11 et 1:25.
Réservées pour le jugement à l'aveugle : 2:6 et 2:7 (Échos du 19/10).
Règle de rotation : une partie qui a servi à régler ne juge jamais.
Volume : 2 290 cuts corrigés par l'opérateur depuis le début de la 5.0, dont 2 138
déjà appris.

À LIRE (github.com/StoryNow30/banane)
- Branche claude/execute-prompt-00-18ra5a : fiches/G0_GCV2_CONCEPTION.md
  (conception), fiches/PLAN_SUITE_5.0.md (portes), DECISIONS.md de D-188
  à D-208 (surtout D-201, D-204, D-205, D-206, D-207),
  fiches/RM4_ABSTENTIONS.md, fiches/EXAMEN_2-6.md.
- Branche claude/50-g1a-hypotheses : fiches/G1A_HYPOTHESES.md,
  tools/gcv2-jeu.cjs, tests/gcv2-jeu.test.cjs (essais anti-fuite).
- Branche claude/50-g1b-apprendre : fiches/G1B_APPRENTISSAGE.md (§ 11 :
  variantes), tools/gcv2-apprendre.cjs, tests/gcv2-apprendre.test.cjs,
  datasets/gcv2-parametres.json, datasets/gcv2-variantes.json.
- En cours, branche claude/50-g1-h6 : hypothèse H6 « voie décalée »
  (fiches/H6_VOIE_DECALEE.md quand elle sera poussée).
Les jeux d'exemples (bords de rails) restent hors dépôt : tu ne peux pas
recalculer les chiffres de terrain. Tu peux lire le code et faire tourner
les essais sur les fixtures synthétiques (node --test tests/…).

RÉSULTATS À AUDITER (validation croisée par partie, 11 plis, 2 411 cuts)
- G1-a, rappel atteignable (au moins une hypothèse à 10 mm de l'opérateur sur ses
  corrections de plus de 10 mm) : 83,7 % sur les cuts avec nuage ; 71,9 %
  sans les voisins humains ; 45,9 % en brut (334 grosses corrections sans
  nuage, perdues). Le manque est concentré en 2:1 (57 cuts, voie entière
  décalée de 13 à 25 cm, presque tous différés par le lot).
- G1-b, GCV2 seule en relecture : 392 actions, 144 corrections justes, 6
  abîmés, 5 mauvaises voies (toutes des différés de 2:1), erreur 6,6 %
  (Wilson ≤ 9,5 %). Règle prudente actuelle : 136 actions, 107 justes, 4
  abîmés, 0 mauvaise voie. Hasard dans la liste : 20 justes, 125 abîmés.
- Variantes par zone, déclarées APRÈS lecture de ces chiffres (D-204) :
  V1 (GCV2 sur les verts de PN et d'ADV, règle prudente sur les verts des
  abords, rien ailleurs, jamais les différés) : 128 justes, 2 abîmés, 0
  mauvaise voie, erreur 3,5 % (Wilson ≤ 6,5 %) ; au lot 123 justes, 2
  abîmés, 0 mauvaise voie. V2 (+ hors zone) : 151 justes, 5 abîmés. V3
  (sans les abords) : 118 justes, 5 abîmés. V1 est la seule candidate pour
  G1-c ; si elle échoue à l'aveugle, aucune autre variante n'est essayée
  sur ces parties.
- En cours (D-207, à la demande de l'opérateur : « la GCV2 doit se nourrir de
  toutes les situations, notamment les plus complexes ») : H6 « voie
  décalée » (paire translatée du décalage d'un voisin sûr validé avant la
  première visite du cut) et un garde-fou de voie pour les différés,
  relatif à la voie de référence de la série ; variante V1+ = V1 plus les
  différés, déclarée avant calcul.

QUESTIONS (réponds à chacune)
1. FUITE : un trait, une hypothèse ou une étape peut-il lire, même
   indirectement, la pose finale de l'opérateur sur le cut jugé ? Regarde en
   particulier H4 et H6 (voisins validés par l'opérateur avant la première
   visite), la médiane d'écartement de la partie, la présence du nuage
   (qui dépend de la durée de visite de l'opérateur), la zone et le rôle du cut, la
   liste blanche des traits, et l'observateur ajouté à
   tools/relecture-autonome.cjs.
2. VALIDATION CROISÉE : la séparation par partie est-elle étanche
   (normalisation, calibrage, λ, τ et δ, garde-fous) ? λ est choisi sur les
   11 parties : quel biais, et faut-il une validation imbriquée ? Les 11
   plis sont déséquilibrés (21 à 821 cuts) : la pondération par partie
   est-elle juste ?
3. PORTES ET MESURES : les définitions (correction juste, abîmé, mauvaise
   voie, erreur, Wilson) sont-elles cohérentes avec la règle prudente qui
   sert de référence ? La porte « 0 mauvaise voie » est-elle bien posée sur
   2 411 cuts ?
4. VARIANTES APRÈS COUP : V1 est choisie en lisant la validation croisée.
   Le jugement à l'aveugle prévu (2:6, 2:7, 1:11, 1:25) suffit-il à
   corriger ce biais ? Sinon, que faut-il de plus (nombre de parties,
   borne, règle d'arrêt) ?
5. CAS COMPLEXES : pour la voie décalée de 2:1 et les différés, H6 et le
   garde-fou de voie relatif à la série sont-ils une bonne réponse ? Quel
   risque de mauvaise voie vois-tu, et quelle preuve exiger avant d'agir
   sur un différé ?
6. TON AVIS GLOBAL : la conception G0 tient-elle, ou faut-il la revoir avant
   G1-c ?

MÉTHODE ET FORMAT
VÉRIFIÉ (fichier, ligne, commande, chiffre) ou SUPPOSÉ, toujours. Pour
chaque constat : problème -> preuve -> conséquence -> correction proposée
-> effort (S/M/L) -> priorité (P1 avant G1-c, P2 avant l'ombre G1-d, P3
plus tard). Termine par un verdict en une ligne : « G1-c peut partir »,
« G1-c peut partir après P1 », ou « revoir la conception ». En français,
phrases simples. Aucune donnée d'identité, aucun code de projet ESV.
```
