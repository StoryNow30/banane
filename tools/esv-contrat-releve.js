/* esv-contrat-releve.js — RELEVÉ DU CONTRAT ESV, à coller dans la console (F12) du vrai ESV, sur une coupe ouverte.
 * LECTURE SEULE : n'appelle aucune fonction d'ESV, ne clique rien, ne modifie rien, ne lit ni adresse ni jeton.
 * Résultat : un JSON copié dans le presse-papiers (sinon : copy(JSON.stringify(__releveEsv))), à remettre en privé
 * puis à passer à : node tools/esv-contrat-comparer.cjs RELEVE.json  (comparaison avec tests/esv-maquette/contrat-esv.json). */
(() => {
  const $ = id => document.getElementById(id), out = { format: 'banane-esv-releve-v1', quand: new Date().toISOString() };
  const texte = el => (el?.textContent || '').trim();
  out.libelle = { texte: texte($('O2N3DCutDescription')).slice(0, 40), format: /Cut\s+\d+\s+of\s+part\s+\d+/i.test(texte($('O2N3DCutDescription'))) ? 'Cut N of part P' : 'autre' };
  out.profil = { texte: texte($('O2N3DCutShapeInfo')).slice(0, 12) };
  const ids = ['O2N3DCutLRClick', 'O2N3DCutRRClick', 'O2N3DCutValidate3DRail', 'O2N3DCutNextInvalid3DRail'];
  out.commandes = { manquantes: ids.filter(id => !$(id)), titreValider: (($('O2N3DCutValidate3DRail')?.title || '').toLowerCase().match(/load next non[-\s]?validated cut/) || [''])[0] };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), compteurs = [], totaux = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue || '';
    if (/\btreated\b/i.test(t)) { const el = n.parentElement; compteurs.push({ balise: el?.tagName, id: el?.id || null, classes: String(el?.className || '').slice(0, 60), texte: [n.nodeValue, el?.textContent, el?.parentElement?.textContent].map(x => String(x || '').trim().slice(0, 40)) }); }
    if (/^\s*\d[\d.,   ]*\s+cuts\s*$/i.test(t)) totaux.push({ balise: n.parentElement?.tagName, id: n.parentElement?.id || null, texte: t.trim().slice(0, 20) });
  }
  const m = compteurs.map(c => c.texte.map(x => /(\d[\d.,   ]*)\s+on\s+(\d[\d.,   ]*)\s+treated/i.exec(x)).find(Boolean)).find(Boolean);
  out.compteur = { nombre: compteurs.length, elements: compteurs.slice(0, 3), traites: m ? Number(m[1].replace(/\D/g, '')) : null, total: m ? Number(m[2].replace(/\D/g, '')) : null };
  out.totalCuts = { nombre: totaux.length, elements: totaux.slice(0, 3) };
  const actif = ['O2N3DCutLRClick', 'O2N3DCutRRClick'].map(id => ({ id, classes: String($(id)?.className || ''), aria: $(id)?.getAttribute('aria-pressed') })).filter(x => x.classes || x.aria);
  out.railActif = { boutons: actif, classe: actif.map(x => x.classes).join(' ').split(/\s+/).find(c => /active|selected|pressed|on$/i.test(c)) || null };
  const nav = [...document.querySelectorAll('button,[role=button],a')].filter(el => /prev|previous|précéd|next|suivant|back|◀|▶|«|»/i.test((el.title || '') + ' ' + (el.textContent || '') + ' ' + (el.id || ''))).map(el => ({ id: el.id || null, titre: (el.title || '').slice(0, 40), texte: (el.textContent || '').trim().slice(0, 20) }));
  out.navigation = { candidats: nav.slice(0, 12) };
  try {
    const v = window.viewer, root = v?.scene?.scene, pcs = v?.scene?.pointclouds || [];
    const rails = (root?.children || []).filter(o => o.type === 'Object3D' && o.children?.some(c => c.type === 'Mesh') && o.children?.some(p => p.children?.some(c => c.type === 'Line')));
    out.scene = { rails: rails.length, enfantsRacine: (root?.children || []).map(o => o.type).slice(0, 30) };
    const pc = pcs[0], mat = pc?.material || {}, enums = window.Potree || {}, nom = (e, x) => Object.entries(e || {}).find(([, val]) => val === x)?.[0] || null;
    out.potree = { nuages: pcs.length, visibleNodesPresent: Array.isArray(pc?.visibleNodes), noeudsVisibles: pc?.visibleNodes?.length ?? null, clipBoxes: mat.clipBoxes?.length ?? null, clipTask: nom(enums.ClipTask, mat.clipTask), clipMethod: nom(enums.ClipMethod, mat.clipMethod), numNodesLoading: enums.numNodesLoading ?? null };
    const cam = v?.scene?.getActiveCamera?.(), rect = v?.renderer?.domElement?.getBoundingClientRect?.();
    out.camera = { type: cam?.type || null, projection0: cam?.projectionMatrix?.elements?.[0] ?? null, projection5: cam?.projectionMatrix?.elements?.[5] ?? null, projection10: cam?.projectionMatrix?.elements?.[10] ?? null, viewport: rect ? { largeur: Math.round(rect.width), hauteur: Math.round(rect.height) } : null };
  } catch (e) { out.scene = { erreur: String(e.message).slice(0, 80) }; }
  try { const l = typeof getEventListeners === 'function' ? getEventListeners(document) : null; out.clavier = { ecouteurs: l ? ['keydown', 'keyup', 'keypress'].reduce((n, t) => n + (l[t]?.length || 0), 0) : null, note: l ? 'getEventListeners' : 'indisponible hors console' }; } catch { out.clavier = { ecouteurs: null }; }
  window.__releveEsv = out;
  try { copy(JSON.stringify(out, null, 1)); } catch {}
  console.log('Relevé du contrat ESV copié dans le presse-papiers (sinon : copy(JSON.stringify(__releveEsv))).');
  return out;
})();
