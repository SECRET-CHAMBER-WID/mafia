import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, remove, runTransaction } from "firebase/database";
import { firebaseConfig } from "./firebaseConfig";

const PRIVATE_PREFIX = "deep-network-private:";
const SHARED_PREFIX = "deep-network-shared:";

const params = new URLSearchParams(window.location.search);
const roomFromUrl = params.get("room") || window.location.hash.replace(/^#\/?/, "");
export const roomId = sanitizeRoom(roomFromUrl || "main");

function sanitizeRoom(value) {
  return String(value)
    .trim()
    .replace(/[.#$/[\]\s]/g, "-")
    .slice(0, 48) || "main";
}

function isConfigured(config) {
  return Boolean(
    config?.apiKey &&
      config?.databaseURL &&
      !String(config.apiKey).startsWith("PASTE_") &&
      !String(config.databaseURL).includes("PASTE_PROJECT_ID")
  );
}

const firebaseReady = isConfigured(firebaseConfig);
const app = firebaseReady ? initializeApp(firebaseConfig) : null;
const db = firebaseReady ? getDatabase(app) : null;

function privateKey(key) {
  return `${PRIVATE_PREFIX}${key}`;
}

function sharedFallbackKey(key) {
  return `${SHARED_PREFIX}${roomId}:${key}`;
}

function sharedPath(key) {
  return `rooms/${roomId}/${key}`;
}

async function getValue(key, shared = true) {
  if (!shared) {
    const value = localStorage.getItem(privateKey(key));
    return value == null ? null : { value };
  }

  if (!firebaseReady) {
    const value = localStorage.getItem(sharedFallbackKey(key));
    return value == null ? null : { value };
  }

  const snap = await get(ref(db, sharedPath(key)));
  if (!snap.exists()) return null;
  return { value: snap.val() };
}

async function setValue(key, value, shared = true) {
  if (!shared) {
    localStorage.setItem(privateKey(key), value);
    return;
  }

  if (!firebaseReady) {
    localStorage.setItem(sharedFallbackKey(key), value);
    return;
  }

  await set(ref(db, sharedPath(key)), value);
}

async function deleteValue(key, shared = true) {
  if (!shared) {
    localStorage.removeItem(privateKey(key));
    return;
  }

  if (!firebaseReady) {
    localStorage.removeItem(sharedFallbackKey(key));
    return;
  }

  await remove(ref(db, sharedPath(key)));
}

async function transactionValue(key, updater, shared = true) {
  if (!shared) {
    const current = localStorage.getItem(privateKey(key));
    const parsed = current == null ? null : JSON.parse(current);
    const next = updater(parsed);
    localStorage.setItem(privateKey(key), JSON.stringify(next));
    return next;
  }

  if (!firebaseReady) {
    const current = localStorage.getItem(sharedFallbackKey(key));
    const parsed = current == null ? null : JSON.parse(current);
    const next = updater(parsed);
    localStorage.setItem(sharedFallbackKey(key), JSON.stringify(next));
    return next;
  }

  let committedValue = null;
  const result = await runTransaction(ref(db, sharedPath(key)), (current) => {
    let parsed = null;
    if (typeof current === "string") {
      try {
        parsed = JSON.parse(current);
      } catch {
        parsed = current;
      }
    } else {
      parsed = current;
    }
    const next = updater(parsed);
    committedValue = next;
    return JSON.stringify(next);
  });

  if (result.snapshot.exists()) {
    try {
      return JSON.parse(result.snapshot.val());
    } catch {
      return committedValue;
    }
  }

  return committedValue;
}

window.storage = {
  get: getValue,
  set: setValue,
  delete: deleteValue,
  transaction: transactionValue,
  meta: {
    firebaseReady,
    roomId,
  },
};
