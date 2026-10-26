/* T20a (D-243, D-246, D-250) — HISTORIQUE DES PARTIES, partie PURE (aucun DOM, aucun message, aucune commande ESV).
 *
 * Deux sources persistantes de chrome.storage.local, que le vidage du cache des exports ne touche jamais :
 *   - les fiches de départ (`banane3FichesDepart`, D-092, src/export-cache.js) : validés, invalides, ignorés, total de la partie au départ du lot ;
 *   - les FICHES DE FIN DE LOT (`banane55FinsLot`, ici) : une par lot clos, posés, différés, repris à la main, écrits par la deuxième passe, durée et
 *     motif d'arrêt. Quelques centaines d'octets par lot, bornées aux 200 plus récentes.
 * Jamais les événements du journal (vidables). L'historique (`partsHistory` de la vue du panneau) les réunit, lot par lot, plus récent d'abord ; un
 * champ inconnu vaut null. Les séances d'Écho (`echo:…`) ne sont pas des lots : elles n'y figurent pas.
 * Forme d'une entrée (contrat promis à l'interface Signal, D-250) :
 *   {part, batchId, startedAt, endedAt, version, depart:{valides, invalides, ignores, total}, cibles, poses, differes, ecritsPasse, main, sautes,
 *    fin: 'complete' | 'arretee' | 'en-cours' | 'interrompue'}
 * `cibles` : les invalides au départ, seulement pour un lot qui part du début de la partie et va jusqu'à sa fin (même règle que le panneau,
 * `travailDuLot`) ; sinon null. `poses` : cuts traités et validés par le lot (`processed`) ; `differes` : cuts différés par le lot (la deuxième passe
 * en écrit une partie, comptés à part dans `ecritsPasse`, D-238) ; `main` : cuts déclarés repris à la main ; `sautes` : cuts distincts SKIPpés pendant
 * le lot (`batch.skipped`, SKIP de l'opérateur vus par le moteur ; Ariane n'en envoie jamais), 0 si le lot n'en a vu aucun. Champ ajouté après coup : une fiche
 * de fin écrite avant lui, ou un lot sans fiche, donne null (inconnu, jamais 0). `depart.ignores` est autre chose : les cuts ignorés AU DÉPART du lot. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BananeHistoriqueParties = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CLE_FINS = 'banane55FinsLot', MAX_FINS = 200, FIN_PARTIE = 999999;
  const CLOS = ['STOPPED', 'COMPLETED', 'FINISHED_WITH_UNCONFIRMED_ACTIONS'];
  const entier = v => (Number.isInteger(v) && v >= 0 && v < 1e8 ? v : null);
  const texte = (v, n) => (typeof v === 'string' && v ? v.slice(0, n) : null);
  const iso = v => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);
  const cutDe = x => { const c = x?.cut ?? x?.identity?.cut; return Number.isInteger(c) ? c : null; };
  const distincts = l => (Array.isArray(l) ? new Set(l.map(cutDe).filter(c => c !== null)).size : 0);

  /* Fin d'un lot d'après son état (moteur) : le lot ouvert est « en-cours » ; ERROR, qui ne se reprend pas, « interrompue ». */
  function finDe(b) {
    const s = b?.state;
    if (s === 'COMPLETED' || s === 'FINISHED_WITH_UNCONFIRMED_ACTIONS') return 'complete';
    if (s === 'STOPPED') return b.stoppedAtEnd ? 'complete' : 'arretee';
    if (s === 'ERROR') return 'interrompue';
    return 'en-cours';
  }
  const finPartieDe = sc => (sc?.endMode === 'partie' || Number(sc?.end) >= FIN_PARTIE) && Number.isInteger(sc?.start) && sc.start >= 0 && sc.start <= 1;
  const comptes = b => ({ poses: distincts(b?.processed), differes: distincts(b?.deferred), main: distincts(b?.manuallyCompleted), sautes: distincts(b?.skipped) });

  /* Fiche de fin d'un lot CLOS (ou en erreur) ; null pour un lot ouvert. `o` : { version, motif, at (ISO : heure de fin si le lot ne la donne pas),
   * ecritsPasse }. */
  function ficheFin(b, o = {}) {
    if (!b || typeof b.id !== 'string' || !(CLOS.includes(b.state) || b.state === 'ERROR')) return null;
    const startedAt = iso(b.startedAt), endedAt = iso(b.stoppedAtEnd?.at) || iso(o.at) || null;
    const duree = startedAt && endedAt ? Date.parse(endedAt) - Date.parse(startedAt) : null;
    const motif = texte(o.motif, 80) || texte(b.stoppedAtEnd?.reason, 80) || texte(b.stoppedAtEnd?.issue, 80)
      || (b.state === 'ERROR' ? texte(b.error?.message, 160) || 'erreur' : b.state === 'STOPPED' ? 'arret' : 'fin-naturelle');
    return { batchId: b.id, part: entier(b.scope?.part), version: texte(o.version, 20), startedAt, endedAt, dureeMs: Number.isFinite(duree) && duree >= 0 ? duree : null,
      ...comptes(b), ecritsPasse: entier(o.ecritsPasse), fin: finDe(b), motif, etat: b.state, finPartie: finPartieDe(b.scope) };
  }
  /* Un lot = une fiche : une fiche du même lot complète la précédente (champs connus seulement) ; bornée aux plus récentes. */
  function ajouterFin(liste, fiche) {
    const l = Array.isArray(liste) ? liste.filter(x => x && typeof x === 'object' && typeof x.batchId === 'string') : [];
    if (!fiche || typeof fiche.batchId !== 'string') return l;
    const i = l.findIndex(x => x.batchId === fiche.batchId), connus = Object.fromEntries(Object.entries(fiche).filter(([, v]) => v !== undefined && v !== null));
    if (i < 0) return [...l, { ...fiche }].slice(-MAX_FINS);
    const out = l.slice(); out[i] = { ...l[i], ...connus }; return out;
  }
  async function lireFins(storage) {
    try { const v = (await storage.get(CLE_FINS))?.[CLE_FINS]; return Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []; } catch (_) { return []; }
  }
  /* Écritures EN FILE (lire, compléter, écrire) : deux fiches reçues ensemble ne s'écrasent pas. Rend la liste écrite. */
  let file = Promise.resolve();
  function noterFin(storage, fiche) {
    if (!fiche) return Promise.resolve(null);
    const p = file.then(async () => {
      const avant = await lireFins(storage), apres = ajouterFin(avant, fiche);
      if (JSON.stringify(apres) !== JSON.stringify(avant)) await storage.set({ [CLE_FINS]: apres });
      return apres;
    });
    file = p.catch(() => {});
    return p;
  }

  /* L'historique : fiches de fin, fiches de départ sans fin (lot interrompu, ou le lot en cours), et le lot en cours. Plus récent d'abord. */
  function historique({ departs, fins, courant, version } = {}) {
    const D = (Array.isArray(departs) ? departs : []).filter(x => x && typeof x.batchId === 'string' && !x.batchId.startsWith('echo:'));
    const F = new Map((Array.isArray(fins) ? fins : []).filter(x => x && typeof x.batchId === 'string').map(x => [x.batchId, x]));
    const premier = new Map();
    for (const d of D.slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))) if (!premier.has(d.batchId)) premier.set(d.batchId, d);
    const lotCourant = courant && typeof courant.id === 'string' ? courant : null;
    const ids = [...new Set([...F.keys(), ...premier.keys(), ...(lotCourant ? [lotCourant.id] : [])])];
    const depart = d => (d ? { valides: entier(d.valides), invalides: entier(d.invalides), ignores: entier(d.ignores), total: entier(d.total) } : null);
    const out = ids.map(id => {
      const f = F.get(id), d = premier.get(id), c = lotCourant?.id === id ? lotCourant : null;
      const dep = depart(d), finP = f ? f.finPartie === true : c ? finPartieDe(c.scope) : false;
      /* Le lot en cours passe devant sa fiche (une fiche écrite sur ERREUR ne dit pas la fin d'un lot qui a repris). */
      const vivant = !!c && finDe(c) === 'en-cours', n = c && (!f || vivant) ? comptes(c) : null;
      const fin = vivant ? 'en-cours' : f ? (['complete', 'arretee', 'interrompue'].includes(f.fin) ? f.fin : 'interrompue') : c ? finDe(c) : 'interrompue';
      return {
        part: entier(f?.part) ?? entier(c?.scope?.part) ?? entier(d?.partie),
        batchId: id,
        startedAt: iso(f?.startedAt) || iso(c?.startedAt) || iso(d?.at),
        endedAt: vivant ? null : iso(f?.endedAt),
        version: texte(f?.version, 20) || texte(d?.version, 20) || (c ? texte(version, 20) : null),
        depart: dep,
        cibles: finP && dep ? dep.invalides : null,
        poses: n ? n.poses : f ? entier(f.poses) : null,
        differes: n ? n.differes : f ? entier(f.differes) : null,
        ecritsPasse: f ? entier(f.ecritsPasse) : null,
        main: n ? n.main : f ? entier(f.main) : null,
        sautes: n ? n.sautes : f ? entier(f.sautes) : null,
        fin,
      };
    });
    return out.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
  }

  return { CLE_FINS, MAX_FINS, finDe, ficheFin, ajouterFin, lireFins, noterFin, historique };
});
