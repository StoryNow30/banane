/* CH-111 (D-345) — RELAIS DE LA TÉLÉCOMMANDE D'ARIANE (Cloudflare Worker, module ES, offre gratuite : Durable Objects SQLite).
 *
 *   GET /                    : la page du téléphone (telecommande/telephone.html).
 *   GET /canal/<id>?role=…   : WebSocket ; role=ariane (l'extension) ou role=tel (le téléphone). <id> = 32 chiffres hexadécimaux, empreinte de la
 *                              clé d'appairage (HKDF) : le relais ne connaît ni la clé ni le contenu.
 * Un Durable Object par canal : il garde le dernier état (chiffré) d'Ariane et le rend au téléphone qui arrive ; il relaie Ariane -> téléphones
 * et téléphone -> Ariane, sans rien lire. Il n'accepte que l'enveloppe {v:1, iv, d} (16 Ko au plus) et ajoute un seul message à lui, en clair :
 * {v:1, type:"presence", ariane:true|false} vers les téléphones. Aucun secret, aucune variable : rien à poser avec « wrangler secret ». */
import PAGE from './telephone.html';

const TAILLE_MAX = 16384, CANAL = /^\/canal\/([0-9a-f]{32})$/, ROLES = ['ariane', 'tel'];
const ENTETES_PAGE = {
  'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/* Enveloppe acceptée : exactement {v:1, iv, d}, chaînes base64url. Rendue réécrite (rien d'autre ne passe). */
export function enveloppe(texte) {
  if (typeof texte !== 'string' || texte.length > TAILLE_MAX) return null;
  let e; try { e = JSON.parse(texte); } catch { return null; }
  if (!e || typeof e !== 'object' || Array.isArray(e) || e.v !== 1 || Object.keys(e).length !== 3) return null;
  if (typeof e.iv !== 'string' || typeof e.d !== 'string' || !/^[A-Za-z0-9_-]{16}$/.test(e.iv) || !/^[A-Za-z0-9_-]+$/.test(e.d)) return null;
  return JSON.stringify({ v: 1, iv: e.iv, d: e.d });
}

export function route(url) {
  const u = new URL(url);
  if (u.pathname === '/' || u.pathname === '/index.html') return { page: true };
  const m = u.pathname.match(CANAL);
  if (m) { const role = u.searchParams.get('role'); return ROLES.includes(role) ? { canal: m[1], role } : { erreur: 400 }; }
  return { erreur: 404 };
}

export default {
  async fetch(req, env) {
    const r = route(req.url);
    if (r.page) return req.method === 'GET' || req.method === 'HEAD' ? new Response(PAGE, { headers: ENTETES_PAGE }) : new Response('méthode refusée', { status: 405 });
    if (r.erreur) return new Response(r.erreur === 404 ? 'introuvable' : 'rôle inconnu', { status: r.erreur });
    if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
    return env.CANAL.get(env.CANAL.idFromName(r.canal)).fetch(req);
  },
};

/* Logique du canal, sans dépendre de Cloudflare : `ctx` donne acceptWebSocket(ws, tags), getWebSockets(tag), getTags(ws), storage (get/put).
 * Le même code tourne dans l'essai local (tests/helpers/ch111-relais-local.cjs) avec un ctx fabriqué. */
export class CanalLogique {
  constructor(ctx) { this.ctx = ctx; this.dernier = null; this.ecritA = -Infinity; this.debit = new Map(); }
  async dernierEtat() { if (this.dernier === null) this.dernier = (await this.ctx.storage.get('dernier')) ?? null; return this.dernier; }
  presence() { return JSON.stringify({ v: 1, type: 'presence', ariane: this.ctx.getWebSockets('ariane').length > 0 }); }
  diffuser(tag, texte, sauf) { for (const w of this.ctx.getWebSockets(tag)) if (w !== sauf) { try { w.send(texte); } catch { /* fermée */ } } }
  async accepter(ws, role) {
    if (role === 'ariane') for (const w of this.ctx.getWebSockets('ariane')) { try { w.close(4000, 'remplacée'); } catch { /* déjà fermée */ } }
    this.ctx.acceptWebSocket(ws, [role]);
    if (role === 'tel') { ws.send(this.presence()); const d = await this.dernierEtat(); if (d) ws.send(d); }
    else this.diffuser('tel', this.presence());
  }
  /* Un téléphone : 20 messages par 10 s au plus (un ordre est un geste). Ariane : 50 par 10 s (un état par seconde, des accusés). */
  permis(ws, role, maintenant = Date.now()) {
    const max = role === 'tel' ? 20 : 50, d = this.debit.get(ws) || { depuis: maintenant, n: 0 };
    if (maintenant - d.depuis > 10000) { d.depuis = maintenant; d.n = 0; }
    d.n++; this.debit.set(ws, d); return d.n <= max;
  }
  async message(ws, texte, maintenant = Date.now()) {
    const role = this.ctx.getTags(ws)[0], e = enveloppe(typeof texte === 'string' ? texte : null);
    if (!e || !ROLES.includes(role) || !this.permis(ws, role, maintenant)) return;
    if (role === 'ariane') {
      this.dernier = e; this.diffuser('tel', e);
      /* Le dernier état est gardé en base au plus une fois par minute (écritures de l'offre gratuite) ; en mémoire sinon. */
      if (maintenant - this.ecritA > 60000) { this.ecritA = maintenant; await this.ctx.storage.put('dernier', e); }
    } else this.diffuser('ariane', e);
  }
  fermeture(ws) { this.debit.delete(ws); if (this.ctx.getTags(ws)[0] === 'ariane') this.diffuser('tel', this.presence(), ws); }
}

/* Le Durable Object (API d'hibernation : le canal dort entre deux messages sans être facturé en durée). */
export class Canal {
  constructor(ctx) { this.ctx = ctx; this.l = new CanalLogique(ctx); }
  async fetch(req) {
    const { role } = route(req.url);
    const paire = new WebSocketPair(), [client, serveur] = Object.values(paire);
    await this.l.accepter(serveur, role);
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, msg) { await this.l.message(ws, msg); }
  async webSocketClose(ws, code) { this.l.fermeture(ws); try { ws.close(code === 1005 ? 1000 : code, 'fin'); } catch { /* déjà fermée */ } }
  async webSocketError(ws) { this.l.fermeture(ws); }
}
