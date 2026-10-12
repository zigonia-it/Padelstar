window.PadelstarPlayerList = (() => {
  function create({
    accentStyle,
    appendEmptyText,
    avatarMarkup,
    document,
    elements,
    escapeAttribute,
    escapeHtml,
    getState,
    getAllMatches,
    leaderboardEntries,
    joinRemoteTournament,
    playerStatusLabel,
    render,
    removePlayer,
    replacePlayer,
    restorePlayer,
    withdrawPlayer,
    reinstatePlayer,
    requestConfirmation,
    saveState,
    setLocalRole,
    showWorkspace,
    getSupabaseClient,
    t,
    updatePlayer,
  }) {
    function renderPlayers() {
      const state = getState();
      const standings = leaderboardEntries(getAllMatches());
      const lobbyLocked = state.rounds.length > 0;
      elements.playersList.innerHTML = "";
      if (state.players.length === 0) {
        const item = document.createElement("li");
        item.className = "empty-list-item";
        item.innerHTML = `<span>${t("tournament.noPlayers", { code: state.inviteCode })}</span>`;
        elements.playersList.append(item);
        return;
      }
      const statusRank = playerStatusRanks(state);
      sortedByStatus(state.players, statusRank).forEach((player) => {
        const entry = standings.find((item) => item.player.id === player.id);
        const replacedBy = player.replacedBy ? state.players.find((item) => item.id === player.replacedBy) : null;
        const replaces = player.replacedPlayerId ? state.players.find((item) => item.id === player.replacedPlayerId) : null;
        const isActive = player.active !== false;
        const isWithdrawn = Boolean(player.withdrawn) && !player.replacedBy;
        const canRestore = lobbyLocked && replaces && replaces.replacedBy === player.id && isActive;
        const item = document.createElement("li");
        item.className = lobbyLocked ? "" : "editable-player";
        item.setAttribute("style", accentStyle(player.accent));
        item.innerHTML = `
      <span class="player-list-name">
        ${avatarMarkup(player, "avatar", 34)}
        <span class="player-name-badge">${escapeHtml(player.name)}</span>
        <small class="join-source-chip">${playerStatusLabel(player)}</small>
        ${statusRank.get(player.id) === 1 ? `<small class="join-source-chip next-match-chip">${t("matches.nextUp")}</small>` : ""}
        ${replacedBy ? `<small class="join-source-chip replacement-chip">${t("players.replacedBy", { name: escapeHtml(replacedBy.name) })}</small>` : ""}
        ${replaces && isActive ? `<small class="join-source-chip replacement-chip">${t("players.replaces", { name: escapeHtml(replaces.name) })}</small>` : ""}
        ${isWithdrawn ? `<small class="join-source-chip withdrawn-chip">${t("players.withdrawn")}</small>` : ""}
      </span>
      <span class="player-actions">
        <strong>${t("standings.pointsShort", { points: entry?.points ?? 0 })}</strong>
        ${lobbyLocked && (isActive || isWithdrawn) ? `<button class="icon-button replace-player-button" type="button">${t("actions.replacePlayer")}</button>` : ""}
        ${lobbyLocked && isActive ? `<button class="icon-button withdraw-player-button" type="button">${t("actions.withdrawPlayer")}</button>` : ""}
        ${isWithdrawn ? `<button class="icon-button reinstate-player-button" type="button">${t("actions.reinstatePlayer")}</button>` : ""}
        ${canRestore ? `<button class="icon-button restore-player-button" type="button">${t("actions.restorePlayer", { name: escapeHtml(replaces.name) })}</button>` : ""}
        <button class="icon-button danger-button" type="button" aria-label="${t("actions.removePlayerAria", { name: escapeHtml(player.name) })}" ${lobbyLocked ? "disabled" : ""}>${t("actions.remove")}</button>
      </span>`;
        if (!lobbyLocked) {
          const editor = document.createElement("form");
          editor.className = "player-edit-grid";
          editor.innerHTML = `
        <input name="playerName" type="text" value="${escapeAttribute(player.name)}" aria-label="${t("actions.editPlayerNameAria", { name: escapeAttribute(player.name) })}" required>
        <button class="secondary icon-button" type="submit">${t("actions.save")}</button>`;
          editor.addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            updatePlayer(player.id, { name: formData.get("playerName").trim() });
          });
          item.append(editor);
        }
        item.querySelector(".danger-button").addEventListener("click", () => removePlayer(player.id));
        item.querySelector(".replace-player-button")?.addEventListener("click", async () => {
          const replacementName = globalThis.prompt(t("messages.replacePlayerPrompt", { name: player.name }));
          if (!replacementName) return;
          const result = replacePlayer(player.id, replacementName);
          // A match in progress is restarted from 0-0: warn first and only continue when the admin confirms.
          if (result?.needsConfirmation && await requestConfirmation(t("messages.replaceRestartConfirm", { name: player.name }))) {
            replacePlayer(player.id, replacementName, { confirmed: true });
          }
        });
        item.querySelector(".withdraw-player-button")?.addEventListener("click", async () => {
          const result = withdrawPlayer(player.id);
          if (!result?.needsConfirmation) return;
          const effects = [t("messages.withdrawConfirm", { name: player.name })];
          if (result.plan.restart.length) effects.push(t("messages.withdrawConfirmRestart"));
          if (result.plan.walkover.length) effects.push(t("messages.withdrawConfirmWalkover", { count: result.plan.walkover.length, name: player.name }));
          if (result.plan.cancel.length) effects.push(t("messages.withdrawConfirmCancel", { count: result.plan.cancel.length }));
          if (await requestConfirmation(effects.join("\n\n"))) withdrawPlayer(player.id, { confirmed: true });
        });
        item.querySelector(".reinstate-player-button")?.addEventListener("click", () => reinstatePlayer(player.id));
        item.querySelector(".restore-player-button")?.addEventListener("click", async () => {
          const result = restorePlayer(player.id);
          if (result?.needsConfirmation && await requestConfirmation(t("messages.replaceRestartConfirm", { name: player.name }))) {
            restorePlayer(player.id, { confirmed: true });
          }
        });
        elements.playersList.append(item);
      });
    }

    // Spillere (4.3): players in a match now come first, then the ones up next on a court, then the rest in their
    // usual order; withdrawn and replaced players go last. Ranks: 0 playing, 1 next up, 2 later, 3 idle, 4 out.
    function playerStatusRanks(state) {
      const matches = getAllMatches();
      const includes = (match, playerId) => [match.teamOne, match.teamTwo].some((team) => team?.players?.some((item) => item.id === playerId));
      const waiting = matches
        .filter((match) => match.state === "waiting")
        .sort((first, second) => (first.queuePosition ?? Number.MAX_SAFE_INTEGER) - (second.queuePosition ?? Number.MAX_SAFE_INTEGER));
      const nextUp = waiting.slice(0, Math.max(state.courts?.length ?? 1, 1));
      const ranks = new Map();
      state.players.forEach((player) => {
        let rank = 3;
        if (player.active === false || (player.withdrawn && !player.replacedBy) || player.replacedBy) rank = 4;
        else if (matches.some((match) => ["playing", "awaitingApproval"].includes(match.state) && includes(match, player.id))) rank = 0;
        else if (nextUp.some((match) => includes(match, player.id))) rank = 1;
        else if (waiting.some((match) => includes(match, player.id))) rank = 2;
        ranks.set(player.id, rank);
      });
      return ranks;
    }

    function sortedByStatus(players, ranks) {
      return players
        .map((player, index) => ({ player, index }))
        .sort((first, second) => (ranks.get(first.player.id) - ranks.get(second.player.id)) || (first.index - second.index))
        .map((item) => item.player);
    }

    function renderExistingPlayerList() {
      const state = getState();
      if (!elements.existingPlayerList || elements.existingPlayerList.classList.contains("hidden")) return;
      elements.existingPlayerList.innerHTML = "";
      if (state.players.length === 0) {
        appendEmptyText(elements.existingPlayerList, t("players.noneAddedYet"));
        return;
      }
      state.players.forEach((player) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "existing-player-button";
        button.setAttribute("style", accentStyle(player.accent));
        button.innerHTML = `${avatarMarkup(player, "avatar", 30)}<span>${escapeHtml(player.name)}</span>`;
        button.addEventListener("click", async () => {
          if (getSupabaseClient()) {
            const joined = await joinRemoteTournament(player.name, player.avatarId);
            if (!joined) return;
          } else {
            state.selectedPlayerId = player.id;
          }
          setLocalRole("player");
          saveState({ remote: false });
          showWorkspace("player");
          render();
        });
        elements.existingPlayerList.append(button);
      });
    }

    return { renderExistingPlayerList, renderPlayers };
  }

  return { create };
})();
