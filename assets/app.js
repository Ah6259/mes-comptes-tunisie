/* Mes comptes — tout se passe dans le navigateur : les chiffres restent dans le téléphone (localStorage), rien n'est envoyé.
   Alarmes : fichier agenda (.ics) ou lien Google Agenda → c'est le TÉLÉPHONE qui sonne, même site fermé. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- outils
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lireNb = s => { const v = parseFloat(String(s == null ? "" : s).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : 0; };
  const DT = n => (Math.round(n * 1000) / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " DT";
  const DT0 = n => Math.round(n).toLocaleString("fr-FR") + " DT";
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const MOIS_C = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];
  const p2 = n => String(n).padStart(2, "0");
  const maintenant = () => (window.MC_MAINTENANT ? new Date(window.MC_MAINTENANT) : new Date());
  const ymDe = d => d.getFullYear() + "-" + p2(d.getMonth() + 1);
  const isoDe = d => ymDe(d) + "-" + p2(d.getDate());
  const ymPlus = (ym, n) => { const [a, m] = ym.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return ymDe(d); };
  const ecartMois = (a, b) => { const [a1, m1] = a.split("-").map(Number), [a2, m2] = b.split("-").map(Number); return (a2 - a1) * 12 + (m2 - m1); };
  const nomMois = ym => { const [a, m] = ym.split("-").map(Number); return MOIS[m - 1] + " " + a; };
  const dateDe = iso => { const [a, m, j] = iso.split("-").map(Number); return new Date(a, m - 1, j || 1); };
  const jourStr = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const joursAvant = d => { const n = maintenant(); return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); };
  const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const CATS = ["Maison", "Courses", "STEG et SONEDE", "Téléphone et internet", "Voiture et essence", "Enfants et école", "Santé", "Dons (sadaqa)", "Impôts et société", "Crédit", "Loisirs", "Autre"];
  const TYPES = { loyer: "Loyer", salaire: "Salaire", autre: "Autre revenu" };
  const FREQ = { mois: [1, "chaque mois"], "2mois": [2, "tous les 2 mois"], "3mois": [3, "tous les 3 mois"], "6mois": [6, "tous les 6 mois"], an: [12, "chaque année"] };
  const HEURE_APPEL = "18:30";
  const ESSAI_JOURS = 90;

  // ---------------------------------------------------------------- données (dans le téléphone)
  const CLE = "mes-comptes-v1";
  const vide = () => ({ v: 1, debut: isoDe(maintenant()), exemple: false, revenus: [], etats: {}, depenses: [], recurrentes: [], payes: {},
    echeances: [], projets: [], compteurs: [], facture: { montant: 0, methode: "locataires", total: 0 }, impot: { salaireBrut: 0, chef: true, enfants: 0, retenu: 0 }, replie: [], vu: false });
  let D = vide(), stockageOk = true;
  function charger() {
    try { const t = localStorage.getItem(CLE); if (t) { const o = JSON.parse(t); if (o && o.v === 1) D = Object.assign(vide(), o); } }
    catch (e) { stockageOk = false; }
    try { localStorage.setItem(CLE + "-test", "1"); localStorage.removeItem(CLE + "-test"); } catch (e) { stockageOk = false; }
  }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(D)); } catch (e) { stockageOk = false; } }

  // ---------------------------------------------------------------- état de l'interface (non enregistré)
  const UI = { vue: "accueil", sous: "cash", periode: "3", moisVu: ymDe(maintenant()), filtreEch: "3", modifProjet: null, modifRevenu: null, effacer: false };
  try { const o = localStorage.getItem("mes-comptes-onglet"); if (o) UI.vue = o; } catch (e) {}

  // ---------------------------------------------------------------- message « Annuler »
  let minuterie = 0;
  function message(txt, defaire) {
    const p = $("toast"); clearTimeout(minuterie);
    p.innerHTML = `<span>${esc(txt)}</span>` + (defaire ? `<button type="button" id="btnAnnuler">Annuler</button>` : "");
    p.hidden = false;
    if (defaire) $("btnAnnuler").onclick = () => { defaire(); sauver(); p.hidden = true; tout(); };
    minuterie = setTimeout(() => { p.hidden = true; }, 6000);
  }
  function changer(fn, txt, defaire) { fn(); sauver(); tout(); if (txt) message(txt, defaire); }

  // ---------------------------------------------------------------- revenus : état de chaque mois
  // r = reçu, x = en retard, p = à appeler, a = attendu, g = gratuit (travaux), v = pas loué / rien ce mois
  const etat = (r, ym) => D.etats[r.id + "|" + ym] || (ym < (r.depuis || "0000-00") ? "v" : "a");
  const ETATS_LOYER = [["r", "Reçu"], ["x", "En retard"], ["p", "À appeler"], ["a", "Attendu"], ["g", "Gratuit (travaux)"], ["v", "Pas loué"]];
  const ETATS_AUTRE = [["r", "Reçu"], ["x", "En retard"], ["a", "Attendu"], ["v", "Rien ce mois"]];
  const modeTxt = r => r.mode === "cash" ? "cash" : "virement";
  const aAppeler = r => { const ym = ymDe(maintenant()); return r.type === "loyer" && (etat(r, ym) === "p" || etat(r, ymPlus(ym, -1)) === "p"); };
  const titreRetard = r => r.type === "loyer" ? "Loyer non payé" : r.type === "salaire" ? "Salaire pas encore reçu" : "Revenu pas encore reçu";

  // ---------------------------------------------------------------- dépenses qui reviennent
  const tombe = (rc, ym) => { const pas = FREQ[rc.freq] ? FREQ[rc.freq][0] : 1, e = ecartMois(rc.depart, ym); return e >= 0 && e % pas === 0; };
  const paye = (rc, ym) => !!D.payes[rc.id + "|" + ym];
  const depensesDuMois = ym => D.depenses.filter(d => d.date.slice(0, 7) === ym);
  function prochaineDate(rc) {
    const n = maintenant(), ym = ymDe(n);
    for (let k = 0; k < 25; k++) { const y = ymPlus(ym, k); if (tombe(rc, y) && !(k === 0 && ((rc.jour || 1) < n.getDate() || paye(rc, y)))) return new Date(+y.slice(0, 4), +y.slice(5) - 1, Math.max(1, rc.jour || 1), 9, 0); }
    return new Date(n.getFullYear(), n.getMonth(), Math.max(1, rc.jour || 1), 9, 0);
  }

  // ---------------------------------------------------------------- impôt (barème 2026 par tranches ; règles d'Outils pratiques)
  const TRANCHES = [[5000, 0], [10000, .15], [20000, .25], [30000, .30], [40000, .33], [50000, .36], [70000, .38], [Infinity, .40]];
  function bareme(r) { let i = 0, bas = 0; for (const [haut, t] of TRANCHES) { if (r > bas) i += (Math.min(r, haut) - bas) * t; bas = haut; } return i; }
  function calculImpot() {
    const I = D.impot, sal = lireNb(I.salaireBrut), ded = (I.chef ? 300 : 0) + Math.min(+I.enfants || 0, 4) * 100;
    const loy = D.revenus.filter(r => r.type === "loyer"), aut = D.revenus.filter(r => r.type === "autre");
    const loyersAn = loy.reduce((s, r) => s + r.montant * 12, 0), autresAn = aut.reduce((s, r) => s + r.montant * 12, 0);
    const loyCash = loy.filter(r => r.mode === "cash").reduce((s, r) => s + r.montant * 12, 0);
    const cnss = sal * .0968, apres = sal - cnss, frais = Math.min(apres * .10, 2000), foncier = loyersAn * .70;
    const imposable = Math.max(0, apres - frais + foncier + autresAn - ded), irpp = bareme(imposable), css = imposable > 5000 ? imposable * .005 : 0;
    const total = irpp + css, reste = total - lireNb(I.retenu);
    return { sal, cnss, frais, loyersAn, loyCash, loyVir: loyersAn - loyCash, foncier, autresAn, ded, imposable, irpp, css, total, retenu: lireNb(I.retenu), reste, parMois: Math.max(reste, 0) / 12 };
  }

  // ---------------------------------------------------------------- capacité d'épargne (pour les projets)
  function capacite() {
    const revMois = D.revenus.reduce((s, r) => s + r.montant, 0);
    const recMois = D.recurrentes.reduce((s, rc) => s + rc.montant / (FREQ[rc.freq] ? FREQ[rc.freq][0] : 1), 0);
    const ym = ymDe(maintenant()), ponct = [1, 2, 3].map(k => depensesDuMois(ymPlus(ym, -k)).filter(d => !d.recId).reduce((s, d) => s + d.montant, 0));
    const moyPonct = ponct.reduce((s, x) => s + x, 0) / 3;
    return revMois - recMois - moyPonct - calculImpot().parMois;
  }

  // ---------------------------------------------------------------- AGENDA DU TÉLÉPHONE (.ics + Google Agenda)
  const gfmt = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
  function lienGoogle(ev) {
    const fin = new Date(ev.debut.getTime() + 15 * 60000);
    const q = new URLSearchParams({ action: "TEMPLATE", text: ev.titre, dates: gfmt(ev.debut) + "/" + gfmt(fin), details: ev.details + "\n\nRappel créé par Mes comptes.", ctz: "Africa/Tunis" });
    if (ev.regle) q.set("recur", "RRULE:" + ev.regle);
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }
  const icsTxt = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const plier = l => { const o = []; let s = l; while (s.length > 73) { o.push(s.slice(0, 73)); s = " " + s.slice(73); } o.push(s); return o.join("\r\n"); };
  function fichierIcs(evs) {
    const st = gfmt(maintenant());
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mes comptes//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Mes comptes"];
    evs.forEach((ev, i) => {
      L.push("BEGIN:VEVENT", "UID:" + (ev.uid || "mc-" + i) + "-" + st + "@mes-comptes", "DTSTAMP:" + st, "DTSTART:" + gfmt(ev.debut), "DTEND:" + gfmt(new Date(ev.debut.getTime() + 15 * 60000)),
        "SUMMARY:" + icsTxt(ev.titre), "DESCRIPTION:" + icsTxt(ev.details + "\n\nRappel créé par Mes comptes."));
      if (ev.regle) L.push("RRULE:" + ev.regle);
      (ev.alarmes || ["PT0M"]).forEach(t => L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsTxt(ev.titre), "TRIGGER:" + (t === "PT0M" ? "PT0M" : "-" + t), "END:VALARM"));
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.map(plier).join("\r\n") + "\r\n";
  }
  function telecharger(nom, texte, type) {
    try {
      const url = URL.createObjectURL(new Blob([texte], { type }));
      const a = document.createElement("a"); a.href = url; a.download = nom; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      return true;
    } catch (e) { message("Le téléchargement n'a pas marché sur ce navigateur. Essayez avec Chrome ou Safari.", null); return false; }
  }
  // un rappel par élément
  const evAppel = r => ({ uid: "appel-" + r.id, titre: `Appeler ${r.locataire || "le locataire"} — ${r.nom}`, debut: (() => { const n = maintenant(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 18, 30); })(),
    details: `Loyer de ${DT0(r.montant)} pas encore reçu.${r.tel ? " Téléphone : " + r.tel : ""} Supprimez ce rappel quand le loyer est reçu.`, regle: "FREQ=DAILY;COUNT=30" });
  const evRevenu = r => { const n = maintenant(); let d = new Date(n.getFullYear(), n.getMonth(), Math.min(28, (r.jour || 1) + 1), 10, 0); if (d < n) d = new Date(n.getFullYear(), n.getMonth() + 1, Math.min(28, (r.jour || 1) + 1), 10, 0);
    return { uid: "rev-" + r.id, titre: `${r.type === "loyer" ? "Loyer" : TYPES[r.type]} reçu ? ${r.nom} (${DT0(r.montant)})`, debut: d,
      details: `Vérifier que « ${r.nom} » est arrivé (${modeTxt(r)}, avant le ${r.jour} de chaque mois).${r.tel ? " Téléphone : " + r.tel : ""}`, regle: "FREQ=MONTHLY" }; };
  const evRec = rc => { const pas = FREQ[rc.freq] ? FREQ[rc.freq][0] : 1;
    return { uid: "rec-" + rc.id, titre: `Payer : ${rc.quoi} (${DT0(rc.montant)}, ${rc.mode === "cash" ? "cash" : "par internet"})`, debut: prochaineDate(rc),
      details: `${rc.quoi} — ${FREQ[rc.freq] ? FREQ[rc.freq][1] : ""}, le ${rc.jour}.`, regle: pas === 12 ? "FREQ=YEARLY" : pas === 1 ? "FREQ=MONTHLY" : "FREQ=MONTHLY;INTERVAL=" + pas }; };
  const evEch = e => { const d = dateDe(e.date); d.setHours(9, 0, 0, 0);
    return { uid: "ech-" + e.id, titre: `Date limite : ${e.quoi}${e.montant ? " (" + DT0(e.montant) + ")" : ""}`, debut: d,
      details: `Date limite le ${jourStr(d)} ${d.getFullYear()}.${e.verif ? " Date à vérifier auprès de l'administration fiscale." : ""}`, alarmes: ["P30D", "P15D", "P3D", "PT0M"] }; };
  function tousLesRappels() {
    const ym = ymDe(maintenant()), evs = [];
    D.revenus.forEach(r => { if (aAppeler(r)) evs.push(evAppel(r)); evs.push(evRevenu(r)); });
    D.recurrentes.filter(rc => rc.jour).forEach(rc => evs.push(evRec(rc)));
    D.echeances.filter(e => !e.paye && joursAvant(dateDe(e.date)) >= 0).forEach(e => evs.push(evEch(e)));
    return evs;
  }
  const btnAgenda = (cle, txt) => `<button type="button" class="mini" data-a="ics" data-cle="${esc(cle)}">${txt || "Mettre sur mon téléphone"}</button>`;
  const lienG = ev => `<a class="mini" href="${esc(lienGoogle(ev))}" target="_blank" rel="noopener">Google Agenda</a>`;
  function evDeCle(cle) {
    const [t, id] = cle.split(":");
    if (t === "appel") return evAppel(D.revenus.find(r => r.id === id));
    if (t === "rev") return evRevenu(D.revenus.find(r => r.id === id));
    if (t === "rec") return evRec(D.recurrentes.find(r => r.id === id));
    if (t === "ech") return evEch(D.echeances.find(r => r.id === id));
    return null;
  }

  // ---------------------------------------------------------------- alarmes
  function alarmes() {
    const n = maintenant(), ym = ymDe(n), j = n.getDate(), heure = p2(n.getHours()) + ":" + p2(n.getMinutes()), A = [], prec = ymPlus(ym, -1);
    D.revenus.forEach(r => {
      if (aAppeler(r)) {
        const lheure = heure >= HEURE_APPEL;
        A.push({ niv: lheure ? 0 : 1, titre: lheure ? `C'est l'heure : appeler ${r.locataire || "le locataire"}` : `Ce soir à ${HEURE_APPEL} : appeler ${r.locataire || "le locataire"}`,
          txt: `${r.nom} · loyer ${DT0(r.montant)}${r.tel ? " · " + r.tel : ""}`,
          action: (r.tel ? lienTel(r) : "") + btnAgenda("appel:" + r.id, "Rappel chaque jour à 18:30") + `<button type="button" class="mini" data-a="fin-appel" data-id="${r.id}">C'est fait</button>` });
        return;
      }
      const e = etat(r, ym);
      if (e === "x" || (e === "a" && j > r.jour)) A.push({ niv: 0, titre: `${titreRetard(r)} : ${r.nom}`, txt: `${DT0(r.montant)} attendus avant le ${r.jour} ${MOIS[n.getMonth()]} (${modeTxt(r)})`,
        action: `<button type="button" class="mini vert" data-a="recu" data-id="${r.id}" data-ym="${ym}">Reçu</button>` + (r.type === "loyer" ? `<button type="button" class="mini" data-a="appeler" data-id="${r.id}">À appeler</button>` : "") });
      const ep = etat(r, prec);
      if (r.depuis <= prec && ["a", "x", "p"].includes(ep)) A.push({ niv: 0, titre: `${titreRetard(r)} (${MOIS[+prec.slice(5) - 1]}) : ${r.nom}`, txt: `${DT0(r.montant)} du mois dernier`,
        action: `<button type="button" class="mini vert" data-a="recu" data-id="${r.id}" data-ym="${prec}">Reçu</button>` });
    });
    D.recurrentes.forEach(rc => { if (!rc.jour || !tombe(rc, ym) || paye(rc, ym)) return; const d = rc.jour - j;
      const act = `<button type="button" class="mini vert" data-a="payer" data-id="${rc.id}">Payé</button>`;
      if (d < 0) A.push({ niv: 0, titre: `Facture non payée : ${rc.quoi}`, txt: `${DT0(rc.montant)}, à payer le ${rc.jour} ${MOIS[n.getMonth()]} (${rc.mode === "cash" ? "cash" : "par internet"})`, action: act });
      else if (d <= 3) A.push({ niv: 1, titre: `À payer ${d === 0 ? "aujourd'hui" : "dans " + d + " jour" + (d > 1 ? "s" : "")} : ${rc.quoi}`, txt: `${DT0(rc.montant)} le ${rc.jour} ${MOIS[n.getMonth()]}`, action: act }); });
    D.echeances.forEach(e => { if (e.paye) return; const d = joursAvant(dateDe(e.date));
      const txt = `${e.quoi}, date limite le ${jourStr(dateDe(e.date))}${e.montant ? " · " + DT0(e.montant) : ""}`, act = `<button type="button" class="mini vert" data-a="ech-paye" data-id="${e.id}">Payé</button>`;
      if (d < 0) A.push({ niv: 0, titre: "Impôt en retard", txt, action: act });
      else if (d <= 3) A.push({ niv: 0, titre: d === 0 ? "Impôt : c'est aujourd'hui" : `Impôt : plus que ${d} jour${d > 1 ? "s" : ""}`, txt, action: act });
      else if (d <= 15) A.push({ niv: 1, titre: `Impôt dans ${d} jours`, txt, action: act });
      else if (d <= 31) A.push({ niv: 2, titre: "Impôt dans un mois", txt, action: act }); });
    return A.sort((a, b) => a.niv - b.niv);
  }
  const lienTel = r => `<a class="mini vert" href="tel:${esc(String(r.tel).replace(/[^+\d]/g, ""))}">Appeler</a>`;
  const CLOCHE = `<svg class="cloche" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`;

  // ---------------------------------------------------------------- essai gratuit
  function essai() { const n = Math.max(0, ESSAI_JOURS - Math.floor((maintenant() - dateDe(D.debut)) / 864e5)); return n; }

  // ================================================================ VUES
  function vueAccueil() {
    const n = maintenant(), ym = ymDe(n), j = n.getDate(), A = alarmes(), reste = essai();
    let recu = 0, attendu = 0;
    D.revenus.forEach(r => { const e = etat(r, ym); if (e === "v" || e === "g") return; attendu += r.montant; if (e === "r") recu += r.montant; });
    const dep = depensesDuMois(ym).reduce((s, d) => s + d.montant, 0), imp = calculImpot().parMois;
    const recs = mode => D.recurrentes.filter(rc => rc.mode === mode && tombe(rc, ym) && !paye(rc, ym)).sort((a, b) => (a.jour || 99) - (b.jour || 99));
    const revs = D.revenus.filter(r => ["a", "x", "p"].includes(etat(r, ym)));
    const vide = !D.revenus.length && !D.recurrentes.length && !D.depenses.length;
    let h = "";
    if (vide) h += `<div class="bloc bienvenue"><h2>Bienvenue dans Mes comptes</h2>
      <p style="margin:0">Vos revenus, vos dépenses, votre impôt et vos rappels, au même endroit. En 3 étapes :</p>
      <ol><li>Ajoutez vos <b>revenus</b> : loyers, salaire, autres.</li><li>Ajoutez les <b>dépenses qui reviennent</b> : STEG, SONEDE, téléphone, école…</li><li>Mettez les <b>alarmes sur votre téléphone</b> : il vous préviendra, même site fermé.</li></ol>
      <div class="boutons" style="justify-content:flex-start"><button type="button" class="btn btn-clair" data-a="aller" data-vue="revenus">Commencer</button><button type="button" class="btn" style="background:rgba(255,255,255,.16)" data-a="exemple">Voir avec un exemple</button></div>
      <p class="note">Vos chiffres restent dans votre téléphone : rien n'est envoyé, pas de compte à créer.</p></div>`;
    if (D.exemple) h += `<div class="exemple"><span><b>Exemple chargé</b> : les noms et montants sont inventés.</span><button type="button" class="mini" data-a="effacer-exemple">Effacer l'exemple et commencer</button></div>`;
    h += `<div class="essai"><b>${reste > 0 ? "Gratuit pendant 3 mois" : "Période gratuite terminée"}</b><span>${reste > 0 ? `Il vous reste <b class="num">${reste} jour${reste > 1 ? "s" : ""}</b>. Ensuite : un abonnement payant, prix affiché avant tout paiement. Rien n'est prélevé automatiquement.` : "L'abonnement arrive bientôt : vous pouvez continuer à utiliser le site en attendant."}</span></div>`;
    h += `<div class="grille">
      <div class="bloc"><div class="bloc-tete"><h2>Alarmes</h2><span class="petit doux">${jourStr(n)} ${n.getFullYear()}</span></div>
        <ul class="alarmes">${A.length ? A.map(a => `<li class="alarme ${["a-rouge", "a-orange", "a-jaune"][a.niv]}">${CLOCHE}<div><b>${esc(a.titre)}</b><div class="petit">${esc(a.txt)}</div>${a.action ? `<div class="actions">${a.action}</div>` : ""}</div></li>`).join("") : `<li class="vide">Aucune alarme aujourd'hui. Tout est à jour.</li>`}</ul>
        <div class="telephone"><b>Les alarmes sonnent sur votre téléphone</b><span class="petit">Un seul bouton met tous vos rappels dans l'agenda du téléphone (loyers, factures, impôt, « À appeler » à 18:30). Le téléphone sonne même si le site est fermé.</span>
          <button type="button" class="btn large" data-a="ics-tout">Mettre toutes mes alarmes sur mon téléphone</button></div></div>
      <div class="bloc"><div class="bloc-tete"><h2>À faire</h2><span class="etiq">${MOIS[n.getMonth()]}</span></div>
        <div class="sous" role="tablist" aria-label="Type">
          <button type="button" role="tab" data-a="sous" data-s="cash" aria-selected="${UI.sous === "cash"}">Cash <span class="n">${recs("cash").length}</span></button>
          <button type="button" role="tab" data-a="sous" data-s="internet" aria-selected="${UI.sous === "internet"}">Par internet <span class="n">${recs("internet").length}</span></button>
          <button type="button" role="tab" data-a="sous" data-s="revenus" aria-selected="${UI.sous === "revenus"}">Revenus <span class="n">${revs.length}</span></button>
        </div><ul class="taches">${UI.sous === "revenus" ? listeRevenus(revs, ym, j) : listeRecs(recs(UI.sous), j)}</ul></div></div>`;
    h += `<div class="bloc"><h2>Ce mois-ci</h2><div class="chiffres">
      <div class="chiffre plus"><span class="etiq">Reçu</span><span class="num">${DT0(recu)}</span><span class="petit doux">sur ${DT0(attendu)} attendus</span></div>
      <div class="chiffre moins"><span class="etiq">Dépensé</span><span class="num">${DT0(dep)}</span><span class="petit doux">${depensesDuMois(ym).length} dépense(s)</span></div>
      <div class="chiffre cote"><span class="etiq">Impôt à mettre de côté</span><span class="num">${DT0(imp)}</span><span class="petit doux">par mois (estimation)</span></div>
      <div class="chiffre"><span class="etiq">Reste</span><span class="num">${DT0(recu - dep - imp)}</span><span class="petit doux">reçu − dépensé − impôt</span></div></div></div>`;
    $("vue-accueil").innerHTML = h;
    const nr = A.filter(a => a.niv === 0).length, c = $("nbAlarmes"); c.hidden = !nr; c.textContent = nr;
    $("puceEssai").textContent = reste > 0 ? `Gratuit : ${reste} j` : "Gratuit 3 mois";
  }
  function listeRecs(l, j) {
    if (!l.length) return `<li class="vide">Rien à payer ${UI.sous === "cash" ? "en cash" : "par internet"} ce mois-ci.</li>`;
    return l.map(rc => { const d = rc.jour ? rc.jour - j : null;
      const p = d === null ? ["p-info", "Ce mois"] : d < 0 ? ["p-retard", "En retard"] : d <= 3 ? ["p-bientot", d === 0 ? "Aujourd'hui" : "Le " + rc.jour] : ["p-info", "Le " + rc.jour];
      return `<li class="tache"><span class="pastille ${p[0]}">${p[1]}</span><span>${esc(rc.quoi)}<br><span class="petit doux">${esc(FREQ[rc.freq] ? FREQ[rc.freq][1] : "")}</span></span><span class="num">${DT0(rc.montant)}</span>
        <span class="actions"><button type="button" class="mini vert" data-a="payer" data-id="${rc.id}">Payé</button></span></li>`; }).join("");
  }
  function listeRevenus(l, ym, j) {
    if (!l.length) return `<li class="vide">${D.revenus.length ? "Tous les revenus du mois sont reçus." : "Ajoutez vos revenus dans l'onglet Revenus."}</li>`;
    return l.map(r => { const e = etat(r, ym), retard = e !== "a" || j > r.jour;
      return `<li class="tache"><span class="pastille ${retard ? "p-retard" : "p-bientot"}">${e === "p" ? "À appeler" : retard ? "En retard" : "Avant le " + r.jour}</span><span><b>${esc(r.nom)}</b><span class="type-rev">${TYPES[r.type]}</span><br><span class="petit doux">${modeTxt(r)}${r.locataire ? " · " + esc(r.locataire) : ""}${r.tel ? ` · <span class="tel">${esc(r.tel)}</span>` : ""}</span></span><span class="num">${DT0(r.montant)}</span>
        <span class="actions">${r.type === "loyer" && r.tel ? lienTel(r) : ""}${r.type === "loyer" ? `<button type="button" class="mini ${e === "p" ? "on" : ""}" data-a="appeler" data-id="${r.id}">${e === "p" ? "À appeler ✓" : "À appeler"}</button>` : ""}<button type="button" class="mini vert" data-a="recu" data-id="${r.id}" data-ym="${ym}">Reçu</button></span></li>`; }).join("");
  }

  function vueRevenus() {
    const m0 = UI.moisVu, an = m0.slice(0, 4);
    const cols = UI.periode === "an" ? Array.from({ length: 12 }, (_, i) => an + "-" + p2(i + 1)) : UI.periode === "1" ? [m0] : [ymPlus(m0, -1), m0, ymPlus(m0, 1)];
    let h = `<div class="bloc"><div class="bloc-tete"><h2>Revenus</h2>
      <div class="nav-mois"><button type="button" data-a="mois" data-d="-1" aria-label="Mois précédent">‹</button><b>${nomMois(m0)}</b><button type="button" data-a="mois" data-d="1" aria-label="Mois suivant">›</button></div></div>
      <details class="ajout"${D.revenus.length ? "" : " open"}><summary>+ Ajouter un revenu</summary>${formRevenu(null)}</details>
      <div class="sous" role="tablist" aria-label="Période">${[["an", "Année"], ["3", "3 mois"], ["1", "Mois"]].map(([k, l]) => `<button type="button" role="tab" data-a="periode" data-p="${k}" aria-selected="${UI.periode === k}">${l}</button>`).join("")}</div>`;
    if (!D.revenus.length) h += `<p class="vide">Aucun revenu pour l'instant. Ajoutez votre premier loyer, salaire ou autre revenu avec le bouton ci-dessus.</p>`;
    else {
      h += `<div class="defile"><table><thead><tr><th>Revenu</th>${cols.map(c => `<th class="${c === m0 ? "courant" : ""}">${UI.periode === "an" ? MOIS_C[+c.slice(5) - 1] : nomMois(c)}</th>`).join("")}<th></th></tr></thead><tbody>`;
      for (const [ty, titre] of [["loyer", "Loyers"], ["salaire", "Salaires"], ["autre", "Autres revenus"]]) {
        const liste = D.revenus.filter(r => r.type === ty); if (!liste.length) continue;
        const ouvert = !D.replie.includes(ty), recus = liste.filter(r => etat(r, m0) === "r").length, total = liste.reduce((s, r) => s + r.montant, 0);
        h += `<tr class="groupe"><td colspan="${cols.length + 2}"><button type="button" data-a="replier" data-t="${ty}" aria-expanded="${ouvert}"><span class="fleche" aria-hidden="true">▾</span>${titre} <span class="resume">${liste.length} · ${DT0(total)} par mois · ${recus}/${liste.length} reçu${recus > 1 ? "s" : ""} en ${MOIS[+m0.slice(5) - 1]}</span></button></td></tr>`;
        if (!ouvert) continue;
        liste.forEach(r => {
          if (UI.modifRevenu === r.id) { h += `<tr><td colspan="${cols.length + 2}">${formRevenu(r)}</td></tr>`; return; }
          h += `<tr><td><div class="rev"><span><b>${esc(r.nom)}</b><span class="type-rev">${TYPES[r.type]}</span></span><span class="num petit">${DT0(r.montant)}/mois · avant le ${r.jour}</span>
            <label class="petit" style="display:flex;gap:6px;align-items:center">Reçu en <select class="mode-rev" data-a="mode" data-id="${r.id}"><option value="cash"${r.mode === "cash" ? " selected" : ""}>Cash</option><option value="virement"${r.mode !== "cash" ? " selected" : ""}>Virement</option></select></label>
            ${r.locataire ? `<span class="petit doux">${esc(r.locataire)}</span>` : ""}
            ${r.type === "loyer" ? `<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input class="num tel-in" inputmode="tel" data-a="tel" data-id="${r.id}" value="${esc(r.tel || "")}" placeholder="Téléphone" aria-label="Téléphone du locataire de ${esc(r.nom)}">${r.tel ? lienTel(r) : ""}</span>` : ""}
            <span><button type="button" class="mini" data-a="modif-rev" data-id="${r.id}">Modifier</button></span></div></td>`;
          cols.forEach(c => { const e = etat(r, c);
            h += `<td><select class="etat c-${e}" data-a="etat" data-id="${r.id}" data-ym="${c}" aria-label="${esc(r.nom)}, ${nomMois(c)}">${(r.type === "loyer" ? ETATS_LOYER : ETATS_AUTRE).map(([k, l]) => `<option value="${k}"${k === e ? " selected" : ""}>${l}</option>`).join("")}</select></td>`; });
          h += `<td><button type="button" class="suppr" data-a="suppr-rev" data-id="${r.id}" aria-label="Supprimer ${esc(r.nom)}">×</button></td></tr>`;
        });
      }
      h += `</tbody></table></div><p class="note">« À appeler » : alarme chaque jour à 18:30 jusqu'à ce que le loyer soit reçu. Mettez-la sur votre téléphone depuis l'accueil.</p>`;
    }
    $("vue-revenus").innerHTML = h + `</div>`;
  }
  function formRevenu(r) {
    const v = r || { type: "loyer", nom: "", montant: "", mode: "cash", jour: 5, locataire: "", tel: "" };
    return `<form class="form" data-f="revenu" data-id="${r ? r.id : ""}">
      <label>Type<select name="type" data-a="type-rev">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}"${v.type === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Nom<input name="nom" required value="${esc(v.nom)}" placeholder="${v.type === "loyer" ? "Ex. : Appartement 2" : v.type === "salaire" ? "Ex. : Salaire" : "Ex. : pension, prime…"}"></label>
      <label>Montant par mois (DT)<input name="montant" class="num" inputmode="decimal" required value="${esc(v.montant)}" placeholder="850"></label>
      <label>Reçu en<select name="mode"><option value="cash"${v.mode === "cash" ? " selected" : ""}>Cash</option><option value="virement"${v.mode !== "cash" ? " selected" : ""}>Virement</option></select></label>
      <label>Reçu avant le<select name="jour">${[1, 3, 5, 10, 15, 20, 25, 28].map(j => `<option value="${j}"${+v.jour === j ? " selected" : ""}>${j === 1 ? "1er" : j} du mois</option>`).join("")}</select></label>
      <label>${v.type === "loyer" ? "Locataire" : "Qui paie ?"}<input name="locataire" value="${esc(v.locataire)}" placeholder="${v.type === "loyer" ? "Nom du locataire" : "Ex. : employeur"}"></label>
      <label${v.type === "loyer" ? "" : " hidden"} data-seul="loyer">Téléphone<input name="tel" class="num" inputmode="tel" value="${esc(v.tel)}" placeholder="8 chiffres"></label>
      <div class="boutons">${r ? `<button type="button" class="mini" data-a="annuler-rev">Annuler</button>` : ""}<button class="btn" type="submit">${r ? "Enregistrer" : "Ajouter le revenu"}</button></div></form>`;
  }

  function vueDepenses() {
    const ym = ymDe(maintenant()), liste = depensesDuMois(ym).slice().reverse(), total = liste.reduce((s, d) => s + d.montant, 0);
    let h = `<div class="grille"><div class="bloc"><h2>Ajouter une dépense</h2>
      <form class="form" data-f="depense">
        <label>Quoi<input name="quoi" required placeholder="Ex. : courses, STEG, école…"></label>
        <label>Montant (DT)<input name="montant" class="num" inputmode="decimal" required placeholder="0,000"></label>
        <label>Catégorie<select name="cat">${CATS.map(c => `<option>${c}</option>`).join("")}</select></label>
        <label>Combien de fois ?<select name="freq"><option value="1">Une seule fois</option>${Object.entries(FREQ).map(([k, v]) => `<option value="${k}">${v[1][0].toUpperCase() + v[1].slice(1)}</option>`).join("")}</select></label>
        <label>Payé comment ?<select name="mode"><option value="cash">Cash</option><option value="internet">Par internet</option></select></label>
        <label>Jour du rappel<input name="jour" class="num" inputmode="numeric" placeholder="Ex. : 15"></label>
        <button class="btn" type="submit">Ajouter</button></form>
      <div><div class="bloc-tete"><h3>${MOIS[maintenant().getMonth()][0].toUpperCase() + MOIS[maintenant().getMonth()].slice(1)} : ${DT0(total)}</h3><span class="petit doux">${liste.length} dépense(s)</span></div>
      ${liste.length ? liste.map(d => `<div class="ligne"><span>${esc(d.quoi)}${d.recId ? `<span class="tag rec">revient</span>` : ""}</span><span class="num">${DT(d.montant)}</span><button type="button" class="suppr" data-a="suppr-dep" data-id="${d.id}" aria-label="Supprimer ${esc(d.quoi)}">×</button><span class="sous-texte">${esc(d.cat)} · ${d.mode === "internet" ? "par internet" : "cash"} · ${jourStr(dateDe(d.date))}</span></div>`).join("")
        : `<p class="vide">Aucune dépense ce mois-ci.</p>`}</div></div>
      <div class="bloc"><div class="bloc-tete"><h2>Dépenses qui reviennent</h2><span class="petit doux">rappelées dans « À faire »</span></div>
      ${D.recurrentes.length ? D.recurrentes.map(rc => `<div class="ligne"><span><b>${esc(rc.quoi)}</b><span class="tag">${rc.mode === "cash" ? "cash" : "internet"}</span></span><span class="num">${DT0(rc.montant)}</span><button type="button" class="suppr" data-a="suppr-rec" data-id="${rc.id}" aria-label="Arrêter ${esc(rc.quoi)}">×</button><span class="sous-texte">${esc(FREQ[rc.freq] ? FREQ[rc.freq][1] : "")}${rc.jour ? ", le " + rc.jour : ""} · ${esc(rc.cat)}</span></div>`).join("")
        : `<p class="vide">Aucune. Choisissez « Chaque mois » (ou autre) en ajoutant une dépense : STEG, SONEDE, téléphone, école…</p>`}</div></div>`;
    $("vue-depenses").innerHTML = h;
  }

  function vueImpot() {
    const I = D.impot, n = maintenant(), c = calculImpot();
    const L = D.echeances.filter(e => { if (UI.filtreEch === "tout") return true; const d = joursAvant(dateDe(e.date)); if (d < 0) return !e.paye;
      if (UI.filtreEch === "0") return e.date.slice(0, 7) === ymDe(n); return dateDe(e.date) <= new Date(n.getFullYear(), n.getMonth() + +UI.filtreEch, n.getDate()); }).sort((a, b) => a.date < b.date ? -1 : 1);
    let h = `<div class="grille"><div class="bloc"><h2>Dates limites et rappels</h2>
      <div class="sous" role="tablist" aria-label="Période">${[["0", "Ce mois"], ["3", "3 mois"], ["6", "6 mois"], ["12", "1 an"], ["tout", "Tout"]].map(([k, l]) => `<button type="button" role="tab" data-a="filtre-ech" data-f="${k}" aria-selected="${UI.filtreEch === k}">${l}</button>`).join("")}</div>
      <ul class="taches">${L.length ? L.map(e => { const d = joursAvant(dateDe(e.date));
        const p = e.paye ? ["p-ok", "Payé"] : d < 0 ? ["p-retard", "En retard"] : d <= 3 ? ["p-retard", "J−" + d] : d <= 15 ? ["p-bientot", "J−" + d] : d <= 31 ? ["p-verif", "J−" + d] : ["p-info", "dans " + d + " j"];
        return `<li class="tache"><span class="pastille ${p[0]}">${p[1]}</span><span><b>${esc(e.quoi)}</b><br><span class="petit doux">${jourStr(dateDe(e.date))} ${e.date.slice(0, 4)} · rappels 1 mois, 15 jours et 3 jours avant</span></span><span class="num">${e.montant ? DT0(e.montant) : "—"}</span>
          <span class="actions">${e.verif ? `<span class="pastille p-verif">date à vérifier</span>` : ""}${e.paye ? "" : btnAgenda("ech:" + e.id) + lienG(evEch(e)) + `<button type="button" class="mini vert" data-a="ech-paye" data-id="${e.id}">Payé</button>`}<button type="button" class="suppr" data-a="suppr-ech" data-id="${e.id}" aria-label="Supprimer">×</button></span></li>`; }).join("")
        : `<li class="vide">Aucune date limite pour cette période.</li>`}</ul>
      <details class="ajout"><summary>+ Ajouter une date limite</summary><form class="form" data-f="echeance">
        <label>Quoi<input name="quoi" required placeholder="Ex. : acompte provisionnel"></label>
        <label>Date limite<input name="date" type="date" required></label>
        <label>Montant (DT)<input name="montant" class="num" inputmode="decimal" placeholder="0"></label>
        <button class="btn" type="submit">Ajouter</button></form></details>
      ${D.echeances.length ? "" : `<button type="button" class="mini" data-a="ech-habituelles">Ajouter les dates habituelles (à vérifier)</button>`}
      <p class="note">Dates indicatives : vérifiez-les auprès de l'administration fiscale ou de votre comptable. Les rappels arrivent sur votre téléphone 1 mois, 15 jours et 3 jours avant.</p></div>
      <div class="bloc"><h2>Calcul de l'impôt sur le revenu</h2>
      <form class="form" data-f="impot">
        <label>Salaire brut de l'année (DT)<input name="salaireBrut" class="num" inputmode="decimal" value="${esc(I.salaireBrut || "")}" placeholder="Sur votre fiche de paie"></label>
        <label>Chef de famille<select name="chef"><option value="1"${I.chef ? " selected" : ""}>Oui</option><option value="0"${I.chef ? "" : " selected"}>Non</option></select></label>
        <label>Enfants à charge<select name="enfants">${[0, 1, 2, 3, 4].map(k => `<option${+I.enfants === k ? " selected" : ""}>${k}</option>`).join("")}</select></label>
        <label>Déjà retenu sur le salaire (DT)<input name="retenu" class="num" inputmode="decimal" value="${esc(I.retenu || "")}" placeholder="0"></label></form>
      <div class="calcul" id="calculImpot">${detailImpot(c)}</div>
      <p class="note">Les loyers et autres revenus viennent de l'onglet Revenus (12 mois). Tous comptent pour l'impôt, qu'ils soient reçus en cash ou par virement. Barème 2026 par tranches ; abattement de 30 % sur les loyers : à vérifier. Calcul indicatif.</p></div></div>`;
    $("vue-impot").innerHTML = h;
  }
  function detailImpot(c) {
    return [["Salaire brut", DT(c.sal)], ["Cotisation CNSS (9,68 %)", "− " + DT(c.cnss)], ["Frais professionnels (10 %, 2 000 DT max.)", "− " + DT(c.frais)],
      [`Loyers de l'année : ${DT0(c.loyersAn)} (dont cash ${DT0(c.loyCash)}, virement ${DT0(c.loyVir)})`, ""], ["Loyers après abattement de 30 % (à vérifier)", "+ " + DT(c.foncier)],
      ["Autres revenus de l'année (à vérifier)", "+ " + DT(c.autresAn)], ["Chef de famille et enfants", "− " + DT(c.ded)], ["Revenu imposable", DT(c.imposable)],
      ["Impôt selon le barème", DT(c.irpp)], ["Contribution sociale (0,5 %)", DT(c.css)], ["Déjà retenu sur le salaire", "− " + DT(c.retenu)]]
      .map(([a, b]) => `<div><span>${a}</span><span class="num">${b}</span></div>`).join("") +
      `<div class="total"><span>${c.reste >= 0 ? "Reste à payer" : "Trop payé (à récupérer)"}</span><span class="num">${DT(Math.abs(c.reste))}</span></div>
       <div class="total"><span>À mettre de côté chaque mois</span><span class="num">${DT(c.parMois)}</span></div>`;
  }

  function vueProjets() {
    const moy = capacite(), ym = ymDe(maintenant());
    const OB = D.projets.filter(p => p.type === "oblig"), FU = D.projets.filter(p => p.type !== "oblig");
    let reserve = 0;
    const carte = (p, corps) => {
      if (UI.modifProjet === p.id) return `<article class="projet"><h3>Modifier « ${esc(p.nom)} »</h3>${formProjet(p)}</article>`;
      const pct = p.cout ? Math.min(100, p.epargne / p.cout * 100) : 0;
      return `<article class="projet"><h3>${esc(p.nom)}</h3><div class="barre" role="img" aria-label="Épargné : ${Math.round(pct)} %"><i style="width:${pct}%"></i></div>
        <div class="lignes"><div><span>Coût</span><span class="num">${DT0(p.cout)}</span></div><div><span>Déjà épargné</span><span class="num">${DT0(p.epargne)}</span></div><div><span>Pour</span><span>${nomMois(p.fin)}</span></div></div>${corps}
        <div class="boutons"><button type="button" class="mini" data-a="modif-projet" data-id="${p.id}">Modifier</button><button type="button" class="mini rouge" data-a="suppr-projet" data-id="${p.id}">Supprimer</button></div></article>`; };
    const hOb = OB.map(p => { const manque = Math.max(p.cout - p.epargne, 0), dispo = Math.max(ecartMois(ym, p.fin), 1), faut = manque / dispo; reserve += faut;
      return carte(p, manque === 0 ? `<div class="verdict v-ok">Prêt : la somme est déjà épargnée.</div>` : `<div class="verdict ${faut <= moy ? "v-ok" : "v-non"}">Mettez de côté <b class="num">${DT0(faut)}</b> par mois pendant ${dispo} mois pour être prêt en ${nomMois(p.fin)}.</div>`); }).join("");
    const libre = moy - reserve, peut = Math.max(libre, 0);
    const tot = {}; [1, 2, 3].forEach(k => depensesDuMois(ymPlus(ym, -k + 1)).forEach(d => tot[d.cat] = (tot[d.cat] || 0) + d.montant / 3));
    const [gCat, gVal] = Object.entries(tot).sort((a, b) => b[1] - a[1])[0] || ["", 0];
    const finOb = OB.map(p => ({ p, n: Math.max(ecartMois(ym, p.fin), 1), f: Math.max(p.cout - p.epargne, 0) / Math.max(ecartMois(ym, p.fin), 1) })).sort((a, b) => a.n - b.n)[0];
    const hFu = FU.map(p => { const manque = Math.max(p.cout - p.epargne, 0), dispo = Math.max(ecartMois(ym, p.fin), 1), faut = manque / dispo;
      if (manque === 0) return carte(p, `<div class="verdict v-ok">Déjà possible : la somme est épargnée.</div>`);
      if (faut <= peut) return carte(p, `<div class="verdict v-ok">Faisable : en mettant <b class="num">${DT0(faut)}</b> par mois, prêt en ${nomMois(p.fin)}. Il vous resterait ${DT0(peut - faut)} par mois.</div>`);
      const cs = [];
      if (peut > 0) { const k = Math.ceil(manque / peut); cs.push(`Repoussez à <b>${nomMois(ymPlus(ym, k))}</b> : avec ce qui vous reste (${DT0(peut)} par mois), vous y arrivez en ${k} mois.`); }
      cs.push(`Ou trouvez <b class="num">${DT0(faut - peut)}</b> de plus par mois pour garder ${nomMois(p.fin)}.`);
      if (gVal > 0) cs.push(`Réduisez « ${esc(gCat)} » de 10 % : environ ${DT0(gVal * .1)} de plus par mois.`);
      if (finOb) cs.push(`Après « ${esc(finOb.p.nom)} » (${nomMois(finOb.p.fin)}), ses ${DT0(finOb.f)} par mois pourront aller à ce projet.`);
      if (p.cout > 10000) cs.push("Un crédit est possible : comparez d'abord son coût total.");
      return carte(p, `<div class="verdict v-non">Pas faisable à temps : il faudrait ${DT0(faut)} par mois, il vous reste ${DT0(peut)} après les projets obligatoires.</div><div><b class="petit">Conseils pour y arriver</b><ul class="conseils">${cs.map(x => `<li>${x}</li>`).join("")}</ul></div>`); }).join("");
    $("vue-projets").innerHTML = `<div class="bloc"><div class="bloc-tete"><h2>Mes projets</h2><span class="petit doux">Il vous reste en moyenne ${DT0(moy)} par mois après dépenses et impôt.</span></div>
      <details class="ajout"${D.projets.length ? "" : " open"}><summary>+ Ajouter un projet</summary>${formProjet(null)}</details>
      <div class="projets"><div class="titre-groupe"><h3>À faire (obligatoires)</h3><p class="petit doux" style="margin:2px 0 0">À mettre de côté chaque mois : <b class="num">${DT0(reserve)}</b></p></div>
      ${hOb || `<p class="vide">Aucun projet obligatoire (rentrée scolaire, Omra, travaux…).</p>`}
      <div class="titre-groupe"><h3>Projets futurs (on aimerait)</h3><p class="petit doux" style="margin:2px 0 0">Ce qui reste pour eux : <b class="num">${DT0(libre)}</b> par mois</p></div>
      ${hFu || `<p class="vide">Aucun projet futur. Ajoutez-en un pour savoir s'il est faisable.</p>`}</div></div>`;
  }
  function formProjet(p) {
    const v = p || { nom: "", type: "futur", cout: "", epargne: "", fin: ymPlus(ymDe(maintenant()), 12) };
    return `<form class="form" data-f="projet" data-id="${p ? p.id : ""}">
      <label>Projet<input name="nom" required value="${esc(v.nom)}" placeholder="Ex. : nouvelle voiture"></label>
      <label>Type<select name="type"><option value="oblig"${v.type === "oblig" ? " selected" : ""}>À faire (obligatoire)</option><option value="futur"${v.type !== "oblig" ? " selected" : ""}>Projet futur (on aimerait)</option></select></label>
      <label>Coût total (DT)<input name="cout" class="num" inputmode="decimal" required value="${esc(v.cout)}" placeholder="45000"></label>
      <label>Déjà épargné (DT)<input name="epargne" class="num" inputmode="decimal" value="${esc(v.epargne)}" placeholder="0"></label>
      <label>Pour quand ?<input name="fin" type="month" required value="${esc(v.fin)}"></label>
      <div class="boutons">${p ? `<button type="button" class="mini" data-a="annuler-projet">Annuler</button>` : ""}<button class="btn" type="submit">${p ? "Enregistrer" : "Ajouter le projet"}</button></div></form>`;
  }

  function vuePlus() {
    const F = D.facture, somme = D.compteurs.reduce((s, c) => s + Math.max(lireNb(c.actuel) - lireNb(c.ancien), 0), 0);
    const base = F.methode === "locataires" ? somme : Math.max(lireNb(F.total), somme);
    $("vue-plus").innerHTML = `<div class="bloc"><h2>Partager une facture STEG ou SONEDE</h2>
      <p class="petit doux" style="margin:0">Pour plusieurs logements sur un même compteur : chacun paie selon sa consommation (index actuel − index précédent), moins l'avance déjà versée.</p>
      <form class="form" data-f="facture">
        <label>Montant de la facture (DT)<input name="montant" class="num" inputmode="decimal" value="${esc(F.montant || "")}" placeholder="412,000"></label>
        <label>Partage<select name="methode"><option value="locataires"${F.methode === "locataires" ? " selected" : ""}>Entre les locataires seulement</option><option value="proprio"${F.methode !== "locataires" ? " selected" : ""}>Avec une part pour moi (parties communes)</option></select></label>
        <label${F.methode === "locataires" ? " hidden" : ""}>Consommation totale de la facture<input name="total" class="num" inputmode="decimal" value="${esc(F.total || "")}" placeholder="kWh ou m³"></label></form>
      <div class="defile"><table><thead><tr><th>Logement</th><th>Index précédent</th><th>Index actuel</th><th>Avance</th><th>Part</th><th>Reste</th><th></th></tr></thead><tbody>
      ${D.compteurs.map(c => { const conso = Math.max(lireNb(c.actuel) - lireNb(c.ancien), 0), part = base ? conso / base * lireNb(F.montant) : 0, reste = part - lireNb(c.avance);
        return `<tr><td><input data-a="cpt" data-id="${c.id}" data-k="nom" value="${esc(c.nom)}" aria-label="Logement" style="min-width:8em"></td>
          <td><input class="num" style="width:7em" inputmode="decimal" data-a="cpt" data-id="${c.id}" data-k="ancien" value="${esc(c.ancien)}" aria-label="Index précédent"></td>
          <td><input class="num" style="width:7em" inputmode="decimal" data-a="cpt" data-id="${c.id}" data-k="actuel" value="${esc(c.actuel)}" aria-label="Index actuel"></td>
          <td><input class="num" style="width:6em" inputmode="decimal" data-a="cpt" data-id="${c.id}" data-k="avance" value="${esc(c.avance)}" aria-label="Avance versée"></td>
          <td class="num">${DT(part)}</td><td class="num" style="color:${reste > 0 ? "var(--retard)" : "var(--ok)"}">${reste >= 0 ? "doit " + DT(reste) : "à rendre " + DT(-reste)}</td>
          <td><button type="button" class="suppr" data-a="suppr-cpt" data-id="${c.id}" aria-label="Retirer">×</button></td></tr>`; }).join("")}
      ${F.methode !== "locataires" && D.compteurs.length ? `<tr><td colspan="4"><b>Ma part</b></td><td class="num"><b>${DT(base ? Math.max(base - somme, 0) / base * lireNb(F.montant) : 0)}</b></td><td colspan="2"></td></tr>` : ""}
      </tbody></table></div>
      <div class="boutons" style="justify-content:space-between"><button type="button" class="mini" data-a="ajout-cpt">+ Ajouter un logement</button>${D.compteurs.length ? `<button type="button" class="mini" data-a="cpt-suivant">Nouvelle facture : l'index actuel devient l'index précédent</button>` : ""}</div></div>

      <div class="bloc"><h2>Sauvegarde</h2>
      <p class="petit doux" style="margin:0">Vos chiffres sont seulement dans ce téléphone. Faites une sauvegarde de temps en temps, et pour passer sur un autre téléphone ou sur l'ordinateur.</p>
      <div class="boutons" style="justify-content:flex-start"><button type="button" class="btn" data-a="sauvegarde">Télécharger ma sauvegarde</button>
        <label class="btn btn-clair" style="display:inline-flex;cursor:pointer">Restaurer une sauvegarde<input type="file" accept=".json,application/json" data-a="restaurer" hidden></label>
        <button type="button" class="btn btn-clair" data-a="excel">Exporter pour Excel</button></div>
      ${stockageOk ? "" : `<p class="note" style="color:var(--retard)">Ce navigateur ne garde pas les données (navigation privée ?). Utilisez une fenêtre normale.</p>`}</div>

      <div class="bloc"><h2>Gratuit pendant 3 mois</h2>
      <p style="margin:0">Mes comptes est <b>gratuit pendant 3 mois</b> à partir de votre première visite. Ensuite, un abonnement payant sera proposé : le prix sera affiché avant tout paiement, rien n'est prélevé automatiquement, et vos chiffres restent à vous (sauvegarde et export toujours possibles).</p></div>

      <div class="bloc"><h2>Votre avis</h2>
      <form class="form" data-f="avis" style="grid-template-columns:1fr">
        <label>Une idée, un problème, une question ?<input name="message" required maxlength="1000" placeholder="Écrivez ici"></label>
        <button class="btn" type="submit">Envoyer</button><p class="petit doux" role="status" id="avisStatut" style="margin:0">Envoyé de façon anonyme (n'écrivez pas vos montants).</p></form></div>

      <div class="bloc"><h2>Exemple et remise à zéro</h2>
      <div class="boutons" style="justify-content:flex-start"><button type="button" class="mini" data-a="exemple">Charger l'exemple</button>
      ${UI.effacer ? `<span class="petit">Tout effacer de ce téléphone ?</span><button type="button" class="mini rouge" data-a="effacer-ok">Oui, tout effacer</button><button type="button" class="mini" data-a="effacer-non">Non</button>` : `<button type="button" class="mini rouge" data-a="effacer">Tout effacer</button>`}</div></div>`;
  }

  function tout() { vueAccueil(); vueRevenus(); vueDepenses(); vueImpot(); vueProjets(); vuePlus(); montrer(UI.vue, false); }
  function montrer(v, haut) {
    if (!$("vue-" + v)) v = "accueil";
    UI.vue = v;
    document.querySelectorAll("nav.onglets button").forEach(b => b.setAttribute("aria-current", String(b.dataset.vue === v)));
    document.querySelectorAll(".vue").forEach(s => s.hidden = s.id !== "vue-" + v);
    try { localStorage.setItem("mes-comptes-onglet", v); } catch (e) {}
    if (haut) window.scrollTo({ top: 0 });
  }

  // ================================================================ ACTIONS
  const trouve = (l, id) => D[l].find(x => x.id === id);
  function retirer(l, id, txt) { const i = D[l].findIndex(x => x.id === id); if (i < 0) return; const [o] = D[l].splice(i, 1); sauver(); tout(); message(txt.replace("%", o.nom || o.quoi), () => D[l].splice(i, 0, o)); }
  function payer(id) { const rc = trouve("recurrentes", id), ym = ymDe(maintenant()), dep = { id: nouvelId(), date: isoDe(maintenant()), quoi: rc.quoi, montant: rc.montant, cat: rc.cat, mode: rc.mode, recId: rc.id };
    changer(() => { D.payes[rc.id + "|" + ym] = true; D.depenses.push(dep); }, `« ${rc.quoi} » notée comme payée.`, () => { delete D.payes[rc.id + "|" + ym]; D.depenses = D.depenses.filter(d => d.id !== dep.id); }); }

  document.addEventListener("click", e => {
    const nav = e.target.closest("nav.onglets button"); if (nav) { montrer(nav.dataset.vue, true); return; }
    if (e.target.closest("#puceEssai")) { montrer("plus", true); return; }
    const b = e.target.closest("[data-a]"); if (!b || b.tagName === "SELECT" || b.tagName === "INPUT") return;
    const a = b.dataset.a, id = b.dataset.id;
    if (a === "aller") montrer(b.dataset.vue, true);
    else if (a === "sous") { UI.sous = b.dataset.s; vueAccueil(); }
    else if (a === "periode") { UI.periode = b.dataset.p; vueRevenus(); }
    else if (a === "mois") { UI.moisVu = ymPlus(UI.moisVu, +b.dataset.d); vueRevenus(); }
    else if (a === "replier") { const t = b.dataset.t; D.replie = D.replie.includes(t) ? D.replie.filter(x => x !== t) : D.replie.concat(t); sauver(); vueRevenus(); }
    else if (a === "filtre-ech") { UI.filtreEch = b.dataset.f; vueImpot(); }
    else if (a === "recu") { const r = trouve("revenus", id), ym = b.dataset.ym, k = id + "|" + ym, avant = D.etats[k]; changer(() => { D.etats[k] = "r"; }, `« ${r.nom} » reçu (${modeTxt(r)}).`, () => { if (avant) D.etats[k] = avant; else delete D.etats[k]; }); }
    else if (a === "appeler") { const r = trouve("revenus", id), k = id + "|" + ymDe(maintenant()), avant = D.etats[k], on = etat(r, ymDe(maintenant())) === "p";
      changer(() => { D.etats[k] = on ? "x" : "p"; }, on ? "Rappel « À appeler » arrêté." : `Alarme chaque jour à 18:30 pour appeler ${r.locataire || "le locataire"}. Mettez-la sur votre téléphone.`, () => { if (avant) D.etats[k] = avant; else delete D.etats[k]; }); }
    else if (a === "fin-appel") { const r = trouve("revenus", id), ym = ymDe(maintenant()), ks = [ym, ymPlus(ym, -1)].filter(m => etat(r, m) === "p").map(m => id + "|" + m);
      changer(() => ks.forEach(k => { D.etats[k] = "x"; }), "Appel fait : le loyer reste « en retard » jusqu'à ce qu'il soit reçu.", () => ks.forEach(k => { D.etats[k] = "p"; })); }
    else if (a === "payer") payer(id);
    else if (a === "ech-paye") { const e2 = trouve("echeances", id); changer(() => { e2.paye = true; }, "Date limite notée comme payée.", () => { e2.paye = false; }); }
    else if (a === "suppr-rev") retirer("revenus", id, "« % » supprimé.");
    else if (a === "suppr-dep") { const i = D.depenses.findIndex(d => d.id === id), [o] = D.depenses.splice(i, 1); const k = o.recId ? o.recId + "|" + o.date.slice(0, 7) : null;
      if (k) delete D.payes[k]; sauver(); tout(); message(`« ${o.quoi} » supprimée.`, () => { D.depenses.splice(i, 0, o); if (k) D.payes[k] = true; }); }
    else if (a === "suppr-rec") retirer("recurrentes", id, "« % » ne sera plus rappelée.");
    else if (a === "suppr-ech") retirer("echeances", id, "« % » supprimée.");
    else if (a === "suppr-projet") retirer("projets", id, "Projet « % » supprimé.");
    else if (a === "suppr-cpt") retirer("compteurs", id, "« % » retiré.");
    else if (a === "modif-rev") { UI.modifRevenu = id; vueRevenus(); }
    else if (a === "annuler-rev") { UI.modifRevenu = null; vueRevenus(); }
    else if (a === "modif-projet") { UI.modifProjet = id; vueProjets(); }
    else if (a === "annuler-projet") { UI.modifProjet = null; vueProjets(); }
    else if (a === "ajout-cpt") changer(() => D.compteurs.push({ id: nouvelId(), nom: "Logement " + (D.compteurs.length + 1), ancien: "", actuel: "", avance: "" }));
    else if (a === "cpt-suivant") { const avant = JSON.parse(JSON.stringify(D.compteurs)); changer(() => D.compteurs.forEach(c => { c.ancien = c.actuel; c.actuel = ""; c.avance = ""; }), "Prêt pour la nouvelle facture.", () => { D.compteurs = avant; }); }
    else if (a === "ech-habituelles") changer(ajouterEcheancesHabituelles, "Dates ajoutées. Vérifiez-les et modifiez-les si besoin.");
    else if (a === "ics") { const ev = evDeCle(b.dataset.cle); if (ev && telecharger("rappel-mes-comptes.ics", fichierIcs([ev]), "text/calendar")) message("Ouvrez le fichier téléchargé : votre agenda propose d'ajouter le rappel.", null); }
    else if (a === "ics-tout") { const evs = tousLesRappels(); if (!evs.length) { message("Ajoutez d'abord des revenus, des dépenses qui reviennent ou des dates limites.", null); return; }
      if (telecharger("alarmes-mes-comptes.ics", fichierIcs(evs), "text/calendar")) message(`${evs.length} rappels prêts : ouvrez le fichier téléchargé pour les ajouter à l'agenda du téléphone.`, null); }
    else if (a === "sauvegarde") { if (telecharger("mes-comptes-sauvegarde-" + isoDe(maintenant()) + ".json", JSON.stringify(D, null, 1), "application/json")) message("Sauvegarde téléchargée. Gardez ce fichier en lieu sûr.", null); }
    else if (a === "excel") exporterExcel();
    else if (a === "exemple") { const avant = JSON.parse(JSON.stringify(D)); D = exemple(); sauver(); tout(); montrer("accueil", true); message("Exemple chargé : les noms et montants sont inventés.", () => { D = avant; }); }
    else if (a === "effacer-exemple" || a === "effacer-ok") { const avant = JSON.parse(JSON.stringify(D)); D = vide(); if (a === "effacer-exemple") D.debut = avant.debut; UI.effacer = false; sauver(); tout(); message("Tout est effacé.", () => { D = avant; }); }
    else if (a === "effacer") { UI.effacer = true; vuePlus(); }
    else if (a === "effacer-non") { UI.effacer = false; vuePlus(); }
  });

  document.addEventListener("change", e => {
    const el = e.target, a = el.dataset.a, id = el.dataset.id;
    if (a === "etat") { const k = id + "|" + el.dataset.ym; changer(() => { D.etats[k] = el.value; }); }
    else if (a === "mode") { const r = trouve("revenus", id); changer(() => { r.mode = el.value; }); }
    else if (a === "tel") { const r = trouve("revenus", id); changer(() => { r.tel = el.value.trim(); }); }
    else if (a === "cpt") { const c = trouve("compteurs", id); changer(() => { c[el.dataset.k] = el.value; }); }
    else if (a === "type-rev") { const f = el.form; f.querySelector('[data-seul="loyer"]').hidden = el.value !== "loyer"; }
    else if (a === "restaurer" && el.files && el.files[0]) {
      const lec = new FileReader();
      lec.onload = () => { try { const o = JSON.parse(lec.result); if (!o || o.v !== 1 || !Array.isArray(o.revenus)) throw 0; const avant = D; D = Object.assign(vide(), o); sauver(); tout(); message("Sauvegarde restaurée.", () => { D = avant; }); }
        catch (err) { message("Ce fichier n'est pas une sauvegarde de Mes comptes.", null); } };
      lec.readAsText(el.files[0]);
    }
    const f = el.closest("form[data-f]");
    if (f && (f.dataset.f === "impot" || f.dataset.f === "facture")) enregistrerForm(f, true);
  });
  document.addEventListener("input", e => { const f = e.target.closest("form[data-f=impot]"); if (f) { lireImpot(f); $("calculImpot").innerHTML = detailImpot(calculImpot()); sauver(); } });
  function lireImpot(f) { D.impot = { salaireBrut: lireNb(f.elements.salaireBrut.value), chef: f.elements.chef.value === "1", enfants: +f.elements.enfants.value, retenu: lireNb(f.elements.retenu.value) }; }

  document.addEventListener("submit", e => { const f = e.target.closest("form[data-f]"); if (!f) return; e.preventDefault(); enregistrerForm(f, false); });
  function enregistrerForm(f, auto) {
    const v = n => (f.elements[n] ? f.elements[n].value : "").trim(), k = f.dataset.f, id = f.dataset.id;
    if (k === "revenu") {
      const o = { type: v("type"), nom: v("nom"), montant: lireNb(v("montant")), mode: v("mode"), jour: +v("jour") || 5, locataire: v("locataire"), tel: v("type") === "loyer" ? v("tel") : "" };
      if (!o.nom || !o.montant) { message("Indiquez au moins le nom et le montant.", null); return; }
      if (id) { const r = trouve("revenus", id), avant = { ...r }; UI.modifRevenu = null; changer(() => Object.assign(r, o), `« ${o.nom} » modifié.`, () => Object.assign(r, avant)); }
      else { const r = Object.assign({ id: nouvelId(), depuis: ymDe(maintenant()) }, o); changer(() => D.revenus.push(r), `« ${o.nom} » ajouté : attendu chaque mois avant le ${o.jour}.`, () => { D.revenus = D.revenus.filter(x => x.id !== r.id); }); }
    } else if (k === "depense") {
      const m = lireNb(v("montant")), freq = v("freq"); if (!v("quoi") || !m) { message("Indiquez quoi et le montant.", null); return; }
      const ym = ymDe(maintenant()), dep = { id: nouvelId(), date: isoDe(maintenant()), quoi: v("quoi"), montant: m, cat: v("cat"), mode: v("mode") };
      let rc = null;
      if (freq !== "1") { rc = { id: nouvelId(), quoi: dep.quoi, montant: m, cat: dep.cat, mode: dep.mode, jour: Math.min(31, Math.max(0, Math.round(lireNb(v("jour"))))), freq, depart: ym }; dep.recId = rc.id; }
      changer(() => { D.depenses.push(dep); if (rc) { D.recurrentes.push(rc); D.payes[rc.id + "|" + ym] = true; } f.reset(); },
        rc ? `« ${dep.quoi} » ajoutée, et rappelée ${FREQ[freq][1]}.` : `« ${dep.quoi} » ajoutée.`,
        () => { D.depenses = D.depenses.filter(d => d.id !== dep.id); if (rc) D.recurrentes = D.recurrentes.filter(x => x.id !== rc.id); });
    } else if (k === "projet") {
      const o = { nom: v("nom"), type: v("type"), cout: lireNb(v("cout")), epargne: lireNb(v("epargne")), fin: v("fin") || ymPlus(ymDe(maintenant()), 12) };
      if (!o.nom || !o.cout) { message("Indiquez le projet et son coût.", null); return; }
      if (id) { const p = trouve("projets", id), avant = { ...p }; UI.modifProjet = null; changer(() => Object.assign(p, o), `Projet « ${o.nom} » modifié.`, () => Object.assign(p, avant)); }
      else { const p = Object.assign({ id: nouvelId() }, o); changer(() => D.projets.push(p), `Projet « ${o.nom} » ajouté.`, () => { D.projets = D.projets.filter(x => x.id !== p.id); }); }
    } else if (k === "echeance") {
      if (!v("quoi") || !v("date")) return; const e2 = { id: nouvelId(), quoi: v("quoi"), date: v("date"), montant: lireNb(v("montant")), paye: false, verif: false };
      changer(() => D.echeances.push(e2), `« ${e2.quoi} » ajoutée : rappels 1 mois, 15 jours et 3 jours avant.`, () => { D.echeances = D.echeances.filter(x => x.id !== e2.id); });
    } else if (k === "impot") { lireImpot(f); sauver(); vueImpot(); vueAccueil(); }
    else if (k === "facture") { D.facture = { montant: lireNb(v("montant")), methode: v("methode"), total: lireNb(v("total")) }; sauver(); vuePlus(); }
    else if (k === "avis" && !auto) envoyerAvis(f);
  }
  async function envoyerAvis(f) {
    const st = $("avisStatut"), msg = f.elements.message.value.trim(); if (!msg) return;
    st.textContent = "Envoi…";
    try { const r = await fetch("https://formspree.io/f/mwlpakqj", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ site: "Mes comptes", page: "plus", message: msg }) });
      if (!r.ok) throw 0; f.reset(); st.textContent = "Merci ! Votre avis est envoyé."; }
    catch (err) { st.textContent = "L'envoi n'a pas marché (pas de connexion ?). Réessayez plus tard."; }
  }
  function exporterExcel() {
    const q = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`, n = x => String(Math.round(x * 1000) / 1000).replace(".", ",");
    const L = ["\ufeffType;Date ou mois;Nom;Catégorie;Mode;Montant (DT);État"];
    D.depenses.forEach(d => L.push(["Dépense", d.date, q(d.quoi), q(d.cat), d.mode === "internet" ? "internet" : "cash", n(d.montant), ""].join(";")));
    Object.entries(D.etats).forEach(([k, e]) => { const [rid, ym] = k.split("|"), r = trouve("revenus", rid); if (r) L.push(["Revenu", ym, q(r.nom), TYPES[r.type], modeTxt(r), n(r.montant), { r: "reçu", x: "en retard", p: "à appeler", a: "attendu", g: "gratuit", v: "rien" }[e]].join(";")); });
    if (telecharger("mes-comptes-" + isoDe(maintenant()) + ".csv", L.join("\r\n"), "text/csv")) message("Fichier téléchargé : ouvrez-le avec Excel.", null);
  }

  // ---------------------------------------------------------------- dates habituelles (d'après des carnets réels, À VÉRIFIER)
  function prochaine(mois, jour) { const n = maintenant(); let d = new Date(n.getFullYear(), mois - 1, jour); if (joursAvant(d) < 0) d = new Date(n.getFullYear() + 1, mois - 1, jour); return isoDe(d); }
  function ajouterEcheancesHabituelles() {
    [["Acompte provisionnel (juin)", 6, 25], ["Acompte provisionnel (septembre)", 9, 25], ["Acompte provisionnel (décembre)", 12, 25],
     ["Vignette de la voiture", 3, 5], ["Déclaration annuelle des revenus", 4, 25]].forEach(([quoi, m, j]) =>
      D.echeances.push({ id: nouvelId(), quoi, date: prochaine(m, j), montant: 0, paye: false, verif: true }));
  }

  // ---------------------------------------------------------------- exemple (noms et montants inventés)
  function exemple() {
    const n = maintenant(), ym = ymDe(n), o = vide(), id = () => nouvelId();
    o.exemple = true; o.debut = D.debut || isoDe(n);
    const R = [["loyer", "Boutique — café", 1600, "virement", 5, "M. Ben Salah (exemple)", "+216 00 000 001"], ["loyer", "Appartement 1", 850, "cash", 5, "M. Gharbi (exemple)", "+216 00 000 002"],
      ["loyer", "Appartement 2", 850, "cash", 5, "Mme Mansour (exemple)", "+216 00 000 003"], ["salaire", "Salaire", 3200, "virement", 28, "Employeur (exemple)", ""], ["autre", "Cours particuliers", 600, "cash", 10, "", ""]];
    R.forEach(([type, nom, montant, mode, jour, locataire, tel]) => o.revenus.push({ id: id(), type, nom, montant, mode, jour, locataire, tel, depuis: ymPlus(ym, -3) }));
    o.revenus.forEach((r, i) => { for (let k = 3; k >= 1; k--) o.etats[r.id + "|" + ymPlus(ym, -k)] = "r"; if (i === 0 || i === 4) o.etats[r.id + "|" + ym] = "r"; });
    o.etats[o.revenus[2].id + "|" + ym] = "p";
    const C = [["Internet fibre", 61, "Téléphone et internet", "internet", 10, "mois"], ["Ooredoo", 102, "Téléphone et internet", "internet", 15, "mois"], ["STEG maison", 185, "STEG et SONEDE", "internet", 12, "2mois"],
      ["SONEDE maison", 64, "STEG et SONEDE", "cash", 20, "3mois"], ["Essence", 600, "Voiture et essence", "cash", 0, "mois"], ["Aide ménagère", 450, "Maison", "cash", 28, "mois"], ["Don mensuel", 50, "Dons (sadaqa)", "cash", 0, "mois"]];
    C.forEach(([quoi, montant, cat, mode, jour, freq]) => o.recurrentes.push({ id: id(), quoi, montant, cat, mode, jour, freq, depart: ym }));
    o.payes[o.recurrentes[0].id + "|" + ym] = true; o.payes[o.recurrentes[4].id + "|" + ym] = true;
    const jour = k => isoDe(new Date(n.getFullYear(), n.getMonth(), Math.max(1, Math.min(n.getDate(), k))));
    [["Internet fibre", 61, "Téléphone et internet", "internet", o.recurrentes[0].id], ["Essence", 600, "Voiture et essence", "cash", o.recurrentes[4].id], ["Courses", 214.6, "Courses", "cash"], ["Dentiste", 180, "Santé", "cash"], ["Fournitures scolaires", 96.5, "Enfants et école", "cash"]]
      .forEach(([quoi, montant, cat, mode, recId], i) => o.depenses.push({ id: id(), date: jour(2 + i * 3), quoi, montant, cat, mode, recId }));
    for (let k = 1; k <= 3; k++) o.depenses.push({ id: id(), date: ymPlus(ym, -k) + "-08", quoi: "Courses du mois", montant: 700, cat: "Courses", mode: "cash" });
    o.impot = { salaireBrut: 48000, chef: true, enfants: 2, retenu: 9500 };
    const ech = (q, d, m) => o.echeances.push({ id: id(), quoi: q, date: isoDe(new Date(n.getFullYear(), n.getMonth(), n.getDate() + d)), montant: m, paye: false, verif: true });
    ech("Déclaration mensuelle (exemple)", 6, 30); ech("Acompte provisionnel (exemple)", 64, 1200); ech("Vignette de la voiture (exemple)", 134, 130);
    o.projets.push({ id: id(), type: "oblig", nom: "Rentrée scolaire", cout: 2500, epargne: 300, fin: ymPlus(ym, 10) }, { id: id(), type: "oblig", nom: "Voyage Omra (2 personnes)", cout: 10100, epargne: 3000, fin: ymPlus(ym, 5) },
      { id: id(), type: "futur", nom: "Changer de voiture", cout: 45000, epargne: 8000, fin: ymPlus(ym, 14) }, { id: id(), type: "futur", nom: "Climatisation", cout: 3600, epargne: 500, fin: ymPlus(ym, 8) });
    o.compteurs.push({ id: id(), nom: "Appartement 1", ancien: 4120, actuel: 4450, avance: 50 }, { id: id(), nom: "Appartement 2", ancien: 2980, actuel: 3221, avance: 30 });
    o.facture = { montant: 140, methode: "locataires", total: 0 };
    return o;
  }

  // ---------------------------------------------------------------- démarrage
  function demarrer() { charger(); if (!D.vu) { D.vu = true; sauver(); } tout(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();
  window.MesComptes = { donnees: () => D, alarmes, calculImpot, fichierIcs, tousLesRappels, exemple, bareme, capacite, tout, lienGoogle };
})();
