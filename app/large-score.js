window.PadelstarLargeScore = (() => {
  // The serving player is marked with the Padelstar ball (League v2.0 scope §12: the project asset, not an emoji).
  const SERVE_BALL_SRC = "assets/brand/padelstar-ball-128.png";

  function create({ awardTennisPoint, undoLastPoint, closeLargeScore, elements, escapeHtml, getMatchById, getState, gameScoreText, matchContextText, setScoreText, startingTeamText, teamAccentStyle, teamDisplay, tennisPointLabel, timerMarkup, t }) {
    function serveBall() {
      return `<img class="serve-ball" src="${SERVE_BALL_SRC}" alt="" width="20" height="20" decoding="async">`;
    }

    // "[ball] Anna · right"; falls back to the serving team when the player is unknown (older or odd-sized teams)
    function serverCellMarkup(match, server) {
      if (!server?.player) return escapeHtml(startingTeamText(match));
      const side = t(server.side === "left" ? "score.serveLeft" : "score.serveRight");
      return `<span class="serve-indicator">${serveBall()}<span class="serve-name">${escapeHtml(server.player.name)}</span><span class="serve-side">${escapeHtml(side)}</span></span>`;
    }

    // The ball also sits on the serving player's name on their team's pad.
    function markServingPlayer(server) {
      if (!server?.player) return;
      const pad = elements.largeScoreBoard.querySelector(`[data-large-score-team="${server.teamIndex}"]`);
      if (!pad) return;
      pad.classList.add("is-serving");
      const playerIndex = getMatchTeam(server.teamIndex)?.players?.indexOf(server.player) ?? -1;
      const badge = pad.querySelectorAll(".team-player")[playerIndex];
      if (badge) badge.insertAdjacentHTML("beforeend", serveBall());
    }

    let currentTeams = [];
    function getMatchTeam(teamIndex) {
      return currentTeams[teamIndex];
    }

    function renderLargeScore(matchId) {
      if (!matchId || !elements.largeScoreDialog.open) return;
      const match = getMatchById(matchId);
      if (celebratingMatchId === matchId) return;
      // another match opened while a win was still showing: that board must not close on the old timer
      if (celebratingMatchId) stopCelebration();
      if (!match || match.state !== "playing") {
        if (!match || !celebrateWin(match, matchId)) closeLargeScore();
        return;
      }
      const state = getState();
      currentTeams = [match.teamOne, match.teamTwo];
      const server = window.PadelstarServe?.currentServer(match, state.settings) ?? null;
      const timer = timerMarkup?.(match) ?? "";
      elements.largeScoreSurface.setAttribute("style", teamAccentStyle(match.teamOne));
      elements.largeScoreContext.textContent = `${matchContextText(match)} · ${match.courtName ?? t("tournament.noCourtAssigned")}`;
      elements.largeScoreTitle.textContent = t("score.matchup", { teamOne: match.teamOne.displayName, teamTwo: match.teamTwo.displayName });
      elements.largeScoreBoard.innerHTML = [match.teamOne, match.teamTwo].map((team, index) => {
        const teamKey = index === 0 ? "teamOne" : "teamTwo";
        return `
          <button class="large-score-team" type="button" data-large-score-team="${index}" style="${teamAccentStyle(team)}">
            <span class="large-score-label"><span class="large-score-hint">${t("score.tapForPoint")}</span>${teamDisplay(team)}</span>
            <strong>${match.currentSet[teamKey]}</strong>
            ${window.PadelstarScoring.isPointsMatch(match, state.settings) ? "" : `<small>${window.PadelstarScoring.pointLabel(match, match.currentGame[teamKey])}</small>`}
          </button>`;
      }).join("");
      const pointsMode = window.PadelstarScoring.isPointsMatch(match, state.settings);
      const gamesWon = `${window.PadelstarScoring.setsWonByTeam(match, 0)}-${window.PadelstarScoring.setsWonByTeam(match, 1)}`;
      elements.largeScoreActions.innerHTML = `
        <div><span>${t("common.games")}</span><strong>${pointsMode ? gamesWon : setScoreText(match)}</strong></div>
        <div><span>${t("common.points")}</span><strong>${pointsMode ? setScoreText(match) : gameScoreText(match)}</strong></div>
        <div><span>${t("common.server")}</span><strong>${serverCellMarkup(match, server)}</strong></div>
        ${timer ? `<div class="large-score-timer"><span>${t("match.timeLeft")}</span>${timer}</div>` : ""}`;
      elements.largeScoreActions.classList.toggle("has-timer", Boolean(timer));
      markServingPlayer(server);
      const undo = elements.largeScoreUndoButton;
      if (undo) {
        undo.disabled = !match.undoStack?.length;
        undo.onclick = () => { undoLastPoint?.(match); renderLargeScore(matchId); };
      }
      tickChangedNumbers(matchId);
      elements.largeScoreBoard.querySelectorAll("[data-large-score-team]").forEach((button) => {
        button.addEventListener("click", () => awardTennisPoint(match, Number(button.dataset.largeScoreTeam)));
      });
    }

    // The numbers that changed since the last paint of this match tick once (styles/motion.css), so the scorer sees
    // which side the point went to. The board is rebuilt on every point, so the values are compared by position.
    let lastNumbers = { matchId: null, values: [] };
    function tickChangedNumbers(matchId) {
      const numbers = [...elements.largeScoreBoard.querySelectorAll(".large-score-team strong, .large-score-team small"), ...elements.largeScoreActions.querySelectorAll("strong")];
      const values = numbers.map((element) => element.textContent);
      if (lastNumbers.matchId === matchId) {
        numbers.forEach((element, index) => { if (values[index] !== lastNumbers.values[index]) element.classList.add("is-ticking"); });
      }
      lastNumbers = { matchId, values };
    }

    // The point that wins the match: the board stays up for one beat, the winning pad gets a ball wash and the other
    // dims and says who won, then the big score closes by itself (docs/technical/motion.md, "win moment").
    // Only when this board was showing the match a moment ago; opening a finished match still closes at once.
    let celebratingMatchId = null;
    let celebrationTimer = null;
    function stopCelebration() {
      window.clearTimeout(celebrationTimer);
      celebratingMatchId = null;
      lastNumbers = { matchId: null, values: [] };
    }
    function celebrateWin(match, matchId) {
      const winner = match.winnerTeamIndex ?? match.approval?.winnerTeamIndex;
      const pads = elements.largeScoreBoard.querySelectorAll("[data-large-score-team]");
      if (window.PADELSTAR_TEST_MODE || lastNumbers.matchId !== matchId || ![0, 1].includes(winner) || pads.length !== 2) return false;
      celebratingMatchId = matchId;
      // the pads show the final games of the deciding set (the board still holds the last point's values)
      const lastSet = match.completedSets?.at(-1);
      if (lastSet) {
        pads.forEach((pad, index) => {
          const games = pad.querySelector("strong");
          if (games) games.textContent = String(index === 0 ? lastSet.teamOne : lastSet.teamTwo);
          pad.querySelector("small")?.style.setProperty("visibility", "hidden");
        });
        if (!window.PadelstarScoring.isPointsMatch(match, getState().settings)) {
          const [games, points] = elements.largeScoreActions.querySelectorAll("strong");
          if (games) games.textContent = `${lastSet.teamOne}-${lastSet.teamTwo}`;
          if (points) points.textContent = "–";
        }
      }
      // the pads stay as they are (no :disabled grey); a tap now does nothing because the match is no longer playing
      pads.forEach((pad, index) => {
        pad.setAttribute("aria-disabled", "true");
        pad.classList.add(index === winner ? "is-winner" : "is-runner-up");
        const hint = pad.querySelector(".large-score-hint");
        if (hint) hint.textContent = index === winner ? t("common.winner") : "";
      });
      if (elements.largeScoreUndoButton) elements.largeScoreUndoButton.disabled = true;
      celebrationTimer = window.setTimeout(() => {
        stopCelebration();
        if (elements.largeScoreDialog.open) closeLargeScore();
      }, celebrationHoldMs());
      return true;
    }

    // --motion-celebrate plus a beat to read the winner's name; reduced motion shortens the token, and so the hold
    function celebrationHoldMs() {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--motion-celebrate").trim();
      const ms = value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
      return (Number.isFinite(ms) ? ms : 640) + 500;
    }

    return { renderLargeScore };
  }

  return { create };
})();
