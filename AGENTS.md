# Pour tout agent (OpenCode compris)

Les règles de ce dépôt sont dans **`CLAUDE.md`** à la racine : lis-le en entier avant toute modification, puis le ticket de ton chantier dans `chantiers/CH-NNN.md`. L'organisation est décrite dans `fiches/RESEAU_IA.md`.

## OpenCode (D-364, 17/11)
- **Rôle** : l'opérateur te lègue la production et le développement par étapes (`fiches/PASSATION_OPENCODE.md`, la passation complète, D-373 ; le travail à venir : `fiches/PLAN_ARIANE_6.md`). Avant tout : `node tools/vps-pret.cjs`. **Depuis D-375 (18/11), tu as toute la main** : tu es l'intégrateur (tickets, intégration, verify, paquets, avance du tronc, `DECISIONS.md` sous la dictée de l'opérateur) ; les fichiers protégés de `CLAUDE.md` le restent pour tout chantier ; Claude relit à la demande de l'opérateur. Ordre de départ : `node tools/vps-pret.cjs`, CH-131, puis `chantiers/VISION-21.md`.
- **Tout ce que dit `CLAUDE.md` vaut pour toi**, sauf ce qui est propre aux sessions Claude : tu n'as pas `send_message` ; ton canal est le hub, sur la pull request du chantier : `node tools/hub.cjs dire --chantier CH-NNN --de opencode --type <type> "texte"` (`hub/PROTOCOLE.md`). Une `question` bloque : attends la `reponse`. Fin de travail : un `rapport` d'une page.
- **Données** : tu peux lire `banane-data` (dépôt `StoryNow30/banane-data`, branche `claude/execute-prompt-00-18ra5a`). Rien de ce que tu y lis (adresse ESV, code projet, UUID, coordonnées, nom) ne passe dans `banane`, ni dans un commit, ni dans le hub.
- **Langue** : tout en français ; ne rapporte que du mesuré, qualifié ÉTABLI, PROBABLE ou SUPPOSÉ.
- **Adresse du relais** : elle contient le nom de l'opérateur. Elle n'est jamais dans un fichier du dépôt ; pour fabriquer un paquet, elle vient de `~/.ariane/relais.txt` sur la machine (posé par l'opérateur) ou de la variable `ARIANE_RELAIS`.
