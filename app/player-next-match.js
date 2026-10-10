window.PadelstarPlayerNextMatch = (() => {
  function create({
    accentStyle,
    approvalPanelMarkup,
    bindApprovalPanel,
    withdrawalPanelMarkup,
    bindWithdrawalPanel,
    timerMarkup,
    clockStartMarkup,
    bindClockStart,
    bindScoreboardTable,
    elements,
    escapeHtml,
    getActiveRound,
    getPlayerById,
    getState,
    matchContextText,
    notifyPlayerMatch,
    openLargeScore,
    playerPlacement,
    playerTournamentState,
    scoreSummary,
    scoreboardTableMarkup,
    t,
  }) {
    // A finished match that still waits for approval is no longer "my match", so it is shown above it.
    function renderApprovalNotices(matches) {
      const state = getState();
      const playerId = state.selectedPlayerId;
      elements.playerNextMatch.querySelectorAll(".player-approval-notice").forEach((node) => node.remove());
      if (!playerId || state.status === "Avsluttet") return;
      const awaiting = matches.filter((match) => match.state === "awaitingApproval"
        && [...match.teamOne.players, ...match.teamTwo.players].some((player) => player.id === playerId));
      awaiting.reverse().forEach((match) => {
        const notice = document.createElement("section");
        notice.className = "player-approval-notice";
        notice.innerHTML = `<p class="eyebrow">${t("result.needsAttention")}</p><h3>${escapeHtml(match.courtName ?? "")}</h3>${approvalPanelMarkup(match, true, true)}`;
        elements.playerNextMatch.prepend(notice);
        bindApprovalPanel(notice, match);
      });
    }

    // A teammate who withdrew is not "my match" either: the remaining player decides here (play alone / walkover).
    function renderWithdrawalNotices(matches) {
      const state = getState();
      const playerId = state.selectedPlayerId;
      elements.playerNextMatch.querySelectorAll(".player-withdrawal-notice").forEach((node) => node.remove());
      if (!playerId || state.status === "Avsluttet") return;
      matches.filter((match) => match.state === "awaitingWithdrawalDecision" && match.withdrawal?.status === "pending" && match.withdrawal.teammateId === playerId)
        .reverse()
        .forEach((match) => {
          const notice = document.createElement("section");
          notice.className = "player-withdrawal-notice";
          notice.innerHTML = `<p class="eyebrow">${t("withdrawal.needsAttention")}</p><h3>${escapeHtml(matchContextText(match))}</h3>${withdrawalPanelMarkup(match, true, true)}`;
          elements.playerNextMatch.prepend(notice);
          bindWithdrawalPanel(notice, match);
        });
    }

    function renderPlayerNextMatch(matches) {
      renderPlayerNextMatchCore(matches);
      renderApprovalNotices(matches);
      renderWithdrawalNotices(matches);
    }

    function renderPlayerNextMatchCore(matches) {
      const state = getState();
      const player = getPlayerById(state.selectedPlayerId);
      if (!player) {
        elements.playerNextMatch.removeAttribute("style");
        elements.playerNextMatch.innerHTML = `
      <p class="eyebrow">${t("player.nextMatch")}</p>
      <h3>${t("player.chooseProfile")}</h3>
      <p>${t("player.chooseProfileHint")}</p>
      <div class="button-row player-empty-actions">
        <button class="secondary" type="button" data-player-action="spectate">${t("actions.viewAsSpectator")}</button>
        <button class="secondary" type="button" data-player-action="choose">${t("actions.choosePlayer")}</button>
        <button class="ghost" type="button" data-player-action="rejoin">${t("actions.joinAgain")}</button>
      </div>`;
        return;
      }

      if (state.status === "Avsluttet") {
        const placement = playerPlacement(player, matches);
        elements.playerNextMatch.setAttribute("style", accentStyle(player.accent));
        elements.playerNextMatch.innerHTML = `
      <p class="eyebrow">${t("player.tournamentFinished")}</p>
      <h3>${placement ? t("player.finishedWithPlacement", { name: escapeHtml(player.name), placement }) : t("player.finishedWithoutPlacement", { name: escapeHtml(player.name) })}</h3>
      <p>${t("player.checkFinalStandings")}</p>`;
        return;
      }

      if (player.withdrawn && !player.replacedBy) {
        elements.playerNextMatch.setAttribute("style", accentStyle(player.accent));
        elements.playerNextMatch.innerHTML = `
      <p class="eyebrow">${t("players.withdrawn")}</p>
      <h3>${escapeHtml(player.name)}</h3>
      <p>${t("withdrawal.youWithdrew")}</p>`;
        return;
      }

      const playerState = playerTournamentState(player, matches);
      elements.playerNextMatch.setAttribute("style", accentStyle(player.accent));

      if (playerState.kind === "resting") {
        const activeRound = getActiveRound();
        elements.playerNextMatch.innerHTML = `
      <p class="eyebrow">${t("player.restingThisRound")}</p>
      <h3>${t("player.restingTitle", { name: escapeHtml(player.name) })}</h3>
      <div class="player-now-grid">
        <div><span>${t("common.round")}</span><strong>${activeRound?.roundNumber ?? "-"}</strong></div>
        <div><span>${t("common.status")}</span><strong>${t("common.resting")}</strong></div>
      </div>
      <p>${t("player.restingHint")}</p>`;
        return;
      }

      if (!playerState.match) {
        elements.playerNextMatch.innerHTML = `
      <p class="eyebrow">${t("common.waiting")}</p>
      <h3>${t("player.waitingTitle", { name: escapeHtml(player.name) })}</h3>
      <div class="player-now-grid">
        <div><span>${t("common.status")}</span><strong>${t("common.waiting")}</strong></div>
        <div><span>${t("common.round")}</span><strong>${Math.max(state.currentRound, 1)}</strong></div>
      </div>
      <p>${t("player.waitingHint")}</p>`;
        return;
      }

      const match = playerState.match;
      notifyPlayerMatch(match, playerState.kind);
      const isTeamOne = match.teamOne.players.some((item) => item.id === player.id);
      const ownTeam = isTeamOne ? match.teamOne : match.teamTwo;
      const opponents = isTeamOne ? match.teamTwo : match.teamOne;
      const teammate = ownTeam.players.find((item) => item.id !== player.id);
      const ownNames = ownTeam.players.map((item) => escapeHtml(item.name)).join(" & ");
      const opponentNames = opponents.players.map((opponent) => escapeHtml(opponent.name)).join(" & ");
      const matchesAhead = playerState.kind === "waiting" && !match.courtName
        ? matches.filter((otherMatch) => otherMatch.state === "waiting" && (otherMatch.queuePosition ?? 0) < (match.queuePosition ?? 0)).length
        : 0;
      const isPlaying = playerState.kind === "playing";
      const courtText = escapeHtml(match.courtName ?? t("tournament.courtComing"));
      // The NextMatch hero (design system): own team first, the current set big, one ball action that opens the scorepad.
      const ownKey = isTeamOne ? "teamOne" : "teamTwo";
      const opponentKey = isTeamOne ? "teamTwo" : "teamOne";
      const ownScore = match.currentSet?.[ownKey] ?? 0;
      const opponentScore = match.currentSet?.[opponentKey] ?? 0;

      elements.playerNextMatch.innerHTML = `
    <div class="next-match-head">
      <p class="eyebrow">${isPlaying ? t("player.yourMatch") : t("player.nextMatch")} · ${courtText}</p>
      <span class="ps-tag ps-tag--ball">${isPlaying ? `<span class="next-match-live-dot" aria-hidden="true"></span>${t("common.live")}` : t("common.waiting")}</span>
    </div>
    ${matchesAhead > 0 ? `<p class="hint">${t("player.matchesAhead", { count: matchesAhead })}</p>` : ""}
    <div class="next-match-teams">
      <span class="next-match-team">${ownNames}</span>
      ${isPlaying
        ? `<span class="next-match-score" aria-label="${ownScore}–${opponentScore}">${ownScore}<span aria-hidden="true">:</span>${opponentScore}</span>`
        : `<span class="next-match-vs">${t("tv.versus")}</span>`}
      <span class="next-match-team next-match-team-opponents">${opponentNames}</span>
    </div>
    ${isPlaying ? `<button class="ps-btn ps-btn--ball ps-btn--lg ps-btn--block next-match-keep-score" type="button">${t("actions.keepScore")}</button>` : ""}
    ${isPlaying ? `<p class="hint">${timerMarkup(match)}</p>${clockStartMarkup?.(match) ?? ""}` : ""}
    ${isPlaying ? scoreboardTableMarkup(match, true) : `
    <div class="player-now-grid">
      <div><span>${t("common.court")}</span><strong>${courtText}</strong></div>
      <div><span>${t("player.teammate")}</span><strong>${teammate ? escapeHtml(teammate.name) : t("common.single")}</strong></div>
    </div>`}
    <div class="next-match-summary">
      <span>${escapeHtml(matchContextText(match))}</span>
      <span>${scoreSummary(match)}</span>
    </div>`;

      elements.playerNextMatch.querySelector(".next-match-keep-score")?.addEventListener("click", () => openLargeScore?.(match.id));
      if (isPlaying) bindScoreboardTable(elements.playerNextMatch, match, true);
      if (isPlaying) bindClockStart?.(elements.playerNextMatch, match);
    }

    return { renderPlayerNextMatch };
  }

  return { create };
})();
