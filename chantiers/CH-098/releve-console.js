/* CH-098 — RELEVÉ MÉMOIRE DE LA PAGE D'ESV, à coller dans la console (F12) de l'onglet ESV, deux fois : au début d'un lot et à la fin.
 * LECTURE SEULE : aucune requête, aucun clic, aucune fonction d'ESV ou de Potree appelée (seulement des lectures de champs), rien n'est modifié
 * dans la page ; la seule trace laissée est la variable `window.__releveMemoireCH098` (ce relevé, pour la différence au collage suivant).
 * N'affiche QUE DES NOMBRES : aucune adresse, aucun nom de fichier, aucun identifiant, aucun texte de la page.
 * Résultat : un JSON copié dans le presse-papiers (sinon : copy(JSON.stringify(__releveMemoireCH098.releve))) ; au 2e collage, la différence avec le 1er. */
(() => {
  const fini = v => (typeof v === 'number' && Number.isFinite(v) ? v : null), Mo = o => (fini(o) === null ? null : Math.round(o / 1048576 * 10) / 10);
  const lire = f => { try { return f(); } catch { return null; } };
  const out = { format: 'ch098-releve-memoire-v1', t: Math.round(performance.now() / 1000) };
  /* 1. Tas JS de la page (Chrome) : utilisé, réservé, limite. Pas de ramasse-miettes forcé depuis la console : prendre la plus basse de 3 lectures à 10 s d'écart si possible. */
  const m = lire(() => performance.memory);
  out.tas = { utiliseMo: Mo(m?.usedJSHeapSize), totalMo: Mo(m?.totalJSHeapSize), limiteMo: Mo(m?.jsHeapSizeLimit) };
  /* 2. Potree : arbre des nœuds de chaque nuage (nœuds connus, chargés, en cours, portant une géométrie, octets de ses tampons), LRU, budget. */
  const octetsGeom = g => { let o = 0; const a = g?.attributes; if (a && typeof a === 'object') for (const k of Object.keys(a)) { const b = a[k]?.array?.byteLength; if (fini(b)) o += b; } const i = g?.index?.array?.byteLength; if (fini(i)) o += i; return o; };
  const v = lire(() => window.viewer), P = lire(() => window.Potree);
  const nuages = lire(() => v.scene.pointclouds) || [];
  out.potree = { nuages: Array.isArray(nuages) ? nuages.length : null, numNodesLoading: fini(lire(() => P.numNodesLoading)), maxNodesLoading: fini(lire(() => P.maxNodesLoading)),
    pointLoadLimit: fini(lire(() => P.pointLoadLimit)), budget: fini(lire(() => (typeof v.getPointBudget === 'function' ? v.getPointBudget() : v.pointBudget))),
    lruPoints: fini(lire(() => P.lru.numPoints)), lruNoeuds: fini(lire(() => (typeof P.lru.size === 'function' ? P.lru.size() : P.lru.elements))), parNuage: [] };
  const MAX = 500000;
  for (const pc of Array.isArray(nuages) ? nuages.slice(0, 8) : []) {
    const r = { visibles: lire(() => pc.visibleNodes.length), pointsVisibles: fini(lire(() => pc.numVisiblePoints)), noeuds: 0, charges: 0, enCours: 0, avecGeometrie: 0, geometrieMo: 0, sceneNodes: 0, sceneGeometrieMo: 0, tronque: false };
    let oct = 0, octScene = 0; const vus = new Set(), pile = [lire(() => pc.pcoGeometry.root)].filter(Boolean);
    while (pile.length) {
      const n = pile.pop(); if (!n || typeof n !== 'object' || vus.has(n)) continue; vus.add(n); if (vus.size > MAX) { r.tronque = true; break; }
      r.noeuds++; if (lire(() => n.loaded) === true) r.charges++; if (lire(() => n.loading) === true) r.enCours++;
      const g = lire(() => n.geometry); if (g && typeof g === 'object') { r.avecGeometrie++; oct += octetsGeom(g); }
      const ch = lire(() => n.children);
      if (Array.isArray(ch)) { for (const c of ch) if (c) pile.push(c); } else if (ch && typeof ch === 'object') { for (const k of Object.keys(ch)) if (ch[k]) pile.push(ch[k]); }
    }
    /* Nœuds de scène de Potree (objets Points montés), et leurs géométries. */
    const vs = new Set(), pileS = [lire(() => pc.root)].filter(Boolean);
    while (pileS.length) {
      const n = pileS.pop(); if (!n || typeof n !== 'object' || vs.has(n)) continue; vs.add(n); if (vs.size > MAX) { r.tronque = true; break; }
      const s = lire(() => n.sceneNode); if (s) { r.sceneNodes++; octScene += octetsGeom(lire(() => s.geometry)); }
      const ch = lire(() => n.children);
      if (Array.isArray(ch)) { for (const c of ch) if (c) pileS.push(c); } else if (ch && typeof ch === 'object') { for (const k of Object.keys(ch)) if (ch[k]) pileS.push(ch[k]); }
    }
    r.geometrieMo = Mo(oct); r.sceneGeometrieMo = Mo(octScene); out.potree.parNuage.push(r);
  }
  /* 3. Rendu (three.js) : géométries et textures tenues par le moteur de rendu, programmes. */
  const info = lire(() => v.renderer.info);
  out.rendu = { geometries: fini(lire(() => info.memory.geometries)), textures: fini(lire(() => info.memory.textures)), programmes: lire(() => info.programs.length), appels: fini(lire(() => info.render.calls)) };
  /* 4. Scène : objets et géométries de toute la scène (rails, profils, mesures), par parcours des enfants. */
  const sc = { objets: 0, avecGeometrie: 0, geometrieMo: 0, tronque: false }; let octSc = 0;
  for (const racine of [lire(() => v.scene.scene), lire(() => v.scene.scenePointCloud)].filter(Boolean)) {
    const pile = [racine], vus = new Set();
    while (pile.length) { const o = pile.pop(); if (!o || vus.has(o)) continue; vus.add(o); if (vus.size > MAX) { sc.tronque = true; break; }
      sc.objets++; const g = lire(() => o.geometry); if (g && typeof g === 'object') { sc.avecGeometrie++; octSc += octetsGeom(g); }
      const ch = lire(() => o.children); if (Array.isArray(ch)) for (const c of ch) pile.push(c); }
  }
  sc.geometrieMo = Mo(octSc); out.scene = sc;
  /* 5. Page : éléments du DOM, entrées de minutage des ressources gardées par le navigateur. Ariane : présente (1) ou non (0) ; ses structures
   * sont dans des fermetures, illisibles depuis la console (null). */
  out.page = { elementsDom: lire(() => document.getElementsByTagName('*').length), entreesRessources: lire(() => performance.getEntriesByType('resource').length) };
  out.ariane = { presente: lire(() => (window.__BANANE_V3_PAGE ? 1 : 0)), structures: null };
  /* Différence avec le collage précédent (même page, non rechargée). */
  const avant = lire(() => window.__releveMemoireCH098?.releve);
  if (avant && avant.format === out.format) {
    const d = (a, b) => (fini(a) !== null && fini(b) !== null ? Math.round((b - a) * 10) / 10 : null);
    out.difference = { secondes: d(avant.t, out.t), tasMo: d(avant.tas.utiliseMo, out.tas.utiliseMo),
      noeudsAvecGeometrie: d(avant.potree.parNuage[0]?.avecGeometrie, out.potree.parNuage[0]?.avecGeometrie), geometrieMo: d(avant.potree.parNuage[0]?.geometrieMo, out.potree.parNuage[0]?.geometrieMo),
      sceneNodes: d(avant.potree.parNuage[0]?.sceneNodes, out.potree.parNuage[0]?.sceneNodes), renduGeometries: d(avant.rendu.geometries, out.rendu.geometries), renduTextures: d(avant.rendu.textures, out.rendu.textures),
      objetsScene: d(avant.scene.objets, out.scene.objets), elementsDom: d(avant.page.elementsDom, out.page.elementsDom), lruPoints: d(avant.potree.lruPoints, out.potree.lruPoints) };
  }
  window.__releveMemoireCH098 = { releve: out };
  try { copy(JSON.stringify(out, null, 1)); } catch { /* hors console */ }
  console.log('Relevé mémoire CH-098 copié dans le presse-papiers (sinon : copy(JSON.stringify(__releveMemoireCH098.releve))).', out);
  return out;
})();
