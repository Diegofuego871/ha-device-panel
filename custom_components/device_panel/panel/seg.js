/**
 * Reiterleisten als Segmentschalter, aus device-panel.js ausgelagert, damit auch die Tour-Seite (docs/tour) die gleitende
 * Kapsel zeigt. Aufruf mit "this" als Halter der Beobachter und der letzten Lage: initSeg.call(halter, wurzel).
 * Die Logik ist unverändert aus dem Panel übernommen.
 */

// Reiter als Segmentschalter (seit 2.0.5, docs/mockups/segmented-v1): Die gewählte "Kapsel" ist ein eigenes Element
// (.seg-pill), das beim Wechsel zum neuen Reiter gleitet. Die Reiterleisten werden bei jedem Aufbau neu gezeichnet;
// darum merkt sich das Panel je Leiste die letzte Lage der Kapsel und fährt von dort los (FLIP). Ohne Bewegung
// (Beim ersten Zeichnen, nach Grössenänderung, bei "Bewegung reduzieren") steht die Kapsel sofort am Ziel.
export function initSeg(root) {
  this._segLast = new Map();
  const reduced = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const keyOf = (bar) => {
    const b = bar.querySelector("button");
    return `${bar.closest("dialog")?.className || "page"}|${b ? b.dataset.set || b.dataset.dlg || b.dataset.prompt || b.dataset.mg || b.dataset.rt || (b.dataset.stRange ? `st-range-${b.dataset.stKind || ""}` : b.dataset.stTab ? "st-tab" : b.dataset.stBk ? "st-bk" : b.dataset.wzBk ? "wz-bk" : "") || "" : ""}|${b?.dataset.group || ""}`;
  };
  const apply = (pill, r) => {
    pill.style.width = `${r.w}px`;
    pill.style.height = `${r.h}px`;
    pill.style.transform = `translate(${r.x}px, ${r.y}px)`;
  };
  const instant = (pill, r) => {
    pill.style.transition = "none";
    apply(pill, r);
    void pill.offsetWidth;
    pill.style.transition = "";
  };
  const sync = (still = false) => {
    for (const bar of root.querySelectorAll(".mon-tabs, .sub-tabs")) {
      const on = bar.querySelector(".mon-tab.on, .sub-tab.on");
      // Leiste ohne Wahl (Magic Push: eigene Zeit getippt, keine Voreinstellung gilt): keine Kapsel stehen lassen
      if (!on && bar.offsetWidth) {
        bar.querySelector(":scope > .seg-pill")?.remove();
        this._segLast.delete(keyOf(bar));
      }
      if (!on || !bar.offsetWidth) continue; // unsichtbar (Fenster zu): Lage wird beim Öffnen gesetzt
      if (!bar._segSeen) {
        bar._segSeen = true;
        this._segRO.observe(bar);
      }
      bar._segW = bar.offsetWidth;
      const rect = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
      const key = keyOf(bar);
      const prev = this._segLast.get(key);
      let pill = bar.querySelector(":scope > .seg-pill");
      const fresh = !pill;
      if (fresh) {
        pill = document.createElement("i");
        pill.className = "seg-pill";
        pill.setAttribute("aria-hidden", "true");
        bar.appendChild(pill);
      }
      const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
      const moved = Boolean(prev) && !same(prev, rect);
      // Wird die Leiste mitten in der Fahrt noch einmal neu gezeichnet, startet die Kapsel wieder am ursprünglichen Ausgang.
      const now = Date.now();
      // Mitten in der Fahrt gezeichnet (zum Beispiel weil gleich nach dem Tipp Daten eintreffen): von der echten Lage der alten
      // Kapsel weiterfahren, nicht vom ursprünglichen Ausgang (das sah wie ein Sprung zurück aus).
      const flying = Boolean(prev?.live) && now - prev.t < 340;
      const from = flying ? prev.live : moved ? prev : null;
      const animate = Boolean(from) && !still && !reduced();
      if (!animate) instant(pill, rect);
      else if (fresh) {
        instant(pill, from);
        apply(pill, rect);
      } else apply(pill, rect);
      if (animate) {
        pill.classList.add("go");
        window.clearTimeout(pill._goT);
        pill._goT = window.setTimeout(() => pill.classList.remove("go"), 320);
      }
      const entry = { ...rect, live: null, t: moved ? now : prev?.t || 0 };
      this._segLast.set(key, entry);
      if (animate) {
        // Lage der Kapsel während der Fahrt mitschreiben (Bild für Bild), damit ein Neuzeichnen dort ansetzen kann
        const t0 = performance.now();
        const track = () => {
          if (this._segLast.get(key) !== entry || !pill.isConnected || performance.now() - t0 > 340) {
            if (this._segLast.get(key) === entry) entry.live = null;
            return;
          }
          const m = new DOMMatrixReadOnly(getComputedStyle(pill).transform);
          entry.live = { x: m.m41, y: m.m42, w: pill.offsetWidth, h: pill.offsetHeight };
          window.requestAnimationFrame(track);
        };
        window.requestAnimationFrame(track);
      }
    }
  };
  // Nur bei echter Breitenänderung (Fenster öffnet, Drehen); die erste Meldung beim Beobachten ist keine.
  this._segRO = new ResizeObserver((entries) => {
    // Entfernte (ersetzte) Leisten melden Breite 0: aus der Beobachtung nehmen und nicht beachten.
    for (const e of entries) if (!e.target.isConnected) this._segRO.unobserve(e.target);
    if (entries.some((e) => e.target.isConnected && e.target.offsetWidth > 0 && e.target.offsetWidth !== e.target._segW)) sync(true);
  });
  this._segMO = new MutationObserver((muts) => {
    if (muts.every((m) => m.target.classList?.contains("seg-pill") || [...m.addedNodes, ...m.removedNodes].every((n) => n.classList?.contains("seg-pill")))) return;
    sync();
  });
  this._segMO.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}
