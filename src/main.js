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
  const muteBtn = document.getElementById("mute-btn");
  const dirButtons = Array.from(document.querySelectorAll("[data-dir]"));

  let state = createInitialState({ gridSize: GRID_SIZE });
  let isMuted = false;

  const audio = {
    ctx: null,
    mixGain: null,
    noteLoop: null,
    noteIndex: 0,
  };
  const melody = [261.63, 293.66, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0];

  function ensureAudioReady() {
    if (audio.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audio.ctx = new AudioCtx();
    audio.mixGain = audio.ctx.createGain();
    audio.mixGain.gain.value = 0.03;
    audio.mixGain.connect(audio.ctx.destination);
  }

  function playNextNote() {
    if (!audio.ctx || !audio.mixGain) return;
    const frequency = melody[audio.noteIndex % melody.length];
    audio.noteIndex += 1;

    const osc = audio.ctx.createOscillator();
    const envelope = audio.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(frequency, audio.ctx.currentTime);

    envelope.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.08, audio.ctx.currentTime + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.22);

    osc.connect(envelope);
    envelope.connect(audio.mixGain);
    osc.start();
    osc.stop(audio.ctx.currentTime + 0.24);
  }

  function stopMusic() {
    if (!audio.noteLoop) return;
    clearInterval(audio.noteLoop);
    audio.noteLoop = null;
  }

  function startMusic() {
    if (audio.noteLoop) return;
    audio.noteLoop = setInterval(playNextNote, 250);
  }

  function updateMusicState() {
    if (isMuted || state.isPaused || state.isGameOver) {
      stopMusic();
      return;
    }
    if (!audio.ctx || !audio.mixGain) return;
    startMusic();
  }

  function syncMuteButton() {
    muteBtn.textContent = isMuted ? "Unmute" : "Mute";
    muteBtn.setAttribute("aria-pressed", String(isMuted));
  }

  function activateAudio() {
    ensureAudioReady();
    if (audio.ctx && audio.ctx.state === "suspended") {
      audio.ctx.resume().catch(() => {});
    }
    updateMusicState();
  }

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
    syncMuteButton();
    updateMusicState();
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
    activateAudio();
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
    activateAudio();
    state = togglePause(state);
    render();
  });

  restartBtn.addEventListener("click", () => {
    activateAudio();
    restart();
  });
  muteBtn.addEventListener("click", () => {
    activateAudio();
    isMuted = !isMuted;
    if (isMuted) stopMusic();
    render();
  });
  dirButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activateAudio();
      handleDirectionInput(btn.dataset.dir);
    });
  });

  setInterval(() => {
    state = advanceState(state);
    render();
  }, TICK_MS);

  render();
})();
