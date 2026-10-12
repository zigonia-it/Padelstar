(function attachPadelstarTournamentLibrary(global) {
  "use strict";

  function create({ storage, localStorage, storageKey, migrateState }) {
    const empty = () => ({ version: 1, tournaments: [] });

    function read() {
      const parsed = storage.readJson(localStorage, storageKey);
      if (!parsed || !Array.isArray(parsed.tournaments)) return empty();
      return {
        version: 1,
        tournaments: parsed.tournaments
          .filter((item) => item?.state && typeof item.state.id === "string")
          .map((item) => ({
            id: item.state.id,
            updatedAt: item.updatedAt ?? item.state.updatedAt ?? null,
            state: migrateState(item.state),
          })),
      };
    }

    // The library is a convenience copy of every tournament on this device. When the browser's storage is full,
    // the oldest other tournaments make room first; if the current one still does not fit it is left out, so a
    // full library never stops the tournament itself from being created or saved.
    function write(library, keepId = null) {
      const tournaments = [...library.tournaments];
      for (;;) {
        try {
          storage.writeJson(localStorage, storageKey, { ...library, tournaments });
          return true;
        } catch (error) {
          if (!isQuotaError(error)) throw error;
          const evictable = tournaments
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.id !== keepId)
            .sort((a, b) => String(a.item.updatedAt ?? "").localeCompare(String(b.item.updatedAt ?? "")));
          if (evictable.length) tournaments.splice(evictable[0].index, 1);
          else if (tournaments.length) tournaments.length = 0;
          else return false;
        }
      }
    }

    function list() {
      return read().tournaments.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    }

    function upsert(state) {
      if (!state?.id) return;
      const library = read();
      const entry = { id: state.id, updatedAt: new Date().toISOString(), state: structuredClone(state) };
      const index = library.tournaments.findIndex((item) => item.id === state.id);
      if (index >= 0) library.tournaments[index] = entry;
      else library.tournaments.push(entry);
      write(library, state.id);
    }

    function get(id) {
      return list().find((item) => item.id === id)?.state ?? null;
    }

    function remove(id) {
      const library = read();
      const tournaments = library.tournaments.filter((item) => item.id !== id);
      if (tournaments.length !== library.tournaments.length) write({ ...library, tournaments });
    }

    return { get, list, remove, upsert };
  }

  function isQuotaError(error) {
    return error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED" || error?.code === 22;
  }

  global.PadelstarTournamentLibrary = { create };
})(window);
