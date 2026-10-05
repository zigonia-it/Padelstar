// The highlight behind the current page in every menu slides to the page a person picks (docs/technical/motion.md).
// One indicator element per menu is drawn under the items; it follows whichever item the navigation code marks
// active (class or aria-current), so it never holds navigation state of its own. Colours come from CSS per menu.
window.PadelstarNavIndicator = (() => {
  const MENUS = [
    { menu: "#appMenu", active: ".module-link.active:not(.hidden), .module-link[aria-current=\"page\"]:not(.hidden)" },
    { menu: "#workspaceRail", active: ".workspace-rail-item.is-active:not(.hidden)" },
    { menu: ".workspace-bottom-tabs", active: ".workspace-rail-item.is-active:not(.hidden)" },
    { menu: "#playerBottomTabs", active: ".workspace-rail-item.is-active:not(.hidden)" },
  ];

  function track(menu, activeSelector) {
    if (!menu || menu.querySelector(":scope > .nav-indicator")) return;
    const indicator = document.createElement("span");
    indicator.className = "nav-indicator";
    indicator.setAttribute("aria-hidden", "true");
    menu.prepend(indicator);
    menu.classList.add("has-nav-indicator");

    let frame = 0;
    let shown = false;
    function place() {
      frame = 0;
      const item = menu.querySelector(activeSelector);
      const visible = menu.offsetWidth > 0 && item && item.offsetWidth > 0;
      if (!visible) {
        indicator.classList.remove("is-visible");
        shown = false;
        return;
      }
      // The first placement after the menu appears jumps; every later one slides.
      indicator.classList.toggle("is-sliding", shown);
      indicator.style.setProperty("--nav-x", `${item.offsetLeft}px`);
      indicator.style.setProperty("--nav-y", `${item.offsetTop}px`);
      indicator.style.setProperty("--nav-w", `${item.offsetWidth}px`);
      indicator.style.setProperty("--nav-h", `${item.offsetHeight}px`);
      indicator.classList.add("is-visible");
      shown = true;
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(place); };

    // The indicator's own class changes are not a reason to measure again.
    new MutationObserver((records) => { if (records.some((record) => record.target !== indicator)) schedule(); }).observe(menu, { subtree: true, attributes: true, attributeFilter: ["class", "aria-current", "hidden"] });
    if (typeof ResizeObserver === "function") new ResizeObserver(schedule).observe(menu);
    window.addEventListener("resize", schedule);
    document.fonts?.ready?.then(schedule);
    schedule();
  }

  function initialize() {
    MENUS.forEach(({ menu, active }) => document.querySelectorAll(menu).forEach((element) => track(element, active)));
  }

  return { initialize };
})();
