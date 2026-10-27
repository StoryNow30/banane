/* Relais du hub Ariane entre Telegram et GitHub (Cloudflare Worker, module ES).
 *
 *   GitHub -> Telegram : webhook du dépôt (événement « issue_comment »), POST /github, signé (HMAC SHA-256).
 *                        Chaque message du hub (commentaire portant « _hub Ariane ») est envoyé à l'opérateur.
 *   Telegram -> GitHub : webhook du bot, POST /telegram, jeton secret. Le message de l'opérateur devient un commentaire
 *                        de la PR du chantier, signé « operateur » ; la session Claude Code abonnée à la PR se réveille.
 *
 * Secrets (jamais dans le dépôt) : TG_BOT_TOKEN, TG_CHAT_ID, TG_WEBHOOK_SECRET, GH_TOKEN, GH_WEBHOOK_SECRET,
 * et en option ARIANE_MOTIFS_INTERDITS. Variables : GH_OWNER, GH_REPO. Protocole : hub/PROTOCOLE.md. */

const TYPES = ['ticket', 'question', 'reponse', 'rapport', 'verdict', 'alerte', 'info'];
const MOTIFS_PUBLICS = {
  courriel: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  web: /https?:\/\/[^\s"'<>)\]]+/g,
  projetESV: /Project__\d{6}|[Pp]rojet[_ ]?\d{6}_\d{6}/g,
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
};
const BLANCHE = [/^https?:\/\/(www\.)?w3\.org\//, /^https?:\/\/(www\.)?github\.com\/StoryNow30\//, /^https?:\/\/claude\.ai\//];

/* Motifs trouvés (noms seulement, jamais les valeurs). */
export function scan(texte, env = {}) {
  const trouves = [];
  for (const [nom, re] of Object.entries(MOTIFS_PUBLICS)) {
    const occ = [...texte.matchAll(re)].map(m => m[0]).filter(v => nom !== 'web' || !BLANCHE.some(w => w.test(v)));
    if (occ.length) trouves.push(nom);
  }
  const conf = (env.ARIANE_MOTIFS_INTERDITS || '').trim();
  if (conf) { try { if ([...texte.matchAll(new RegExp(conf, 'gi'))].length) trouves.push('confidentiel'); } catch { trouves.push('motif-invalide'); } }
  return trouves;
}

export function heureParis(d = new Date()) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d).replace(',', '');
}

/* Message de l'opérateur -> { chantier, type, texte } ou { erreur }.
 * Le chantier vient, dans l'ordre : de la réponse (reply) à un message du hub, d'un préfixe « CH-001 », du seul chantier ouvert. */
export function lireTelegram(texte, texteRepondu = '', chantiersOuverts = []) {
  const t = (texte || '').trim();
  if (!t) return { erreur: 'message vide' };
  const rep = (texteRepondu || '').match(/·\s*(CH-\d{3}|T\d{2}|hub)\s*·/);
  const pre = t.match(/^(CH-\d{3}|T\d{2}|hub)\b[\s:,-]*/i);
  let chantier = rep ? rep[1] : pre ? pre[1].toUpperCase().replace(/^HUB$/, 'hub') : null;
  let reste = pre ? t.slice(pre[0].length) : t;
  if (!chantier && chantiersOuverts.length === 1) chantier = chantiersOuverts[0];
  if (!chantier) return { erreur: chantiersOuverts.length ? `Quel chantier ? Réponds à un message du hub, ou commence par ${chantiersOuverts.join(' / ')}.` : 'Aucun chantier ouvert.' };
  const mt = reste.match(/^(ticket|question|reponse|rapport|alerte|info)\b[\s:,-]*/i);
  const type = mt ? mt[1].toLowerCase() : (rep ? 'reponse' : 'info');
  if (mt) reste = reste.slice(mt[0].length);
  if (!reste.trim()) return { erreur: 'message vide après le chantier' };
  return { chantier, type, texte: reste.trim() };
}

export function formaterCommentaire({ de = 'operateur', a = 'tous', type, chantier, texte, date }) {
  if (!TYPES.includes(type)) throw new Error(`type inconnu ${type}`);
  return `**[${de} → ${a}] ${type} · ${chantier} · ${heureParis(date)} Paris**\n\n${texte.trim()}\n\n---\n_hub Ariane · émetteur : ${de}_`;
}

/* Commentaire du hub -> texte Telegram (sans Markdown, borné). */
export function pourTelegram(body, urlPR) {
  const m = body.match(/^\*\*\[(.+?)\] (\w+) · (\S+) · (.+?) Paris\*\*/);
  const entete = m ? `[${m[1]}] ${m[2]} · ${m[3]} · ${m[4]}` : 'hub';
  let corps = body.replace(/^\*\*\[.*?\*\*\s*/s, '').replace(/\n---\n_hub Ariane.*$/s, '').replace(/\*\*/g, '').replace(/`/g, '').trim();
  if (corps.length > 3400) corps = corps.slice(0, 3400) + '\n[…]';
  return `${entete}\n\n${corps}\n\n${urlPR}`;
}

export function estMessageHub(body) { return /_hub Ariane ·/.test(body || ''); }
export function estEcho(body) { return /émetteur : operateur/.test(body || ''); }

async function hmacHex(secret, data) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function signatureValide(secret, corps, entete) {
  if (!secret || !entete?.startsWith('sha256=')) return false;
  const attendu = await hmacHex(secret, corps), recu = entete.slice(7);
  if (attendu.length !== recu.length) return false;
  let diff = 0; for (let i = 0; i < attendu.length; i++) diff |= attendu.charCodeAt(i) ^ recu.charCodeAt(i);
  return diff === 0;
}

const api = (env, chemin, init = {}) => fetch(`https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}${chemin}`, {
  ...init, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ariane-hub-relais', 'Content-Type': 'application/json', ...(init.headers || {}) },
});
const tg = (env, methode, corps) => fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${methode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });

async function chantiersOuverts(env) {
  const r = await api(env, '/pulls?state=open&per_page=50');
  if (!r.ok) return [];
  return (await r.json()).map(p => (p.head.ref.match(/^chantier\/(CH-\d{3})$/) || [])[1]).filter(Boolean);
}
async function prDuChantier(env, chantier) {
  const branche = chantier === 'hub' ? 'hub/journal' : `chantier/${chantier}`;
  const r = await api(env, `/pulls?state=all&per_page=30&head=${encodeURIComponent(env.GH_OWNER + ':' + branche)}`);
  if (!r.ok) return null;
  const prs = await r.json();
  return prs.find(p => p.state === 'open') || prs[0] || null;
}

async function depuisTelegram(env, update) {
  const msg = update.message || update.edited_message;
  if (!msg || String(msg.chat?.id) !== String(env.TG_CHAT_ID)) return;                  // seul l'opérateur
  const repondre = texte => tg(env, 'sendMessage', { chat_id: env.TG_CHAT_ID, text: texte, reply_to_message_id: msg.message_id });
  const texte = msg.text || '';
  if (/^\/etat\b/i.test(texte)) {
    const ouverts = await chantiersOuverts(env);
    return repondre(ouverts.length ? `Chantiers ouverts : ${ouverts.join(', ')}` : 'Aucun chantier ouvert.');
  }
  if (/^\/(start|aide|help)\b/i.test(texte)) return repondre('Hub Ariane. Réponds à un message du hub, ou écris « CH-001 ton texte ». Mots optionnels après le chantier : question, reponse, rapport, alerte, info. /etat liste les chantiers ouverts.');
  const l = lireTelegram(texte, msg.reply_to_message?.text || '', await chantiersOuverts(env));
  if (l.erreur) return repondre(l.erreur);
  const motifs = scan(l.texte, env);
  if (motifs.length) return repondre(`Refusé, motifs interdits : ${motifs.join(', ')}. Reformule sans eux.`);
  const pr = await prDuChantier(env, l.chantier);
  if (!pr) return repondre(`Aucune PR pour ${l.chantier}.`);
  const r = await api(env, `/issues/${pr.number}/comments`, { method: 'POST', body: JSON.stringify({ body: formaterCommentaire({ ...l, de: 'operateur', a: 'integrateur' }) }) });
  return repondre(r.ok ? `Envoyé sur ${l.chantier} (PR #${pr.number}), type ${l.type}.` : `Échec GitHub (${r.status}).`);
}

async function depuisGitHub(env, evenement, charge) {
  if (evenement !== 'issue_comment' || charge.action !== 'created' || !charge.issue?.pull_request) return;
  const body = charge.comment?.body || '';
  if (!estMessageHub(body) || estEcho(body)) return;                                     // pas de bavardage, pas d'écho
  await tg(env, 'sendMessage', { chat_id: env.TG_CHAT_ID, text: pourTelegram(body, charge.issue.html_url), disable_web_page_preview: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method !== 'POST') return new Response('hub Ariane', { status: 200 });
    const corps = await req.text();
    if (url.pathname === '/telegram') {
      if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TG_WEBHOOK_SECRET) return new Response('non', { status: 401 });
      await depuisTelegram(env, JSON.parse(corps));
      return new Response('ok');
    }
    if (url.pathname === '/github') {
      if (!(await signatureValide(env.GH_WEBHOOK_SECRET, corps, req.headers.get('X-Hub-Signature-256')))) return new Response('non', { status: 401 });
      await depuisGitHub(env, req.headers.get('X-GitHub-Event'), JSON.parse(corps));
      return new Response('ok');
    }
    return new Response('inconnu', { status: 404 });
  },
};
