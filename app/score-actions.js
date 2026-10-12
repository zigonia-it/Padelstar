(function (global) {
  "use strict";

  function create(deps) {
    function saveMatchResult(match, teamOne, teamTwo) {
      saveSetResult(match, teamOne, teamTwo);
    }

    function saveSetResult(match, teamOne, teamTwo) {
      const validationError = validateSetScore(teamOne, teamTwo);
      if (validationError) {
        deps.showToast(deps.translateScoreValidationError(validationError, teamOne, teamTwo), "status-message-error");
        return;
      }
      if (deps.isSupabaseReady()) {
        deps.queueRemoteSetResult(match, teamOne, teamTwo);
        return;
      }
      match.undoStack = match.undoStack ?? [];
      match.undoStack.push(deps.captureMatchUndoState(match));
      match.currentSet = { teamOne, teamTwo };
      match.currentGame = { teamOne: 0, teamTwo: 0 };
      match.completedSets.push({ teamOne, teamTwo });
      if (hasMatchWinner(match)) {
        deps.finishMatch(match);
      } else {
        match.currentSet = { teamOne: 0, teamTwo: 0 };
        match.state = "playing";
        match.status = "active";
      }
      deps.saveState();
      deps.render();
      deps.renderLargeScore();
    }

    function validateSetScore(teamOne, teamTwo) {
      return deps.scoring.validateSetScore(teamOne, teamTwo, deps.getState().settings);
    }

    function translateScoreValidationError(message, teamOne, teamTwo) {
      if (!message) return "";
      const t = deps.t;
      if (message === "messages.invalidScoreInteger") return t(message);
      if (message === "messages.invalidScoreNegative") return t(message);
      if (message === "messages.invalidScoreDraw") return t(message);
      if (message === "messages.invalidScoreShape") {
        const rules = deps.scoring.normalizeRules(deps.getState().settings);
        if (rules.setDecider === "continue") {
          return t("messages.invalidScoreShapeMargin", { target: rules.gamesToWinSet, margin: rules.setWinBy, teamOne, teamTwo });
        }
        const gamesToWinSet = rules.gamesToWinSet;
        return t("messages.invalidScoreShape", {
          gamesToWinSet,
          tieBreakOne: gamesToWinSet + 1,
          tieBreakTwo: gamesToWinSet - 1,
          teamOne,
          teamTwo,
        });
      }
      return message;
    }

    function awardTennisPoint(match, teamIndex) {
      if (["finished", "cancelled"].includes(match.state)) return;
      if (deps.currentLocalRole() === "player") {
        const playerId = deps.getState().selectedPlayerId;
        const scorerId = match.scorer?.playerId;
        if (scorerId && scorerId !== playerId) return;
        if (!scorerId) match.scorer = { playerId, claimedAt: new Date().toISOString() };
      }
      match.undoStack = match.undoStack ?? [];
      match.undoStack.push(deps.captureMatchUndoState(match));
      match.redoStack = [];
      if (match.state === "waiting") {
        match.state = "playing";
        match.status = "active";
      }
      const { matchWon } = deps.scoring.awardPoint(match, teamIndex, deps.getState().settings);
      if (matchWon) {
        if (deps.currentLocalRole() === "player") deps.enterApproval(match);
        else deps.finishMatch(match);
      }
      if (deps.currentLocalRole() === "player" && deps.matchIncludesPlayer(match, deps.getState().selectedPlayerId)) {
        deps.queuePlayerScore(match.id, teamIndex);
      }
      // The big score is what the scorer is looking at: paint it first. Saving and the full re-render of every card
      // (hundreds of ms on a phone) follow once that frame is on screen, and taps in between share one save and render.
      deps.renderLargeScore();
      pendingFlashMatchIds.add(match.id);
      if (matchWon) wonMatchIds.add(match.id);
      afterPointPending = true;
      if (matchWon || typeof deps.afterPaint !== "function") flushAfterPoint();
      else if (!afterPointScheduled) {
        afterPointScheduled = true;
        deps.afterPaint(flushAfterPoint);
      }
    }

    let afterPointScheduled = false;
    let afterPointPending = false;
    const pendingFlashMatchIds = new Set();
    const wonMatchIds = new Set();
    function flushAfterPoint() {
      afterPointScheduled = false;
      if (!afterPointPending) return;
      afterPointPending = false;
      deps.saveState();
      deps.render();
      pendingFlashMatchIds.forEach((matchId) => deps.flashMatchCards(matchId, { won: wonMatchIds.has(matchId) }));
      pendingFlashMatchIds.clear();
      wonMatchIds.clear();
    }

    function isSetComplete(teamOne, teamTwo) {
      return deps.scoring.isSetComplete(teamOne, teamTwo, deps.getState().settings);
    }

    function hasMatchWinner(match) {
      return deps.scoring.hasMatchWinner(match, deps.getState().settings);
    }

    function setsWonByTeam(match, teamIndex) {
      return deps.scoring.setsWonByTeam(match, teamIndex);
    }

    return { saveMatchResult, saveSetResult, validateSetScore, translateScoreValidationError, awardTennisPoint, flushPendingPoint: flushAfterPoint, isSetComplete, hasMatchWinner, setsWonByTeam };
  }

  global.PadelstarScoreActions = { create };
})(window);
