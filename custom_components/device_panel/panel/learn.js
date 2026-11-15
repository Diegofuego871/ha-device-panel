/**
 * Lernseite "Mehr erfahren" (seit 2.223.0, ab 2.225.0 mit acht Themen, docs/mockups/learn-v4, Variante A2): acht Themen (Ausgefallene Geräte mit Pausen, Batterie-Warnungen, System, Backup, Magic Push, Routinen, Dashboard-Karten, App-Launcher) als
 * Kacheln mit einer kleinen Skizze der Funktion; ein Tipp öffnet einen kurzen Artikel mit Reitern, "Zurück" und "Weiter". Zwei Einstiege:
 * nach dem Einrichtungsassistenten (mit Kopf "Einrichtung abgeschlossen") und in Einstellungen › Panel › Mehr erfahren.
 *
 * Der Assistent gilt mit "Fertigstellen" als beendet (wizard.js); diese Seite hängt an keinem Zustand und schreibt nichts. Schliessen ist jederzeit
 * möglich (Kreuz, Esc, Tipp daneben), ohne Folgen. Die Texte stehen in strings.js (lrn*, Fett im Text mit **…**); die Beispieldaten der Skizzen
 * sind erfunden (lrnSk). Die Skizzen sind kleine Nachbauten aus HTML und folgen damit der Sprache; sie zeigen keine echten Geräte.
 */

// Reihenfolge, Symbol und Farbe je Thema. Ausfälle und Batterie stehen vorn (Nutzerwunsch: sie sind das Wichtigste, was das Panel tut). Die Farben der
// übrigen sind die der Launcher-Symbole (Magic Push violett, Routinen türkis, Dashboard-Karten blau wie die Ansicht), damit ein Thema überall
// dieselbe Farbe trägt; Ausfälle rot und Batterie orange wie die Warnstufen des Panels.
const TOPICS = [
  { id: "out", icon: "alert", color: "#D32F2F" },
  { id: "bat", icon: "battery", color: "#EF6C00" },
  { id: "sys", icon: "desktop", color: "#2E8B57" },
  { id: "bkp", icon: "save", color: "#455A64" },
  { id: "push", icon: "sparkle", color: "#8E24AA" },
  { id: "rt", icon: "flash", color: "#00838F" },
  { id: "cards", icon: "puzzle", color: "#1E88E5" },
  { id: "lau", icon: "apps", color: "#C2185B" },
];

export class LearnUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    // s: null (zu) oder { source: "wizard" | "settings", view: "overview" | "article", i }
    this.s = null;
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.learn-dlg");
  }

  open(source = "settings") {
    const dlg = this.dlg;
    if (!dlg) return;
    this.s = { source, view: "overview", i: 0 };
    this.render(false);
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
  }

  close() {
    const dlg = this.dlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
    this.s = null;
  }

  bind(dlg) {
    if (!dlg || this._bound) return;
    this._bound = true;
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        // Tipp auf den Hintergrund ausserhalb des Fensters
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.close();
        return;
      }
      const el = ev.target.closest("[data-lrn]");
      if (!el || !this.s) return;
      const a = el.dataset.lrn;
      if (a === "close") this.close();
      else if (a === "overview") this.go("overview");
      else if (a === "topic") this.go("article", Number(el.dataset.i) || 0);
    });
    // Kacheln sind keine Knöpfe (enthalten Skizzen aus Blockelementen): Eingabe und Leertaste wie ein Tipp
    dlg.addEventListener("keydown", (ev) => {
      const el = ev.target.closest?.('.lrn-card[data-lrn="topic"]');
      if (!el || (ev.key !== "Enter" && ev.key !== " ")) return;
      ev.preventDefault();
      this.go("article", Number(el.dataset.i) || 0);
    });
    // Esc und das Schliessen von aussen: der Zustand wird zurückgesetzt, ein neues Öffnen beginnt wieder in der Übersicht
    dlg.addEventListener("close", () => {
      this.s = null;
    });
  }

  go(view, i = 0) {
    const s = this.s;
    if (!s) return;
    s.view = view;
    s.i = Math.max(0, Math.min(TOPICS.length - 1, i));
    this.render(true);
  }

  // Fett im Text: erst entschärfen, dann **…** zu <b>…</b> (die Texte kommen aus strings.js, nie aus Eingaben)
  rich(text) {
    return this.h.escape(String(text ?? "")).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  }

  topic(id) {
    return (this.host._t("lrnTopics") || {})[id] || {};
  }

  // --- Skizzen ----------------------------------------------------------------------

  // Nachbau einer Push-Meldung
  push(time, title, text, acts) {
    const { escape } = this.h;
    const k = this.host._t("lrnSk");
    return `<div class="lrn-push"><div class="lp-t"><i class="lp-logo">D</i>${escape(k.app)} · ${escape(time)}</div><b>${escape(title)}</b><p>${escape(text)}</p>
      ${acts.length ? `<div class="lp-ac">${acts.map((a) => `<u>${escape(a)}</u>`).join("")}</div>` : ""}</div>`;
  }

  // Skizze eines Themas; full: die grosse Fassung im Artikel mit zweitem Teil
  sketch(id, full) {
    const { escape, mdi } = this.h;
    const k = this.host._t("lrnSk");
    if (id === "out") {
      // Liste: ein ausgefallenes und ein pausiertes Gerät; im Artikel dazu die Meldung mit ihren drei Schaltflächen
      const list = `<div class="lrn-dev"><div class="ld-r"><i class="ld-dot off"></i><b>${escape(k.dev1)}</b><em>${escape(k.dur1)}</em></div>
        <div class="ld-r"><i class="ld-dot"></i><b>${escape(k.pauseDev)}</b><span class="ld-pill">${mdi("pause", 12)}${escape(k.pausedUntil)}</span></div></div>`;
      return list + (full ? this.push(k.now, k.outTitle, k.outText, [k.outA1, k.outA2, k.outA3]) : "");
    }
    if (id === "bat") {
      // Batterie mit Schwelle (Strich bei 15 %); im Artikel dazu die Prognose und die Warnung
      const bar = `<div class="lrn-bat"><div class="lb-h"><span class="lb-ic">${mdi("battery", 20)}</span><b>${escape(k.batName)}</b><em>21 %</em></div>
        <div class="lb-bar"><i style="width:21%"></i><u style="left:15%"></u></div><div class="lb-s"><span>${escape(k.batThr)}</span>${full ? `<span>${escape(k.batFc)}</span>` : ""}</div></div>`;
      return bar + (full ? this.push(k.now, k.batTitle, k.batText, []) : "");
    }
    if (id === "sys") {
      // Auslastung als drei Balken (die Festplatte an der Grenze); im Artikel dazu der Zustand der Dienste und die Warnung
      const meter = (name, v, hi) => `<div class="ls-r"><span>${escape(name)}</span><span class="ls-b${hi ? " hi" : ""}"><i style="width:${v}%"></i></span><b>${v} %</b></div>`;
      const load = `<div class="lrn-sys">${meter(k.sysCpu, 23)}${meter(k.sysRam, 61)}${meter(k.sysDisk, 99, true)}</div>`;
      const svc = `<div class="lrn-svc"><div class="lrn-sv"><i class="ok"></i><b>${escape(k.svcRoutines)}</b><em>${escape(k.svcOk)}</em></div><div class="lrn-sv"><i class="late"></i><b>${escape(k.svcUpdates)}</b><em>${escape(k.svcLate)}</em><u>${escape(k.svcRestart)}</u></div></div>`;
      return load + (full ? svc + this.push(k.now, k.sysPushTitle, k.sysPushText, []) : "");
    }
    if (id === "bkp") {
      // Sicherungsdatei mit Vorschau; im Artikel dazu die Meldungen bei Fehler und bei Erfolg
      const file = `<div class="lrn-file"><div class="lf-h"><span class="lf-ic">${mdi("save", 20)}</span><div><b>${escape(k.bkFile)}</b><small>${escape(k.bkParts)}</small></div></div><div class="lf-p">${escape(k.bkPrev)}</div></div>`;
      return file + (full ? this.push("03:12", k.bkFailTitle, k.bkFailText, []) + this.push("04:17", k.bkOkTitle, k.bkOkText, []) : "");
    }
    if (id === "push") return this.push(k.now, k.pushTitle, k.pushText, [k.pushA1, k.pushA2, k.pushA3]);
    if (id === "rt") {
      const row = `<div class="lrn-rt"><span class="lr-ic">${mdi("fan", 22)}</span><div><b>${escape(k.rtName)}</b><small>${escape(k.rtSub)}</small></div><span class="lr-sw"></span></div>`;
      return row + (full ? this.push(k.rtTime, k.rtPushTitle, k.rtPushText, [k.rtPushAct]) : "");
    }
    if (id === "cards") {
      const ring = `<div class="lrn-dc"><div class="lc-ring"><i>94 %</i></div><ul>
        <li style="--c:#43a047"><span>${escape(k.stable)}</span><b>31</b></li><li style="--c:#f9a825"><span>${escape(k.unstable)}</span><b>2</b></li><li style="--c:#e53935"><span>${escape(k.off)}</span><b>1</b></li></ul></div>`;
      const off = `<div class="lrn-dc2"><div class="n">2</div>${escape(k.offText)}
        <div class="r"><span>${escape(k.dev1)}</span><em>${escape(k.dur1)}</em><span class="pz">${escape(k.pause)}</span></div>
        <div class="r"><span>${escape(k.dev2)}</span><em>${escape(k.dur2)}</em><span class="pz">${escape(k.pause)}</span></div></div>`;
      return ring + (full ? off : "");
    }
    // Launcher: vier Symbole in der Kachel, acht mit Favoriten im Artikel
    const tile = (icon, color, label, badge) => `<div><i style="background:${color}">${mdi(icon, 24)}</i>${escape(label)}${badge ? `<span class="bd">${badge}</span>` : ""}</div>`;
    const tiles = [tile("flash", "#00838F", k.lRoutines), tile("sparkle", "#8E24AA", k.lMagic), tile("log", "#4A5963", k.lLog), tile("update", "#2E8B57", k.lUpdates, 3)];
    if (full) tiles.push(tile("gear", "#8D6E63", k.lSettings), tile("home", "#1E88E5", k.lDash), tile("lightbulb", "#C2185B", k.lLights), tile("link", "#7a5a10", k.lRouter));
    const fav = full ? `<div class="lrn-kopf"><span>${escape(k.fav)}</span><i>${mdi("flash", 14)}</i><i>${mdi("gear", 14)}</i><i>${mdi("apps", 14)}</i></div>` : "";
    return `${fav}<div class="lrn-lg">${tiles.join("")}</div>`;
  }

  // --- Seiten -----------------------------------------------------------------------

  // Kopf "Einrichtung abgeschlossen" (nur nach dem Assistenten): rundes Zeichen mit Haken, Titel, Satz, dann die Trennzeile zu den Kacheln
  doneHtml() {
    const { escape } = this.h;
    return `<div class="lrn-done"><div class="lrn-ck"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h2>${escape(this.t("lrnDoneTitle"))}</h2><p>${escape(this.t("lrnDoneText"))}</p></div>
      <div class="lrn-sect">${escape(this.t("lrnMore"))}</div>`;
  }

  overviewHtml() {
    const { escape, mdi } = this.h;
    const cards = TOPICS.map((tp, n) => {
      const x = this.topic(tp.id);
      return `<div class="lrn-card" role="button" tabindex="0" data-lrn="topic" data-i="${n}" style="--lc:${tp.color}">
        <span class="lrn-sk"><span class="lrn-sketch">${this.sketch(tp.id, false)}</span></span>
        <span class="lrn-tx"><b>${escape(x.name)}</b><small>${escape(x.short)}</small>
          <span class="lrn-meta"><span>${escape(this.t("lrnRead", 2))}</span><span class="cbtn" aria-hidden="true">${mdi("chevronRight", 16)}</span></span></span></div>`;
    }).join("");
    const wiz = this.s.source === "wizard";
    return `${wiz ? this.doneHtml() : ""}<div class="lrn-cards">${cards}</div>${wiz ? `<p class="lrn-hint">${escape(this.t("lrnLater"))}</p>` : ""}`;
  }

  articleHtml(i) {
    const tp = TOPICS[i];
    const x = this.topic(tp.id);
    const { escape } = this.h;
    const blocks = (x.blocks || [])
      .map((b) => {
        if (b.tip) return `<div class="lrn-tip">${this.rich(b.tip)}</div>`;
        const steps = b.steps ? `<div class="lrn-tl">${b.steps.map((st, n) => `<div class="lt-st"><i>${n + 1}</i><p><b>${escape(st[0])}:</b> ${escape(st[1])}</p></div>`).join("")}</div>` : "";
        return `${b.h ? `<h3>${escape(b.h)}</h3>` : ""}${(b.p || []).map((p) => `<p>${this.rich(p)}</p>`).join("")}${steps}`;
      })
      .join("");
    return `<div class="lrn-art" style="--lc:${tp.color}"><div class="lrn-txt"><h2>${escape(x.title)}</h2>${blocks}</div>
      <aside><div class="lrn-sk lrn-hero"><div class="lrn-sketch">${this.sketch(tp.id, true)}</div></div><div class="lrn-cap">${escape(x.cap)}</div></aside></div>`;
  }

  render(animate = false) {
    const dlg = this.dlg;
    const s = this.s;
    if (!dlg || !s) return;
    const { escape, mdi } = this.h;
    const t = (k, ...a) => this.t(k, ...a);
    const active = this.host.shadowRoot.activeElement;
    const focusKey = dlg.contains(active) && active?.dataset?.lrn ? `[data-lrn="${active.dataset.lrn}"]${active.dataset.i != null ? `[data-i="${active.dataset.i}"]` : ""}` : "";
    const wiz = s.source === "wizard";
    const close = `<button type="button" class="dlg-close" data-lrn="close" title="${escape(t("close"))}" aria-label="${escape(t("close"))}">${mdi("close", 18)}</button>`;
    let head = "";
    let tabs = "";
    let body = "";
    let foot = "";
    if (s.view === "overview") {
      head = wiz
        ? `<div class="dlg-head lrn-min">${close}</div>`
        : `<div class="dlg-head"><span class="dlg-avatar app app-learn">${mdi("lightbulb", 28)}</span><div class="dlg-title"><h2>${escape(t("lrnTitle"))}</h2><div class="dlg-sub">${escape(t("lrnSub"))}</div></div>${close}</div>`;
      body = this.overviewHtml();
      foot = wiz
        ? `<button type="button" class="dlg-btn primary" data-lrn="close">${mdi("check", 18)}${escape(t("lrnFinish"))}</button>`
        : `<button type="button" class="dlg-btn" data-lrn="close">${mdi("close", 18)}${escape(t("close"))}</button>`;
    } else {
      const i = s.i;
      const x = this.topic(TOPICS[i].id);
      const last = i === TOPICS.length - 1;
      head = `<div class="dlg-head"><button type="button" class="dlg-close lrn-back" data-lrn="overview" title="${escape(t("lrnBackOverview"))}" aria-label="${escape(t("lrnBackOverview"))}">${mdi("arrowLeft", 18)}</button>
        <div class="dlg-title"><h2>${escape(x.name)}</h2><div class="dlg-sub">${escape(t("lrnOf", i + 1, TOPICS.length, 2))}</div></div>${close}</div>`;
      tabs = `<div class="sub-tabs lrn-tabs" role="tablist">${TOPICS.map((tp, n) => `<button type="button" class="sub-tab${n === i ? " on" : ""}" role="tab" aria-selected="${n === i}" data-lrn="topic" data-i="${n}">${mdi(tp.icon, 15)}<span>${escape(this.topic(tp.id).tab)}</span></button>`).join("")}</div>`;
      body = this.articleHtml(i);
      const prev = i > 0 ? this.topic(TOPICS[i - 1].id).name : t("lrnOverview");
      foot = `<button type="button" class="dlg-btn" data-lrn="${i > 0 ? "topic" : "overview"}" data-i="${i - 1}">${mdi("arrowLeft", 18)}<span>${escape(prev)}</span></button>
        ${last ? `<button type="button" class="dlg-btn primary" data-lrn="close">${mdi("check", 18)}${escape(t("lrnFinish"))}</button>` : `<button type="button" class="dlg-btn primary" data-lrn="topic" data-i="${i + 1}"><span>${escape(this.topic(TOPICS[i + 1].id).name)}</span>${mdi("arrowRight", 18)}</button>`}`;
    }
    dlg.setAttribute("aria-label", t("lrnTitle"));
    dlg.innerHTML = `${head}${tabs}<div class="dlg-body lrn-body"><div class="lrn-page${animate ? " fx" : ""}">${body}</div></div><div class="dlg-actions">${foot}</div>`;
    dlg.querySelector(".lrn-body").scrollTop = 0;
    if (focusKey) dlg.querySelector(focusKey)?.focus({ preventScroll: true });
  }
}
