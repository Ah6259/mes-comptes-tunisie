// Tests de Mes comptes (faux navigateur jsdom) — à lancer après chaque modification :  node tools/test_site.mjs
// Accepte un dossier en argument pour tester une copie sabotée.
import { readFileSync, existsSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const require = createRequire(import.meta.url);
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require("jsdom")); }
catch (e) { ({ JSDOM, VirtualConsole } = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), "../../../documents Tunisie/site/package.json"))("jsdom")); }

const root = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = f => readFileSync(join(root, f), "utf8");
let erreurs = 0, total = 0;
const check = (desc, ok) => { total++; if (ok) console.log("OK   " + desc); else { erreurs++; console.log("FAIL " + desc); } };

// chemin = "index.html" (français) ou "ar/index.html" (arabe, une adresse par langue) ; protection = true : protection.js est joué aussi
async function page({ quand = "2026-10-22T19:00:00", stockage = {}, chemin = "index.html", protection = false, adresse = null, referrer = "", allerVers = null } = {}) {
  const html = lire(chemin).replace(/<script[^>]*gc\.zgo\.at[^>]*><\/script>/, "")
    .replace(/<script defer src="(?:\.\.\/)*(assets\/[^"?]+)(\?[^"]*)?"><\/script>/g, (_, f) => `<script>${lire(f)}</script>`)
    .replace(/<script src="(?:\.\.\/)*(assets\/protection\.js)(\?[^"]*)?"><\/script>/, (_, f) => protection ? `<script>${lire(f)}</script>` : "");
  const vc = new VirtualConsole(), js = [];
  vc.on("jsdomError", e => { if (!/Not implemented/.test(e.message)) js.push(e.message); });
  const dom = new JSDOM(html, { url: adresse || "https://comptes.clicvia.com/" + chemin.replace("index.html", ""), ...(referrer ? { referrer } : {}), runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (allerVers) w.allerVers = allerVers;
      w.MC_MAINTENANT = quand;
      for (const [k, v] of Object.entries(stockage)) w.localStorage.setItem(k, v);
      w.__fichiers = []; w.URL.createObjectURL = b => { w.__fichiers.push(b); return "blob:x"; }; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () {};
      w.scrollTo = () => {};
    } });
  await new Promise(r => setTimeout(r, 50));
  return { w: dom.window, d: dom.window.document, js };
}
const clic = (d, sel) => { const e = d.querySelector(sel); if (!e) throw new Error("introuvable : " + sel); e.click(); return e; };
const stock = w => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
const remplir = (w, form, v) => { for (const [k, x] of Object.entries(v)) form.elements[k].value = x; form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true })); };

// ---- 1. page, sécurité, installation
const html = lire("index.html");
check("index : CSP sans script en ligne, noai, referrer, pas de traduction auto", /http-equiv="Content-Security-Policy"/.test(html) && /noai, noimageai/.test(html) && /strict-origin-when-cross-origin/.test(html)
  && /<html lang="fr" translate="no"[^>]*>/.test(html) && /name="google" content="notranslate"/.test(html) && !/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>/.test(html) && !/\son[a-z]+=/i.test(html));
check("index : même ?v= pour style, app et protection ; sw.js le connaît", (() => { const v = [...html.matchAll(/\?v=(\w+)/g)].map(m => m[1]); const sw = lire("sw.js");
  return v.length === 3 && new Set(v).size === 1 && sw.includes(v[0]); })());
check("installation : manifeste, icônes 192/512/maskable/180, service worker", ["manifest.webmanifest", "sw.js", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png", "assets/icons/icon-180.png", "assets/og-image-v1.jpg"].every(f => existsSync(join(root, f)))
  && JSON.parse(lire("manifest.webmanifest")).id === "/");
check("vie privée : app.js n'envoie rien ailleurs que « Votre avis » (Formspree) ; aucune donnée dans le dépôt", (lire("assets/app.js").match(/fetch\(/g) || []).length === 1 && /fetch\("https:\/\/formspree\.io/.test(lire("assets/app.js")));
check("« Gratuit 3 mois » annoncé dès la page (titre, description)", /gratuit 3 mois/i.test(html) && /Gratuit 3 mois/.test(html));

// ---- 2. premier lancement
{
  const { d, js } = await page();
  check("premier lancement : aucune erreur JavaScript", js.length === 0);
  check("premier lancement : écran de bienvenue en 3 étapes + « Voir avec un exemple »", /Bienvenue dans Mes comptes/.test(d.body.textContent) && d.querySelectorAll(".bienvenue ol li").length === 3 && d.querySelector('[data-a="exemple"]'));
  check("bandeau d'essai : « Gratuit pendant 3 mois », 90 jours, rien de prélevé", /Gratuit pendant 3 mois/.test(d.body.textContent) && /90 jours/.test(d.body.textContent) && /Rien n'est prélevé automatiquement/.test(d.body.textContent));
}

// ---- 3. exemple, alarmes, à faire
{
  const { w, d, js } = await page();
  clic(d, '[data-a="exemple"]');
  const M = w.MesComptes, D = M.donnees();
  check("exemple : 5 revenus (3 loyers, 1 salaire, 1 autre), aucune erreur", D.revenus.length === 5 && D.revenus.filter(r => r.type === "loyer").length === 3 && js.length === 0);
  const A = M.alarmes().map(a => a.titre).join(" | ");
  check("alarme « À appeler » à 19:00 : « C'est l'heure : appeler … » en rouge", /C'est l'heure : appeler/.test(A) && M.alarmes()[0].niv === 0);
  check("alarmes : loyer non payé après le 5, facture non payée après sa date, impôt à J−6", /Loyer non payé/.test(A) && /Facture non payée/.test(A) && /Impôt dans 6 jours/.test(A));
  check("accueil : compteur rouge sur l'onglet, bouton « Mettre toutes mes alarmes sur mon téléphone »", !d.getElementById("nbAlarmes").hidden && d.querySelector('[data-a="ics-tout"]'));
  clic(d, '[data-a="sous"][data-s="revenus"]');
  check("à faire / Revenus : les revenus attendus avec « Reçu », « À appeler » et « Appeler »", d.querySelectorAll("#vue-accueil .taches .tache").length >= 2 && d.querySelector('#vue-accueil .taches [data-a="recu"]') && d.querySelector('#vue-accueil .taches a[href^="tel:+21600000"]'));
  const rv = D.revenus[1], ym = "2026-10";
  clic(d, `#vue-accueil .taches [data-a="recu"][data-id="${rv.id}"]`);
  check("« Reçu » : le loyer passe à reçu et sort de « À faire »", D.etats[rv.id + "|" + ym] === "r" && !d.querySelector(`#vue-accueil .taches [data-a="recu"][data-id="${rv.id}"]`));
  clic(d, '[data-a="sous"][data-s="internet"]');
  const avant = D.depenses.length; clic(d, '#vue-accueil .taches [data-a="payer"]');
  check("« Payé » sur une facture : notée payée, ajoutée aux dépenses du mois", D.depenses.length === avant + 1 && Object.keys(D.payes).length >= 3);
  check("tout est gardé dans le téléphone (localStorage)", JSON.parse(w.localStorage.getItem("mes-comptes-v1")).revenus.length === 5);
  // rechargement
  const p2 = await page({ stockage: stock(w) });
  check("après rechargement : les données sont toujours là, pas d'écran de bienvenue", p2.w.MesComptes.donnees().revenus.length === 5 && !/Bienvenue dans Mes comptes/.test(p2.d.body.textContent));
}

// ---- 4. agenda du téléphone (.ics)
{
  const { w, d } = await page(); clic(d, '[data-a="exemple"]');
  const evs = w.MesComptes.tousLesRappels(), ics = w.MesComptes.fichierIcs(evs);
  check("agenda : un fichier .ics avec tous les rappels (revenus, factures, impôt, appel)", evs.length >= 10 && /^BEGIN:VCALENDAR\r\n/.test(ics) && /END:VCALENDAR\r\n$/.test(ics) && (ics.match(/BEGIN:VEVENT/g) || []).length === evs.length);
  check("agenda : « À appeler » chaque jour à 18:30 pendant 30 jours, avec alarme", /DTSTART:20261022T183000/.test(ics) && /RRULE:FREQ=DAILY;COUNT=30/.test(ics) && /BEGIN:VALARM/.test(ics));
  check("agenda : impôt rappelé 1 mois, 15 jours et 3 jours avant", /TRIGGER:-P30D/.test(ics) && /TRIGGER:-P15D/.test(ics) && /TRIGGER:-P3D/.test(ics));
  check("agenda : lignes de 75 caractères au plus (norme), factures répétées chaque mois / tous les 2 ou 3 mois", ics.split("\r\n").every(l => l.length <= 75) && /RRULE:FREQ=MONTHLY;INTERVAL=2/.test(ics) && /RRULE:FREQ=MONTHLY;INTERVAL=3/.test(ics));
  clic(d, '[data-a="ics-tout"]');
  check("« Mettre toutes mes alarmes sur mon téléphone » télécharge le fichier agenda", w.__fichiers.length === 1 && w.__fichiers[0].type === "text/calendar");
  check("lien Google Agenda pré-rempli (heure de Tunis, répétition)", /calendar\.google\.com\/calendar\/render\?action=TEMPLATE/.test(w.MesComptes.lienGoogle(evs[0])) && /ctz=Africa%2FTunis/.test(w.MesComptes.lienGoogle(evs[0])));
}

// ---- 5. revenus : ajouter, modifier, supprimer, catégories repliables
{
  const { w, d } = await page(); clic(d, 'nav [data-vue="revenus"]');
  remplir(w, d.querySelector('form[data-f="revenu"]'), { type: "salaire", nom: "Salaire test", montant: "2500", mode: "virement", jour: "28", locataire: "Employeur" });
  const D = w.MesComptes.donnees();
  check("ajouter un salaire (virement) : il apparaît dans la catégorie Salaires", D.revenus.length === 1 && D.revenus[0].mode === "virement" && /Salaires/.test(d.getElementById("vue-revenus").textContent));
  remplir(w, d.querySelector('form[data-f="revenu"]'), { type: "loyer", nom: "Studio", montant: "600", mode: "cash", jour: "5", locataire: "Locataire test", tel: "+216 00 000 009" });
  const studio = D.revenus.find(r => r.nom === "Studio");
  const sel = d.querySelector(`select[data-a="etat"][data-id="${studio.id}"]`);
  check("chaque mois a une liste : Reçu / En retard / À appeler / Attendu / Gratuit / Pas loué", [...sel.options].map(o => o.textContent).join("/") === "Reçu/En retard/À appeler/Attendu/Gratuit (travaux)/Pas loué");
  sel.value = "p"; sel.dispatchEvent(new w.Event("change", { bubbles: true }));
  check("choisir « À appeler » crée l'alarme de 18:30", w.MesComptes.alarmes().some(a => /appeler Locataire test/.test(a.titre)));
  clic(d, '[data-a="replier"][data-t="loyer"]');
  check("flèche : la catégorie Loyers se replie (et reste repliée)", !d.querySelector(`select[data-a="etat"][data-id="${studio.id}"]`) && D.replie.includes("loyer"));
  clic(d, '[data-a="replier"][data-t="loyer"]');
  clic(d, `[data-a="modif-rev"][data-id="${studio.id}"]`);
  remplir(w, d.querySelector(`form[data-f="revenu"][data-id="${studio.id}"]`), { montant: "650" });
  check("modifier un revenu", studio.montant === 650);
  clic(d, `[data-a="suppr-rev"][data-id="${studio.id}"]`);
  check("supprimer un revenu, avec « Annuler »", D.revenus.length === 1 && /Annuler/.test(d.getElementById("toast").textContent));
  clic(d, "#btnAnnuler");
  check("« Annuler » remet le revenu", w.MesComptes.donnees().revenus.length === 2);
}

// ---- 6. dépenses
{
  const { w, d } = await page(); clic(d, 'nav [data-vue="depenses"]');
  remplir(w, d.querySelector('form[data-f="depense"]'), { quoi: "Ooredoo", montant: "102", cat: "Téléphone et internet", freq: "mois", mode: "internet", jour: "15" });
  remplir(w, d.querySelector('form[data-f="depense"]'), { quoi: "Cadeau", montant: "80", cat: "Autre", freq: "1", mode: "cash", jour: "" });
  const D = w.MesComptes.donnees();
  check("dépense « chaque mois » : notée ce mois et ajoutée aux dépenses qui reviennent ; « une seule fois » : seulement ce mois", D.depenses.length === 2 && D.recurrentes.length === 1 && D.recurrentes[0].freq === "mois");
  clic(d, `[data-a="suppr-dep"][data-id="${D.depenses[1].id}"]`);
  check("supprimer une dépense", w.MesComptes.donnees().depenses.length === 1);
}

// ---- 7. impôt
{
  const { w, d } = await page();
  check("barème 2026 : 30 000 DT imposables → 6 250 DT", Math.abs(w.MesComptes.bareme(30000) - 6250) < 1e-6);
  clic(d, '[data-a="exemple"]');
  const c = w.MesComptes.calculImpot();
  check("impôt : TOUS les loyers comptent, cash et virement (12 mois)", c.loyersAn === (1600 + 850 + 850) * 12 && c.loyCash === 1700 * 12 && c.loyVir === 1600 * 12);
  clic(d, 'nav [data-vue="impot"]');
  const f = d.querySelector('form[data-f="impot"]'); f.elements.salaireBrut.value = "0"; f.elements.salaireBrut.dispatchEvent(new w.Event("input", { bubbles: true }));
  check("impôt : recalcul pendant la saisie", w.MesComptes.donnees().impot.salaireBrut === 0 && /Revenu imposable/.test(d.getElementById("calculImpot").textContent));
  clic(d, '[data-a="filtre-ech"][data-f="0"]'); const n0 = d.querySelectorAll("#vue-impot .taches .tache").length;
  clic(d, '[data-a="filtre-ech"][data-f="tout"]'); const nt = d.querySelectorAll("#vue-impot .taches .tache").length;
  check("dates limites : Ce mois / 3 mois / 6 mois / 1 an / Tout", n0 === 1 && nt === 3);
  check("dates d'exemple marquées « date à vérifier »", /date à vérifier/.test(d.getElementById("vue-impot").textContent));
}

// ---- 8. projets
{
  const { w, d } = await page(); clic(d, '[data-a="exemple"]'); clic(d, 'nav [data-vue="projets"]');
  const t = d.getElementById("vue-projets").textContent;
  check("projets : obligatoires (somme par mois) et futurs (faisable ou non + conseils)", /À faire \(obligatoires\)/.test(t) && /Mettez de côté/.test(t) && /Projets futurs/.test(t) && /Conseils pour y arriver/.test(t) && /Faisable/.test(t));
  const D = w.MesComptes.donnees(), p = D.projets.find(x => x.nom === "Climatisation");
  clic(d, `[data-a="modif-projet"][data-id="${p.id}"]`);
  remplir(w, d.querySelector(`form[data-f="projet"][data-id="${p.id}"]`), { cout: "4000" });
  check("modifier un projet", p.cout === 4000);
  clic(d, `[data-a="suppr-projet"][data-id="${p.id}"]`);
  check("supprimer un projet", !w.MesComptes.donnees().projets.some(x => x.id === p.id));
}

// ---- 9. STEG / SONEDE, sauvegarde
{
  const { w, d } = await page(); clic(d, '[data-a="exemple"]'); clic(d, 'nav [data-vue="plus"]');
  const t = d.getElementById("vue-plus").textContent;
  // exemple : 330 + 241 = 571 ; facture 140 → appartement 1 = 330/571*140 = 80,911 − 50 d'avance
  check("partage STEG entre locataires (index actuel − précédent, moins l'avance)", /80,911 DT/.test(t) && /doit 30,911 DT/.test(t));
  clic(d, '[data-a="sauvegarde"]');
  check("sauvegarde : fichier JSON avec toutes les données", w.__fichiers.length === 1 && w.__fichiers[0].type === "application/json");
  clic(d, '[data-a="excel"]');
  check("export pour Excel (CSV)", w.__fichiers.length === 2 && w.__fichiers[1].type === "text/csv");
  clic(d, '[data-a="effacer"]'); clic(d, '[data-a="effacer-ok"]');
  check("tout effacer (avec confirmation dans la page)", w.MesComptes.donnees().revenus.length === 0);
}

// ---- 10. bouton Partager de l'en-tête (règle commune à tous les sites, 09/10/2026)
{
  const { w, d } = await page(); const ouv = [], comptes = [];
  w.open = u => { ouv.push(u); return null; }; w.goatcounter = { count: o => comptes.push(o) };
  check("en-tête : un seul bouton Partager", d.querySelectorAll("header .partager").length === 1);
  clic(d, "#partager");
  check("Partager sans menu du téléphone : WhatsApp avec l'adresse du site, clic compté", ouv.length === 1 && decodeURIComponent(ouv[0]).includes("https://comptes.clicvia.com/") && comptes.length === 1 && comptes[0].event === true);
}

// ---- « Votre avis » : e-mail obligatoire, confirmation dans la carte, lien du pied de page (demande d'Ahmed, 15/10/2026)
{
  const { w, d, js } = await page();
  const envois = []; w.fetch = (u, o) => { envois.push([u, o]); return Promise.resolve({ ok: true }); };
  check("pied de page : lien « Votre avis »", !!d.querySelector('footer a[href="#avis"]'));
  w.location.hash = "#avis"; w.dispatchEvent(new w.HashChangeEvent("hashchange")); await new Promise(r => setTimeout(r, 100));
  const f = d.getElementById("avis-form");
  check("« Votre avis » : le lien ouvre l'onglet Plus sur le formulaire ; e-mail obligatoire", !!f && !d.getElementById("vue-plus").hidden && f.elements.email.required);
  remplir(w, f, { message: "Très utile", email: "" }); await new Promise(r => setTimeout(r, 30));
  check("« Votre avis » : sans e-mail -> refusé, rien envoyé", envois.length === 0 && /e-mail/.test(d.getElementById("avisStatut").textContent));
  remplir(w, f, { message: "Très utile", email: "client@example.com" }); await new Promise(r => setTimeout(r, 50));
  const m = d.getElementById("avis-merci");
  check("« Votre avis » : envoyé avec l'e-mail ; « Merci ! Votre avis a bien été envoyé » dans la carte avec l'adresse, formulaire caché",
    envois.length === 1 && JSON.parse(envois[0][1].body).email === "client@example.com" && !m.hidden && /Merci ! Votre avis a bien été envoyé/.test(m.textContent)
    && /client@example\.com/.test(m.textContent) && f.hidden && !js.length);
}

// 16/10/2026 — règle commune d'Ahmed : toute cloche d'alerte VIBRE (secousses, immobile si « réduire les animations »)
check("cloche d'alerte qui vibre (.cloche, règle commune)", /\.cloche\{[^}]*animation:cloche-secoue/.test(lire("assets/style.css"))
  && /prefers-reduced-motion:reduce\)\{\.cloche\{animation:none/.test(lire("assets/style.css")));

// 25/10/2026 (RÈGLE d'Ahmed, règle commune § 44 : « la page Comment fonctionne le site doit être mise à jour chaque fois qu'on modifie
// le site ») : chaque fonction visible (repère dans le code) doit être expliquée dans a-propos/ ; nouvelle fonction = une ligne ici + la page.
{ const apF = "a-propos/index.html", ap = existsSync(join(root, apF)) ? lire(apF).replace(/&nbsp;/g, " ").replace(/ /g, " ").replace(/’/g, "'") : "";
  const app = lire("assets/app.js"), idx = lire("index.html");
  const FONCTIONS = [
    ["Accueil : alarmes, À faire, chiffres du mois", /<h2>Alarmes<\/h2>/.test(app) && /<h2>Ce mois-ci<\/h2>/.test(app), /les alarmes du jour, la liste « À faire »/],
    ["alarmes sur le téléphone (agenda .ics, Google Agenda)", /data-a="ics-tout"/.test(app) && /function lienGoogle/.test(app), /Mettre toutes mes alarmes sur mon téléphone[\s\S]*Google Agenda/],
    ["revenus (loyers, salaires, autres ; cash / virement ; état par mois)", /data-vue="revenus"/.test(idx) && /ETATS_LOYER/.test(app), /<b>Revenus<\/b>[\s\S]*cash ou par virement/],
    ["« À appeler » à 18:30 + bouton Appeler", /HEURE_APPEL = "18:30"/.test(app) && /href="tel:/.test(app), /À appeler[\s\S]*18:30[\s\S]*Appeler/],
    ["dépenses (une fois ou qui reviennent)", /data-vue="depenses"/.test(idx) && /Dépenses qui reviennent/.test(app), /<b>Dépenses<\/b>[\s\S]*qui revient/],
    ["impôt : dates limites + calcul", /data-vue="impot"/.test(idx) && /function calculImpot/.test(app), /<b>Impôt<\/b>[\s\S]*dates limites[\s\S]*calcul indicatif/],
    ["projets (faisable ? conseils)", /data-vue="projets"/.test(idx) && /Conseils pour y arriver/.test(app), /<b>Projets<\/b>[\s\S]*faisable[\s\S]*conseils/],
    ["facture STEG ou SONEDE partagée", /Partager une facture STEG ou SONEDE/.test(app), /Facture STEG ou SONEDE partagée/],
    ["sauvegarde, restauration, export Excel", /data-a="sauvegarde"/.test(app) && /data-a="restaurer"/.test(app) && /function exporterExcel/.test(app), /<b>Sauvegarde<\/b>[\s\S]*restaurer[\s\S]*Excel/],
    ["exemple et tout effacer", /function exemple/.test(app) && /data-a="effacer"/.test(app), /Voir avec un exemple[\s\S]*tout effacer/],
    ["Votre avis (formulaire)", /data-f="avis"/.test(app), /<b>Votre avis<\/b>/],
    ["bouton Partager", /id="partager"/.test(idx), /<b>Partager<\/b>[\s\S]*jamais partagés/],
    ["une adresse par langue (version arabe ar/)", existsSync(join(root, "ar/index.html")) && /const AR = /.test(app), /Une adresse par langue[\s\S]*comptes\.clicvia\.com\/ar\//],
    ["installation sur le téléphone / hors connexion", existsSync(join(root, "manifest.webmanifest")) && existsSync(join(root, "sw.js")), /Installer sur le téléphone[\s\S]*sans connexion/],
    ["gratuit 3 mois, puis abonnement", /ESSAI_JOURS = 90/.test(app), /gratuit pendant 3 mois[\s\S]*rien n'est prélevé automatiquement/],
    ["vos chiffres restent dans le téléphone", /localStorage/.test(app), /Vos chiffres restent dans votre téléphone/],
    ["statistiques anonymes sans cookies", /goatcounter/.test(idx), /anonymes, sans cookies/],
    ["Confidentialité et Conditions d'utilisation (pages communes)", /clicvia\.com\/conditions\//.test(idx), /Confidentialité[\s\S]*Conditions d'utilisation[\s\S]*communes à tous nos sites/]];
  const manque = FONCTIONS.filter(([, sur, re]) => sur && !re.test(ap)).map(([n]) => n);
  check(`page « Comment fonctionne le site ? » à jour : chaque fonction du site y est expliquée (${FONCTIONS.length} fonctions)` + (manque.length ? " — manque : " + manque.join(", ") : ""),
    manque.length === 0);
  const brut = existsSync(join(root, apF)) ? lire(apF) : "";
  check("page « Comment fonctionne le site ? » : titre, lien dans le pied de page de l'accueil et de la page, dans le plan du site, CSP sans script en ligne, même ?v=",
    /<h1>Comment fonctionne le site&nbsp;\?<\/h1>/.test(brut) && /<footer[\s\S]*href="a-propos\/">Comment fonctionne le site \?<\/a>[\s\S]*<\/footer>/.test(idx)
    && /<footer[\s\S]*href="\.\.\/a-propos\/">Comment fonctionne le site \?<\/a>/.test(brut) && lire("sitemap.xml").includes("<loc>https://comptes.clicvia.com/a-propos/</loc>")
    && /http-equiv="Content-Security-Policy"/.test(brut) && !/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>/.test(brut) && !/\son[a-z]+=/i.test(brut)
    && [...brut.matchAll(/\?v=(\w+)/g)].every(m => idx.includes("?v=" + m[1])) && /data-goatcounter/.test(brut)); }

// ---- SEO (plan d'Ahmed, 08/11/2026) : titre de 10 à 70 caractères et description de 40 à 170, titres uniques
{
  const titres = new Map(), mal = [];
  for (const p of ["index.html", "a-propos/index.html"]) {
    const h = lire(p), t = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || "", d = (h.match(/name="description" content="([^"]*)"/) || [])[1] || "";
    if (t.length < 10 || t.length > 70) mal.push(`${p} titre ${t.length}`);
    if (d.length < 40 || d.length > 170) mal.push(`${p} description ${d.length}`);
    if (titres.has(t)) mal.push(`${p} même titre que ${titres.get(t)}`); titres.set(t, p);
  }
  check(`SEO : titre de 10 à 70 caractères et description de 40 à 170 sur chaque page, titres uniques ${mal.join(" | ")}`, mal.length === 0);
}

// ---- Page 404 du site + liens Confidentialité / Conditions d'utilisation dans le pied de CHAQUE page (17/11/2026, règle commune § 58 ; § 55 : test qui bloque)
check("page 404 du site : 404.html + 404.js (« Recherche de la page »)", existsSync(join(root, "404.html")) && existsSync(join(root, "404.js"))
  && /src="\/404\.js"/.test(lire("404.html")) && /Recherche de la page/.test(lire("404.js")));
for (const p of ["index.html", "a-propos/index.html"]) {
  const pied = (lire(p).match(/<footer[\s\S]*?<\/footer>/) || [""])[0];
  check(`pied de page (${p}) : liens « Confidentialité » et « Conditions d'utilisation » vers clicvia.com`,
    /<a href="https:\/\/clicvia\.com\/confidentialite\/"[^>]*>Confidentialité<\/a>/.test(pied) && /<a href="https:\/\/clicvia\.com\/conditions\/"[^>]*>Conditions d.utilisation<\/a>/.test(pied));
}

// ---- UNE ADRESSE PAR LANGUE (21/11/2026, règle commune § 8 point 9 : « une adresse par langue, jamais seulement ?lang= ») ----
// Pages arabes fabriquées par tools/construire_ar.py (tests.yml vérifie qu'elles sont à jour avec --verifier).
{
  const PAIRES = [["index.html", "ar/index.html", "", "ar/"], ["a-propos/index.html", "ar/a-propos/index.html", "a-propos/", "ar/a-propos/"]];
  const AR_RE = /[\u0600-\u06FF]/;
  const visible = h => h.replace(/<head[\s\S]*?<\/head>/, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<a class="langue-btn"[\s\S]*?<\/a>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
  // mots latins permis dans une page arabe : noms propres, marques, adresses
  const PERMIS = new Set(["clicvia", "com", "comptes", "ar", "JavaScript", "Excel", "Google", "Ooredoo", "Chrome", "Safari", "kWh", "m"]);
  const latins = t => (t.match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || []).filter(m => !PERMIS.has(m));
  for (const [fr, ar, uFr, uAr] of PAIRES) {
    check(`${ar} : la page arabe existe`, existsSync(join(root, ar)));
    if (!existsSync(join(root, ar))) continue;
    const hf = lire(fr), ha = lire(ar);
    const t = h => (h.match(/<title>([^<]*)<\/title>/) || [])[1] || "", dsc = h => (h.match(/name="description" content="([^"]*)"/) || [])[1] || "";
    check(`${ar} : <html lang="ar" dir="rtl">, langue fixe, titre (≤ 70) et description (40-165) en arabe`, /<html lang="ar" dir="rtl" translate="no" data-langue-fixe="ar"/.test(ha)
      && AR_RE.test(t(ha)) && t(ha).length <= 70 && AR_RE.test(dsc(ha)) && dsc(ha).length >= 40 && dsc(ha).length <= 165 && t(ha) !== t(hf));
    check(`${fr} : <html lang="fr">, langue fixe`, /<html lang="fr" translate="no" data-langue-fixe="fr"/.test(hf));
    check(`${ar} : canonical, og:url et og:locale arabes ; ${fr} : français`,
      ha.includes(`<link rel="canonical" href="https://comptes.clicvia.com/${uAr}">`) && ha.includes(`<meta property="og:url" content="https://comptes.clicvia.com/${uAr}">`)
      && ha.includes('<meta property="og:locale" content="ar_AR">') && hf.includes(`<link rel="canonical" href="https://comptes.clicvia.com/${uFr}">`) && hf.includes('<meta property="og:locale" content="fr_FR">'));
    const alt = h => [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => m[1] + "=" + m[2]).sort().join(" ");
    check(`${fr} ↔ ${ar} : hreflang fr / ar / x-default (= français), les mêmes sur les deux pages`,
      alt(hf) === alt(ha) && alt(hf) === [`ar=https://comptes.clicvia.com/${uAr}`, `fr=https://comptes.clicvia.com/${uFr}`, `x-default=https://comptes.clicvia.com/${uFr}`].sort().join(" "));
    const ld = h => { try { return JSON.parse((h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]); } catch (e) { return null; } };
    check(`${ar} : données Google (JSON-LD) en arabe, adresse ar/`, ld(ha) && ld(ha).inLanguage === "ar" && ld(ha).url === `https://comptes.clicvia.com/${uAr}` && ld(hf).inLanguage === "fr");
    const vf = [...hf.matchAll(/\?v=(\w+)/g)].map(m => m[1]).join(), va = [...ha.matchAll(/\?v=(\w+)/g)].map(m => m[1]).join();
    check(`${ar} : même ?v= que la page française, fichiers communs pris à la racine`, vf === va && vf.length > 0 && !/(src|href)="assets\//.test(ha.replace(/<link rel="manifest"[^>]*>/, "")));
    const bf = (hf.match(/<a class="langue-btn"[^>]*>/) || [""])[0], ba = (ha.match(/<a class="langue-btn"[^>]*>/) || [""])[0];
    check(`${fr} ↔ ${ar} : bouton de langue = vrai lien vers l'autre adresse (jamais data-l)`, /hreflang="ar"/.test(bf) && /hreflang="fr"/.test(ba)
      && new URL(bf.match(/href="([^"]+)"/)[1], "https://comptes.clicvia.com/" + uFr).href === "https://comptes.clicvia.com/" + uAr
      && new URL(ba.match(/href="([^"]+)"/)[1], "https://comptes.clicvia.com/" + uAr).href === "https://comptes.clicvia.com/" + uFr && !/data-l=/.test(hf + ha));
    check(`${fr} : une seule langue (aucun mot arabe hors du bouton de langue)`, !AR_RE.test(visible(hf)));
    const lat = latins(visible(ha));
    check(`${ar} : une seule langue (aucun mot français) ${lat.slice(0, 8).join(", ")}`, lat.length === 0);
    check(`${ar} : pied de page avec Confidentialité / Conditions en arabe (clicvia.com/ar/)`, /href="https:\/\/clicvia\.com\/ar\/confidentialite\/"/.test(ha) && /href="https:\/\/clicvia\.com\/ar\/conditions\/"/.test(ha));
  }
  check("ar/a-propos : titre « كيف يعمل الموقع؟ », lien dans le pied de page de ar/", /<h1>كيف يعمل الموقع؟<\/h1>/.test(lire("ar/a-propos/index.html")) && /href="a-propos\/">كيف يعمل الموقع؟<\/a>/.test(lire("ar/index.html")));
  const sm = lire("sitemap.xml");
  check("plan du site : pages FR et AR, avec leurs hreflang", ["", "ar/", "a-propos/", "ar/a-propos/"].every(u => sm.includes(`<loc>https://comptes.clicvia.com/${u}</loc>`)) && /hreflang="ar"/.test(sm));
  const man = JSON.parse(lire("ar/manifest.webmanifest"));
  check("installation en arabe : ar/manifest.webmanifest (lang ar, rtl, start_url ./, icônes à la racine)", man.lang === "ar" && man.dir === "rtl" && man.start_url === "./" && man.icons.every(i => existsSync(join(root, "ar", i.src))));
  check("service worker : la page arabe est en réseau d'abord, gardée pour hors connexion", /"ar\/"/.test(lire("sw.js")) && /PORTEE \+ "ar\/"/.test(lire("sw.js")));

  // l'application en arabe : chaque onglet en arabe, montants justes, mêmes données que la page française
  const { w, d, js } = await page({ chemin: "ar/index.html" });
  check("arabe : premier lancement sans erreur, écran de bienvenue en arabe, 3 étapes", !js.length && d.documentElement.dir === "rtl" && /مرحبًا بك في حساباتي/.test(d.body.textContent) && d.querySelectorAll(".bienvenue ol li").length === 3);
  clic(d, '[data-a="exemple"]');
  const M = w.MesComptes, D = M.donnees();
  check("arabe : exemple chargé (5 revenus, noms en arabe), langue « ar »", M.langue === "ar" && D.revenus.length === 5 && AR_RE.test(D.revenus[0].nom) && !js.length);
  const textes = {};
  for (const v of ["accueil", "revenus", "depenses", "impot", "projets", "plus"]) { clic(d, `nav [data-vue="${v}"]`); textes[v] = d.getElementById("vue-" + v).textContent; }
  const PERMIS_APP = new Set(["Ooredoo", "Google", "Excel", "kWh", "m", "exemple", "mail", "com", "J"]);
  for (const [v, t] of Object.entries(textes)) {
    const l = (t.match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || []).filter(m => !PERMIS_APP.has(m));
    check(`arabe : onglet « ${v} » affiché en arabe, sans mot français ${l.slice(0, 8).join(", ")}`, AR_RE.test(t) && t.length > 100 && l.length === 0);
  }
  check("arabe : chiffres latins, montants en د.ت isolés de gauche à droite", /\u2066[\d\u202F\u00A0 ,]+\u2069 د\.ت/.test(textes.accueil) && !/[\u0660-\u0669]/.test(Object.values(textes).join("")));
  check("arabe : facture STEG partagée juste (80,911 د.ت, عليه 30,911 د.ت)", /80,911\u2069 د\.ت/.test(textes.plus) && /عليه \u206630,911\u2069 د\.ت/.test(textes.plus));
  check("arabe : alarmes en arabe (اتصل / كراء غير مدفوع / الضريبة بعد 6 أيام)", M.alarmes().some(a => /حان الوقت: اتصل/.test(a.titre)) && M.alarmes().some(a => /كراء غير مدفوع/.test(a.titre))
    && M.alarmes().some(a => /الضريبة بعد \u20666\u2069 أيام/.test(a.titre)));
  const ics = M.fichierIcs(M.tousLesRappels());
  check("arabe : fichier agenda avec des rappels en arabe (même règles : 18:30 chaque jour, 30 / 15 / 3 jours avant)", /SUMMARY:الاتصال بـ/.test(ics) && /RRULE:FREQ=DAILY;COUNT=30/.test(ics) && /TRIGGER:-P15D/.test(ics) && ics.split("\r\n").every(l => l.length <= 75 || [...l].length <= 75));
  clic(d, 'nav [data-vue="plus"]'); clic(d, '[data-a="excel"]');
  check("arabe : export Excel avec en-têtes arabes", w.__fichiers.length === 1 && w.__fichiers[0].type === "text/csv");
  check("arabe : barème identique (30 000 → 6 250)", Math.abs(M.bareme(30000) - 6250) < 1e-6 && M.calculImpot().loyersAn === (1600 + 850 + 850) * 12);
  // mêmes données dans les deux langues (localStorage « mes-comptes-v1 » commun)
  const fr2 = await page({ stockage: stock(w) });
  check("mêmes chiffres dans les deux langues : l'exemple chargé en arabe est là sur la page française", fr2.w.MesComptes.donnees().revenus.length === 5 && fr2.w.MesComptes.langue === "fr");
  const ar3 = await page({ chemin: "ar/index.html", stockage: { "mes-comptes-v1": JSON.stringify({ ...JSON.parse(stock(fr2.w)["mes-comptes-v1"]), depenses: [{ id: "x", date: "2026-10-03", quoi: "Courses", montant: 10, cat: "Courses", mode: "cash" }] }) } });
  clic(ar3.d, 'nav [data-vue="depenses"]');
  check("catégorie gardée en français dans le téléphone, affichée en arabe (Courses → المشتريات)", /المشتريات/.test(ar3.d.getElementById("vue-depenses").textContent));

  // bouton de langue et renvois (protection.js)
  const allees = []; const go = u => { allees.push(u); };
  let p = await page({ protection: true, allerVers: go });
  p.d.querySelector("a.langue-btn").dispatchEvent(new p.w.MouseEvent("click", { bubbles: true, cancelable: true }));  // (la page de test neutralise a.click())
  check("bouton de langue (page française) : ouvre ar/ et retient « ar »", allees.at(-1) === "ar/" && p.w.localStorage.getItem("langue") === "ar");
  p = await page({ protection: true, allerVers: go, adresse: "https://comptes.clicvia.com/?lang=ar#avis" });
  check("ancien lien « ?lang=ar » : renvoyé vers ar/ (ancre gardée)", allees.at(-1) === "ar/#avis");
  const n0 = allees.length;
  p = await page({ protection: true, allerVers: go, stockage: { langue: "ar" } });
  check("venu de Google ou d'un lien partagé : jamais renvoyé d'après la langue gardée", allees.length === n0);
  p = await page({ protection: true, allerVers: go, stockage: { langue: "ar" }, referrer: "https://comptes.clicvia.com/a-propos/" });
  check("venu d'une page du site avec « ar » choisi : renvoyé vers ar/", allees.length === n0 + 1 && allees.at(-1) === "ar/");
  p = await page({ chemin: "ar/index.html", protection: true, allerVers: go });
  p.d.querySelector("a.langue-btn").dispatchEvent(new p.w.MouseEvent("click", { bubbles: true, cancelable: true }));  // (la page de test neutralise a.click())
  check("bouton de langue (page arabe) : ouvre la page française et retient « fr »", allees.at(-1) === "../" && p.w.localStorage.getItem("langue") === "fr");
}

console.log(`\n${erreurs ? erreurs + " PROBLÈME(S)" : "TOUT PASSE"} (${total} vérifications)`);
process.exit(erreurs ? 1 : 0);
