# -*- coding: utf-8 -*-
"""DATES HONNÊTES DU PLAN DU SITE (lastmod) et PAGES MAIGRES — plan Google d'Ahmed du 25/11/2026 (B.1 et B.2).

Outil COMMUN, copié TEL QUEL dans chaque site (même fichier partout ; ne pas le modifier dans un seul site).

Pourquoi : après la chute Google d'octobre 2026, le plan du site (sitemap.xml) donnait la date du jour à TOUTES les pages
(changement de ?v=, date de fabrication…) : Google n'y croit plus. Ici, chaque adresse garde la date du dernier VRAI changement
de son contenu :
  - une EMPREINTE du contenu utile de la page (titre, description, texte et images du corps, SANS menus, pied de page, scripts,
    styles, ?v=, dates) est gardée dans un petit fichier JSON du dépôt (la « mémoire », ex. donnees/lastmod.json) ;
  - la date ne change que si l'empreinte change ; une adresse nouvelle prend la date du jour ;
  - une page « noindex » (page maigre, redirection…) sort du plan du site.

Utilisation dans un générateur (après avoir écrit les pages) :
    import lastmod
    xml = lastmod.honnete(xml, RACINE, BASE, "donnees/lastmod.json")        # renvoie le plan avec les bonnes dates
    xml = lastmod.honnete(xml, RACINE, BASE, memoire, ecrire_memoire=False)  # mode « vérifier » : ne touche à rien
ou, pour un plan du site déjà écrit sur le disque :
    python tools/lastmod.py <memoire.json>          (refait sitemap.xml en place)
Premier passage (mémoire vide) : la date vient de l'HISTOIRE GIT de la page (dernier commit où son empreinte a changé ;
sans histoire : date du dernier commit qui a touché le fichier), jamais inventée.
Pages maigres : lastmod.mots_propres(html) = nombre de mots du contenu propre (hors menus, en-tête, pied, scripts).
Test commun : tools/test_lastmod.py (données inventées + vrai plan du site).
"""
import datetime as dt
import hashlib
import html as H
import json
import os
import re
import subprocess
import sys

_URL = re.compile(r"<url>(.*?)</url>", re.S)
_LOC = re.compile(r"<loc>([^<]+)</loc>")
_LASTMOD = re.compile(r"<lastmod>[^<]*</lastmod>")
_NOINDEX = re.compile(r"<meta\s+name=[\"']robots[\"']\s+content=[\"'][^\"']*noindex", re.I)


def _sans(html, *balises):
    for b in balises:
        html = re.sub(rf"<{b}\b[^>]*>.*?</{b}>", " ", html, flags=re.S | re.I)
    return html


def texte_utile(html):
    """Le contenu UTILE d'une page : titre, description, texte et images du corps (sans menus, pied de page, scripts, styles,
    numéros de version ?v= ni dates du jour)."""
    titre = " ".join(re.findall(r"<title>(.*?)</title>", html, re.S))
    desc = " ".join(re.findall(r"<meta\s+name=[\"']description[\"']\s+content=[\"']([^\"']*)", html, re.I))
    robots = "noindex" if _NOINDEX.search(html) else ""
    m = re.search(r"<body\b[^>]*>(.*)</body>", html, re.S | re.I)
    corps = m.group(1) if m else html
    corps = re.sub(r"<!--.*?-->", " ", corps, flags=re.S)
    corps = _sans(corps, "script", "style", "nav", "footer", "noscript", "template")
    images = " ".join(re.findall(r"<img\b[^>]*?\ssrc=[\"']([^\"']+)", corps, re.I))
    texte = re.sub(r"<[^>]+>", " ", corps)
    tout = H.unescape(" ".join([titre, desc, robots, texte, images]))
    tout = re.sub(r"\?v=[0-9A-Za-z._-]+", "", tout)
    tout = re.sub(r"\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b|\b\d{4}-\d{2}-\d{2}(?:T[\d:.+Z-]+)?\b|\b\d{1,2}\s?h\s?\d{2}\b", " ", tout)
    return re.sub(r"\s+", " ", tout).strip()


def empreinte(html):
    return hashlib.sha256(texte_utile(html).encode("utf-8")).hexdigest()[:16]


def mots_propres(html):
    """Nombre de mots du contenu PROPRE d'une page (corps sans menus, en-tête, pied de page, scripts ni styles)."""
    m = re.search(r"<body\b[^>]*>(.*)</body>", html, re.S | re.I)
    corps = re.sub(r"<!--.*?-->", " ", m.group(1) if m else html, flags=re.S)
    corps = _sans(corps, "script", "style", "nav", "footer", "header", "noscript", "template", "form", "button", "select")
    texte = H.unescape(re.sub(r"<[^>]+>", " ", corps))
    return len(re.findall(r"[^\W\d_][^\W_]*", texte))


def est_noindex(html):
    return bool(_NOINDEX.search(html))


def fichier_de(loc, base, racine):
    """Adresse du plan du site -> fichier de la page sur le disque (None si l'adresse n'est pas une page du dépôt)."""
    if not loc.startswith(base):
        return None
    chemin = loc[len(base):].split("#")[0].split("?")[0]
    if chemin == "" or chemin.endswith("/"):
        chemin += "index.html"
    f = os.path.join(racine, *chemin.split("/"))
    return f if os.path.isfile(f) else None


def lire_memoire(fichier):
    try:
        return json.load(open(fichier, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def ecrire_memoire_fichier(fichier, memoire):
    os.makedirs(os.path.dirname(os.path.abspath(fichier)), exist_ok=True)
    texte = "{\n" + ",\n".join(f"{json.dumps(k, ensure_ascii=False)}: {json.dumps(memoire[k], ensure_ascii=False, sort_keys=True)}"
                               for k in sorted(memoire)) + "\n}\n"
    ancien = open(fichier, encoding="utf-8").read() if os.path.exists(fichier) else None
    if ancien != texte:
        open(fichier, "w", encoding="utf-8", newline="\n").write(texte)


def _git(racine, *args):
    return subprocess.run(["git", "-C", racine, *args], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout


def date_git(racine, fichier, emp):
    """Premier passage : date du dernier commit où l'empreinte de la page a changé (on remonte l'histoire tant qu'elle est la même).
    Sans histoire utilisable : date du dernier commit qui a touché le fichier ; sinon None."""
    rel = os.path.relpath(fichier, racine).replace(os.sep, "/")
    lignes = [l.split() for l in _git(racine, "log", "--format=%H %cs", "--", rel).splitlines() if l.strip()]
    if not lignes:
        return None
    date = lignes[0][1]
    for h, d in lignes:
        contenu = subprocess.run(["git", "-C", racine, "show", f"{h}:{rel}"], capture_output=True).stdout.decode("utf-8", "replace")
        if not contenu or empreinte(contenu) != emp:
            break
        date = d
    return date


def honnete(xml, racine, base, memoire_fichier, aujourd_hui=None, ecrire_memoire=True, git=True):
    """Remet dans le plan du site (texte XML) la date du dernier vrai changement de chaque page, et retire les pages noindex.
    memoire_fichier : chemin (relatif à racine ou absolu) du JSON {adresse: {"empreinte", "date"}}."""
    aujourd_hui = aujourd_hui or dt.date.today().isoformat()
    chemin_mem = memoire_fichier if os.path.isabs(memoire_fichier) else os.path.join(racine, memoire_fichier)
    ancienne = lire_memoire(chemin_mem)
    nouvelle = {}

    def un(m):
        bloc = m.group(1)
        loc = (_LOC.search(bloc) or [None, None])[1]
        f = fichier_de(loc, base, racine) if loc else None
        if not f:                                     # pas une page du dépôt : laissée telle quelle
            return m.group(0)
        page = open(f, encoding="utf-8", errors="replace").read()
        if est_noindex(page):                         # page maigre, redirection… : jamais proposée à Google
            return ""
        emp = empreinte(page)
        avant = ancienne.get(loc)
        if avant and avant.get("empreinte") == emp and avant.get("date"):
            date = avant["date"]
        elif avant:                                   # contenu changé
            date = aujourd_hui
        else:                                         # adresse inconnue de la mémoire
            date = (date_git(racine, f, emp) if git else None) or aujourd_hui
            date = min(date, aujourd_hui)
        nouvelle[loc] = {"date": date, "empreinte": emp}
        bloc2 = _LASTMOD.sub(f"<lastmod>{date}</lastmod>", bloc, count=1) if _LASTMOD.search(bloc) else \
            bloc.replace("</loc>", f"</loc><lastmod>{date}</lastmod>", 1)
        return "<url>" + bloc2 + "</url>"

    sortie = _URL.sub(un, xml)
    sortie = re.sub(r"\n[ \t]*\n", "\n", sortie)
    if ecrire_memoire:
        ecrire_memoire_fichier(chemin_mem, nouvelle)
    return sortie


def base_du_plan(xml):
    loc = _LOC.search(xml)
    if not loc:
        return ""
    m = re.match(r"(https?://[^/]+/)", loc.group(1))
    return m.group(1) if m else ""


if __name__ == "__main__":
    # python tools/lastmod.py <memoire.json> [racine] : refait les dates du sitemap.xml déjà écrit
    racine = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    plan = os.path.join(racine, "sitemap.xml")
    xml = open(plan, encoding="utf-8").read()
    nouveau = honnete(xml, racine, base_du_plan(xml), sys.argv[1])
    if nouveau != xml:
        open(plan, "w", encoding="utf-8", newline="\n").write(nouveau)
    print(f"plan du site : {len(_URL.findall(nouveau))} adresse(s), dates du dernier vrai changement (mémoire {sys.argv[1]})")
