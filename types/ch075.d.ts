/** Conventions communes ; les marques n'existent que pendant la vérification. */
declare namespace CH075 {
 type Marque<N extends string> = {readonly __unite:N};
 type Metres = number & Marque<'metres'>;
 type Millimetres = number & Marque<'millimetres'>;
 type Coupe = number & Marque<'coupe'>;
 type Partie = number & Marque<'partie'>;
 type Operation = string & Marque<'operation'>;
 type Scene = [Metres,Metres,Metres] & {readonly __repere:'scene'};
 type Monde = [Metres,Metres,Metres] & {readonly __repere:'monde'};
 type Translation = [Metres,Metres,Metres] & {readonly __repere:'translation-monde-scene'};
 type Paire<V> = {left:V;right:V};
 type Cote = keyof Paire<never>;
 interface Configuration {fenetre:number;accordMm:Millimetres;rigideMm:Millimetres;repereEcartMm:Millimetres;delaiPageMs:number;statuts:readonly string[]}
 interface Mesure {T:Translation;rigideMm:Millimetres;ok:boolean}
 interface Repere {frameId:string|null;T:Translation|null;paires:number;ecartMaxMm:Millimetres;refusees:number;etat:string}
 interface Identite {part:Partie;cut:Coupe;frameId?:string|null}
 interface Echange {identity:Identite;operationId:Operation}
 interface Ligne {i:Coupe;statut:'valid'|'invalid'|'skipped'|'autre';operateur:boolean;vu:boolean;fraiche:boolean;bords:Paire<Monde>|null}
 interface Table {lignes:number|null;pages:number|null;fraiches:number|null;debut:boolean;rompue:boolean;tronquee:boolean;tables:number|null}
 interface Geo {index:Coupe;mm:Millimetres;secondMm:Millimetres|null}
 type Reponse = {ok:false;reason:string}|{ok:true;table:Table;geo:Geo|null;rows:Ligne[]};
 interface Appui {identity:Identite;positions:Paire<Scene>;stage:string}
 interface Decision {stage?:string|null;positions?:Paire<Scene>|null;reason?:string|null;anchorsUsed?:unknown[];validatedAnchors?:unknown[]|null;guardMm?:Millimetres|null;fromPredictionMm?:Millimetres|null;gaugeMm?:Millimetres|null}
 type Compte = Record<'lignes'|'valid'|'invalid'|'skipped'|'autre'|'operateur'|'fraiches'|'sansBords',number>;
 interface Brut {[cle:string]:unknown}
 interface Taux {n:number;informatifs:number;avecTraits:number;coutS:number;p:number;parMin:number}
 interface Candidat {part:Partie;cut:Coupe;source?:string;motif?:string;score?:number}
 interface Observation {classe?:string;informatif?:boolean;avecTraits?:boolean;coutS?:number}
 interface OptionsFile {taux?:Record<string,Taux>;plancherParMin?:number;jugesDeja?:Set<string>;critere?:string;ordre?:string}
 interface EntreeFile {part:Partie;cut:Coupe;groupe:string;signaux:string[];details:Record<string,unknown>;rang:number}
 interface LigneBrute {i?:unknown;e?:unknown;s:string;t?:unknown;v?:unknown;f?:unknown}
}
declare var BananeAppuisListe:typeof import('../src/appuis-liste.js');
declare var ArianeFilePrioritaire:typeof import('../src/file-prioritaire.js');
