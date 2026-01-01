(() => {
  // ===== Config =====
  const SIZE = 10;

  // Алфавіт координат (замість A–J)
  const AXIS = ["Д", "З", "И", "Г", "А", "Р", "К", "У", "Р", "І"];

  const SHIPS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const SCORE_HIT = 1;
  const SCORE_SUNK_BONUS = 2;

  // ===== State =====
  const state = {
    grid: [],
    ships: [],
    team: 1,
    score1: 0,
    score2: 0,
    paused: false,
    reveal: false,
    finished: false,
  };

  // ===== DOM =====
  const elBoard = document.getElementById("board");
  const elTurn = document.getElementById("turnBadge");
  const elS1 = document.getElementById("score1");
  const elS2 = document.getElementById("score2");
  const elResult = document.getElementById("resultText");
  const elFleet = document.getElementById("fleet");

  document.getElementById("btnNew")?.addEventListener("click", newGame);
  document.getElementById("btnReset")?.addEventListener("click", () => {
    if (state.finished) return;
    buildField();
    renderAll();
    flashResult("Поле перегенеровано");
  });
  document.getElementById("btnPause")?.addEventListener("click", togglePause);
  document.getElementById("btnFinish")?.addEventListener("click", () => finishGame(false));

  document.getElementById("toggleReveal")?.addEventListener("change", (e) => {
    state.reveal = !!e.target.checked;
    renderAll();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") togglePause();
  });

  // ===== Helpers =====
  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

  function rcToCoord(r, c) {
    return `${AXIS[c]}${r + 1}`;
  }

  function setTurnBadge() {
    elTurn.textContent = `Хід: Команда ${state.team}`;
    elTurn.style.background =
      state.team === 1 ? "rgba(124,196,255,.14)" : "rgba(255,179,179,.14)";
    elTurn.style.borderColor =
      state.team === 1 ? "rgba(124,196,255,.25)" : "rgba(255,179,179,.25)";
  }

  function addScore(team, points) {
    if (team === 1) state.score1 += points;
    else state.score2 += points;
    elS1.textContent = state.score1;
    elS2.textContent = state.score2;
  }

  function switchTeam() {
    state.team = state.team === 1 ? 2 : 1;
    setTurnBadge();
  }

  function flashResult(text) {
    if (elResult) elResult.textContent = text;
  }

  // ===== Board =====
  function initGrid() {
    state.grid = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => ({ shipId: null, fired: false }))
    );
    state.ships = [];
  }

  function buildBoardUI() {
    elBoard.innerHTML = "";

    for (let r = -1; r < SIZE; r++) {
      for (let c = -1; c < SIZE; c++) {
        const d = document.createElement("div");
        d.className = "cell";

        if (r === -1 && c === -1) {
          d.classList.add("header");
        } else if (r === -1) {
          d.classList.add("header");
          d.textContent = AXIS[c];
        } else if (c === -1) {
          d.classList.add("header");
          d.textContent = r + 1;
        } else {
          d.classList.add("playable");
          d.dataset.r = r;
          d.dataset.c = c;
          d.addEventListener("click", onCellClick);
        }

        elBoard.appendChild(d);
      }
    }
  }

  function renderFleet() {
    if (!elFleet) return;

    const ordered = [...state.ships].sort((a, b) => b.size - a.size || a.id - b.id
