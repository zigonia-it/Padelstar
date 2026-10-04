window.PadelstarState = (() => {
  function migrateState(nextState, defaults, helpers) {
    nextState.settings = {
      ...defaults.settings,
      ...(nextState.settings ?? {}),
    };
    if (!(window.PadelstarTournamentModes?.supportedFormats ?? ["roundRobin", "cup"]).includes(nextState.settings.format)) nextState.settings.format = "roundRobin";
    if (!["auto", "manual"].includes(nextState.settings.cupTeamSetupMode)) nextState.settings.cupTeamSetupMode = "auto";
    nextState.settings.includesThirdPlaceMatch = Boolean(nextState.settings.includesThirdPlaceMatch);
    nextState.adminToken ??= null;
    nextState.playerToken ??= null;
    nextState.revision = Number.isInteger(nextState.revision) && nextState.revision >= 0 ? nextState.revision : 0;
    nextState.selectedPlayerId ??= null;
    nextState.players ??= [];
    nextState.courts ??= structuredClone(defaults.courts);
    nextState.schedule ??= helpers.buildSchedule(nextState.players, nextState.settings.format);
    nextState.schedulerHistory = {
      partners: {},
      opponents: {},
      matches: [],
      byes: [],
      ...(nextState.schedulerHistory ?? {}),
    };
    nextState.events = Array.isArray(nextState.events) ? nextState.events.slice(-200) : [];
    // scoreSubmissions was the old result-proposal flow (removed in 0.17.0, replaced entirely by the point-by-point
    // approval workflow); drop it from any state that still carries it from before the removal.
    delete nextState.scoreSubmissions;
    nextState.rounds ??= [];
    nextState.cup ??= null;
    nextState.cupTeams = Array.isArray(nextState.cupTeams) ? nextState.cupTeams : [];
    nextState.players = nextState.players.map((player, index) => ({
      active: true,
      availability: "active",
      participantType: "player",
      accent: helpers.accents[index % helpers.accents.length],
      avatarId: helpers.defaultAvatarId,
      joinStatus: "joined",
      joinedFrom: "manual",
      createdAt: new Date().toISOString(),
      ...player,
    })).map((player, index) => ({
      ...player,
      accent: helpers.normalizeAccent(player.accent, index),
      availability: player.availability === "away" ? "away" : "active",
    }));
    nextState.rounds = nextState.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => migrateMatch(match, nextState.id, helpers)),
    }));
    return nextState;
  }

  function migrateMatch(match, tournamentId, helpers) {
    if (match.teamOne && match.teamTwo) {
      const migrated = {
        currentGame: { teamOne: 0, teamTwo: 0 },
        completedSets: [],
        sittingOut: [],
        isThirdPlaceMatch: false,
        undoStack: [],
        ...match,
      };
      return compactMatchHistory(migrateUndoState(migrated));
    }
    return {
      id: match.id,
      tournamentId,
      rotationNumber: match.roundNumber ?? 1,
      courtId: match.courtId,
      courtName: match.courtName,
      teamOne: helpers.createTeam(match.team1.map(helpers.getPlayerById).filter(Boolean)),
      teamTwo: helpers.createTeam(match.team2.map(helpers.getPlayerById).filter(Boolean)),
      sittingOut: [],
      state: match.status === "Completed" ? "finished" : match.status === "Active" ? "playing" : "waiting",
      status: match.status === "Completed" ? "completed" : match.status === "Active" ? "active" : "scheduled",
      completedSets: [],
      currentSet: {
        teamOne: match.scoreTeam1 ?? 0,
        teamTwo: match.scoreTeam2 ?? 0,
      },
      currentGame: { teamOne: 0, teamTwo: 0 },
      startingTeamIndex: 0,
      winnerTeamIndex: match.scoreTeam1 > match.scoreTeam2 ? 0 : match.scoreTeam2 > match.scoreTeam1 ? 1 : null,
      isWalkover: false,
      isThirdPlaceMatch: false,
      undoStack: [],
      completedAt: match.completedAt,
    };
  }

  // Undo history (0.17.1, field test 2026-10-04): every point stored a snapshot of the whole match including its event
  // log, so the history grew with the square of the points: 93 points left one match with 800 KB, the tournament went
  // over the server's 256 KB state limit and every admin save was refused. A restore never takes the scorer role, its
  // log or the event history from a snapshot (the current ones are kept, in JS and SQL), so they are not stored, and
  // only the last UNDO_LIMIT steps are kept. The database applies the same rules (trigger compact_tournament_history).
  const UNDO_LIMIT = 20;
  const SNAPSHOT_EXCLUDED_FIELDS = ["undoStack", "redoStack", "scorer", "scorerRequest", "scorerLog", "eventLog"];

  function compactSnapshotMatch(snapshotMatch) {
    if (!snapshotMatch || typeof snapshotMatch !== "object") return snapshotMatch;
    const compact = { ...snapshotMatch };
    for (const field of SNAPSHOT_EXCLUDED_FIELDS) delete compact[field];
    return compact;
  }

  function compactEntry(entry) {
    if (!entry || typeof entry !== "object") return entry;
    const compact = { ...entry };
    if (compact.match) compact.match = compactSnapshotMatch(compact.match);
    // redo entries (written by the database) hold an undo entry and a target snapshot
    if (compact.undoEntry) compact.undoEntry = compactEntry(compact.undoEntry);
    if (compact.target) compact.target = compactEntry(compact.target);
    return compact;
  }

  function compactMatchHistory(match) {
    if (Array.isArray(match.undoStack)) match.undoStack = match.undoStack.slice(-UNDO_LIMIT).map(compactEntry);
    if (Array.isArray(match.redoStack)) match.redoStack = match.redoStack.slice(-UNDO_LIMIT).map(compactEntry);
    return match;
  }

  // Pre-multi-step-undo saved state (local or synced from a server not yet
  // migrated) carries a single lastScoredMatchState snapshot instead of an
  // undoStack array. Preserve that one step of undo rather than discarding it.
  function migrateUndoState(match) {
    if (!Array.isArray(match.undoStack) || match.undoStack.length === 0) {
      if (match.lastScoredMatchState && typeof match.lastScoredMatchState === "object") {
        match.undoStack = [match.lastScoredMatchState];
      } else if (!Array.isArray(match.undoStack)) {
        match.undoStack = [];
      }
    }
    delete match.lastScoredMatchState;
    return match;
  }

  function readSyncMetadata(storage, syncStorageKey) {
    try {
      const parsed = JSON.parse(storage.getItem(syncStorageKey) ?? "null");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function loadPendingAdminSync(storage, syncStorageKey) {
    return Boolean(readSyncMetadata(storage, syncStorageKey).admin);
  }

  function loadPendingPlayerScores(storage, syncStorageKey) {
    const metadata = readSyncMetadata(storage, syncStorageKey);
    if (!Array.isArray(metadata.playerScores)) return [];
    return metadata.playerScores
      .filter((item) => item && typeof item.matchId === "string" && [0, 1].includes(item.teamIndex))
      .map((item) => ({ matchId: item.matchId, teamIndex: item.teamIndex }));
  }

  function persistSyncMetadata(storage, syncStorageKey, pendingAdminSync, pendingPlayerScores, metadata = {}) {
    if (!pendingAdminSync && pendingPlayerScores.length === 0) {
      storage.removeItem(syncStorageKey);
      return;
    }
    storage.setItem(syncStorageKey, JSON.stringify({
      admin: pendingAdminSync,
      playerScores: pendingPlayerScores,
      lastAttemptAt: metadata.lastAttemptAt ?? null,
      lastError: metadata.lastError ?? null,
    }));
  }

  function hasPendingRemoteWrites(pendingAdminSync, pendingPlayerScores) {
    return pendingAdminSync || pendingPlayerScores.length > 0;
  }

  function remoteErrorMessage(error, fallback) {
    const message = String(error?.message ?? "");
    if (/rate limit exceeded/i.test(message)) {
      return "For mange forespørsler akkurat nå. Vent litt og prøv igjen.";
    }
    if (/invalid (?:invite code|player|tournament|.*payload)/i.test(message)) {
      return "Kontroller opplysningene og prøv igjen.";
    }
    return fallback;
  }

  function sanitizeSharedState(nextState) {
    const sharedState = structuredClone(nextState);
    delete sharedState.adminToken;
    delete sharedState.playerToken;
    delete sharedState.selectedPlayerId;
    delete sharedState.ownerUserId;
    delete sharedState.claimedAt;
    delete sharedState.serverConfirmed;
    if (sharedState.settings) delete sharedState.settings.language;
    for (const round of sharedState.rounds ?? []) for (const match of round.matches ?? []) compactMatchHistory(match);
    return sharedState;
  }

  function isConflictError(error) {
    return /tournament state changed|revision|conflict/i.test(String(error?.message ?? ""));
  }

  function isTransientRemoteError(error, isOnline) {
    return !isOnline || /network|fetch|timeout|timed out|closed|aborted|connection/i.test(String(error?.message ?? ""));
  }

  function isValidTournamentState(candidate) {
    return Boolean(
      candidate &&
        typeof candidate.name === "string" &&
        typeof candidate.inviteCode === "string" &&
        Array.isArray(candidate.players) &&
        Array.isArray(candidate.rounds),
    );
  }

  return {
    migrateState,
    migrateMatch,
    compactMatchHistory,
    UNDO_LIMIT,
    readSyncMetadata,
    loadPendingAdminSync,
    loadPendingPlayerScores,
    persistSyncMetadata,
    hasPendingRemoteWrites,
    remoteErrorMessage,
    sanitizeSharedState,
    isConflictError,
    isTransientRemoteError,
    isValidTournamentState,
  };
})();
