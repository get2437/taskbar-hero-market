import re, json

# 1) messages.ts から en -> (pt,es,fr,de) を構築
msrc = open('src/lib/i18n/messages.ts', encoding='utf-8').read()
EN2T = {}
for m in re.finditer(r'\{\s*en:\s*"((?:[^"\\]|\\.)*)"[^}]*?pt:\s*"((?:[^"\\]|\\.)*)",\s*es:\s*"((?:[^"\\]|\\.)*)",\s*fr:\s*"((?:[^"\\]|\\.)*)",\s*de:\s*"((?:[^"\\]|\\.)*)"', msrc):
    en, pt, es, fr, de = m.groups()
    EN2T.setdefault(en, (pt, es, fr, de))

# demo 固有 / messages に無い文字列の手動訳 (キー=英語値)
MANUAL = {
 "Stock-style analytics for the Steam Market": ("Análise estilo bolsa para o Mercado da Steam","Análisis estilo bolsa para el Mercado de Steam","Analyse boursière pour le marché Steam","Börsen-Analyse für den Steam-Markt"),
 "DEMO": ("DEMO","DEMO","DÉMO","DEMO"),
 "Standalone HTML demo": ("Demo HTML independente","Demo HTML independiente","Démo HTML autonome","Eigenständige HTML-Demo"),
 "No server / DB needed": ("Sem servidor / BD","Sin servidor / BD","Sans serveur / BDD","Kein Server / DB nötig"),
 "Last 24h": ("Últimas 24h","Últimas 24h","Dernières 24h","Letzte 24h"),
 "Almost no volume": ("Quase sem volume","Casi sin volumen","Presque aucun volume","Fast kein Volumen"),
 "See all": ("Ver tudo","Ver todo","Tout voir","Alle ansehen"),
 "Daily": ("Diário","Diario","Quotidien","Täglich"),
 "No matching items": ("Nenhum item correspondente","No hay objetos coincidentes","Aucun objet correspondant","Keine passenden Objekte"),
 "No anomalies detected": ("Nenhuma anomalia detectada","No se detectaron anomalías","Aucune anomalie détectée","Keine Anomalien erkannt"),
 " items": (" itens"," objetos"," objets"," Objekte"),
 "Auto-refreshes every 15 min in production": ("Em produção, atualiza a cada 15 min","En producción, se actualiza cada 15 min","En production, actualisation toutes les 15 min","In Produktion alle 15 Min aktualisiert"),
 "Price History": ("Histórico de preços","Histórico de precios","Historique des prix","Preisverlauf"),
 "Lowest listing": ("Anúncio mais baixo","Anuncio más bajo","Annonce la plus basse","Niedrigstes Angebot"),
 "30-day forecast": ("Previsão de 30 dias","Previsión a 30 días","Prévision sur 30 jours","30-Tage-Prognose"),
 "Price Forecast": ("Previsão de preço","Previsión de precio","Prévision de prix","Preisprognose"),
 "30d range": ("Faixa 30d","Rango 30d","Plage 30j","30T-Bereich"),
 "Trade History": ("Histórico de negociações","Histórico de operaciones","Historique des transactions","Handelsverlauf"),
 "No data": ("Sem dados","Sin datos","Aucune donnée","Keine Daten"),
 "Item not found": ("Item não encontrado","Objeto no encontrado","Objet introuvable","Objekt nicht gefunden"),
 "Top volume": ("Maior volume","Mayor volumen","Plus gros volume","Größtes Volumen"),
 "Top price": ("Maior preço","Mayor precio","Prix le plus élevé","Höchster Preis"),
 "1h": ("1h","1h","1h","1Std"),
 "Items you starred (this demo: browser-only)": ("Itens marcados com ★ (nesta demo: apenas no navegador)","Objetos marcados con ★ (en esta demo: solo en el navegador)","Objets marqués ★ (cette démo : navigateur uniquement)","Mit ★ markierte Objekte (diese Demo: nur im Browser)"),
 "No favorites yet. Tap ☆ in the list or rankings to add.": ("Nenhum favorito ainda. Toque em ☆ na lista ou nos rankings para adicionar.","Aún no hay favoritos. Toca ☆ en la lista o rankings para añadir.","Aucun favori. Touchez ☆ dans la liste ou les classements pour ajouter.","Noch keine Favoriten. Tippe ☆ in der Liste oder den Ranglisten zum Hinzufügen."),
 "Latest dev announcements (official Steam, machine-translated)": ("Últimos anúncios dos devs (Steam oficial, tradução automática)","Últimos anuncios de los desarrolladores (Steam oficial, traducción automática)","Dernières annonces des devs (Steam officiel, traduction auto)","Neueste Entwickler-Ankündigungen (offiziell auf Steam, maschinell übersetzt)"),
 "Link copied!": ("Link copiado!","¡Enlace copiado!","Lien copié !","Link kopiert!"),
 "Steam order book": ("Livro de ofertas da Steam","Libro de órdenes de Steam","Carnet d'ordres Steam","Steam-Orderbuch"),
}

LANGS = ['pt', 'es', 'fr', 'de']

def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')

src = open('demo.html', encoding='utf-8').read()
unmatched = []

# 2) DICT: "jpkey":{en:"..",ko:..,zh:..,ru:".."}  -> ru の直後に pt/es/fr/de 挿入
def dict_repl(m):
    full, jpkey, enval = m.group(0), m.group(1), m.group(2)
    tr = EN2T.get(enval) or MANUAL.get(enval)
    if not tr:
        unmatched.append(('DICT', jpkey, enval))
        return full
    ins = f', pt:"{esc(tr[0])}", es:"{esc(tr[1])}", fr:"{esc(tr[2])}", de:"{esc(tr[3])}"'
    return m.group('head') + ins + m.group('tail')

dict_pat = re.compile(r'(?P<head>"(?P<k>(?:[^"\\]|\\.)*)":\{en:"(?P<en>(?:[^"\\]|\\.)*)"[^{}]*?ru:"(?:[^"\\]|\\.)*")(?P<tail>\})')
# group(1)=k, group(2)=en は名前付きに合わせて取り直し
def dict_repl2(m):
    head, k, en, tail = m.group('head'), m.group('k'), m.group('en'), m.group('tail')
    tr = EN2T.get(en) or MANUAL.get(en)
    if not tr:
        unmatched.append(('DICT', k, en)); return m.group(0)
    ins = f', pt:"{esc(tr[0])}", es:"{esc(tr[1])}", fr:"{esc(tr[2])}", de:"{esc(tr[3])}"'
    return head + ins + tail

src, nd = dict_pat.subn(dict_repl2, src)

# 3) FT: "EnglishKey":{ja:..,ko:..,zh:..,ru:".."} -> 英語キーで EN2T 引き
def ft_repl(m):
    head, k, tail = m.group('head'), m.group('k'), m.group('tail')
    tr = EN2T.get(k) or MANUAL.get(k)
    if not tr:
        unmatched.append(('FT', k, k)); return m.group(0)
    ins = f', pt:"{esc(tr[0])}", es:"{esc(tr[1])}", fr:"{esc(tr[2])}", de:"{esc(tr[3])}"'
    return head + ins + tail

ft_pat = re.compile(r'(?P<head>"(?P<k>(?:[^"\\]|\\.)*)":\{ja:[^{}]*?ru:"(?:[^"\\]|\\.)*")(?P<tail>\})')
src, nf = ft_pat.subn(ft_repl, src)

open('demo.html', 'w', encoding='utf-8').write(src)
print('DICT updated:', nd, '| FT updated:', nf, '| unmatched:', len(unmatched))
for u in unmatched:
    print('  UNMATCHED', u)
