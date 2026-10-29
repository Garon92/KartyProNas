(() => {
  "use strict";

  const CATS = window.CATEGORIES;
  const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
  const $ = id => document.getElementById(id);

  // ---------- Uložení do prohlížeče (nemusí být dostupné – pak se jen nepamatuje) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("kpn:" + key);
        return v == null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("kpn:" + key, JSON.stringify(value)); } catch {}
    }
  };

  const hash = s => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };

  // ---------- Stav ----------
  let players = store.get("players", []);
  let custom = store.get("custom", []);            // [{id, text}]
  let disabled = new Set(store.get("disabled", []));
  let history = store.get("history", []);          // id karet v pořadí, jak byly vytaženy
  let allCards = [];
  let byId = new Map();
  let pos = 0;                                     // pos === history.length → karta rubem nahoru
  const answered = new Map();                      // pos → Set jmen
  let busy = false;

  function buildCards() {
    allCards = [];
    for (const [cat, list] of Object.entries(window.CARDS)) {
      for (const text of list) allCards.push({ id: cat + ":" + hash(text), cat, text });
    }
    for (const c of custom) allCards.push({ id: "vlastni:" + c.id, cat: "vlastni", text: c.text });
    byId = new Map(allCards.map(c => [c.id, c]));
    history = history.filter(id => byId.has(id));
  }

  const save = () => {
    store.set("players", players);
    store.set("custom", custom);
    store.set("disabled", [...disabled]);
    store.set("history", history);
  };

  const remaining = () => {
    const drawn = new Set(history);
    return allCards.filter(c => !disabled.has(c.cat) && !drawn.has(c.id));
  };

  const faceUp = () => pos < history.length;

  // ---------- Prvky ----------
  const stage = $("stage");
  const fan = $("fan");
  const card = $("card");
  const front = $("front");
  const empty = $("empty");
  const btnNext = $("btnNext");
  const btnPrev = $("btnPrev");
  const BACK_HTML = card.querySelector(".back").innerHTML;

  // ---------- Vykreslení ----------
  function fillFront(i) {
    const c = byId.get(history[i]);
    const cat = catById[c.cat];
    card.style.setProperty("--cat", cat.color);
    document.documentElement.style.setProperty("--cat", cat.color);
    front.dataset.cat = c.cat;
    front.dataset.icon = cat.icon;
    $("catIcon").textContent = cat.icon;
    $("catName").textContent = cat.name;
    $("cardNum").textContent = "#" + (i + 1);
    const q = $("question");
    // jednopísmenné předložky a spojky nenechat na konci řádku
    q.textContent = c.text.replace(/(^|\s)([kKsSvVzZoOuUaAiI])\s+/g, "$1$2 ");
    q.className = "question" + (c.text.length > 105 ? " l" : c.text.length > 62 ? " m" : "");
    const st = $("starter");
    st.textContent = "";
    if (players.length) {
      st.append("Začíná ");
      const b = document.createElement("b");
      b.textContent = players[i % players.length];
      st.append(b);
    } else {
      st.textContent = "Odpovídá každý ✋";
    }
  }

  function render() {
    const left = remaining().length;
    const up = faceUp();
    const isEmpty = !up && left === 0;

    empty.hidden = !isEmpty;
    card.classList.toggle("is-hidden", !up);
    if (!up && !busy) fan.hidden = isEmpty;

    if (isEmpty) {
      const anyOn = allCards.some(c => !disabled.has(c.cat));
      $("emptyText").textContent = anyOn
        ? "Zamíchat a začít znovu?"
        : "Nemáte zapnutou žádnou kategorii. Zapni ji v nastavení ⚙️";
      $("btnReshuffle").hidden = !anyOn;
    }

    btnPrev.disabled = pos === 0;
    btnNext.disabled = isEmpty;
    btnNext.textContent = up ? "Další karta →" : "Vytáhnout kartu";

    $("counter").textContent = up
      ? `Karta ${pos + 1} · v balíčku zbývá ${left}`
      : `V balíčku zbývá ${left} ${plural(left, "karta", "karty", "karet")}`;

    renderAnswers();
  }

  const plural = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;

  function renderAnswers() {
    const box = $("answers");
    box.textContent = "";
    btnNext.classList.remove("ready");

    if (!faceUp()) {
      if (remaining().length) {
        const d = document.createElement("div");
        d.className = "picker";
        if (players.length) {
          d.append("👆 Kartu vybírá ");
          const b = document.createElement("b");
          b.textContent = players[pos % players.length];
          d.append(b);
        } else {
          d.textContent = "👆 Vyber si jednu kartu";
        }
        box.append(d);
      }
      if (!players.length) box.append(addPlayerChip());
      return;
    }
    if (!players.length) { box.append(addPlayerChip()); return; }

    const set = answered.get(pos) || new Set();
    const n = players.length;
    const start = pos % n;
    for (let k = 0; k < n; k++) {
      const name = players[(start + k) % n];
      const chip = document.createElement("button");
      chip.className = "chip" + (set.has(name) ? " done" : "") + (k === 0 ? " first" : "");
      chip.setAttribute("aria-pressed", set.has(name));
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.textContent = "✓";
      chip.append(tick, name);
      chip.onclick = () => {
        const s = answered.get(pos) || new Set();
        s.has(name) ? s.delete(name) : s.add(name);
        answered.set(pos, s);
        renderAnswers();
      };
      box.append(chip);
    }
    const all = players.every(p => set.has(p));
    btnNext.classList.toggle("ready", all);
    if (all) {
      const d = document.createElement("div");
      d.className = "all-done";
      d.textContent = "Všichni odpověděli 🎉";
      box.append(d);
    }
  }

  function addPlayerChip() {
    const add = document.createElement("button");
    add.className = "chip add";
    add.textContent = "+ Přidat hráče";
    add.onclick = () => openDialog("dlgPlayers");
    return add;
  }

  // ---------- Vějíř karet ----------
  function buildFan(animate) {
    fan.textContent = "";
    fan.classList.remove("leaving");
    const n = Math.min(remaining().length, stage.clientWidth >= 700 ? 7 : 5);
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fan-card" + (animate ? " stacked" : "");
      b.setAttribute("aria-label", `Vybrat kartu ${i + 1}`);
      const face = document.createElement("div");
      face.className = "face back";
      face.innerHTML = BACK_HTML;
      b.append(face);
      b.addEventListener("click", () => choose(b));
      fan.append(b);
    }
    fan.hidden = n === 0;
    layoutFan();
    if (animate && n) {
      void fan.offsetWidth;
      [...fan.children].forEach((b, i) => {
        b.style.transitionDelay = i * 45 + "ms";
        b.classList.remove("stacked");
      });
      setTimeout(() => [...fan.children].forEach(b => { b.style.transitionDelay = ""; }), 800);
    }
  }

  // rozevře karty tak, aby se vešly na šířku obrazovky
  function layoutFan() {
    const cards = [...fan.children];
    const n = cards.length;
    if (!n) return;
    const w = cards[0].offsetWidth, h = w * 1.4;
    const half = stage.clientWidth / 2 - 10;
    const rad = d => d * Math.PI / 180;
    let max = n >= 7 ? 36 : 28;
    while (max > 6 && (w / 2) * Math.cos(rad(max)) + 1.1 * h * Math.sin(rad(max)) > half) max--;
    cards.forEach((b, i) => {
      const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
      b.style.setProperty("--a", (t * max).toFixed(2) + "deg");
    });
  }

  // ---------- Animace ----------
  const reflow = () => void card.offsetWidth;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function setFlipped(on) {
    card.classList.add("no-anim");
    card.classList.toggle("flipped", on);
    reflow();
    card.classList.remove("no-anim");
  }

  async function throwOut(dir) {
    card.style.transform = "";
    card.classList.add("throw-" + dir);
    await wait(320);
    card.classList.add("no-anim");
    card.classList.remove("throw-" + dir);
    reflow();
    card.classList.remove("no-anim");
  }

  function play(cls) {
    card.classList.remove("pop");
    reflow();
    card.classList.add(cls);
  }

  // ---------- Akce ----------
  async function choose(fanCard) {
    if (busy || faceUp()) return;
    const pool = remaining();
    if (!pool.length) { render(); return; }
    busy = true;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    history.push(pick.id);
    pos = history.length - 1;
    save();
    fillFront(pos);

    // vybraná karta vyjede z vějíře na místo velké karty a cestou se otočí
    const from = fanCard.getBoundingClientRect();
    card.classList.add("no-anim");
    card.classList.remove("is-hidden", "flipped", "pop");
    card.style.transform = "";
    const to = card.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = fanCard.offsetWidth / card.offsetWidth;
    const angle = fanCard.style.getPropertyValue("--a") || "0deg";
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle}) scale(${scale})`;
    fanCard.classList.add("picked");
    for (const b of fan.children) if (b !== fanCard) b.classList.add("away");
    reflow();
    card.classList.remove("no-anim");
    card.classList.add("rising");
    card.style.transform = "";
    await wait(90);
    card.classList.add("flipped");
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch {} }
    await wait(750);
    card.classList.remove("rising");
    fan.hidden = true;
    busy = false;
    render();
  }

  function draw() {
    if (busy || faceUp()) return;
    const cards = [...fan.children];
    if (!cards.length) { render(); return; }
    choose(cards[Math.floor(Math.random() * cards.length)]);
  }

  async function next() {
    if (busy) return;
    if (!faceUp()) return draw();
    busy = true;
    await throwOut("left");
    pos++;
    if (faceUp()) {
      fillFront(pos);
      setFlipped(true);
      play("pop");
    } else {
      card.classList.add("is-hidden");
      setFlipped(false);
      buildFan(true);
    }
    busy = false;
    render();
  }

  async function prev() {
    if (busy || pos === 0) return;
    busy = true;
    if (faceUp()) {
      await throwOut("right");
    } else {
      fan.classList.add("leaving");
      await wait(220);
      fan.hidden = true;
    }
    pos--;
    fillFront(pos);
    card.classList.remove("is-hidden");
    setFlipped(true);
    play("pop");
    busy = false;
    render();
  }

  function refresh() {
    if (pos > history.length) pos = history.length;
    if (faceUp()) { fillFront(pos); setFlipped(true); }
    else { setFlipped(false); buildFan(false); }
    render();
  }

  function reshuffle() {
    history = [];
    pos = 0;
    answered.clear();
    save();
    card.classList.add("is-hidden");
    setFlipped(false);
    buildFan(true);
    render();
  }

  // ---------- Swipe po otočené kartě ----------
  let drag = null;
  card.addEventListener("pointerdown", e => {
    if (busy || !faceUp() || e.button > 0) return;
    drag = { x: e.clientX, y: e.clientY, dx: 0, moved: false };
  });
  card.addEventListener("pointermove", e => {
    if (!drag) return;
    drag.dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(drag.dx) > 10 && Math.abs(drag.dx) > Math.abs(dy)) {
      drag.moved = true;
      card.classList.add("dragging");
      try { card.setPointerCapture(e.pointerId); } catch {}
    }
    if (drag.moved) card.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 25}deg)`;
  });
  const endDrag = () => {
    if (!drag) return;
    const { dx, moved } = drag;
    drag = null;
    card.classList.remove("dragging");
    if (!moved) return;
    if (dx < -70) next();
    else if (dx > 70 && pos > 0) prev();
    else card.style.transform = "";
  };
  card.addEventListener("pointerup", endDrag);
  card.addEventListener("pointercancel", endDrag);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!faceUp() && !busy) buildFan(false); }, 150);
  });

  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);
  $("btnReshuffle").addEventListener("click", reshuffle);

  document.addEventListener("keydown", e => {
    if (document.querySelector("dialog[open]") || e.target.matches("input")) return;
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " " && e.target === document.body) { e.preventDefault(); next(); }
  });

  // ---------- Dialogy ----------
  function openDialog(id) {
    const d = $(id);
    if (id === "dlgPlayers") renderPlayers();
    if (id === "dlgSettings") { renderCats(); renderCustom(); renderOffline(); }
    d.showModal();
  }
  document.querySelectorAll("dialog").forEach(d => {
    d.addEventListener("click", e => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) d.close();
    });
    d.addEventListener("close", refresh);
  });
  $("btnPlayers").addEventListener("click", () => openDialog("dlgPlayers"));
  $("btnSettings").addEventListener("click", () => openDialog("dlgSettings"));

  function delButton(label, onClick) {
    const b = document.createElement("button");
    b.className = "del";
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.textContent = "✕";
    b.onclick = onClick;
    return b;
  }

  // hráči
  function renderPlayers() {
    const ul = $("playerList");
    ul.textContent = "";
    if (!players.length) {
      const li = document.createElement("li");
      li.className = "list-empty";
      li.textContent = "Zatím nikdo. Přidej třeba mámu, tátu a kluky.";
      ul.append(li);
    }
    players.forEach((name, i) => {
      const li = document.createElement("li");
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      const span = document.createElement("span");
      span.textContent = name;
      li.append(num, span, delButton("Odebrat " + name, () => {
        players.splice(i, 1);
        save(); renderPlayers();
      }));
      ul.append(li);
    });
    $("btnShufflePlayers").hidden = players.length < 2;
  }
  $("formPlayer").addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("inpPlayer");
    const name = inp.value.trim().replace(/\s+/g, " ");
    if (name && !players.includes(name)) {
      players.push(name);
      save(); renderPlayers();
    }
    inp.value = "";
    inp.focus();
  });
  $("btnShufflePlayers").addEventListener("click", () => {
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    save(); renderPlayers();
  });

  // kategorie
  function renderCats() {
    const box = $("catList");
    box.textContent = "";
    for (const cat of CATS) {
      const count = allCards.filter(c => c.cat === cat.id).length;
      if (cat.id === "vlastni" && !count) continue;
      const label = document.createElement("label");
      label.className = "cat-toggle";
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = cat.color + "26";
      dot.textContent = cat.icon;
      const name = document.createElement("span");
      name.className = "label";
      name.textContent = cat.name + " ";
      const cnt = document.createElement("span");
      cnt.className = "count";
      cnt.textContent = count;
      name.append(cnt);
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.checked = !disabled.has(cat.id);
      inp.onchange = () => {
        inp.checked ? disabled.delete(cat.id) : disabled.add(cat.id);
        save();
      };
      const sw = document.createElement("span");
      sw.className = "switch";
      label.append(dot, name, inp, sw);
      box.append(label);
    }
  }

  // vlastní otázky
  function renderCustom() {
    const ul = $("customList");
    ul.textContent = "";
    custom.forEach((c, i) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = c.text;
      li.append(span, delButton("Smazat otázku", () => {
        custom.splice(i, 1);
        buildCards();
        save(); renderCustom(); renderCats();
      }));
      ul.append(li);
    });
  }
  $("formCustom").addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("inpCustom");
    const text = inp.value.trim().replace(/\s+/g, " ");
    if (text) {
      custom.push({ id: Date.now().toString(36), text });
      buildCards();
      disabled.delete("vlastni");
      save(); renderCustom(); renderCats();
    }
    inp.value = "";
    inp.focus();
  });

  $("btnReset").addEventListener("click", () => {
    $("dlgSettings").close();
    reshuffle();
  });

  // ---------- Offline ----------
  function renderOffline() {
    const el = $("offlineStatus");
    if (!("serviceWorker" in navigator)) { el.textContent = ""; return; }
    navigator.serviceWorker.getRegistration().then(r => {
      el.textContent = r && r.active ? "✅ Uloženo – funguje i bez internetu." : "⏳ Ukládám pro použití bez internetu…";
    }).catch(() => {});
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  // ---------- Start ----------
  buildCards();
  pos = history.length;   // po otevření čeká vějíř nových karet
  card.classList.add("is-hidden");
  buildFan(true);
  render();
})();
