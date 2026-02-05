(function () {
  const {
    createInitialState,
    setDirection,
    togglePause,
    advanceState,
  } = window.SnakeCore;

  const GRID_SIZE = 20;
  const TICK_MS = 120;

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const stateTextEl = document.getElementById("state-text");
  const pauseBtn = document.getElementById("pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const dirButtons = Array.from(document.querySelectorAll("[data-dir]"));

  let state = createInitialState({ gridSize: GRID_SIZE });

  function render() {
    const snakeSet = new Set(state.snake.map((p) => `${p.x},${p.y}`));
    const foodKey = state.food ? `${state.food.x},${state.food.y}` : "";

    boardEl.innerHTML = "";
    for (let y = 0; y < state.gridSize; y += 1) {
      for (let x = 0; x < state.gridSize; x += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";
        const key = `${x},${y}`;
        if (snakeSet.has(key)) cell.classList.add("snake");
        if (key === foodKey) cell.classList.add("food");
        boardEl.appendChild(cell);
      }
    }

    scoreEl.textContent = String(state.score);
    if (state.isGameOver) stateTextEl.textContent = "Game Over";
    else if (state.isPaused) stateTextEl.textContent = "Paused";
    else stateTextEl.textContent = "Running";
    pauseBtn.textContent = state.isPaused ? "Resume" : "Pause";
  }

  function restart() {
    state = createInitialState({ gridSize: GRID_SIZE });
    render();
  }

  function handleDirectionInput(dir) {
    state = setDirection(state, dir);
    render();
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const map = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };
    if (map[key]) {
      event.preventDefault();
      handleDirectionInput(map[key]);
      return;
    }
    if (key === " ") {
      event.preventDefault();
      state = togglePause(state);
      render();
      return;
    }
    if (key === "r") {
      restart();
    }
  });

  pauseBtn.addEventListener("click", () => {
    state = togglePause(state);
    render();
  });

  restartBtn.addEventListener("click", restart);
  dirButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      handleDirectionInput(btn.dataset.dir);
    });
  });

  setInterval(() => {
    state = advanceState(state);
    render();
  }, TICK_MS);

  render();
})();
