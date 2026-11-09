'use strict';
// CH-081 (étude) : reconstitue les vues de Potree depuis le corpus et rejoue sa sélection (ortho : frustum ∩ boîte de découpe).
// Usage : node vues.cjs <dossier collection dézippée> > sortie.json   (aucune donnée versée dans banane)
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const files = require.main === module ? fs.readdirSync(dir).filter(f => /gcv1-corpus.*\.json$/.test(f)).sort() : [];
const inv4 = m => { // inverse 4x4 colonne-major
  const a = m, o = new Array(16);
  const [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = a;
  const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
    b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  const det=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
  o[0]=(a11*b11-a12*b10+a13*b09)*det;o[1]=(a02*b10-a01*b11-a03*b09)*det;o[2]=(a31*b05-a32*b04+a33*b03)*det;o[3]=(a22*b04-a21*b05-a23*b03)*det;
  o[4]=(a12*b08-a10*b11-a13*b07)*det;o[5]=(a00*b11-a02*b08+a03*b07)*det;o[6]=(a32*b02-a30*b05-a33*b01)*det;o[7]=(a20*b05-a22*b02+a23*b01)*det;
  o[8]=(a10*b10-a11*b08+a13*b06)*det;o[9]=(a01*b08-a00*b10-a03*b06)*det;o[10]=(a30*b04-a31*b02+a33*b00)*det;o[11]=(a21*b02-a20*b04-a23*b00)*det;
  o[12]=(a11*b07-a10*b09-a12*b06)*det;o[13]=(a00*b09-a01*b07+a02*b06)*det;o[14]=(a31*b01-a30*b03-a32*b00)*det;o[15]=(a20*b03-a21*b01+a22*b00)*det;
  return o;
};
const mul4 = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c*4+r] += a[k*4+r]*b[c*4+k]; return o; };
const app = (m, p) => { const w = m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]; return [0,1,2].map(i => (m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i])/w); };
// THREE.Frustum.setFromProjectionMatrix (plans normalisés)
function frustumDe(me) {
  const p = (x,y,z,w) => { const l = Math.hypot(x,y,z); return [x/l,y/l,z/l,w/l]; };
  const [m0,m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12,m13,m14,m15] = me;
  return [p(m3-m0,m7-m4,m11-m8,m15-m12),p(m3+m0,m7+m4,m11+m8,m15+m12),p(m3+m1,m7+m5,m11+m9,m15+m13),p(m3-m1,m7-m5,m11-m9,m15-m13),p(m3-m2,m7-m6,m11-m10,m15-m14),p(m3+m2,m7+m6,m11+m10,m15+m14)];
}
// THREE.Frustum.intersectsBox
const coupe = (pl, b) => pl.every(([x,y,z,w]) => (x>0?b.max[0]:b.min[0])*x+(y>0?b.max[1]:b.min[1])*y+(z>0?b.max[2]:b.min[2])*z+w >= 0);
// plans de la boîte de découpe, comme Potree_update_visibility.js (unitaire ±0.5 transformé)
function plansBoite(unitToScene) {
  const P = v => app(unitToScene, v), sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]], nrm = v => { const l = Math.hypot(...v); return v.map(x=>x/l); };
  const pl = (n, q) => [n[0],n[1],n[2],-(n[0]*q[0]+n[1]*q[1]+n[2]*q[2])];
  const out = [];
  for (const ax of [0,1,2]) { const e = [0,0,0]; e[ax] = 0.5; const pp = P(e), nn = P(e.map(x=>-x)); const n = nrm(sub(nn,pp)); out.push(pl(n,pp), pl(n.map(x=>-x),nn)); }
  return out;
}
const sortie = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const c of j.clouds || []) {
    if (!c.camera || !Array.isArray(c.nodes)) continue;
    // repère : absolu = scène relative + O (O lu sur chaque nœud : bbox.min - translation)
    let O = null;
    const vues = {};
    for (const n of c.nodes) {
      const b = n.reportedPotreeGeometryNodeBoundingBox; if (!b) continue;
      const T = n.nodeToSceneRelative.slice(12,15), o = [0,1,2].map(i => b.min[i]-T[i]);
      if (!O) O = o; else if (Math.max(...o.map((v,i)=>Math.abs(v-O[i]))) > 1e-3) O.incoherent = true;
      (vues[n.cloudIndex] ||= []).push({ min: b.min, max: b.max, pts: n.drawRange.end - n.drawRange.start });
    }
    if (!O) continue;
    const toRel = b => ({ min: b.min.map((v,i)=>v-O[i]), max: b.max.map((v,i)=>v-O[i]) });
    sortie.push({
      captureId: c.captureId, part: c.part, cut: c.cut, at: c.capturedAt, visitId: c.visitId, status: c.status,
      O, incoherent: !!O.incoherent,
      L: c.rails.left.positionSceneRelative, R: c.rails.right.positionSceneRelative,
      cam: c.camera.cameraToSceneRelative, proj: c.camera.projection, vp: c.camera.viewport,
      clip: c.clouds.map(x => x.clipping?.boxesSceneRelativeToUnit?.[0] || null),
      vues: Object.fromEntries(Object.entries(vues).map(([k,v]) => [k, v.map(b => ({...toRel(b), pts: b.pts, absMin: b.min, absMax: b.max}))])),
    });
  }
}
module.exports = { inv4, mul4, app, frustumDe, coupe, plansBoite };
if (require.main === module) process.stdout.write(JSON.stringify(sortie));
