(() => {
  function create({
    isReady,
    getState,
    call,
    getTournamentByInvite,
    sanitizeSharedState,
    applyRemoteState,
    createPlayer,
    linkProfileToPlayer,
    saveState,
    showToast,
    errorMessage,
    translate,
  }) {
    async function createTournament() {
      if (!isReady()) return false;
      const state = getState();
      const { data, error } = await call("create_tournament", {
        p_state: sanitizeSharedState(state),
        p_admin_token: state.adminToken,
      });
      if (error) {
        showToast(errorMessage(error, translate("messages.remoteSaveFailed")), "status-message-error");
        return false;
      }
      applyRemoteState({
        ...data,
        adminToken: state.adminToken,
        selectedPlayerId: state.selectedPlayerId,
      }, { source: "rpc", clearConflict: true });
      return true;
    }

    async function loadByInvite(inviteCode) {
      if (!isReady() || !inviteCode) return false;
      const { data, error } = await getTournamentByInvite(inviteCode);
      if (error || !data) return false;
      applyRemoteState(data, { source: "refresh" });
      return true;
    }

    async function join(playerName, avatarId, accent) {
      if (!isReady()) return false;
      const state = getState();
      const player = linkProfileToPlayer(createPlayer(playerName, state.players.length, avatarId, accent));
      player.joinedFrom = "self";
      player.guest = !player.profileId;
      player.participantType = player.profileId ? "player" : "guest";
      const { data, error } = await call("join_tournament", {
        p_invite_code: state.inviteCode,
        p_player: player,
      });
      if (error) {
        showToast(errorMessage(error, translate("messages.joinFailed")), "status-message-error");
        return false;
      }
      if (!data?.state || !data.playerToken || !data.playerId) {
        showToast(translate("messages.securePlayerFailed"), "status-message-error");
        return false;
      }
      applyRemoteState(data.state);
      // applyRemoteState replaces the state object: write the token onto the new one, or it is never persisted
      const joinedState = getState();
      joinedState.playerToken = data.playerToken;
      joinedState.selectedPlayerId = data.playerId;
      saveState({ remote: false });
      clearJoinParams();
      return true;
    }

    // a reload must reopen the player view, not the join form (initial-view checks ?join first)
    function clearJoinParams() {
      const url = new URL(window.location.href);
      const joinView = url.searchParams.get("view") === "setup-player";
      if (!url.searchParams.has("join") && !url.searchParams.has("code") && !joinView) return;
      url.searchParams.delete("join");
      url.searchParams.delete("code");
      if (joinView) url.searchParams.delete("view");
      window.history?.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    return { createTournament, loadByInvite, join };
  }

  window.PadelstarRemoteTournament = { create };
})();
