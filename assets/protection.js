/* Adresse du site (11 octobre 2026) : comptes.clicvia.com (racine) ; l'ancienne adresse ah6259.github.io/mes-comptes-tunisie/ redirige.
   GoatCounter garde le préfixe /mes-comptes-tunisie (compteur commun à tous les sites d'Ahmed, séparés par chemin). */
window.goatcounter = window.goatcounter || {};
window.goatcounter.path = function (p) { return /\.github\.io$/.test(location.hostname) ? p : "/mes-comptes-tunisie" + p; };
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
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
  } catch (e) {}
})();
