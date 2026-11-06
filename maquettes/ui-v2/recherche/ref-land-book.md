# Référence : land-book.com

## Ce que j'ai tenté (Chromium, navigation ordinaire, une seule fois, 29/10)
- Accueil, `chromium.launch()` sans option, attente 6 s.

## Résultat exact
- HTTP **403**, titre de page « **Just a moment...** ».
- Texte affiché : « land-book.com — **Performing security verification** — This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot. — Ray ID: a51e465c3913ab90 — Performance and Security by Cloudflare ».
- Même réponse que lors du premier essai signalé par la session mère.

## Décision
- Défi Cloudflare : **non contourné** (aucun autre navigateur, aucun délai, aucune option de lancement). Rien n'a été lu ; aucune maquette ne s'en réclame.
- SUPPOSÉ seulement (non vérifié, donc non utilisé) : galerie de pages d'accueil du même genre que landdding.
