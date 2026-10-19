/* Ariane 5.0 (chantier E1, idée 1 de IDEES_5.0) — MÉMOIRE DE LA LISTE DES COUPES D'ESV.
 *
 * ESV réécrit la ligne de sa liste à chaque validation (statut, drapeaux, six bords monde). Quand l'opérateur relit une
 * partie après Orbite, chaque cut qu'il corrige change ses bords : liste relue − bords écrits par Ariane = correction
 * humaine, sans séance Écho. Accord de Mic (D-122, question 1) : garder localement, par partie, les bords qu'Ariane a
 * écrits, et exporter un instantané compact de la liste.
 *
 * Ce module ne fait AUCUNE requête vers ESV et n'envoie aucune commande : il range, compare et exporte.
 *  - INSTANTANÉ : à chaque chargement complet de la liste d'une partie, une table compacte (indice = numéro de cut,
 *    statut, drapeaux, six bords monde au dixième de millimètre). Le dernier instantané de chaque partie est gardé
 *    (chrome.storage.local) et exporté dans les volumes zip d'Orbite et d'Écho (`ariane-liste-partieN-<heure>.json`).
 *  - MÉMOIRE : par partie, cut → six bords écrits par Ariane (validation 2xx pendant un lot), heure, version.
 *  - ÉCART : à chaque chargement d'une partie connue, les cuts mémorisés dont un bord diffère de plus de 1 mm de la
 *    liste donnent un événement `ecart-liste` (cut, écart par rail en mm, statut) et un compteur de partie.
 * Le panneau ne reçoit que des comptes et des millimètres ; les coordonnées restent dans l'instantané exporté.
 * Module sans dépendance : testable sous Node. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BananeListeMemoire = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const FORMAT = 'ariane-liste-instantane-1';
  const CLE_MEM = 'banane5ListeMemoire', CLE_INDEX = 'banane5ListeIndex', PRE_INST = 'banane5ListeInstantane:';
  const MAX_PARTIES = 12, MAX_CUTS = 20000, MAX_ECARTS_EVENEMENTS = 2000, SEUIL_MM = 1, SEUIL_NOUVEAU_MM = 0.5;
  /* Unité : dixième de millimètre (les bords d'ESV sont en mètres). L'observateur arrondit de la même façon avant d'envoyer. */
  const UNITE = 1e4;
  const fin = Number.isFinite;
  const dm = v => (fin(v) ? Math.round(v * UNITE) : null);
  const STATUTS = ['valid', 'invalid', 'skipped', 'autre'];
  const EDGES = ['XLeftEdge', 'YLeftEdge', 'ZLeftEdge', 'XRightEdge', 'YRightEdge', 'ZRightEdge'];

  /* Empreinte courte (FNV-1a 32 bits) : reconnaît une même liste sans garder son identifiant. */
  function empreinte(s) {
    let h = 0x811c9dc5; s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  const actif = settings => (settings === undefined ? root.BananeSettings : settings)?.listeMemoire?.actif !== false;

  /* ------------------------------------------------------------------ instantané */
  /* `t` : {st:[code], fl:[bits], ed:[6 par ligne, entiers au dixième de mm, null si absent]}. Lignes = indice de cut. */
  function compacter(t, meta) {
    const m = meta || {}, n = t.st.length, last = [null, null, null, null, null, null], r = new Array(n);
    for (let i = 0; i < n; i++) {
      const row = [((t.st[i] | 0) & 3) + 4 * ((t.fl[i] | 0) & 3)];
      for (let j = 0; j < 6; j++) {
        const v = t.ed[6 * i + j];
        if (!fin(v)) row.push(null); else { row.push(last[j] === null ? v : v - last[j]); last[j] = v; }
      }
      r[i] = row;
    }
    return { format: FORMAT, partie: Number.isInteger(m.partie) ? m.partie : null, at: m.at || null, version: m.version || null, cle: m.cle || null,
      lignes: n, sig: empreinte(JSON.stringify(r)), unite: '0,1 mm (monde, bords gauche X Y Z puis droit X Y Z)',
      lecture: 'r[i] = ligne du cut i : [statut + 4 × drapeaux, six bords]. Statut 0 valid, 1 invalid, 2 skipped, 3 autre ; drapeaux 1 TreatedByOperator, 2 SeenByOperator. Pour chaque bord, la première valeur connue est absolue, les suivantes sont l’écart à la précédente valeur connue de la même colonne ; null = absent.',
      r };
  }
  function decompacter(snap) {
    if (!snap || snap.format !== FORMAT || !Array.isArray(snap.r)) return null;
    const n = snap.r.length, st = new Array(n), fl = new Array(n), ed = new Array(6 * n), last = [null, null, null, null, null, null];
    for (let i = 0; i < n; i++) {
      const row = snap.r[i], sf = Array.isArray(row) ? row[0] | 0 : 3;
      st[i] = sf & 3; fl[i] = (sf >> 2) & 3;
      for (let j = 0; j < 6; j++) {
        const v = Array.isArray(row) ? row[1 + j] : null;
        if (!fin(v)) ed[6 * i + j] = null; else { last[j] = last[j] === null ? v : last[j] + v; ed[6 * i + j] = last[j]; }
      }
    }
    return { n, st, fl, ed, partie: snap.partie, at: snap.at, cle: snap.cle, sig: snap.sig };
  }
  const heureCompacte = iso => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '-') : 'heure-inconnue'; };
  const nomFichier = (partie, at) => `ariane-liste-partie${Number.isInteger(partie) ? partie : 'X'}-${heureCompacte(at)}.json`;

  /* ------------------------------------------------------------------ mémoire des bords écrits */
  /* Six bords d'un corps d'écriture de validation (ExtractionStatus 'valid' et les six nombres), au dixième de mm ; sinon null. */
  function bordsCorps(body) {
    if (!body || typeof body !== 'object' || body.ExtractionStatus !== 'valid') return null;
    const e = EDGES.map(k => dm(body[k]));
    return e.every(v => v !== null) ? e : null;
  }
  /* Pure : rend la mémoire avec le cut ajouté. Une liste d'identité différente pour la même partie repart de zéro. */
  function ajouter(mem, partie, cle, cut, bords, atIso, version) {
    if (!Number.isInteger(partie) || !Number.isInteger(cut) || cut < 0 || !Array.isArray(bords) || bords.length !== 6) return mem;
    const m = mem && typeof mem === 'object' ? { ...mem } : {};
    let p = m[partie];
    if (!p || p.cle !== cle) p = { cle, cuts: {}, vus: {}, passage: null };
    else p = { ...p, cuts: { ...p.cuts }, vus: { ...p.vus } };
    if (!(String(cut) in p.cuts) && Object.keys(p.cuts).length >= MAX_CUTS) return mem;
    const t = Math.floor((Date.parse(atIso) || Date.now()) / 1000);
    p.cuts[cut] = [...bords, t, typeof version === 'string' ? version.slice(0, 20) : null];
    delete p.vus[cut];
    p.maj = atIso || new Date().toISOString();
    m[partie] = p;
    const cles = Object.keys(m);
    if (cles.length > MAX_PARTIES) {
      cles.sort((a, b) => String(m[a].maj).localeCompare(String(m[b].maj)));
      for (const k of cles.slice(0, cles.length - MAX_PARTIES)) delete m[k];
    }
    return m;
  }
  const dist = (a, b, o) => Math.hypot(a[o] - b[o], a[o + 1] - b[o + 1], a[o + 2] - b[o + 2]) / (UNITE / 1000); // mm
  const arr1 = v => Math.round(v * 10) / 10;
  /* Pure : compare la mémoire d'une partie à la liste relue (`dec` = decompacter). Rend aussi la partie mise à jour (`vus`, `passage`). */
  function comparer(p, dec, atIso) {
    const ecarts = [], vus = {}; let comparees = 0, nouvelles = 0;
    if (!p || !dec || p.cle !== dec.cle) return { ecarts, comparees, nouvelles, partie: p, cleDifferente: !!p && !!dec && p.cle !== dec.cle };
    for (const k of Object.keys(p.cuts)) {
      const i = Number(k), e = p.cuts[k];
      if (!Number.isInteger(i) || i >= dec.n) continue;
      const r = dec.ed.slice(6 * i, 6 * i + 6);
      if (!r.every(v => v !== null)) continue;
      comparees++;
      const g = dist(e, r, 0), d = dist(e, r, 3);
      if (!(g > SEUIL_MM || d > SEUIL_MM)) continue;
      const prev = p.vus?.[k], nouveau = !prev || Math.abs(prev[0] - g) > SEUIL_NOUVEAU_MM || Math.abs(prev[1] - d) > SEUIL_NOUVEAU_MM;
      if (nouveau) nouvelles++;
      vus[k] = [arr1(g), arr1(d)];
      ecarts.push({ cut: i, gaucheMm: arr1(g), droiteMm: arr1(d), statut: STATUTS[dec.st[i]] || 'autre', nouveau });
    }
    ecarts.sort((a, b) => a.cut - b.cut);
    return { ecarts, comparees, nouvelles,
      partie: { ...p, vus, passage: { at: atIso || null, memorises: Object.keys(p.cuts).length, comparees, constatees: ecarts.length, nouvelles } } };
  }

  /* ------------------------------------------------------------------ stockage (chrome.storage.local) */
  let file = Promise.resolve();
  const enFile = f => { const p = file.then(f); file = p.catch(() => {}); return p; };
  async function lire(storage, cle) { try { return (await storage.get(cle))?.[cle]; } catch (_) { return undefined; } }

  /* Écriture de validation observée (2xx) pendant un lot d'Orbite. `ctx` : {partie, enLot, version, reglage?}. */
  function noterEcriture(storage, f, ctx) {
    const c = ctx || {};
    if (!actif(c.reglage) || !c.enLot || !Number.isInteger(c.partie) || !f || f.kind !== 'write') return Promise.resolve(false);
    if (!(f.status >= 200 && f.status < 300) || !Number.isInteger(f.rowIndex)) return Promise.resolve(false);
    const bords = bordsCorps(f.body); if (!bords) return Promise.resolve(false);
    const id = typeof f.railPairId === 'string' ? f.railPairId : '', k = id.lastIndexOf('/');
    if (k <= 0) return Promise.resolve(false);
    const cle = empreinte(id.slice(0, k));
    return enFile(async () => {
      const mem = await lire(storage, CLE_MEM);
      const apres = ajouter(mem, c.partie, cle, f.rowIndex, bords, new Date().toISOString(), c.version);
      if (apres !== mem) await storage.set({ [CLE_MEM]: apres });
      return apres !== mem;
    }).catch(() => false);
  }

  /* Demande la table de la page à l'onglet ESV (via le pont, mémoire de la page ; aucune requête vers ESV). */
  async function demanderTable(chromeApi, tabId, delaiMs) {
    if (tabId === null || tabId === undefined) return { ok: false, reason: 'sans-onglet' };
    let timer;
    try {
      return await Promise.race([chromeApi.tabs.sendMessage(tabId, { kind: 'liste-instantane' }),
        new Promise(r => { timer = setTimeout(() => r({ ok: false, reason: 'delai' }), delaiMs || 4000); })]);
    } catch (_) { return { ok: false, reason: 'page-sans-reponse' }; } finally { clearTimeout(timer); }
  }
  /* La table de la liste résumée : même nombre de lignes et même clé de liste ; à défaut, la seule table de ce nombre de lignes. */
  function choisirTable(tables, obs) {
    const l = (Array.isArray(tables) ? tables : []).filter(t => t && t.st && t.fl && t.ed && !t.rompue && !t.tronquee && t.debut === true && Number.isInteger(obs?.rows) && t.st.length === obs.rows);
    return l.find(t => t.key === obs.listKey) || (l.length === 1 ? l[0] : null);
  }

  /* Après un chargement complet de la liste d'une partie : instantané, comparaison, événements. Jamais bloquant. */
  async function apresChargement(o) {
    try {
      const fiche = o.fiche;
      if (!actif(o.reglage) || !fiche || !Number.isInteger(fiche.partie)) return { saute: 'inactif-ou-sans-partie' };
      const rep = await (o.demander ? o.demander() : demanderTable(o.chrome, o.tabId));
      if (!rep || rep.ok !== true) return { saute: rep?.reason || 'page' };
      const t = choisirTable(rep.tables, o.obs); if (!t) return { saute: 'sans-table' };
      const at = fiche.at || new Date().toISOString(), cle = empreinte(t.key);
      const snap = compacter(t, { partie: fiche.partie, at, version: o.version, cle });
      return await enFile(async () => {
        const st = o.storage, ancien = await lire(st, PRE_INST + fiche.partie);
        if (ancien && ancien.sig === snap.sig) return { saute: 'identique' };
        const mem = await lire(st, CLE_MEM) || {}, p = mem[fiche.partie];
        const cmp = comparer(p, decompacter(snap), at), ecrits = { [PRE_INST + fiche.partie]: snap };
        if (cmp.partie && cmp.partie !== p) ecrits[CLE_MEM] = { ...mem, [fiche.partie]: cmp.partie };
        let index = await lire(st, CLE_INDEX); index = Array.isArray(index) ? index.filter(x => x && x.partie !== fiche.partie) : [];
        index.push({ partie: fiche.partie, at }); index.sort((a, b) => String(a.at).localeCompare(String(b.at)));
        const retire = index.length > MAX_PARTIES ? index.splice(0, index.length - MAX_PARTIES) : [];
        ecrits[CLE_INDEX] = index;
        await st.set(ecrits);
        if (retire.length) await st.remove(retire.map(x => PRE_INST + x.partie));
        if (typeof o.emettre === 'function') for (const e of cmp.ecarts.slice(0, MAX_ECARTS_EVENEMENTS))
          try { await o.emettre({ type: 'ecart-liste', kind: 'ecart-liste', partie: fiche.partie, cut: e.cut, gaucheMm: e.gaucheMm, droiteMm: e.droiteMm, statut: e.statut, nouveau: e.nouveau }); } catch (_) { /* non critique */ }
        return { ok: true, lignes: snap.lignes, comparees: cmp.comparees, constatees: cmp.ecarts.length, nouvelles: cmp.nouvelles };
      });
    } catch (e) { return { saute: 'erreur', message: String(e?.message || e).slice(0, 120) }; }
  }

  /* Résumé de partie : comptes seulement (aucune coordonnée). */
  async function resume(storage, partie) {
    const mem = await lire(storage, CLE_MEM), idx = await lire(storage, CLE_INDEX), p = mem && mem[partie];
    const inst = Array.isArray(idx) ? idx.find(x => x.partie === partie) : null;
    return { partie, memorises: p ? Object.keys(p.cuts).length : 0, passage: p?.passage || null, instantaneAt: inst?.at || null };
  }
  /* Pour l'export : tous les derniers instantanés (ou ceux des `parties`) avec leur résumé. */
  async function instantanes(storage, parties) {
    const idx = await lire(storage, CLE_INDEX), out = [];
    for (const x of Array.isArray(idx) ? idx : []) {
      if (Array.isArray(parties) && parties.length && !parties.includes(x.partie)) continue;
      const snap = await lire(storage, PRE_INST + x.partie); if (snap) out.push({ snap, resume: await resume(storage, x.partie) });
    }
    return out;
  }
  async function effacer(storage) {
    const idx = await lire(storage, CLE_INDEX);
    await enFile(async () => { await storage.remove([CLE_MEM, CLE_INDEX, ...(Array.isArray(idx) ? idx.map(x => PRE_INST + x.partie) : [])]); });
    return true;
  }

  /* ------------------------------------------------------------------ texte et export (panneau) */
  function texteResume(r, snap, heure) {
    const h = heure || (iso => iso || 'heure inconnue');
    const p = r.passage, base = `Liste d’ESV relue, partie ${r.partie} · instantané du ${h(snap?.at || r.instantaneAt)} (${snap?.lignes ?? '?'} lignes)`;
    if (!r.memorises) return `${base} · aucun cut mémorisé d’Ariane pour cette partie.`;
    return `${base} · cuts d’Ariane mémorisés ${r.memorises}` + (p ? ` · comparés ${p.comparees} · corrections constatées ${p.constatees} (dont ${p.nouvelles} depuis le dernier passage)` : ' · pas encore comparés');
  }
  /* Panneau : `api` appelle le service worker. Rend le texte de CONTENU.txt et `sauver(save)` qui range les fichiers dans les volumes. */
  async function exportPanneau(api, parties, heure) {
    let r = null; try { r = await api('liste-instantanes', { parties: Array.isArray(parties) ? parties : [] }); } catch (_) { r = null; }
    const l = Array.isArray(r?.instantanes) ? r.instantanes : [];
    return { fichiers: l.length,
      texte: l.length ? `Instantanés de la liste d’ESV (${l.length}) : ${l.map(x => nomFichier(x.snap.partie, x.snap.at)).join(', ')}.\n` + l.map(x => '  ' + texteResume(x.resume, x.snap, heure)).join('\n') + '\n' : '',
      sauver: async save => { for (const x of l) await save(new Blob([JSON.stringify(x.snap)], { type: 'application/json' }), nomFichier(x.snap.partie, x.snap.at)); } };
  }

  return { FORMAT, CLE_MEM, CLE_INDEX, PRE_INST, UNITE, EDGES, SEUIL_MM, dm, empreinte, actif, compacter, decompacter, nomFichier, bordsCorps, ajouter, comparer,
    noterEcriture, demanderTable, choisirTable, apresChargement, resume, instantanes, effacer, texteResume, exportPanneau };
});
