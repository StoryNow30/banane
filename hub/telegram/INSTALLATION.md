# Relais Telegram du hub : installation pas à pas

Une fois installé : chaque message du hub (les miens, ceux de Cursor ou de GLM, les verdicts de GitHub) arrive sur ton Telegram ; ce que tu écris dans Telegram devient un commentaire de la PR du chantier, signé `operateur`, et réveille la session Claude Code abonnée à cette PR. Coût : 0 €. Durée : 25 minutes. Rien ne sort de ce circuit : le relais refuse tout message contenant un courriel, une adresse web, un code projet ESV, un UUID ou un de tes motifs confidentiels.

Tu aurras à noter cinq valeurs. **Ne les colle jamais dans une conversation avec une IA ni dans un fichier du dépôt** : elles se collent uniquement dans Cloudflare et dans Telegram, comme indiqué.

## A. Le bot Telegram (5 min)
1. Dans Telegram, cherche **@BotFather** (coche bleue), ouvre-le, écris `/newbot`.
2. Il demande un nom (ex. « Hub Ariane ») puis un identifiant finissant par `bot` (ex. `ariane_hub_perso_bot`). Il te donne un **jeton** du type `123456:ABC…` → c'est `TG_BOT_TOKEN`. Garde-le dans ton gestionnaire de mots de passe.
3. Ouvre la conversation avec ton nouveau bot, écris-lui `salut`.
4. Dans ton navigateur, ouvre `https://api.telegram.org/bot<TON_JETON>/getUpdates` (remplace `<TON_JETON>`). Dans le texte, cherche `"chat":{"id":` suivi d'un nombre : c'est `TG_CHAT_ID`.

## B. Les secrets à fabriquer (2 min)
5. `TG_WEBHOOK_SECRET` : une suite de lettres et de chiffres au hasard, 30 caractères (ton gestionnaire de mots de passe sait en générer ; pas de caractères spéciaux).
6. `GH_WEBHOOK_SECRET` : une autre, différente.
7. `GH_TOKEN` : sur GitHub → ta photo → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token. Nom « relais hub Ariane », expiration 90 jours, « Only select repositories » → `banane` uniquement. Permissions du dépôt : **Issues : Read and write**, **Pull requests : Read-only**, rien d'autre. Génère et copie.

## C. Le relais sur Cloudflare (10 min)
8. Crée un compte gratuit sur https://dash.cloudflare.com (courriel + mot de passe ; pas de carte bancaire).
9. Menu « Workers & Pages » → **Create** → **Create Worker** → nom `ariane-hub-relais` → **Deploy** (le code d'exemple, tel quel).
10. Clique **Edit code**. Efface tout. Colle le contenu du fichier `hub/telegram/worker.js` du dépôt (ouvre-le sur GitHub, bouton « Raw », sélectionne tout, copie). **Deploy**.
11. Reviens sur la page du Worker → **Settings** → **Variables and Secrets** → ajoute :
    - en **texte** : `GH_OWNER` = `StoryNow30`, `GH_REPO` = `banane` ;
    - en **secret** : `TG_BOT_TOKEN`, `TG_CHAT_ID`, `TG_WEBHOOK_SECRET`, `GH_TOKEN`, `GH_WEBHOOK_SECRET`, et si tu veux le scan de ton nom et de l'hôte ESV : `ARIANE_MOTIFS_INTERDITS` (la même valeur que ta variable sur le PC, ex. `Prenom|Nom|esv\.exemple\.fr`).
    **Deploy** de nouveau.
12. Note l'adresse du Worker, du type `https://ariane-hub-relais.<ton-nom>.workers.dev` (page du Worker, rubrique « Domains & Routes »).

## D. Brancher Telegram (2 min)
13. Dans ton navigateur, ouvre (une seule ligne, en remplaçant les trois valeurs) :
    `https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook?url=<ADRESSE_DU_WORKER>/telegram&secret_token=<TG_WEBHOOK_SECRET>`
    Réponse attendue : `{"ok":true,"result":true,"description":"Webhook was set"}`.

## E. Brancher GitHub (3 min)
14. Dépôt `banane` → Settings → **Webhooks** → Add webhook :
    - Payload URL : `<ADRESSE_DU_WORKER>/github`
    - Content type : `application/json`
    - Secret : ton `GH_WEBHOOK_SECRET`
    - « Let me select individual events » → coche **Issue comments** seulement.
    - Active, **Add webhook**. GitHub envoie un ping : une coche verte doit apparaître après quelques secondes.

## F. Le test (2 min)
15. Dans Telegram, écris à ton bot : `/etat`. Il répond la liste des chantiers ouverts (aujourd'hui : CH-001).
16. Écris : `CH-001 test du relais`. Il répond « Envoyé sur CH-001 (PR #6), type info. ». Le commentaire apparaît sur la PR, signé `operateur`.
17. Dis-moi ici « relais prêt » : je poste un message de test depuis la session, tu dois le recevoir sur Telegram dans les secondes qui suivent.

## Comment parler au hub depuis Telegram
- **Répondre à un message du hub** (appui long → Répondre) : le chantier est reconnu tout seul, le type est `reponse`.
- **Écrire de ton côté** : `CH-001 ton texte`, ou à un agent précis : `CH-001 @glm ton texte`. Destinataires : `@integrateur` (par défaut), `@cursor`, `@glm`, `@agent`, `@tous`. En répondant à un message, le destinataire est l'auteur de ce message. Mots facultatifs ensuite : `question`, `reponse`, `rapport`, `alerte`, `info`, `ticket`.
- **Un seul chantier ouvert** : tu peux écrire sans préfixe.
- `/etat` liste les chantiers ouverts ; `/aide` rappelle ces règles.

## Limites à connaître
- Ta réponse réveille **la session Claude Code abonnée à la PR**. Si cette session est fermée, personne n'est réveillé : la réponse reste sur la PR et la prochaine session l'y lira. Une session neuve doit s'abonner à la PR en démarrant.
- Telegram n'est pas chiffré de bout en bout pour les bots : le contenu passe par leurs serveurs. Le scan des motifs interdits s'applique, et les messages du hub restent courts.
- Le jeton GitHub expire (90 jours) : à renouveler dans Cloudflare quand GitHub te prévient.
- Si tu perds ton téléphone : dans @BotFather, `/revoke` change le jeton du bot et coupe l'accès.
