window.PadelstarInviteCodeInput = (() => {
  const cellCount = 8;

  function create({ elements }) {
    function cells() {
      return [...elements.joinTournamentForm.querySelectorAll(".invite-code-cell")];
    }

    function hiddenField() {
      return elements.joinTournamentForm.elements.inviteCode;
    }

    function focusCell(index) {
      cells()[Math.max(0, Math.min(cellCount - 1, index))]?.focus();
    }

    function syncHiddenFromCells() {
      hiddenField().value = cells().map((cell) => cell.value).join("");
    }

    function syncCellsFromHidden() {
      const value = (hiddenField().value || "").toUpperCase();
      cells().forEach((cell, index) => { cell.value = value[index] ?? ""; });
    }

    function cleanCode(text) {
      return (text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    // writes the characters into the cells from `startIndex` on, replacing what was there
    function fillFrom(startIndex, text) {
      const allCells = cells();
      [...text].slice(0, cellCount - startIndex).forEach((char, offset) => { allCells[startIndex + offset].value = char; });
      syncHiddenFromCells();
      focusCell(startIndex + text.length);
    }

    // iOS Safari ignores select() on a programmatic focus, so a cell that already holds a character
    // (a prefilled code) swallowed every key after the first: typing 6CBNY4Y2 over E6FYUMMK gave 66FYUMMK.
    // Insert the typed character ourselves instead of relying on the selection.
    function handleBeforeInput(event) {
      if (!event.inputType?.startsWith("insert") || event.data == null) return;
      event.preventDefault();
      const text = cleanCode(event.data);
      if (text) fillFrom(Number(event.target.dataset.codeCellIndex), text);
    }

    // fallback for browsers that do not cancel beforeinput (e.g. some Android keyboards)
    function handleInput(event) {
      const cell = event.target;
      cell.value = cleanCode(cell.value).slice(-1);
      syncHiddenFromCells();
      if (cell.value) focusCell(Number(cell.dataset.codeCellIndex) + 1);
    }

    function handleKeydown(event) {
      const cell = event.target;
      const index = Number(cell.dataset.codeCellIndex);
      if (event.key === "Backspace" && !cell.value) focusCell(index - 1);
      if (event.key === "ArrowLeft") focusCell(index - 1);
      if (event.key === "ArrowRight") focusCell(index + 1);
    }

    function handleFocus(event) {
      event.target.select();
    }

    function handlePaste(event) {
      event.preventDefault();
      const text = cleanCode(event.clipboardData?.getData("text"));
      cells().forEach((cell, index) => { cell.value = text[index] ?? ""; });
      syncHiddenFromCells();
      focusCell(Math.min(text.length, cellCount - 1));
    }

    function initialize() {
      cells().forEach((cell) => {
        cell.addEventListener("beforeinput", handleBeforeInput);
        cell.addEventListener("input", handleInput);
        cell.addEventListener("keydown", handleKeydown);
        cell.addEventListener("focus", handleFocus);
        cell.addEventListener("paste", handlePaste);
      });
    }

    return { initialize, syncCellsFromHidden };
  }

  return { create };
})();
