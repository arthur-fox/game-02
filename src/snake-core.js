(function () {
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  function createInitialState(options) {
    const gridWidth = options?.gridWidth ?? options?.gridSize ?? 20;
    const gridHeight = options?.gridHeight ?? options?.gridSize ?? 20;
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);
    const snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    return {
      // Keep gridSize for backward compatibility with existing callers/tests.
      gridSize: options?.gridSize ?? gridWidth,
      gridWidth,
      gridHeight,
      snake,
      direction: "right",
      nextDirection: "right",
      food: spawnFood(snake, gridWidth, gridHeight, options?.rng),
      score: 0,
      isGameOver: false,
      isPaused: false,
    };
  }

  function isOpposite(a, b) {
    return (
      (a === "up" && b === "down") ||
      (a === "down" && b === "up") ||
      (a === "left" && b === "right") ||
      (a === "right" && b === "left")
    );
  }

  function setDirection(state, direction) {
    if (!DIRECTIONS[direction]) return state;
    if (isOpposite(state.direction, direction)) return state;
    return { ...state, nextDirection: direction };
  }

  function togglePause(state) {
    if (state.isGameOver) return state;
    return { ...state, isPaused: !state.isPaused };
  }

  function pointsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function outOfBounds(point, gridWidth, gridHeight) {
    return point.x < 0 || point.y < 0 || point.x >= gridWidth || point.y >= gridHeight;
  }

  function advanceState(state, rng) {
    if (state.isGameOver || state.isPaused) return state;

    const move = DIRECTIONS[state.nextDirection];
    const head = state.snake[0];
    const nextHead = { x: head.x + move.x, y: head.y + move.y };

    if (outOfBounds(nextHead, state.gridWidth ?? state.gridSize, state.gridHeight ?? state.gridSize)) {
      return { ...state, direction: state.nextDirection, isGameOver: true };
    }

    const willEat = pointsEqual(nextHead, state.food);
    const nextSnake = [nextHead, ...state.snake];
    if (!willEat) nextSnake.pop();

    const hitsSelf = nextSnake.slice(1).some((segment) => pointsEqual(segment, nextHead));
    if (hitsSelf) {
      return {
        ...state,
        direction: state.nextDirection,
        snake: nextSnake,
        isGameOver: true,
      };
    }

    const nextFood = willEat
      ? spawnFood(
        nextSnake,
        state.gridWidth ?? state.gridSize,
        state.gridHeight ?? state.gridSize,
        rng
      )
      : state.food;
    return {
      ...state,
      direction: state.nextDirection,
      snake: nextSnake,
      food: nextFood,
      score: state.score + (willEat ? 1 : 0),
    };
  }

  function spawnFood(snake, gridWidthOrSize, gridHeightOrRng, maybeRngFn) {
    const isSquareCall = typeof gridHeightOrRng === "function" || gridHeightOrRng === undefined;
    const gridWidth = gridWidthOrSize;
    const gridHeight = isSquareCall ? gridWidthOrSize : gridHeightOrRng;
    const rngFn = isSquareCall ? gridHeightOrRng : maybeRngFn;
    const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
    const empty = [];
    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) empty.push({ x, y });
      }
    }
    if (empty.length === 0) return null;
    const rng = rngFn ?? Math.random;
    const index = Math.floor(rng() * empty.length);
    return empty[index];
  }

  const SnakeCore = {
    DIRECTIONS,
    createInitialState,
    setDirection,
    togglePause,
    advanceState,
    spawnFood,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = SnakeCore;
  }
  if (typeof window !== "undefined") {
    window.SnakeCore = SnakeCore;
  }
})();
