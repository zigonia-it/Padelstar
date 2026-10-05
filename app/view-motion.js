// Panels fly out and in when a person moves between pages (docs/technical/motion.md, "Screen and tab changes").
// navigate(update) wraps a navigation the person started. With the View Transitions API each visible card gets its
// own transition name: cards only on the old page fly out, cards only on the new page fly in one after another, and a
// card on both pages glides to its new place. Without the API the new cards still fly in. Reduced motion, and the
// test mode, run the update with no motion at all. The update itself is never skipped.
window.PadelstarViewMotion = (() => {
  const BOX_SELECTOR = ".panel, .setup-card, .next-match, .ps-card, .landing-feature-card, .player-identity-card";
  const MAX_BOXES = 10;
  const STAGGER_MS = 40;
  // new cards start once the old ones are mostly gone (--motion-quick is 140ms), so the two never pile up
  const ARRIVAL_DELAY_MS = 90;
  const ids = new WeakMap();
  let nextId = 0;
  let running = null;
  let delayStyle = null;

  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  // The outermost visible cards of the visible pages that reach into the window: the ones a person can see move.
  function visibleBoxes() {
    const boxes = [];
    document.querySelectorAll(".app-module:not(.hidden)").forEach((module) => {
      module.querySelectorAll(BOX_SELECTOR).forEach((box) => {
        if (boxes.length >= MAX_BOXES) return;
        if (boxes.some((outer) => outer.contains(box))) return;
        const rect = box.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) return;
        boxes.push(box);
      });
    });
    return boxes;
  }

  function nameOf(box) {
    if (!ids.has(box)) ids.set(box, `ps-box-${(nextId += 1)}`);
    return ids.get(box);
  }

  function name(boxes) {
    boxes.forEach((box) => { box.style.viewTransitionName = nameOf(box); box.style.viewTransitionClass = "ps-box"; });
  }

  function unname(boxes) {
    boxes.forEach((box) => { box.style.removeProperty("view-transition-name"); box.style.removeProperty("view-transition-class"); });
  }

  // Cards that arrive come in one after another; the delay has to sit on each named pseudo-element.
  function staggerArrivals(arrivals) {
    delayStyle?.remove();
    delayStyle = document.createElement("style");
    delayStyle.textContent = arrivals
      .map((box, index) => `html::view-transition-new(${nameOf(box)}):only-child { animation-delay: ${ARRIVAL_DELAY_MS + Math.min(index, 4) * STAGGER_MS}ms; }`)
      .join("\n");
    document.head.append(delayStyle);
  }

  // Fallback without the API: the new cards fly in (CSS .motion-enter), no fly-out.
  function enter(boxes) {
    boxes.forEach((box, index) => {
      box.style.setProperty("--enter-index", String(index));
      box.classList.remove("motion-enter");
      box.classList.add("motion-enter");
      box.addEventListener("animationend", () => box.classList.remove("motion-enter"), { once: true });
    });
  }

  function navigate(update) {
    if (window.PADELSTAR_TEST_MODE || reducedMotion()) {
      update();
      return;
    }
    if (typeof document.startViewTransition !== "function" || !window.CSS?.supports?.("view-transition-class: a")) {
      const before = new Set(visibleBoxes());
      update();
      enter(visibleBoxes().filter((box) => !before.has(box)));
      return;
    }
    running?.skipTransition?.();
    // the top bar and the tab bars get their own layer while this runs (styles/motion.css), so cards pass under them
    document.documentElement.classList.add("view-motion-running");
    const before = visibleBoxes();
    name(before);
    let after = [];
    const transition = document.startViewTransition(() => {
      unname(before);
      update();
      after = visibleBoxes();
      name(after);
      staggerArrivals(after.filter((box) => !before.includes(box)));
    });
    running = transition;
    transition.finished.finally(() => {
      unname(before);
      unname(after);
      if (running === transition) {
        running = null;
        document.documentElement.classList.remove("view-motion-running");
        delayStyle?.remove();
        delayStyle = null;
      }
    });
  }

  return { navigate };
})();
