(() => {
  const CARDS = window.CUBE_CARDS || [];

  const SECTIONS = [
    { id: "WHITE", label: "White", pip: "w", icon: "sun" },
    { id: "BLUE", label: "Blue", pip: "u", icon: "drop" },
    { id: "BLACK", label: "Black", pip: "b", icon: "skull" },
    { id: "RED", label: "Red", pip: "r", icon: "flame" },
    { id: "GREEN", label: "Green", pip: "g", icon: "tree" },
    { id: "MULTICOLOR", label: "Multicolor", pip: "m" },
    { id: "COLORLESS", label: "Artifacts", pip: "c", icon: "gem" },
    { id: "LANDS", label: "Lands", pip: "l", icon: "peak" },
  ];
  const SECTION_INDEX = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i]));

  const PAIRS = ["WU", "UB", "BR", "RG", "GW", "WB", "UR", "BG", "RW", "GU"];
  const PAIR_NAMES = {
    WU: "White–Blue", UB: "Blue–Black", BR: "Black–Red", RG: "Red–Green", GW: "Green–White",
    WB: "White–Black", UR: "Blue–Red", BG: "Black–Green", RW: "Red–White", GU: "Green–Blue",
  };
  const pairOf = (card) => {
    const ids = [...card.colors].sort().join("");
    return PAIRS.find((p) => [...p].sort().join("") === ids) || ids;
  };

  const TYPE_ORDER = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Land"];
  const primaryType = (card) => {
    const front = card.type.split(" // ")[0];
    return TYPE_ORDER.find((t) => front.includes(t)) || "Other";
  };

  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4.6" fill="#3a3218"/><g stroke="#3a3218" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1.8" x2="12" y2="4.6"/><line x1="12" y1="19.4" x2="12" y2="22.2"/><line x1="1.8" y1="12" x2="4.6" y2="12"/><line x1="19.4" y1="12" x2="22.2" y2="12"/><line x1="4.8" y1="4.8" x2="6.8" y2="6.8"/><line x1="17.2" y1="17.2" x2="19.2" y2="19.2"/><line x1="4.8" y1="19.2" x2="6.8" y2="17.2"/><line x1="17.2" y1="6.8" x2="19.2" y2="4.8"/></g>',
    drop: '<path d="M12 2.2C9 7 5.8 10.6 5.8 14.6a6.2 6.2 0 0 0 12.4 0C18.2 10.6 15 7 12 2.2z" fill="#13283a"/>',
    skull: '<path d="M12 2.5c-4.9 0-8.3 3.4-8.3 8 0 2.7 1.3 4.6 3.1 5.7v3.3c0 .9.7 1.6 1.6 1.6h7.2c.9 0 1.6-.7 1.6-1.6v-3.3c1.8-1.1 3.1-3 3.1-5.7 0-4.6-3.4-8-8.3-8z" fill="#1d1715"/><circle cx="8.6" cy="11.4" r="2.1" fill="#b9aea8"/><circle cx="15.4" cy="11.4" r="2.1" fill="#b9aea8"/>',
    flame: '<path d="M12.6 1.8c.6 3.4-1.4 5.2-3 7.2-1.7 2.1-3.4 4-3.4 7 0 3.6 2.6 6.2 5.8 6.2s5.8-2.6 5.8-6.1c0-2.3-1-4.2-2.4-5.6.1 1.6-.4 2.8-1.4 3.4.3-3.5-.3-8.6-1.4-12.1z" fill="#3b120a"/>',
    tree: '<path d="M12 1.8c-3.3 0-5.6 2.4-5.6 5.2-1.7.7-2.9 2.3-2.9 4.3 0 2.7 2.2 4.8 4.9 4.8h2.3v5.6h2.6v-5.6h2.3c2.7 0 4.9-2.1 4.9-4.8 0-2-1.2-3.6-2.9-4.3 0-2.8-2.3-5.2-5.6-5.2z" fill="#10301c"/>',
    gem: '<path d="M12 3 L20 9 L12 21 L4 9 Z" fill="none" stroke="#2b2b2b" stroke-width="2" stroke-linejoin="round"/><path d="M4 9 H20" stroke="#2b2b2b" stroke-width="1.6"/>',
    peak: '<path d="M2 20 L9 8 L13 14 L16 10 L22 20 Z" fill="#3c3424"/>',
  };
  const pipHtml = (s) => `<span class="pip ${s.pip}">${s.icon ? `<svg viewBox="0 0 24 24">${ICONS[s.icon]}</svg>` : ""}</span>`;

  const manaHtml = (cost) =>
    cost
      .split(" // ")
      .map((part) =>
        (part.match(/\{[^}]+\}/g) || [])
          .map((tok) => {
            const sym = tok.slice(1, -1).replace("/", "");
            return `<img src="https://svgs.scryfall.io/card-symbols/${encodeURIComponent(sym)}.svg" alt="${tok}" title="${tok}">`;
          })
          .join("")
      )
      .join('<span class="slash">//</span>');

  const state = { colors: new Set(), sort: "color", query: "" };
  let visible = [];
  let current = -1;

  const $ = (id) => document.getElementById(id);
  const filtersEl = $("filters");
  const libraryEl = $("library");

  function buildFilters() {
    const counts = Object.fromEntries(SECTIONS.map((s) => [s.id, 0]));
    CARDS.forEach((c) => counts[c.section]++);
    filtersEl.innerHTML =
      `<button class="chip all" data-id="ALL" aria-pressed="true">All <span class="n">${CARDS.length}</span></button>` +
      SECTIONS.map((s) => `<button class="chip" data-id="${s.id}" aria-pressed="false">${pipHtml(s)}${s.label} <span class="n">${counts[s.id]}</span></button>`).join("");
    filtersEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const id = btn.dataset.id;
      if (id === "ALL") state.colors.clear();
      else state.colors.has(id) ? state.colors.delete(id) : state.colors.add(id);
      filtersEl.querySelectorAll(".chip").forEach((b) => {
        const on = b.dataset.id === "ALL" ? state.colors.size === 0 : state.colors.has(b.dataset.id);
        b.setAttribute("aria-pressed", String(on));
      });
      render();
    });
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  const byCmcName = (a, b) => a.cmc - b.cmc || byName(a, b);

  function groupCards(cards) {
    switch (state.sort) {
      case "color":
        return SECTIONS.map((s) => {
          let list = cards.filter((c) => c.section === s.id);
          list =
            s.id === "MULTICOLOR"
              ? list.sort((a, b) => PAIRS.indexOf(pairOf(a)) - PAIRS.indexOf(pairOf(b)) || byCmcName(a, b))
              : s.id === "LANDS" ? list.sort(byName) : list.sort(byCmcName);
          return { title: s.label, pip: s, cards: list };
        });
      case "cmc": {
        const lands = cards.filter((c) => c.section === "LANDS").sort(byName);
        const spells = cards.filter((c) => c.section !== "LANDS");
        const values = [...new Set(spells.map((c) => Math.min(c.cmc, 7)))].sort((a, b) => a - b);
        return [
          ...values.map((v) => ({
            title: v >= 7 ? "Mana Value 7+" : `Mana Value ${v}`,
            cards: spells.filter((c) => Math.min(c.cmc, 7) === v).sort((a, b) => SECTION_INDEX[a.section] - SECTION_INDEX[b.section] || byName(a, b)),
          })),
          { title: "Lands", cards: lands },
        ];
      }
      case "type":
        return TYPE_ORDER.concat("Other").map((t) => ({
          title: t === "Sorcery" ? "Sorceries" : `${t}s`,
          cards: cards.filter((c) => primaryType(c) === t).sort((a, b) => SECTION_INDEX[a.section] - SECTION_INDEX[b.section] || byCmcName(a, b)),
        }));
      default:
        return [{ title: null, cards: [...cards].sort(byName) }];
    }
  }

  function cardHtml(card, index) {
    const img = card.images[0];
    const extra = card.images.length > 1 ? '<span class="flip">2 faces</span>' : "";
    return `<button class="card" data-index="${index}" title="${card.name}" aria-label="${card.name}">
      <img src="${img.normal}" alt="${card.name}" loading="lazy" decoding="async" width="488" height="680">${extra}</button>`;
  }

  function render() {
    const q = state.query.trim().toLowerCase();
    const filtered = CARDS.filter(
      (c) => (state.colors.size === 0 || state.colors.has(c.section)) && (!q || c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q))
    );
    const groups = groupCards(filtered).filter((g) => g.cards.length);
    visible = groups.flatMap((g) => g.cards);

    let i = 0;
    libraryEl.innerHTML = groups
      .map((g) => {
        const head = g.title
          ? `<div class="group-head">${g.pip ? pipHtml(g.pip) : ""}<h2>${g.title}</h2><span class="n">${g.cards.length} card${g.cards.length === 1 ? "" : "s"}</span><span class="line"></span></div>`
          : "";
        return `<section class="group">${head}<div class="grid">${g.cards.map((c) => cardHtml(c, i++)).join("")}</div></section>`;
      })
      .join("");

    $("count").textContent = `Showing ${filtered.length} of ${CARDS.length} cards`;
    $("empty").hidden = filtered.length > 0;
  }

  const viewer = $("viewer");

  function openCard(index) {
    current = (index + visible.length) % visible.length;
    const c = visible[current];
    const faces = $("faces");
    faces.className = `faces${c.images.length > 1 ? " double" : ""}`;
    faces.innerHTML = c.images.map((f, n) => `<img src="${f.large}" alt="${c.name}${c.images.length > 1 ? ` (face ${n + 1})` : ""}">`).join("");
    $("d-name").textContent = c.name;
    $("d-cost").innerHTML = manaHtml(c.manaCost);
    $("d-type").textContent = c.type;
    const sec = SECTIONS[SECTION_INDEX[c.section]].label;
    $("d-section").textContent = c.section === "MULTICOLOR" ? `${sec} · ${PAIR_NAMES[pairOf(c)] || ""}` : sec;
    $("d-cmc").textContent = c.cmc;
    $("d-print").textContent = `${c.setName} (${c.set}) #${c.collector} · Common`;
    $("d-artist").textContent = c.artist;
    $("d-link").href = c.scryfall;
    if (!viewer.open) viewer.showModal();
  }

  libraryEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".card");
    if (btn) openCard(Number(btn.dataset.index));
  });
  $("close").addEventListener("click", () => viewer.close());
  $("prev").addEventListener("click", () => openCard(current - 1));
  $("next").addEventListener("click", () => openCard(current + 1));
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
  document.addEventListener("keydown", (e) => {
    if (!viewer.open) return;
    if (e.key === "ArrowLeft") openCard(current - 1);
    if (e.key === "ArrowRight") openCard(current + 1);
  });

  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("search").addEventListener("input", (e) => { state.query = e.target.value; render(); });

  buildFilters();
  render();
})();
