window.PadelstarCupBracket = (() => {
  function create({ document, elements, escapeHtml, getMatchById, getState, matchStateText, t }) {
    // The fourth menu item is "Tabell" for Round Robin and "Cup" for Cup (4.5): a cup shows its bracket and no table.
    function syncStandingsOrBracket(isCup) {
      const key = isCup ? "admin.cupFormat" : "common.standings";
      document.querySelectorAll?.("[data-standings-label]").forEach((label) => {
        if (label.dataset.i18n === key) return;
        label.dataset.i18n = key;
        label.textContent = t(key);
      });
      elements.ownerStandingsList?.classList.toggle("hidden", isCup);
      elements.playerStandingsList?.classList.toggle("hidden", isCup);
    }

    function renderCupBracket() {
      const state = getState();
      const isCup = state.settings.format === "cup";
      syncStandingsOrBracket(isCup);
      const bracket = isCup ? state.cup?.bracket : null;
      const markup = bracket?.rounds?.length ? bracketMarkup(bracket) : "";
      // before the draw a cup has no bracket yet: say so instead of showing an empty page
      const placeholder = isCup && !markup ? `<p class="hint">${t("cup.waitingForMatch")}</p>` : "";
      [elements.cupBracket, elements.playerCupBracket].forEach((container) => {
        if (!container) return;
        container.classList.toggle("hidden", !isCup);
        container.innerHTML = markup || placeholder;
      });
    }

    function bracketMarkup(bracket) {
      return `
    <div class="panel-heading">
      <h3>${t("cup.bracket")}</h3>
      <span>${t("cup.teamSlots", { count: bracket.bracketSize })}</span>
    </div>
    <div class="cup-bracket-rounds">
      ${bracket.rounds.map((round, index) => `
        <section class="cup-bracket-round">
          <div class="cup-bracket-round-heading">
            <strong>${cupRoundTitle(round, index, bracket.rounds.length)}</strong>
            <span>${round.byeTeams?.length ? t("cup.byeCount", { count: round.byeTeams.length }) : ""}</span>
          </div>
          <div class="cup-bracket-slots">
            ${round.slots.map((slot) => renderCupBracketSlot(slot)).join("")}
            ${round.thirdPlaceSlot ? renderCupBracketSlot(round.thirdPlaceSlot, true) : ""}
          </div>
          ${round.byeTeams?.length ? `<p class="cup-bracket-byes">${t("cup.bye", { teams: round.byeTeams.map((team) => escapeHtml(team.displayName)).join(", ") })}</p>` : ""}
        </section>`).join("")}
    </div>`;
    }

    function cupRoundTitle(round, index, totalRounds) {
      if (totalRounds === 1) return t("cup.final");
      if (index === 0) return t("cup.firstRound");
      if (index === totalRounds - 1) return t("cup.final");
      if (index === totalRounds - 2) return t("cup.semiFinal");
      return t("tournament.roundLabel", { round: round.roundNumber });
    }

    function renderCupBracketSlot(slot, isThirdPlace = false) {
      if (!slot || slot.type === "pending") {
        return `<div class="cup-bracket-slot pending"><span>${isThirdPlace ? t("cup.thirdPlaceMatch") : t("cup.waitingForWinners")}</span></div>`;
      }
      const match = getMatchById(slot.matchId);
      if (!match) return `<div class="cup-bracket-slot pending"><span>${t("cup.waitingForMatch")}</span></div>`;
      const winner = match.winnerTeamIndex === 0 ? match.teamOne : match.winnerTeamIndex === 1 ? match.teamTwo : null;
      return `
    <div class="cup-bracket-slot ${match.state}">
      <span class="cup-bracket-slot-label">${isThirdPlace ? t("cup.thirdPlaceMatch") : matchStateText(match.state)}</span>
      <strong>${escapeHtml(match.teamOne.displayName)}</strong>
      <strong>${escapeHtml(match.teamTwo.displayName)}</strong>
      ${winner ? `<small>${t("score.winnerNote", { winner: escapeHtml(winner.displayName) })}</small>` : ""}
    </div>`;
    }

    return { renderCupBracket, renderCupBracketSlot };
  }

  return { create };
})();
