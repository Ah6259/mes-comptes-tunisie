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
