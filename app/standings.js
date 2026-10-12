window.PadelstarStandings = (() => {
  function create({ accentStyle, appendEmptyText, avatarMarkup, document, elements, escapeHtml, getSelectedPlayerId, leaderboardEntries, t }) {
    function renderStandings(matches) {
      renderStandingsList(elements.playerStandingsList, matches);
      if (elements.ownerStandingsList) renderStandingsList(elements.ownerStandingsList, matches);
    }

    // rows slide to their new places when the order changes (app/list-reorder.js)
    function renderStandingsList(container, matches) {
      const reorder = window.PadelstarListReorder;
      if (reorder) reorder.rebuild(container, () => fillStandingsList(container, matches), { pointsSelector: ".standing-stats strong" });
      else fillStandingsList(container, matches);
    }

    function fillStandingsList(container, matches) {
      container.innerHTML = "";
      const entries = leaderboardEntries(matches);
      if (entries.length === 0) {
        appendEmptyText(container, t("tournament.standingsEmpty"));
        return;
      }
      entries.forEach((entry, index) => {
        const item = document.createElement("li");
        item.setAttribute("style", accentStyle(entry.player.accent));
        item.dataset.reorderKey = entry.player.id ?? entry.player.name;
        // Your own row carries the ball wash (design system: Standings table).
        if (entry.player.id && entry.player.id === getSelectedPlayerId?.()) item.classList.add("is-me");
        item.innerHTML = `
      <span class="player-list-name">
        <span class="placement-badge">${index + 1}</span>
        ${avatarMarkup(entry.player, "avatar", 34)}
        <span class="player-name-badge">${escapeHtml(entry.player.name)}</span>
      </span>
      <span class="standing-stats">
        <strong>${t("standings.pointsShort", { points: entry.points })}</strong>
        <small>${t("standings.detail", { played: entry.matchesPlayed, wins: entry.matchWins, sets: entry.setsWon, games: entry.gamesWon })}</small>
      </span>`;
        container.append(item);
      });
    }

    return { renderStandings, renderStandingsList };
  }

  return { create };
})();
