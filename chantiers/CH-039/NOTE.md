# CH-039 : note de cause (une page)

Source : `banane-data`, collection `2026-11-02_v4.9.5.31_constellation-fin-de-lot-newpart`, volume 01 (journal, état exporté, instantané de la liste de la partie 1 au départ). Heures UTC. Lecture par script, rien n'est copié dans `banane`.

## 1. Pourquoi le moteur n'a pas reconnu le dernier cut (ÉTABLI)
- La reconnaissance du dernier cut n'est pas dans le moteur : c'est `dernierCutCertain` du service worker (`background.js`), appelée avant chaque validation. Elle rend « dernier » quand **devant = restants − différés du lot − 1 = 0**, avec restants = M − N lus au compteur « N on M treated » pendant le cut.
- Au cut 3080 (relevé 09:09:22,014) : N = 10 018, M = 10 028, donc **10 cuts non validés** dans la partie, 3080 compris.
- Le lot relancé à 09:02 (du cut 535 à la fin de la partie) avait différé **6 cuts** : 896, 897, 898, 899, 901, 1400. Devant = 10 − 6 − 1 = **3**, donc « pas le dernier ».
- Ces 3 cuts sont **354, 355 et 362**, différés par le **premier lot de la partie 1** (08:28 à 08:39, arrêté en erreur au cut 535). Ils sont restés rouges et sont derrière 3080. La règle ne compte que les différés du lot en cours : c'est voulu (« sûr par excès », jamais de faux zéro), mais elle rate le dernier cut dès qu'un lot **reprend une partie déjà entamée**.
- Preuve croisée : l'instantané de la liste au départ de la partie 1 (92 non validés) donne **3080 comme dernier cut non validé de la partie**. L'audit serveur de 09:12:25 compte **9 non validés après le lot** (354, 355, 362 et les 6 différés), et 83 validations attendues contre 83 constatées. 3080 est donc validé côté serveur.
- Partie 0, en contraste : 9 979 sur 10 008, soit 29 restants. Le lot avait différé 28 cuts, donc devant = 0. Résultat : « dernier-invalide » au cut 9663, Ctrl+Entrée sur place, ESV reste sur la partie.

## 2. D'où vient 10027 (ÉTABLI)
- 10027 = **M − 1, le dernier cut de la partie**, et il est **validé** (statut 0 dans l'instantané). Ce n'est pas un cut visé par le lot.
- C'est l'endroit où ESV se pose quand, après une validation, il ne trouve plus de cut non validé devant. La fiche de départ ne le connaissait pas comme cible. Le lot le prenait pour « cut suivant » parce que l'adaptateur a rapporté la navigation observée vers 1:10027, dans la même partie et sous la borne (`end` 999999, `endMode:'partie'`). `lotExitOf` ne voyait donc aucune sortie.

## 3. Ce qu'ESV a fait, dans l'ordre (ÉTABLI, journal)
| Heure | Fait |
|---|---|
| 09:09:25,101 | `validateAndNext` 3080 reçu par la page. |
| ,109 | Navigation observée vers 1:10027 (« decision-command-returned », VALIDATE). |
| ,137 (page, à 2 ms près) | `railPairUpdated 1 3080 valid`, `railPairSelected 1 10027`, **`newPart 2`**. |
| ,157 | Validation 3080 acceptée par le moteur (`validation-accepted`). |
| ,296 | Cible du lot : 10027. ,406 : capture de 10027 demandée. |
| ,555 | Capture en échec : « page ESV rechargée ou fermée (back/forward cache) ». ESV recharge la page sur la partie 2. |
| ,615 | `batch-error`. Le lot passe en **`PAUSED_ADAPTER_UNRESPONSIVE`**, pas en ERROR. |
| 09:09:26,160 | Nouvel observateur installé (page neuve). La liste de la partie 2 se charge. |
| 09:11:42 | Reconnexion : ESV affiche la partie 2 (cut 9123). |
| 09:12:33 et 09:13:36 | « Reprendre » rattache le lot à la partie 1, au cut 10027 (ESV y était revenu). |
| 09:13:39 | « Arrêter la file » de l'opérateur (motif `operateur`). |

- **La file ne s'est pas arrêtée seule.** Un lot en `PAUSED_ADAPTER_UNRESPONSIVE` n'est pas « clos » pour `classerLot`, donc la file attendait, sans Rattrapage ni relecture, jusqu'à l'arrêt de l'opérateur. Rien n'a été écrit d'incertain : la pose de 3080 est validée et l'état `applied` est vide.

## 4. Ce que le correctif doit faire (service worker et file, `src/engine.js` intact)
1. **Dernier cut** : soustraire aussi les cuts différés par un lot antérieur de la même partie, dans la même page, derrière le cut courant, sans validation connue depuis (validation d'Ariane, écriture de la passe ou de la relecture, `railPairUpdated … valid` observé). Un doute (observateur coupé, perte d'observations, page rechargée) : pas de soustraction, comportement d'avant.
2. **`newPart` après une validation acceptée**, puis la page perdue avant toute pose : le lot se clôt « partie-changee-par-esv » (fin de partie constatée, rien d'incertain), au lieu de `batch-error`.
3. **File** : sur cette fin, retour sur la partie du lot par le **lien** (aucune écriture), puis Rattrapage et relecture, puis la partie suivante. Si le retour échoue : arrêt avec « ESV a changé de partie seul ; retour impossible ».

**SUPPOSÉ** : ESV change de partie dès qu'il n'a plus de cut non validé devant après une validation (D-264). C'est vu une fois ici et cohérent avec le témoignage de l'opérateur, mais le seuil exact (« plus rien devant » ou « plus rien dans la partie ») n'est pas prouvé : ici, il restait 9 cuts rouges derrière.
