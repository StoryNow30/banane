/* Ariane 4.9 (V2) — vidage du « cache des exports ».
 *
 * FRONTIÈRE. Ce qu'Ariane garde pour EXPORTER (vidable, une fois exporté) :
 * les trois magasins IndexedDB `clouds` (nuages LiDAR), `events` (journal) et
 * `records` (visites) de la base « banane-test-v3 » (src/storage.js).
 * Ce qui sert à FONCTIONNER (jamais touché ici) : l'état du moteur et du lot
 * (chrome.storage.local `banane3State` : lot, cuts posés/différés, intentions,
 * résumés, compteur d'événements, records de l'état), l'onglet choisi, le
 * bandeau, les fins de parties, les réglages ; la mesure V1 en mémoire du
 * service worker ; et tout ce qui appartient à une session Écho ou Correction
 * conservée (ses visites, événements et nuages restent) ; et, depuis la 4.9.0.4, tout ce que tient la capture « avant »
 * restée ouverte sur un lot fini (voir `capturesAGarder`).
 *
 * Aucune donnée d'ESV ici : module générique, testé avec un faux stockage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.BananeExportCache = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CLE = 'banane49ExportCache';
  const LOT_TERMINE = 'STOPPED';
  /* A2 (relecture du test 3) : un lot est aussi TERMINÉ après sa fin naturelle (COMPLETED, ou
   * FINISHED_WITH_UNCONFIRMED_ACTIONS : même fin, nommée selon la confirmation serveur). Ces états ne se
   * reprennent pas et « Arrêter » y est caché : les refuser bloquait le vidage jusqu'au lot suivant. */
  const TERMINES = [LOT_TERMINE, 'COMPLETED', 'FINISHED_WITH_UNCONFIRMED_ACTIONS'];
  const COLLECTIONS_LIBRES = [undefined, null, 'IDLE', 'AFTER_CAPTURED'];
  /* 4.9.0.4 (retour de la séance du 12 octobre) : une capture « avant » peut rester OUVERTE quand un lot se termine. Le
   * service worker clôt le lot (`closeAtExit` : dernier cut différé, `stopAtLotEnd` : dernier cut posé ou non résolu, sortie
   * d'ESV pendant un cut) sans la refermer : collection READY_FOR_AFTER, puis STALE dès que l'opérateur navigue dans ESV
   * (`Engine.observe`), lidarId présent, le nuage dans IndexedDB. Le moteur ne l'archive qu'au prochain `begin()`
   * (`archivePending`, qui écrit une visite « incomplete-no-after » nommant ce nuage). */
  const CAPTURES_OUVERTES = ['BEFORE_CAPTURED', 'READY_FOR_AFTER', 'STALE'];
  /* Lot fini POUR DE BON : fin naturelle, ou arrêt à son dernier cut (`stoppedAtEnd`, posé par le service worker). Un STOPPED
   * sans `stoppedAtEnd` est un arrêt à la main : il se reprend. */
  const finiPourDeBon = b => !!b && (b.state === 'COMPLETED' || b.state === 'FINISHED_WITH_UNCONFIRMED_ACTIONS' || (b.state === LOT_TERMINE && !!b.stoppedAtEnd));
  /* Résultat d'une commande à contrôler dans ESV (état du moteur : intention, réconciliation, navigation différée non finalisée). */
  const incertain = s => !!(s.intent || s.reconcileRequired || (s.deferIntent && s.deferIntent.phase !== 'FINALIZED'));

  /* Refus lié à une capture « avant » ouverte (collection hors COLLECTIONS_LIBRES), ou null : permis. Seul un lot FINI pour de
   * bon, sans résultat incertain, laisse vider avec une capture ouverte (`capturesAGarder` en protège alors tout le contenu). */
  function refusCapture(s, b) {
    const base = 'une capture est en cours (' + s.collection + ')';
    if (!CAPTURES_OUVERTES.includes(s.collection)) return base;
    if (!b || !b.state) return base + ' : enregistre l’après ou annule la capture, puis réessaie';
    if (!finiPourDeBon(b)) return base + ' : le lot est arrêté à la main au milieu d’un cut et peut être repris. Clique sur « Reprendre » (ou lance un nouveau lot) et laisse-le aller jusqu’à sa fin, puis vide le cache';
    if (incertain(s)) return 'un résultat reste à contrôler dans ESV et une capture est ouverte (' + s.collection + ') : clique d’abord sur « Archiver le résultat interrompu », puis réessaie';
    return null;
  }

  /* Raison du refus (texte pour l'opérateur), ou null si le vidage est permis.
   * `c` : { state, busy, task, nativeActive, manualActive, timing, graceObservations }. */
  function refus(c, options) {
    const s = c.state || {}, b = s.batch;
    /* Vidage AUTOMATIQUE : un lot « STOPPED » n'est pas fini pour autant (arrêté à la
     * main, il se reprend). Seul un lot terminé pour de bon (`stoppedAtEnd`, posé à la
     * fin de la partie) ou l'absence de lot l'autorise. Le vidage manuel, lui, est
     * permis sur STOPPED, avec confirmation et avertissement (`reprenable`). */
    if (options && options.auto && b && b.state === LOT_TERMINE && !b.stoppedAtEnd) return 'le lot est arrêté mais pas terminé : il peut être repris (vidage automatique refusé)';
    if (b && b.state && !TERMINES.includes(b.state)) return 'un lot n’est pas terminé (' + b.state + ') : arrête-le ou termine-le d’abord';
    if (c.busy || c.task) return 'Ariane travaille encore (action en cours)';
    if (c.nativeActive) return 'Écho est actif';
    if (c.manualActive) return 'une session Mes corrections est active';
    if (!COLLECTIONS_LIBRES.includes(s.collection)) { const r = refusCapture(s, b); if (r) return r; }
    const t = c.timing;
    if (t && t.batch && !t.batch.closed) return 'la clôture de la mesure V1 du lot n’est pas terminée';
    if (t && t.pending && t.pending.size > 0) return 'des écritures de mesure sont encore en cours';
    /* 4.9.0.3 : grâce de réception de l'observateur (5 s après la fin du lot). Vider pendant ce temps laisserait la
     * dernière écriture arriver APRÈS l'instantané : seule dans le cache, sans son lot, au prochain export. */
    if (c.graceObservations === 'en-cours') return 'les dernières observations du lot qui vient de finir peuvent encore arriver (5 s au plus) : réessaie dans quelques secondes';
    if (c.graceObservations === 'depuis-instantane') return 'des observations du lot qui venait de finir ont pu arriver après le début de l’export (5 s au plus après sa fin) : elles ne sont pas dans cet export ; refais l’export avant de vider';
    return null;
  }

  const reprenable = c => { const b = c.state && c.state.batch; return !!(b && b.state === LOT_TERMINE && !b.stoppedAtEnd); };

  /* CE QUE TIENT LA CAPTURE « AVANT » OUVERTE (à ne jamais vider tant qu'elle est ouverte) :
   *  - son nuage LiDAR (`s.lidarId`, dans IndexedDB `clouds`) : `analyze()` et `commandLot()` le relisent (« LiDAR absent du
   *    stockage » sinon), et `archivePending()` écrira une visite qui le NOMME : sans lui, le prochain export listerait une
   *    visite dont le nuage manque ;
   *  - les événements qui le nomment (`lidarId`, `lidarCaptureId`, `captureId`) ou nomment sa proposition (`proposalId`,
   *    `proposal.id`), et ceux de la MÊME visite (`visitId` : jalons de mesure V1, observations de la page) : l'analyse du
   *    cut ne les retrouverait pas sinon ;
   *  - les visites (`records`) qui le nomment (`lidarCaptureId`) : aucune normalement, jamais supprimées si elles existent.
   * Le reste de l'état d'une capture ouverte (`before`, `proposal`, `snapshot`, `applied`) vit dans chrome.storage.local, que le
   * vidage ne touche pas. Rien n'est perdu : ces éléments restent dans le cache et partent au PROCHAIN export. Une capture
   * refermée (AFTER_CAPTURED : visite finale écrite) ou sans nuage ne retient rien : sa visite et son nuage partent ensemble.
   * `s` : état du moteur ; `events`, `records` : contenu actuel d'IndexedDB. */
  function capturesAGarder(s, events, records) {
    const vide = { clouds: [], events: [], records: [] };
    if (!s || !CAPTURES_OUVERTES.includes(s.collection) || !s.lidarId) return vide;
    const id = s.lidarId, pid = s.proposal && s.proposal.id;
    const nomme = o => !!o && (o.lidarId === id || o.lidarCaptureId === id || o.captureId === id
      || (!!o.paused && o.paused.lidarCaptureId === id)
      || (!!pid && (o.proposalId === pid || (!!o.proposal && o.proposal.id === pid) || (!!o.paused && !!o.paused.proposal && o.paused.proposal.id === pid))));
    const evs = Array.isArray(events) ? events : [];
    const visites = new Set(evs.filter(nomme).map(e => e.visitId).filter(Boolean));
    return {
      clouds: [id],
      events: evs.filter(e => nomme(e) || (!!e && !!e.visitId && visites.has(e.visitId))).map(e => e.eventId).filter(x => x !== undefined),
      records: (Array.isArray(records) ? records : []).filter(nomme).map(r => r.recordId || r.id).filter(x => x !== undefined)
    };
  }

  /* SIGNATURE d'un enregistrement (taille + empreinte FNV-1a du JSON) : prise à
   * l'instantané, contrôlée à la suppression. Un enregistrement modifié depuis
   * n'est PAS supprimé : sa nouvelle version n'est dans aucun fichier exporté. */
  function signature(objet) {
    const t = JSON.stringify(objet) || '';
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return t.length + ':' + h.toString(16);
  }
  const CLE_ID = { events: o => o.eventId, records: o => o.recordId || o.id };
  /* Identifiants de nuages (`clouds`) que nomment des visites : `lidarCaptureId`, `lidarCaptureIds`, `lidarChunkIds`. */
  function nuagesNommes(records) {
    const ids = new Set();
    for (const r of Array.isArray(records) ? records : []) {
      if (!r) continue;
      if (r.lidarCaptureId) ids.add(r.lidarCaptureId);
      for (const id of [...(Array.isArray(r.lidarCaptureIds) ? r.lidarCaptureIds : []), ...(Array.isArray(r.lidarChunkIds) ? r.lidarChunkIds : [])]) if (id) ids.add(id);
    }
    return ids;
  }

  /* Supprime exactement les clés demandées, hors `garder` (identifiants à ne pas
   * toucher, par magasin) et hors enregistrements modifiés depuis l'instantané
   * (`signatures` : { events:{id:sig}, records:{id:sig} }, OBLIGATOIRES pour events
   * et records). Les nuages sont écrits une fois (captureId unique) : sans signature.
   * Rend les comptes supprimés, `modifies` (gardés parce que modifiés) et `nuagesGardesParVisite` (nuages demandés mais gardés
   * parce qu'une visite qui reste les nomme). */
  async function supprimer(store, ids, garder, signatures) {
    const out = { events: 0, records: 0, clouds: 0, modifies: { events: [], records: [] }, nuagesGardesParVisite: [] };
    for (const nom of ['events', 'records', 'clouds']) {
      const g = new Set((garder && garder[nom]) || []);
      let liste = [...new Set(ids && ids[nom] || [])].filter(id => !g.has(id));
      if (nom !== 'clouds' && liste.length) {
        const sigs = signatures && signatures[nom];
        if (!sigs) throw Error('Instantané sans signatures : vidage refusé pour ' + nom + '.');
        if (typeof store.deleteIfUnchanged === 'function') {
          const r = await store.deleteIfUnchanged(nom, liste, sigs, signature);
          out[nom] = r.supprimes.length; out.modifies[nom] = r.gardes; continue;
        }
        const actuel = new Map();
        for (const o of await store.all(nom)) { const id = CLE_ID[nom](o); if (id !== undefined) actuel.set(id, signature(o)); }
        const gardes = liste.filter(id => actuel.has(id) && actuel.get(id) !== sigs[id]);
        out.modifies[nom] = gardes;
        const interdits = new Set(gardes);
        liste = liste.filter(id => !interdits.has(id));
      }
      /* Constat DON-1 (4.9.0.4) : intégrité visite -> nuage. Un nuage que NOMME une visite qui
       * RESTE n'est jamais supprimé. Les visites ont été traitées juste avant (supprimées si inchangées, sinon gardées) : celles qui
       * restent sont lues ICI, à l'instant de supprimer. Cas visés : visite écrite APRÈS l'instantané du panneau (capture « avant »
       * archivée, refermée ou annulée entre-temps : `archivePending` / `finish` écrivent la visite AVANT de fermer la collection) ;
       * visite de l'instantané modifiée depuis (gardée par `deleteIfUnchanged`). Sans cela le nuage partait et la visite restait,
       * nommant un nuage absent. Le nuage gardé part avec le prochain export, comme sa visite. */
      if (nom === 'clouds' && liste.length && typeof store.all === 'function') {
        const nommes = nuagesNommes(await store.all('records'));
        out.nuagesGardesParVisite = liste.filter(id => nommes.has(id));
        liste = liste.filter(id => !nommes.has(id));
      }
      if (!liste.length) continue;
      /* T3D-5 : compte rendu par le stockage (clés présentes et supprimées) ; sans compte rendu, la liste demandée. */
      if (typeof store.deleteMany === 'function') { const n = await store.deleteMany(nom, liste); out[nom] = Number.isInteger(n) ? n : liste.length; continue; }
      const f = { events: 'deleteEvent', records: 'deleteRecord', clouds: 'deleteCloud' }[nom];
      for (const id of liste) { await store[f](id); out[nom]++; }
    }
    return out;
  }

  const heure = iso => { try { return new Date(iso).toISOString(); } catch (_) { return String(iso); } };
  /* Deux textes distincts : vidage après un export confirmé, ou à la main sans export. */
  function texte(marqueur) {
    if (!marqueur || !marqueur.at) return null;
    const base = marqueur.manuel || !marqueur.afterExportAt
      ? 'données précédentes vidées manuellement le ' + heure(marqueur.at) + ', sans export confirmé par Ariane'
      : 'données précédentes vidées après export du ' + heure(marqueur.afterExportAt);
    /* 4.9.0.4 : le prochain export contiendra de nouveau le nuage de la capture ouverte (volontairement gardé). */
    const g = marqueur.captureGardee, n = g && g.nuages || 0, ev = g && g.evenements || 0, vi = g && g.visites || 0;
    if (!(n || ev || vi)) return base;
    const liste = [n ? n + (n > 1 ? ' nuages LiDAR' : ' nuage LiDAR') : '', ev ? ev + (ev > 1 ? ' événements' : ' événement') : '', vi ? vi + (vi > 1 ? ' visites' : ' visite') : ''].filter(Boolean).join(', ');
    return base + ' ; capture ouverte du dernier cut gardée (' + liste + '), qui figure de nouveau dans l’export suivant';
  }
  async function lire(storage) {
    try { return (await storage.get(CLE))?.[CLE] || null; } catch (_) { return null; }
  }
  async function ecrire(storage, marqueur) { await storage.set({ [CLE]: marqueur }); }

  /* FICHE DE DÉPART (4.9.0.10, D-092). Au démarrage d'une séance, ESV charge la liste des cuts de la partie ; l'observateur
   * passif en compte les validés et les invalides (`list-summary`). Ces chiffres sont gardés ICI, dans une clé à part de
   * chrome.storage.local : le vidage du cache ne la touche jamais (elle ne porte aucun nuage ni événement, quelques octets par
   * partie), chaque export la recopie (`fichesDepart` du bilan, CONTENU.txt) et le panneau l'affiche. */
  const CLE_DEPARTS = 'banane3FichesDepart', MAX_DEPARTS = 200;
  const entier = v => (Number.isInteger(v) && v >= 0 && v < 1e8 ? v : null);
  /* Une fiche depuis une observation `list-summary` d'avant séance ; null si la liste est vide ou sans comptes. */
  function ficheDepart(obs, ctx) {
    const c = obs && obs.kind === 'list-summary' && obs.counts && typeof obs.counts === 'object' ? obs.counts : null;
    const valides = c ? entier(c.valid) : null, invalides = c ? entier(c.invalid) : null, lignes = entier(obs && obs.rows);
    if (valides === null || invalides === null || !lignes) return null;
    /* D2 (relecture finale de la 4.9.0) : la question « y a-t-il des invalides ? » d'ESV (`projects/undefined/rails?status=invalid&top=1`,
     * une ligne au plus) n'est pas la liste de la partie : clé 'undefined' ou absente, ou moins de 2 lignes → aucune fiche. */
    const cle = obs.listKey;
    if (typeof cle !== 'string' || !cle || cle === 'undefined' || lignes < 2) return null;
    const at = typeof obs.timestamp === 'string' ? obs.timestamp : null, k = ctx || {};
    return { at, batchId: typeof k.batchId === 'string' ? k.batchId : typeof obs.batchId === 'string' ? obs.batchId : null,
      partie: entier(k.partie), version: typeof k.version === 'string' ? k.version.slice(0, 20) : null,
      valides, invalides, ignores: entier(obs.counts.skipped), total: lignes };
  }
  /* Ajoute sans doublon (même lot, mêmes comptes) et borne la liste aux plus récentes. */
  function ajouterDepart(liste, fiche) {
    const l = Array.isArray(liste) ? liste.filter(x => x && typeof x === 'object') : [];
    if (!fiche) return l;
    if (l.some(x => x.batchId === fiche.batchId && x.valides === fiche.valides && x.invalides === fiche.invalides && x.total === fiche.total)) return l;
    return [...l, fiche].slice(-MAX_DEPARTS);
  }
  const milliers = n => (Number.isInteger(n) ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') : '?');
  /* 4.9.0.17 (Mic : « l'heure de Paris partout ») : l'heure d'un départ, dans CONTENU.txt, est celle
   * de Paris (Europe/Paris, heure d'été et d'hiver par Intl) : « 15/10/2026 10:12:03 ». Le titre de la
   * liste dit « heure de Paris ». Sans Intl, l'ISO tel quel (UTC, dit par son « Z »). Le JSON exporté
   * (`fichesDepart`) garde `at` en ISO UTC. */
  let formatParis = null;
  try { formatParis = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); } catch (_) { formatParis = null; }
  function heureParis(iso) {
    const d = new Date(iso);
    if (typeof iso !== 'string' || !Number.isFinite(d.getTime())) return null;
    if (!formatParis) return iso;
    const p = {}; for (const x of formatParis.formatToParts(d)) p[x.type] = x.value;
    return `${p.day}/${p.month}/${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`;
  }
  function texteDepart(f) {
    const h = heureParis(f.at) || 'heure inconnue';
    return `${h} · partie ${Number.isInteger(f.partie) ? f.partie : '?'} · validés ${milliers(f.valides)} · invalides ${milliers(f.invalides)} · total ${milliers(f.total)}`;
  }
  async function lireDeparts(storage) {
    try { const v = (await storage.get(CLE_DEPARTS))?.[CLE_DEPARTS]; return Array.isArray(v) ? v : []; } catch (_) { return []; }
  }
  /* D2 : écritures des fiches EN FILE (lire, modifier, écrire) : deux résumés reçus ensemble ne s'écrasent plus. */
  let fileDeparts = Promise.resolve();
  function noterDepart(storage, fiche) {
    if (!fiche) return Promise.resolve(null);
    const p = fileDeparts.then(async () => {
      const avant = await lireDeparts(storage), apres = ajouterDepart(avant, fiche);
      if (apres.length !== avant.length || apres.at(-1) !== avant.at(-1)) await storage.set({ [CLE_DEPARTS]: apres });
      return fiche;
    });
    fileDeparts = p.catch(() => {});
    return p;
  }

  return { CLE, CLE_DEPARTS, ficheDepart, ajouterDepart, texteDepart, heureParis, lireDeparts, noterDepart, LOT_TERMINE, TERMINES, CAPTURES_OUVERTES, refus, reprenable, finiPourDeBon, capturesAGarder, signature, supprimer, texte, lire, ecrire };
});
