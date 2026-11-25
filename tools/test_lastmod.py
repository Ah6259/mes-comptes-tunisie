# -*- coding: utf-8 -*-
"""TEST des dates honnêtes du plan du site et des pages maigres (plan Google du 25/11/2026, outil commun tools/lastmod.py).

    python tools/test_lastmod.py <memoire.json>        (ex. donnees/lastmod.json)

1. Données INVENTÉES (dossier temporaire) : une page inchangée garde sa date même si son ?v=, son menu ou sa date de
   fabrication changent ; une page changée prend la date du jour ; une page nouvelle aussi ; une page noindex sort du plan.
2. VRAI plan du site : plus de 10 adresses -> pas toutes à la date du jour ; aucune page noindex dans le plan ; l'accueil
   est dans le plan et n'est pas noindex ; dates = celles de la mémoire et empreintes à jour ; aucune date dans le futur.
Sortie : « OK … » (code 0) ou « ÉCHEC - … » (code 1).
"""
import datetime as dt
import os
import re
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
sys.path.insert(0, ICI)
import lastmod  # noqa: E402

FAUTES = []


def verifier(cond, message):
    if not cond:
        FAUTES.append(message)


def page(titre, texte, v="1", jour="01/01/2026", robots=""):
    meta = f'<meta name="robots" content="{robots}">' if robots else ""
    return (f'<!doctype html><html><head><title>{titre}</title><meta name="description" content="Description {titre}">{meta}'
            f'<link rel="stylesheet" href="style.css?v={v}"></head><body><nav><a href="/">Menu {v}</a></nav>'
            f'<main><h1>{titre}</h1><p>{texte}</p><p>Page fabriquée le {jour}</p><img src="photo.jpg?v={v}"></main>'
            f'<footer>Pied {v}</footer><script>var v="{v}";</script></body></html>')


def donnees_inventees():
    base = "https://exemple.clicvia.com/"
    with tempfile.TemporaryDirectory() as d:
        def ecrire_pages(pages):
            for chemin, contenu in pages.items():
                os.makedirs(os.path.join(d, chemin), exist_ok=True)
                open(os.path.join(d, chemin, "index.html"), "w", encoding="utf-8").write(contenu)

        def plan(chemins):
            return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                    + "".join(f"  <url><loc>{base}{c}</loc><lastmod>2099-01-01</lastmod></url>\n" for c in chemins) + "</urlset>\n")

        chemins = [""] + [f"p{i}/" for i in range(12)]
        ecrire_pages({c: page("Titre " + c, "Texte de la page " + c) for c in chemins})
        x1 = lastmod.honnete(plan(chemins), d, base, "memoire.json", aujourd_hui="2026-10-01", git=False)
        dates1 = dict(re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>", x1))
        verifier(set(dates1.values()) == {"2026-10-01"}, "inventé : 1er passage sans histoire git -> date du jour du passage")
        # 2e passage : ?v=, menu, pied, script et date de fabrication changent partout ; p3 change de texte ; p11 devient noindex ; p12 nouvelle
        pages = {c: page("Titre " + c, "Texte de la page " + c, v="2", jour="25/11/2026") for c in chemins}
        pages["p3/"] = page("Titre p3/", "Texte NOUVEAU de la page p3", v="2")
        pages["p11/"] = page("Titre p11/", "Texte", v="2", robots="noindex,follow")
        pages["p12/"] = page("Titre p12/", "Page toute neuve", v="2")
        ecrire_pages(pages)
        x2 = lastmod.honnete(plan(chemins + ["p12/"]), d, base, "memoire.json", aujourd_hui="2026-11-25", git=False)
        dates2 = dict(re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>", x2))
        verifier(dates2.get(base + "p0/") == "2026-10-01", f"inventé : page inchangée (seuls ?v=, menu, pied, date de fabrication) -> date gardée (vu {dates2.get(base + 'p0/')})")
        verifier(dates2.get(base) == "2026-10-01", "inventé : accueil inchangé -> date gardée")
        verifier(dates2.get(base + "p3/") == "2026-11-25", "inventé : page dont le texte change -> date du jour")
        verifier(dates2.get(base + "p12/") == "2026-11-25", "inventé : page nouvelle -> date du jour")
        verifier(base + "p11/" not in dates2, "inventé : page noindex retirée du plan du site")
        # 3e passage, rien ne change : rien ne bouge
        x3 = lastmod.honnete(plan(chemins + ["p12/"]), d, base, "memoire.json", aujourd_hui="2026-12-01", git=False)
        verifier(x3 == x2, "inventé : 3e passage sans changement -> plan identique")
        # mots propres : menus et pied ne comptent pas
        verifier(lastmod.mots_propres(page("A", "un deux trois")) == 7, f"inventé : mots propres (vu {lastmod.mots_propres(page('A', 'un deux trois'))})")


def vrai_plan(memoire):
    xml = open(os.path.join(RACINE, "sitemap.xml"), encoding="utf-8").read()
    base = lastmod.base_du_plan(xml)
    paires = re.findall(r"<loc>([^<]+)</loc>\s*(?:<lastmod>([^<]*)</lastmod>)?", xml)
    auj = dt.date.today().isoformat()
    mem = lastmod.lire_memoire(os.path.join(RACINE, memoire))
    verifier(paires, "plan du site vide")
    dates = [d for _, d in paires]
    verifier(all(dates), "une adresse du plan du site sans <lastmod>")
    if len(paires) > 10:
        verifier(any(d != auj for d in dates), f"les {len(paires)} adresses du plan du site ont toutes la date du jour ({auj}) : lastmod pas honnête")
    verifier(all(d <= auj for d in dates if d), "date dans le futur dans le plan du site")
    verifier(base in [l for l, _ in paires], f"l'accueil {base} n'est pas dans le plan du site")
    n_page = 0
    for loc, date in paires:
        f = lastmod.fichier_de(loc, base, RACINE)
        if not f:
            continue
        n_page += 1
        h = open(f, encoding="utf-8", errors="replace").read()
        if lastmod.est_noindex(h):
            FAUTES.append(f"page noindex dans le plan du site : {loc}")
            continue
        m = mem.get(loc)
        if not m:
            FAUTES.append(f"adresse absente de la mémoire {memoire} : {loc}")
        elif m.get("empreinte") != lastmod.empreinte(h) or m.get("date") != date:
            FAUTES.append(f"mémoire {memoire} pas à jour pour {loc} (relancer la fabrication des pages)")
        if len(FAUTES) > 20:
            break
    acc = lastmod.fichier_de(base, base, RACINE)
    verifier(acc and not lastmod.est_noindex(open(acc, encoding="utf-8").read()), "l'accueil est noindex")
    return len(paires), n_page, len(set(dates))


def main():
    if len(sys.argv) < 2:
        print("usage : python tools/test_lastmod.py <memoire.json>")
        return 2
    donnees_inventees()
    n, n_page, n_dates = vrai_plan(sys.argv[1])
    if FAUTES:
        print("ÉCHEC - " + "\n  ".join(FAUTES[:25]))
        return 1
    print(f"OK - dates honnêtes du plan du site : {n} adresse(s) ({n_page} pages vérifiées), {n_dates} date(s) différente(s), "
          "aucune page noindex dans le plan, données inventées OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
