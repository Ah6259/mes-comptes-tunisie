# Mémoire du projet — Mes comptes

## EN TOUT PREMIER (24/11/2026, problème vu par Ahmed)
- La mémoire générale, les « update workflow » et le journal de TOUS les sites sont dans le dépôt PRIVÉ **`Ah6259/projets-ahmed`**
  (le dépôt général), PAS ici. Une session ouverte sur ce seul dépôt ne voit donc pas le dernier travail d'Ahmed (le 24/11, une session
  a répondu « dernier update workflow : 22/11 » alors qu'il y en avait deux le jour même dans projets-ahmed).
- **Au début de CHAQUE session, avant de répondre quoi que ce soit** : si `../projets-ahmed` n'existe pas, le brancher
  (`add_repo` Ah6259/projets-ahmed, puis `git clone --depth 30 https://github.com/Ah6259/projets-ahmed ../projets-ahmed`) ; sinon `git pull` ;
  puis `python3 "debut de session.py" comptes` dans `../projets-ahmed` et en résumer le résultat à Ahmed.
- « Dernier workflow / dernière mise à jour » = regarder `git log` de projets-ahmed ET de ce dépôt (toutes branches), jamais un seul.

Site de budget familial tunisien d'Ahmed (compte GitHub `Ah6259`), créé le 07/10/2026 d'après sa maquette
(page Claude privée https://claude.ai/artifact/LC54yAjXizJGbHq1oMQmWr, copie `../maquette-v1.html`) et son classeur Excel.
En ligne : https://ah6259.github.io/mes-comptes-tunisie/ — dépôt PUBLIC `Ah6259/mes-comptes-tunisie` (choix d'Ahmed :
GitHub gratuit = Pages seulement en public). Dépôt public : ne rien écrire ici de personnel ni de secret.

## Règles d'Ahmed (ne pas oublier)
- **Simple avant tout** (graphiques retirés : « ne servent à rien »). Expliquer en français simple.
- **Les alarmes doivent SONNER SUR LE TÉLÉPHONE** (une liste qu'on oublie d'ouvrir ne sert à rien) → fichier agenda .ics
  (« Mettre toutes mes alarmes sur mon téléphone ») + liens Google Agenda. « À appeler » = rappel chaque jour à 18:30
  (30 jours) ; impôt : 1 mois, 15 jours, 3 jours avant ; factures à leur rythme ; loyers le lendemain du jour de paiement.
- **Gratuit 3 mois, dit clairement dès le premier écran** ; ensuite abonnement (prix affiché avant paiement, rien de
  prélevé automatiquement). Le paiement n'est PAS encore branché (après 90 jours : message, pas de blocage).
- **Les chiffres restent dans le téléphone** (localStorage `mes-comptes-v1`) : rien n'est envoyé, rien dans le dépôt.
  Seul envoi : « Votre avis » (Formspree mwlpakqj, champ site = Mes comptes). Sauvegarde JSON + export CSV (Excel).
- **Impôt : TOUS les revenus comptent, cash ou virement** (demande d'exclure le cash refusée le 07/10 : illégal). Le cash
  et le virement sont seulement AFFICHÉS séparément. Dates fiscales d'exemple marquées « date à vérifier ».

## Contenu
Accueil (bienvenue en 3 étapes + « Voir avec un exemple » ; alarmes ; À faire Cash / Par internet / Revenus ; chiffres du
mois) · Revenus (Loyers / Salaires / Autres repliables, état par mois en liste déroulante, cash/virement, téléphone +
Appeler, Année / 3 mois / Mois) · Dépenses (une fois ou qui reviennent, mode, jour de rappel, suppression) · Impôt (dates
limites filtrables Ce mois / 3 / 6 / 12 mois / Tout ; calcul barème 2026 + loyers abattement 30 % à vérifier) · Projets
(obligatoires / futurs, faisable ?, conseils, ajouter / modifier / supprimer) · Plus (partage STEG/SONEDE par index,
méthode d'Ahmed « entre locataires seulement » par défaut ; sauvegarde ; avis ; exemple ; tout effacer).

## Page « Comment fonctionne le site ? » (25/10/2026)
- `a-propos/index.html` (page fixe écrite à la main, même en-tête / pied / CSP / GoatCounter que l'accueil, dans le plan du site),
  lien « Comment fonctionne le site ? » dans le pied de page de l'accueil et de la page. `protection.js` n'y enregistre pas le service
  worker (seulement sur une page qui a le manifeste).
- **RÈGLE D'AHMED (25/10/2026, règle commune § 44) : la page Comment fonctionne le site ? est mise à jour à CHAQUE modification visible,
  dans le même envoi ; test FONCTIONS dans `tools/test_site.mjs`** (nouvelle fonction = une ligne dans FONCTIONS + son explication
  dans la page, sinon test rouge = publication bloquée). Elle utilise le même `?v=` que index.html.

## Technique
- `index.html` (CSP, noai, notranslate, manifeste, GoatCounter) · `assets/app.js` (tout) · `assets/style.css` ·
  `assets/protection.js` (anti-cadre + service worker) · `sw.js` (réseau d'abord pour la page ; caches `mes-comptes-*`).
- Changer le `?v=` (index.html + sw.js, même valeur) à chaque modification ; le test le vérifie.
- Tests : `node tools/test_site.mjs` (53 vérifications, jsdom ; accepte un dossier pour tester une copie sabotée).
  `tests.yml` les lance à chaque envoi. Sur le PC, jsdom est pris dans le dossier de Documents Tunisie.
- `window.MC_MAINTENANT` (tests) fixe la date du jour.
- **Visiteur simulé** (règle générale du 18/10/2026, outil commun copié tel quel) : `python3 tools/visiteur_simule.py` (aussi dans tests.yml) — page à 390 px dans Chromium et `tools/scenarios-visiteur.json` : onglet Impôt rempli comme un visiteur (salaire plus haut → impôt plus haut, chef de famille et enfants → impôt plus bas, déjà retenu → reste plus petit) + « Voir avec un exemple ». Jamais de « % » dans un scénario (l'outil plante). 18/10 : en-tête plus large que l'écran (395 px) corrigé.

## À faire ensuite
Abonnement (Pass comme Documents / Code de la route, bouton de paiement commun) ; vérifier les dates
fiscales et l'abattement sur les loyers sur les textes officiels ; Search Console + sitemap du site racine.

- **Adresse depuis le 11/10/2026 : https://comptes.clicvia.com/** (CNAME comptes → ah6259.github.io, nuage gris, fichier `CNAME`). L'ancienne adresse redirige seule. GoatCounter garde le préfixe `/mes-comptes-tunisie` (`window.goatcounter.path` au début de assets/protection.js, chargé SANS defer avant count.js).

- **Visibilité Google (12/10/2026, règle commune § 8)** : liens vers nos autres sites en `https://<site>.clicvia.com/` (jamais `ah6259.github.io`), lien « Tous nos services » → https://clicvia.com/ dans le pied de page, `robots.txt` avec ligne Sitemap, `sitemap.xml` daté, JSON-LD sur l'accueil, clé IndexNow `377f054ba9c5ed40d6796adc8d87d1e8.txt` à la racine (ne pas supprimer : robot `indexnow` du portail). Contrôle : `node "outils visibilite/controle.mjs"` (dépôt projets-ahmed). Sitemap envoyé dans Search Console par Ahmed le 12/10/2026.

- **Google + Bing (12/10/2026)** : sitemap envoyé par Ahmed dans Google Search Console et dans Bing Webmaster Tools (site clicvia.com/), indexation de l'accueil demandée. Pour un nouveau site : mêmes gestes, voir `nouveau site - procedure.md` § 4 étape 5 (dépôt projets-ahmed).

- **19/10/2026 — Visiteur simulé : contrôle des ESPACES (règle commune § 29)** : nouvelle copie commune installée, 0 anomalie, aucun défaut d'espace sur ce site.

- **08/11/2026 — plan SEO d'Ahmed appliqué à ce site (phase 2 ; contrôle commun `outils visibilite/controle_seo.mjs` de projets-ahmed ;
  plan : `consignes des taches/seo-comptes.md`)** : titre de l'accueil ramené à <= 70 caractères, descriptions des 2 pages <= 165
  (avant : 75, 185 et 192, Google les coupait) ; « Gratuit 3 mois » toujours dans le titre et la description (test existant) ;
  test « SEO : titre de 10 à 70 caractères et description de 40 à 170 » dans test_site.mjs (54 vérifications), visiteur simulé 0 anomalie.

## Page 404 + Confidentialité / Conditions (17/11/2026, règle commune § 58)
- `404.html` + `404.js` à la racine = page 404 COMMUNE (`outils communs/page-404/installer.py`, projets-ahmed) : ne pas les modifier ici, réinstaller.
- Liens « Confidentialité » et « Conditions d'utilisation » (pages communes clicvia.com) dans le pied de index.html et a-propos/ ; test qui bloque dans `tools/test_site.mjs`.

## 21/11/2026 — Mode sombre lisible (signalé par Ahmed : mots illisibles en sombre) — version 20261121a
- En sombre, `--dinar` / `--ok` / `--retard` deviennent clairs : texte blanc dessus illisible (« Mettre toutes mes alarmes… », onglet « Cash », « + Ajouter… »), bouton « Annuler » du message (or sur fond clair, 1,6), carte de bienvenue claire.
  Bloc « Mode sombre lisible » à la fin de `assets/style.css` : texte foncé sur l'accent (sauf `.btn-clair`), bienvenue aux verts foncés (texte blanc), « Annuler » brun. Mode clair inchangé. Contrôle Playwright de tous les onglets avec l'exemple : 0 défaut.
- **21/11/2026 (suite) — mode CLAIR plus lisible (contraste ≥ 4,5)** : bloc clair de assets/style.css : `--ok` #17803D → #157538, `--or` #B7791F → #92600F,
  `--attention` #B45309 → #A14A08 (« 0 DT », chiffres verts, pastilles « date à vérifier », « J−6 », verdicts des projets) ; sombre inchangé.
  Contrôle de tous les onglets, vide et avec l'exemple : clair (4,5) 12 → 0, sombre 0. Version 20261121b.

## 21/11/2026 — UNE ADRESSE PAR LANGUE : version arabe « حساباتي » (règle commune § 8 point 9) — version 20261121c
- Avant : français seulement (« hreflang : aucun » au contrôle commun). Maintenant : `/` et `/a-propos/` en français seul, `/ar/` et
  `/ar/a-propos/` en arabe seul (`lang="ar" dir="rtl"`, titre, description, canonical, og:url, og:locale `ar_AR`, JSON-LD arabes),
  hreflang fr / ar / x-default (= français) identiques sur les deux pages, plan du site FR + AR avec hreflang, llms.txt.
- **`ar/index.html` et `ar/a-propos/index.html` sont FABRIQUÉES par `python3 tools/construire_ar.py`** à partir des pages françaises
  (traduction de chaque phrase de l'en-tête, des onglets et du pied dans le script ; texte de la page « Comment fonctionne le site ? »
  arabe dans `tools/a-propos-ar.html`). **Ne jamais modifier ar/ à la main** : modifier la page française (+ la traduction), puis
  relancer le script ; une phrase française changée sans sa traduction ARRÊTE la construction ; `tests.yml` lance `--verifier`.
  `ar/manifest.webmanifest` (écrit à la main : id `/ar/`, start_url ./, rtl) permet d'installer la version arabe.
- **L'application (assets/app.js) est la même pour les deux langues** : `AR` = `<html lang="ar">`, `T(fr, ar)` choisit chaque texte,
  `iso()` isole nombres et montants (« 850 د.ت », chiffres latins), mois tunisiens (جانفي… ديسمبر), agenda .ics, Google Agenda, export CSV,
  messages et exemple dans la langue de la page. **Mêmes données dans les deux langues** (localStorage `mes-comptes-v1`) : on garde des
  clés stables (catégorie en français `cat`, types, états), traduites seulement à l'affichage (`catTxt`, `CATS_AR`). Nouveau texte dans
  app.js = toujours `T("…", "…")` (le test « onglet affiché en arabe, sans mot français » le trouve sinon).
- `assets/protection.js` : langue de l'ADRESSE ; bouton `a.langue-btn` (vrai lien « ع » / « Fr ») ouvre l'autre adresse et retient le choix
  (clé `langue`) ; ancien `?lang=ar` → `ar/` ; renvoi seulement pour un visiteur venu d'une page du site, jamais robot / lien partagé / cadre ;
  service worker enregistré à la racine (`data-racine`, « ../ » sur ar/) ; sw.js : `ar/` en réseau d'abord, en cache hors connexion.
  GoatCounter : la page arabe est comptée `/mes-comptes-tunisie/ar/`.
- Style : police Noto Sans Arabic sur ar/, pas d'espacement des lettres en arabe, champs de chiffres / téléphone / e-mail de gauche à droite.
- Tests : bloc « une adresse par langue » de `tools/test_site.mjs` (104 vérifications : chaque onglet en arabe sans mot français avec
  l'exemple, montants justes, alarmes, .ics, CSV, mêmes données FR/AR, bouton et renvois) ; 8 scénarios arabes du visiteur simulé
  (ANOMALIES 0) ; mode sombre (3) et clair (4,5) : 0 défaut sur les 4 pages et les 6 onglets avec l'exemple.
- **Traductions arabes écrites par Claude : à faire relire par un arabophone** (termes fiscaux surtout : قسط احتياطي، معلوم الجولان…).

## 22/11/2026 — Google + IA (demande d'Ahmed : « que Google et les IA indexent nos sites »)
- État Search Console (21/11) : accueil « Crawled - currently not indexed » (dernière visite de Google le 12/10), aucune requête.
- JSON-LD de l'accueil (WebApplication) : éditeur `publisher` = `Organization` Clicvia (@id https://clicvia.com/#organisation, page Facebook),
  repris tel quel sur ar/ par construire_ar.py (remplacement par le début du bloc).
- « Comment fonctionne le site ? » (FR + tools/a-propos-ar.html) : « Publié par Clicvia… pour nous écrire : Votre avis, dans l'onglet Plus » +
  ligne `FONCTIONS` ; « Clicvia » ajouté aux mots latins permis sur les pages arabes (test).
- robots.txt et llms.txt (sans chiffre) déjà bons : inchangés.
