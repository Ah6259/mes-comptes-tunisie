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

## Technique
- `index.html` (CSP, noai, notranslate, manifeste, GoatCounter) · `assets/app.js` (tout) · `assets/style.css` ·
  `assets/protection.js` (anti-cadre + service worker) · `sw.js` (réseau d'abord pour la page ; caches `mes-comptes-*`).
- Changer le `?v=` (index.html + sw.js, même valeur) à chaque modification ; le test le vérifie.
- Tests : `node tools/test_site.mjs` (44 vérifications, jsdom ; accepte un dossier pour tester une copie sabotée).
  `tests.yml` les lance à chaque envoi. Sur le PC, jsdom est pris dans le dossier de Documents Tunisie.
- `window.MC_MAINTENANT` (tests) fixe la date du jour.

## À faire ensuite
Version arabe ; abonnement (Pass comme Documents / Code de la route, bouton de paiement commun) ; vérifier les dates
fiscales et l'abattement sur les loyers sur les textes officiels ; Search Console + sitemap du site racine.
