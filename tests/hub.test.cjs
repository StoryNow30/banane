'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../tools/hub.cjs');

test('hub : un message propre passe le scan',()=>{
 assert.deepEqual(H.verifierMessage('CH-001 : outil écrit, 3 essais verts, rapport dans chantiers/CH-001.rapport.md',{}),[]);
});
test('hub : courriel, UUID et code projet ESV sont refusés, nommés sans leur valeur',()=>{
 const t=H.verifierMessage('contact a@b.fr lot 12345678-1234-1234-1234-1234567890ab Project__123456',{});
 assert.deepEqual(t.map(x=>x.motif).sort(),['courriel','projetESV','uuid']);
 assert.ok(!JSON.stringify(t).includes('a@b.fr'));
});
test('hub : une adresse web est refusée sauf la liste blanche',()=>{
 assert.equal(H.verifierMessage('voir https://exemple.invalid/page',{}).length,1);
 assert.equal(H.verifierMessage('voir https://www.w3.org/2000/svg',{}).length,0);
});
test('hub : les motifs confidentiels viennent de la variable, jamais du code',()=>{
 const env={ARIANE_MOTIFS_INTERDITS:'secretA|secretB'};
 assert.deepEqual(H.verifierMessage('rien à voir',env),[]);
 assert.deepEqual(H.verifierMessage('un SecretB ici',env),[{motif:'confidentiel',occurrences:1}]);
 assert.throws(()=>H.verifierMessage('x',{ARIANE_MOTIFS_INTERDITS:'('}),/invalide/);
});
test('hub : le message est formaté avec émetteur, type, chantier, heure de Paris et signature',()=>{
 const m=H.formater({de:'cursor',type:'rapport',chantier:'CH-001',texte:'  fait.  ',date:new Date('2026-10-27T08:05:00Z')});
 assert.match(m,/^\*\*\[cursor → tous\] rapport · CH-001 · 27\/10\/2026 09:05 Paris\*\*\n\nfait\.\n\n---\n_hub Ariane · émetteur : cursor_$/);
});
test('hub : type, émetteur et chantier sont contrôlés',()=>{
 assert.throws(()=>H.formater({de:'cursor',type:'bavardage',chantier:'CH-001',texte:'x'}),/type inconnu/);
 assert.throws(()=>H.formater({de:'inconnu',type:'info',chantier:'CH-001',texte:'x'}),/émetteur inconnu/);
 assert.throws(()=>H.formater({de:'cursor',type:'info',chantier:'truc',texte:'x'}),/chantier/);
});
test('hub : un message adressé à cursor commence par la mention qui lance son agent, pas ses propres messages', () => {
 const m=H.formater({de:'integrateur',a:'cursor',type:'ticket',chantier:'CH-001',texte:'go',date:new Date('2026-10-27T08:05:00Z')});
 assert.match(m,/^@cursor \*\*\[integrateur → cursor\] ticket · CH-001/);
 assert.doesNotMatch(H.formater({de:'cursor',a:'cursor',type:'info',chantier:'CH-001',texte:'x'}),/^@cursor/);
 assert.doesNotMatch(H.formater({de:'integrateur',a:'glm',type:'ticket',chantier:'CH-001',texte:'x'}),/@cursor/);
});
