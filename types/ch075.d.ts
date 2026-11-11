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
 interface MotifFile {file:string;alerte?:boolean;texte:string}
 interface Selecteur {status?:string;parts?:{part?:unknown}[]|null}
 interface Alerte {code:string;texte:string;detail?:string|null;at?:string|null;part?:Partie|null}
 interface Resume {traites?:number;differes?:number;ecritsPasse?:number;refus?:number}
 interface Activite {issue:string|null;ecrits?:number|null;corriges?:number|null;refusees?:number|null;faits?:number|null;mode?:string|null;apresArret?:boolean;nonRelus?:number[]}
 interface PartieFile {part:Partie;rang:number;lotId:string|null;debut:string|null;fin:string|null;motifs:{code:string;texte:string|null;detail:string|null}[];issueLot:string|null;passe:Activite|null;relecture:Activite|null;resume:Resume|null;alertes:Alerte[];interrompue?:boolean;retourLot?:{at:string|null;fait:boolean;revenuA?:string|null};retourRelecture?:{at:string|null;vers:Partie}}
 interface EtatFile {v:number;id:string;etat:string;n:number;plan:Partie[];k:number;debut:string|null;depuis:string|null;partie:PartieFile;bilan:PartieFile[];changement:{vers:Partie;tentatives:number;envoyeA:string|null};motifFin:{code:string;texte:string;detail:string|null;at:string|null}|null;alerte:Alerte|null;reprises:number;lotArgs:Brut|null}
 interface EvenementFile {type?:string;at?:string|null;selecteur?:Selecteur;courante?:Partie;n?:number;id?:string;lotArgs?:Brut;lotId?:string;part?:Partie;vers?:Partie;motif?:string;detail?:string|null;issue?:string;resume?:Resume;horsPartie?:boolean;ecritureEnSuspens?:boolean;ecrits?:number;corriges?:number;refusees?:number;faits?:number;mode?:string;nonRelus?:unknown[]}
 interface ActionFile {type:string;part?:Partie;rang?:number;vers?:Partie}
 interface ResultatFile {etat:EtatFile|null;actions:ActionFile[];ignore?:string;refus?:string}
 interface ConstatFile {ongletPresent?:boolean;ecritureEnSuspens?:boolean;detailSuspens?:string|null;lotFile?:{id?:string;rang?:number;part?:Partie}|null;partieAffichee?:Partie|null;at?:string|null}
 interface LotClos {etat?:string;stoppedAtEnd?:{issue?:string;reason?:string}|null;arretOperateur?:boolean;ecritureEnSuspens?:boolean}
 interface EntreeRegistre {fileId:string|null;part:Partie|null;rang:number|null;lotId:string|null;at:string|null;poses:Coupe[];passe:Coupe[];corriges:{cut:Coupe;ecartMm:number|null}[];valides:Coupe[]}
 interface Seuils {differesFoisMediane:number;corrigesPart:number;refus:number}
 interface LigneBrute {i?:unknown;e?:unknown;s:string;t?:unknown;v?:unknown;f?:unknown}
}
declare var BananeAppuisListe:typeof import('../src/appuis-liste.js');
declare var ArianeFilePrioritaire:typeof import('../src/file-prioritaire.js');
declare var BananeFileParties:typeof import('../src/file-parties.js');
