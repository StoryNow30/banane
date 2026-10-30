/* CH-017 (T27a ; D-244, D-245, D-247, D-248, D-261) — FILE DE PARTIES, partie PURE (aucun DOM, aucun message, aucune commande ESV).
 *
 * Une MACHINE À ÉTATS RÉDUCTRICE : `transition(etat, evenement)` rend `{etat, actions, ignore}` sans rien faire ; le service worker
 * (background.js) persiste l'état rendu AVANT d'exécuter les actions, puis observe le lot, la passe et la relecture et nourrit la machine.
 * Un redémarrage du service worker relit l'état et appelle `reprise(etat, constat)`, qui consulte le registre (écriture en suspens) avant
 * de rejouer la seule action qui a pu se perdre (départ d'un lot, changement de partie).
 *
 *   (aucune) --demarrer(N)--> lot(k=0)
 *   lot --lot-fin : continue--> passe --passe-fin--> relecture --relecture-fin--> changement --changement-ok--> lot(k+1)
 *                                                            k+1 = N --> fin (« nombre-atteint »)
 *   lot / passe / relecture --écriture en suspens--> arret « ecriture-incertaine » (ni passe, ni relecture, ni partie suivante : D-237, D-248)
 *   lot --refus propre au lot, arrêt par l'opérateur--> arret
 *   changement --60 s sans la partie, onglet fermé, ESV muet, commande absente, sélecteur sans la partie--> arret
 *   relecture non lancée, ESV sur une autre partie --> retour sur la partie du lot puis relance de la relecture (une fois, D-261)
 *   tout état actif --arreter--> arret « operateur » ; --suspens (registre)--> arret « ecriture-incertaine »
 * La passe et la relecture ne sont jamais lancées par la file : le service worker les lance déjà à la fin de chaque lot (D-238 : la passe
 * d'abord, la relecture ensuite). La file attend leur fin. D-261 : la relecture et la correction passent TOUJOURS après chaque partie ;
 * le lot démarré par la file le porte dans son scope. Jamais de SKIP ; jamais de validation : la file ne commande que « démarrer un lot »
 * et « changer de partie ».
 *
 * Tableau des motifs de fin (architecture 5.0, module P, D-248 ; à faire valider par l'opérateur) : `MOTIFS`. « continue » = état suivant ;
 * « arret » = file arrêtée avec alerte et bilan ; « fin » = file finie. Défaut de D-247 : la file continue en notant le motif, sauf
 * impossibilité technique et sauf écriture incertaine.
 *
 * REGISTRE DES ÉCRITURES par partie (`CLE_REGISTRE`, chrome.storage.local, jamais vidé par « vider le cache ») : cuts posés et validés par
 * le lot, écrits par la deuxième passe, corrigés par la relecture (écart en mm), bornés aux `MAX_REGISTRE` dernières parties.
 * ALERTE NON BLOQUANTE par partie (`alertes`) : seuils proposés par la troisième relecture, NON décidés par l'opérateur (`SEUILS`). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.BananeFileParties = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CLE_ETAT = 'banane60FileParties', CLE_REGISTRE = 'banane60RegistreFile', MAX_REGISTRE = 50, MAX_PARTIES = 20, MAX_LISTE = 2000;
  const ACTIFS = ['lot', 'passe', 'relecture', 'changement'], TERMINAUX = ['fin', 'arret'];
  /* Tentatives d'un changement de partie : la première, et une seule de plus après un redémarrage du service worker en plein changement. */
  const TENTATIVES_MAX = 2;
  const MOTIFS = Object.freeze({
    'fin-normale': { file: 'continue', texte: 'fin normale du lot' },
    'partie-sans-rouge': { file: 'continue', texte: 'partie sans cut rouge : comptée comme faite' },
    'depart-sur-vert': { file: 'continue', texte: 'départ sur un cut vert, rien à traiter devant (aucune pose écrite)' },
    'passe-arretee': { file: 'continue', texte: 'deuxième passe arrêtée sans écriture en suspens' },
    'relecture-arretee': { file: 'continue', texte: 'relecture arrêtée sans écriture en suspens' },
    'nombre-atteint': { file: 'fin', texte: 'nombre de parties atteint' },
    'operateur': { file: 'arret', texte: 'arrêtée par l’opérateur' },
    'ecriture-incertaine': { file: 'arret', alerte: true, texte: 'pose écrite non validée : contrôle le cut dans ESV' },
    'refus-lot': { file: 'arret', alerte: true, texte: 'le lot s’est arrêté sur un refus ou une anomalie' },
    'lot-non-demarre': { file: 'arret', alerte: true, texte: 'le lot de la partie n’a pas pu démarrer' },
    'changement-impossible': { file: 'arret', alerte: true, texte: 'la page d’ESV ne change pas de partie' },
    'commande-absente': { file: 'arret', alerte: true, texte: 'l’adaptateur ne sait pas changer de partie' },
    'onglet-ferme': { file: 'arret', alerte: true, texte: 'l’onglet ESV a été fermé' },
    'selecteur-illisible': { file: 'arret', alerte: true, texte: 'le sélecteur de parties d’ESV n’offre plus la partie suivante : arrêt prudent' },
    'esv-muet': { file: 'arret', alerte: true, texte: 'ESV ne répond plus' },
  });
  /* Seuils de l'alerte : valeurs initiales proposées (architecture 5.0, module P), non décidées, révisables. */
  const SEUILS = Object.freeze({ differesFoisMediane: 2, corrigesPart: 0.05, refus: 1 });

  const entier = (v, max = 1e8) => (Number.isInteger(v) && v >= 0 && v < max ? v : null);
  const texte = (v, n = 200) => (typeof v === 'string' && v ? v.slice(0, n) : null);
  const cuts = l => (Array.isArray(l) ? [...new Set(l.filter(c => entier(c) !== null))].sort((a, b) => a - b).slice(0, MAX_LISTE) : []);
  const copie = e => JSON.parse(JSON.stringify(e));
  const actif = e => !!e && ACTIFS.includes(e.etat);
  const terminal = e => !!e && TERMINAUX.includes(e.etat);

  /* Les N parties de la file : la partie affichée, puis les suivantes dans l'ordre du sélecteur d'ESV (SUPPOSÉ : « les N parties suivantes
   * de la liste d'ESV, dans son ordre », la partie affichée comptant pour la première). Refus en clair, jamais une file plus courte. */
  function planifier(selecteur, courante, n) {
    if (!Number.isInteger(n) || n < 1 || n > MAX_PARTIES) return { refus: `nombre de parties : un entier de 1 à ${MAX_PARTIES}` };
    if (!selecteur || selecteur.status !== 'ok' || !Array.isArray(selecteur.parts) || !selecteur.parts.length)
      return { refus: `sélecteur de parties d’ESV ${selecteur?.status === 'absent' ? 'absent' : 'illisible ou pas encore relevé'} : clique sur « Reconnecter »` };
    if (!Number.isInteger(courante)) return { refus: 'partie affichée par ESV illisible' };
    const liste = selecteur.parts.map(x => x?.part).filter(p => entier(p, 1e7) !== null), i = liste.indexOf(courante);
    if (i < 0) return { refus: `la partie affichée (${courante}) n’est pas dans le sélecteur d’ESV` };
    const plan = liste.slice(i, i + n);
    if (plan.length < n) return { refus: `le sélecteur d’ESV n’offre que ${plan.length} partie${plan.length > 1 ? 's' : ''} à partir de la partie ${courante}, pas ${n}` };
    return { plan };
  }

  function partieNeuve(part, rang, at) {
    return { part, rang, lotId: null, debut: at, fin: null, motifs: [], issueLot: null, passe: null, relecture: null, resume: null, alertes: [] };
  }
  function arreter(e, motif, at, detail = null) {
    const m = MOTIFS[motif] || MOTIFS['refus-lot'];
    e.etat = m.file === 'fin' ? 'fin' : 'arret';
    e.motifFin = { code: MOTIFS[motif] ? motif : 'refus-lot', texte: m.texte, detail: texte(detail, 400), at };
    e.alerte = m.alerte ? { code: e.motifFin.code, texte: m.texte, detail: e.motifFin.detail, at, part: e.partie?.part ?? null } : null;
    /* CH-026 : la partie en cours à l'arrêt n'est pas finie (ni relecture ni registre) : marquée `interrompue`, c'est d'elle que repart la reprise. */
    if (e.partie) { e.partie.fin = e.partie.fin || at; e.partie.interrompue = true; e.bilan.push(e.partie); e.partie = null; }
    e.changement = null; e.depuis = at;
    return e;
  }
  function noter(e, motif, detail) { if (e.partie) e.partie.motifs.push({ code: motif, texte: MOTIFS[motif]?.texte ?? null, detail: texte(detail, 300) }); }

  /* L'état gardé, relu (chrome.storage.local, source non fiable : relu champ par champ ; illisible = aucune file). */
  function relire(v) {
    if (!v || typeof v !== 'object' || v.v !== 1 || typeof v.id !== 'string' || ![...ACTIFS, ...TERMINAUX].includes(v.etat)) return null;
    if (!Array.isArray(v.plan) || !v.plan.length || v.plan.some(p => entier(p, 1e7) === null) || entier(v.k, MAX_PARTIES) === null || v.k >= v.plan.length) return null;
    if (!Array.isArray(v.bilan)) return null;
    return copie(v);
  }

  /* Corps de la machine. `ev.at` : l'heure (ISO), donnée par l'appelant (la machine ne lit jamais l'horloge). */
  function transition(etat, ev) {
    const at = typeof ev?.at === 'string' ? ev.at : null, ignore = raison => ({ etat, actions: [], ignore: raison });
    const type = ev?.type;
    if (type === 'demarrer') {
      if (actif(etat)) return ignore('file déjà en cours');
      const p = planifier(ev.selecteur, ev.courante, ev.n);
      if (p.refus) return { etat, actions: [], refus: p.refus };
      if (typeof ev.id !== 'string' || !ev.id) return { etat, actions: [], refus: 'identifiant de file absent' };
      const e = { v: 1, id: ev.id, etat: 'lot', n: ev.n, plan: p.plan, k: 0, debut: at, depuis: at, partie: partieNeuve(p.plan[0], 0, at), bilan: [],
        changement: null, motifFin: null, alerte: null, reprises: 0, lotArgs: ev.lotArgs && typeof ev.lotArgs === 'object' ? copie(ev.lotArgs) : null };
      return { etat: e, actions: [{ type: 'demarrer-lot', part: p.plan[0], rang: 0 }] };
    }
    if (type === 'oublier') return terminal(etat) || !etat ? { etat: null, actions: [] } : ignore('file en cours : arrête-la d’abord');
    if (!actif(etat)) return ignore('aucune file en cours');
    const e = copie(etat);
    if (type === 'arreter') { arreter(e, 'operateur', at); return { etat: e, actions: [{ type: 'arreter-activite' }] }; }
    if (type === 'onglet-ferme') { arreter(e, 'onglet-ferme', at, ev.detail); return { etat: e, actions: [{ type: 'arreter-activite' }] }; }
    /* Le registre dit qu'une écriture d'Ariane n'est pas prouvée (pose commandée non validée, correction interrompue) : arrêt, rien d'autre ne part. */
    if (type === 'suspens') { arreter(e, 'ecriture-incertaine', at, ev.detail); return { etat: e, actions: [] }; }
    switch (e.etat) {
      case 'lot':
        if (type === 'lot-demarre') {
          if (e.partie.lotId) return ignore('lot déjà noté');
          if (typeof ev.lotId !== 'string' || ev.part !== e.partie.part) return ignore('lot d’une autre partie');
          e.partie.lotId = ev.lotId; e.depuis = at; return { etat: e, actions: [] };
        }
        if (type === 'lot-refuse') { arreter(e, 'lot-non-demarre', at, ev.detail); return { etat: e, actions: [] }; }
        if (type === 'lot-fin') {
          if (!e.partie.lotId || ev.lotId !== e.partie.lotId) return ignore('fin d’un autre lot');
          e.partie.issueLot = texte(ev.issue, 60); e.partie.resume = ev.resume && typeof ev.resume === 'object' ? copie(ev.resume) : null;
          const m = MOTIFS[ev.motif];
          if (!m || ev.motif === 'nombre-atteint' || ev.motif === 'passe-arretee' || ev.motif === 'relecture-arretee') { arreter(e, 'refus-lot', at, `motif de fin de lot inconnu : ${ev.motif}`); return { etat: e, actions: [] }; }
          if (m.file === 'arret') { arreter(e, ev.motif, at, ev.detail); return { etat: e, actions: [] }; }
          noter(e, ev.motif, ev.detail); e.etat = 'passe'; e.depuis = at; return { etat: e, actions: [] };
        }
        return ignore(`événement ${type} hors de l’état lot`);
      case 'passe':
        if (type !== 'passe-fin') return ignore(`événement ${type} hors de l’état passe`);
        if (ev.lotId !== e.partie.lotId) return ignore('fin de passe d’un autre lot');
        e.partie.passe = { issue: texte(ev.issue, 40), ecrits: entier(ev.ecrits) };
        if (ev.ecritureEnSuspens) { arreter(e, 'ecriture-incertaine', at, ev.detail); return { etat: e, actions: [] }; }
        if (ev.issue === 'arretee' || ev.issue === 'erreur') noter(e, 'passe-arretee', ev.detail);
        e.etat = 'relecture'; e.depuis = at; return { etat: e, actions: [] };
      case 'relecture': {
        if (type !== 'relecture-fin') return ignore(`événement ${type} hors de l’état relecture`);
        if (ev.lotId !== e.partie.lotId) return ignore('fin de relecture d’un autre lot');
        e.partie.relecture = { issue: texte(ev.issue, 40), corriges: entier(ev.corriges), faits: entier(ev.faits), mode: texte(ev.mode, 20) };
        if (ev.ecritureEnSuspens) { arreter(e, 'ecriture-incertaine', at, ev.detail); return { etat: e, actions: [] }; }
        /* D-261 : la relecture passe toujours. Non lancée parce qu'ESV affiche une autre partie (au dernier cut, ESV charge la partie suivante) :
         * la file ramène ESV sur la partie du lot (même commande que le changement de partie) et relance la relecture, une fois. */
        if (ev.issue === 'non-lancee' && ev.horsPartie === true && !e.partie.retourRelecture) {
          e.partie.retourRelecture = { at, vers: e.partie.part }; e.partie.relecture = null; e.depuis = at;
          return { etat: e, actions: [{ type: 'retour-partie', vers: e.partie.part }] };
        }
        if (ev.issue !== 'finie') noter(e, 'relecture-arretee', ev.detail || `relecture ${ev.issue}`);
        e.partie.fin = at; e.partie.alertes = alertes(e.partie, e.bilan); e.bilan.push(e.partie); e.partie = null;
        if (e.k + 1 >= e.plan.length) { arreter(e, 'nombre-atteint', at); return { etat: e, actions: [{ type: 'registre', rang: e.k }] }; }
        e.etat = 'changement'; e.changement = { vers: e.plan[e.k + 1], tentatives: 0, envoyeA: null }; e.depuis = at;
        return { etat: e, actions: [{ type: 'registre', rang: e.k }, { type: 'changer-partie', vers: e.plan[e.k + 1] }] };
      }
      case 'changement':
        if (type === 'changement-envoye') { if (ev.vers !== e.changement.vers) return ignore('autre partie'); e.changement.tentatives++; e.changement.envoyeA = at; return { etat: e, actions: [] }; }
        if (type === 'changement-ok') {
          if (ev.part !== e.changement.vers) return ignore('partie atteinte différente de la partie demandée');
          e.k++; e.etat = 'lot'; e.changement = null; e.partie = partieNeuve(e.plan[e.k], e.k, at); e.depuis = at;
          return { etat: e, actions: [{ type: 'demarrer-lot', part: e.plan[e.k], rang: e.k }] };
        }
        if (type === 'changement-echec') { arreter(e, ['commande-absente', 'esv-muet', 'onglet-ferme', 'selecteur-illisible'].includes(ev.motif) ? ev.motif : 'changement-impossible', at, ev.detail); return { etat: e, actions: [] }; }
        return ignore(`événement ${type} hors de l’état changement`);
    }
    return ignore('état inconnu');
  }

  /* APRÈS UN REDÉMARRAGE DU SERVICE WORKER. `constat` (lu par le service worker, avant toute action) :
   *   { ongletPresent, ecritureEnSuspens, detailSuspens, lotFile: {id, rang} | null (le lot ouvert ou clos du moteur, s'il porte cette file),
   *     partieAffichee, at }
   * Rend `{etat, actions}` comme `transition`. Le registre d'abord : une écriture en suspens arrête la file avant tout départ (D-237). Le lot,
   * la passe et la relecture se reprennent d'eux-mêmes (leur propre reprise) : la file reprend seulement l'observation. Les deux actions qui ont
   * pu se perdre sont rejouées : le départ d'un lot (si le moteur n'a aucun lot de cette file à ce rang) et le changement de partie (si ESV
   * n'affiche pas déjà la partie demandée ; une tentative de plus au plus). */
  function reprise(etat, constat = {}) {
    const at = constat.at ?? null;
    if (!actif(etat)) return { etat, actions: [] };
    const e = copie(etat); e.reprises = (e.reprises || 0) + 1;
    if (constat.ongletPresent === false) { arreter(e, 'onglet-ferme', at, 'onglet absent au redémarrage du service worker'); return { etat: e, actions: [] }; }
    const enAttente = e.etat === 'lot' && !e.partie.lotId || e.etat === 'changement';
    if (enAttente && constat.ecritureEnSuspens) { arreter(e, 'ecriture-incertaine', at, constat.detailSuspens || 'écriture en suspens au redémarrage'); return { etat: e, actions: [] }; }
    if (e.etat === 'lot' && !e.partie.lotId) {
      const l = constat.lotFile;
      if (l && l.id && l.rang === e.k && l.part === e.partie.part) { e.partie.lotId = l.id; return { etat: e, actions: [] }; }
      return { etat: e, actions: [{ type: 'demarrer-lot', part: e.partie.part, rang: e.k }] };
    }
    if (e.etat === 'changement') {
      if (constat.partieAffichee === e.changement.vers) return transition(e, { type: 'changement-ok', part: e.changement.vers, at });
      if (e.changement.tentatives >= TENTATIVES_MAX) { arreter(e, 'changement-impossible', at, `partie ${e.changement.vers} non atteinte après ${e.changement.tentatives} tentatives`); return { etat: e, actions: [] }; }
      return { etat: e, actions: [{ type: 'changer-partie', vers: e.changement.vers }] };
    }
    return { etat: e, actions: [] };
  }

  /* Classement d'un lot clos, d'après ce que le service worker lit du moteur : `{etat, stoppedAtEnd, arretOperateur, ecritureEnSuspens}`.
   * Rend un motif de `MOTIFS` (ou null : lot encore ouvert, la file attend, une pause comprise : rien n'arrête la file que l'opérateur).
   * ERROR ne se reprend pas (src/historique-parties.js : « interrompue ») : lot clos en anomalie. */
  const CLOS = ['STOPPED', 'COMPLETED', 'FINISHED_WITH_UNCONFIRMED_ACTIONS', 'ERROR'];
  function classerLot(l) {
    if (!l || !CLOS.includes(l.etat)) return null;
    if (l.ecritureEnSuspens || l.etat === 'FINISHED_WITH_UNCONFIRMED_ACTIONS') return 'ecriture-incertaine';
    if (l.etat === 'COMPLETED') return 'fin-normale';
    if (l.etat === 'ERROR') return 'refus-lot';
    const issue = l.stoppedAtEnd?.issue, raison = l.stoppedAtEnd?.reason;
    if (issue === 'partie-sans-rouge' || raison === 'partie-sans-rouge') return 'partie-sans-rouge';
    if (issue === 'depart-sur-vert' || raison === 'depart-sur-vert') return 'depart-sur-vert';
    if (l.stoppedAtEnd) return 'fin-normale';
    return l.arretOperateur ? 'operateur' : 'refus-lot';
  }

  /* ---- Registre des écritures (persistant, borné). Une entrée par partie de file. */
  function entreeRegistre(x) {
    const corr = Array.isArray(x?.corriges) ? x.corriges.filter(c => entier(c?.cut) !== null).slice(0, MAX_LISTE)
      .map(c => ({ cut: c.cut, ecartMm: Number.isFinite(c.ecartMm) ? Math.round(c.ecartMm * 10) / 10 : null })) : [];
    return { fileId: texte(x?.fileId, 80), part: entier(x?.part, 1e7), rang: entier(x?.rang, MAX_PARTIES), lotId: texte(x?.lotId, 80), at: texte(x?.at, 40),
      poses: cuts(x?.poses), passe: cuts(x?.passe), corriges: corr, valides: cuts(x?.valides) };
  }
  function registreAjouter(registre, x) {
    const l = Array.isArray(registre) ? registre.filter(r => r && typeof r === 'object') : [], n = entreeRegistre(x);
    const i = l.findIndex(r => r.fileId === n.fileId && r.rang === n.rang && r.lotId === n.lotId);
    if (i >= 0) l[i] = n; else l.push(n);
    return l.slice(-MAX_REGISTRE);
  }

  /* ---- Alerte NON BLOQUANTE d'une partie : elle n'arrête rien. `partie.resume` : {traites, differes, ecritsPasse, refus} ; `partie.relecture.corriges`.
   * Différés hors cuts écrits par la passe (D-238 : l'état du lot les garde « différés ») ; médiane des parties précédentes de la file. */
  function alertes(partie, precedents = [], seuils = SEUILS) {
    const out = [], r = partie?.resume || {}, traites = entier(r.traites);
    const part = q => (traites ? q / traites : null);
    const dif = entier(r.differes) !== null ? Math.max(0, r.differes - (entier(r.ecritsPasse) || 0)) : null;
    const ratios = precedents.map(p => { const s = p?.resume || {}, t = entier(s.traites); return t && entier(s.differes) !== null ? Math.max(0, s.differes - (entier(s.ecritsPasse) || 0)) / t : null; })
      .filter(v => v !== null).sort((a, b) => a - b);
    const med = ratios.length ? (ratios.length % 2 ? ratios[(ratios.length - 1) / 2] : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2) : null;
    if (dif !== null && med !== null && med > 0 && part(dif) > seuils.differesFoisMediane * med)
      out.push({ code: 'differes', texte: `différés : ${dif} sur ${traites}, plus de ${seuils.differesFoisMediane} fois la médiane des parties précédentes` });
    const corr = entier(partie?.relecture?.corriges);
    if (corr !== null && traites && corr / traites > seuils.corrigesPart) out.push({ code: 'corriges', texte: `cuts corrigés par la relecture : ${corr} sur ${traites}, plus de ${Math.round(seuils.corrigesPart * 100)} %` });
    if (entier(r.refus) !== null && r.refus >= seuils.refus) out.push({ code: 'refus', texte: `${r.refus} refus de la page` });
    return out;
  }

  /* CH-026-c : une file arrêtée pendant qu'une activité de sa dernière partie tournait encore (la passe, la relecture : le service worker les lance
   * de lui-même) : quand cette activité finit, son issue est portée au bilan de la partie, au lieu de « relecture — » pour toujours. Rien d'autre
   * ne change (la file reste arrêtée, le motif aussi). Rend le nouvel état, ou null si rien n'est à compléter. */
  function completerBilan(e, { lotId, passe = null, relecture = null } = {}) {
    if (!e || e.etat !== 'arret' || !e.bilan.length || typeof lotId !== 'string') return null;
    const p = e.bilan[e.bilan.length - 1]; if (p.lotId !== lotId) return null;
    let change = false; const n = copie(e), q = n.bilan[n.bilan.length - 1];
    if (!q.passe && passe && typeof passe.issue === 'string') { q.passe = { issue: texte(passe.issue, 40), ecrits: entier(passe.ecrits) }; change = true; }
    if (!q.relecture && relecture && typeof relecture.issue === 'string') {
      q.relecture = { issue: texte(relecture.issue, 40), corriges: entier(relecture.corriges), faits: entier(relecture.faits), mode: texte(relecture.mode, 20), apresArret: true }; change = true; }
    return change ? n : null;
  }
  /* CH-026 : d'où repart une file ARRÊTÉE : le premier rang non fini (la partie interrompue, ou la suivante si l'arrêt est venu entre deux parties),
   * sa partie dans le plan, le nombre de parties restantes. null si la file n'est pas arrêtée ou si tout est fait. */
  function repriseDe(e) {
    if (!e || e.etat !== 'arret') return null;
    const faites = e.bilan.filter(p => !p.interrompue).length, rang = faites;
    if (rang >= e.plan.length) return null;
    return { rang, part: e.plan[rang], reste: e.plan.length - rang };
  }
  /* Vue du panneau (variante A) : quelques champs, jamais d'adresse ni d'identifiant de page. */
  function vue(e) {
    if (!e) return null;
    return { id: e.id, etat: e.etat, n: e.n, plan: e.plan.slice(), rang: e.k, enCours: e.partie ? { part: e.partie.part, rang: e.partie.rang, lot: !!e.partie.lotId } : null,
      changement: e.changement ? { vers: e.changement.vers, tentatives: e.changement.tentatives } : null,
      bilan: e.bilan.map(p => ({ part: p.part, rang: p.rang, issueLot: p.issueLot, motifs: p.motifs.map(m => m.code), resume: p.resume, passe: p.passe, relecture: p.relecture, alertes: p.alertes || [], ...(p.interrompue ? { interrompue: true } : {}) })),
      motifFin: e.motifFin, alerte: e.alerte, reprises: e.reprises || 0, reprise: repriseDe(e) };
  }

  return Object.freeze({ CLE_ETAT, CLE_REGISTRE, MAX_REGISTRE, MAX_PARTIES, TENTATIVES_MAX, MOTIFS, SEUILS, ACTIFS, TERMINAUX,
    planifier, transition, reprise, repriseDe, completerBilan, relire, classerLot, registreAjouter, entreeRegistre, alertes, vue, actif, terminal });
});
