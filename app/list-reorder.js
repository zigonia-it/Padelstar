// Standings rows slide to their new places when a result changes the order (docs/technical/motion.md, "Standings
// reorder"). FLIP: measure each row before the list is rebuilt, rebuild it, then play each moved row from its old
// place to its new one. Rows are matched by a stable key (the player id), never by position. A row that climbed gets
// a short ball wash, and a points value that changed ticks once. Used by the app (app/standings.js) and the TV board
// (app/tv-mode.js). Nothing moves on the first paint of a list, when the list is hidden, or in the test mode; with
// reduced motion the rows jump, but the wash and the new numbers still show the change.
window.PadelstarListReorder = (() => {
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  function token(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function durationMs(name, fallback) {
    const value = token(name, "");
    const ms = value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
    return Number.isFinite(ms) ? ms : fallback;
  }

  // key -> { top, points } for every keyed row that is on screen
  function measure(container, pointsSelector) {
    const rows = new Map();
    if (!container || window.PADELSTAR_TEST_MODE) return rows;
    container.querySelectorAll(":scope > [data-reorder-key]").forEach((row) => {
      const rect = row.getBoundingClientRect();
      if (rect.height === 0) return;
      rows.set(row.dataset.reorderKey, { top: rect.top, points: pointsSelector ? row.querySelector(pointsSelector)?.textContent : null });
    });
    return rows;
  }

  function play(container, before, pointsSelector) {
    if (!container || !before || before.size === 0) return;
    const animateMoves = !reducedMotion() && typeof Element.prototype.animate === "function";
    const duration = durationMs("--motion-slow", 360);
    const easing = token("--ease-standard", "ease");
    container.querySelectorAll(":scope > [data-reorder-key]").forEach((row) => {
      const old = before.get(row.dataset.reorderKey);
      if (!old) return;
      const rect = row.getBoundingClientRect();
      if (rect.height === 0) return;
      const shift = old.top - rect.top;
      if (Math.abs(shift) > 1) {
        if (animateMoves) row.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], { duration, easing });
        if (shift > 0) mark(row, "is-climbing");
      }
      if (pointsSelector && old.points != null) {
        const points = row.querySelector(pointsSelector);
        if (points && points.textContent !== old.points) mark(points, "is-ticking");
      }
    });
  }

  // the class comes off when its own animation ends (a child's tick bubbling up does not count)
  function mark(element, className) {
    element.classList.add(className);
    const done = (event) => {
      if (event.target !== element) return;
      element.classList.remove(className);
      element.removeEventListener("animationend", done);
    };
    element.addEventListener("animationend", done);
  }

  // measure, rebuild with update(), then play
  function rebuild(container, update, { pointsSelector } = {}) {
    const before = measure(container, pointsSelector);
    update();
    play(container, before, pointsSelector);
  }

  return { rebuild };
})();
