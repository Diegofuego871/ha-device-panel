/**
 * Fenster "Ladungen" (seit 2.204.0, docs/mockups/charges-v1, Variante A): die letzten fünf Ladungen eines Geräts. Oben die gewählte Ladung als Kurve
 * (Stand grün, mit Akku-Grösse auch die Leistung gestrichelt), darunter Dauer, Stand und Leistung, unten die Liste der Ladungen nach Datum. Wenig Text,
 * keine Fussnoten. Die Daten kommen von device_panel/charges (charge.py, nur Administratoren); Watt sind Schätzungen und nur mit eingestellter Akku-Grösse da.
 */

const W = 320;
const H = 150;
const PAD = { l: 30, r: 34, t: 8, b: 22 };

export class ChargesUi {
  constructor(host, deps) {
    this.host = host;
    this.h = deps;
    this.deviceId = "";
    this.data = null;
    this.sel = 0;
    this.error = "";
  }

  t(key, ...args) {
    return this.host._t(key, ...args);
  }

  get dlg() {
    return this.host.shadowRoot.querySelector("dialog.charges-dlg");
  }

  async open(deviceId) {
    const dlg = this.dlg;
    if (!dlg) return;
    this.deviceId = deviceId;
    this.data = null;
    this.sel = 0;
    this.error = "";
    this.frame();
    if (!dlg.open) {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    }
    // Fenster inzwischen für ein anderes Gerät geöffnet: die späte Antwort gehört nicht mehr hierher
    let data = null;
    let error = "";
    try {
      data = await this.host._hass.callWS({ type: "device_panel/charges", device_id: deviceId });
    } catch (err) {
      error = this.h.errText(err);
    }
    if (this.deviceId !== deviceId) return;
    this.data = data;
    this.error = error;
    this.render();
  }

  close() {
    const dlg = this.dlg;
    if (dlg?.open) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }
  }

  bind(dlg) {
    dlg.addEventListener("click", (ev) => {
      if (ev.target === dlg) {
        const r = dlg.getBoundingClientRect();
        if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) this.close();
        return;
      }
      const el = ev.target.closest("[data-cg]");
      if (!el) return;
      if (el.dataset.cg === "close") this.close();
      else if (el.dataset.cg === "pick") {
        this.sel = Number(el.dataset.i) || 0;
        this.render();
      }
    });
  }

  frame() {
    const { escape, mdi } = this.h;
    const d = this.host._devices.find((x) => x.id === this.deviceId);
    this.dlg.innerHTML = `<div class="dlg-head"><span class="dlg-avatar app app-charges">${mdi("batteryCharging", 28)}</span>
        <div class="dlg-title"><h2>${escape(this.t("chgWinTitle"))}</h2><div class="dlg-sub">${escape(d?.name || "")}</div></div>
        <button type="button" class="dlg-close" data-cg="close" title="${escape(this.t("close"))}" aria-label="${escape(this.t("close"))}">${mdi("close", 18)}</button></div>
      <div class="dlg-body" data-cg-body></div>
      <div class="dlg-actions"><button type="button" class="dlg-btn" data-cg="close">${mdi("close", 18)}${escape(this.t("close"))}</button></div>`;
    this.render();
  }

  // Kurve der gewählten Ladung: x in Minuten, links 0 bis 100 % (Stand), rechts Watt (nur mit Leistung)
  chart(c) {
    const { escape } = this.h;
    const pw = W - PAD.l - PAD.r;
    const ph = H - PAD.t - PAD.b;
    const span = Math.max(60, c.pts[c.pts.length - 1][0]);
    const x = (s) => (PAD.l + (s / span) * pw).toFixed(1);
    const yl = (v) => (PAD.t + ph - (Math.max(0, Math.min(100, v)) / 100) * ph).toFixed(1);
    const top = c.peak_w ? Math.max(1, Math.ceil(c.peak_w / 5) * 5) : 0;
    const yw = (v) => (PAD.t + ph - (Math.max(0, Math.min(top, v)) / top) * ph).toFixed(1);
    const grid = [0, 50, 100]
      .map((v) => `<line class="cg-grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${yl(v)}" y2="${yl(v)}"/><text class="cg-ax" x="${PAD.l - 5}" y="${Number(yl(v)) + 3}" text-anchor="end">${v}</text>`)
      .join("");
    const lvl = c.pts.map((p) => `${x(p[0])},${yl(p[1])}`).join(" ");
    const area = `${x(0)},${yl(0)} ${lvl} ${x(span)},${yl(0)}`;
    let watts = "";
    let wax = "";
    if (c.watts && top) {
      const pts = c.pts.map((p, i) => (c.watts[i] == null ? null : `${x(p[0])},${yw(c.watts[i])}`)).filter(Boolean);
      if (pts.length > 1) watts = `<polyline class="cg-wl" points="${pts.join(" ")}"/>`;
      wax = [0, top / 2, top].map((v) => `<text class="cg-ax w" x="${W - PAD.r + 5}" y="${Number(yw(v)) + 3}">${Math.round(v)}</text>`).join("");
    }
    const ticks = [0, 0.5, 1]
      .map((f, i) => `<text class="cg-ax" x="${x(span * f)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}">${i === 0 ? "0" : `${Math.round((span * f) / 60)} ${escape(this.t("chgMin"))}`}</text>`)
      .join("");
    return `<svg class="cg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(this.t("chgWinTitle"))}">${grid}<polygon class="cg-area" points="${area}"/><polyline class="cg-l" points="${lvl}"/>${watts}${wax}${ticks}</svg>`;
  }

  tile(k, v) {
    const { escape } = this.h;
    return `<div class="cg-tile"><span class="cg-k">${escape(k)}</span><span class="cg-v">${v}</span></div>`;
  }

  render() {
    const body = this.dlg?.querySelector("[data-cg-body]");
    if (!body) return;
    const { escape } = this.h;
    const host = this.host;
    if (this.error) {
      body.innerHTML = `<div class="dlg-error">${escape(this.error)}</div>`;
      return;
    }
    if (!this.data) {
      body.innerHTML = `<div class="pl-ldwrap empty">${this.host._loaderHtml("var(--dp-success)")}</div>`;
      return;
    }
    const list = this.data.charges || [];
    if (!list.length) {
      body.innerHTML = `<p class="dlg-note">${escape(this.t("chgEmpty"))}</p>`;
      return;
    }
    const c = list[Math.min(this.sel, list.length - 1)];
    const w = (v) => (v == null ? "–" : `≈ ${escape(host._fmtPct(Math.round(v)))}<small>W</small>`);
    const tiles = [this.tile(this.t("chgDuration"), host._fmtSeconds(c.minutes * 60)), this.tile(this.t("chgLevel"), `${c.from}<small>→</small>${c.to}<small>%</small>`)];
    if (c.watts) tiles.push(this.tile(this.t("chgAvg"), w(c.avg_w)), this.tile(this.t("chgPeak"), w(c.peak_w)));
    const rows = list
      .map(
        (x, i) => `<button type="button" class="cg-row${i === this.sel ? " on" : ""}" data-cg="pick" data-i="${i}">
          <span class="cg-d">${escape(host._fmtTime(x.start, true))}</span>
          <span class="cg-p">${x.from} → ${x.to} %</span>
          <span class="cg-w">${x.avg_w != null ? `${w(x.avg_w)}` : escape(host._fmtSeconds(x.minutes * 60))}</span></button>`
      )
      .join("");
    body.innerHTML = `<div class="cg-card">${this.chart(c)}</div>
      <div class="cg-tiles" style="--n:${tiles.length}">${tiles.join("")}</div>
      <div class="cg-list">${rows}</div>`;
  }
}
