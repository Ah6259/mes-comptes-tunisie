/* Mes comptes — tout se passe dans le navigateur : les chiffres restent dans le téléphone (localStorage), rien n'est envoyé.
   Alarmes : fichier agenda (.ics) ou lien Google Agenda → c'est le TÉLÉPHONE qui sonne, même site fermé. */
(function () {
  "use strict";
  /* UNE ADRESSE PAR LANGUE (21/11/2026, règle commune § 8 point 9) : la même application sert la page française (/) et la page
     arabe (/ar/). La langue est celle de la page (<html lang>) ; T(fr, ar) choisit le texte. Les données (localStorage
     « mes-comptes-v1 ») sont les mêmes dans les deux langues : on y garde des clés stables (catégories, types, états), jamais un texte
     traduit. Traductions arabes écrites par Claude : à faire relire par un arabophone. */
  const AR = document.documentElement.lang === "ar";
  const T = (fr, ar) => AR ? ar : fr;
  // nombre ou montant latin dans une phrase arabe : isolé de gauche à droite (U+2066 … U+2069), l'ordre des mots reste juste
  const iso = s => AR ? "\u2066" + s + "\u2069" : String(s);

  // ---------------------------------------------------------------- outils
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lireNb = s => { const v = parseFloat(String(s == null ? "" : s).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : 0; };
  const devise = s => AR ? iso(s) + " د.ت" : s + " DT";   // chiffres latins dans les deux langues (comme en Tunisie)
  const DT = n => devise((Math.round(n * 1000) / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
  const DT0 = n => devise(Math.round(n).toLocaleString("fr-FR"));
  const MOIS = T(["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]);
  const MOIS_C = T(["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"], MOIS);
  const p2 = n => String(n).padStart(2, "0");
  const maintenant = () => (window.MC_MAINTENANT ? new Date(window.MC_MAINTENANT) : new Date());
  const ymDe = d => d.getFullYear() + "-" + p2(d.getMonth() + 1);
  const isoDe = d => ymDe(d) + "-" + p2(d.getDate());
  const ymPlus = (ym, n) => { const [a, m] = ym.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return ymDe(d); };
  const ecartMois = (a, b) => { const [a1, m1] = a.split("-").map(Number), [a2, m2] = b.split("-").map(Number); return (a2 - a1) * 12 + (m2 - m1); };
  const nomMois = ym => { const [a, m] = ym.split("-").map(Number); return MOIS[m - 1] + " " + iso(a); };
  const dateDe = iso => { const [a, m, j] = iso.split("-").map(Number); return new Date(a, m - 1, j || 1); };
  const jourStr = d => AR ? iso(d.getDate()) + " " + MOIS[d.getMonth()] : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const jours = n => AR ? iso(n) + (n === 1 ? " يوم" : n === 2 ? " يومان" : n <= 10 ? " أيام" : " يومًا") : n + " jour" + (n > 1 ? "s" : "");
  const joursAvant = d => { const n = maintenant(); return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); };
  const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // catégories : la valeur gardée dans le téléphone reste le nom français (mêmes données dans les deux langues), le texte affiché suit la page
  const CATS = ["Maison", "Courses", "STEG et SONEDE", "Téléphone et internet", "Voiture et essence", "Enfants et école", "Santé", "Dons (sadaqa)", "Impôts et société", "Crédit", "Loisirs", "Autre"];
  const CATS_AR = { "Maison": "المنزل", "Courses": "المشتريات", "STEG et SONEDE": "الستاغ والصوناد", "Téléphone et internet": "الهاتف والإنترنت", "Voiture et essence": "السيارة والبنزين",
    "Enfants et école": "الأطفال والمدرسة", "Santé": "الصحة", "Dons (sadaqa)": "الصدقة", "Impôts et société": "الضرائب والشركة", "Crédit": "القرض", "Loisirs": "الترفيه", "Autre": "أخرى" };
  const catTxt = c => AR ? (CATS_AR[c] || c) : c;
  const TYPES = T({ loyer: "Loyer", salaire: "Salaire", autre: "Autre revenu" }, { loyer: "كراء", salaire: "أجرة", autre: "مدخول آخر" });
  const FREQ = { mois: [1, T("chaque mois", "كل شهر")], "2mois": [2, T("tous les 2 mois", "كل شهرين")], "3mois": [3, T("tous les 3 mois", "كل 3 أشهر")], "6mois": [6, T("tous les 6 mois", "كل 6 أشهر")], an: [12, T("chaque année", "كل سنة")] };
  const majuscule = s => s ? s[0].toUpperCase() + s.slice(1) : s;
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
    p.innerHTML = `<span>${esc(txt)}</span>` + (defaire ? `<button type="button" id="btnAnnuler">${T("Annuler", "تراجع")}</button>` : "");
    p.hidden = false;
    if (defaire) $("btnAnnuler").onclick = () => { defaire(); sauver(); p.hidden = true; tout(); };
    minuterie = setTimeout(() => { p.hidden = true; }, 6000);
  }
  function changer(fn, txt, defaire) { fn(); sauver(); tout(); if (txt) message(txt, defaire); }

  // ---------------------------------------------------------------- revenus : état de chaque mois
  // r = reçu, x = en retard, p = à appeler, a = attendu, g = gratuit (travaux), v = pas loué / rien ce mois
  const etat = (r, ym) => D.etats[r.id + "|" + ym] || (ym < (r.depuis || "0000-00") ? "v" : "a");
  const ETATS_LOYER = T([["r", "Reçu"], ["x", "En retard"], ["p", "À appeler"], ["a", "Attendu"], ["g", "Gratuit (travaux)"], ["v", "Pas loué"]],
    [["r", "وصل"], ["x", "متأخر"], ["p", "يجب الاتصال"], ["a", "منتظر"], ["g", "مجاني (أشغال)"], ["v", "غير مكرى"]]);
  const ETATS_AUTRE = T([["r", "Reçu"], ["x", "En retard"], ["a", "Attendu"], ["v", "Rien ce mois"]], [["r", "وصل"], ["x", "متأخر"], ["a", "منتظر"], ["v", "لا شيء هذا الشهر"]]);
  const modeTxt = r => r.mode === "cash" ? T("cash", "نقدًا") : T("virement", "تحويل");
  const modePaie = m => m === "cash" ? T("cash", "نقدًا") : T("par internet", "عبر الإنترنت");
  const aAppeler = r => { const ym = ymDe(maintenant()); return r.type === "loyer" && (etat(r, ym) === "p" || etat(r, ymPlus(ym, -1)) === "p"); };
  const titreRetard = r => r.type === "loyer" ? T("Loyer non payé", "كراء غير مدفوع") : r.type === "salaire" ? T("Salaire pas encore reçu", "الأجرة لم تصل بعد") : T("Revenu pas encore reçu", "مدخول لم يصل بعد");
  const leLoc = r => r.locataire || T("le locataire", "المتسوّغ");

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
    const q = new URLSearchParams({ action: "TEMPLATE", text: ev.titre, dates: gfmt(ev.debut) + "/" + gfmt(fin), details: ev.details + T("\n\nRappel créé par Mes comptes.", "\n\nتذكير أنشأه موقع حساباتي."), ctz: "Africa/Tunis" });
    if (ev.regle) q.set("recur", "RRULE:" + ev.regle);
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }
  const icsTxt = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const plier = l => { const o = []; let s = l; while (s.length > 73) { o.push(s.slice(0, 73)); s = " " + s.slice(73); } o.push(s); return o.join("\r\n"); };
  function fichierIcs(evs) {
    const st = gfmt(maintenant());
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mes comptes//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + T("Mes comptes", "حساباتي")];
    evs.forEach((ev, i) => {
      L.push("BEGIN:VEVENT", "UID:" + (ev.uid || "mc-" + i) + "-" + st + "@mes-comptes", "DTSTAMP:" + st, "DTSTART:" + gfmt(ev.debut), "DTEND:" + gfmt(new Date(ev.debut.getTime() + 15 * 60000)),
        "SUMMARY:" + icsTxt(ev.titre), "DESCRIPTION:" + icsTxt(ev.details + T("\n\nRappel créé par Mes comptes.", "\n\nتذكير أنشأه موقع حساباتي.")));
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
    } catch (e) { message(T("Le téléchargement n'a pas marché sur ce navigateur. Essayez avec Chrome ou Safari.", "لم ينجح التنزيل على هذا المتصفح. جرّب Chrome أو Safari."), null); return false; }
  }
  // un rappel par élément
  const telTxt = r => r.tel ? T(" Téléphone : ", " الهاتف: ") + iso(r.tel) : "";
  const evAppel = r => ({ uid: "appel-" + r.id, titre: T(`Appeler ${leLoc(r)} — ${r.nom}`, `الاتصال بـ${leLoc(r)} — ${r.nom}`), debut: (() => { const n = maintenant(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 18, 30); })(),
    details: T(`Loyer de ${DT0(r.montant)} pas encore reçu.${telTxt(r)} Supprimez ce rappel quand le loyer est reçu.`, `كراء بقيمة ${DT0(r.montant)} لم يصل بعد.${telTxt(r)} احذف هذا التذكير عند وصول الكراء.`), regle: "FREQ=DAILY;COUNT=30" });
  const evRevenu = r => { const n = maintenant(); let d = new Date(n.getFullYear(), n.getMonth(), Math.min(28, (r.jour || 1) + 1), 10, 0); if (d < n) d = new Date(n.getFullYear(), n.getMonth() + 1, Math.min(28, (r.jour || 1) + 1), 10, 0);
    return { uid: "rev-" + r.id, titre: T(`${TYPES[r.type]} reçu ? ${r.nom} (${DT0(r.montant)})`, `هل وصل ${TYPES[r.type]}؟ ${r.nom} (${DT0(r.montant)})`), debut: d,
      details: T(`Vérifier que « ${r.nom} » est arrivé (${modeTxt(r)}, avant le ${r.jour} de chaque mois).${telTxt(r)}`, `تأكّد من وصول «${r.nom}» (${modeTxt(r)}، قبل يوم ${iso(r.jour)} من كل شهر).${telTxt(r)}`), regle: "FREQ=MONTHLY" }; };
  const evRec = rc => { const pas = FREQ[rc.freq] ? FREQ[rc.freq][0] : 1;
    return { uid: "rec-" + rc.id, titre: T(`Payer : ${rc.quoi} (${DT0(rc.montant)}, ${modePaie(rc.mode)})`, `خلاص: ${rc.quoi} (${DT0(rc.montant)}، ${modePaie(rc.mode)})`), debut: prochaineDate(rc),
      details: T(`${rc.quoi} — ${FREQ[rc.freq] ? FREQ[rc.freq][1] : ""}, le ${rc.jour}.`, `${rc.quoi} — ${FREQ[rc.freq] ? FREQ[rc.freq][1] : ""}، يوم ${iso(rc.jour)}.`), regle: pas === 12 ? "FREQ=YEARLY" : pas === 1 ? "FREQ=MONTHLY" : "FREQ=MONTHLY;INTERVAL=" + pas }; };
  const evEch = e => { const d = dateDe(e.date); d.setHours(9, 0, 0, 0);
    return { uid: "ech-" + e.id, titre: T("Date limite : ", "آخر أجل: ") + e.quoi + (e.montant ? " (" + DT0(e.montant) + ")" : ""), debut: d,
      details: T(`Date limite le ${jourStr(d)} ${d.getFullYear()}.${e.verif ? " Date à vérifier auprès de l'administration fiscale." : ""}`,
        `آخر أجل يوم ${jourStr(d)} ${iso(d.getFullYear())}.${e.verif ? " تاريخ يجب التثبّت منه لدى إدارة الجباية." : ""}`), alarmes: ["P30D", "P15D", "P3D", "PT0M"] }; };
  function tousLesRappels() {
    const ym = ymDe(maintenant()), evs = [];
    D.revenus.forEach(r => { if (aAppeler(r)) evs.push(evAppel(r)); evs.push(evRevenu(r)); });
    D.recurrentes.filter(rc => rc.jour).forEach(rc => evs.push(evRec(rc)));
    D.echeances.filter(e => !e.paye && joursAvant(dateDe(e.date)) >= 0).forEach(e => evs.push(evEch(e)));
    return evs;
  }
  const btnAgenda = (cle, txt) => `<button type="button" class="mini" data-a="ics" data-cle="${esc(cle)}">${txt || T("Mettre sur mon téléphone", "ضعه في هاتفي")}</button>`;
  const lienG = ev => `<a class="mini" href="${esc(lienGoogle(ev))}" target="_blank" rel="noopener">${T("Google Agenda", "رزنامة Google")}</a>`;
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
        A.push({ niv: lheure ? 0 : 1, titre: lheure ? T(`C'est l'heure : appeler ${leLoc(r)}`, `حان الوقت: اتصل بـ${leLoc(r)}`) : T(`Ce soir à ${HEURE_APPEL} : appeler ${leLoc(r)}`, `هذا المساء على الساعة ${iso(HEURE_APPEL)}: اتصل بـ${leLoc(r)}`),
          txt: `${r.nom} · ${T("loyer", "كراء")} ${DT0(r.montant)}${r.tel ? " · " + iso(r.tel) : ""}`,
          action: (r.tel ? lienTel(r) : "") + btnAgenda("appel:" + r.id, T("Rappel chaque jour à 18:30", "تذكير كل يوم على الساعة \u206618:30\u2069")) + `<button type="button" class="mini" data-a="fin-appel" data-id="${r.id}">${T("C'est fait", "تمّ")}</button>` });
        return;
      }
      const e = etat(r, ym);
      if (e === "x" || (e === "a" && j > r.jour)) A.push({ niv: 0, titre: `${titreRetard(r)}${T(" : ", ": ")}${r.nom}`, txt: T(`${DT0(r.montant)} attendus avant le ${r.jour} ${MOIS[n.getMonth()]} (${modeTxt(r)})`, `${DT0(r.montant)} منتظرة قبل ${iso(r.jour)} ${MOIS[n.getMonth()]} (${modeTxt(r)})`),
        action: `<button type="button" class="mini vert" data-a="recu" data-id="${r.id}" data-ym="${ym}">${T("Reçu", "وصل")}</button>` + (r.type === "loyer" ? `<button type="button" class="mini" data-a="appeler" data-id="${r.id}">${T("À appeler", "يجب الاتصال")}</button>` : "") });
      const ep = etat(r, prec);
      if (r.depuis <= prec && ["a", "x", "p"].includes(ep)) A.push({ niv: 0, titre: `${titreRetard(r)} (${MOIS[+prec.slice(5) - 1]})${T(" : ", ": ")}${r.nom}`, txt: T(`${DT0(r.montant)} du mois dernier`, `${DT0(r.montant)} من الشهر الماضي`),
        action: `<button type="button" class="mini vert" data-a="recu" data-id="${r.id}" data-ym="${prec}">${T("Reçu", "وصل")}</button>` });
    });
    D.recurrentes.forEach(rc => { if (!rc.jour || !tombe(rc, ym) || paye(rc, ym)) return; const d = rc.jour - j;
      const act = `<button type="button" class="mini vert" data-a="payer" data-id="${rc.id}">${T("Payé", "خُلّص")}</button>`;
      if (d < 0) A.push({ niv: 0, titre: T("Facture non payée : ", "فاتورة غير مدفوعة: ") + rc.quoi, txt: T(`${DT0(rc.montant)}, à payer le ${rc.jour} ${MOIS[n.getMonth()]} (${modePaie(rc.mode)})`, `${DT0(rc.montant)}، تُدفع يوم ${iso(rc.jour)} ${MOIS[n.getMonth()]} (${modePaie(rc.mode)})`), action: act });
      else if (d <= 3) A.push({ niv: 1, titre: T(`À payer ${d === 0 ? "aujourd'hui" : "dans " + jours(d)} : ${rc.quoi}`, `للدفع ${d === 0 ? "اليوم" : "بعد " + jours(d)}: ${rc.quoi}`), txt: T(`${DT0(rc.montant)} le ${rc.jour} ${MOIS[n.getMonth()]}`, `${DT0(rc.montant)} يوم ${iso(rc.jour)} ${MOIS[n.getMonth()]}`), action: act }); });
    D.echeances.forEach(e => { if (e.paye) return; const d = joursAvant(dateDe(e.date));
      const txt = `${e.quoi}${T(", date limite le ", "، آخر أجل يوم ")}${jourStr(dateDe(e.date))}${e.montant ? " · " + DT0(e.montant) : ""}`, act = `<button type="button" class="mini vert" data-a="ech-paye" data-id="${e.id}">${T("Payé", "خُلّص")}</button>`;
      if (d < 0) A.push({ niv: 0, titre: T("Impôt en retard", "ضريبة متأخرة"), txt, action: act });
      else if (d <= 3) A.push({ niv: 0, titre: d === 0 ? T("Impôt : c'est aujourd'hui", "الضريبة: اليوم آخر أجل") : T(`Impôt : plus que ${jours(d)}`, `الضريبة: بقي ${jours(d)}`), txt, action: act });
      else if (d <= 15) A.push({ niv: 1, titre: T(`Impôt dans ${d} jours`, `الضريبة بعد ${jours(d)}`), txt, action: act });
      else if (d <= 31) A.push({ niv: 2, titre: T("Impôt dans un mois", "الضريبة بعد شهر"), txt, action: act }); });
    return A.sort((a, b) => a.niv - b.niv);
  }
  const lienTel = r => `<a class="mini vert" href="tel:${esc(String(r.tel).replace(/[^+\d]/g, ""))}">${T("Appeler", "اتصل")}</a>`;
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
    if (vide) h += T(`<div class="bloc bienvenue"><h2>Bienvenue dans Mes comptes</h2>
      <p style="margin:0">Vos revenus, vos dépenses, votre impôt et vos rappels, au même endroit. En 3 étapes :</p>
      <ol><li>Ajoutez vos <b>revenus</b> : loyers, salaire, autres.</li><li>Ajoutez les <b>dépenses qui reviennent</b> : STEG, SONEDE, téléphone, école…</li><li>Mettez les <b>alarmes sur votre téléphone</b> : il vous préviendra, même site fermé.</li></ol>
      <div class="boutons" style="justify-content:flex-start"><button type="button" class="btn btn-clair" data-a="aller" data-vue="revenus">Commencer</button><button type="button" class="btn" style="background:rgba(255,255,255,.16)" data-a="exemple">Voir avec un exemple</button></div>
      <p class="note">Vos chiffres restent dans votre téléphone : rien n'est envoyé, pas de compte à créer.</p></div>`,
      `<div class="bloc bienvenue"><h2>مرحبًا بك في حساباتي</h2>
      <p style="margin:0">مداخيلك ومصاريفك وضريبتك وتذكيراتك في مكان واحد. في ${iso(3)} خطوات:</p>
      <ol><li>أضف <b>مداخيلك</b>: الكراء، الأجرة، وغيرها.</li><li>أضف <b>المصاريف التي تتكرّر</b>: الستاغ، الصوناد، الهاتف، المدرسة…</li><li>ضع <b>المنبّهات في هاتفك</b>: سينبّهك حتى والموقع مغلق.</li></ol>
      <div class="boutons" style="justify-content:flex-start"><button type="button" class="btn btn-clair" data-a="aller" data-vue="revenus">ابدأ</button><button type="button" class="btn" style="background:rgba(255,255,255,.16)" data-a="exemple">شاهد مثالًا</button></div>
      <p class="note">أرقامك تبقى في هاتفك: لا يُرسَل أي شيء، ولا حاجة إلى إنشاء حساب.</p></div>`);
    if (D.exemple) h += T(`<div class="exemple"><span><b>Exemple chargé</b> : les noms et montants sont inventés.</span><button type="button" class="mini" data-a="effacer-exemple">Effacer l'exemple et commencer</button></div>`,
      `<div class="exemple"><span><b>تمّ تحميل المثال</b>: الأسماء والمبالغ خيالية.</span><button type="button" class="mini" data-a="effacer-exemple">امسح المثال وابدأ</button></div>`);
    h += `<div class="essai"><b>${reste > 0 ? T("Gratuit pendant 3 mois", "مجاني لمدة 3 أشهر") : T("Période gratuite terminée", "انتهت الفترة المجانية")}</b><span>${reste > 0 ? T(`Il vous reste <b class="num">${jours(reste)}</b>. Ensuite : un abonnement payant, prix affiché avant tout paiement. Rien n'est prélevé automatiquement.`, `بقي لك <b class="num">${jours(reste)}</b>. بعد ذلك: اشتراك بمقابل، والسعر يُعرض قبل أي دفع. لا يُقتطع أي مبلغ آليًا.`) : T("L'abonnement arrive bientôt : vous pouvez continuer à utiliser le site en attendant.", "الاشتراك قريبًا: يمكنك مواصلة استعمال الموقع في الأثناء.")}</span></div>`;
    h += `<div class="grille">
      <div class="bloc"><div class="bloc-tete"><h2>${T("Alarmes", "المنبّهات")}</h2><span class="petit doux">${jourStr(n)} ${iso(n.getFullYear())}</span></div>
        <ul class="alarmes">${A.length ? A.map(a => `<li class="alarme ${["a-rouge", "a-orange", "a-jaune"][a.niv]}">${CLOCHE}<div><b>${esc(a.titre)}</b><div class="petit">${esc(a.txt)}</div>${a.action ? `<div class="actions">${a.action}</div>` : ""}</div></li>`).join("") : `<li class="vide">${T("Aucune alarme aujourd'hui. Tout est à jour.", "لا منبّه اليوم. كل شيء محيّن.")}</li>`}</ul>
        <div class="telephone"><b>${T("Les alarmes sonnent sur votre téléphone", "المنبّهات ترنّ في هاتفك")}</b><span class="petit">${T("Un seul bouton met tous vos rappels dans l'agenda du téléphone (loyers, factures, impôt, « À appeler » à 18:30). Le téléphone sonne même si le site est fermé.", `زرّ واحد يضع كل تذكيراتك في رزنامة الهاتف (الكراء، الفواتير، الضريبة، «يجب الاتصال» على الساعة ${iso("18:30")}). الهاتف يرنّ حتى والموقع مغلق.`)}</span>
          <button type="button" class="btn large" data-a="ics-tout">${T("Mettre toutes mes alarmes sur mon téléphone", "ضع كل منبّهاتي في هاتفي")}</button></div></div>
      <div class="bloc"><div class="bloc-tete"><h2>${T("À faire", "للقيام به")}</h2><span class="etiq">${MOIS[n.getMonth()]}</span></div>
        <div class="sous" role="tablist" aria-label="${T("Type", "النوع")}">
          <button type="button" role="tab" data-a="sous" data-s="cash" aria-selected="${UI.sous === "cash"}">${T("Cash", "نقدًا")} <span class="n">${recs("cash").length}</span></button>
          <button type="button" role="tab" data-a="sous" data-s="internet" aria-selected="${UI.sous === "internet"}">${T("Par internet", "عبر الإنترنت")} <span class="n">${recs("internet").length}</span></button>
          <button type="button" role="tab" data-a="sous" data-s="revenus" aria-selected="${UI.sous === "revenus"}">${T("Revenus", "المداخيل")} <span class="n">${revs.length}</span></button>
        </div><ul class="taches">${UI.sous === "revenus" ? listeRevenus(revs, ym, j) : listeRecs(recs(UI.sous), j)}</ul></div></div>`;
    const nDep = depensesDuMois(ym).length;
    h += `<div class="bloc"><h2>${T("Ce mois-ci", "هذا الشهر")}</h2><div class="chiffres">
      <div class="chiffre plus"><span class="etiq">${T("Reçu", "وصل")}</span><span class="num">${DT0(recu)}</span><span class="petit doux">${T(`sur ${DT0(attendu)} attendus`, `من ${DT0(attendu)} منتظرة`)}</span></div>
      <div class="chiffre moins"><span class="etiq">${T("Dépensé", "المصروف")}</span><span class="num">${DT0(dep)}</span><span class="petit doux">${T(`${nDep} dépense(s)`, `عدد المصاريف: ${iso(nDep)}`)}</span></div>
      <div class="chiffre cote"><span class="etiq">${T("Impôt à mettre de côté", "ضريبة للادّخار")}</span><span class="num">${DT0(imp)}</span><span class="petit doux">${T("par mois (estimation)", "في الشهر (تقدير)")}</span></div>
      <div class="chiffre"><span class="etiq">${T("Reste", "الباقي")}</span><span class="num">${DT0(recu - dep - imp)}</span><span class="petit doux">${T("reçu − dépensé − impôt", "الواصل − المصروف − الضريبة")}</span></div></div></div>`;
    $("vue-accueil").innerHTML = h;
    const nr = A.filter(a => a.niv === 0).length, c = $("nbAlarmes"); c.hidden = !nr; c.textContent = nr;
    $("puceEssai").textContent = reste > 0 ? T(`Gratuit : ${reste} j`, `مجاني: ${reste} يوم`) : T("Gratuit 3 mois", "مجاني 3 أشهر");
  }
  function listeRecs(l, j) {
    if (!l.length) return `<li class="vide">${T(`Rien à payer ${UI.sous === "cash" ? "en cash" : "par internet"} ce mois-ci.`, `لا شيء للدفع ${UI.sous === "cash" ? "نقدًا" : "عبر الإنترنت"} هذا الشهر.`)}</li>`;
    const le = k => T("Le " + k, "يوم " + iso(k));
    return l.map(rc => { const d = rc.jour ? rc.jour - j : null;
      const p = d === null ? ["p-info", T("Ce mois", "هذا الشهر")] : d < 0 ? ["p-retard", T("En retard", "متأخر")] : d <= 3 ? ["p-bientot", d === 0 ? T("Aujourd'hui", "اليوم") : le(rc.jour)] : ["p-info", le(rc.jour)];
      return `<li class="tache"><span class="pastille ${p[0]}">${p[1]}</span><span>${esc(rc.quoi)}<br><span class="petit doux">${esc(FREQ[rc.freq] ? FREQ[rc.freq][1] : "")}</span></span><span class="num">${DT0(rc.montant)}</span>
        <span class="actions"><button type="button" class="mini vert" data-a="payer" data-id="${rc.id}">${T("Payé", "خُلّص")}</button></span></li>`; }).join("");
  }
  function listeRevenus(l, ym, j) {
    if (!l.length) return `<li class="vide">${D.revenus.length ? T("Tous les revenus du mois sont reçus.", "وصلت كل مداخيل الشهر.") : T("Ajoutez vos revenus dans l'onglet Revenus.", "أضف مداخيلك في قسم «المداخيل».")}</li>`;
    return l.map(r => { const e = etat(r, ym), retard = e !== "a" || j > r.jour;
      return `<li class="tache"><span class="pastille ${retard ? "p-retard" : "p-bientot"}">${e === "p" ? T("À appeler", "يجب الاتصال") : retard ? T("En retard", "متأخر") : T("Avant le " + r.jour, "قبل يوم " + iso(r.jour))}</span><span><b>${esc(r.nom)}</b><span class="type-rev">${TYPES[r.type]}</span><br><span class="petit doux">${modeTxt(r)}${r.locataire ? " · " + esc(r.locataire) : ""}${r.tel ? ` · <span class="tel" dir="ltr">${esc(r.tel)}</span>` : ""}</span></span><span class="num">${DT0(r.montant)}</span>
        <span class="actions">${r.type === "loyer" && r.tel ? lienTel(r) : ""}${r.type === "loyer" ? `<button type="button" class="mini ${e === "p" ? "on" : ""}" data-a="appeler" data-id="${r.id}">${e === "p" ? T("À appeler ✓", "يجب الاتصال ✓") : T("À appeler", "يجب الاتصال")}</button>` : ""}<button type="button" class="mini vert" data-a="recu" data-id="${r.id}" data-ym="${ym}">${T("Reçu", "وصل")}</button></span></li>`; }).join("");
  }

  function vueRevenus() {
    const m0 = UI.moisVu, an = m0.slice(0, 4);
    const cols = UI.periode === "an" ? Array.from({ length: 12 }, (_, i) => an + "-" + p2(i + 1)) : UI.periode === "1" ? [m0] : [ymPlus(m0, -1), m0, ymPlus(m0, 1)];
    // flèches du mois : « ‹ » = mois précédent ; en arabe (de droite à gauche) le mois précédent est à droite, donc « › »
    let h = `<div class="bloc"><div class="bloc-tete"><h2>${T("Revenus", "المداخيل")}</h2>
      <div class="nav-mois"><button type="button" data-a="mois" data-d="-1" aria-label="${T("Mois précédent", "الشهر السابق")}">${T("‹", "›")}</button><b>${nomMois(m0)}</b><button type="button" data-a="mois" data-d="1" aria-label="${T("Mois suivant", "الشهر الموالي")}">${T("›", "‹")}</button></div></div>
      <details class="ajout"${D.revenus.length ? "" : " open"}><summary>${T("+ Ajouter un revenu", "+ إضافة مدخول")}</summary>${formRevenu(null)}</details>
      <div class="sous" role="tablist" aria-label="${T("Période", "الفترة")}">${[["an", T("Année", "السنة")], ["3", T("3 mois", "3 أشهر")], ["1", T("Mois", "الشهر")]].map(([k, l]) => `<button type="button" role="tab" data-a="periode" data-p="${k}" aria-selected="${UI.periode === k}">${l}</button>`).join("")}</div>`;
    if (!D.revenus.length) h += `<p class="vide">${T("Aucun revenu pour l'instant. Ajoutez votre premier loyer, salaire ou autre revenu avec le bouton ci-dessus.", "لا مداخيل إلى الآن. أضف أوّل كراء أو أجرة أو مدخول آخر بالزرّ أعلاه.")}</p>`;
    else {
      h += `<div class="defile"><table><thead><tr><th>${T("Revenu", "المدخول")}</th>${cols.map(c => `<th class="${c === m0 ? "courant" : ""}">${UI.periode === "an" ? MOIS_C[+c.slice(5) - 1] : nomMois(c)}</th>`).join("")}<th></th></tr></thead><tbody>`;
      for (const [ty, titre] of [["loyer", T("Loyers", "الكراء")], ["salaire", T("Salaires", "الأجور")], ["autre", T("Autres revenus", "مداخيل أخرى")]]) {
        const liste = D.revenus.filter(r => r.type === ty); if (!liste.length) continue;
        const ouvert = !D.replie.includes(ty), recus = liste.filter(r => etat(r, m0) === "r").length, total = liste.reduce((s, r) => s + r.montant, 0);
        h += `<tr class="groupe"><td colspan="${cols.length + 2}"><button type="button" data-a="replier" data-t="${ty}" aria-expanded="${ouvert}"><span class="fleche" aria-hidden="true">▾</span>${titre} <span class="resume">${T(`${liste.length} · ${DT0(total)} par mois · ${recus}/${liste.length} reçu${recus > 1 ? "s" : ""} en ${MOIS[+m0.slice(5) - 1]}`, `${iso(liste.length)} · ${DT0(total)} في الشهر · وصل ${iso(recus + "/" + liste.length)} في ${MOIS[+m0.slice(5) - 1]}`)}</span></button></td></tr>`;
        if (!ouvert) continue;
        liste.forEach(r => {
          if (UI.modifRevenu === r.id) { h += `<tr><td colspan="${cols.length + 2}">${formRevenu(r)}</td></tr>`; return; }
          h += `<tr><td><div class="rev"><span><b>${esc(r.nom)}</b><span class="type-rev">${TYPES[r.type]}</span></span><span class="num petit">${T(`${DT0(r.montant)}/mois · avant le ${r.jour}`, `${DT0(r.montant)} في الشهر · قبل يوم ${iso(r.jour)}`)}</span>
            <label class="petit" style="display:flex;gap:6px;align-items:center">${T("Reçu en", "يصل")} <select class="mode-rev" data-a="mode" data-id="${r.id}"><option value="cash"${r.mode === "cash" ? " selected" : ""}>${T("Cash", "نقدًا")}</option><option value="virement"${r.mode !== "cash" ? " selected" : ""}>${T("Virement", "تحويل")}</option></select></label>
            ${r.locataire ? `<span class="petit doux">${esc(r.locataire)}</span>` : ""}
            ${r.type === "loyer" ? `<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input class="num tel-in" inputmode="tel" data-a="tel" data-id="${r.id}" value="${esc(r.tel || "")}" dir="ltr" placeholder="${T("Téléphone", "الهاتف")}" aria-label="${T("Téléphone du locataire de ", "هاتف متسوّغ ")}${esc(r.nom)}">${r.tel ? lienTel(r) : ""}</span>` : ""}
            <span><button type="button" class="mini" data-a="modif-rev" data-id="${r.id}">${T("Modifier", "تعديل")}</button></span></div></td>`;
          cols.forEach(c => { const e = etat(r, c);
            h += `<td><select class="etat c-${e}" data-a="etat" data-id="${r.id}" data-ym="${c}" aria-label="${esc(r.nom)}, ${nomMois(c)}">${(r.type === "loyer" ? ETATS_LOYER : ETATS_AUTRE).map(([k, l]) => `<option value="${k}"${k === e ? " selected" : ""}>${l}</option>`).join("")}</select></td>`; });
          h += `<td><button type="button" class="suppr" data-a="suppr-rev" data-id="${r.id}" aria-label="${T("Supprimer ", "حذف ")}${esc(r.nom)}">×</button></td></tr>`;
        });
      }
      h += `</tbody></table></div><p class="note">${T("« À appeler » : alarme chaque jour à 18:30 jusqu'à ce que le loyer soit reçu. Mettez-la sur votre téléphone depuis l'accueil.", `«يجب الاتصال»: منبّه كل يوم على الساعة ${iso("18:30")} إلى أن يصل الكراء. ضعه في هاتفك من الصفحة الرئيسية.`)}</p>`;
    }
    $("vue-revenus").innerHTML = h + `</div>`;
  }
  function formRevenu(r) {
    const v = r || { type: "loyer", nom: "", montant: "", mode: "cash", jour: 5, locataire: "", tel: "" };
    return `<form class="form" data-f="revenu" data-id="${r ? r.id : ""}">
      <label>${T("Type", "النوع")}<select name="type" data-a="type-rev">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}"${v.type === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>${T("Nom", "الاسم")}<input name="nom" required value="${esc(v.nom)}" placeholder="${v.type === "loyer" ? T("Ex. : Appartement 2", "مثال: الشقة 2") : v.type === "salaire" ? T("Ex. : Salaire", "مثال: الأجرة") : T("Ex. : pension, prime…", "مثال: جراية، منحة…")}"></label>
      <label>${T("Montant par mois (DT)", "المبلغ في الشهر (د.ت)")}<input name="montant" class="num" inputmode="decimal" required value="${esc(v.montant)}" placeholder="850"></label>
      <label>${T("Reçu en", "يصل")}<select name="mode"><option value="cash"${v.mode === "cash" ? " selected" : ""}>${T("Cash", "نقدًا")}</option><option value="virement"${v.mode !== "cash" ? " selected" : ""}>${T("Virement", "تحويل")}</option></select></label>
      <label>${T("Reçu avant le", "يصل قبل يوم")}<select name="jour">${[1, 3, 5, 10, 15, 20, 25, 28].map(j => `<option value="${j}"${+v.jour === j ? " selected" : ""}>${T((j === 1 ? "1er" : j) + " du mois", iso(j) + " من الشهر")}</option>`).join("")}</select></label>
      <label>${v.type === "loyer" ? T("Locataire", "المتسوّغ") : T("Qui paie ?", "من يدفع؟")}<input name="locataire" value="${esc(v.locataire)}" placeholder="${v.type === "loyer" ? T("Nom du locataire", "اسم المتسوّغ") : T("Ex. : employeur", "مثال: المؤجّر")}"></label>
      <label${v.type === "loyer" ? "" : " hidden"} data-seul="loyer">${T("Téléphone", "الهاتف")}<input name="tel" class="num" inputmode="tel" dir="ltr" value="${esc(v.tel)}" placeholder="${T("8 chiffres", "8 أرقام")}"></label>
      <div class="boutons">${r ? `<button type="button" class="mini" data-a="annuler-rev">${T("Annuler", "إلغاء")}</button>` : ""}<button class="btn" type="submit">${r ? T("Enregistrer", "حفظ") : T("Ajouter le revenu", "أضف المدخول")}</button></div></form>`;
  }

  function vueDepenses() {
    const ym = ymDe(maintenant()), liste = depensesDuMois(ym).slice().reverse(), total = liste.reduce((s, d) => s + d.montant, 0);
    let h = `<div class="grille"><div class="bloc"><h2>${T("Ajouter une dépense", "إضافة مصروف")}</h2>
      <form class="form" data-f="depense">
        <label>${T("Quoi", "ماذا")}<input name="quoi" required placeholder="${T("Ex. : courses, STEG, école…", "مثال: القضية، الستاغ، المدرسة…")}"></label>
        <label>${T("Montant (DT)", "المبلغ (د.ت)")}<input name="montant" class="num" inputmode="decimal" required placeholder="0,000"></label>
        <label>${T("Catégorie", "الصنف")}<select name="cat">${CATS.map(c => `<option value="${esc(c)}">${esc(catTxt(c))}</option>`).join("")}</select></label>
        <label>${T("Combien de fois ?", "كم مرّة؟")}<select name="freq"><option value="1">${T("Une seule fois", "مرّة واحدة")}</option>${Object.entries(FREQ).map(([k, v]) => `<option value="${k}">${majuscule(v[1])}</option>`).join("")}</select></label>
        <label>${T("Payé comment ?", "طريقة الدفع؟")}<select name="mode"><option value="cash">${T("Cash", "نقدًا")}</option><option value="internet">${T("Par internet", "عبر الإنترنت")}</option></select></label>
        <label>${T("Jour du rappel", "يوم التذكير")}<input name="jour" class="num" inputmode="numeric" placeholder="${T("Ex. : 15", "مثال: 15")}"></label>
        <button class="btn" type="submit">${T("Ajouter", "أضف")}</button></form>
      <div><div class="bloc-tete"><h3>${majuscule(MOIS[maintenant().getMonth()])}${T(" : ", ": ")}${DT0(total)}</h3><span class="petit doux">${T(`${liste.length} dépense(s)`, `عدد المصاريف: ${iso(liste.length)}`)}</span></div>
      ${liste.length ? liste.map(d => `<div class="ligne"><span>${esc(d.quoi)}${d.recId ? `<span class="tag rec">${T("revient", "تتكرّر")}</span>` : ""}</span><span class="num">${DT(d.montant)}</span><button type="button" class="suppr" data-a="suppr-dep" data-id="${d.id}" aria-label="${T("Supprimer ", "حذف ")}${esc(d.quoi)}">×</button><span class="sous-texte">${esc(catTxt(d.cat))} · ${modePaie(d.mode === "internet" ? "internet" : "cash")} · ${jourStr(dateDe(d.date))}</span></div>`).join("")
        : `<p class="vide">${T("Aucune dépense ce mois-ci.", "لا مصاريف هذا الشهر.")}</p>`}</div></div>
      <div class="bloc"><div class="bloc-tete"><h2>${T("Dépenses qui reviennent", "المصاريف المتكرّرة")}</h2><span class="petit doux">${T("rappelées dans « À faire »", "تُذكَّر في «للقيام به»")}</span></div>
      ${D.recurrentes.length ? D.recurrentes.map(rc => `<div class="ligne"><span><b>${esc(rc.quoi)}</b><span class="tag">${rc.mode === "cash" ? T("cash", "نقدًا") : T("internet", "إنترنت")}</span></span><span class="num">${DT0(rc.montant)}</span><button type="button" class="suppr" data-a="suppr-rec" data-id="${rc.id}" aria-label="${T("Arrêter ", "إيقاف ")}${esc(rc.quoi)}">×</button><span class="sous-texte">${esc(FREQ[rc.freq] ? FREQ[rc.freq][1] : "")}${rc.jour ? T(", le " + rc.jour, "، يوم " + iso(rc.jour)) : ""} · ${esc(catTxt(rc.cat))}</span></div>`).join("")
        : `<p class="vide">${T("Aucune. Choisissez « Chaque mois » (ou autre) en ajoutant une dépense : STEG, SONEDE, téléphone, école…", "لا شيء. اختر «كل شهر» (أو غيره) عند إضافة مصروف: الستاغ، الصوناد، الهاتف، المدرسة…")}</p>`}</div></div>`;
    $("vue-depenses").innerHTML = h;
  }

  function vueImpot() {
    const I = D.impot, n = maintenant(), c = calculImpot();
    const L = D.echeances.filter(e => { if (UI.filtreEch === "tout") return true; const d = joursAvant(dateDe(e.date)); if (d < 0) return !e.paye;
      if (UI.filtreEch === "0") return e.date.slice(0, 7) === ymDe(n); return dateDe(e.date) <= new Date(n.getFullYear(), n.getMonth() + +UI.filtreEch, n.getDate()); }).sort((a, b) => a.date < b.date ? -1 : 1);
    let h = `<div class="grille"><div class="bloc"><h2>${T("Dates limites et rappels", "الآجال والتذكيرات")}</h2>
      <div class="sous" role="tablist" aria-label="${T("Période", "الفترة")}">${[["0", T("Ce mois", "هذا الشهر")], ["3", T("3 mois", "3 أشهر")], ["6", T("6 mois", "6 أشهر")], ["12", T("1 an", "سنة")], ["tout", T("Tout", "الكل")]].map(([k, l]) => `<button type="button" role="tab" data-a="filtre-ech" data-f="${k}" aria-selected="${UI.filtreEch === k}">${l}</button>`).join("")}</div>
      <ul class="taches">${L.length ? L.map(e => { const d = joursAvant(dateDe(e.date));
        const jm = "J−" + d, p = e.paye ? ["p-ok", T("Payé", "خُلّص")] : d < 0 ? ["p-retard", T("En retard", "متأخر")] : d <= 3 ? ["p-retard", T(jm, "بقي " + jours(d))] : d <= 15 ? ["p-bientot", T(jm, "بقي " + jours(d))] : d <= 31 ? ["p-verif", T(jm, "بقي " + jours(d))] : ["p-info", T("dans " + d + " j", "بعد " + jours(d))];
        return `<li class="tache"><span class="pastille ${p[0]}">${p[1]}</span><span><b>${esc(e.quoi)}</b><br><span class="petit doux">${jourStr(dateDe(e.date))} ${iso(e.date.slice(0, 4))} · ${T("rappels 1 mois, 15 jours et 3 jours avant", "تذكير قبل شهر و15 يومًا و3 أيام")}</span></span><span class="num">${e.montant ? DT0(e.montant) : "—"}</span>
          <span class="actions">${e.verif ? `<span class="pastille p-verif">${T("date à vérifier", "تاريخ يجب التثبّت منه")}</span>` : ""}${e.paye ? "" : btnAgenda("ech:" + e.id) + lienG(evEch(e)) + `<button type="button" class="mini vert" data-a="ech-paye" data-id="${e.id}">${T("Payé", "خُلّص")}</button>`}<button type="button" class="suppr" data-a="suppr-ech" data-id="${e.id}" aria-label="${T("Supprimer", "حذف")}">×</button></span></li>`; }).join("")
        : `<li class="vide">${T("Aucune date limite pour cette période.", "لا آجال في هذه الفترة.")}</li>`}</ul>
      <details class="ajout"><summary>${T("+ Ajouter une date limite", "+ إضافة أجل")}</summary><form class="form" data-f="echeance">
        <label>${T("Quoi", "ماذا")}<input name="quoi" required placeholder="${T("Ex. : acompte provisionnel", "مثال: قسط احتياطي")}"></label>
        <label>${T("Date limite", "آخر أجل")}<input name="date" type="date" required></label>
        <label>${T("Montant (DT)", "المبلغ (د.ت)")}<input name="montant" class="num" inputmode="decimal" placeholder="0"></label>
        <button class="btn" type="submit">${T("Ajouter", "أضف")}</button></form></details>
      ${D.echeances.length ? "" : `<button type="button" class="mini" data-a="ech-habituelles">${T("Ajouter les dates habituelles (à vérifier)", "أضف الآجال المعتادة (للتثبّت)")}</button>`}
      <p class="note">${T("Dates indicatives : vérifiez-les auprès de l'administration fiscale ou de votre comptable. Les rappels arrivent sur votre téléphone 1 mois, 15 jours et 3 jours avant.", "آجال تقريبية: تثبّت منها لدى إدارة الجباية أو لدى محاسبك. تصلك التذكيرات على هاتفك قبل شهر و15 يومًا و3 أيام.")}</p></div>
      <div class="bloc"><h2>${T("Calcul de l'impôt sur le revenu", "حساب الضريبة على الدخل")}</h2>
      <form class="form" data-f="impot">
        <label>${T("Salaire brut de l'année (DT)", "الأجر الخام للسنة (د.ت)")}<input name="salaireBrut" class="num" inputmode="decimal" value="${esc(I.salaireBrut || "")}" placeholder="${T("Sur votre fiche de paie", "في بطاقة الخلاص")}"></label>
        <label>${T("Chef de famille", "رئيس عائلة")}<select name="chef"><option value="1"${I.chef ? " selected" : ""}>${T("Oui", "نعم")}</option><option value="0"${I.chef ? "" : " selected"}>${T("Non", "لا")}</option></select></label>
        <label>${T("Enfants à charge", "الأطفال في الكفالة")}<select name="enfants">${[0, 1, 2, 3, 4].map(k => `<option${+I.enfants === k ? " selected" : ""}>${k}</option>`).join("")}</select></label>
        <label>${T("Déjà retenu sur le salaire (DT)", "المقتطع مسبقًا من الأجر (د.ت)")}<input name="retenu" class="num" inputmode="decimal" value="${esc(I.retenu || "")}" placeholder="0"></label></form>
      <div class="calcul" id="calculImpot">${detailImpot(c)}</div>
      <p class="note">${T("Les loyers et autres revenus viennent de l'onglet Revenus (12 mois). Tous comptent pour l'impôt, qu'ils soient reçus en cash ou par virement. Barème 2026 par tranches ; abattement de 30 % sur les loyers : à vérifier. Calcul indicatif.", `الكراء والمداخيل الأخرى تأتي من قسم «المداخيل» (${iso(12)} شهرًا). كلّها تُحتسب في الضريبة، سواء وصلت نقدًا أو بالتحويل. جدول ${iso(2026)} حسب الشرائح؛ طرح ${iso("30 %")} من الكراء: يجب التثبّت منه. حساب تقريبي.`)}</p></div></div>`;
    $("vue-impot").innerHTML = h;
  }
  function detailImpot(c) {
    return [[T("Salaire brut", "الأجر الخام"), DT(c.sal)], [T("Cotisation CNSS (9,68 %)", `مساهمة الضمان الاجتماعي (${iso("9,68 %")})`), "− " + DT(c.cnss)], [T("Frais professionnels (10 %, 2 000 DT max.)", `مصاريف مهنية (${iso("10 %")}، ${iso("2 000")} د.ت على الأكثر)`), "− " + DT(c.frais)],
      [T(`Loyers de l'année : ${DT0(c.loyersAn)} (dont cash ${DT0(c.loyCash)}, virement ${DT0(c.loyVir)})`, `كراء السنة: ${DT0(c.loyersAn)} (منها نقدًا ${DT0(c.loyCash)}، وبالتحويل ${DT0(c.loyVir)})`), ""], [T("Loyers après abattement de 30 % (à vérifier)", `الكراء بعد طرح ${iso("30 %")} (للتثبّت)`), "+ " + DT(c.foncier)],
      [T("Autres revenus de l'année (à vérifier)", "مداخيل أخرى للسنة (للتثبّت)"), "+ " + DT(c.autresAn)], [T("Chef de famille et enfants", "رئيس العائلة والأطفال"), "− " + DT(c.ded)], [T("Revenu imposable", "الدخل الخاضع للضريبة"), DT(c.imposable)],
      [T("Impôt selon le barème", "الضريبة حسب الجدول"), DT(c.irpp)], [T("Contribution sociale (0,5 %)", `المساهمة الاجتماعية (${iso("0,5 %")})`), DT(c.css)], [T("Déjà retenu sur le salaire", "المقتطع مسبقًا من الأجر"), "− " + DT(c.retenu)]]
      .map(([a, b]) => `<div><span>${a}</span><span class="num">${b}</span></div>`).join("") +
      `<div class="total"><span>${c.reste >= 0 ? T("Reste à payer", "الباقي للدفع") : T("Trop payé (à récupérer)", "مدفوع زيادة (يُسترجع)")}</span><span class="num">${DT(Math.abs(c.reste))}</span></div>
       <div class="total"><span>${T("À mettre de côté chaque mois", "للادّخار كل شهر")}</span><span class="num">${DT(c.parMois)}</span></div>`;
  }

  function vueProjets() {
    const moy = capacite(), ym = ymDe(maintenant());
    const OB = D.projets.filter(p => p.type === "oblig"), FU = D.projets.filter(p => p.type !== "oblig");
    let reserve = 0;
    const carte = (p, corps) => {
      if (UI.modifProjet === p.id) return `<article class="projet"><h3>${T(`Modifier « ${esc(p.nom)} »`, `تعديل «${esc(p.nom)}»`)}</h3>${formProjet(p)}</article>`;
      const pct = p.cout ? Math.min(100, p.epargne / p.cout * 100) : 0;
      return `<article class="projet"><h3>${esc(p.nom)}</h3><div class="barre" role="img" aria-label="${T("Épargné : ", "المدّخر: ")}${Math.round(pct)} %"><i style="width:${pct}%"></i></div>
        <div class="lignes"><div><span>${T("Coût", "الكلفة")}</span><span class="num">${DT0(p.cout)}</span></div><div><span>${T("Déjà épargné", "المدّخر حاليًا")}</span><span class="num">${DT0(p.epargne)}</span></div><div><span>${T("Pour", "الموعد")}</span><span>${nomMois(p.fin)}</span></div></div>${corps}
        <div class="boutons"><button type="button" class="mini" data-a="modif-projet" data-id="${p.id}">${T("Modifier", "تعديل")}</button><button type="button" class="mini rouge" data-a="suppr-projet" data-id="${p.id}">${T("Supprimer", "حذف")}</button></div></article>`; };
    const hOb = OB.map(p => { const manque = Math.max(p.cout - p.epargne, 0), dispo = Math.max(ecartMois(ym, p.fin), 1), faut = manque / dispo; reserve += faut;
      return carte(p, manque === 0 ? `<div class="verdict v-ok">${T("Prêt : la somme est déjà épargnée.", "جاهز: المبلغ مدّخر.")}</div>` : `<div class="verdict ${faut <= moy ? "v-ok" : "v-non"}">${T(`Mettez de côté <b class="num">${DT0(faut)}</b> par mois pendant ${dispo} mois pour être prêt en ${nomMois(p.fin)}.`, `ادّخر <b class="num">${DT0(faut)}</b> كل شهر لمدّة ${iso(dispo)} شهرًا لتكون جاهزًا في ${nomMois(p.fin)}.`)}</div>`); }).join("");
    const libre = moy - reserve, peut = Math.max(libre, 0);
    const tot = {}; [1, 2, 3].forEach(k => depensesDuMois(ymPlus(ym, -k + 1)).forEach(d => tot[d.cat] = (tot[d.cat] || 0) + d.montant / 3));
    const [gCat, gVal] = Object.entries(tot).sort((a, b) => b[1] - a[1])[0] || ["", 0];
    const finOb = OB.map(p => ({ p, n: Math.max(ecartMois(ym, p.fin), 1), f: Math.max(p.cout - p.epargne, 0) / Math.max(ecartMois(ym, p.fin), 1) })).sort((a, b) => a.n - b.n)[0];
    const hFu = FU.map(p => { const manque = Math.max(p.cout - p.epargne, 0), dispo = Math.max(ecartMois(ym, p.fin), 1), faut = manque / dispo;
      if (manque === 0) return carte(p, `<div class="verdict v-ok">${T("Déjà possible : la somme est épargnée.", "ممكن الآن: المبلغ مدّخر.")}</div>`);
      if (faut <= peut) return carte(p, `<div class="verdict v-ok">${T(`Faisable : en mettant <b class="num">${DT0(faut)}</b> par mois, prêt en ${nomMois(p.fin)}. Il vous resterait ${DT0(peut - faut)} par mois.`, `ممكن: بادّخار <b class="num">${DT0(faut)}</b> كل شهر، تكون جاهزًا في ${nomMois(p.fin)}. ويبقى لك ${DT0(peut - faut)} في الشهر.`)}</div>`);
      const cs = [];
      if (peut > 0) { const k = Math.ceil(manque / peut); cs.push(T(`Repoussez à <b>${nomMois(ymPlus(ym, k))}</b> : avec ce qui vous reste (${DT0(peut)} par mois), vous y arrivez en ${k} mois.`, `أجّله إلى <b>${nomMois(ymPlus(ym, k))}</b>: بما يبقى لك (${DT0(peut)} في الشهر)، تصل إليه في ${iso(k)} شهرًا.`)); }
      cs.push(T(`Ou trouvez <b class="num">${DT0(faut - peut)}</b> de plus par mois pour garder ${nomMois(p.fin)}.`, `أو وفّر <b class="num">${DT0(faut - peut)}</b> إضافية كل شهر للمحافظة على موعد ${nomMois(p.fin)}.`));
      if (gVal > 0) cs.push(T(`Réduisez « ${esc(gCat)} » de 10 % : environ ${DT0(gVal * .1)} de plus par mois.`, `قلّل «${esc(catTxt(gCat))}» بـ${iso("10 %")}: حوالي ${DT0(gVal * .1)} إضافية في الشهر.`));
      if (finOb) cs.push(T(`Après « ${esc(finOb.p.nom)} » (${nomMois(finOb.p.fin)}), ses ${DT0(finOb.f)} par mois pourront aller à ce projet.`, `بعد «${esc(finOb.p.nom)}» (${nomMois(finOb.p.fin)})، يمكن تحويل ${DT0(finOb.f)} الشهرية إلى هذا المشروع.`));
      if (p.cout > 10000) cs.push(T("Un crédit est possible : comparez d'abord son coût total.", "القرض ممكن: قارن أوّلًا كلفته الجملية."));
      return carte(p, `<div class="verdict v-non">${T(`Pas faisable à temps : il faudrait ${DT0(faut)} par mois, il vous reste ${DT0(peut)} après les projets obligatoires.`, `غير ممكن في الموعد: يلزم ${DT0(faut)} في الشهر، ويبقى لك ${DT0(peut)} بعد المشاريع الضرورية.`)}</div><div><b class="petit">${T("Conseils pour y arriver", "نصائح للوصول إليه")}</b><ul class="conseils">${cs.map(x => `<li>${x}</li>`).join("")}</ul></div>`); }).join("");
    $("vue-projets").innerHTML = `<div class="bloc"><div class="bloc-tete"><h2>${T("Mes projets", "مشاريعي")}</h2><span class="petit doux">${T(`Il vous reste en moyenne ${DT0(moy)} par mois après dépenses et impôt.`, `يبقى لك في المعدّل ${DT0(moy)} في الشهر بعد المصاريف والضريبة.`)}</span></div>
      <details class="ajout"${D.projets.length ? "" : " open"}><summary>${T("+ Ajouter un projet", "+ إضافة مشروع")}</summary>${formProjet(null)}</details>
      <div class="projets"><div class="titre-groupe"><h3>${T("À faire (obligatoires)", "للقيام به (ضرورية)")}</h3><p class="petit doux" style="margin:2px 0 0">${T("À mettre de côté chaque mois : ", "للادّخار كل شهر: ")}<b class="num">${DT0(reserve)}</b></p></div>
      ${hOb || `<p class="vide">${T("Aucun projet obligatoire (rentrée scolaire, Omra, travaux…).", "لا مشاريع ضرورية (العودة المدرسية، العمرة، الأشغال…).")}</p>`}
      <div class="titre-groupe"><h3>${T("Projets futurs (on aimerait)", "مشاريع مستقبلية (نتمنّاها)")}</h3><p class="petit doux" style="margin:2px 0 0">${T("Ce qui reste pour eux : ", "ما يبقى لها: ")}<b class="num">${DT0(libre)}</b>${T(" par mois", " في الشهر")}</p></div>
      ${hFu || `<p class="vide">${T("Aucun projet futur. Ajoutez-en un pour savoir s'il est faisable.", "لا مشاريع مستقبلية. أضف مشروعًا لتعرف إن كان ممكنًا.")}</p>`}</div></div>`;
  }
  function formProjet(p) {
    const v = p || { nom: "", type: "futur", cout: "", epargne: "", fin: ymPlus(ymDe(maintenant()), 12) };
    return `<form class="form" data-f="projet" data-id="${p ? p.id : ""}">
      <label>${T("Projet", "المشروع")}<input name="nom" required value="${esc(v.nom)}" placeholder="${T("Ex. : nouvelle voiture", "مثال: سيارة جديدة")}"></label>
      <label>${T("Type", "النوع")}<select name="type"><option value="oblig"${v.type === "oblig" ? " selected" : ""}>${T("À faire (obligatoire)", "للقيام به (ضروري)")}</option><option value="futur"${v.type !== "oblig" ? " selected" : ""}>${T("Projet futur (on aimerait)", "مشروع مستقبلي (نتمنّاه)")}</option></select></label>
      <label>${T("Coût total (DT)", "الكلفة الجملية (د.ت)")}<input name="cout" class="num" inputmode="decimal" required value="${esc(v.cout)}" placeholder="45000"></label>
      <label>${T("Déjà épargné (DT)", "المدّخر حاليًا (د.ت)")}<input name="epargne" class="num" inputmode="decimal" value="${esc(v.epargne)}" placeholder="0"></label>
      <label>${T("Pour quand ?", "متى؟")}<input name="fin" type="month" required value="${esc(v.fin)}"></label>
      <div class="boutons">${p ? `<button type="button" class="mini" data-a="annuler-projet">${T("Annuler", "إلغاء")}</button>` : ""}<button class="btn" type="submit">${p ? T("Enregistrer", "حفظ") : T("Ajouter le projet", "أضف المشروع")}</button></div></form>`;
  }

  function vuePlus() {
    const F = D.facture, somme = D.compteurs.reduce((s, c) => s + Math.max(lireNb(c.actuel) - lireNb(c.ancien), 0), 0);
    const base = F.methode === "locataires" ? somme : Math.max(lireNb(F.total), somme);
    $("vue-plus").innerHTML = `<div class="bloc"><h2>${T("Partager une facture STEG ou SONEDE", "تقسيم فاتورة الستاغ أو الصوناد")}</h2>
      <p class="petit doux" style="margin:0">${T("Pour plusieurs logements sur un même compteur : chacun paie selon sa consommation (index actuel − index précédent), moins l'avance déjà versée.", "لعدّة مساكن على نفس العدّاد: كل واحد يدفع حسب استهلاكه (المؤشّر الحالي − المؤشّر السابق)، مطروحًا منه التسبقة المدفوعة.")}</p>
      <form class="form" data-f="facture">
        <label>${T("Montant de la facture (DT)", "مبلغ الفاتورة (د.ت)")}<input name="montant" class="num" inputmode="decimal" value="${esc(F.montant || "")}" placeholder="412,000"></label>
        <label>${T("Partage", "التقسيم")}<select name="methode"><option value="locataires"${F.methode === "locataires" ? " selected" : ""}>${T("Entre les locataires seulement", "بين المتسوّغين فقط")}</option><option value="proprio"${F.methode !== "locataires" ? " selected" : ""}>${T("Avec une part pour moi (parties communes)", "مع نصيب لي (الأجزاء المشتركة)")}</option></select></label>
        <label${F.methode === "locataires" ? " hidden" : ""}>${T("Consommation totale de la facture", "الاستهلاك الجملي في الفاتورة")}<input name="total" class="num" inputmode="decimal" value="${esc(F.total || "")}" placeholder="${T("kWh ou m³", "kWh أو m³")}"></label></form>
      <div class="defile"><table><thead><tr><th>${T("Logement", "المسكن")}</th><th>${T("Index précédent", "المؤشّر السابق")}</th><th>${T("Index actuel", "المؤشّر الحالي")}</th><th>${T("Avance", "التسبقة")}</th><th>${T("Part", "النصيب")}</th><th>${T("Reste", "الباقي")}</th><th></th></tr></thead><tbody>
      ${D.compteurs.map(c => { const conso = Math.max(lireNb(c.actuel) - lireNb(c.ancien), 0), part = base ? conso / base * lireNb(F.montant) : 0, reste = part - lireNb(c.avance);
        return `<tr><td><input data-a="cpt" data-id="${c.id}" data-k="nom" value="${esc(c.nom)}" aria-label="${T("Logement", "المسكن")}" style="min-width:8em"></td>
          <td><input class="num" style="width:7em" inputmode="decimal" data-a="cpt" data-id="${c.id}" data-k="ancien" value="${esc(c.ancien)}" aria-label="${T("Index précédent", "المؤشّر السابق")}"></td>
          <td><input class="num" style="width:7em" inputmode="decimal" data-a="cpt" data-id="${c.id}" data-k="actuel" value="${esc(c.actuel)}" aria-label="${T("Index actuel", "المؤشّر الحالي")}"></td>
          <td><input class="num" style="width:6em" inputmode="decimal" data-a="cpt" data-id="${c.id}" data-k="avance" value="${esc(c.avance)}" aria-label="${T("Avance versée", "التسبقة المدفوعة")}"></td>
          <td class="num">${DT(part)}</td><td class="num" style="color:${reste > 0 ? "var(--retard)" : "var(--ok)"}">${reste >= 0 ? T("doit ", "عليه ") + DT(reste) : T("à rendre ", "يُرجَع له ") + DT(-reste)}</td>
          <td><button type="button" class="suppr" data-a="suppr-cpt" data-id="${c.id}" aria-label="${T("Retirer", "إزالة")}">×</button></td></tr>`; }).join("")}
      ${F.methode !== "locataires" && D.compteurs.length ? `<tr><td colspan="4"><b>${T("Ma part", "نصيبي")}</b></td><td class="num"><b>${DT(base ? Math.max(base - somme, 0) / base * lireNb(F.montant) : 0)}</b></td><td colspan="2"></td></tr>` : ""}
      </tbody></table></div>
      <div class="boutons" style="justify-content:space-between"><button type="button" class="mini" data-a="ajout-cpt">${T("+ Ajouter un logement", "+ إضافة مسكن")}</button>${D.compteurs.length ? `<button type="button" class="mini" data-a="cpt-suivant">${T("Nouvelle facture : l'index actuel devient l'index précédent", "فاتورة جديدة: المؤشّر الحالي يصبح المؤشّر السابق")}</button>` : ""}</div></div>

      <div class="bloc"><h2>${T("Sauvegarde", "النسخة الاحتياطية")}</h2>
      <p class="petit doux" style="margin:0">${T("Vos chiffres sont seulement dans ce téléphone. Faites une sauvegarde de temps en temps, et pour passer sur un autre téléphone ou sur l'ordinateur.", "أرقامك موجودة في هذا الهاتف فقط. احفظ نسخة احتياطية من حين لآخر، وكذلك للانتقال إلى هاتف آخر أو إلى الحاسوب.")}</p>
      <div class="boutons" style="justify-content:flex-start"><button type="button" class="btn" data-a="sauvegarde">${T("Télécharger ma sauvegarde", "نزّل نسختي الاحتياطية")}</button>
        <label class="btn btn-clair" style="display:inline-flex;cursor:pointer">${T("Restaurer une sauvegarde", "استرجاع نسخة احتياطية")}<input type="file" accept=".json,application/json" data-a="restaurer" hidden></label>
        <button type="button" class="btn btn-clair" data-a="excel">${T("Exporter pour Excel", "تصدير إلى Excel")}</button></div>
      ${stockageOk ? "" : `<p class="note" style="color:var(--retard)">${T("Ce navigateur ne garde pas les données (navigation privée ?). Utilisez une fenêtre normale.", "هذا المتصفح لا يحفظ البيانات (تصفّح خاص؟). استعمل نافذة عادية.")}</p>`}</div>

      <div class="bloc"><h2>${T("Gratuit pendant 3 mois", "مجاني لمدة 3 أشهر")}</h2>
      <p style="margin:0">${T("Mes comptes est <b>gratuit pendant 3 mois</b> à partir de votre première visite. Ensuite, un abonnement payant sera proposé : le prix sera affiché avant tout paiement, rien n'est prélevé automatiquement, et vos chiffres restent à vous (sauvegarde et export toujours possibles).", `حساباتي <b>مجاني لمدة ${iso(3)} أشهر</b> ابتداءً من أوّل زيارة. بعد ذلك يُقترح اشتراك بمقابل: يُعرض السعر قبل أي دفع، ولا يُقتطع أي مبلغ آليًا، وتبقى أرقامك ملكًا لك (النسخة الاحتياطية والتصدير ممكنان دائمًا).`)}</p></div>

      <div class="bloc" id="avis"><h2>${T("Votre avis", "رأيك")}</h2>
      <form class="form" data-f="avis" id="avis-form" style="grid-template-columns:1fr">
        <label>${T("Une idée, un problème, une question ?", "فكرة، مشكلة، سؤال؟")}<input name="message" required maxlength="1000" placeholder="${T("Écrivez ici", "اكتب هنا")}"></label>
        <label>${T("Votre e-mail (obligatoire, pour vous répondre)", "بريدك الإلكتروني (إجباري، للردّ عليك)")}<input name="email" type="email" dir="ltr" required maxlength="200" autocomplete="email" placeholder="exemple@mail.com"></label>
        <button class="btn" type="submit">${T("Envoyer", "أرسل")}</button><p class="petit doux" role="status" id="avisStatut" style="margin:0">${T("Votre e-mail sert seulement à vous répondre (n'écrivez pas vos montants).", "بريدك يُستعمل فقط للردّ عليك (لا تكتب مبالغك).")}</p></form>
      <div class="avis-merci" id="avis-merci" role="status" aria-live="polite" tabindex="-1" hidden></div></div>

      <div class="bloc"><h2>${T("Exemple et remise à zéro", "مثال وإعادة من الصفر")}</h2>
      <div class="boutons" style="justify-content:flex-start"><button type="button" class="mini" data-a="exemple">${T("Charger l'exemple", "حمّل المثال")}</button>
      ${UI.effacer ? `<span class="petit">${T("Tout effacer de ce téléphone ?", "مسح كل شيء من هذا الهاتف؟")}</span><button type="button" class="mini rouge" data-a="effacer-ok">${T("Oui, tout effacer", "نعم، امسح كل شيء")}</button><button type="button" class="mini" data-a="effacer-non">${T("Non", "لا")}</button>` : `<button type="button" class="mini rouge" data-a="effacer">${T("Tout effacer", "امسح كل شيء")}</button>`}</div></div>`;
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
    changer(() => { D.payes[rc.id + "|" + ym] = true; D.depenses.push(dep); }, T(`« ${rc.quoi} » notée comme payée.`, `«${rc.quoi}» سُجّلت كمدفوعة.`), () => { delete D.payes[rc.id + "|" + ym]; D.depenses = D.depenses.filter(d => d.id !== dep.id); }); }

  // bouton Partager de l'en-tête (règle commune à tous les sites, ajouté le 09/10/2026) : menu de partage du téléphone,
  // sinon WhatsApp ; clic compté anonymement ; on partage seulement l'adresse du site (jamais les données de l'utilisateur)
  function partager() {
    const url = T("https://comptes.clicvia.com/", "https://comptes.clicvia.com/ar/"), titre = T("Mes comptes — revenus, dépenses, impôt et rappels", "حساباتي — المداخيل والمصاريف والضريبة والتذكيرات"),
      texte = titre + T(" : gratuit 3 mois, les données restent dans votre téléphone.", ": مجاني لمدة 3 أشهر، والبيانات تبقى في هاتفك.");
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: T("partage/", "partage/ar/"), title: "Partage", event: true }); } catch (x) {}
    const wa = () => window.open("https://wa.me/?text=" + encodeURIComponent(texte + " " + url), "_blank", "noopener");
    if (navigator.share) navigator.share({ title: titre, text: texte, url }).catch(err => { if (!err || err.name !== "AbortError") wa(); });
    else wa();
  }

  document.addEventListener("click", e => {
    const nav = e.target.closest("nav.onglets button"); if (nav) { montrer(nav.dataset.vue, true); return; }
    if (e.target.closest("#puceEssai")) { montrer("plus", true); return; }
    if (e.target.closest("#partager")) { partager(); return; }
    const b = e.target.closest("[data-a]"); if (!b || b.tagName === "SELECT" || b.tagName === "INPUT") return;
    const a = b.dataset.a, id = b.dataset.id;
    if (a === "aller") montrer(b.dataset.vue, true);
    else if (a === "sous") { UI.sous = b.dataset.s; vueAccueil(); }
    else if (a === "periode") { UI.periode = b.dataset.p; vueRevenus(); }
    else if (a === "mois") { UI.moisVu = ymPlus(UI.moisVu, +b.dataset.d); vueRevenus(); }
    else if (a === "replier") { const t = b.dataset.t; D.replie = D.replie.includes(t) ? D.replie.filter(x => x !== t) : D.replie.concat(t); sauver(); vueRevenus(); }
    else if (a === "filtre-ech") { UI.filtreEch = b.dataset.f; vueImpot(); }
    else if (a === "recu") { const r = trouve("revenus", id), ym = b.dataset.ym, k = id + "|" + ym, avant = D.etats[k]; changer(() => { D.etats[k] = "r"; }, T(`« ${r.nom} » reçu (${modeTxt(r)}).`, `«${r.nom}» وصل (${modeTxt(r)}).`), () => { if (avant) D.etats[k] = avant; else delete D.etats[k]; }); }
    else if (a === "appeler") { const r = trouve("revenus", id), k = id + "|" + ymDe(maintenant()), avant = D.etats[k], on = etat(r, ymDe(maintenant())) === "p";
      changer(() => { D.etats[k] = on ? "x" : "p"; }, on ? T("Rappel « À appeler » arrêté.", "توقّف تذكير «يجب الاتصال».") : T(`Alarme chaque jour à 18:30 pour appeler ${leLoc(r)}. Mettez-la sur votre téléphone.`, `منبّه كل يوم على الساعة ${iso("18:30")} للاتصال بـ${leLoc(r)}. ضعه في هاتفك.`), () => { if (avant) D.etats[k] = avant; else delete D.etats[k]; }); }
    else if (a === "fin-appel") { const r = trouve("revenus", id), ym = ymDe(maintenant()), ks = [ym, ymPlus(ym, -1)].filter(m => etat(r, m) === "p").map(m => id + "|" + m);
      changer(() => ks.forEach(k => { D.etats[k] = "x"; }), T("Appel fait : le loyer reste « en retard » jusqu'à ce qu'il soit reçu.", "تمّ الاتصال: يبقى الكراء «متأخرًا» إلى أن يصل."), () => ks.forEach(k => { D.etats[k] = "p"; })); }
    else if (a === "payer") payer(id);
    else if (a === "ech-paye") { const e2 = trouve("echeances", id); changer(() => { e2.paye = true; }, T("Date limite notée comme payée.", "سُجّل الأجل كمدفوع."), () => { e2.paye = false; }); }
    else if (a === "suppr-rev") retirer("revenus", id, T("« % » supprimé.", "حُذف «%»."));
    else if (a === "suppr-dep") { const i = D.depenses.findIndex(d => d.id === id), [o] = D.depenses.splice(i, 1); const k = o.recId ? o.recId + "|" + o.date.slice(0, 7) : null;
      if (k) delete D.payes[k]; sauver(); tout(); message(T(`« ${o.quoi} » supprimée.`, `حُذفت «${o.quoi}».`), () => { D.depenses.splice(i, 0, o); if (k) D.payes[k] = true; }); }
    else if (a === "suppr-rec") retirer("recurrentes", id, T("« % » ne sera plus rappelée.", "لن يُذكَّر بـ«%» بعد الآن."));
    else if (a === "suppr-ech") retirer("echeances", id, T("« % » supprimée.", "حُذف «%»."));
    else if (a === "suppr-projet") retirer("projets", id, T("Projet « % » supprimé.", "حُذف مشروع «%»."));
    else if (a === "suppr-cpt") retirer("compteurs", id, T("« % » retiré.", "أُزيل «%»."));
    else if (a === "modif-rev") { UI.modifRevenu = id; vueRevenus(); }
    else if (a === "annuler-rev") { UI.modifRevenu = null; vueRevenus(); }
    else if (a === "modif-projet") { UI.modifProjet = id; vueProjets(); }
    else if (a === "annuler-projet") { UI.modifProjet = null; vueProjets(); }
    else if (a === "ajout-cpt") changer(() => D.compteurs.push({ id: nouvelId(), nom: T("Logement ", "مسكن ") + (D.compteurs.length + 1), ancien: "", actuel: "", avance: "" }));
    else if (a === "cpt-suivant") { const avant = JSON.parse(JSON.stringify(D.compteurs)); changer(() => D.compteurs.forEach(c => { c.ancien = c.actuel; c.actuel = ""; c.avance = ""; }), T("Prêt pour la nouvelle facture.", "جاهز للفاتورة الجديدة."), () => { D.compteurs = avant; }); }
    else if (a === "ech-habituelles") changer(ajouterEcheancesHabituelles, T("Dates ajoutées. Vérifiez-les et modifiez-les si besoin.", "أُضيفت الآجال. تثبّت منها وعدّلها إن لزم."));
    else if (a === "ics") { const ev = evDeCle(b.dataset.cle); if (ev && telecharger("rappel-mes-comptes.ics", fichierIcs([ev]), "text/calendar")) message(T("Ouvrez le fichier téléchargé : votre agenda propose d'ajouter le rappel.", "افتح الملف المنزّل: رزنامتك تقترح إضافة التذكير."), null); }
    else if (a === "ics-tout") { const evs = tousLesRappels(); if (!evs.length) { message(T("Ajoutez d'abord des revenus, des dépenses qui reviennent ou des dates limites.", "أضف أوّلًا مداخيل أو مصاريف متكرّرة أو آجالًا."), null); return; }
      if (telecharger("alarmes-mes-comptes.ics", fichierIcs(evs), "text/calendar")) message(T(`${evs.length} rappels prêts : ouvrez le fichier téléchargé pour les ajouter à l'agenda du téléphone.`, `${iso(evs.length)} تذكيرًا جاهزًا: افتح الملف المنزّل لإضافتها إلى رزنامة الهاتف.`), null); }
    else if (a === "sauvegarde") { if (telecharger("mes-comptes-sauvegarde-" + isoDe(maintenant()) + ".json", JSON.stringify(D, null, 1), "application/json")) message(T("Sauvegarde téléchargée. Gardez ce fichier en lieu sûr.", "نُزّلت النسخة الاحتياطية. احتفظ بهذا الملف في مكان آمن."), null); }
    else if (a === "excel") exporterExcel();
    else if (a === "exemple") { const avant = JSON.parse(JSON.stringify(D)); D = exemple(); sauver(); tout(); montrer("accueil", true); message(T("Exemple chargé : les noms et montants sont inventés.", "تمّ تحميل المثال: الأسماء والمبالغ خيالية."), () => { D = avant; }); }
    else if (a === "effacer-exemple" || a === "effacer-ok") { const avant = JSON.parse(JSON.stringify(D)); D = vide(); if (a === "effacer-exemple") D.debut = avant.debut; UI.effacer = false; sauver(); tout(); message(T("Tout est effacé.", "تمّ مسح كل شيء."), () => { D = avant; }); }
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
      lec.onload = () => { try { const o = JSON.parse(lec.result); if (!o || o.v !== 1 || !Array.isArray(o.revenus)) throw 0; const avant = D; D = Object.assign(vide(), o); sauver(); tout(); message(T("Sauvegarde restaurée.", "تمّ استرجاع النسخة الاحتياطية."), () => { D = avant; }); }
        catch (err) { message(T("Ce fichier n'est pas une sauvegarde de Mes comptes.", "هذا الملف ليس نسخة احتياطية من حساباتي."), null); } };
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
      if (!o.nom || !o.montant) { message(T("Indiquez au moins le nom et le montant.", "اكتب على الأقل الاسم والمبلغ."), null); return; }
      if (id) { const r = trouve("revenus", id), avant = { ...r }; UI.modifRevenu = null; changer(() => Object.assign(r, o), T(`« ${o.nom} » modifié.`, `عُدّل «${o.nom}».`), () => Object.assign(r, avant)); }
      else { const r = Object.assign({ id: nouvelId(), depuis: ymDe(maintenant()) }, o); changer(() => D.revenus.push(r), T(`« ${o.nom} » ajouté : attendu chaque mois avant le ${o.jour}.`, `أُضيف «${o.nom}»: منتظر كل شهر قبل يوم ${iso(o.jour)}.`), () => { D.revenus = D.revenus.filter(x => x.id !== r.id); }); }
    } else if (k === "depense") {
      const m = lireNb(v("montant")), freq = v("freq"); if (!v("quoi") || !m) { message(T("Indiquez quoi et le montant.", "اكتب ماذا والمبلغ."), null); return; }
      const ym = ymDe(maintenant()), dep = { id: nouvelId(), date: isoDe(maintenant()), quoi: v("quoi"), montant: m, cat: v("cat"), mode: v("mode") };
      let rc = null;
      if (freq !== "1") { rc = { id: nouvelId(), quoi: dep.quoi, montant: m, cat: dep.cat, mode: dep.mode, jour: Math.min(31, Math.max(0, Math.round(lireNb(v("jour"))))), freq, depart: ym }; dep.recId = rc.id; }
      changer(() => { D.depenses.push(dep); if (rc) { D.recurrentes.push(rc); D.payes[rc.id + "|" + ym] = true; } f.reset(); },
        rc ? T(`« ${dep.quoi} » ajoutée, et rappelée ${FREQ[freq][1]}.`, `أُضيفت «${dep.quoi}» وسيُذكَّر بها ${FREQ[freq][1]}.`) : T(`« ${dep.quoi} » ajoutée.`, `أُضيفت «${dep.quoi}».`),
        () => { D.depenses = D.depenses.filter(d => d.id !== dep.id); if (rc) D.recurrentes = D.recurrentes.filter(x => x.id !== rc.id); });
    } else if (k === "projet") {
      const o = { nom: v("nom"), type: v("type"), cout: lireNb(v("cout")), epargne: lireNb(v("epargne")), fin: v("fin") || ymPlus(ymDe(maintenant()), 12) };
      if (!o.nom || !o.cout) { message(T("Indiquez le projet et son coût.", "اكتب المشروع وكلفته."), null); return; }
      if (id) { const p = trouve("projets", id), avant = { ...p }; UI.modifProjet = null; changer(() => Object.assign(p, o), T(`Projet « ${o.nom} » modifié.`, `عُدّل مشروع «${o.nom}».`), () => Object.assign(p, avant)); }
      else { const p = Object.assign({ id: nouvelId() }, o); changer(() => D.projets.push(p), T(`Projet « ${o.nom} » ajouté.`, `أُضيف مشروع «${o.nom}».`), () => { D.projets = D.projets.filter(x => x.id !== p.id); }); }
    } else if (k === "echeance") {
      if (!v("quoi") || !v("date")) return; const e2 = { id: nouvelId(), quoi: v("quoi"), date: v("date"), montant: lireNb(v("montant")), paye: false, verif: false };
      changer(() => D.echeances.push(e2), T(`« ${e2.quoi} » ajoutée : rappels 1 mois, 15 jours et 3 jours avant.`, `أُضيف «${e2.quoi}»: تذكير قبل شهر و15 يومًا و3 أيام.`), () => { D.echeances = D.echeances.filter(x => x.id !== e2.id); });
    } else if (k === "impot") { lireImpot(f); sauver(); vueImpot(); vueAccueil(); }
    else if (k === "facture") { D.facture = { montant: lireNb(v("montant")), methode: v("methode"), total: lireNb(v("total")) }; sauver(); vuePlus(); }
    else if (k === "avis" && !auto) envoyerAvis(f);
  }
  // « Votre avis » (15/10/2026, demande d'Ahmed) : e-mail OBLIGATOIRE ; après l'envoi, confirmation bien visible dans la carte
  async function envoyerAvis(f) {
    const st = $("avisStatut"), msg = f.elements.message.value.trim(), mail = (f.elements.email.value || "").trim();
    if (!msg) { st.textContent = T("Écrivez votre message avant d'envoyer.", "اكتب رسالتك قبل الإرسال."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { st.textContent = T("Écrivez votre adresse e-mail (obligatoire) pour que nous puissions vous répondre.", "اكتب بريدك الإلكتروني (إجباري) حتى نتمكّن من الردّ عليك."); f.elements.email.focus(); return; }
    st.textContent = T("Envoi…", "جارٍ الإرسال…");
    try { const r = await fetch("https://formspree.io/f/mwlpakqj", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ site: "Mes comptes", page: T("plus", "plus (ar)"), message: msg, email: mail }) });
      if (!r.ok) throw 0;
      f.reset(); st.textContent = "";
      const b = $("avis-merci"), esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      b.innerHTML = T('<p class="avis-merci-titre">✅ Merci ! Votre avis a bien été envoyé.</p><p>Nous l’avons bien reçu et nous vous répondrons à l’adresse : <b>', '<p class="avis-merci-titre">✅ شكرًا! وصلنا رأيك.</p><p>استلمناه وسنردّ عليك على العنوان: <b dir="ltr">') + esc(mail) +
        '</b></p><button type="button" class="btn btn-clair">' + T("Envoyer un autre message", "أرسل رسالة أخرى") + '</button>';
      b.querySelector("button").onclick = () => { b.hidden = true; f.hidden = false; f.elements.message.focus(); };
      f.hidden = true; b.hidden = false;
      try { b.focus({ preventScroll: true }); b.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (x) { /* ancien navigateur */ } }
    catch (err) { st.textContent = T("L'envoi n'a pas marché (pas de connexion ?). Réessayez plus tard.", "لم ينجح الإرسال (لا اتصال؟). أعد المحاولة لاحقًا."); }
  }
  // lien « Votre avis » du pied de page (#avis) : ouvre l'onglet « Plus » sur le formulaire
  function allerAvis() {
    if (location.hash !== "#avis") return;
    montrer("plus");
    setTimeout(() => { const b = $("avis"); if (b) try { b.scrollIntoView({ block: "start" }); } catch (x) { /* ancien navigateur */ } }, 60);
  }
  window.addEventListener("hashchange", allerAvis);
  function exporterExcel() {
    const q = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`, n = x => String(Math.round(x * 1000) / 1000).replace(".", ",");
    const L = ["\ufeff" + T("Type;Date ou mois;Nom;Catégorie;Mode;Montant (DT);État", "النوع;التاريخ أو الشهر;الاسم;الصنف;الطريقة;المبلغ (د.ت);الحالة")];
    const ETAT_CSV = T({ r: "reçu", x: "en retard", p: "à appeler", a: "attendu", g: "gratuit", v: "rien" }, { r: "وصل", x: "متأخر", p: "يجب الاتصال", a: "منتظر", g: "مجاني", v: "لا شيء" });
    D.depenses.forEach(d => L.push([T("Dépense", "مصروف"), d.date, q(d.quoi), q(catTxt(d.cat)), d.mode === "internet" ? T("internet", "إنترنت") : T("cash", "نقدًا"), n(d.montant), ""].join(";")));
    Object.entries(D.etats).forEach(([k, e]) => { const [rid, ym] = k.split("|"), r = trouve("revenus", rid); if (r) L.push([T("Revenu", "مدخول"), ym, q(r.nom), TYPES[r.type], modeTxt(r), n(r.montant), ETAT_CSV[e]].join(";")); });
    if (telecharger("mes-comptes-" + isoDe(maintenant()) + ".csv", L.join("\r\n"), "text/csv")) message(T("Fichier téléchargé : ouvrez-le avec Excel.", "نُزّل الملف: افتحه بـExcel."), null);
  }

  // ---------------------------------------------------------------- dates habituelles (d'après des carnets réels, À VÉRIFIER)
  function prochaine(mois, jour) { const n = maintenant(); let d = new Date(n.getFullYear(), mois - 1, jour); if (joursAvant(d) < 0) d = new Date(n.getFullYear() + 1, mois - 1, jour); return isoDe(d); }
  function ajouterEcheancesHabituelles() {
    [[T("Acompte provisionnel (juin)", "قسط احتياطي (جوان)"), 6, 25], [T("Acompte provisionnel (septembre)", "قسط احتياطي (سبتمبر)"), 9, 25], [T("Acompte provisionnel (décembre)", "قسط احتياطي (ديسمبر)"), 12, 25],
     [T("Vignette de la voiture", "معلوم الجولان (الفينيات)"), 3, 5], [T("Déclaration annuelle des revenus", "التصريح السنوي بالمداخيل"), 4, 25]].forEach(([quoi, m, j]) =>
      D.echeances.push({ id: nouvelId(), quoi, date: prochaine(m, j), montant: 0, paye: false, verif: true }));
  }

  // ---------------------------------------------------------------- exemple (noms et montants inventés)
  function exemple() {
    const n = maintenant(), ym = ymDe(n), o = vide(), id = () => nouvelId();
    o.exemple = true; o.debut = D.debut || isoDe(n);
    const R = [["loyer", T("Boutique — café", "محلّ — مقهى"), 1600, "virement", 5, T("M. Ben Salah (exemple)", "السيد بن صالح (مثال)"), "+216 00 000 001"], ["loyer", T("Appartement 1", "الشقة 1"), 850, "cash", 5, T("M. Gharbi (exemple)", "السيد الغربي (مثال)"), "+216 00 000 002"],
      ["loyer", T("Appartement 2", "الشقة 2"), 850, "cash", 5, T("Mme Mansour (exemple)", "السيدة منصور (مثال)"), "+216 00 000 003"], ["salaire", T("Salaire", "الأجرة"), 3200, "virement", 28, T("Employeur (exemple)", "المؤجّر (مثال)"), ""], ["autre", T("Cours particuliers", "دروس خصوصية"), 600, "cash", 10, "", ""]];
    R.forEach(([type, nom, montant, mode, jour, locataire, tel]) => o.revenus.push({ id: id(), type, nom, montant, mode, jour, locataire, tel, depuis: ymPlus(ym, -3) }));
    o.revenus.forEach((r, i) => { for (let k = 3; k >= 1; k--) o.etats[r.id + "|" + ymPlus(ym, -k)] = "r"; if (i === 0 || i === 4) o.etats[r.id + "|" + ym] = "r"; });
    o.etats[o.revenus[2].id + "|" + ym] = "p";
    const C = [[T("Internet fibre", "إنترنت الألياف"), 61, "Téléphone et internet", "internet", 10, "mois"], ["Ooredoo", 102, "Téléphone et internet", "internet", 15, "mois"], [T("STEG maison", "ستاغ المنزل"), 185, "STEG et SONEDE", "internet", 12, "2mois"],
      [T("SONEDE maison", "صوناد المنزل"), 64, "STEG et SONEDE", "cash", 20, "3mois"], [T("Essence", "البنزين"), 600, "Voiture et essence", "cash", 0, "mois"], [T("Aide ménagère", "معينة منزلية"), 450, "Maison", "cash", 28, "mois"], [T("Don mensuel", "صدقة شهرية"), 50, "Dons (sadaqa)", "cash", 0, "mois"]];
    C.forEach(([quoi, montant, cat, mode, jour, freq]) => o.recurrentes.push({ id: id(), quoi, montant, cat, mode, jour, freq, depart: ym }));
    o.payes[o.recurrentes[0].id + "|" + ym] = true; o.payes[o.recurrentes[4].id + "|" + ym] = true;
    const jour = k => isoDe(new Date(n.getFullYear(), n.getMonth(), Math.max(1, Math.min(n.getDate(), k))));
    [[o.recurrentes[0].quoi, 61, "Téléphone et internet", "internet", o.recurrentes[0].id], [o.recurrentes[4].quoi, 600, "Voiture et essence", "cash", o.recurrentes[4].id], [T("Courses", "القضية"), 214.6, "Courses", "cash"], [T("Dentiste", "طبيب الأسنان"), 180, "Santé", "cash"], [T("Fournitures scolaires", "أدوات مدرسية"), 96.5, "Enfants et école", "cash"]]
      .forEach(([quoi, montant, cat, mode, recId], i) => o.depenses.push({ id: id(), date: jour(2 + i * 3), quoi, montant, cat, mode, recId }));
    for (let k = 1; k <= 3; k++) o.depenses.push({ id: id(), date: ymPlus(ym, -k) + "-08", quoi: T("Courses du mois", "قضية الشهر"), montant: 700, cat: "Courses", mode: "cash" });
    o.impot = { salaireBrut: 48000, chef: true, enfants: 2, retenu: 9500 };
    const ech = (q, d, m) => o.echeances.push({ id: id(), quoi: q, date: isoDe(new Date(n.getFullYear(), n.getMonth(), n.getDate() + d)), montant: m, paye: false, verif: true });
    ech(T("Déclaration mensuelle (exemple)", "التصريح الشهري (مثال)"), 6, 30); ech(T("Acompte provisionnel (exemple)", "قسط احتياطي (مثال)"), 64, 1200); ech(T("Vignette de la voiture (exemple)", "معلوم الجولان (مثال)"), 134, 130);
    o.projets.push({ id: id(), type: "oblig", nom: T("Rentrée scolaire", "العودة المدرسية"), cout: 2500, epargne: 300, fin: ymPlus(ym, 10) }, { id: id(), type: "oblig", nom: T("Voyage Omra (2 personnes)", "عمرة (شخصان)"), cout: 10100, epargne: 3000, fin: ymPlus(ym, 5) },
      { id: id(), type: "futur", nom: T("Changer de voiture", "تغيير السيارة"), cout: 45000, epargne: 8000, fin: ymPlus(ym, 14) }, { id: id(), type: "futur", nom: T("Climatisation", "مكيّف"), cout: 3600, epargne: 500, fin: ymPlus(ym, 8) });
    o.compteurs.push({ id: id(), nom: T("Appartement 1", "الشقة 1"), ancien: 4120, actuel: 4450, avance: 50 }, { id: id(), nom: T("Appartement 2", "الشقة 2"), ancien: 2980, actuel: 3221, avance: 30 });
    o.facture = { montant: 140, methode: "locataires", total: 0 };
    return o;
  }

  // ---------------------------------------------------------------- démarrage
  function demarrer() { charger(); if (!D.vu) { D.vu = true; sauver(); } tout(); allerAvis(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();
  window.MesComptes = { langue: T("fr", "ar"), donnees: () => D, alarmes, calculImpot, fichierIcs, tousLesRappels, exemple, bareme, capacite, tout, lienGoogle };
})();
