/* Adresse du site (11 octobre 2026) : comptes.clicvia.com (racine) ; l'ancienne adresse ah6259.github.io/mes-comptes-tunisie/ redirige.
   GoatCounter garde le préfixe /mes-comptes-tunisie (compteur commun à tous les sites d'Ahmed, séparés par chemin) ;
   la page arabe est donc comptée « /mes-comptes-tunisie/ar/ ». */
window.goatcounter = window.goatcounter || {};
window.goatcounter.path = function (p) { return /\.github\.io$/.test(location.hostname) ? p : "/mes-comptes-tunisie" + p; };

/* UNE ADRESSE PAR LANGUE (21/11/2026, règle commune § 8 point 9 ; méthode de Prix des Eaux et d'Outils pratiques) : chaque page existe
   en français (son adresse) et en arabe (ar/…, fabriquée par tools/construire_ar.py). Sur ces pages (<html data-langue-fixe>), la langue
   est celle de l'ADRESSE ; le bouton de langue (a.langue-btn, vrai lien) ouvre l'autre adresse en gardant l'ancre (#avis) et retient le
   choix. Un ancien lien « ?lang=ar » mène à la page arabe ; un visiteur VENU D'UNE PAGE DU SITE qui avait choisi l'autre langue est
   renvoyé vers elle. Jamais d'après la langue du téléphone seule, jamais pour un robot (Google, aperçus de partage, navigateur piloté)
   ni dans un cadre. window.allerVers = crochet des tests. Les chiffres (localStorage « mes-comptes-v1 ») sont les mêmes dans les deux langues. */
(function () {
  var h = document.documentElement, FIXE = h.getAttribute("data-langue-fixe"), autre = h.getAttribute("data-autre-langue");
  if (!FIXE || !autre) return;
  function lire() { try { var l = localStorage.getItem("langue"); return l === "fr" || l === "ar" ? l : ""; } catch (e) { return ""; } }
  function garder(l) { try { localStorage.setItem("langue", l); } catch (e) {} }
  function adresse() {
    var q = "";
    try { var p = new URLSearchParams(location.search); p["delete"]("lang"); q = p.toString(); } catch (e) {}
    return autre + (q ? "?" + q : "") + location.hash;
  }
  function aller(u) { if (window.allerVers) return window.allerVers(u); try { location.replace(u); } catch (e) {} }
  var demande = "";
  try { demande = new URLSearchParams(location.search).get("lang") || ""; } catch (e) {}
  var robot = false;
  try { robot = navigator.webdriver === true || window.top !== window.self
    || /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|lighthouse|headless/i.test(navigator.userAgent || ""); } catch (e) { robot = true; }
  var duSite = (document.referrer || "").indexOf(location.origin + "/") === 0;
  var voulue = (demande === "fr" || demande === "ar") ? demande : (duSite ? lire() : "");
  if (voulue && voulue !== FIXE && !robot) { aller(adresse()); return; }
  document.addEventListener("click", function (e) {
    var el = e.target && (e.target.nodeType === 1 ? e.target : e.target.parentElement);
    var a = el && el.closest && el.closest("a.langue-btn");
    if (!a) return;
    e.preventDefault();
    garder(FIXE === "ar" ? "fr" : "ar");
    aller(adresse());
  });
})();

/* Protection légère (consigne commune des sites d'Ahmed) : pas d'affichage dans le cadre d'un autre site,
   pas de clic droit sur les images ; puis enregistrement du service worker (installation sur le téléphone, hors connexion). */
(function () {
  try {
    if (window.top !== window.self && location.protocol !== "file:") {
      let memeSite = false;
      try { memeSite = window.top.location.origin === location.origin; } catch (e) { memeSite = false; }
      if (!memeSite) window.top.location.href = location.href;
    }
  } catch (e) {}
  document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("img, svg")) e.preventDefault(); });
  try {
    /* seulement sur les pages qui ont un manifeste (l'application, / et /ar/) : pas sur a-propos/ ; sw.js est à la racine du site
       (data-racine = « ../ » sur la page arabe), sa portée couvre les deux langues */
    var racine = document.documentElement.getAttribute("data-racine") || "";
    if ("serviceWorker" in navigator && location.protocol === "https:" && document.querySelector('link[rel="manifest"]')) navigator.serviceWorker.register(racine + "sw.js", { scope: racine || "./" }).catch(() => {});
  } catch (e) {}
})();
