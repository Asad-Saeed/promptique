// User key storage: chrome.storage.local (extension) or localStorage (PWA).

const STORAGE_KEY = "promptique:userKey";

function hasChromeStorage() {
  return (
    typeof chrome !== "undefined" &&
    chrome?.storage?.local &&
    typeof chrome.storage.local.get === "function"
  );
}

export async function getUserKey() {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const value = result?.[STORAGE_KEY];
        resolve(typeof value === "string" && value ? value : null);
      });
    });
  }
  if (typeof localStorage !== "undefined") {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  }
  return null;
}

export async function setUserKey(key) {
  const trimmed = (key ?? "").trim();
  if (!trimmed) {
    return clearUserKey();
  }
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: trimmed }, () => resolve());
    });
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, trimmed);
  }
}

export async function clearUserKey() {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([STORAGE_KEY], () => resolve());
    });
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export async function hasUserKey() {
  const key = await getUserKey();
  return Boolean(key);
}
