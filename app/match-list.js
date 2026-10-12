window.PadelstarMatchList = (() => {
  function create({ appendEmptyText, document, t }) {
    function filterMatches(matches, filter) {
      if (filter === "active") return matches.filter((match) => ["playing", "awaitingApproval", "awaitingWithdrawalDecision"].includes(match.state));
      if (filter === "next") return matches.filter((match) => match.state === "waiting");
      if (filter === "finished") return matches.filter((match) => ["finished", "cancelled"].includes(match.state));
      return matches;
    }

    // The admin's Kamper view (4.4) leads with the current matches, then the next ones; each card carries its own state chip.
    function statusGroups(matches) {
      const current = matches.filter((match) => ["playing", "awaitingApproval", "awaitingWithdrawalDecision"].includes(match.state));
      return [
        { title: t(current.length === 1 ? "matches.currentOne" : "matches.current"), matches: current, className: "match-group-current" },
        { title: t("matches.upcoming"), matches: matches.filter((match) => match.state === "waiting"), className: "match-group-next" },
        { title: t("common.finished"), matches: matches.filter((match) => ["finished", "cancelled"].includes(match.state)) },
      ];
    }

    function renderGroupedMatches(container, matches, emptyText, cardFactory, { byStatus = false } = {}) {
      container.innerHTML = "";
      if (matches.length === 0) {
        appendEmptyText(container, emptyText);
        return;
      }

      const groups = (byStatus ? statusGroups(matches) : [
        { title: t("common.playing"), matches: matches.filter((match) => match.state === "playing") },
        { title: t("common.awaitingApproval"), matches: matches.filter((match) => match.state === "awaitingApproval") },
        { title: t("common.awaitingWithdrawal"), matches: matches.filter((match) => match.state === "awaitingWithdrawalDecision") },
        { title: t("common.waiting"), matches: matches.filter((match) => match.state === "waiting") },
        { title: t("common.finished"), matches: matches.filter((match) => ["finished", "cancelled"].includes(match.state)) },
      ]).filter((group) => group.matches.length > 0);

      groups.forEach((group) => {
        const section = document.createElement("section");
        section.className = group.className ? `match-group ${group.className}` : "match-group";
        section.innerHTML = `<h4>${group.title}</h4>`;
        section.append(...group.matches.map(cardFactory));
        container.append(section);
      });
    }

    return { filterMatches, renderGroupedMatches };
  }

  return { create };
})();
