// game.js
(() => {
  // ===== Config =====
  const SIZE = 10;

  // Координати по осі X (10 унікальних символів)
  // Вибраний варіант: Д З И Г А Р К У Л О
  const AXIS = ["Д", "З", "И", "Г", "А", "Р", "К", "У", "Л", "О"];

  const SHIPS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const SCORE_HIT = 1;
  const SCORE_SUNK_BONUS = 1; // ✅ було +2, тепер +1

  // ===== State =====
  const state = {
    grid: [],         // 10x10: { shipId: number|null, fired: bool }
    ships: [],        // { id, cells:[{r,c}], hits, size, sunk }
    team: 1,
    score1: 0,
    score2: 0,
    reveal: false,
    finished: false,
  };

  // ===== DOM =====
  const elBoard = document.getElementById("board");
  const elS1 = document.getElementById("score1");
  const elS2 = document.getElementById("score2");
  const elResult = document.getElementById("resultText");
  const elFleet = document.getElementById("fleet");
  const elRow1 = document.getElementById("scoreRow1");
  const elRow2 = document.getElementById("scoreRow2");

  // Controls (залишилась тільки "Нова гра")
  document.getElementById("btnNew")?.addEventListener("click", newGame);

  document.getElementById("toggleReveal")?.addEventListener("change", (e) => {
    state.reveal = !!e.target.checked;
    renderAll();
  });

  // ===== Helpers =====
  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

  function rcToCoord(r, c) {
    return `${AXIS[c]}${r + 1}`;
  }

  function flashResult(text) {
    if (elResult) elResult.textContent = text;
  }

  function setActiveTeamHighlight() {
    if (!elRow1 || !elRow2) return;

    elRow1.classList.remove("active", "team1", "team2");
    elRow2.classList.remove("active", "team1", "team2");

    if (state.team === 1) {
      elRow1.classList.add("active", "team1");
    } else {
      elRow2.classList.add("active", "team2");
    }
  }

  function addScore(team, points) {
    if (team === 1) state.score1 += points;
    else state.score2 += points;
    elS1.textContent = String(state.score1);
    elS2.textContent = String(state.score2);
  }

  function switchTeam() {
    state.team = state.team === 1 ? 2 : 1;
    setActiveTeamHighlight();
  }

  // ===== Board build/render =====
  function initGrid() {
    state.grid = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => ({ shipId: null, fired: false }))
    );
    state.ships = [];
  }

  function buildBoardUI() {
    elBoard.innerHTML = "";

    // 11x11 (headers)
    for (let rr = -1; rr < SIZE; rr++) {
      for (let cc = -1; cc < SIZE; cc++) {
        const d = document.createElement("div");
        d.className = "cell";

        if (rr === -1 && cc === -1) {
          d.classList.add("header");
          d.textContent = " ";
        } else if (rr === -1) {
          d.classList.add("header");
          d.textContent = AXIS[cc];
        } else if (cc === -1) {
          d.classList.add("header");
          d.textContent = String(rr + 1);
        } else {
          d.classList.add("playable");
          d.dataset.r = String(rr);
          d.dataset.c = String(cc);
          d.addEventListener("click", onCellClick);
        }

        elBoard.appendChild(d);
      }
    }
  }

  function renderFleet() {
    if (!elFleet) return;

    const ordered = [...state.ships].sort((a, b) => b.size - a.size || a.id - b.id);

    elFleet.innerHTML = "";
    for (const ship of ordered) {
      const shipEl = document.createElement("div");
      shipEl.className = "fleet-ship";

      for (let i = 0; i < ship.size; i++) {
        const deck = document.createElement("div");
        deck.className = "deck";

        if (ship.sunk) deck.classList.add("sunk");
        else if (i < ship.hits) deck.classList.add("hit");

        shipEl.appendChild(deck);
      }

      elFleet.appendChild(shipEl);
    }
  }

  function renderAll() {
    elS1.textContent = String(state.score1);
    elS2.textContent = String(state.score2);
    setActiveTeamHighlight();

    const cells = elBoard.querySelectorAll(".cell.playable");
    cells.forEach((cell) => {
      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);
      const g = state.grid[r][c];

      cell.classList.remove("miss", "hit", "sunk", "reveal-ship");
      cell.textContent = "";

      if (g.fired && g.shipId == null) {
        cell.classList.add("miss");
        cell.textContent = "•";
      }

      if (g.fired && g.shipId != null) {
        const ship = state.ships[g.shipId];
        if (ship?.sunk) {
          cell.classList.add("sunk");
          cell.textContent = "✖";
        } else {
          cell.classList.add("hit");
          cell.textContent = "✹";
        }
      }

      if (state.reveal && g.shipId != null && !g.fired) {
        cell.classList.add("reveal-ship");
      }

      cell.style.pointerEvents = state.finished ? "none" : "auto";
      cell.style.opacity = state.finished ? "0.75" : "1";
    });

    renderFleet();
  }

  // ===== Ship placement (no-touch) =====
  function buildField() {
    initGrid();

    let shipId = 0;
    for (const size of SHIPS) {
      const placed = placeShipRandom(shipId, size);
      if (!placed) return buildField(); // перегенерація поля
      shipId++;
    }
  }

  function placeShipRandom(id, size) {
    const tries = 4000;

    for (let t = 0; t < tries; t++) {
      const vertical = Math.random() < 0.5;
      const r0 = Math.floor(Math.random() * SIZE);
      const c0 = Math.floor(Math.random() * SIZE);

      const cells = [];
      let ok = true;

      for (let k = 0; k < size; k++) {
        const r = r0 + (vertical ? k : 0);
        const c = c0 + (vertical ? 0 : k);
        if (!inBounds(r, c)) { ok = false; break; }
        cells.push({ r, c });
      }
      if (!ok) continue;

      if (!canPlaceCells(cells)) continue;

      state.ships[id] = { id, cells, hits: 0, size, sunk: false };
      for (const { r, c } of cells) {
        state.grid[r][c].shipId = id;
      }
      return true;
    }

    return false;
  }

  function canPlaceCells(cells) {
    // overlap
    for (const { r, c } of cells) {
      if (state.grid[r][c].shipId != null) return false;
    }
    // no-touch (including corners)
    for (const { r, c } of cells) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!inBounds(rr, cc)) continue;
          if (state.grid[rr][cc].shipId != null) return false;
        }
      }
    }
    return true;
  }

  // ===== Auto-mark around sunk ship =====
  function markAroundShipAsMiss(ship) {
    const rows = ship.cells.map((x) => x.r);
    const cols = ship.cells.map((x) => x.c);
    const rMin = Math.min(...rows) - 1;
    const rMax = Math.max(...rows) + 1;
    const cMin = Math.min(...cols) - 1;
    const cMax = Math.max(...cols) + 1;

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        if (!inBounds(r, c)) continue;

        const isShipCell = ship.cells.some((p) => p.r === r && p.c === c);
        if (isShipCell) continue;

        const g = state.grid[r][c];
        if (g.shipId != null) continue;

        if (!g.fired) g.fired = true;
      }
    }
  }

  // ===== Gameplay =====
  function onCellClick(e) {
    const r = parseInt(e.currentTarget.dataset.r, 10);
    const c = parseInt(e.currentTarget.dataset.c, 10);
    fireAt(r, c);
  }

  function fireAt(r, c) {
    if (state.finished) return;

    const g = state.grid[r][c];
    if (g.fired) {
      flashResult(`Клітинка ${rcToCoord(r, c)} вже відкрита`);
      return;
    }

    g.fired = true;

    if (g.shipId == null) {
      flashResult(`💦 Промах: ${rcToCoord(r, c)} — хід іншої команди`);
      switchTeam();
    } else {
      const ship = state.ships[g.shipId];
      ship.hits += 1;
      addScore(state.team, SCORE_HIT);

      if (ship.hits >= ship.size && !ship.sunk) {
        ship.sunk = true;
        addScore(state.team, SCORE_SUNK_BONUS);
        markAroundShipAsMiss(ship);
        flashResult(`💥 Потоплено корабель! ${rcToCoord(r, c)} (+${SCORE_HIT} + ${SCORE_SUNK_BONUS}) Хід зберігається`);
      } else {
        flashResult(`🎯 Влучання: ${rcToCoord(r, c)} (+${SCORE_HIT}) Хід зберігається`);
      }

      if (state.ships.every((s) => s && s.sunk)) {
        finishGame(true);
      }
    }

    renderAll();
  }

  // ===== Finish / New =====
  function finishGame(allSunk) {
    if (state.finished) return;
    state.finished = true;
    renderAll();

    const s1 = state.score1, s2 = state.score2;
    let winner = "Нічия";
    if (s1 > s2) winner = "Перемогла Команда 1";
    if (s2 > s1) winner = "Перемогла Команда 2";

    const prefix = allSunk ? "✅ Всі кораблі знищено!" : "🏁 Гру завершено!";
    flashResult(`${prefix} • ${winner} • Рахунок: ${s1}:${s2}`);
  }

  function newGame() {
    state.team = 1;
    state.score1 = 0;
    state.score2 = 0;
    state.finished = false;

    const reveal = document.getElementById("toggleReveal");
    if (reveal) reveal.checked = false;
    state.reveal = false;

    buildField();
    buildBoardUI();
    renderAll();
    flashResult("Нова гра. Команда 1 починає!");
  }

  // ===== Boot =====
  buildBoardUI();
  newGame();
})();
