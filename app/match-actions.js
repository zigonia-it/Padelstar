(function attachPadelstarMatchActions(global) {
  "use strict";

  // same limit as PadelstarState.UNDO_LIMIT and the database trigger compact_tournament_history
  const UNDO_LIMIT = 20;

  function create(deps) {
    const {
      activateNextWaitingMatch,
      getActiveRound,
      getMatchById,
      getRoundForMatch,
      getState,
      isSupabaseReady,
      markCupCompleteIfDone,
      queueRemoteMatchAction,
      render,
      renderLargeScore,
      requestConfirmation,
      saveState,
      showToast,
      t,
    } = deps;

    function captureMatchUndoState(match) {
      const state = getState();
      const activeRound = getRoundForMatch(match);
      const matchSnapshot = structuredClone(match);
      // a restore keeps the current scorer role, its log and the event history, so a snapshot does not store them
      // (storing the growing event log made the history grow with the square of the points, field test 2026-10-04)
      for (const field of ["undoStack", "redoStack", "scorer", "scorerRequest", "scorerLog", "eventLog"]) delete matchSnapshot[field];
      // every capture is pushed right after: keep room for it, only the last UNDO_LIMIT steps can be undone
      if (Array.isArray(match.undoStack) && match.undoStack.length >= UNDO_LIMIT) match.undoStack.splice(0, match.undoStack.length - UNDO_LIMIT + 1);
      const nextWaitingMatch = activeRound?.matches.find((item) => item.id !== match.id && item.state === "waiting");
      return {
        match: matchSnapshot,
        nextWaitingMatch: nextWaitingMatch ? structuredClone(nextWaitingMatch) : null,
        roundId: activeRound?.id ?? null,
        roundStatus: activeRound?.status ?? null,
        tournamentStatus: state.status,
        revision: state.revision,
        cupWinnerTeam: state.cup?.winnerTeam ? structuredClone(state.cup.winnerTeam) : null,
      };
    }

    function undoMatch(match) {
      const state = getState();
      const undoStack = match.undoStack ?? [];
      const undoState = undoStack.at(-1);
      if (!undoState?.match) {
        showToast(t("messages.noUndo"), "status-message-error");
        return;
      }
      const restoredMatch = structuredClone(undoState.match);
      // The scorer role, its log, the event history and the running clock are not part of a score snapshot.
      for (const field of ["scorer", "scorerRequest", "scorerLog", "eventLog", "startedAt"]) {
        if (field in match) restoredMatch[field] = match[field];
        else delete restoredMatch[field];
      }
      deps.recordEvent?.("match_undone", "match", match.id, { restoredState: restoredMatch.state });
      undoStack.pop();
      Object.assign(match, restoredMatch);
      match.undoStack = undoStack;
      match.redoStack = [];
      if (undoState.nextWaitingMatch) {
        const nextMatch = getMatchById(undoState.nextWaitingMatch.id);
        if (nextMatch) Object.assign(nextMatch, structuredClone(undoState.nextWaitingMatch));
      }
      const round = state.rounds.find((item) => item.id === undoState.roundId);
      if (round && undoState.roundStatus) round.status = undoState.roundStatus;
      if (undoState.tournamentStatus) state.status = undoState.tournamentStatus;
      if (state.cup) state.cup.winnerTeam = undoState.cupWinnerTeam ? structuredClone(undoState.cupWinnerTeam) : null;
      saveState();
      render();
      renderLargeScore();
    }

    function startMatch(match) {
      const activeRound = getActiveRound();
      if (!activeRound || activeRound.status !== "active") return;
      if (isSupabaseReady()) {
        queueRemoteMatchAction(match, "start");
        return;
      }
      match.state = "playing";
      deps.recordEvent?.("match_started", "match", match.id, { courtId: match.courtId, courtName: match.courtName });
      match.status = "active";
      beginClock(match);
      saveState();
      render();
      renderLargeScore();
    }

    // The clock of a timed match runs from startedAt; the rule profile is locked at the same moment.
    function beginClock(match) {
      if (match.startedAt) return;
      global.PadelstarScoring?.snapshotRules(match, getState().settings);
      match.startedAt = new Date().toISOString();
    }

    // Starts the clock of a timed match that is already on court (points scored before it do not start it).
    function startClock(match) {
      if (match.state !== "playing" || match.startedAt) return;
      if (isSupabaseReady()) {
        queueRemoteMatchAction(match, "start_clock");
        return;
      }
      beginClock(match);
      deps.recordEvent?.("match_clock_started", "match", match.id, { courtId: match.courtId, courtName: match.courtName });
      saveState();
      render();
      renderLargeScore();
    }

    function reopenMatch(match) {
      if (isSupabaseReady()) {
        queueRemoteMatchAction(match, "undo");
        return;
      }
      if (match.undoStack?.length) {
        undoMatch(match);
        return;
      }
      match.state = "playing";
      match.status = "active";
      match.completedSets = [];
      match.currentSet = { teamOne: 0, teamTwo: 0 };
      match.currentGame = { teamOne: 0, teamTwo: 0 };
      match.winnerTeamIndex = null;
      match.isWalkover = false;
      match.undoStack = [];
      match.completedAt = null;
      saveState();
      render();
      renderLargeScore();
    }

    async function cancelMatch(match) {
      if (!await requestConfirmation(t("messages.cancelMatchConfirm"))) return;
      if (isSupabaseReady()) {
        queueRemoteMatchAction(match, "cancel");
        return;
      }
      match.state = "cancelled";
      match.status = "cancelled";
      deps.recordEvent?.("match_cancelled", "match", match.id, {});
      match.completedSets = [];
      match.winnerTeamIndex = null;
      match.isWalkover = false;
      match.completedAt = new Date().toISOString();
      activateNextWaitingMatch(match);
      saveState();
      render();
      renderLargeScore();
    }

    async function setWalkover(match, teamIndex) {
      if (![0, 1].includes(teamIndex) || ["finished", "cancelled"].includes(match.state)) return;
      const winningTeam = teamIndex === 0 ? match.teamOne : match.teamTwo;
      if (!await requestConfirmation(t("messages.walkoverConfirm", { team: winningTeam.displayName }))) return;
      if (isSupabaseReady()) {
        queueRemoteMatchAction(match, "walkover", teamIndex);
        return;
      }
      match.undoStack = match.undoStack ?? [];
      match.undoStack.push(captureMatchUndoState(match));
      match.state = "finished";
      match.status = "completed";
      deps.recordEvent?.("match_walkover", "match", match.id, { winnerTeamIndex: teamIndex });
      match.completedSets = [];
      match.currentSet = { teamOne: 0, teamTwo: 0 };
      match.currentGame = { teamOne: 0, teamTwo: 0 };
      match.winnerTeamIndex = teamIndex;
      match.isWalkover = true;
      match.completedAt = new Date().toISOString();
      activateNextWaitingMatch(match);
      markCupCompleteIfDone();
      saveState();
      render();
      renderLargeScore();
    }

    function updateMatchCourt(match, courtName) {
      const state = getState();
      const nextCourtName = courtName.trim();
      match.courtName = nextCourtName || null;
      const matchingCourt = state.courts.find((court) => court.name.localeCompare(nextCourtName, "nb", { sensitivity: "accent" }) === 0);
      match.courtId = matchingCourt?.id ?? match.courtId ?? null;
      saveState();
      render();
      renderLargeScore();
    }

    return { cancelMatch, captureMatchUndoState, reopenMatch, setWalkover, startClock, startMatch, undoMatch, updateMatchCourt };
  }

  global.PadelstarMatchActions = { create };
})(window);
