(function () {
  const {
    createInitialState,
    setDirection,
    togglePause,
    advanceState,
  } = window.SnakeCore;

  const GRID_WIDTH = 30;
  const GRID_HEIGHT = 18;
  const TICK_MS = 120;
  const SONG_BPM = 120;
  const STEPS_PER_BEAT = 4;
  const STEPS_PER_BAR = 16;
  const TOTAL_BARS = 60;
  const TOTAL_STEPS = TOTAL_BARS * STEPS_PER_BAR;
  const STEP_MS = (60 / SONG_BPM / STEPS_PER_BEAT) * 1000;

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const stateTextEl = document.getElementById("state-text");
  const pauseBtn = document.getElementById("pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const muteBtn = document.getElementById("mute-btn");
  const dirButtons = Array.from(document.querySelectorAll("[data-dir]"));

  let state = createInitialState({ gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT });
  let isMuted = false;

  const audio = {
    ctx: null,
    mixGain: null,
    compressor: null,
    delay: null,
    feedback: null,
    delayWet: null,
    noteLoop: null,
    songStep: 0,
  };
  const leadA = [64, null, 67, null, 71, null, 67, null, 64, null, 62, null, 59, null, 62, null];
  const leadB = [67, null, 71, null, 74, null, 71, null, 67, null, 66, null, 64, null, 62, null];
  const leadC = [71, 72, 74, 76, 74, 72, 71, 69, 67, 69, 71, 72, 74, 72, 71, 69];
  const leadD = [76, 74, 72, 71, 72, 74, 76, 79, 76, 74, 72, 71, 69, 71, 72, 74];
  const bassA = [40, null, null, null, 40, null, null, null, 43, null, null, null, 38, null, null, null];
  const bassB = [43, null, null, null, 43, null, null, null, 47, null, null, null, 45, null, null, null];
  const bassC = [35, null, 35, null, 38, null, 38, null, 40, null, 40, null, 43, null, 43, null];
  const kickPattern = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0];
  const snarePattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
  const hatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];

  function ensureAudioReady() {
    if (audio.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audio.ctx = new AudioCtx();
    audio.compressor = audio.ctx.createDynamicsCompressor();
    audio.compressor.threshold.value = -24;
    audio.compressor.knee.value = 16;
    audio.compressor.ratio.value = 7;
    audio.compressor.attack.value = 0.003;
    audio.compressor.release.value = 0.2;

    audio.mixGain = audio.ctx.createGain();
    audio.mixGain.gain.value = 0.14;
    audio.delay = audio.ctx.createDelay();
    audio.delay.delayTime.value = 0.2;
    audio.feedback = audio.ctx.createGain();
    audio.feedback.gain.value = 0.28;
    audio.delayWet = audio.ctx.createGain();
    audio.delayWet.gain.value = 0.16;

    audio.mixGain.connect(audio.compressor);
    audio.mixGain.connect(audio.delay);
    audio.delay.connect(audio.feedback);
    audio.feedback.connect(audio.delay);
    audio.delay.connect(audio.delayWet);
    audio.delayWet.connect(audio.compressor);
    audio.compressor.connect(audio.ctx.destination);
  }

  function midiToHz(midi) {
    return 440 * (2 ** ((midi - 69) / 12));
  }

  function playToneAt(time, type, frequency, volume, attack, decay) {
    if (!audio.ctx || !audio.mixGain) return;

    const osc = audio.ctx.createOscillator();
    const envelope = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);

    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(envelope);
    envelope.connect(audio.mixGain);
    osc.start(time);
    osc.stop(time + decay + 0.03);
  }

  function playNoiseHitAt(time, volume, decay, tone) {
    if (!audio.ctx || !audio.mixGain) return;
    const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 0.08, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = tone === "snare" ? 1200 : 3000;
    const envelope = audio.ctx.createGain();
    envelope.gain.setValueAtTime(volume, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(audio.mixGain);
    source.start(time);
    source.stop(time + decay + 0.03);
  }

  function playKickAt(time) {
    if (!audio.ctx || !audio.mixGain) return;
    const osc = audio.ctx.createOscillator();
    const envelope = audio.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    envelope.gain.setValueAtTime(0.28, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    osc.connect(envelope);
    envelope.connect(audio.mixGain);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  function sectionForBar(bar) {
    if (bar < 8) return { lead: leadA, bass: bassA, hats: 0.25, snareBoost: 0.65, octave: 0 };
    if (bar < 20) return { lead: leadB, bass: bassA, hats: 0.55, snareBoost: 0.9, octave: 0 };
    if (bar < 28) return { lead: leadC, bass: bassB, hats: 0.85, snareBoost: 1.1, octave: 0 };
    if (bar < 40) return { lead: leadD, bass: bassC, hats: 1.0, snareBoost: 1.2, octave: 12 };
    if (bar < 48) return { lead: leadC, bass: bassB, hats: 0.5, snareBoost: 0.95, octave: -12 };
    return { lead: leadD, bass: bassC, hats: 1.0, snareBoost: 1.3, octave: 12 };
  }

  function playStep() {
    if (!audio.ctx) return;
    const step = audio.songStep % TOTAL_STEPS;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const stepInBar = step % STEPS_PER_BAR;
    const section = sectionForBar(bar);
    const time = audio.ctx.currentTime;

    const leadNote = section.lead[stepInBar];
    if (leadNote !== null) {
      playToneAt(time, "sawtooth", midiToHz(leadNote + section.octave), 0.18, 0.004, 0.12);
      if (bar >= 20) {
        playToneAt(time, "square", midiToHz(leadNote + section.octave + 7), 0.08, 0.004, 0.1);
      }
    }

    const bassNote = section.bass[stepInBar];
    if (bassNote !== null) {
      playToneAt(time, "triangle", midiToHz(bassNote), 0.2, 0.003, 0.16);
    }

    if (kickPattern[stepInBar]) playKickAt(time);
    if (snarePattern[stepInBar]) playNoiseHitAt(time, 0.14 * section.snareBoost, 0.11, "snare");
    if (hatPattern[stepInBar] && Math.random() < section.hats) {
      playNoiseHitAt(time, 0.04 + section.hats * 0.03, 0.045, "hat");
    }

    audio.songStep = (audio.songStep + 1) % TOTAL_STEPS;
  }

  function stopMusic() {
    if (!audio.noteLoop) return;
    clearInterval(audio.noteLoop);
    audio.noteLoop = null;
  }

  function startMusic() {
    if (audio.noteLoop) return;
    playStep();
    audio.noteLoop = setInterval(playStep, STEP_MS);
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
    boardEl.style.setProperty("--board-cols", String(state.gridWidth));
    boardEl.style.setProperty("--board-rows", String(state.gridHeight));

    const snakeIndexByCell = new Map(
      state.snake.map((segment, index) => [`${segment.x},${segment.y}`, index])
    );
    const foodKey = state.food ? `${state.food.x},${state.food.y}` : "";

    boardEl.innerHTML = "";
    for (let y = 0; y < state.gridHeight; y += 1) {
      for (let x = 0; x < state.gridWidth; x += 1) {
        const cell = document.createElement("div");
        const key = `${x},${y}`;
        cell.className = `cell ${((x + y) % 2 === 0) ? "terrain-a" : "terrain-b"}`;

        const snakeIndex = snakeIndexByCell.get(key);
        if (snakeIndex !== undefined) {
          if (snakeIndex === 0) {
            cell.classList.add("snake-head", `dir-${state.direction}`);
          } else if (snakeIndex === state.snake.length - 1) {
            cell.classList.add("snake-tail");
          } else {
            cell.classList.add("snake-body");
          }
        } else if (key === foodKey) {
          cell.classList.add("apple");
        }
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
    state = createInitialState({ gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT });
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
