// BYOK settings: injects the modal, wires save/clear, syncs the key pill.

import { getUserKey, setUserKey, clearUserKey } from "./userKey.js";

const MODAL_HTML = `
<div class="settings-backdrop" data-promptique-settings hidden>
  <div class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="promptiqueSettingsTitle">
    <button class="icon-btn settings-close" data-settings-close aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <h2 class="settings-title" id="promptiqueSettingsTitle">Your Gemini key</h2>
    <p class="settings-prefix" data-settings-prefix hidden></p>
    <p class="settings-body">Use your own free Gemini key. It is stored only on this device — Promptique's server never sees it.</p>
    <p class="settings-link"><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get a free key →</a></p>
    <input type="password" class="input settings-input" data-settings-input placeholder="Paste your Gemini API key" autocomplete="off" spellcheck="false" />
    <p class="settings-error" data-settings-error hidden></p>
    <p class="settings-saved" data-settings-saved hidden>Key saved on this device.</p>
    <div class="settings-actions">
      <button class="btn btn-secondary" data-settings-clear>Clear</button>
      <button class="btn" data-settings-save>Save</button>
    </div>
    <p class="settings-foot">Your key never leaves this device. The Promptique proxy is bypassed when a personal key is saved.</p>
  </div>
</div>
`;

let backdrop, input, errorEl, prefixEl, savedEl, saveBtn, clearBtn;
let pillEl, keydownHandler;
let initialized = false;

export async function initSettings({ pillSelector = "[data-key-pill]" } = {}) {
  if (initialized) {
    pillEl = document.querySelector(pillSelector) || pillEl;
    await refreshKeyStatus();
    return;
  }

  if (!document.querySelector("[data-promptique-settings]")) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = MODAL_HTML.trim();
    document.body.appendChild(wrapper.firstElementChild);
  }

  backdrop = document.querySelector("[data-promptique-settings]");
  input = backdrop.querySelector("[data-settings-input]");
  errorEl = backdrop.querySelector("[data-settings-error]");
  prefixEl = backdrop.querySelector("[data-settings-prefix]");
  savedEl = backdrop.querySelector("[data-settings-saved]");
  saveBtn = backdrop.querySelector("[data-settings-save]");
  clearBtn = backdrop.querySelector("[data-settings-clear]");
  pillEl = document.querySelector(pillSelector);

  saveBtn.addEventListener("click", handleSave);
  clearBtn.addEventListener("click", handleClear);
  backdrop
    .querySelectorAll("[data-settings-close]")
    .forEach((el) => el.addEventListener("click", closeSettings));
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeSettings();
  });
  input.addEventListener("input", () => {
    errorEl.hidden = true;
    errorEl.textContent = "";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  });

  initialized = true;
  await refreshKeyStatus();
}

export async function openSettings(prefixCopy) {
  if (!initialized || !backdrop) return;
  if (prefixCopy) {
    prefixEl.textContent = prefixCopy;
    prefixEl.hidden = false;
  } else {
    prefixEl.textContent = "";
    prefixEl.hidden = true;
  }
  errorEl.textContent = "";
  errorEl.hidden = true;
  savedEl.hidden = !(await getUserKey());
  input.value = "";
  backdrop.hidden = false;
  setTimeout(() => input.focus(), 0);
  keydownHandler = (e) => {
    if (e.key === "Escape") closeSettings();
  };
  document.addEventListener("keydown", keydownHandler);
}

export function closeSettings() {
  if (!backdrop) return;
  backdrop.hidden = true;
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
}

export async function refreshKeyStatus() {
  if (!pillEl) return;
  const key = await getUserKey();
  pillEl.hidden = !key;
}

async function handleSave() {
  const value = input.value.trim();
  if (!value) {
    errorEl.textContent = "Paste a key first.";
    errorEl.hidden = false;
    return;
  }
  await setUserKey(value);
  await refreshKeyStatus();
  closeSettings();
}

async function handleClear() {
  await clearUserKey();
  input.value = "";
  savedEl.hidden = true;
  await refreshKeyStatus();
}
