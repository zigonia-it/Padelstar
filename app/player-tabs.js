// The player's TabBar (Padelstar 1.0 design system): I dag · Kamper · Tabell. The player view is one scrolling page,
// so a tab scrolls to its section and the active tab follows the scroll. It stays out of the way whenever the admin
// tab bar is showing (an admin looking at their own player view already has navigation).
(function (global) {
  "use strict";

  function initialize() {
    const nav = document.querySelector("#playerBottomTabs");
    if (!nav) return;
    const tabs = [...nav.querySelectorAll("[data-player-tab]")];
    const targetOf = (tab) => document.getElementById(tab.dataset.playerTab);

    function setActive(id) {
      tabs.forEach((tab) => {
        const active = tab.dataset.playerTab === id;
        tab.classList.toggle("is-active", active);
        if (active) tab.setAttribute("aria-current", "true");
        else tab.removeAttribute("aria-current");
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = targetOf(tab);
        if (!target) return;
        setActive(tab.dataset.playerTab);
        target.scrollIntoView({ behavior: global.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      });
    });

    // The section whose top has passed the upper third of the window is the current one.
    let frame = 0;
    function syncFromScroll() {
      frame = 0;
      const line = global.innerHeight / 3;
      let current = tabs[0]?.dataset.playerTab;
      tabs.forEach((tab) => {
        const target = targetOf(tab);
        if (target && target.offsetParent && target.getBoundingClientRect().top <= line) current = tab.dataset.playerTab;
      });
      if (current) setActive(current);
    }
    global.addEventListener("scroll", () => { if (!frame) frame = global.requestAnimationFrame(syncFromScroll); }, { passive: true });

    const adminTabs = document.querySelector("#workspaceBottomTabs");
    function syncVisibility() {
      nav.classList.toggle("hidden", Boolean(adminTabs) && !adminTabs.classList.contains("hidden"));
    }
    if (adminTabs && global.MutationObserver) new global.MutationObserver(syncVisibility).observe(adminTabs, { attributes: true, attributeFilter: ["class"] });
    syncVisibility();
  }

  global.PadelstarPlayerTabs = { initialize };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})(window);
