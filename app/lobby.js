window.PadelstarLobby = (() => {
  function create({ activateAdminPanel = () => {}, elements, escapeHtml, generateFullTournamentSchedule, generateRoundBlockReason, getState, removePlayer, render, saveState, showToast, showWorkspace, t }) {
    function sourceLabel(player) {
      return player.joinedFrom === "admin-self"
        ? t("player.adminPlays")
        : player.joinedFrom === "self" ? t("player.registeredSelf") : t("player.addedByAdmin");
    }

    // Removing works exactly as in Spillere (same function, same rule: not after the schedule has started, so the
    // button is left out then; replacing and withdrawing live in the Spillere tab).
    function playerRowMarkup(player, locked) {
      return `
    <li>
      <span class="player-list-name">${escapeHtml(player.name)}</span>
      <span class="join-source-chip">${sourceLabel(player)}</span>
      ${locked ? "" : `<button class="icon-button danger-button" type="button" data-remove-player="${escapeHtml(player.id)}" aria-label="${escapeHtml(t("actions.removePlayerAria", { name: player.name }))}">${escapeHtml(t("actions.remove"))}</button>`}
    </li>`;
    }

    function renderLobby() {
      if (!elements.lobbyView) return;
      const state = getState();
      elements.lobbyReadiness.textContent = t("tournament.playersReady", { players: state.players.length, courts: state.courts.length });
      elements.lobbyPlayersList.innerHTML = state.players.length
        ? state.players.map((player) => playerRowMarkup(player, state.rounds.length > 0)).join("")
        : `<li class="empty-list-item">${t("tournament.noPlayers", { code: state.inviteCode })}</li>`;
      // The lobby stays the first menu item after the start (share, players, rules, court queue); the
      // "fill the list" headline, the start button and the add form only apply before it, the live overview only after.
      const started = state.rounds.length > 0 || state.status === "Avsluttet";
      elements.lobbyView.querySelector(".lobby-header")?.classList.toggle("hidden", started);
      elements.adminLiveOverview?.classList.toggle("hidden", !started);
      elements.lobbyStartButton?.closest(".lobby-actions")?.classList.toggle("hidden", started);
      if (elements.lobbyStartButton) elements.lobbyStartButton.disabled = Boolean(generateRoundBlockReason());
      elements.lobbyAddPlayerForm?.classList.toggle("hidden", started);
    }

    function startFromLobby() {
      const blockReason = generateRoundBlockReason();
      if (blockReason) {
        showToast(blockReason, "status-message-error");
        return;
      }
      generateFullTournamentSchedule();
      saveState();
      showWorkspace();
      activateAdminPanel("matches");
      render();
    }

    elements.lobbyPlayersList?.addEventListener?.("click", (event) => {
      const button = event.target.closest?.("[data-remove-player]");
      if (button && !button.disabled) removePlayer(button.dataset.removePlayer);
    });

    return { renderLobby, startFromLobby };
  }

  return { create };
})();
