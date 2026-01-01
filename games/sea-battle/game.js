(() => {
  // ===== Config =====
  const SIZE = 10;
  const SHIPS = [4,3,3,2,2,2,1,1,1,1]; // стандарт
  const SCORE_HIT = 1;
  const SCORE_SUNK_BONUS = 2;

  // ===== State =====
  const state = {
    grid: [],         // 10x10: { shipId: number|null, fired: bool }
    ships: [],        // ship objects: { id, cells:[{r,c}], hits:number, size, sunk:boolean }
    team: 1,          // 1 or 2
    score1: 0,
    score2: 0,
    paused: false,
    reveal: false,
    secondsLeft: 10 * 60,
    timerHandle: null,
    finished: false,
  };

  // ===== DOM =====
  const elBoard = document.getElementById("board");
  const elTurn = document.getElementById("turnBadge");
  const elS1 = document.getElementById("score1");
  const elS2 = document.getElementById("score2");
  const elTimer = document.getElementById("timer");
  const elResult = document.getElementById("resultText");
  const elCoord = document.getElementById("coordInput");

  // Buttons
  document.getElementById("btnNew").addEventListener("click", newGame);
  document.getElementById("btnReset").addEventListener("click", () => {
    if (state.finished) return;
    buildField();
    renderAll();
  });
  document.getElementById("btnPause").addEventListener("click", togglePause);
  document.getElementById("btnMinus").addEventListener("click", () => adjustTime(-60));
  document.getElementById("btnPlus").addEventListener("click", () => adjustTime(60));
  document.getElementById("btnFinish").addEventListener("click", finishGame);
  document.getElementById("btnFire").addEventListener("click", fireFromInput);

  document.getElementById("toggleReveal").addEventListener("change", (e) => {
    state.reveal = !!e.target.checked;
    renderAll();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") togglePause();
    if (e.key === "Enter") fireFromInput();
  });

  // ===== Helpers =====
  const inBounds = (r,c) => r>=0 && r<SIZE && c>=0 && c<SIZE;

  function coordToRC(str) {
    if (!str) return null;
    const s = str.trim().toUpperCase();
    const m = s.match(/^([A-J])\s*(10|[1-9])$/);
    if (!m) return null;
    const c = m[1].charCodeAt(0) - "A".charCodeAt(0);
    const r = parseInt(m[2], 10) - 1;
    return { r, c };
  }

  function rcToCoord(r,c){
    return String.fromCharCode("A".charCodeAt(0)+c) + (r+1);
  }

  function setTurnBadge(){
    elTurn.textContent = `Хід: Команда ${state.team}`;
    elTurn.style.background = state.team === 1 ? "rgba(124,196,255,.14)" : "rgba(255,179,179,.14)";
    elTurn.style.borderColor = state.team === 1 ? "rgba(124,196,255,.25)" : "rgba(255,179,179,.25)";
  }

  function addScore(team, points){
    if (team === 1) state.score1 += points;
    else state.score2 += points;
    elS1.textContent = state.score1;
    elS2.textContent = state.score2;
  }

  function switchTeam(){
    state.team = state.team === 1 ? 2 : 1;
    setTurnBadge();
  }

  // ===== Board build/render =====
  function initGrid(){
    state.grid = Array.from({length: SIZE}, () =>
      Array.from({length: SIZE}, () => ({ shipId: null, fired: false }))
    );
    state.ships = [];
  }

  function buildBoardUI(){
    elBoard.innerHTML = "";
    // 11x11 (headers)
    for (let rr = -1; rr < SIZE; rr++){
      for (let cc = -1; cc < SIZE; cc++){
        const d = document.createElement("div");
        d.className = "cell";

        if (rr === -1 && cc === -1){
          d.classList.add("header");
          d.textContent = " ";
        } else if (rr === -1){
          d.classList.add("header");
          d.textContent = String.fromCharCode("A".charCodeAt(0) + cc);
        } else if (cc === -1){
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

  function renderAll(){
    setTurnBadge();
    elS1.textContent = state.score1;
    elS2.textContent = state.score2;
    renderTimer();

    // render cells
    const cells = elBoard.querySelectorAll(".cell.playable");
    cells.forEach(cell => {
      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);
      const g = state.grid[r][c];

      cell.classList.remove("miss","hit","sunk","reveal-ship");
      cell.textContent = ""; // чисто

      if (g.fired && g.shipId == null){
        cell.classList.add("miss");
        cell.textContent = "•";
      }
      if (g.fired && g.shipId != null){
        const ship = state.ships[g.shipId];
        if (ship?.sunk) {
          cell.classList.add("sunk");
          cell.textContent = "✖";
        } else {
          cell.classList.add("hit");
          cell.textContent = "✹";
        }
      }
      if (state.reveal && g.shipId != null && !g.fired){
        cell.classList.add("reveal-ship");
      }
      // lock when finished/paused
      cell.style.pointerEvents = (state.paused || state.finished) ? "none" : "auto";
      cell.style.opacity = (state.paused || state.finished) ? "0.75" : "1";
    });
  }

  // ===== Ship placement (no-touch) =====
  function buildField(){
    initGrid();

    let shipId = 0;
    for (const size of SHIPS){
      const placed = placeShipRandom(shipId, size);
      if (!placed) {
        // якщо раптом не змогло (дуже рідко) — перегенеримо все поле
        return buildField();
      }
      shipId++;
    }
  }

  function placeShipRandom(id, size){
    const tries = 2000;
    for (let t=0; t<tries; t++){
      const vertical = Math.random() < 0.5;
      const r0 = Math.floor(Math.random() * SIZE);
      const c0 = Math.floor(Math.random() * SIZE);

      const cells = [];
      for (let k=0; k<size; k++){
        const r = r0 + (vertical ? k : 0);
        const c = c0 + (vertical ? 0 : k);
        if (!inBounds(r,c)) { cells.length = 0; break; }
        cells.push({r,c});
      }
      if (cells.length !== size) continue;

      // check empty + no-touch around
      if (!canPlaceCells(cells)) continue;

      // place
      state.ships[id] = { id, cells, hits: 0, size, sunk: false };
      for (const {r,c} of cells){
        state.grid[r][c].shipId = id;
      }
      return true;
    }
    return false;
  }

  function canPlaceCells(cells){
    // cannot overlap
    for (const {r,c} of cells){
      if (state.grid[r][c].shipId != null) return false;
    }
    // no-touch (including corners): check neighborhood around each cell
    for (const {r,c} of cells){
      for (let dr=-1; dr<=1; dr++){
        for (let dc=-1; dc<=1; dc++){
          const rr = r + dr, cc = c + dc;
          if (!inBounds(rr,cc)) continue;
          if (state.grid[rr][cc].shipId != null) return false;
        }
      }
    }
    return true;
  }

  // ===== Gameplay =====
  function onCellClick(e){
    const r = parseInt(e.currentTarget.dataset.r, 10);
    const c = parseInt(e.currentTarget.dataset.c, 10);
    fireAt(r,c);
  }

  function fireFromInput(){
    if (state.paused || state.finished) return;
    const rc = coordToRC(elCoord.value);
    if (!rc) {
      flashResult("Невірна координата. Приклад: B7 або J10");
      return;
    }
    fireAt(rc.r, rc.c);
  }

  function fireAt(r,c){
    if (state.paused || state.finished) return;

    const g = state.grid[r][c];
    if (g.fired) {
      flashResult(`Клітинка ${rcToCoord(r,c)} вже відкрита`);
      return;
    }

    g.fired = true;

    if (g.shipId == null){
      // miss
      flashResult(`💦 Промах: ${rcToCoord(r,c)} — хід іншої команди`);
      switchTeam();
    } else {
      // hit
      const ship = state.ships[g.shipId];
      ship.hits += 1;
      addScore(state.team, SCORE_HIT);

      if (ship.hits >= ship.size && !ship.sunk){
        ship.sunk = true;
        addScore(state.team, SCORE_SUNK_BONUS);
        flashResult(`💥 Потоплено корабель! (+${SCORE_HIT} + ${SCORE_SUNK_BONUS}) Хід зберігається`);
      } else {
        flashResult(`🎯 Влучання: ${rcToCoord(r,c)} (+${SCORE_HIT}) Хід зберігається`);
      }

      // if all ships sunk -> finish
      if (state.ships.every(s => s && s.sunk)){
        finishGame(true);
      }
    }

    renderAll();
    elCoord.value = "";
    elCoord.focus();
  }

  function flashResult(text){
    elResult.textContent = text;
  }

  // ===== Timer =====
  function renderTimer(){
    const s = Math.max(0, state.secondsLeft);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    elTimer.textContent = `${mm}:${ss}`;
  }

  function tick(){
    if (state.paused || state.finished) return;
    state.secondsLeft -= 1;
    renderTimer();
    if (state.secondsLeft <= 0){
      finishGame();
    }
  }

  function startTimer(){
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.timerHandle = setInterval(tick, 1000);
  }

  function togglePause(){
    if (state.finished) return;
    state.paused = !state.paused;
    document.getElementById("btnPause").textContent = state.paused ? "Продовжити" : "Пауза";
    flashResult(state.paused ? "⏸ Пауза" : "▶ Продовжуємо");
    renderAll();
  }

  function adjustTime(delta){
    if (state.finished) return;
    state.secondsLeft = Math.max(60, state.secondsLeft + delta);
    renderTimer();
  }

  // ===== Finish / New =====
  function finishGame(autoAllSunk=false){
    if (state.finished) return;
    state.finished = true;
    renderAll();

    let text;
    if (autoAllSunk){
      text = "✅ Всі кораблі знищено!";
    } else if (state.secondsLeft <= 0){
      text = "⏱ Час вийшов!";
    } else {
      text = "🏁 Гру завершено!";
    }

    const s1 = state.score1, s2 = state.score2;
    let winner = "Нічия";
    if (s1 > s2) winner = "Перемогла Команда 1";
    if (s2 > s1) winner = "Перемогла Команда 2";

    flashResult(`${text} • ${winner} • Рахунок: ${s1}:${s2}`);
  }

  function newGame(){
    state.team = 1;
    state.score1 = 0;
    state.score2 = 0;
    state.paused = false;
    state.finished = false;
    state.secondsLeft = 10 * 60;
    document.getElementById("btnPause").textContent = "Пауза";
    document.getElementById("toggleReveal").checked = false;
    state.reveal = false;

    buildField();
    buildBoardUI();
    renderAll();
    startTimer();
    flashResult("Нова гра. Команда 1 починає!");
    elCoord.value = "";
    elCoord.focus();
  }

  // ===== Boot =====
  buildBoardUI();
  newGame();
})();
