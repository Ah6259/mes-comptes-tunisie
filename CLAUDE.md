# Mémoire du projet — Mes comptes

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
Version arabe ; abonnement (Pass comme Documents / Code de la route, bouton de paiement commun) ; vérifier les dates
fiscales et l'abattement sur les loyers sur les textes officiels ; Search Console + sitemap du site racine.

- **Adresse depuis le 11/10/2026 : https://comptes.clicvia.com/** (CNAME comptes → ah6259.github.io, nuage gris, fichier `CNAME`). L'ancienne adresse redirige seule. GoatCounter garde le préfixe `/mes-comptes-tunisie` (`window.goatcounter.path` au début de assets/protection.js, chargé SANS defer avant count.js).

- **Visibilité Google (12/10/2026, règle commune § 8)** : liens vers nos autres sites en `https://<site>.clicvia.com/` (jamais `ah6259.github.io`), lien « Tous nos services » → https://clicvia.com/ dans le pied de page, `robots.txt` avec ligne Sitemap, `sitemap.xml` daté, JSON-LD sur l'accueil, clé IndexNow `377f054ba9c5ed40d6796adc8d87d1e8.txt` à la racine (ne pas supprimer : robot `indexnow` du portail). Contrôle : `node "outils visibilite/controle.mjs"` (dépôt projets-ahmed). Sitemap envoyé dans Search Console par Ahmed le 12/10/2026.

- **Google + Bing (12/10/2026)** : sitemap envoyé par Ahmed dans Google Search Console et dans Bing Webmaster Tools (site clicvia.com/), indexation de l'accueil demandée. Pour un nouveau site : mêmes gestes, voir `nouveau site - procedure.md` § 4 étape 5 (dépôt projets-ahmed).

- **19/10/2026 — Visiteur simulé : contrôle des ESPACES (règle commune § 29)** : nouvelle copie commune installée, 0 anomalie, aucun défaut d'espace sur ce site.
