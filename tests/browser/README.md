# Fixture web — non exécutée dans le navigateur de cette session

Cette fixture charge le panneau, le background, le moteur et la classe de stockage
de la V3. Les API Chrome et ESV sont simulées ; les points du cut 2855 sont réutilisés
avec des identités fictives 100, 101, etc. IndexedDB serait celui de l’origine web
locale, ce qui **ne prouverait pas le stockage sous l’origine de l’extension**.

Le navigateur fourni a refusé la page locale avec `net::ERR_BLOCKED_BY_CLIENT`.
La page de gestion des extensions était également bloquée. Aucun contournement,
aucun chargement de V3 et aucun contrôle visuel de la fixture n’ont été effectués.

Pour un développeur disposant d’un navigateur local accessible :

```sh
node tools/browser-fixture.cjs
python3 -m http.server 8123
```

Ouvrir `http://localhost:8123/tests/browser/panel.html`. Ce n’est pas l’installation
Edge de la V3 et ce n’est pas une connexion à ESV.

Scénario prévu : Connecter → Assisté → Analyser → Appliquer → Restaurer → Après ;
fermer et rouvrir la page pour relire l’opération. Puis le bouton « Simulation :
cut suivant », Automatique TEST, plage 101–103, politique Tenter, déclaration TEST,
Démarrer. Vérifier trois opérations, les données exportées et la conservation
après rechargement. Ces étapes sont **une procédure fournie, pas un résultat obtenu**.
