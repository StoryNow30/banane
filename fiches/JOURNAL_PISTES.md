# Journal des pistes (cap D-170 : Ariane fait seule la relecture de Mic)

Mic a donné ce cadre le 17 octobre : observer, diagnostiquer, prioriser, modifier, tester, mesurer, décider.

Chaque piste a une hypothèse, une référence de départ, un critère de réussite et un résultat mesuré. Les étiquettes : **F** pour fait mesuré, **H** pour hypothèse, **NM** pour non mesuré.

**Condition de la test 7 (D-173)** : les règles métier agissent vraiment, avec des chiffres au banc. Elles sont jugées sur des parties réservées, avec 0 mauvaise voie. Le panneau est réorganisé.

| # | Piste | Hypothèse | Référence | Critère de réussite | État | Résultat |
|---|---|---|---|---|---|---|
| P-1 | Relecture autonome, étude (`claude/50-zones-autonomes`) | Une règle de correction prudente reproduit une part utile des corrections de Mic sans abîmer de cut juste. | Aujourd'hui, 0 % de ses corrections hors des rouges sont reproduites : Ariane ne visite pas les verts. | 0 mauvaise voie, cuts abîmés ≤ 1 % des visités, gain mesuré en validation croisée puis sur les parties réservées. | en cours | NM |
| P-2 | Relecture de fin de lot, modes ombre et corriger (`claude/50-relecture-ombre`) | La passe peut visiter et corriger avec les gestes du lot Orbite, avec une trace identique à celle d'un humain. | La 4.9.5.6 ne visite aucun vert. | Mode coupé identique octet pour octet ; mode ombre sans aucune écriture ; mode corriger seulement par le chemin Orbite ; banc vert. | en cours | NM |
| P-3 | Panneau réorganisé (`claude/50-panneau-t7`) | Le panneau devient lisible, sans information perdue. | Panneau de la test 6 : libellé de la grappe trompeur, confusion entre le dernier lot et le prochain, pas de message en fin de partie. | Les trois défauts corrigés, essais verts, captures avant et après. | en cours | NM |
| P-4 | Règle SKIP (D-172) | « Aucun point » ou « un seul scanner » se lit dans la capture. | Ariane refuse tout SKIP. | La règle retrouve les SKIP de Mic sans faux SKIP. | confiée à P-1 et P-2 | NM |
| P-5 | Les détecteurs PN et ADV tiennent-ils sur le projet 2 ? Audit des lots terrain de la test 6 | Les détecteurs réglés sur le projet 1 peuvent manquer des zones du projet 2, où Mic travaille maintenant. | Projet 1 : PN 17/17, ADV 8/8 (F). Projet 2 : NM. | Zones du projet 2 retrouvées, avec les preuves ; blocages entre détection et action listés et vérifiés. | lancé | NM |
