(() => {
  const STORAGE_KEY = "shamito-tournament";
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 8;
  const DEFAULT_PLAYERS = 4;
  const DEFAULT_ROUNDS = 3;
  const WIN_POINTS = 1;
  const DRAW_POINTS = 0.5;
  const BYE_POINTS = 0.5;
  const PAIRING_BUDGET = 200000;

  const $ = (id) => document.getElementById(id);
  const esc = (str) => String(str).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const maxRoundsFor = (players) => (players % 2 ? players : players - 1);
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const isPlayer = (s, id) => Number.isInteger(id) && id >= 0 && id < s.players.length;

  // State: { players: string[], totalRounds, seats?: (number|null)[], rounds: [{ done, matches: [{ a, b, aWins, bWins, draws }] }] }
  // Players are referenced by index; a bye is a match with b === null.
  // `seats` drives a round-robin schedule. It is used when rounds exceed half the player count,
  // because beyond that point Swiss pairing can run out of opponents who haven't met yet.
  let state = load();
  let lastNames = state ? [...state.players] : [];

  function isValidState(s) {
    return (
      s && Array.isArray(s.players) && s.players.length >= MIN_PLAYERS && s.players.length <= MAX_PLAYERS && s.players.every((p) => typeof p === "string") &&
      Number.isInteger(s.totalRounds) && s.totalRounds >= 1 && s.totalRounds <= maxRoundsFor(s.players.length) &&
      (s.seats === undefined || (Array.isArray(s.seats) && s.seats.every((id) => id === null || isPlayer(s, id)))) &&
      Array.isArray(s.rounds) && s.rounds.length >= 1 && s.rounds.length <= s.totalRounds &&
      s.rounds.every((r) => Array.isArray(r.matches) && r.matches.every((m) =>
        isPlayer(s, m.a) && (m.b === null || isPlayer(s, m.b)) &&
        [m.aWins, m.bWins, m.draws].every(Number.isInteger)))
    );
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return isValidState(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  function save() {
    try {
      if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable (private mode); the tournament still works for this visit.
    }
  }

  // Scoring

  function matchPoints(m) {
    if (m.b === null) return [BYE_POINTS, 0];
    return [m.aWins * WIN_POINTS + m.draws * DRAW_POINTS, m.bWins * WIN_POINTS + m.draws * DRAW_POINTS];
  }

  function matchError(m) {
    if (m.b === null) return "";
    const games = m.aWins + m.bWins + m.draws;
    if (games === 0) return "Enter the result of at least one game.";
    if (games > 3) return "A best-of-three match has at most 3 games.";
    if ((m.aWins === 2 || m.bWins === 2) && m.draws > 0) return "The match ends once a player wins 2 games.";
    return "";
  }

  function standings() {
    const rows = state.players.map((name, id) => ({ id, name, points: 0, won: 0, lost: 0, drawn: 0, byes: 0 }));
    // A round is won, lost or drawn by who won more games in it.
    const tally = (row, outcome) => {
      if (outcome > 0) row.won++;
      else if (outcome < 0) row.lost++;
      else row.drawn++;
    };
    state.rounds.forEach((round) => {
      if (!round.done) return;
      round.matches.forEach((m) => {
        const [pa, pb] = matchPoints(m);
        rows[m.a].points += pa;
        if (m.b === null) {
          rows[m.a].byes++;
          return;
        }
        rows[m.b].points += pb;
        const outcome = Math.sign(m.aWins - m.bWins);
        tally(rows[m.a], outcome);
        tally(rows[m.b], -outcome);
      });
    });
    rows.sort((x, y) => y.points - x.points || x.name.localeCompare(y.name));
    rows.forEach((row, i) => { row.rank = i > 0 && row.points === rows[i - 1].points ? rows[i - 1].rank : i + 1; });
    return rows;
  }

  // Swiss pairing: players are ordered by points, then paired top-down while
  // avoiding rematches. The bye goes to the lowest-ranked player without one.

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pairPlayers(order, played, allowRematch) {
    let budget = PAIRING_BUDGET;
    const solve = (list) => {
      if (!list.length) return [];
      if (--budget < 0) return null;
      const [first, ...rest] = list;
      for (let i = 0; i < rest.length; i++) {
        if (!allowRematch && played.has(pairKey(first, rest[i]))) continue;
        const sub = solve(rest.filter((_, j) => j !== i));
        if (sub) return [[first, rest[i]], ...sub];
      }
      return null;
    };
    return solve(order);
  }

  const newMatch = (a, b) => ({ a, b, aWins: 0, bWins: 0, draws: 0 });

  // Circle method: the first seat stays fixed while the others rotate one place per round.
  function roundRobinRound(index) {
    const [fixed, ...others] = state.seats;
    const rotated = others.map((_, i) => others[(i + index) % others.length]);
    const seats = [fixed, ...rotated];
    const matches = [];
    let bye = null;
    for (let i = 0; i < seats.length / 2; i++) {
      const [a, b] = [seats[i], seats[seats.length - 1 - i]];
      if (a === null || b === null) bye = a ?? b;
      else matches.push(newMatch(a, b));
    }
    if (bye !== null) matches.push(newMatch(bye, null));
    return { done: false, matches };
  }

  function createRound() {
    if (state.seats) return roundRobinRound(state.rounds.length);
    const points = new Map(standings().map((r) => [r.id, r.points]));
    const played = new Set();
    const hadBye = new Set();
    state.rounds.forEach((r) => r.matches.forEach((m) => (m.b === null ? hadBye.add(m.a) : played.add(pairKey(m.a, m.b)))));

    const order = shuffle(state.players.map((_, id) => id)).sort((x, y) => points.get(y) - points.get(x));
    const lowestFirst = [...order].reverse();
    const fairByes = lowestFirst.filter((id) => !hadBye.has(id));
    const repeatByes = lowestFirst.filter((id) => hadBye.has(id));
    const attempts = order.length % 2
      ? [[fairByes, false], [fairByes, true], [repeatByes, false], [repeatByes, true]]
      : [[[null], false], [[null], true]];

    for (const [byeCandidates, allowRematch] of attempts) {
      for (const bye of byeCandidates) {
        const pairs = pairPlayers(order.filter((id) => id !== bye), played, allowRematch);
        if (!pairs) continue;
        const matches = pairs.map(([a, b]) => newMatch(a, b));
        if (bye !== null) matches.push(newMatch(bye, null));
        return { done: false, matches };
      }
    }
    throw new Error("Could not create pairings.");
  }

  // Rendering

  const currentRound = () => (state && !state.rounds.at(-1).done ? state.rounds.at(-1) : null);
  const isFinished = () => !!state && state.rounds.length === state.totalRounds && state.rounds.every((r) => r.done);

  function optionsHtml(values, selected) {
    return values.map((v) => `<option value="${v}"${v === selected ? " selected" : ""}>${v}</option>`).join("");
  }

  function renderSetup(count = Math.max(lastNames.length, DEFAULT_PLAYERS)) {
    $("player-count").innerHTML = optionsHtml(range(MIN_PLAYERS, MAX_PLAYERS), count);
    renderRoundOptions(count, DEFAULT_ROUNDS);
    renderNameInputs(count, false);
  }

  function renderRoundOptions(players, preferred) {
    const max = maxRoundsFor(players);
    $("round-count").innerHTML = optionsHtml(range(1, max), Math.min(preferred, max));
  }

  function renderNameInputs(count, keepTyped) {
    const current = keepTyped ? [...$("name-list").querySelectorAll("input")].map((input) => input.value) : [];
    const values = range(0, count - 1).map((i) => current[i] ?? lastNames[i] ?? "");
    $("name-list").innerHTML = values
      .map((v, i) => `<li><label class="visually-hidden" for="player-${i}">Player ${i + 1} name</label><input id="player-${i}" type="text" maxlength="40" autocomplete="off" placeholder="Player ${i + 1}" value="${esc(v)}"></li>`)
      .join("");
  }

  function sideHtml(m, i, side) {
    const name = esc(state.players[side === "a" ? m.a : m.b]);
    const field = side === "a" ? "aWins" : "bWins";
    const selectId = `match-${i}-${side}`;
    return `<div class="side side-${side}">
      <span class="pname">${name}</span>
      <span class="score">
        <span class="gain" data-gain="${side}"></span>
        <label class="visually-hidden" for="${selectId}">Games won by ${name}</label>
        <span class="field small"><select id="${selectId}" data-field="${field}">${optionsHtml([0, 1, 2], m[field])}</select></span>
      </span>
    </div>`;
  }

  function matchHtml(m, i) {
    if (m.b === null) {
      return `<div class="match bye" data-index="${i}">
        <span class="table-no">Bye</span>
        <p><strong>${esc(state.players[m.a])}</strong> has a bye this round and receives ${fmt(BYE_POINTS)} points.</p>
      </div>`;
    }
    return `<div class="match" data-index="${i}">
      <div class="match-head">
        <span class="table-no">Table ${i + 1}</span>
        <label class="field small"><span>Drawn games</span><select data-field="draws">${optionsHtml([0, 1, 2, 3], m.draws)}</select></label>
      </div>
      <div class="sides">${sideHtml(m, i, "a")}<span class="vs" aria-hidden="true">vs</span>${sideHtml(m, i, "b")}</div>
      <p class="match-error" role="alert" hidden></p>
    </div>`;
  }

  function updateGains(matchEl, m) {
    const [pa, pb] = matchPoints(m);
    matchEl.querySelector('[data-gain="a"]').textContent = `+${fmt(pa)}`;
    matchEl.querySelector('[data-gain="b"]').textContent = `+${fmt(pb)}`;
  }

  function renderRound() {
    const round = currentRound();
    const index = state.rounds.length;
    $("round-title").textContent = `Round ${index} of ${state.totalRounds}`;
    $("matches").innerHTML = round.matches.map(matchHtml).join("");
    $("matches").querySelectorAll(".match:not(.bye)").forEach((el) => updateGains(el, round.matches[Number(el.dataset.index)]));
    $("round-error").hidden = true;
    $("undo-round").hidden = index < 2;
    $("submit-round").textContent = index === state.totalRounds ? "Submit final results" : "Submit results";
  }

  function recordHtml(row) {
    const bye = row.byes ? ` <span class="bye-tag">${row.byes > 1 ? `${row.byes} byes` : "Bye"}</span>` : "";
    return `<span class="record">${row.won}/${row.lost}/${row.drawn}</span>${bye}`;
  }

  function standingsRowsHtml(rows, finished) {
    return rows
      .map((row) => `<tr${finished && row.rank === 1 ? ' class="champion"' : ""}>
        <th scope="row"><span class="player"><span class="rank">${row.rank}</span><span>${esc(row.name)}</span></span></th>
        <td>${recordHtml(row)}</td>
        <td class="num">${fmt(row.points)}</td>
      </tr>`)
      .join("");
  }

  function renderStandings() {
    const finished = isFinished();
    const doneRounds = state.rounds.filter((r) => r.done).length;
    $("standings-title").textContent = finished ? "Final Ranking" : `Standings after Round ${doneRounds}`;
    $("standings-body").innerHTML = standingsRowsHtml(standings(), finished);
    $("final-actions").hidden = !finished;
  }

  function openShare() {
    const players = state.players.length;
    const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const rounds = `${state.totalRounds} ${state.totalRounds === 1 ? "round" : "rounds"}`;
    $("share-meta").innerHTML = `<span>Final Ranking · ${players} players · ${rounds}</span><span>${esc(date)}</span>`;
    $("share-body").innerHTML = standingsRowsHtml(standings(), true);
    $("share").showModal();
    $("share").scrollTop = 0;
    $("share-close").focus();
  }

  function render() {
    const round = currentRound();
    $("setup").hidden = !!state;
    $("round-view").hidden = !round;
    $("standings-view").hidden = !state || !state.rounds.some((r) => r.done);
    $("restart-wrap").hidden = !state;
    if (!state) return;
    if (round) renderRound();
    if (!$("standings-view").hidden) renderStandings();
  }

  function focusHeading(id) {
    const el = $(id);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function showError(id, message) {
    const el = $(id);
    el.textContent = message;
    el.hidden = !message;
  }

  // Events

  $("player-count").addEventListener("change", (e) => {
    const count = Number(e.target.value);
    renderRoundOptions(count, Number($("round-count").value));
    renderNameInputs(count, true);
  });

  $("setup").addEventListener("submit", (e) => {
    e.preventDefault();
    const inputs = [...$("name-list").querySelectorAll("input")];
    const names = inputs.map((input) => input.value.trim().replace(/\s+/g, " "));
    const emptyIndex = names.findIndex((n) => !n);
    if (emptyIndex !== -1) {
      showError("setup-error", "Enter a name for every player.");
      inputs[emptyIndex].focus();
      return;
    }
    const lower = names.map((n) => n.toLowerCase());
    const duplicateIndex = lower.findIndex((n, i) => lower.indexOf(n) !== i);
    if (duplicateIndex !== -1) {
      showError("setup-error", `Each player needs a different name. "${names[duplicateIndex]}" is used more than once.`);
      inputs[duplicateIndex].focus();
      return;
    }
    showError("setup-error", "");
    const totalRounds = Number($("round-count").value);
    state = { players: names, totalRounds, rounds: [] };
    if (totalRounds > Math.floor(names.length / 2)) {
      const ids = shuffle(names.map((_, id) => id));
      state.seats = ids.length % 2 ? [...ids, null] : ids;
    }
    state.rounds.push(createRound());
    lastNames = [...names];
    save();
    render();
    focusHeading("round-title");
  });

  $("matches").addEventListener("change", (e) => {
    const select = e.target.closest("select[data-field]");
    if (!select) return;
    const matchEl = select.closest(".match");
    const m = currentRound().matches[Number(matchEl.dataset.index)];
    m[select.dataset.field] = Number(select.value);
    save();
    updateGains(matchEl, m);
    if (matchEl.classList.contains("invalid")) {
      const message = matchError(m);
      matchEl.classList.toggle("invalid", !!message);
      const errorEl = matchEl.querySelector(".match-error");
      errorEl.textContent = message;
      errorEl.hidden = !message;
      if (!$("matches").querySelector(".match.invalid")) showError("round-error", "");
    }
  });

  $("submit-round").addEventListener("click", () => {
    const round = currentRound();
    let firstInvalid = null;
    $("matches").querySelectorAll(".match:not(.bye)").forEach((el) => {
      const message = matchError(round.matches[Number(el.dataset.index)]);
      el.classList.toggle("invalid", !!message);
      const errorEl = el.querySelector(".match-error");
      errorEl.textContent = message;
      errorEl.hidden = !message;
      if (message && !firstInvalid) firstInvalid = el;
    });
    if (firstInvalid) {
      showError("round-error", "Some results need fixing before this round can be submitted.");
      firstInvalid.querySelector(".sides select").focus();
      return;
    }
    round.done = true;
    if (state.rounds.length < state.totalRounds) state.rounds.push(createRound());
    save();
    render();
    focusHeading(isFinished() ? "standings-title" : "round-title");
  });

  $("undo-round").addEventListener("click", () => {
    if (!window.confirm("Go back to the previous round? Pairings for this round will be discarded and created again after you resubmit.")) return;
    state.rounds.pop();
    state.rounds.at(-1).done = false;
    save();
    render();
    focusHeading("round-title");
  });

  $("open-share").addEventListener("click", openShare);
  $("share-close").addEventListener("click", () => $("share").close());
  $("share").addEventListener("click", (e) => { if (e.target === $("share")) $("share").close(); });

  $("edit-last").addEventListener("click", () => {
    state.rounds.at(-1).done = false;
    save();
    render();
    focusHeading("round-title");
  });

  $("restart").addEventListener("click", () => {
    if (!window.confirm("Start a new tournament? All current pairings and results will be cleared.")) return;
    lastNames = [...state.players];
    state = null;
    save();
    renderSetup(lastNames.length);
    render();
    $("player-0").focus();
  });

  $("year").textContent = new Date().getFullYear();
  renderSetup();
  render();
})();
