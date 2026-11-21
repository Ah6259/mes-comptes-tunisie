# -*- coding: utf-8 -*-
"""UNE ADRESSE PAR LANGUE (21/11/2026, règle commune § 8 point 9 d'Ahmed : « une adresse par langue, jamais seulement ?lang= »).

Fabrique les pages ARABES de Mes comptes à partir des pages françaises écrites à la main :
  - ar/index.html        <- index.html          (l'application ; ses textes sont écrits par assets/app.js dans la langue de la page)
  - ar/a-propos/index.html <- a-propos/index.html (en-tête et pied) + tools/a-propos-ar.html (le texte arabe de la page)
Chaque phrase française de ces pages a sa traduction ci-dessous : si une phrase change dans la page française, la construction
s'ARRÊTE (« introuvable ») tant que sa traduction n'est pas mise à jour. NE JAMAIS MODIFIER ar/ À LA MAIN : modifier la page
française (et ce fichier), puis lancer   python3 tools/construire_ar.py   (ou --verifier : échoue si ar/ n'est pas à jour ;
tests.yml le lance à chaque envoi). Traductions écrites par Claude : à faire relire par un arabophone.
"""
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://comptes.clicvia.com/"
POLICE_AR = "&family=Noto+Sans+Arabic:wght@400;600;700;800"
BTN_AR = ('<a class="langue-btn" href="{h}" hreflang="fr" lang="fr" title="Lire cette page en français">'
          '<span class="lb-long">Français</span><span class="lb-court" aria-hidden="true">Fr</span></a>')

# en-tête, pied et onglets communs aux deux pages
COMMUN = [
    ('<span class="doux petit">Revenus, dépenses, impôt et rappels</span>', '<span class="doux petit">المداخيل والمصاريف والضريبة والتذكيرات</span>'),
    ("<span>Vos chiffres restent dans votre téléphone : rien n'est envoyé. Pensez à faire une sauvegarde (menu Plus).</span>",
     "<span>أرقامك تبقى في هاتفك: لا يُرسَل أي شيء. لا تنسَ حفظ نسخة احتياطية (قسم «المزيد»).</span>"),
    ("<span>Calculs indicatifs : vérifiez votre impôt avec votre comptable ou l'administration fiscale. © Mes comptes, tous droits réservés.</span>",
     "<span>حسابات تقريبية: تثبّت من ضريبتك مع محاسبك أو لدى إدارة الجباية. © حساباتي، جميع الحقوق محفوظة.</span>"),
    (">Comment fonctionne le site ?</a>", ">كيف يعمل الموقع؟</a>"),
    (">Votre avis</a>", ">رأيك</a>"),
    (">Tous nos services : clicvia.com</a>", ">كل خدماتنا: clicvia.com</a>"),
    ('href="https://clicvia.com/confidentialite/" rel="noopener">Confidentialité</a>', 'href="https://clicvia.com/ar/confidentialite/" rel="noopener">الخصوصية</a>'),
    ('href="https://clicvia.com/conditions/" rel="noopener">Conditions d’utilisation</a>', 'href="https://clicvia.com/ar/conditions/" rel="noopener">شروط الاستعمال</a>'),
]

ACCUEIL = [
    ('<html lang="fr" translate="no" data-langue-fixe="fr" data-autre-langue="ar/" data-racine="">',
     '<html lang="ar" dir="rtl" translate="no" data-langue-fixe="ar" data-autre-langue="../" data-racine="../">'),
    ("<title>Mes comptes : revenus, dépenses, impôt et rappels (gratuit 3 mois)</title>",
     "<title>حساباتي: المداخيل والمصاريف والضريبة والتذكيرات (مجاني 3 أشهر)</title>"),
    ('<meta name="description" content="Notez vos loyers, salaire et dépenses (STEG, SONEDE, école, essence…), recevez les rappels sur le téléphone, calculez votre impôt. Gratuit 3 mois.">',
     '<meta name="description" content="سجّل الكراء والأجرة والمصاريف (الستاغ، الصوناد، المدرسة، البنزين…)، واستقبل التذكيرات على هاتفك، واحسب ضريبتك. مجاني لمدة 3 أشهر.">'),
    ('<meta name="apple-mobile-web-app-title" content="Mes comptes">', '<meta name="apple-mobile-web-app-title" content="حساباتي">'),
    ('<meta property="og:title" content="Mes comptes – revenus, dépenses, impôt et rappels">', '<meta property="og:title" content="حساباتي – المداخيل والمصاريف والضريبة والتذكيرات">'),
    ('<meta property="og:description" content="Loyers, salaire, factures STEG et SONEDE, impôt, projets : tout au même endroit, avec les rappels sur votre téléphone. Gratuit 3 mois.">',
     '<meta property="og:description" content="الكراء، الأجرة، فواتير الستاغ والصوناد، الضريبة، المشاريع: كل شيء في مكان واحد، مع التذكيرات على هاتفك. مجاني لمدة 3 أشهر.">'),
    ('<meta property="og:url" content="https://comptes.clicvia.com/">', '<meta property="og:url" content="https://comptes.clicvia.com/ar/">'),
    ('<meta property="og:locale" content="fr_FR">\n<meta property="og:locale:alternate" content="ar_AR">',
     '<meta property="og:locale" content="ar_AR">\n<meta property="og:locale:alternate" content="fr_FR">'),
    ('<link rel="canonical" href="https://comptes.clicvia.com/">', '<link rel="canonical" href="https://comptes.clicvia.com/ar/">'),
    ('{"@context":"https://schema.org","@type":"WebApplication","name":"Mes comptes","url":"https://comptes.clicvia.com/","inLanguage":"fr"',
     '{"@context":"https://schema.org","@type":"WebApplication","name":"حساباتي","url":"https://comptes.clicvia.com/ar/","inLanguage":"ar"'),
    ('"description":"Revenus, dépenses, factures, impôt et rappels pour la Tunisie. Vos chiffres restent dans votre téléphone."',
     '"description":"المداخيل والمصاريف والفواتير والضريبة والتذكيرات في تونس. أرقامك تبقى في هاتفك."'),
    ('"description":"Gratuit 3 mois"}', '"description":"مجاني لمدة 3 أشهر"}'),
    ('<a class="logo" href="./"><img src="assets/icons/icon.svg" alt="" width="36" height="36"><span><h1>Mes comptes</h1>',
     '<a class="logo" href="./"><img src="assets/icons/icon.svg" alt="" width="36" height="36"><span><h1>حساباتي</h1>'),
    ('<button type="button" class="puce-essai" id="puceEssai">Gratuit 3 mois</button>', '<button type="button" class="puce-essai" id="puceEssai">مجاني 3 أشهر</button>'),
    ('aria-label="Partager ce site" title="Partager"', 'aria-label="شارك هذا الموقع" title="مشاركة"'),
    ('<nav class="onglets" aria-label="Rubriques">', '<nav class="onglets" aria-label="الأقسام">'),
    ('</svg>Accueil</button>', '</svg>الرئيسية</button>'),
    ('</svg>Revenus</button>', '</svg>المداخيل</button>'),
    ('</svg>Dépenses</button>', '</svg>المصاريف</button>'),
    ('</svg>Impôt</button>', '</svg>الضريبة</button>'),
    ('</svg>Projets</button>', '</svg>المشاريع</button>'),
    ('</svg>Plus</button>', '</svg>المزيد</button>'),
    ('<noscript><p class="note">Activez JavaScript pour utiliser Mes comptes.</p></noscript>', '<noscript><p class="note">فعّل JavaScript لاستعمال حساباتي.</p></noscript>'),
    ('aria-label="Accueil"></section>', 'aria-label="الرئيسية"></section>'),
    ('aria-label="Revenus" hidden>', 'aria-label="المداخيل" hidden>'),
    ('aria-label="Dépenses" hidden>', 'aria-label="المصاريف" hidden>'),
    ('aria-label="Impôt" hidden>', 'aria-label="الضريبة" hidden>'),
    ('aria-label="Projets" hidden>', 'aria-label="المشاريع" hidden>'),
    ('aria-label="Plus" hidden>', 'aria-label="المزيد" hidden>'),
]

A_PROPOS = [
    ('<html lang="fr" translate="no" data-langue-fixe="fr" data-autre-langue="../ar/a-propos/" data-racine="../">',
     '<html lang="ar" dir="rtl" translate="no" data-langue-fixe="ar" data-autre-langue="../../a-propos/" data-racine="../../">'),
    ("<title>Comment fonctionne le site ? – Mes comptes</title>", "<title>كيف يعمل الموقع؟ – حساباتي</title>"),
    ('<meta name="description" content="Comment fonctionne Mes comptes : revenus, dépenses, impôt, projets, facture STEG ou SONEDE partagée, alarmes sur le téléphone. Gratuit 3 mois.">',
     '<meta name="description" content="كيف يعمل موقع حساباتي: المداخيل، المصاريف، الضريبة، المشاريع، تقسيم فاتورة الستاغ أو الصوناد، المنبّهات في الهاتف. مجاني لمدة 3 أشهر.">'),
    ('<meta property="og:title" content="Comment fonctionne le site ? – Mes comptes">', '<meta property="og:title" content="كيف يعمل الموقع؟ – حساباتي">'),
    ('<meta property="og:description" content="Revenus, dépenses, impôt, projets et alarmes sur votre téléphone. Gratuit 3 mois. Vos chiffres restent dans votre téléphone.">',
     '<meta property="og:description" content="المداخيل والمصاريف والضريبة والمشاريع والمنبّهات على هاتفك. مجاني لمدة 3 أشهر. أرقامك تبقى في هاتفك.">'),
    ('<meta property="og:url" content="https://comptes.clicvia.com/a-propos/">', '<meta property="og:url" content="https://comptes.clicvia.com/ar/a-propos/">'),
    ('<meta property="og:locale" content="fr_FR">\n<meta property="og:locale:alternate" content="ar_AR">',
     '<meta property="og:locale" content="ar_AR">\n<meta property="og:locale:alternate" content="fr_FR">'),
    ('<link rel="canonical" href="https://comptes.clicvia.com/a-propos/">', '<link rel="canonical" href="https://comptes.clicvia.com/ar/a-propos/">'),
    ('"@type":"AboutPage","name":"Comment fonctionne le site ?","url":"https://comptes.clicvia.com/a-propos/","inLanguage":"fr","isPartOf":{"@type":"WebSite","name":"Mes comptes","url":"https://comptes.clicvia.com/"}',
     '"@type":"AboutPage","name":"كيف يعمل الموقع؟","url":"https://comptes.clicvia.com/ar/a-propos/","inLanguage":"ar","isPartOf":{"@type":"WebSite","name":"حساباتي","url":"https://comptes.clicvia.com/ar/"}'),
    ('<span class="nom-site">Mes comptes</span>', '<span class="nom-site">حساباتي</span>'),
    ('<a class="btn btn-ouvrir" href="../">Ouvrir Mes comptes</a>', '<a class="btn btn-ouvrir" href="../">افتح حساباتي</a>'),
]


def remplacer(s, paires, page):
    for fr, ar in paires:
        if s.count(fr) < 1:
            sys.exit(f"construire_ar : « {fr[:80]} » introuvable dans {page} : mettez à jour sa traduction dans tools/construire_ar.py")
        s = s.replace(fr, ar)
    return s


def bouton(s, href, page):
    s2, n = re.subn(r'<a class="langue-btn"[^>]*>.*?</a>', BTN_AR.format(h=href), s, flags=re.S)
    if n != 1:
        sys.exit(f"construire_ar : bouton de langue absent de {page}")
    return s2


def police(s):
    return re.sub(r'(fonts\.googleapis\.com/css2\?[^"]*?)(&display=swap)', lambda m: m.group(1) + POLICE_AR + m.group(2), s, count=1)


def lire(p):
    with open(os.path.join(RACINE, p), encoding="utf-8") as f:
        return f.read()


def accueil():
    s = lire("index.html")
    s = remplacer(s, ACCUEIL + COMMUN, "index.html")
    s = bouton(s, "../", "index.html")
    # fichiers communs : un dossier plus haut (le manifeste arabe est ar/manifest.webmanifest, à côté de la page)
    s = s.replace('"assets/', '"../assets/')
    return police(s)


def a_propos():
    s = lire("a-propos/index.html")
    s = remplacer(s, A_PROPOS + COMMUN, "a-propos/index.html")
    s = bouton(s, "../../a-propos/", "a-propos/index.html")
    s = s.replace('"../assets/', '"../../assets/')
    corps = lire("tools/a-propos-ar.html").strip()
    s, n = re.subn(r"<main class=\"page page-ap\">.*?</main>", lambda m: corps, s, flags=re.S)
    if n != 1:
        sys.exit("construire_ar : <main> absent de a-propos/index.html")
    return police(s)


PAGES = {"ar/index.html": accueil, "ar/a-propos/index.html": a_propos}


def main():
    verifier = "--verifier" in sys.argv
    mal = []
    for chemin, f in PAGES.items():
        html = f()
        p = os.path.join(RACINE, chemin)
        ancien = open(p, encoding="utf-8").read() if os.path.exists(p) else None
        if verifier:
            if ancien != html:
                mal.append(chemin)
            continue
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(html)
        print("écrit", chemin)
    if mal:
        sys.exit("construire_ar --verifier : pages arabes pas à jour (lancer python3 tools/construire_ar.py) : " + ", ".join(mal))
    if verifier:
        print("pages arabes à jour")


if __name__ == "__main__":
    main()
