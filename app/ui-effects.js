window.PadelstarUiEffects = (() => {
  function focusModuleHeading(section) {
    const heading = section?.querySelector("h1, h2");
    if (!heading || typeof heading.focus !== "function") return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  function flashMatchCards(matchId) {
    if (typeof document === "undefined") return;
    const escapedMatchId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(matchId)
      : String(matchId).replace(/"/g, '\\"');
    // The cards were just re-rendered, so the class goes on in the next frame instead of forcing a layout
    // (reading offsetWidth here cost a full reflow on every point).
    const cards = document.querySelectorAll(`[data-match-id="${escapedMatchId}"]`);
    cards.forEach((card) => card.classList.remove("score-flash"));
    window.requestAnimationFrame(() => {
      cards.forEach((card) => {
        card.classList.add("score-flash");
        card.addEventListener("animationend", () => card.classList.remove("score-flash"), { once: true });
      });
    });
  }

  return { focusModuleHeading, flashMatchCards };
})();
