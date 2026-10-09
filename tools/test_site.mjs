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

async function page({ quand = "2026-10-22T19:00:00", stockage = {} } = {}) {
  const html = lire("index.html").replace(/<script[^>]*gc\.zgo\.at[^>]*><\/script>/, "")
    .replace(/<script defer src="(assets\/[^"?]+)(\?[^"]*)?"><\/script>/g, (_, f) => `<script>${lire(f)}</script>`);
  const vc = new VirtualConsole(), js = [];
  vc.on("jsdomError", e => { if (!/Not implemented/.test(e.message)) js.push(e.message); });
  const dom = new JSDOM(html, { url: "https://ah6259.github.io/mes-comptes-tunisie/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
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
  && /<html lang="fr" translate="no">/.test(html) && /name="google" content="notranslate"/.test(html) && !/<script(?![^>]*\bsrc=)[^>]*>/.test(html) && !/\son[a-z]+=/i.test(html));
check("index : même ?v= pour style, app et protection ; sw.js le connaît", (() => { const v = [...html.matchAll(/\?v=(\w+)/g)].map(m => m[1]); const sw = lire("sw.js");
  return v.length === 3 && new Set(v).size === 1 && sw.includes(v[0]); })());
check("installation : manifeste, icônes 192/512/maskable/180, service worker", ["manifest.webmanifest", "sw.js", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png", "assets/icons/icon-180.png", "assets/og-image-v1.jpg"].every(f => existsSync(join(root, f)))
  && JSON.parse(lire("manifest.webmanifest")).id === "/mes-comptes-tunisie/");
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
  check("Partager sans menu du téléphone : WhatsApp avec l'adresse du site, clic compté", ouv.length === 1 && decodeURIComponent(ouv[0]).includes("https://ah6259.github.io/mes-comptes-tunisie/") && comptes.length === 1 && comptes[0].event === true);
}

console.log(`\n${erreurs ? erreurs + " PROBLÈME(S)" : "TOUT PASSE"} (${total} vérifications)`);
process.exit(erreurs ? 1 : 0);
