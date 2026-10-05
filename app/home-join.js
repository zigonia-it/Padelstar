// The join card on the home screen: type or paste a code (or a whole join link), then Bli med opens the
// join form with the code already filled in, so the player only has to give their name.
(function (global) {
  "use strict";

  const codeLength = 8;

  // Accepts "ABCD1234", "abcd-1234", or a link carrying ?join= / ?code=. Returns the 8-character code or "".
  function parseJoinCode(input) {
    const text = String(input ?? "").trim();
    if (!text) return "";
    let candidate = text;
    const linkMatch = text.match(/[?&](?:join|code)=([^&#\s]+)/i);
    if (linkMatch) candidate = decodeURIComponent(linkMatch[1]);
    const cleaned = candidate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cleaned.length === codeLength ? cleaned : "";
  }

  function initialize({ form, translate, prefillJoinForm, showModule, focusJoinName }) {
    if (!form) return;
    const input = form.elements.homeJoinCode;
    const hint = form.querySelector(".home-join-hint");

    function setInvalid(invalid) {
      form.classList.toggle("is-invalid", invalid);
      input.setAttribute("aria-invalid", invalid ? "true" : "false");
      if (hint) hint.textContent = translate(invalid ? "home.joinInvalid" : "home.joinHint");
    }

    input.addEventListener("input", () => {
      if (form.classList.contains("is-invalid")) setInvalid(false);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = parseJoinCode(input.value);
      if (!code) {
        setInvalid(true);
        input.focus();
        return;
      }
      setInvalid(false);
      prefillJoinForm(code);
      showModule("setup-player");
      input.value = "";
      focusJoinName?.();
    });
  }

  global.PadelstarHomeJoin = { initialize, parseJoinCode, codeLength };
})(typeof window !== "undefined" ? window : globalThis);
