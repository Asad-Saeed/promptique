import { optimizePrompt, PromptiqueError } from "./core.js";

const els = {
  input: document.getElementById("userPrompt"),
  btn: document.getElementById("optimizeBtn"),
  result: document.getElementById("result"),
  resultText: document.getElementById("resultText"),
  copyBtn: document.getElementById("copyBtn"),
  copiedFlash: document.getElementById("copiedFlash"),
  error: document.getElementById("errorBanner"),
  clearBtn: document.getElementById("clearBtn"),
};

const EMPTY_TEXT = "Your optimized prompt will appear here.";
const SPINNER_HTML = '<span class="spinner" aria-hidden="true"></span>';
const BTN_LABEL = "Optimize";

let lastOutput = "";

function showError(msg) {
  els.error.textContent = msg;
  els.error.classList.add("show");
}

function clearError() {
  els.error.textContent = "";
  els.error.classList.remove("show");
}

function setResult(text) {
  lastOutput = text || "";
  if (!text) {
    els.result.classList.add("is-empty");
    els.resultText.textContent = EMPTY_TEXT;
    els.copyBtn.hidden = true;
    els.clearBtn.hidden = true;
    return;
  }
  els.result.classList.remove("is-empty");
  els.resultText.textContent = text;
  els.copyBtn.hidden = false;
  els.clearBtn.hidden = false;
}

function setLoading(on) {
  els.btn.disabled = on;
  els.btn.innerHTML = on ? SPINNER_HTML : BTN_LABEL;
}

async function handleOptimize() {
  clearError();
  const input = els.input.value;
  if (!input.trim()) {
    showError("Enter a prompt first.");
    return;
  }

  setLoading(true);
  setResult("");
  try {
    const output = await optimizePrompt(input);
    setResult(output);
  } catch (err) {
    const msg =
      err instanceof PromptiqueError ? err.message : "Unexpected error.";
    showError(msg);
  } finally {
    setLoading(false);
  }
}

async function handleCopy() {
  if (!lastOutput) return;
  try {
    await navigator.clipboard.writeText(lastOutput);
    els.copiedFlash.classList.add("show");
    setTimeout(() => els.copiedFlash.classList.remove("show"), 1500);
  } catch {
    showError("Could not copy to clipboard.");
  }
}

function handleClear() {
  els.input.value = "";
  setResult("");
  clearError();
  els.input.focus();
}

els.btn.addEventListener("click", handleOptimize);
els.copyBtn.addEventListener("click", handleCopy);
els.clearBtn.addEventListener("click", handleClear);
els.input.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    handleOptimize();
  }
});
els.input.addEventListener("input", clearError);
