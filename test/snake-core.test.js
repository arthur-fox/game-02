const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createInitialState,
  setDirection,
  advanceState,
  spawnFood,
  togglePause,
} = require("../src/snake-core");

function rngFrom(values) {
  let i = 0;
  return () => {
    const value = values[i] ?? values[values.length - 1] ?? 0;
    i += 1;
    return value;
  };
}

test("snake moves one step in current direction", () => {
  let state = createInitialState({ gridSize: 10, rng: () => 0 });
  const prev = state.snake.map((p) => ({ ...p }));
  state = advanceState(state, () => 0);
  assert.deepEqual(state.snake[0], { x: prev[0].x + 1, y: prev[0].y });
  assert.equal(state.snake.length, prev.length);
});

test("reverse direction input is ignored", () => {
  const state = createInitialState({ gridSize: 10, rng: () => 0 });
  const next = setDirection(state, "left");
  assert.equal(next.nextDirection, "right");
});

test("snake grows and score increments when food is eaten", () => {
  let state = createInitialState({ gridSize: 10, rng: () => 0 });
  state = {
    ...state,
    food: { x: state.snake[0].x + 1, y: state.snake[0].y },
  };
  const beforeLength = state.snake.length;
  state = advanceState(state, () => 0.5);
  assert.equal(state.snake.length, beforeLength + 1);
  assert.equal(state.score, 1);
});

test("hitting boundary triggers game over", () => {
  let state = createInitialState({ gridSize: 5, rng: () => 0 });
  state = {
    ...state,
    snake: [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }],
    direction: "right",
    nextDirection: "right",
  };
  state = advanceState(state, () => 0);
  assert.equal(state.isGameOver, true);
});

test("food spawns on empty cell only", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];
  const food = spawnFood(snake, 3, rngFrom([0]));
  assert.notDeepEqual(food, { x: 0, y: 0 });
  assert.notDeepEqual(food, { x: 1, y: 0 });
  assert.notDeepEqual(food, { x: 2, y: 0 });
});

test("paused game does not advance until resumed", () => {
  let state = createInitialState({ gridSize: 10, rng: () => 0 });
  state = togglePause(state);
  const pausedHead = { ...state.snake[0] };
  state = advanceState(state, () => 0);
  assert.deepEqual(state.snake[0], pausedHead);
  state = togglePause(state);
  state = advanceState(state, () => 0);
  assert.notDeepEqual(state.snake[0], pausedHead);
});
