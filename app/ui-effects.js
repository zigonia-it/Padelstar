window.PadelstarUiEffects = (() => {
  function focusModuleHeading(section) {
    const heading = section?.querySelector("h1, h2");
    if (!heading || typeof heading.focus !== "function") return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  // the card's own wash (its ::after); reduced motion swaps the win sweep for the plain wash
  const WASH_ANIMATIONS = new Set(["ps-wash-out", "ps-win-sweep"]);

  // A point gets a short ball wash on the match's cards; the point that wins the match gets the win moment instead
  // (styles/motion.css). Each class comes off when its own animation ends, not when a child's tick ends.
  function flashMatchCards(matchId, { won = false } = {}) {
    if (typeof document === "undefined") return;
    const escapedMatchId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(matchId)
      : String(matchId).replace(/"/g, '\\"');
    const className = won ? "match-won" : "score-flash";
    // The cards were just re-rendered, so the class goes on in the next frame instead of forcing a layout
    // (reading offsetWidth here cost a full reflow on every point).
    const cards = document.querySelectorAll(`[data-match-id="${escapedMatchId}"]`);
    cards.forEach((card) => card.classList.remove("score-flash", "match-won"));
    window.requestAnimationFrame(() => {
      cards.forEach((card) => {
        card.classList.add(className);
        const done = (event) => {
          if (!WASH_ANIMATIONS.has(event.animationName)) return;
          card.classList.remove(className);
          card.removeEventListener("animationend", done);
        };
        card.addEventListener("animationend", done);
      });
    });
  }

  return { focusModuleHeading, flashMatchCards };
})();
