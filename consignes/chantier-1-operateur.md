# Chantier 1 — fiche opérateur : inspecter la navigation d'ESV

**Pour toi, l'opérateur.** Environ 25 minutes, dans Edge, sur ESV. Le but :
trouver comment ESV revient à un cut précis (Z, S, la carte, un éventuel champ
de numéro), pour que Banane puisse un jour revenir sur ses cuts différés. Ce
que tu rapportes va à l'ingénieur du chantier 1, qui n'a pas accès à ESV.

## Avant de commencer

- Ouvre ESV sur une partie où **tu ne valides rien** pendant l'inspection.
  Ferme la fenêtre Banane : elle n'est pas utile ici.
- Les deux extraits ci-dessous **ne font que lire** la page. Ils n'appellent
  aucune fonction d'ESV, ne cliquent rien et ne modifient rien.
- Ce que tu vas copier contient **du code d'ESV**, qui appartient à son
  éditeur. Transmets-le à l'ingénieur **en privé**, jamais dans un dépôt : les
  dépôts Banane sont publics.
- Ne partage **jamais** d'export réseau complet (fichier HAR) ni d'en-têtes :
  ils contiennent tes jetons de session. Seulement des chemins, nettoyés
  (étape 3).

## 1. Inventaire de la page (2 minutes)

1. Dans ESV, ouvre les outils de développement (**F12**), onglet **Console**.
2. Si Edge refuse le collage, tape `allow pasting` puis Entrée (protection
   normale du navigateur).
3. Colle l'extrait A, Entrée. Le résultat est copié dans le presse-papiers :
   colle-le dans un fichier texte **`inventaire-esv.json`**.

```js
/* Banane, extrait A — inventaire d'ESV. LECTURE SEULE : n'appelle aucune
   fonction d'ESV, ne clique rien, ne modifie rien. */
(() => {
  const src = f => { try { return Function.prototype.toString.call(f).slice(0, 2500); } catch { return null; } };
  const out = { quand: new Date().toISOString(), page: location.pathname,
    cutAffiche: document.getElementById('O2N3DCutDescription')?.textContent.trim() || null,
    controles: [], fonctions: [], ecouteurs: {}, jquery: {}, scripts: [] };
  for (const el of document.querySelectorAll('button,[role=button],a[id],input,select,[id^=O2N3D],[onclick]'))
    out.controles.push({ balise: el.tagName.toLowerCase(), type: el.type || null, id: el.id || null,
      classes: typeof el.className === 'string' ? el.className : null, titre: el.title || null,
      texte: (el.innerText || el.placeholder || '').trim().slice(0, 80), desactive: !!el.disabled,
      visible: !!(el.offsetWidth || el.offsetHeight), onclick: el.getAttribute('onclick')?.slice(0, 300) || null });
  const motif = /cut|rail|load|next|prev|back|map|goto|select|invalid|nav|key/i;
  for (const nom of Object.getOwnPropertyNames(window)) {
    if (!motif.test(nom)) continue;
    const d = Object.getOwnPropertyDescriptor(window, nom);
    if (d && typeof d.value === 'function') { const s = src(d.value); if (s && !s.includes('[native code]')) out.fonctions.push({ nom, source: s }); }
  }
  const ecoute = (cible, nom) => { try { const l = getEventListeners(cible);
    for (const t of ['keydown', 'keyup', 'keypress', 'click', 'dblclick'])
      if (l[t]) out.ecouteurs[nom + ':' + t] = l[t].map(x => src(x.listener)); } catch (e) { out.ecouteurs[nom] = 'illisible : ' + e; } };
  ecoute(window, 'window'); ecoute(document, 'document');
  for (const el of document.querySelectorAll('[id^=O2N3D],button[id]')) ecoute(el, '#' + el.id);
  try { const $ = window.jQuery; if ($?._data) for (const [cible, nom] of [[document, 'document'], [window, 'window']]) {
    const ev = $._data(cible, 'events') || {};
    for (const [t, hs] of Object.entries(ev)) out.jquery[nom + ':' + t] = hs.map(h => ({ selecteur: h.selector || null, source: src(h.handler) })); } } catch {}
  out.scripts = [...document.scripts].map(s => s.src ? s.src.split('?')[0] : 'en ligne (' + s.textContent.length + ' caractères)');
  window.__bananeInventaire = out;
  try { copy(JSON.stringify(out, null, 1)); } catch {}
  console.log(`Inventaire : ${out.controles.length} contrôles, ${out.fonctions.length} fonctions, ${Object.keys(out.ecouteurs).length} écouteurs. `
    + 'Copié dans le presse-papiers (sinon, tape : copy(JSON.stringify(__bananeInventaire)) ).');
})();
```

## 2. Journal de tes gestes (3 minutes)

1. Toujours dans la Console, colle l'extrait B, Entrée. Il écoute pendant
   **90 secondes** et n'empêche rien.
2. Clique une fois sur une **zone neutre** d'ESV (le bandeau du haut, pas la
   vue 3D, où un clic peut poser un rail), puis fais, dans l'ordre, en
   laissant 2 secondes entre chaque geste :
   - **Z** trois fois, puis **S** trois fois, puis **D** une fois ;
   - dézoome la carte et **sélectionne un rail** d'un autre cut ;
   - clique **à la souris** les boutons de l'interface qui font la même chose
     que Z et S ;
   - s'il existe un champ pour taper un numéro de cut, **utilise-le** une fois.
3. Au bout de 90 secondes, le journal est copié : colle-le dans
   **`gestes-esv.json`**.

```js
/* Banane, extrait B — journal des gestes pendant 90 s. LECTURE SEULE :
   écoute sans rien empêcher, n'appelle aucune fonction d'ESV. */
(() => {
  const libelle = () => document.getElementById('O2N3DCutDescription')?.textContent.trim() || null;
  const nomNoeud = n => n.id ? '#' + n.id : n.tagName ? n.tagName.toLowerCase()
    + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : '') : String(n.nodeName || n);
  const journal = [], t0 = performance.now(), types = ['keydown', 'click', 'dblclick', 'change'];
  const note = e => { const entree = { ms: Math.round(performance.now() - t0), type: e.type, touche: e.key ?? null, code: e.code ?? null,
      maj: !!e.shiftKey, chemin: e.composedPath().slice(0, 8).map(nomNoeud), cutAvant: libelle() };
    journal.push(entree); setTimeout(() => { entree.cutApres = libelle(); }, 1500); };
  for (const t of types) window.addEventListener(t, note, { capture: true, passive: true });
  console.log('Journal des gestes : 90 secondes. Clique une zone neutre, puis Z, S, D, la carte, les boutons à la souris.');
  setTimeout(() => {
    for (const t of types) window.removeEventListener(t, note, { capture: true });
    window.__bananeGestes = journal;
    try { copy(JSON.stringify(journal, null, 1)); } catch {}
    console.log(`Terminé : ${journal.length} gestes. Copié (sinon, tape : copy(JSON.stringify(__bananeGestes)) ).`);
  }, 90000);
})();
```

## 3. Ce que le réseau montre (5 minutes)

1. Onglet **Réseau** (Network), filtre **Fetch/XHR**, bouton « Effacer ».
2. Appuie sur **S** : note le **chemin** de chaque requête qui apparaît (par
   exemple `/rails_validation/api/…/cut/…`) et sa méthode (GET, POST).
3. Recommence avec **Z**, puis avec une **sélection de rail sur la carte**.
4. Dans chaque chemin, remplace par `XXX` toute valeur qui ressemble à un
   jeton (mots `token`, `key`, `auth`, `session`, ou longue suite de
   caractères). Mets le tout dans **`reseau-esv.txt`**.

### 3 bis. La carte et le statut des cuts (5 minutes) — pour le cerveau

Le Pilote gagnerait beaucoup à s'appuyer sur les cuts **déjà validés** autour
d'un cut difficile (étude du 24/09, `audit/appuis-valides-2026-09-24.md`). Il
faut savoir où ESV garde ces informations :

1. Toujours dans **Réseau**, effacer, puis **ouvre ou déplace la carte** :
   note le chemin des requêtes qui arrivent (souvent un flux de géométries,
   parfois `.json`, `.geojson` ou une liste de cuts). Clique sur l'une d'elles,
   onglet **Aperçu** : contient-elle, pour chaque cut, un **statut** (validé,
   à revoir, ignoré) et des **coordonnées de rails** ? Copie **un seul élément**
   de la liste, jetons retirés, dans `reseau-esv.txt`.
2. Réponds en une ligne chacune : les rails dessinés sur la carte bougent-ils
   quand tu valides une nouvelle pose ? La couleur d'un cut sur la carte
   change-t-elle quand tu le valides ou le passes en SKIP ?

## 4. Chercher dans le code d'ESV (10 minutes)

1. Onglet **Sources**, puis **Ctrl+Maj+F** (recherche dans tous les fichiers).
2. Cherche, un par un : `loadNextInvalidCut` · `"negative"` · `loadCut` ·
   `keyCode` · `which` · `singleclick` · `cutId` · `goTo`.
3. Pour chaque résultat qui parle de navigation entre cuts : note le nom du
   fichier et la ligne, et copie une vingtaine de lignes autour dans
   **`sources-esv.txt`**.

## 5. Ce que tu transmets

Les quatre fichiers — `inventaire-esv.json`, `gestes-esv.json`,
`reseau-esv.txt`, `sources-esv.txt` — **à l'ingénieur du chantier 1, en
privé**, avec une phrase : sur quelle partie et quel cut tu étais, et ce qui
t'a surpris. Rien ne va dans un dépôt : l'ingénieur n'y consignera que des
noms, des identifiants et des chaînes d'appel.
