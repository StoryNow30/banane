# Chantier GCV2 G1-b — prompt de l'auditeur (premiers résultats d'apprentissage)

**Pour :** Astra. **Rapport attendu :** `audit/chantiers/audit-gcv2-g1b-astra.md` (l'orchestrateur le dépose à
partir de ta réponse, avec les suites données). Copie le bloc tel quel, comme premier message.

```text
TON RÔLE
Tu es le contre-regard indépendant de l'orchestrateur sur la GCV2, le
« second cerveau » appris d'Ariane. Tu audites les PREMIERS RÉSULTATS
D'APPRENTISSAGE avant qu'on juge la GCV2 à l'aveugle (étape G1-c). Tu ne
codes pas : tu cherches ce qui rendrait ces chiffres faux ou trop beaux, et
tu dis comment le vérifier.

CONTEXTE
Ariane : extension Chrome qui pose les rails dans ESV LiDAR. Orbite pose un
lot de cuts ; Écho enregistre la relecture manuelle de l'opérateur expert
(Mic), dont la pose finale sert de référence. La GCV2 se place au-dessus du
moteur figé (GCV1) en trois étages :
1. HYPOTHÈSES (rien d'appris) : pour chaque rail d'un cut, au plus douze
   poses candidates (H0 pose de départ, H1 moteur, H2 cellules
   concurrentes du réservoir, H3 chaîne et voie prédite, H4 voisins sûrs,
   H5 rail manquant complété par l'écartement médian), avec et sans
   hauteur apprise.
2. SCORE (appris) : régression logistique calibrée, p(à 10 mm de Mic) et
   p(à 5 mm), sur une liste blanche de traits.
3. DÉCISION : garde-fous non appris (écartement, 45 mm latéral, dévers),
   puis couple qui maximise p_g × p_d, action si p ≥ τ et écart à H0 ≥ δ,
   τ et δ par zone (PN, ADV, abords, liste, hors).
Parties : 11 d'apprentissage (projet 1 : 12, 13, 14, 15, 16, 17, 24, 29 ;
projet 2 : 1, 10, 11). Témoins fixes jamais appris : 1:11 et 1:25.
Réservée pour le jugement : 2:6. Règle de rotation : une partie qui a servi
à régler ne juge jamais.

À LIRE (github.com/StoryNow30/banane)
- Branche claude/execute-prompt-00-18ra5a : fiches/G0_GCV2_CONCEPTION.md
  (la conception), fiches/PLAN_SUITE_5.0.md (portes), DECISIONS.md de
  D-188 à D-204 (surtout D-201 et D-204), fiches/RM4_ABSTENTIONS.md.
- Branche claude/50-g1a-hypotheses : fiches/G1A_HYPOTHESES.md,
  tools/gcv2-jeu.cjs, tests/gcv2-jeu.test.cjs (essais anti-fuite).
- Branche claude/50-g1b-apprendre : fiches/G1B_APPRENTISSAGE.md,
  tools/gcv2-apprendre.cjs, tests/gcv2-apprendre.test.cjs,
  datasets/gcv2-parametres.json.
Les jeux d'exemples (bords de rails) restent hors dépôt : tu ne peux pas
recalculer les chiffres de terrain. Tu peux lire le code et faire tourner
les essais sur les fixtures synthétiques (node --test tests/…).

RÉSULTATS À AUDITER (validation croisée par partie, 11 plis, 2 411 cuts)
GCV2 en relecture : 392 actions, 144 corrections justes (Mic > 10 mm, pose
à 10 mm), 6 abîmés, 5 mauvaises voies, erreur 6,6 % (Wilson ≤ 9,5 %).
Règle prudente actuelle : 136 actions, 107 justes, 4 abîmés, 0 mauvaise
voie. Hasard dans la liste : 20 justes, 125 abîmés. Les 5 mauvaises voies
sont toutes des cuts différés aux abords de la partie 2:1. Trois variantes
par zone (V1 à V3, D-204) sont déclarées APRÈS lecture de ces chiffres.

QUESTIONS (réponds à chacune)
1. FUITE : un trait, une hypothèse ou une étape peut-il lire, même
   indirectement, la pose finale de Mic sur le cut jugé ? Regarde en
   particulier H4 (voisins validés par Mic avant la première visite), la
   médiane d'écartement de la partie, la présence du nuage (qui dépend de
   la durée de visite de Mic), la zone et le rôle du cut, la liste blanche
   des traits, et l'observateur ajouté à tools/relecture-autonome.cjs.
2. VALIDATION CROISÉE : la séparation par partie est-elle étanche
   (normalisation, calibrage, λ, τ et δ, garde-fous) ? λ est choisi sur les
   11 parties : quel biais, et faut-il une validation imbriquée ? 11 plis
   déséquilibrés (21 à 821 cuts) : la pondération par partie est-elle
   juste ?
3. PORTES ET MESURES : les définitions (correction juste, abîmé, mauvaise
   voie, erreur, Wilson) sont-elles cohérentes avec la règle prudente qui
   sert de référence ? La porte « 0 mauvaise voie » est-elle bien posée sur
   2 411 cuts ?
4. VARIANTES APRÈS COUP : les variantes V1 à V3 sont choisies en lisant la
   validation croisée. Le jugement à l'aveugle prévu (2:6, 1:11, 1:25)
   suffit-il à corriger ce biais ? Sinon, que faut-il de plus (nombre de
   parties, borne, règle d'arrêt) ?
5. CE QUI MANQUE : la zone des abords (214 des 406 grosses corrections,
   35 % seulement atteignables sous garde-fous) et la partie 2:1 (grands
   déplacements latéraux) : quelle hypothèse ou quel garde-fou proposes-tu ?
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
