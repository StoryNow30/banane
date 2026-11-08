/* ch065-releve-accesseur.js — RELEVÉ DES ACCESSEURS DE POINTS DE POTREE, à coller dans la console (F12) du vrai ESV, sur une coupe ouverte
 * et chargée. Sert au patch `lidar-direct` de CH-065 : la lecture directe du tampon n'y est prise que si l'attribut de position n'a
 * pas d'accesseur, ou si ses accesseurs SONT, par identité de fonction, ceux de THREE.BufferAttribute (ou InterleavedBufferAttribute)
 * de la page. Ce relevé dit lequel des deux cas est celui d'ESV, donc si le gain du patch existe chez l'opérateur.
 * LECTURE SEULE : n'appelle aucune fonction d'ESV ni de Potree, ne clique rien, ne modifie rien, ne lit ni adresse ni jeton ni coordonnée.
 * Il rend aussi le code des accesseurs de three.js (`listeBlanche`), à verser dans LISTE_BLANCHE_THREE du patch : sans cette entrée, aucun
 * accesseur d'ESV n'est reconnu et la lecture reste celle d'origine.
 * Résultat : un petit JSON copié dans le presse-papiers (sinon : copy(JSON.stringify(__releveAccesseur))), à remettre en privé. */
(() => {
  const out = { format: 'ariane-ch065-releve-accesseur-v1', quand: new Date().toISOString() };
  const T = window.THREE;
  out.three = { present: !!T, revision: T?.REVISION ?? null,
    bufferAttribute: typeof T?.BufferAttribute?.prototype?.getX === 'function',
    interleaved: typeof T?.InterleavedBufferAttribute?.prototype?.getX === 'function' };
  const protos = [['BufferAttribute', T?.BufferAttribute?.prototype], ['InterleavedBufferAttribute', T?.InterleavedBufferAttribute?.prototype]];
  /* Corps des accesseurs de three.js (bibliothèque publique, pas du code d'ESV) : à verser dans LISTE_BLANCHE_THREE du patch lidar-direct. */
  const code = f => { try { return typeof f === 'function' ? Function.prototype.toString.call(f).slice(0, 600) : null; } catch { return null; } };
  out.listeBlanche = protos.filter(([, p]) => p).map(([classe, p]) => [String(T?.REVISION ?? '?'), classe, code(p.getX), code(p.getY), code(p.getZ)]);
  const noeuds = [];
  try {
    for (const pc of (window.viewer?.scene?.pointclouds || [])) {
      const liste = pc.visibleNodes ? [...pc.visibleNodes] : [];
      for (const n of liste) {
        const o = n?.sceneNode || n, g = o?.geometry, a = g?.attributes?.position;
        if (!a) continue;
        const f = [a.getX, a.getY, a.getZ], aucun = f.every(x => typeof x !== 'function');
        const reconnu = protos.find(([, p]) => p && f[0] === p.getX && f[1] === p.getY && f[2] === p.getZ)?.[0] || null;
        const src = a.array || a.data?.array;
        noeuds.push({ classe: a.constructor?.name || null, tableau: src?.constructor?.name || null, itemSize: a.itemSize, normalise: !!a.normalized,
          entrelace: !!a.isInterleavedBufferAttribute, indexe: !!g.index, sansAccesseur: aucun, accesseurReconnu: reconnu,
          accesseurPropre: ['getX', 'getY', 'getZ'].some(k => Object.prototype.hasOwnProperty.call(a, k)) });
      }
    }
  } catch (e) { out.erreur = String(e?.message || e).slice(0, 120); }
  const compte = k => noeuds.filter(n => n[k]).length;
  out.noeuds = { total: noeuds.length, sansAccesseur: compte('sansAccesseur'), accesseurReconnu: noeuds.filter(n => n.accesseurReconnu).length,
    indexes: compte('indexe'), normalises: compte('normalise'), entrelaces: compte('entrelace'), accesseurPropre: compte('accesseurPropre'),
    classes: [...new Set(noeuds.map(n => n.classe))].slice(0, 5), tableaux: [...new Set(noeuds.map(n => n.tableau))].slice(0, 5) };
  out.lectureDirectePossible = noeuds.length ? noeuds.filter(n => (n.sansAccesseur || n.accesseurReconnu) && !n.indexe && !n.normalise &&
    /Float(32|64)Array/.test(n.tableau || '')).length + ' / ' + noeuds.length : 'aucun nœud visible';
  window.__releveAccesseur = out;
  try { copy(JSON.stringify(out, null, 1)); console.log('Relevé copié dans le presse-papiers.'); } catch { console.log(JSON.stringify(out, null, 1)); }
  return out;
})();
