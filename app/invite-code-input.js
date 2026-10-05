// The invite code field on the join page: one wide box like the join card on home. It takes a typed code or a
// pasted join link and keeps only the 8-character code, upper-case, in the form field.
window.PadelstarInviteCodeInput = (() => {
  const codeLength = 8;

  function create({ elements }) {
    function field() {
      return elements.joinTournamentForm.elements.inviteCode;
    }

    // A whole link (…?join=CODE) gives its code; anything else keeps its letters and digits.
    function cleanCode(text) {
      const value = String(text ?? "");
      const linkCode = window.PadelstarHomeJoin?.parseJoinCode?.(value);
      if (linkCode) return linkCode;
      return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, codeLength);
    }

    // Kept under its old name: prefillJoinForm calls it after writing the code into the field.
    function syncCellsFromHidden() {
      const input = field();
      if (input) input.value = cleanCode(input.value);
    }

    function initialize() {
      const input = field();
      if (!input) return;
      input.addEventListener("input", () => {
        const cleaned = cleanCode(input.value);
        if (cleaned !== input.value) input.value = cleaned;
      });
    }

    return { initialize, syncCellsFromHidden };
  }

  return { create };
})();
