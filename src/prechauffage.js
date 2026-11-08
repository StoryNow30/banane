/* CH-077 (D-305, piste 3 ; étude chantiers/CH-077/etude.md, acceptée par l'intégrateur le 08/11) — PRÉCHAUFFER LE CACHE DU NAVIGATEUR POUR LA COUPE SUIVANTE.
 * Module de la PAGE d'ESV (monde principal), branché par le patch chantiers/CH-077/adapter-page.patch. ÉTEINT par défaut (`lot.chargement.prechauffer`).
 *
 * Mesuré (« Vision 3 », 08/11, ÉTABLI) : le chargement des points par ESV fait 80 % du temps de capture ; pendant les attentes un téléchargement n'est
 * en cours que 37 % du temps, avec 1 à 2 nœuds en vol. Hypothèse (PROBABLE) : Potree charge étage par étage et chaque étage attend le précédent.
 * Idée : pendant le temps mort qui suit la capture d'un cut (calcul, pose, validation), demander au navigateur les nœuds que Potree chargera pour la
 * coupe suivante, pour qu'ils soient servis par le cache HTTP du navigateur quand Potree les demandera.
 *
 * Ce que fait le module, et rien d'autre :
 *  - coupe suivante : la prochaine ligne NON VALIDÉE après le cut courant dans la table B1 que l'observateur tient déjà dans la page (« Load next non
 *    validated cut », le suivant d'ESV après une validation ; aucune requête) ; repère de la table → scène pris sur le cut courant (rails non encore
 *    posés), rigidité vérifiée (écart des deux rails < 5 cm), sinon rien ;
 *  - nœuds : ceux de l'arbre de Potree DÉJÀ CONNUS, ni chargés ni en cours, dont la boîte (repère monde, `matrixWorld`) coupe un cube de `rayonM`
 *    autour de chaque rail prédit, de niveau au plus le plus profond chargé autour du cut courant (et `profondeurMax`), du moins profond au plus profond
 *    (l'ordre de Potree), plafonnés (`noeudsMax`, `octetsMax`). Hiérarchie non lue : rien demandé (ni hiérarchie, ni données), compté (`frontiere`) ;
 *  - départ : à la fin de la capture (écart au ticket, accepté : c'est là qu'est le réseau libre), seulement si le compteur effectif de Potree vaut 0 ;
 *    rien n'est attendu par l'adaptateur (la pose ne dépend jamais du préchauffage) ;
 *  - demande : `fetch` GET à l'adresse que Potree construit lui-même (`node.url()` + extension du chargeur), même mode d'accréditation que son XHR,
 *    `cache:'default'`, `priority:'low'`, `enVolMax` à la fois ; corps lu (pour que le navigateur le garde) puis JETÉ. Aucun point n'entre dans la scène,
 *    rien n'est écrit dans Potree ni dans ESV ;
 *  - arrêt (`AbortController`) : premier chargement de Potree qui repart, changement de l'étiquette de coupe, nouvelle capture, nouvelle opération ;
 *  - identité : chaque opération porte {partie, coupe, prédite, op} ; la fin d'une demande d'une opération qui n'est plus courante ne compte rien et ne
 *    lance rien (règle 4.2 de fiches/ARCHITECTURE_CIBLE.md) ;
 *  - bilan à la capture suivante (`prechauffage-bilan`) : prédiction juste, nœuds demandés par Potree (XHR), couverts par le préchauffage, servis par le
 *    cache ; arrêt automatique pour la page après `coupesSansCache` coupes préchauffées, justes, sans un seul nœud servi par le cache (`cache-inutile`) ;
 *  - en-têtes : une fois par page, classe de la politique de cache (`prechauffage-entetes`) ; seuls Cache-Control, Expires, Last-Modified, Pragma et
 *    ETag sont lus, jamais leur valeur rapportée (nombre `maxAgeS` et booléens seulement).
 * ADRESSES : construites au moment de la demande, gardées dans la fermeture de l'opération, oubliées avec elle. Les clés de nœud (D-X-Y-Z) restent en
 * mémoire de la page pour le bilan ; aucun événement ne contient d'adresse ni de clé (essai tests/ch077-prechauffage.test.cjs qui lit tous les événements).
 * Pur : tout ce qui touche la page (horloge, images, compteur, étiquette, fetch, observateur des ressources, table B1) est passé par `env`. */
/** @template T @param {unknown} root @param {() => T} factory */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else /** @type {{BananePrechauffage?:unknown}} */ (root).BananePrechauffage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAUT = Object.freeze({ actif: false, profondeurMax: null, noeudsMax: 24, octetsMax: 8 * 1048576, enVolMax: 2, rayonM: 1.5, apresNavigation: 'annuler', coupesSansCache: 5 });
  const BORNES = { noeudsMax: [1, 200], octetsMax: [65536, 64 * 1048576], enVolMax: [1, 4], rayonM: [0.1, 10], coupesSansCache: [1, 100], profondeurMax: [0, 30] };
  const VISITES_MAX = 20000, RIGIDITE_M = 0.05, VOISINS_MS = 400, OCTETS_PAR_POINT = 32, OCTETS_NOEUD = 256 * 1024;
  const EPT_DATA = /\/ept-data\/(\d+-\d+-\d+-\d+)(\.[a-z0-9]{1,8})$/i;
  const fini = v => typeof v === 'number' && Number.isFinite(v);

  /** Réglage lu : null si éteint (seul `actif === true` allume) ; chaque valeur hors bornes reprend le défaut. */
  function reglage(r) {
    if (!r || typeof r !== 'object' || r.actif !== true) return null;
    const out = { ...DEFAUT, actif: true };
    for (const [k, [a, b]] of Object.entries(BORNES)) { const v = r[k]; if (fini(v) && v >= a && v <= b) out[k] = k === 'rayonM' ? v : Math.floor(v); }
    if (r.profondeurMax === null || r.profondeurMax === undefined) out.profondeurMax = null;
    out.apresNavigation = r.apresNavigation === 'finir' ? 'finir' : 'annuler';
    return Object.freeze(out);
  }

  /** Clé de nœud et extension lues dans le CHEMIN d'une ressource ept-data (jamais gardé : seule la clé sert, en mémoire). */
  function cleChemin(nom) {
    let chemin = ''; try { chemin = new URL(String(nom || ''), 'http://x.invalid/').pathname; } catch { chemin = String(nom || ''); }
    const m = EPT_DATA.exec(chemin); return m ? { cle: m[1], ext: m[2].toLowerCase() } : null;
  }

  /** Classe de la politique de cache d'une réponse ; `get(nom)` rend l'en-tête ou null. Cinq en-têtes lus, aucune valeur rendue. */
  function classerEntetes(get) {
    const lire = k => { try { const v = get(k); return typeof v === 'string' ? v : null; } catch { return null; } };
    const cc = (lire('Cache-Control') || '').toLowerCase(), pragma = /no-cache/i.test(lire('Pragma') || ''),
      expires = lire('Expires') !== null, lastModified = lire('Last-Modified') !== null, etag = lire('ETag') !== null;
    const m = /(?:^|[,\s])max-age\s*=\s*"?(\d+)/.exec(cc), maxAgeS = m ? Math.min(Number(m[1]), 1e9) : null;
    const classe = /no-store/.test(cc) ? 'no-store'
      : (/no-cache/.test(cc) || (!cc && pragma)) ? (etag || lastModified ? 'revalidation' : 'no-cache')
        : maxAgeS !== null ? (maxAgeS > 0 ? 'max-age' : (etag || lastModified ? 'revalidation' : 'no-cache'))
          : expires ? 'expires' : (etag || lastModified) ? 'heuristique' : 'aucun';
    return { classe, maxAgeS, etag, lastModified, expires, pragma };
  }

  const point = v => Array.isArray(v) && v.length === 3 && v.every(fini) ? v : null;
  /** Rails de la coupe suivante en repère scène (absolu, celui de `matrixWorld`), d'après la réponse B1. `rails` : positions scène relatives au repère
   * d'Ariane du cut courant, `origine` : ce repère. Rend {predite, left, right} ou {motif}. */
  function centresSuivante(rep, coupe, rails, origine) {
    if (!rep || rep.ok !== true || !Array.isArray(rep.rows)) return { motif: typeof rep?.reason === 'string' && /^[a-z-]{1,24}$/.test(rep.reason) ? rep.reason : 'sans-table' };
    const L = point(rails?.left), R = point(rails?.right), O = point(origine); if (!L || !R || !O) return { motif: 'sans-rails' };
    const bords = r => Array.isArray(r?.e) && r.e.length === 6 && r.e.every(fini) ? r.e : null;
    const cur = rep.rows.find(r => r?.i === coupe), ec = bords(cur); if (!ec) return { motif: 'sans-ligne' };
    const Tl = [0, 1, 2].map(i => ec[i] - L[i]), Tr = [0, 1, 2].map(i => ec[3 + i] - R[i]);
    if (Math.hypot(...[0, 1, 2].map(i => Tl[i] - Tr[i])) > RIGIDITE_M) return { motif: 'repere' };
    const T = [0, 1, 2].map(i => (Tl[i] + Tr[i]) / 2);
    const suiv = rep.rows.filter(r => Number.isInteger(r?.i) && r.i > coupe && r.s === 'invalid' && bords(r)).sort((a, b) => a.i - b.i)[0];
    if (!suiv) return { motif: 'sans-suivante' };
    const e = suiv.e;
    return { predite: suiv.i, left: [0, 1, 2].map(i => e[i] - T[i] + O[i]), right: [0, 1, 2].map(i => e[3 + i] - T[i] + O[i]) };
  }

  /* ------------------------------------------------ arbre de Potree (lecture seule) */
  const niveau = n => { for (const f of [() => n.level, () => n.key?.d, () => typeof n.getLevel === 'function' ? n.getLevel() : undefined]) { try { const v = f(); if (Number.isInteger(v) && v >= 0 && v <= 64) return v; } catch { /* suivant */ } } return null; };
  const nomNoeud = n => { try { const v = typeof n.filename === 'function' ? n.filename() : typeof n.key?.name === 'function' ? n.key.name() : null; return typeof v === 'string' && /^\d+-\d+-\d+-\d+$/.test(v) ? v : null; } catch { return null; } };
  const enfants = n => { const c = n?.children; if (!c) return []; return (Array.isArray(c) ? c : Object.values(c)).filter(Boolean); };
  function boiteMonde(n, M) {
    const b = n?.boundingBox; if (!b?.min || !b?.max) return null;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    }
    return lo.every(fini) && hi.every(fini) ? [lo, hi] : null;
  }
  const coupe = (bm, centres, r) => centres.some(c => [0, 1, 2].every(i => bm[0][i] <= c[i] + r && bm[1][i] >= c[i] - r));
  const distance = (bm, centres) => Math.min(...centres.map(c => Math.hypot(...[0, 1, 2].map(i => Math.max(bm[0][i] - c[i], 0, c[i] - bm[1][i])))));
  /** Parcours borné de l'arbre : `visite(noeud, niveau, boîte monde, nuage)` pour chaque nœud qui coupe la zone ; on ne descend que dans ceux-là. */
  function parcourir(pointclouds, centres, r, visite) {
    let vus = 0;
    for (const pc of pointclouds || []) {
      const racine = pc?.pcoGeometry?.root, M = pc?.matrixWorld?.elements; if (!racine || !M || M.length !== 16) continue;
      const pile = [racine];
      while (pile.length && vus < VISITES_MAX) {
        const n = pile.pop(); vus++; const bm = boiteMonde(n, M); if (!bm || !coupe(bm, centres, r)) continue;
        if (visite(n, niveau(n), bm, pc) !== false) for (const c of enfants(n)) pile.push(c);
      }
    }
    return vus;
  }
  /** Niveau le plus profond déjà chargé autour du cut courant (null si aucun). */
  function niveauLocal(pointclouds, rails, r) {
    const c = [point(rails?.left), point(rails?.right)].filter(Boolean); if (!c.length) return null;
    let max = null; parcourir(pointclouds, c, r, (n, d) => { if (n.loaded === true && d !== null && (max === null || d > max)) max = d; });
    return max;
  }
  /** Nœuds à demander pour la coupe suivante, et comptes : intersectants (connus dans la zone, niveau borné), chargés, en cours, frontière. */
  function candidats(pointclouds, rails, { niveauMax = null, rayonM = DEFAUT.rayonM } = {}) {
    const c = [point(rails?.left), point(rails?.right)].filter(Boolean), out = { intersectants: 0, charges: 0, enCours: 0, frontiere: 0, candidats: [] };
    if (!c.length) return out;
    parcourir(pointclouds, c, rayonM, (n, d, bm, pc) => {
      if (d === null || (niveauMax !== null && d > niveauMax)) return false;
      out.intersectants++;
      if (n.loaded === true) out.charges++; else if (n.loading === true) out.enCours++;
      else { const cle = nomNoeud(n); if (cle) out.candidats.push({ noeud: n, pc, cle, niveau: d, points: fini(n.numPoints) && n.numPoints > 0 ? n.numPoints : null, distance: distance(bm, c) }); else out.intersectants--; }
      if (n.numPoints === -1 || (n.hasChildren === true && !enfants(n).length)) out.frontiere++;
      return true;
    });
    out.candidats.sort((a, b) => a.niveau - b.niveau || a.distance - b.distance);
    return out;
  }
  /** Adresse que Potree construit pour ce nœud (`url()` + extension de son chargeur, ou celle apprise de ses propres requêtes). Jamais gardée. */
  function adresse(c, extApprise) {
    try {
      const n = c.noeud, l = c.pc?.pcoGeometry?.loader;
      const ext = typeof l?.extension === 'function' ? l.extension() : extApprise;
      if (typeof ext !== 'string' || !/^\.[a-z0-9]{1,8}$/i.test(ext) || typeof n.url !== 'function') return null;
      const u = n.url(); return typeof u === 'string' && u.length ? u + ext : null;
    } catch { return null; }
  }

  /* ------------------------------------------------ préchauffeur */
  function creer(env) {
    const R = reglage(env?.reglage);
    let actif = !!R, op = 0, courant = null, suivi = null, sansCache = 0, entetesFaits = false, extApprise = null, octetsParPoint = null, octetsTot = 0, pointsTot = 0;
    const poster = e => { try { env.poster(e); } catch { /* relevé seulement */ } };
    const maintenant = () => { try { const t = env.maintenant(); return fini(t) ? t : 0; } catch { return 0; } };
    const chargements = () => { try { const n = env.chargements(); return fini(n) ? n : null; } catch { return null; } };
    const etiquette = () => { try { const l = env.etiquette(); return l && Number.isInteger(l.cut) ? l : null; } catch { return null; } };

    /** Ressources vues par l'observateur de la page : seules les requêtes ept-data de Potree (pas les nôtres, `fetch`) comptent au bilan. */
    function ressources(entries) {
      for (const e of entries || []) {
        const k = cleChemin(e?.name); if (!k) continue; if (!extApprise) extApprise = k.ext;
        if (!suivi || e.initiatorType === 'fetch') continue;
        const tz = Number(e.transferSize), db = Number(e.decodedBodySize), cache = tz === 0 && db > 0;
        suivi.potree++; if (cache) suivi.cacheTotal++;
        if (suivi.cles.has(k.cle)) { suivi.couverts++; if (cache) suivi.servisCache++; }
      }
    }
    function bilan() {
      try { ressources(typeof env.relever === 'function' ? env.relever() : []); } catch { /* rien */ }
      const s = suivi; suivi = null; if (!s) return null;
      const l = etiquette(), juste = !!l && l.part === s.partie && l.cut === s.predite;
      poster({ kind: 'prechauffage-bilan', coupe: l?.cut ?? null, predite: s.predite, op: s.op, juste, demandes: s.cles.size, potree: s.potree, couverts: s.couverts, servisCache: s.servisCache, cacheTotal: s.cacheTotal });
      if (juste && s.cles.size > 0 && s.couverts > 0) { sansCache = s.servisCache > 0 ? 0 : sansCache + 1; if (actif && sansCache >= R.coupesSansCache) { actif = false; return 'cache-inutile'; } }
      return null;
    }
    function annuler(motif) {
      const c = courant; if (!c || c.fini) return;
      c.annule = true; c.motif = c.motif || motif; c.arret = true;
      for (const ctl of c.controleurs) { try { ctl.abort(); } catch { /* déjà fini */ } }
      c.controleurs.clear(); c.reveil?.();
    }
    const resume = (c, extra = {}) => ({ kind: 'prechauffage', coupe: c.coupe, predite: c.predite ?? null, op: c.op, niveauMax: c.niveauMax ?? null,
      intersectants: c.sel?.intersectants ?? 0, charges: c.sel?.charges ?? 0, enCours: c.sel?.enCours ?? 0, frontiere: c.sel?.frontiere ?? 0, candidats: c.sel?.candidats.length ?? 0,
      noeuds: c.noeuds, termines: c.termines, octets: c.octets, dureeMs: Math.round(maintenant() - c.t0), annule: c.annule, motif: c.motif || 'fini', ...extra });
    function terminer(c) {
      if (c.fini) return c.resultat; c.fini = true;
      if (c.op === op && c.predite !== undefined && c.cles.size) suivi = { op: c.op, partie: c.partie, predite: c.predite, cles: c.cles, potree: 0, couverts: 0, servisCache: 0, cacheTotal: 0 };
      const r = resume(c); const { kind, ...sans } = r; c.resultat = sans; poster(r); if (courant === c) courant = null; return sans;
    }

    async function apresCapture(ctx) {
      if (courant) annuler('remplace');
      const coupure = bilan();
      const c = { op: ++op, partie: ctx?.partie ?? null, coupe: Number.isInteger(ctx?.coupe) ? ctx.coupe : null, t0: maintenant(), controleurs: new Set(), cles: new Set(),
        noeuds: 0, termines: 0, octets: 0, enVolEst: 0, enVol: 0, annule: false, arret: false, motif: null, fini: false };
      if (coupure) { c.motif = coupure; courant = c; return terminer(c); }
      if (!actif) return { motif: 'eteint', noeuds: 0, octets: 0, annule: false };
      courant = c;
      if (chargements() !== 0) { c.motif = 'reseau-occupe'; return terminer(c); }
      let rep = null;
      try { rep = await Promise.race([Promise.resolve(env.voisins(c.coupe, { left: ctx.rails.left.map((v, i) => v + ctx.origine[i]), right: ctx.rails.right.map((v, i) => v + ctx.origine[i]) })),
        new Promise(r => { try { setTimeout(() => r({ ok: false, reason: 'page-sans-reponse' }), VOISINS_MS); } catch { r(null); } })]); } catch { rep = null; }
      if (c.arret) return terminer(c);
      const cible = centresSuivante(rep, c.coupe, ctx.rails, ctx.origine);
      if (!cible.left) { c.motif = cible.motif; return terminer(c); }
      c.predite = cible.predite;
      const courants = { left: ctx.rails.left.map((v, i) => v + ctx.origine[i]), right: ctx.rails.right.map((v, i) => v + ctx.origine[i]) };
      let nm = niveauLocal(ctx.pointclouds, courants, R.rayonM);
      if (R.profondeurMax !== null) nm = nm === null ? R.profondeurMax : Math.min(nm, R.profondeurMax);
      c.niveauMax = nm;
      c.sel = candidats(ctx.pointclouds, cible, { niveauMax: nm, rayonM: R.rayonM });
      const file = c.sel.candidats.slice(0, R.noeudsMax), resteNoeuds = c.sel.candidats.length > R.noeudsMax;
      if (!file.length) { c.motif = 'aucun-noeud'; return terminer(c); }
      const depart = etiquette();
      /* Veille, une image sur deux au plus : premier chargement de Potree, étiquette de coupe changée. */
      (async () => {
        while (!c.fini && !c.arret) {
          await new Promise(r => { c.reveil = r; Promise.resolve(env.image()).then(r, r); }); c.reveil = null;
          if (c.fini || c.arret) break;
          const l = etiquette(), n = chargements();
          if (!l || !depart || l.part !== depart.part || l.cut !== depart.cut) {
            if (R.apresNavigation === 'finir' && l && l.part === c.partie && l.cut === c.predite) { c.navigue = true; c.motif = c.motif || 'navigation'; }
            else { annuler('coupe'); break; }
          }
          if (!c.navigue && (n === null || n > 0)) { annuler('chargement'); break; }
        }
      })();
      const estime = x => x.points !== null ? x.points * (octetsParPoint ?? OCTETS_PAR_POINT) : (octetsTot && pointsTot ? octetsTot / Math.max(1, c.termines) : OCTETS_NOEUD);
      let i = 0;
      const travailleur = async () => {
        while (i < file.length) {
          if (c.arret || c.fini || courant !== c || c.navigue) return;
          const x = file[i], e = estime(x);
          if (c.octets + c.enVolEst + e > R.octetsMax) { c.motif = c.motif || 'plafond-octets'; return; }
          i++;
          const url = adresse(x, extApprise); if (!url) { c.motif = c.motif || 'sans-adresse'; continue; }
          const ctl = new env.AbortController(); c.controleurs.add(ctl); c.noeuds++; c.cles.add(x.cle); c.enVolEst += e;
          try {
            const r = await env.fetch(url, { method: 'GET', cache: 'default', credentials: 'same-origin', mode: 'cors', priority: 'low', signal: ctl.signal });
            if (courant !== c || c.arret && !c.navigue) { try { ctl.abort(); } catch { /* fini */ } continue; }
            if (!entetesFaits && r?.headers && typeof r.headers.get === 'function') { entetesFaits = true; poster({ kind: 'prechauffage-entetes', ...classerEntetes(k => r.headers.get(k)), statut: Number.isInteger(r.status) ? r.status : null }); }
            const buf = r?.ok ? await r.arrayBuffer() : null;
            /* Périmé (autre opération, annulation) : rien n'est compté. Le corps est jeté dans tous les cas. */
            if (courant === c && !(c.arret && !c.navigue) && buf) {
              const n = buf.byteLength; c.octets += n; c.termines++;
              if (x.points) { octetsTot += n; pointsTot += x.points; octetsParPoint = octetsTot / pointsTot; }
            }
          } catch { /* annulée ou en échec : rien n'est compté */ }
          finally { c.controleurs.delete(ctl); c.enVolEst -= e; }
        }
      };
      await Promise.all(Array.from({ length: Math.min(R.enVolMax, file.length) }, travailleur));
      if (!c.motif && resteNoeuds) c.motif = 'plafond-noeuds';
      c.arret = true; c.reveil?.();
      return terminer(c);
    }
    return {
      apresCapture, annuler, ressources, actif: () => actif,
      etat: () => ({ op, enCours: !!courant && !courant.fini, octets: courant ? courant.octets : 0, actif, sansCache }),
      /* Essais seulement : clés de la dernière opération finie (jamais postées). */
      _clesPourEssai: () => suivi ? [...suivi.cles] : []
    };
  }
  return { VERSION: 'prechauffage-1', DEFAUT, reglage, cleChemin, classerEntetes, centresSuivante, candidats, niveauLocal, adresse, creer };
});
