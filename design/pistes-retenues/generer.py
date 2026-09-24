# Pistes retenues A, E, H : les trois modes de Banane (Natif, Pilote, Assisté),
# en planches .dc.html (canevas de design, animées, thème et bandeau
# basculables) et en pages statiques pour les exports PNG.
#   python3 generer.py            -> $SORTIE (défaut : dossier temporaire)
# Données fictives mais cohérentes entre elles et entre les trois pistes.
import json, re, statistics, os, tempfile
D=os.environ.get('SORTIE',os.path.join(tempfile.gettempdir(),'banane-pistes'))+'/'
R=D+'project/'; X=D+'export/'
os.makedirs(R,exist_ok=True); os.makedirs(X,exist_ok=True)

# ------------------------------------------------------------------ données communes aux trois pistes
N=40; C0=8416; END=8620; CUR=39
DIFF={5,6,19,36}; VOIE={11,12,15,20,37}; RETIRE={15:36.0}   # 8431 : 1er passage du moteur retiré par la garde, repris par la voie
def kind(i): return 'cur' if i==CUR else 'diff' if i in DIFF else 'voie' if i in VOIE else 'moteur'
def ecart(i): return None if i in DIFF or i==CUR else round(2+((i*37)%70)/10,1)
def f(v): return ('%.1f'%v).rstrip('0').rstrip('.')
def fr(v,d=1): return (('%.'+str(d)+'f')%v).replace('.',',')
def sg(v): return ('+' if v>=0 else '−')+fr(abs(v))
EC=[ecart(i) for i in range(N) if ecart(i) is not None]
MED=statistics.median(EC)
POSES=N-len(DIFF)-1; NVOIE=len(VOIE); NDIFF=len(DIFF)
COUV=round(POSES/(POSES+NDIFF)*100); TRAITES=N-1; PLAGE=END-C0+1; PROG=round(TRAITES/PLAGE*100)
def tcut(i):
    return {8:27.4,29:23.8,36:21.7,39:4.0}.get(i,round(5+((i*53)%97)/97*13,1))
TT=[tcut(i) for i in range(N-1)]
MEDT=statistics.median(TT); P90T=sorted(TT)[int(round(.9*len(TT)))-1]
VISITES=187
RAILS=[('Rail gauche','gauche',3.4,-1.2,82),('Rail droit','droit',2.1,-0.8,77)]
GAUGE=1438.2; LO,HI=1405,1470
MODES=[('native','Natif','Natif'),('automatic','Pilote','Pilote'),('assisted','Assisté','Assiste')]

def delays(s):  # style="--d: N; …" -> classe dlN (pas de propriété personnalisée en ligne)
    s=re.sub(r'class="([^"]*)"([^>]*?) style="--d: (\d+);\s*',lambda m:f'class="{(m.group(1)+" dl"+m.group(3)).strip()}"{m.group(2)} style="',s)
    s=re.sub(r'style="--n: \d+;\s*','style="',s)
    s=s.replace(' style=""','')
    assert '--d:' not in s and '--n:' not in s
    return s
def T(s):  # %%nom%% -> {{nom}} (trous du format .dc.html)
    return re.sub(r'%%(\w+)%%',r'{{\1}}',s)
SCIF_DARK='<sc-if value="%%isDark%%" hint-placeholder-val="{{ true }}">'
SCIF_LIGHT='<sc-if value="%%isLight%%" hint-placeholder-val="{{ false }}">'
def ic(path,w=1.6,size=18):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg>'
MOON_P='<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'
SUN_P='<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'
DOCK_P='<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18"/>'
DL_P='<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
def theme_icon_button(cls,size=18):
    return (f'<button class="{cls}" aria-label="%%themeLabel%%" onClick="%%toggleTheme%%">'+SCIF_DARK+ic(SUN_P,size=size)+'</sc-if>'+SCIF_LIGHT+ic(MOON_P,size=size)+'</sc-if></button>')
def dock_button(size=18):
    return f'<button class="%%dockClass%%" aria-label="Bandeau dans ESV" aria-pressed="%%dockPressed%%" onClick="%%toggleDock%%">{ic(DOCK_P,size=size)}</button>'

ANIM='''
@media (prefers-reduced-motion: no-preference){
.rise{animation:rise .5s cubic-bezier(.2,0,0,1) both}
.fill{transform-origin:0 50%;animation:fill 1.2s cubic-bezier(.2,0,0,1) .3s both}
.draw{stroke-dasharray:1;animation:draw 1.6s cubic-bezier(.2,0,0,1) .4s both}
.fade{animation:fade .9s ease-out .8s both}
.grow{transform-box:fill-box;transform-origin:50% 100%;animation:grow .5s cubic-bezier(.2,0,0,1) both}
.pop{transform-box:fill-box;transform-origin:50% 50%;animation:pop .45s cubic-bezier(.2,0,0,1) .8s both}
.blink{animation:blink 1.8s ease-in-out infinite}
.live::after{content:"";position:absolute;inset:0;border-radius:inherit;background:inherit;animation:ring 2.4s ease-out infinite}
.flip{display:inline-block;animation:flip .55s cubic-bezier(.2,0,0,1) .15s both}
.seq{animation:seq .35s ease-out .6s both}
.count{animation:count 1.3s cubic-bezier(.2,0,0,1) .2s both}
'''+''.join(f'.rise.dl{k}{{animation-delay:{k*70}ms}}.flip.dl{k}{{animation-delay:{k*70+150}ms}}.seq.dl{k}{{animation-delay:{k*400+600}ms}}' for k in range(16))+'''
}
.live{position:relative}
@property --n{syntax:"<integer>";inherits:false;initial-value:0}
.count{--n:'''+str(VISITES)+''';counter-reset:n var(--n)}.count::after{content:counter(n)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
@keyframes fill{from{transform:scaleX(0)}}
@keyframes draw{from{stroke-dashoffset:1}}
@keyframes fade{from{opacity:0}}
@keyframes grow{from{transform:scaleY(0)}}
@keyframes pop{from{opacity:0;transform:scale(.3)}}
@keyframes blink{50%{opacity:.3}}
@keyframes ring{from{opacity:.5;transform:scale(1)}to{opacity:0;transform:scale(2.8)}}
@keyframes flip{from{opacity:0;transform:perspective(240px) rotateX(-90deg)}}
@keyframes seq{from{opacity:.12}}
@keyframes count{from{--n:0}}
button,a{-webkit-tap-highlight-color:transparent}
.btn{transition:filter .15s ease}.btn:hover{filter:brightness(1.07)}.btn:active{transform:translateY(1px)}
.export *,.export *::before,.export *::after{animation:none!important;transition:none!important}
'''

def logic(root):
    return '''class Component extends DCLogic {
constructor(props) { super(props); this.state = { light: false, dock: true }; }
renderVals() {
const light = this.state.light, dock = this.state.dock, theme = (v) => () => this.setState({ light: v });
return { themeClass: light ? '%s light' : '%s', isLight: light, isDark: !light, themeLabel: light ? 'Passer en sombre' : 'Passer en clair',
toggleTheme: () => this.setState({ light: !light }), setDark: theme(false), setLight: theme(true),
segDark: light ? 'seg' : 'seg on', segLight: light ? 'seg on' : 'seg', darkPressed: light ? 'false' : 'true', lightPressed: light ? 'true' : 'false',
swClass: dock ? 'sw on' : 'sw', dockClass: dock ? 'ib on' : 'ib', dockPressed: dock ? 'true' : 'false', toggleDock: () => this.setState({ dock: !dock }) };
}
}''' % (root,root)
STATIC=dict(segDark='seg on',segLight='seg',darkPressed='true',lightPressed='false',swClass='sw on',dockClass='ib on',dockPressed='true',themeLabel='Passer en clair')
def static(body,root):
    s=re.sub(r'\s+onClick="%%\w+%%"','',body)
    s=re.sub(re.escape(SCIF_LIGHT)+r'.*?</sc-if>','',s,flags=re.S)
    s=re.sub(re.escape(SCIF_DARK)+r'(.*?)</sc-if>',r'\1',s,flags=re.S)
    vals=dict(STATIC,themeClass=root)
    s=re.sub(r'%%(\w+)%%',lambda m:vals[m.group(1)],s)
    assert '%%' not in s and '{{' not in s and 'sc-if' not in s, s[:200]
    return s
def dc_page(title,fonts,css,body,root):
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&amp;display=swap">
<style>
body{{margin:0}}
{css}
{ANIM}
</style>
</helmet>
{T(body)}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":420,"height":880}}}}'>
{logic(root)}
</script>
</body>
</html>
'''
def export_page(title,L,css,body,root):
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="fonts/{L}.css">
<style>
body{{margin:0}}
{css}
{ANIM}
</style>
</head>
<body class="export">
{static(body,root)}
</body>
</html>
'''

# ================================================================== A · TCO, poste de commande
A_FONTS='family=Barlow+Condensed:wght@500;600;700&amp;family=JetBrains+Mono:wght@400;600'
A_CSS='''.a{--bg:#0f1417;--bar:#0c1114;--panel:#0a0e11;--line:#1f2830;--line2:#26313a;--text:#eef2f4;--mut:#8b98a3;--dim:#6d7a84;--green:#34c98a;--greenS:#57d9a3;--greenL:#b9f0d7;--amber:#f2a93b;--red:#ff6b57;--redT:#ff8a78;--redB:#6b2a22;--cur:#f4f6f7;--fut:#1b232a;--band:#16312a;--bandL:#2f6e5b;--bandT:#6f8f85;--tabBg:#12181d;--tabOn:#1b252c;--tabOnB:#3a4852;--tabOnT:#eef2f4;--ok:#7fe0b4;--halo:rgba(52,201,138,.18);--knob:#0f1417;--goT:#06140e;--pauseT:#1b1406;background:var(--bg);color:var(--text)}
.a.light{--bg:#eef1f3;--bar:#e4e8eb;--panel:#ffffff;--line:#cfd6db;--line2:#c3ccd2;--text:#0f1720;--mut:#4f5b66;--dim:#5b6770;--green:#178a5a;--greenS:#178a5a;--greenL:#0f6b45;--amber:#c7780a;--red:#cc2f1f;--redT:#b3261a;--redB:#e0a39b;--cur:#0f1720;--fut:#d5dbe0;--band:#dcefe6;--bandL:#6aa88c;--bandT:#3f6f5a;--tabBg:#ffffff;--tabOn:#0f1720;--tabOnB:#0f1720;--tabOnT:#eef1f3;--ok:#0f6b45;--halo:rgba(23,138,90,.16);--knob:#ffffff;--goT:#ffffff;--pauseT:#1b1406}
.a{font-family:"Barlow Condensed",sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.a .mono{font-family:"JetBrains Mono",monospace}
.a .lbl{font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:var(--mut)}
.a .card{display:flex;align-items:flex-end;justify-content:space-between;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 18px}
.a .big{font-family:"JetBrains Mono",monospace;font-weight:600;font-size:56px;line-height:1;letter-spacing:-.02em}
.a .tile{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.a.light .tile{background:var(--panel)}
.a .tile .v{font-family:"JetBrains Mono",monospace;font-size:24px;font-weight:600}
.a .tile .s{font-size:12.5px;color:var(--mut);letter-spacing:.02em}
.a .tab{display:inline-flex;align-items:center;text-decoration:none;border:1px solid var(--line2);background:var(--tabBg);color:var(--mut);font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:12px;padding:0 12px;height:30px;border-radius:6px}
.a .tab.on{border-color:var(--tabOnB);background:var(--tabOn);color:var(--tabOnT)}
.a .segs{display:flex;padding:3px;border:1px solid var(--line2);border-radius:8px;background:var(--tabBg)}
.a .seg{appearance:none;display:flex;align-items:center;justify-content:center;gap:6px;height:30px;width:34px;padding:0;border:0;border-radius:5px;font-family:inherit;font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:11.5px;background:transparent;color:var(--mut);cursor:pointer}
.a .seg.on{background:var(--tabOn);color:var(--tabOnT)}
.a .sw{appearance:none;display:flex;align-items:center;gap:8px;height:38px;padding:0 10px 0 8px;border:1px solid var(--line2);border-radius:8px;background:var(--tabBg);color:var(--text);font-family:inherit;font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:11.5px;cursor:pointer}
.a .sw .tr{width:28px;height:16px;border-radius:8px;background:var(--line2);display:flex;align-items:center;justify-content:flex-start;padding:2px;box-sizing:border-box}
.a .sw.on .tr{background:var(--green);justify-content:flex-end}
.a .sw .kn{width:12px;height:12px;border-radius:50%;background:var(--knob)}
.a .lamp{display:flex;align-items:center;gap:7px;color:var(--dim)}
.a .lamp i{width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:1.5px dotted var(--dim)}
.a .lamp.on{color:var(--text)}.a .lamp.on i{border:0;background:var(--text)}
.a .dot{display:block;width:12px;height:12px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px var(--halo)}
.a .btn{appearance:none;height:48px;padding:0 12px;border-radius:10px;font-family:inherit;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:15px;cursor:pointer}
.a .btn.pause{background:var(--amber);color:var(--pauseT);border:0}
.a .btn.go{background:var(--green);color:var(--goT);border:0}
.a .btn.main{background:var(--text);color:var(--bg);border:0}
.a .btn.stop{background:transparent;color:var(--redT);border:1.5px solid var(--redB)}
.a .btn.ghost{background:transparent;color:var(--text);border:1.5px solid var(--line2)}
.a .foot{display:flex;gap:10px;padding:18px 24px 22px;border-top:1px solid var(--line);background:var(--bar)}
.a .jr{display:grid;grid-template-columns:52px minmax(0,1fr) 70px;align-items:baseline;padding:6px 0;border-top:1px solid var(--line);font-size:14px}
.a .s-band{fill:var(--band)}.a .s-bandl{stroke:var(--bandL)}.a .s-bandt{fill:var(--bandT)}.a .s-bar{fill:var(--greenS)}.a .s-red{fill:var(--red)}.a .s-redl{stroke:var(--red)}
.a .s-cur{fill:var(--cur)}.a .s-panel{fill:var(--panel);stroke:var(--line2)}.a .s-green{fill:var(--green)}.a .s-voie{fill:none;stroke:var(--green)}.a .s-amber{fill:var(--amber)}
.a .s-fut{fill:var(--fut)}.a .s-dim{fill:var(--dim)}.a .s-text{fill:var(--text)}.a .s-ax{stroke:var(--line2)}.a .s-vec{stroke:var(--green)}.a .s-amberl{stroke:var(--amber)}.a .s-mutl{stroke:var(--mut)}'''
A_MONO='font-family="JetBrains Mono, monospace"'

def a_header(mode):
    tabs=''.join(f'<a class="tab{" on" if m==mode else ""}" href="A-{fn}.dc.html">{l}</a>' for m,l,fn in MODES)
    return f'''<div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 24px 10px;">
<div style="display: flex; align-items: baseline; gap: 8px;"><span style="font-weight: 700; font-size: 18px; letter-spacing: .06em;">BANANE</span><span class="lbl">4.8</span></div>
<div style="display: flex; align-items: center; gap: 10px;">
<div class="segs" role="group" aria-label="Thème"><button class="%%segDark%%" aria-label="Sombre" title="Sombre" aria-pressed="%%darkPressed%%" onClick="%%setDark%%">{ic(MOON_P,size=15)}</button><button class="%%segLight%%" aria-label="Clair" title="Clair" aria-pressed="%%lightPressed%%" onClick="%%setLight%%">{ic(SUN_P,size=15)}</button></div>
<button class="%%swClass%%" aria-pressed="%%dockPressed%%" onClick="%%toggleDock%%">{ic(DOCK_P,size=15)}Bandeau<span class="tr"><span class="kn"></span></span></button>
</div>
</div>
<div style="display: flex; gap: 6px; padding: 0 24px 14px; border-bottom: 1px solid var(--line);">{tabs}</div>'''
def a_tile(l,v,c,s,d): return f'<div class="tile"><span class="lbl">{l}</span><span class="v" style="color: {c};">{v}</span><span class="s">{s}</span></div>'
def a_lamps(items):
    return '<div class="mono" style="display: flex; gap: 18px; font-size: 12px;">'+''.join(
        f'<span class="lamp{" on" if on else ""}"><i class="{"seq" if on else ""}" style="--d: {k};"></i>{t}</span>' for k,(on,t) in enumerate(items))+'</div>'
def a_status(txt,right,live=True):
    return f'''<div class="rise" style="--d: 0; display: flex; align-items: center; justify-content: space-between;"><div style="display: flex; align-items: center; gap: 10px;"><span class="dot{" live" if live else ""}"></span><span class="lbl" style="color: var(--ok);">{txt}</span></div><span class="lbl">{right}</span></div>'''
def a_card(l,v,rl,rv,d=1):
    return f'''<div class="card rise" style="--d: {d};"><div style="display: flex; flex-direction: column; gap: 2px;"><span class="lbl">{l}</span><span class="big">{v}</span></div><div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;"><span class="lbl">{rl}</span><span class="mono" style="font-size: 13px; color: var(--mut);">{rv}</span></div></div>'''
def a_frame(mode,content,foot):
    return f'''<div class="%%themeClass%%" style="width: 420px; height: 880px; box-sizing: border-box; display: flex; flex-direction: column;">
{a_header(mode)}
<div style="padding: 20px 24px 0; display: flex; flex-direction: column; gap: 16px; flex-grow: 1;">
{content}
</div>
<div class="foot">{foot}</div>
</div>'''

def a_tco(W=372):
    step=W/(N+4); out=[]; P0,PH=46,38; Y=lambda mm: P0-min(mm,45)/45*PH
    out.append(f'<svg width="{W}" height="118" viewBox="0 0 {W} 118" aria-hidden="true">')
    out.append(f'<rect class="s-band" x="0" y="{f(Y(30))}" width="{W}" height="{f(P0-Y(30))}"/>')
    out.append(f'<line class="s-bandl" x1="0" y1="{f(Y(30))}" x2="{W}" y2="{f(Y(30))}" stroke-dasharray="3 3"/>')
    out.append(f'<text class="s-bandt" x="{W}" y="{f(Y(30)-4)}" text-anchor="end" font-size="9" {A_MONO}>GARDE 30 mm</text>')
    for i in range(N):
        e=ecart(i)
        if e is None: continue
        x=i*step+step/2
        out.append(f'<rect class="s-bar grow" style="animation-delay: {300+i*18}ms;" x="{f(x-1.5)}" y="{f(Y(e))}" width="3" height="{f(P0-Y(e))}" rx="1" opacity=".85"/>')
        if i in RETIRE:
            r=RETIRE[i]
            out.append(f'<line class="s-redl fade" x1="{f(x)}" y1="{f(Y(r))}" x2="{f(x)}" y2="{f(Y(e)-2)}" stroke-dasharray="2 2"/><circle class="s-red pop" cx="{f(x)}" cy="{f(Y(r))}" r="3"/>')
            out.append(f'<text class="s-red fade" x="{f(x+6)}" y="{f(Y(r)+3)}" font-size="9" {A_MONO}>{C0+i} RETIRÉ · 36 mm</text>')
    y=60
    out.append(f'<rect class="s-panel" x="0" y="{y}" width="{W}" height="22" rx="4"/>')
    for i in range(N+4):
        x=i*step+1.2; w=step-2.4
        if i>=N: out.append(f'<rect class="s-fut" x="{f(x)}" y="{y+6}" width="{f(w)}" height="10" rx="1.5"/>');continue
        k=kind(i)
        if k=='moteur': out.append(f'<rect class="s-green" x="{f(x)}" y="{y+6}" width="{f(w)}" height="10" rx="1.5"/>')
        elif k=='voie': out.append(f'<rect class="s-voie" x="{f(x+.6)}" y="{y+6.6}" width="{f(w-1.2)}" height="8.8" rx="1.5" stroke-width="1.4"/>')
        elif k=='diff': out.append(f'<rect class="s-amber" x="{f(x)}" y="{y+6}" width="{f(w)}" height="10" rx="1.5"/>')
        else: out.append(f'<rect class="s-cur blink" x="{f(x-1)}" y="{y+2}" width="{f(w+2)}" height="18" rx="2"/>')
    xc=CUR*step+step/2
    out.append(f'<path class="s-cur" d="M{f(xc-5)},{y+30} L{f(xc+5)},{y+30} L{f(xc)},{y+24} Z"/>')
    for i in (4,14,24):
        x=i*step+step/2
        out.append(f'<text class="s-dim" x="{f(x)}" y="{y+44}" text-anchor="middle" font-size="9.5" {A_MONO}>{C0+i}</text>')
    out.append(f'<text class="s-text" x="{f(xc)}" y="{y+44}" text-anchor="middle" font-size="10" font-weight="600" {A_MONO}>{C0+CUR}</text>')
    out.append('</svg>'); return ''.join(out)

def a_rythme(W=372,H=120):
    PW=W-86; step=PW/N; top=14; bot=H-20; Y=lambda s: bot-min(s,30)/30*(bot-top); out=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true">']
    out.append(f'<line class="s-ax" x1="0" y1="{bot}" x2="{PW}" y2="{bot}"/>')
    for i in range(N):
        t=tcut(i); x=i*step+step/2
        if i==CUR: out.append(f'<rect class="s-voie blink" x="{f(x-2)}" y="{f(Y(t))}" width="4" height="{f(bot-Y(t))}" rx="1" stroke-width="1.2"/>');continue
        cls='s-amber' if t>P90T else 's-bar'
        out.append(f'<rect class="{cls} grow" style="animation-delay: {250+i*18}ms;" x="{f(x-2)}" y="{f(Y(t))}" width="4" height="{f(bot-Y(t))}" rx="1" opacity="{1 if t>P90T else .8}"/>')
    out.append(f'<line class="s-mutl" x1="0" y1="{f(Y(MEDT))}" x2="{PW+6}" y2="{f(Y(MEDT))}" stroke-dasharray="4 3"/>')
    out.append(f'<line class="s-amberl" x1="0" y1="{f(Y(P90T))}" x2="{PW+6}" y2="{f(Y(P90T))}" stroke-dasharray="1.5 3"/>')
    out.append(f'<text class="s-text" x="{W}" y="{f(Y(MEDT)+3.5)}" text-anchor="end" font-size="9.5" {A_MONO}>MÉD {fr(MEDT)} s</text>')
    out.append(f'<text class="s-amber" x="{W}" y="{f(Y(P90T)+3.5)}" text-anchor="end" font-size="9.5" {A_MONO}>P90 {fr(P90T)} s</text>')
    out.append(f'<text class="s-dim" x="0" y="{H-4}" font-size="9.5" {A_MONO}>{C0}</text><text class="s-text" x="{f((N-.5)*step)}" y="{H-4}" text-anchor="middle" font-size="10" font-weight="600" {A_MONO}>{C0+CUR}</text>')
    out.append('</svg>'); return ''.join(out)

def a_delta(lat,vert,W=156,H=124,s=5):
    cx,cy=W/2,H/2; ex,ey=cx+lat*s,cy-vert*s
    out=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true">']
    out.append(f'<line class="s-ax" x1="4" y1="{f(cy)}" x2="{W-4}" y2="{f(cy)}"/><line class="s-ax" x1="{f(cx)}" y1="4" x2="{f(cx)}" y2="{H-4}"/>')
    for v in (-10,-5,5,10):
        out.append(f'<line class="s-ax" x1="{f(cx+v*s)}" y1="{f(cy-3)}" x2="{f(cx+v*s)}" y2="{f(cy+3)}"/><line class="s-ax" x1="{f(cx-3)}" y1="{f(cy-v*s)}" x2="{f(cx+3)}" y2="{f(cy-v*s)}"/>')
    out.append(f'<text class="s-dim" x="{f(cx+10*s)}" y="{f(cy+14)}" text-anchor="middle" font-size="8.5" {A_MONO}>10</text>')
    out.append(f'<text class="s-dim" x="{W-4}" y="{f(cy-6)}" text-anchor="end" font-size="8.5" {A_MONO}>LAT</text><text class="s-dim" x="{f(cx+5)}" y="11" font-size="8.5" {A_MONO}>VERT</text>')
    out.append(f'<path class="s-vec draw" pathLength="1" d="M{f(cx)},{f(cy)} L{f(ex)},{f(ey)}" stroke-width="2" stroke-linecap="round" fill="none"/>')
    out.append(f'<circle class="s-green pop" cx="{f(ex)}" cy="{f(ey)}" r="4"/><circle class="s-dim" cx="{f(cx)}" cy="{f(cy)}" r="2"/>')
    out.append('</svg>'); return ''.join(out)

def a_gauge(W=372,pad=14):
    Xg=lambda v: pad+(v-LO)/(HI-LO)*(W-2*pad)
    return (f'<svg width="{W}" height="34" viewBox="0 0 {W} 34" aria-hidden="true"><rect class="s-band s-bandl" x="{pad}" y="6" width="{W-2*pad}" height="8" rx="4"/>'
            f'<circle class="s-text pop" cx="{f(Xg(GAUGE))}" cy="10" r="6" style="stroke: var(--bg); stroke-width: 2;"/>'
            f'<text class="s-dim" x="{pad}" y="30" font-size="9.5" {A_MONO}>{LO}</text><text class="s-dim" x="{W-pad}" y="30" text-anchor="end" font-size="9.5" {A_MONO}>{HI}</text></svg>')

def a_natif():
    c=f'''{a_status("Collecte en cours","Partie 34 · observation")}
{a_card("Visites de cuts",str(VISITES),"Dernière visite","8455 · il y a 4 s")}
<div class="rise" style="--d: 2; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">{a_tile("Captures","184","var(--greenS)","0 en panne",0)}{a_tile("Volume","42,6","var(--text)","Mo conservés",0)}{a_tile("File d’envoi","0","var(--text)","rien en attente",0)}</div>
<div class="rise" style="--d: 3; display: flex; flex-direction: column; gap: 8px;"><span style="display: flex; justify-content: space-between;"><span class="lbl">Temps par cut · 40 derniers</span><span class="lbl">secondes</span></span>{a_rythme()}</div>
<div class="rise" style="--d: 4; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px;">
<div style="display: flex; justify-content: space-between;"><span class="lbl">Qualité de capture</span><span class="lbl">362 / 368 repères qualifiés</span></div>
{a_lamps([(True,"CAPTURES OK"),(True,"COLLECTEUR NORMAL"),(True,"FLANC 97 %")])}
</div>
<div class="rise" style="--d: 5; display: flex; flex-direction: column;">{a_jr(C0+39,"VISITE EN COURS","00:04","var(--ok)")}{a_jr(C0+38,"VALIDÉ",fr(tcut(38))+" s")}{a_jr(C0+37,"VALIDÉ",fr(tcut(37))+" s")}{a_jr(C0+36,"CORRIGÉ · 2 RAILS",fr(tcut(36))+" s","var(--greenL)")}</div>'''
    return a_frame('native',c,'<button class="btn main" style="flex-grow: 1;">Terminer et télécharger</button><button class="btn ghost" style="width: 104px;">Pause</button>')

def a_jr(cut,txt,val,col='var(--text)'):
    return f'<div class="jr"><span class="mono" style="font-size: 12.5px; font-weight: 600;">{cut}</span><span style="color: {col}; letter-spacing: .04em;">{txt}</span><span class="mono" style="font-size: 12px; color: var(--mut); text-align: right;">{val}</span></div>'
def a_pilote():
    c=f'''{a_status("Lot en cours",f"Partie 34 · {C0} → {END}")}
{a_card("Cut affiché",str(C0+CUR),"Capture LiDAR","00:04 · 2 rails")}
<div class="rise" style="--d: 2; display: flex; flex-direction: column; gap: 6px;"><div style="height: 4px; border-radius: 2px; background: var(--fut); overflow: hidden;"><div class="fill" style="width: {PROG}%; height: 100%; background: var(--green);"></div></div><span style="display: flex; justify-content: space-between;"><span class="lbl">{PROG} % de la plage</span><span class="lbl">{TRAITES} / {PLAGE} cuts</span></span></div>
<div class="rise" style="--d: 3; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">{a_tile("Posés",POSES,"var(--greenS)",f"{NVOIE} par la voie",0)}{a_tile("Différés",NDIFF,"var(--amber)","à la main",0)}{a_tile("Couverture",f"{COUV} %","var(--text)",f"{POSES} sur {POSES+NDIFF}",0)}</div>
<div class="rise" style="--d: 4; display: flex; flex-direction: column; gap: 8px;"><span style="display: flex; justify-content: space-between;"><span class="lbl">Écart à la voie</span><span class="lbl">médiane {fr(MED)} mm</span></span>{a_tco()}</div>
<div class="rise" style="--d: 5; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px;">
<div style="display: flex; justify-content: space-between;"><span class="lbl">Dernière commande · valider</span><span class="lbl">Cut {C0+CUR-1}</span></div>
{a_lamps([(True,"ÉMISE"),(True,"NAVIGATION VUE"),(False,"SERVEUR N/D")])}
</div>
<div class="rise" style="--d: 6; display: flex; flex-direction: column;">{a_jr(C0+38,"POSÉ · MOTEUR",fr(ecart(38))+" mm")}{a_jr(C0+37,"POSÉ · PAR LA VOIE",fr(ecart(37))+" mm","var(--greenL)")}{a_jr(C0+36,"DIFFÉRÉ · AMBIGUÏTÉ","à la main","var(--amber)")}</div>'''
    return a_frame('automatic',c,'<button class="btn pause" style="flex-grow: 1;">Pause</button><button class="btn stop" style="width: 150px;">Arrêter</button>')

def a_assiste():
    rails=''.join(f'''<div class="tile" style="gap: 6px;"><span class="lbl">{t}</span>{a_delta(la,ve)}<span class="mono" style="font-size: 12px;">LAT {sg(la)} · VERT {sg(ve)}</span><span class="mono" style="font-size: 11px; color: var(--mut);">INDICE LIDAR {ix}/100</span></div>''' for t,_,la,ve,ix in RAILS)
    c=f'''{a_status("Proposition prête","Partie 34 · essai assisté",live=False)}
{a_card("Cut affiché","8455","Lecture LiDAR","00:02 · 2 rails")}
<div class="rise" style="--d: 2; display: flex; flex-direction: column; gap: 8px;"><span style="display: flex; justify-content: space-between;"><span class="lbl">Déplacement proposé</span><span class="lbl">mm</span></span><div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">{rails}</div></div>
<div class="rise" style="--d: 3; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--line); padding-top: 14px;">
<div style="display: flex; justify-content: space-between; align-items: center;"><span class="lbl">Écartement de la proposition</span><span class="lamp on mono" style="font-size: 12px; color: var(--ok);"><i class="seq" style="background: var(--green);"></i>DANS LE CONTRAT</span></div>
<span class="mono" style="font-size: 28px; font-weight: 600;">{fr(GAUGE)}<span style="font-size: 13px; color: var(--mut); margin-left: 4px;">mm</span></span>
{a_gauge()}
</div>
<div class="rise" style="--d: 4; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px;">
<div style="display: flex; justify-content: space-between;"><span class="lbl">Dernière commande · appliquer</span><span class="lbl">Cut 8454</span></div>
{a_lamps([(True,"ÉMISE"),(True,"RAILS VUS"),(False,"SERVEUR N/D")])}
<span style="font-size: 14px; color: var(--mut); letter-spacing: .02em;">La validation du cut reste ton action dans ESV.</span>
</div>'''
    return a_frame('assisted',c,'<button class="btn go" style="flex-grow: 1;">Appliquer les deux rails</button><button class="btn ghost" style="width: 104px;">Ignorer</button>')

# ================================================================== E · Tableau des départs
E_FONTS='family=Doto:wght@700;800;900&amp;family=JetBrains+Mono:wght@400;600'
E_CSS='''.e{--bg:#0b0a08;--card:#14120d;--line:#2a2417;--row:#1c1a14;--amb:#ffb000;--amb2:#b37b00;--amb3:#7a5600;--hi:#fff4d6;--hi2:#d9c38f;--red:#ff7a52;--redB:#5c2a1a;--inv:#0b0a08;--fut:#3a2c00;background:var(--bg);color:var(--amb)}
.e.light{--bg:#f5f0e4;--card:#fffaf0;--line:#d9cbad;--row:#e6dcc6;--amb:#8a5200;--amb2:#6e5a36;--amb3:#8c7a58;--hi:#1a1407;--hi2:#4a3f2a;--red:#b3261a;--redB:#e0a39b;--inv:#fffaf0;--fut:#e2d6ba}
.e{font-family:"JetBrains Mono",monospace;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.e .dm{font-family:"Doto",monospace;font-weight:800}
.e .k{font-size:11px;color:var(--amb2);letter-spacing:.12em}
.e .card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
.e .big{font-family:"Doto",monospace;font-weight:900;font-size:64px;line-height:.9;color:var(--hi);white-space:nowrap}
.e .row{display:grid;grid-template-columns:64px 104px minmax(0,1fr);align-items:baseline;padding:7px 0;border-bottom:1px solid var(--row)}
.e .th{display:grid;grid-template-columns:64px 104px minmax(0,1fr);font-size:10.5px;color:var(--amb3);letter-spacing:.12em;padding-bottom:4px;border-bottom:1px solid var(--line)}
.e .tab{text-decoration:none;font-size:12px;letter-spacing:.14em;color:var(--amb2);padding:5px 9px;border-radius:4px}
.e .tab.on{background:var(--amb);color:var(--inv)}
.e .ib{appearance:none;width:34px;height:34px;border:1px solid var(--line);border-radius:6px;background:transparent;color:var(--amb2);display:flex;align-items:center;justify-content:center;cursor:pointer}
.e .ib.on{color:var(--amb);border-color:var(--amb2)}
.e .btn{appearance:none;height:48px;padding:0 10px;border-radius:8px;font-family:"Doto",monospace;font-weight:900;font-size:20px;letter-spacing:.06em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.e .btn.main{border:0;background:var(--amb);color:var(--inv)}
.e .btn.ghost{background:transparent;border:1.5px solid var(--line);color:var(--amb)}
.e .btn.stop{background:transparent;border:1.5px solid var(--redB);color:var(--red);font-size:18px}
.e .d-a{fill:var(--amb)}.e .d-2{fill:var(--amb2)}.e .d-3{fill:var(--amb3)}.e .d-f{fill:var(--fut)}.e .d-h{fill:var(--hi)}.e .d-o{fill:none;stroke:var(--amb)}.e .d-r{fill:var(--red)}.e .d-l{stroke:var(--amb3)}'''
def e_header(mode):
    tabs=''.join(f'<a class="tab{" on" if m==mode else ""}" href="E-{fn}.dc.html">{l.upper()}</a>' for m,l,fn in MODES)
    return f'''<div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px 0;">
<span class="dm" style="font-weight: 900; font-size: 22px; letter-spacing: .04em;">BANANE</span>
<div style="display: flex; gap: 8px; align-items: center;"><span class="k" style="margin-right: 4px;">PARTIE 34</span>{theme_icon_button("ib",16)}{dock_button(16)}</div>
</div>
<div style="display: flex; gap: 6px; padding: 14px 24px 12px; border-bottom: 1px solid var(--line);">{tabs}</div>'''
def e_frame(mode,content,foot):
    return f'''<div class="%%themeClass%%" style="width: 420px; height: 880px; box-sizing: border-box; display: flex; flex-direction: column;">
{e_header(mode)}
<div style="padding: 16px 24px 0; display: flex; flex-direction: column; gap: 16px; flex-grow: 1;">
{content}
</div>
<div style="display: flex; gap: 10px; align-items: center; padding: 16px 24px 22px; border-top: 1px solid var(--line);">{foot}</div>
</div>'''
def flip(txt): return ''.join(f'<span class="flip" style="--d: {k};">{ch}</span>' for k,ch in enumerate(txt))
def e_card(k,big,rt,rs,d=0):
    return f'''<div class="card rise" style="--d: {d};">
<div style="display: flex; flex-direction: column; gap: 4px;"><span class="k">{k}</span><span class="big">{flip(big)}</span></div>
<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;"><span class="dm" style="font-size: 18px;">{rt}</span><span style="font-size: 12px; color: var(--amb2);">{rs}</span></div>
</div>'''
def e_row(n,s,d,hi=False,dim=False,k=0):
    c='var(--hi)' if hi else 'var(--amb2)' if dim else 'var(--amb)'
    return f'''<div class="row rise" style="--d: {k};"><span class="dm" style="font-size: 20px; color: {c};">{n}</span><span class="dm" style="font-size: 17px; color: {c};">{s}</span><span style="font-size: 11.5px; color: {"var(--hi2)" if hi else "var(--amb2)"}; text-align: right;">{d}</span></div>'''
def e_strip(W=372):
    step=W/(N+4); out=[f'<svg width="{W}" height="20" viewBox="0 0 {W} 20" aria-hidden="true">']
    for i in range(N+4):
        x=i*step+step/2
        if i>=N: out.append(f'<circle class="d-f" cx="{f(x)}" cy="10" r="2.6"/>');continue
        k=kind(i)
        if k=='cur': out.append(f'<circle class="d-h blink" cx="{f(x)}" cy="10" r="5"/>')
        elif k=='diff': out.append(f'<circle class="d-o" cx="{f(x)}" cy="10" r="3.4" stroke-width="1.4" stroke-dasharray="1.6 1.6"/>')
        elif k=='voie': out.append(f'<circle class="d-o" cx="{f(x)}" cy="10" r="3.4" stroke-width="1.6"/>')
        else: out.append(f'<circle class="d-a" cx="{f(x)}" cy="10" r="3.4"/>')
    out.append('</svg>'); return ''.join(out)
def e_rythme(W=372,H=112):
    PW=W-78; step=PW/N; pitch=5.2; bot=H-18; out=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true">']
    for i in range(N):
        t=tcut(i); x=i*step+step/2; n=max(1,round(t/2))
        cls='d-h blink' if i==CUR else 'd-h' if t>P90T else 'd-a'
        g=[f'<circle cx="{f(x)}" cy="{f(bot-j*pitch)}" r="1.9"/>' for j in range(n)]
        out.append(f'<g class="{cls}{"" if i==CUR else " grow"}" style="animation-delay: {250+i*18}ms;">{"".join(g)}</g>')
    ym=bot-(MEDT/2-.5)*pitch; yp=bot-(P90T/2-.5)*pitch
    out.append(f'<line class="d-l" x1="0" y1="{f(ym)}" x2="{PW+6}" y2="{f(ym)}" stroke-dasharray="3 3"/><line class="d-l" x1="0" y1="{f(yp)}" x2="{PW+6}" y2="{f(yp)}" stroke-dasharray="1 3"/>')
    out.append(f'<text class="d-2" x="{W}" y="{f(ym+3.5)}" text-anchor="end" font-size="9.5" font-family="JetBrains Mono, monospace">MÉD {fr(MEDT)}</text><text class="d-h" x="{W}" y="{f(yp+3.5)}" text-anchor="end" font-size="9.5" font-family="JetBrains Mono, monospace">P90 {fr(P90T)}</text>')
    out.append(f'<text class="d-2" x="0" y="{H-2}" font-size="9.5" font-family="JetBrains Mono, monospace">{C0}</text><text class="d-h" x="{f((N-.5)*step)}" y="{H-2}" text-anchor="middle" font-size="10" font-family="JetBrains Mono, monospace">{C0+CUR}</text>')
    out.append('</svg>'); return ''.join(out)
def e_delta(lat,vert,W=176,H=110,s=5):
    cx,cy=W/2,H/2; out=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true">']
    for gx in range(-10,11,5):
        for gy in range(-10,11,5):
            out.append(f'<circle class="{"d-3" if gx==0 or gy==0 else "d-f"}" cx="{f(cx+gx*s)}" cy="{f(cy-gy*s)}" r="{1.6 if gx==0 or gy==0 else 1.3}"/>')
    ex,ey=cx+lat*s,cy-vert*s; L=((ex-cx)**2+(ey-cy)**2)**.5; n=max(1,int(L/4))
    for j in range(1,n):
        out.append(f'<circle class="d-a pop" style="animation-delay: {500+j*60}ms;" cx="{f(cx+(ex-cx)*j/n)}" cy="{f(cy+(ey-cy)*j/n)}" r="1.4"/>')
    out.append(f'<circle class="d-h pop" cx="{f(ex)}" cy="{f(ey)}" r="4.5"/>')
    out.append(f'<text class="d-2" x="{W-2}" y="{f(cy-6)}" text-anchor="end" font-size="8.5" font-family="JetBrains Mono, monospace">LAT</text><text class="d-2" x="{f(cx+6)}" y="10" font-size="8.5" font-family="JetBrains Mono, monospace">VERT</text>')
    out.append('</svg>'); return ''.join(out)
def e_gauge(W=372):
    pad=6; n=HI-LO+1; step=(W-2*pad)/(n-1); out=[f'<svg width="{W}" height="34" viewBox="0 0 {W} 34" aria-hidden="true">']
    for k in range(n): out.append(f'<circle class="d-a" cx="{f(pad+k*step)}" cy="10" r="1.9" opacity=".75"/>')
    out.append(f'<circle class="d-h pop" cx="{f(pad+(GAUGE-LO)*step)}" cy="10" r="5.5"/>')
    out.append(f'<text class="d-2" x="0" y="31" font-size="9.5" font-family="JetBrains Mono, monospace">{LO}</text><text class="d-2" x="{W}" y="31" text-anchor="end" font-size="9.5" font-family="JetBrains Mono, monospace">{HI}</text></svg>')
    return ''.join(out)

def e_natif():
    rows=e_row(C0+39,'VISITE','en cours · 00:04',hi=True,k=3)+''.join(
        e_row(C0+i,'CORRIGÉ' if i==36 else 'VALIDÉ',fr(tcut(i))+' s'+(' · 2 rails' if i==36 else ''),k=4+j) for j,i in enumerate((38,37,36,35,34)))
    c=f'''{e_card("VISITES DE CUTS",str(VISITES),"COLLECTE","observation · 8455")}
<div class="rise" style="--d: 1; display: flex; flex-direction: column; gap: 6px;"><span style="display: flex; justify-content: space-between;"><span class="k">TEMPS PAR CUT</span><span class="k">40 DERNIERS · SECONDES</span></span>{e_rythme()}</div>
<div style="display: flex; flex-direction: column;"><div class="th rise" style="--d: 2;"><span>CUT</span><span>ÉTAT</span><span style="text-align: right;">DURÉE</span></div>{rows}</div>
<div class="rise" style="--d: 9; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">
<div style="display: flex; flex-direction: column; gap: 2px;"><span class="k">CAPTURES</span><span class="dm" style="font-size: 20px;">184/184</span></div>
<div style="display: flex; flex-direction: column; gap: 2px;"><span class="k">VOLUME</span><span class="dm" style="font-size: 20px;">42,6 MO</span></div>
<div style="display: flex; flex-direction: column; gap: 2px;"><span class="k">FILE</span><span class="dm" style="font-size: 20px;">0</span></div>
</div>'''
    return e_frame('native',c,f'<button class="btn main" style="flex-grow: 1;">TERMINER {ic(DL_P,2.2,18)}</button><button class="btn ghost" style="width: 130px;">PAUSE</button>')

def e_pilote():
    def det(i):
        k=kind(i)
        return ('POSÉ','moteur · '+fr(ecart(i))+' mm') if k=='moteur' else ('POSÉ','par la voie · '+fr(ecart(i))) if k=='voie' else ('DIFFÉRÉ','ambiguïté · à la main')
    rows=e_row(C0+CUR,'EN COURS','capture…',hi=True,k=4)+''.join(e_row(C0+i,*det(i),dim=kind(i)=='diff',k=5+j) for j,i in enumerate(range(38,28,-1)))
    c=f'''{e_card("CUT AFFICHÉ",str(C0+CUR),"EN COURS",f"{POSES} posés · {NDIFF} différés")}
<div class="rise" style="--d: 1; display: flex; flex-direction: column; gap: 6px;"><span style="display: flex; justify-content: space-between;"><span class="k">LA LIGNE</span><span class="k">{PROG} % · {TRAITES}/{PLAGE}</span></span>{e_strip()}</div>
<div class="rise" style="--d: 2; font-size: 11.5px; color: var(--amb2);">{C0+CUR-1} VALIDER · ÉMISE ✓ · NAV VUE ✓ · <span style="color: var(--amb3);">SERVEUR N/D</span></div>
<div style="display: flex; flex-direction: column;"><div class="th rise" style="--d: 3;"><span>CUT</span><span>ÉTAT</span><span style="text-align: right;">DÉTAIL</span></div>{rows}</div>'''
    return e_frame('automatic',c,'<button class="btn main" style="flex-grow: 1;">PAUSE</button><button class="btn stop" style="width: 130px;">ARRÊTER</button>')

def e_assiste():
    th='<div class="rise" style="--d: 2; display: grid; grid-template-columns: 88px repeat(3, minmax(0, 1fr)); font-size: 10.5px; color: var(--amb3); letter-spacing: .12em; padding-bottom: 4px; border-bottom: 1px solid var(--line);"><span>RAIL</span><span style="text-align: right;">LATÉRAL</span><span style="text-align: right;">VERTICAL</span><span style="text-align: right;">INDICE</span></div>'
    rows=''.join(f'<div class="rise" style="--d: {3+j}; display: grid; grid-template-columns: 88px repeat(3, minmax(0, 1fr)); align-items: baseline; padding: 7px 0; border-bottom: 1px solid var(--row);"><span class="dm" style="font-size: 17px;">{r.upper()}</span><span class="dm" style="font-size: 20px; color: var(--hi); text-align: right;">{sg(la)}</span><span class="dm" style="font-size: 20px; color: var(--hi); text-align: right;">{sg(ve)}</span><span class="dm" style="font-size: 20px; text-align: right;">{ix}</span></div>' for j,(_,r,la,ve,ix) in enumerate(RAILS))
    plots=''.join(f'<div style="display: flex; flex-direction: column; gap: 4px;"><span class="k">{r.upper()}</span>{e_delta(la,ve)}</div>' for _,r,la,ve,_ in RAILS)
    c=f'''{e_card("CUT AFFICHÉ","8455","PRÊTE","lecture 00:02")}
<div style="display: flex; flex-direction: column;">{th}{rows}<span class="k" style="padding-top: 6px; text-align: right;">MM · INDICE LIDAR /100</span></div>
<div class="rise" style="--d: 5; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">{plots}</div>
<div class="rise" style="--d: 6; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--line); padding-top: 12px;">
<span style="display: flex; justify-content: space-between;"><span class="k">ÉCARTEMENT</span><span class="k">CONTRAT {LO}–{HI}</span></span>
<span style="display: flex; align-items: baseline; justify-content: space-between;"><span><span class="dm" style="font-size: 28px; color: var(--hi);">{fr(GAUGE)}</span><span style="font-size: 12px; color: var(--amb2); margin-left: 6px;">MM</span></span><span class="dm" style="font-size: 16px;">DANS LE CONTRAT</span></span>
{e_gauge()}
</div>
<div class="rise" style="--d: 7; display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 11.5px; color: var(--amb2);">8454 APPLIQUER · ÉMISE ✓ · RAILS VUS ✓ · <span style="color: var(--amb3);">SERVEUR N/D</span></span><span style="font-size: 12px; color: var(--hi2);">La validation du cut reste ton action dans ESV.</span></div>'''
    return e_frame('assisted',c,'<button class="btn main" style="flex-grow: 1; font-size: 18px;">APPLIQUER 2 RAILS</button><button class="btn ghost" style="width: 118px;">IGNORER</button>')

# ================================================================== H · même brief, sans le skill
H_FONTS='family=Hanken+Grotesk:wght@300;400;500;600;700&amp;family=JetBrains+Mono:wght@400;500'
H_CSS='''.h{--bg:#000000;--text:#ffffff;--text2:#a6a6a6;--text3:#8a8a8a;--line:#262626;--line2:#3a3a3a;--field:#111111;--accent:#3e6ae1;--amber:#f5a524;--red:#ff4d4d;--green:#2fd07a;--seg:#ffffff;--fut:#2a2a2a;--inv:#000000;background:var(--bg);color:var(--text)}
.h.light{--bg:#ffffff;--text:#111111;--text2:#4d4d4d;--text3:#6b6b6b;--line:#e6e6e6;--line2:#cfcfcf;--field:#f4f4f4;--accent:#3e6ae1;--amber:#b86e00;--red:#d0021b;--green:#138a4a;--seg:#111111;--fut:#e2e2e2;--inv:#ffffff}
.h{font-family:"Hanken Grotesk",system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.h .mono{font-family:"JetBrains Mono",monospace}
.h .lbl{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--text3)}
.h button{font-family:inherit;cursor:pointer}
.h .ib{appearance:none;width:36px;height:36px;border:1px solid var(--line2);border-radius:6px;background:transparent;color:var(--text2);display:flex;align-items:center;justify-content:center}
.h .ib:hover{color:var(--text);border-color:var(--text3)}
.h .ib.on{color:var(--text);border-color:var(--text)}
.h .btn{appearance:none;height:48px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:.02em}
.h .btn.main{background:var(--text);color:var(--inv);border:0}
.h .btn.ghost{background:transparent;color:var(--text);border:1px solid var(--line2)}
.h .btn.stop{background:transparent;color:var(--red);border:1px solid var(--line2)}
.h .seg-m{fill:var(--seg)}.h .seg-v{fill:var(--accent)}.h .seg-d{fill:var(--amber)}.h .seg-f{fill:var(--fut)}.h .seg-c{fill:var(--text)}
.h .ax{stroke:var(--line)}.h .ax2{stroke:var(--line2)}.h .axt{fill:var(--text3);font-family:"JetBrains Mono",monospace;font-size:10px}
.h .area{fill:var(--accent);opacity:.14}.h .spark{stroke:var(--text);fill:none}
.h .f-t{fill:var(--text)}.h .f-a{fill:var(--amber)}.h .f-r{fill:var(--red)}.h .f-3{fill:var(--text3)}.h .s-t{stroke:var(--text)}.h .s-a{stroke:var(--amber)}.h .s-r{stroke:var(--red)}.h .s-3{stroke:var(--text3)}
.h .tab{text-decoration:none;padding:0 0 10px;font-size:13px;font-weight:500;color:var(--text3);border-bottom:2px solid transparent}
.h .tab.on{color:var(--text);border-bottom-color:var(--text)}
.h .pt{display:block;width:8px;height:8px;border-radius:4px}'''
SUB={'native':'Natif · partie 34','automatic':'Agent Pilote · partie 34','assisted':'Assisté · partie 34'}
def h_header(mode):
    tabs=''.join(f'<a class="tab{" on" if m==mode else ""}" href="H-{fn}.dc.html">{l}</a>' for m,l,fn in MODES)
    return f'''<div style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 0;">
<div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 15px; font-weight: 700; letter-spacing: .22em;">BANANE</span><span class="lbl" style="letter-spacing: .08em;">{SUB[mode]}</span></div>
<div style="display: flex; gap: 8px;">{theme_icon_button("ib")}{dock_button()}</div>
</div>
<div style="display: flex; gap: 24px; padding: 18px 24px 0; border-bottom: 1px solid var(--line);">{tabs}</div>'''
def h_frame(mode,content,foot):
    return f'''<div class="%%themeClass%%" style="width: 420px; height: 880px; box-sizing: border-box; display: flex; flex-direction: column;">
{h_header(mode)}
<div style="flex-grow: 1; padding: 22px 24px 0; display: flex; flex-direction: column; gap: 20px;">
{content}
</div>
<div style="display: flex; gap: 10px; padding: 16px 24px 22px; border-top: 1px solid var(--line);">{foot}</div>
</div>'''
def h_status(txt,col,live=True):
    return f'<span class="rise" style="--d: 0; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: {col};"><span class="pt{" live" if live else ""}" style="background: {col};"></span>{txt}</span>'
def h_metric(l,v,c,s):
    return f'<div style="display: flex; flex-direction: column; gap: 4px; padding: 0 16px; border-left: 1px solid var(--line);"><span class="lbl">{l}</span><span style="font-size: 30px; font-weight: 300; line-height: 1; color: {c};">{v}</span><span style="font-size: 12px; color: var(--text3);">{s}</span></div>'
def h_row(t,cut,what,val,col='var(--text)'):
    return f'<div style="display: grid; grid-template-columns: 64px 48px minmax(0, 1fr) 64px; align-items: baseline; padding: 9px 0; border-top: 1px solid var(--line); font-size: 13px;"><span class="mono" style="color: var(--text3); font-size: 11.5px;">{t}</span><span class="mono" style="font-weight: 500;">{cut}</span><span style="color: {col};">{what}</span><span class="mono" style="text-align: right; color: var(--text2); font-size: 12px;">{val}</span></div>'
def h_strip(W=372,h=10):
    step=W/(N+4); out=[f'<svg width="{W}" height="30" viewBox="0 0 {W} 30" aria-hidden="true">']
    for i in range(N+4):
        x=i*step+.5; w=step-1
        if i>=N: out.append(f'<rect class="seg-f" x="{f(x)}" y="14" width="{f(w)}" height="{h}"/>');continue
        k=kind(i)
        if k=='cur': out.append(f'<rect class="seg-c blink" x="{f(x)}" y="6" width="{f(w)}" height="{h+14}"/>')
        else: out.append(f'<rect class="{ {"moteur":"seg-m","voie":"seg-v","diff":"seg-d"}[k] }" x="{f(x)}" y="14" width="{f(w)}" height="{h}" opacity="{.55 if k=="moteur" else 1}"/>')
    out.append('</svg>'); return ''.join(out)
def h_spark(W=372,H=100):
    step=W/(N+4); top=12; bot=H-22; Y=lambda mm: bot-min(mm,40)/40*(bot-top)
    out=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true">']
    out.append(f'<line class="ax" x1="0" y1="{bot}" x2="{W}" y2="{bot}"/>')
    out.append(f'<line class="s-r" x1="0" y1="{f(Y(30))}" x2="{W}" y2="{f(Y(30))}" stroke-dasharray="4 4"/><text class="axt" x="0" y="{f(Y(30)+13)}" style="fill: var(--red);">garde 30 mm</text>')
    segs=[];cur=[]
    for i in range(N):
        e=ecart(i)
        if e is None:
            if cur: segs.append(cur); cur=[]
        else: cur.append((i*step+step/2,Y(e)))
    if cur: segs.append(cur)
    for s in segs:
        if len(s)>1:
            pts=' L'.join(f'{f(x)},{f(y)}' for x,y in s)
            out.append(f'<polygon class="area fade" points="{f(s[0][0])},{bot} {" ".join(f"{f(x)},{f(y)}" for x,y in s)} {f(s[-1][0])},{bot}"/>')
            out.append(f'<path class="spark draw" pathLength="1" stroke-width="1.5" d="M{pts}"/>')
    for i in DIFF:
        x=i*step+step/2
        out.append(f'<rect class="f-a" x="{f(x-1.5)}" y="{bot-6}" width="3" height="6"/>')
    for i,r in RETIRE.items():
        x=i*step+step/2
        out.append(f'<line class="s-r fade" x1="{f(x)}" y1="{f(Y(r))}" x2="{f(x)}" y2="{f(Y(ecart(i))-2)}" stroke-dasharray="2 2"/><circle class="f-r pop" cx="{f(x)}" cy="{f(Y(r))}" r="3.5"/><text class="axt fade" x="{f(x+7)}" y="{f(Y(r)+3.5)}" style="fill: var(--red);">{C0+i} · 1er passage retiré, 36 mm</text>')
    out.append(f'<text class="axt" x="0" y="{H-4}">{C0}</text><text class="axt" x="{f(CUR*step+step/2)}" y="{H-4}" text-anchor="middle" style="fill: var(--text);">{C0+CUR}</text>')
    out.append('</svg>'); return ''.join(out)
def h_bars(W=372,H=110):
    PW=W-104; step=PW/N; top=14; bot=H-20; Y=lambda s: bot-min(s,30)/30*(bot-top); out=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true">']
    out.append(f'<line class="ax" x1="0" y1="{bot}" x2="{PW}" y2="{bot}"/>')
    for i in range(N):
        t=tcut(i); x=i*step+step/2
        if i==CUR: out.append(f'<rect class="blink" x="{f(x-1.5)}" y="{f(Y(t))}" width="3" height="{f(bot-Y(t))}" style="fill: none; stroke: var(--text);"/>');continue
        out.append(f'<rect class="{"f-a" if t>P90T else "f-t"} grow" style="animation-delay: {250+i*18}ms;" x="{f(x-1.5)}" y="{f(Y(t))}" width="3" height="{f(bot-Y(t))}" opacity="{1 if t>P90T else .55}"/>')
    out.append(f'<line class="s-t" x1="0" y1="{f(Y(MEDT))}" x2="{PW+6}" y2="{f(Y(MEDT))}" stroke-dasharray="4 4" opacity=".7"/><line class="s-a" x1="0" y1="{f(Y(P90T))}" x2="{PW+6}" y2="{f(Y(P90T))}" stroke-dasharray="1.5 3"/>')
    out.append(f'<text class="axt" x="{W}" y="{f(Y(MEDT)+3.5)}" text-anchor="end" style="fill: var(--text);">médiane {fr(MEDT)} s</text><text class="axt" x="{W}" y="{f(Y(P90T)+3.5)}" text-anchor="end" style="fill: var(--amber);">p90 {fr(P90T)} s</text>')
    out.append(f'<text class="axt" x="0" y="{H-4}">{C0}</text><text class="axt" x="{f((N-.5)*step)}" y="{H-4}" text-anchor="middle" style="fill: var(--text);">{C0+CUR}</text>')
    out.append('</svg>'); return ''.join(out)
def h_delta(lat,vert,W=162,H=112,s=4.4):
    cx,cy=W/2,H/2; ex,ey=cx+lat*s,cy-vert*s; out=[f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true">']
    out.append(f'<line class="ax" x1="0" y1="{f(cy)}" x2="{W}" y2="{f(cy)}"/><line class="ax" x1="{f(cx)}" y1="0" x2="{f(cx)}" y2="{H}"/>')
    for v in (-10,-5,5,10):
        out.append(f'<line class="ax2" x1="{f(cx+v*s)}" y1="{f(cy-3)}" x2="{f(cx+v*s)}" y2="{f(cy+3)}"/><line class="ax2" x1="{f(cx-3)}" y1="{f(cy-v*s)}" x2="{f(cx+3)}" y2="{f(cy-v*s)}"/>')
    out.append(f'<text class="axt" x="{f(cx+10*s)}" y="{f(cy+15)}" text-anchor="middle">10</text><text class="axt" x="{W}" y="{f(cy-6)}" text-anchor="end">lat.</text><text class="axt" x="{f(cx+5)}" y="10">vert.</text>')
    out.append(f'<path class="s-t draw" pathLength="1" d="M{f(cx)},{f(cy)} L{f(ex)},{f(ey)}" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle class="f-t pop" cx="{f(ex)}" cy="{f(ey)}" r="3.5"/><circle class="f-3" cx="{f(cx)}" cy="{f(cy)}" r="1.8"/>')
    out.append('</svg>'); return ''.join(out)
def h_gauge(W=372,pad=4):
    Xg=lambda v: pad+(v-LO)/(HI-LO)*(W-2*pad)
    return (f'<svg width="{W}" height="34" viewBox="0 0 {W} 34" aria-hidden="true"><line class="s-3" x1="{pad}" y1="10" x2="{W-pad}" y2="10" stroke-width="2"/>'
            f'<line class="s-3" x1="{pad}" y1="5" x2="{pad}" y2="15"/><line class="s-3" x1="{W-pad}" y1="5" x2="{W-pad}" y2="15"/>'
            f'<circle class="f-t pop" cx="{f(Xg(GAUGE))}" cy="10" r="5" style="stroke: var(--bg); stroke-width: 2;"/>'
            f'<text class="axt" x="0" y="31">{LO}</text><text class="axt" x="{W}" y="31" text-anchor="end">{HI}</text></svg>')

def h_natif():
    c=f'''<div style="display: flex; flex-direction: column; gap: 10px;">
{h_status("Collecte en cours · observation","var(--green)")}
<div class="rise" style="--d: 1; display: flex; align-items: baseline; gap: 12px;"><span class="count" aria-label="{VISITES}" style="--n: {VISITES}; font-size: 76px; font-weight: 300; letter-spacing: -.03em; line-height: .95;"></span><span style="font-size: 14px; color: var(--text3);">visites de cuts</span></div>
<span class="rise mono" style="--d: 2; font-size: 11.5px; color: var(--text2);">DERNIÈRE · 8455 · IL Y A 4 S</span>
</div>
<div class="rise" style="--d: 3; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 -16px;">{h_metric("Captures","184","var(--text)","0 en panne")}{h_metric("Volume","42,6","var(--text)","Mo conservés")}{h_metric("Qualité","98 %","var(--text)","362 sur 368")}</div>
<div class="rise" style="--d: 4; display: flex; flex-direction: column; gap: 6px;"><span style="display: flex; justify-content: space-between;"><span class="lbl">Temps par cut</span><span style="font-size: 12px; color: var(--text3);">40 derniers · secondes</span></span>{h_bars()}</div>
<div class="rise" style="--d: 5; display: flex; flex-direction: column;"><span class="lbl" style="padding-bottom: 6px;">Activité</span>
{h_row("15:47:12","8455","visite en cours","00:04","var(--green)")}{h_row("15:47:03","8454","validé",fr(tcut(38))+" s")}{h_row("15:46:51","8453","validé",fr(tcut(37))+" s")}{h_row("15:46:29","8452","corrigé · 2 rails",fr(tcut(36))+" s","var(--accent)")}{h_row("15:46:22","8451","validé",fr(tcut(35))+" s")}
</div>'''
    return h_frame('native',c,'<button class="btn main" style="flex-grow: 1;">Terminer et télécharger</button><button class="btn ghost" style="width: 110px;">Pause</button>')

def h_pilote():
    c=f'''<div style="display: flex; flex-direction: column; gap: 10px;">
{h_status("En cours · capture du LiDAR","var(--green)")}
<div class="rise" style="--d: 1; display: flex; align-items: baseline; gap: 12px;"><span style="font-size: 76px; font-weight: 300; letter-spacing: -.03em; line-height: .95;">{C0+CUR}</span><span style="font-size: 14px; color: var(--text3);">cut</span></div>
<div class="rise" style="--d: 2; display: flex; flex-direction: column; gap: 6px;"><div style="height: 2px; background: var(--line); position: relative; overflow: hidden;"><div class="fill" style="position: absolute; left: 0; top: 0; bottom: 0; width: {PROG}%; background: var(--text);"></div></div><span style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text3);"><span class="mono">{C0}</span><span>{PROG} % de la plage</span><span class="mono">{END}</span></span></div>
<span class="rise mono" style="--d: 3; font-size: 11.5px; color: var(--text2);">{C0+CUR-1} VALIDER · ÉMISE ✓ · NAV. VUE ✓ · <span style="color: var(--text3);">SERVEUR N/D</span></span>
</div>
<div class="rise" style="--d: 4; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 -16px;">{h_metric("Posés",POSES,"var(--text)",f"{NVOIE} par la voie")}{h_metric("Différés",NDIFF,"var(--amber)","à la main")}{h_metric("Couverture",f"{COUV} %","var(--text)",f"{POSES} sur {POSES+NDIFF}")}</div>
<div class="rise" style="--d: 5; display: flex; flex-direction: column; gap: 6px;"><span style="display: flex; justify-content: space-between;"><span class="lbl">La ligne</span><span style="font-size: 12px; color: var(--text3);"><span style="color: var(--accent);">■</span> voie · <span style="color: var(--amber);">■</span> différé</span></span>{h_strip()}</div>
<div class="rise" style="--d: 6; display: flex; flex-direction: column; gap: 6px;"><span style="display: flex; justify-content: space-between;"><span class="lbl">Écart à la voie</span><span style="font-size: 12px; color: var(--text3);">médiane <span class="mono" style="color: var(--text);">{fr(MED)} mm</span></span></span>{h_spark()}</div>
<div class="rise" style="--d: 7; display: flex; flex-direction: column;"><span class="lbl" style="padding-bottom: 6px;">Activité</span>
{h_row("15:47:12",str(C0+38),"posé · moteur",fr(ecart(38))+" mm")}{h_row("15:46:58",str(C0+37),"posé · par la voie",fr(ecart(37))+" mm","var(--accent)")}{h_row("15:46:24",str(C0+36),"différé · ambiguïté","—","var(--amber)")}
</div>'''
    return h_frame('automatic',c,'<button class="btn main" style="flex-grow: 1;">Pause</button><button class="btn stop" style="width: 130px;">Arrêter le lot</button>')

def h_assiste():
    rails=''.join(f'''<div style="display: flex; flex-direction: column; gap: 8px; padding: 0 12px; border-left: 1px solid var(--line);"><span class="lbl">{t}</span>{h_delta(la,ve)}
<span style="display: flex; gap: 14px; align-items: baseline;"><span><span style="font-size: 26px; font-weight: 300;">{sg(la)}</span> <span style="font-size: 12px; color: var(--text3);">lat.</span></span><span><span style="font-size: 26px; font-weight: 300;">{sg(ve)}</span> <span style="font-size: 12px; color: var(--text3);">vert.</span></span></span>
<span style="font-size: 12px; color: var(--text3);">indice LiDAR <span class="mono" style="color: var(--text2);">{ix}</span></span></div>''' for t,_,la,ve,ix in RAILS)
    c=f'''<div style="display: flex; flex-direction: column; gap: 10px;">
{h_status("Proposition prête · lecture 00:02","var(--text)",live=False)}
<div class="rise" style="--d: 1; display: flex; align-items: baseline; gap: 12px;"><span style="font-size: 76px; font-weight: 300; letter-spacing: -.03em; line-height: .95;">8455</span><span style="font-size: 14px; color: var(--text3);">cut affiché</span></div>
</div>
<div class="rise" style="--d: 2; display: flex; flex-direction: column; gap: 8px;"><span style="display: flex; justify-content: space-between;"><span class="lbl">Déplacement proposé</span><span style="font-size: 12px; color: var(--text3);">mm</span></span><div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0 -12px;">{rails}</div></div>
<div class="rise" style="--d: 3; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--line); padding-top: 16px;">
<span style="display: flex; justify-content: space-between; align-items: center;"><span class="lbl">Écartement</span><span style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--green);"><span class="pt" style="background: var(--green);"></span>dans le contrat</span></span>
<span><span style="font-size: 44px; font-weight: 300; letter-spacing: -.02em;">{fr(GAUGE)}</span><span style="font-size: 14px; color: var(--text3); margin-left: 6px;">mm</span></span>
{h_gauge()}
</div>
<div class="rise" style="--d: 4; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px;">
<span class="mono" style="font-size: 11.5px; color: var(--text2);">8454 APPLIQUER · ÉMISE ✓ · RAILS VUS ✓ · <span style="color: var(--text3);">SERVEUR N/D</span></span>
<span style="font-size: 14px; line-height: 1.5; color: var(--text2);">La validation du cut reste ton action dans ESV.</span>
</div>'''
    return h_frame('assisted',c,'<button class="btn main" style="flex-grow: 1;">Appliquer les deux rails</button><button class="btn ghost" style="width: 110px;">Ignorer</button>')

# ------------------------------------------------------------------ écriture
PISTES=[('A','a',A_FONTS,A_CSS,'TCO',{'Natif':a_natif,'Pilote':a_pilote,'Assiste':a_assiste}),
        ('E','e',E_FONTS,E_CSS,'Tableau des départs',{'Natif':e_natif,'Pilote':e_pilote,'Assiste':e_assiste}),
        ('H','h',H_FONTS,H_CSS,'Sans le skill',{'Natif':h_natif,'Pilote':h_pilote,'Assiste':h_assiste})]
LIB={'Natif':'Natif','Pilote':'Pilote','Assiste':'Assisté'}
written=[]
for L,root,fonts,css,nom,screens in PISTES:
    for k,fn in screens.items():
        body=delays(fn()); title=f'Piste {L} · {nom} · {LIB[k]}'
        open(R+f'{L}-{k}.dc.html','w').write(dc_page(title,fonts,css,body,root))
        open(X+f'{L}-{k}.html','w').write(export_page(title,L,css,body,root))
        written.append((L,k,nom))
c=json.load(open(R+'canvas.json')) if os.path.exists(R+'canvas.json') else {'v':3,'title':'Banane — pistes retenues','launch':{'view':'canvas'},'pages':[],'boards':{},'order':[],'notes':{},'designSystems':[]}
X0=3600
for r,(L,root,fonts,css,nom,screens) in enumerate(PISTES):
    for j,k in enumerate(screens):
        fnm=f'{L}-{k}.dc.html'
        c['boards'][fnm]={'x':X0+j*500,'y':r*1100,'w':420,'h':880,'title':f'{L} · {nom} · {LIB[k]}','is_interactive':True}
        if fnm not in c['order']: c['order'].append(fnm)
c['notes']['titre7']={'x':X0,'y':-260,'text':'Retenues · A, E, H : les trois modes, animés','kind':'title1','maxW':1420}
json.dump(c,open(R+'canvas.json','w'),ensure_ascii=False,indent=1)
print(len(written),'écrans ;',len(c['boards']),'planches ; MED',MED,'MEDT',MEDT,'P90T',P90T,'POSES',POSES,'COUV',COUV,'PROG',PROG)
