// Keyboard and mouse, read as a state each frame: a movement vector, one-shot
// actions (confirm, pause, mute, level-up picks) and the mouse position in canvas
// pixels, for the level-up cards and the buttons.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pick = 0;
  let click = null;
  let mouse = { x: 0, y: 0 };

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    if (MOVE_KEYS[event.code]) held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Digit1' || event.code === 'Numpad1') pick = 1;
    if (event.code === 'Digit2' || event.code === 'Numpad2') pick = 2;
    if (event.code === 'Digit3' || event.code === 'Numpad3') pick = 3;
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseDown(event) {
    click = canvasPoint(event);
    actions |= ACTION_CONFIRM;
  }
  function onMouseMove(event) {
    mouse = canvasPoint(event);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);

  return {
    /** Normalised movement vector from the held keys, or {x:0, y:0}. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    /** One-shot actions since the last call; reading them clears them. */
    takeActions() {
      const value = actions;
      actions = 0;
      return value;
    },
    /** Level-up pick (1-3) since the last call; reading it clears it. */
    takePick() {
      const value = pick;
      pick = 0;
      return value;
    },
    /** Mouse click position since the last call, or null. */
    takeClick() {
      const value = click;
      click = null;
      return value;
    },
    mouse() {
      return mouse;
    },
  };
}
