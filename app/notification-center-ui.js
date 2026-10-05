// The bell in the header and the notification center dialog (Phase 18). The pure logic (what is news, the store) is in
// notification-center.js; this file connects it to the page and to the remote state updates. Padelstar plays no sounds
// of its own (developer's decision 2026-10-05): the browser's own notifications carry the sound, so nothing doubles up.
(function (global) {
  function create({ document, storage, getState, isSpectator = () => false, t, showToast, showModule, vibrate, now }) {
    const lib = global.PadelstarNotificationCenter;
    const store = lib.createStore({ storage, now });
    const bell = document.querySelector("#notificationBellButton");
    const badge = document.querySelector("#notificationBellBadge");
    const dialog = document.querySelector("#notificationCenterDialog");
    const list = document.querySelector("#notificationCenterList");
    const markAll = document.querySelector("#notificationMarkAllRead");
    const closeButton = document.querySelector("#notificationCenterClose");
    const buzz = vibrate ?? ((number) => lib.vibrate(number));
    const settings = {
      vibration: document.querySelector("#notificationSettingsVibration"),
      hint: document.querySelector("#notificationSettingsVibrationHint"),
    };

    const playerId = () => getState().selectedPlayerId ?? null;
    const tournamentId = () => getState().id ?? null;
    const active = () => Boolean(playerId() && tournamentId() && !isSpectator());

    function text(item) {
      const values = item.values ?? {};
      return { title: t(`notifications.center.${item.kind}.title`, values), body: t(`notifications.center.${item.kind}.body`, values) };
    }

    function timeText(at) {
      const date = new Date(at);
      return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }

    function render() {
      if (!bell) return;
      const on = active();
      bell.classList.toggle("hidden", !on);
      const unread = on ? store.unreadCount(tournamentId(), playerId()) : 0;
      if (badge) {
        badge.textContent = unread > 9 ? "9+" : String(unread);
        badge.classList.toggle("hidden", unread === 0);
      }
      bell.setAttribute("aria-label", unread ? t("notifications.center.openUnread", { count: unread }) : t("notifications.center.open"));
      if (dialog?.open) renderList();
    }

    function renderList() {
      if (!list) return;
      const items = active() ? store.list(tournamentId(), playerId()) : [];
      list.innerHTML = "";
      if (!items.length) {
        const empty = document.createElement("li");
        empty.className = "notification-empty";
        empty.textContent = t("notifications.center.empty");
        list.append(empty);
      }
      for (const item of items) {
        const { title, body } = text(item);
        const row = document.createElement("li");
        row.className = `notification-item${item.read ? "" : " is-unread"}`;
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.notificationId = item.id;
        const heading = document.createElement("strong");
        heading.textContent = title;
        const detail = document.createElement("span");
        detail.textContent = body;
        const when = document.createElement("small");
        when.textContent = timeText(item.at);
        button.append(heading, detail, when);
        button.addEventListener("click", () => {
          store.markRead(item.id);
          render();
          if (item.matchId) { dialog.close?.(); showModule?.("player"); }
        });
        row.append(button);
        list.append(row);
      }
      if (markAll) markAll.disabled = !items.some((item) => !item.read);
    }

    function open() {
      if (!dialog || !active()) return;
      renderList();
      if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    }

    // Called for every remote state that is applied. Never throws: a notification problem must not break syncing.
    function handleStateChange(previous, next) {
      try {
        const id = next?.selectedPlayerId ?? null;
        if (!id || isSpectator()) return [];
        const updates = lib.detect(previous, next, id);
        const fresh = store.add(next.id, id, updates);
        if (fresh.length) {
          const pattern = lib.vibrationFor(fresh);
          if (pattern && lib.vibrationEnabled(storage)) buzz(pattern);
          showToast?.(text(fresh[0]).title, "status-message-success");
        }
        return fresh;
      } catch { return []; }
    }

    // The vibration switch on the profile page.
    function syncSettings() {
      if (settings.vibration) {
        const supported = lib.vibrationSupported();
        settings.vibration.checked = supported && lib.vibrationEnabled(storage);
        settings.vibration.disabled = !supported;
        settings.hint?.classList.toggle("hidden", supported);
      }
    }

    function bindSettings() {
      settings.vibration?.addEventListener("change", () => { lib.setVibrationEnabled(storage, settings.vibration.checked); syncSettings(); });
      syncSettings();
    }

    function bind() {
      bell?.addEventListener("click", open);
      closeButton?.addEventListener("click", () => dialog?.close?.());
      dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
      markAll?.addEventListener("click", () => { store.markAllRead(tournamentId(), playerId()); render(); renderList(); });
      bindSettings();
      if (active()) store.prune(tournamentId(), playerId());
      render();
    }

    return { bind, render, open, handleStateChange, syncSettings, store };
  }

  global.PadelstarNotificationCenterUi = { create };
})(window);
