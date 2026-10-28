# Hub Ariane : la messagerie des agents

Décision de l'opérateur du 26/10/2026 : les agents du projet communiquent par un hub. Le hub n'est pas un serveur de plus : **c'est GitHub, qui est déjà là.** Chaque chantier a sa pull request ; ses messages sont les commentaires de cette PR. Tout le monde les lit (l'opérateur sur son téléphone, les agents par `tools/hub.cjs`), tout est horodaté et conservé, et la session Claude Code abonnée se réveille à chaque message au lieu de scruter.

## Les canaux

| Canal | Support | Pour quoi |
|---|---|---|
| `CH-NNN` | PR de la branche `chantier/CH-NNN` vers `claude/50-test17` | tout ce qui concerne ce chantier : ticket, questions, rapport, verdict des essais, revue |
| `TNN` | PR d'intégration d'une version de test (quand elle existe) | fusion, verify de version, paquet |
| `hub` | PR permanente « hub » (branche `hub/journal`) | messages généraux : budget, décisions à prendre, alertes hors chantier |
| Telegram | relais `hub/telegram/` (Cloudflare Worker, installation : `hub/telegram/INSTALLATION.md`) | miroir du hub sur le téléphone de l'opérateur, dans les deux sens : chaque message du hub lui est envoyé, sa réponse devient un commentaire signé `operateur` sur la PR du chantier |
| direct | `send_message` entre sessions Claude Code | **canal par défaut entre une mère et ses filles, et entre sessions Claude** : questions bloquantes (`@parent`), priorité `next` par défaut ; `now` interrompt l'outil en cours, réponses, ordres. Raison (D-255 : mesuré le 28/10) : une session Claude qui poste sur le hub le fait avec le même compte GitHub que son interlocutrice ; l'événement passe pour un écho et ne la réveille pas, les deux attendent dans le vide. Le résultat est ensuite reporté sur la PR (journal public) |

## Le message

Toujours produit par `node tools/hub.cjs dire` (ou par l'action GitHub), jamais tapé à la main dans la PR par un agent, pour que le scan tourne et que le format soit stable :

```
**[émetteur → destinataire] type · CH-001 · 27/10/2026 09:05 Paris**

le texte, une demi-page au plus

---
_hub Ariane · émetteur : cursor_
```

- **Émetteurs** : `integrateur` (Claude Code cloud), `cursor`, `glm` (Claude Code sur le poste de l'opérateur avec le modèle externe), `actions` (GitHub), `operateur`, `agent` (sous-agent).
- **Types** : `ticket` (la commande, posté par l'intégrateur à l'ouverture), `question` (bloqué : on attend une réponse, on ne devine pas), `reponse`, `rapport` (fin de travail : fait, pas fait, mesures), `verdict` (essais et scan, posté par `actions` ou l'intégrateur), `alerte` (règle touchée, données sensibles, budget), `info`.
- **Destinataire** : `tous` par défaut ; `operateur` quand seule une personne peut trancher ; un émetteur quand on lui répond.
- **Longueur** : une demi-page. Le détail va dans un fichier de la branche (`chantiers/CH-NNN.rapport.md`), le message dit où.

## Les règles

1. **Scan avant envoi.** `hub.cjs` refuse tout message qui contient un courriel, une adresse web hors liste blanche, un code de projet ESV, un UUID ou un motif confidentiel (variable `ARIANE_MOTIFS_INTERDITS`, fournie par l'opérateur sur son poste et comme secret du dépôt pour l'action ; jamais écrite dans un fichier).
2. **Un message, un fait.** On n'écrit pas « ça marche » : on écrit le compte (« 6 essais verts sur 6, verify 2 679/0/0 »), ou le lien du journal d'action.
3. **Une question bloque.** Un agent qui pose une `question` s'arrête et attend ; il ne continue pas sur une hypothèse. L'intégrateur ou l'opérateur répond par `reponse`.
4. **Le verdict vient des machines.** Seuls `actions` et l'intégrateur postent un `verdict`, et toujours à partir d'un verify, d'une garde ou d'une parité qui a tourné. Un exécutant poste un `rapport`, jamais un verdict.
5. **Pas de bavardage entre agents.** Deux agents ne dialoguent pas dans la PR : l'exécutant parle à l'intégrateur, l'intégrateur parle à l'opérateur. Le quota part dans les boucles de politesse.
6. **Le hub n'est pas la vérité.** La vérité est dans la branche (le code, les essais) et dans `DECISIONS.md`. Un message qui contredit la branche a tort.

## Le cycle d'un chantier dans le hub

1. L'intégrateur crée la branche `chantier/CH-NNN` (avec le squelette du rapport), ouvre la PR **en brouillon** vers le tronc, poste le `ticket`, et s'abonne à la PR.
2. L'exécutant travaille, pousse ; à chaque poussée l'action GitHub poste son `verdict` (verify complet, scan).
3. L'exécutant poste `question` s'il bloque, `rapport` quand il a fini, et passe la PR « prête ».
4. L'intégrateur relit le diff, poste `verdict` (accepté, ou ce qui manque), fusionne dans le tronc (commit de fusion), ferme la PR. Le chantier est fini.

## Cursor dans le hub

Cursor n'est pas un outil installé chez l'opérateur : c'est un agent infonuagique lancé par GitHub. Un commentaire qui commence par `@cursor` sur une PR lance (ou relance) son agent sur cette PR, avec les droits de l'application GitHub de Cursor (dépôt `banane` seulement, jamais `banane-data`). `tools/hub.cjs dire --a cursor …` (et le relais Telegram, `CH-001 @cursor …`) ajoutent cette mention. Les commentaires que l'agent poste lui-même sont transmis tels quels à Telegram. Le ticket (`chantiers/CH-NNN.md`) et `CLAUDE.md` sont lus par l'agent comme pour tout exécutant ; ses interdits sont les mêmes. L'opérateur règle le crédit de dépense de Cursor dans son compte.

## Ce qu'un verdict vert de GitHub prouve, et ne prouve pas

Le verdict de l'action est un **filtre**, pas une livraison. Il prouve : les essais du dépôt passent sur une machine propre (le 27/10 : 2 679 essais, 0 échec, 0 annulé, 21 ignorés), aucun motif interdit, le paquet se construit. Il ne prouve pas : les 21 essais de navigateur (Chromium absent de l'exécuteur) ni la maquette ESV, qui ne tournent que sur le poste de l'intégrateur ; ni la parité ni la garde sur les lots. **Avant tout paquet, l'intégrateur refait un verify complet, la maquette, la parité et la garde sur son poste.** Le délai par fichier d'essai est de 60 s sur GitHub (variable `BANANE_TEST_TIMEOUT_MS`), de 20 s ailleurs.

## Hors ligne ou sans `gh`

`node tools/hub.cjs dire --boite --pousser …` écrit le message dans `hub/boite/CH-NNN.md` sur la branche du chantier et le pousse : l'intégrateur le lit dans le diff. La boîte n'existe jamais sur le tronc.
