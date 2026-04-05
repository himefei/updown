const STORAGE_KEY = "splitSettings";
const DEFAULT_SETTINGS = {
  customUrl: "https://www.google.com/",
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "split:get-settings":
      return getSettings();
    case "split:save-settings":
      return saveSettings(message.payload ?? {});
    case "split:run":
      return splitCurrentTab({
        senderTabId: sender.tab?.id,
        layout: message.layout,
        target: message.target,
        customUrl: message.customUrl,
        primaryUrl: message.primaryUrl,
        secondaryUrl: message.secondaryUrl,
      });
    default:
      throw new Error("Unsupported message type");
  }
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) };
}

async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  return next;
}

async function splitCurrentTab({
  senderTabId,
  layout,
  target,
  customUrl,
  primaryUrl,
  secondaryUrl,
}) {
  if (!["horizontal", "vertical"].includes(layout)) {
    throw new Error("Invalid split layout");
  }

  const currentTab = senderTabId
    ? await chrome.tabs.get(senderTabId)
    : await getActiveTab();

  if (!currentTab.id) {
    throw new Error("Current tab is unavailable");
  }

  const sourceUrl = resolvePrimaryUrl(primaryUrl, currentTab.url);
  const targetUrl = secondaryUrl || (await resolveTargetUrl(target, sourceUrl, customUrl));
  const splitViewUrl = buildSplitViewUrl({
    layout,
    primaryUrl: sourceUrl,
    secondaryUrl: targetUrl,
  });

  await chrome.tabs.update(currentTab.id, {
    url: splitViewUrl,
    active: true,
  });

  return {
    currentTabId: currentTab.id,
    layout,
    splitViewUrl,
    primaryUrl: sourceUrl,
    secondaryUrl: targetUrl,
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) {
    throw new Error("No active tab found");
  }
  return tab;
}

async function resolveTargetUrl(target, currentUrl, customUrl) {
  if (target === "duplicate") {
    return currentUrl;
  }

  if (target === "custom") {
    const url = normalizeUrl(customUrl || (await getSettings()).customUrl);
    if (!url) {
      throw new Error("Custom URL is empty");
    }
    return url;
  }

  throw new Error("Unsupported split target");
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).toString();
  } catch {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return "";
    }
  }
}

function resolvePrimaryUrl(primaryUrl, fallbackUrl) {
  const candidate = primaryUrl || fallbackUrl;
  const normalized = normalizeUrl(candidate);

  if (!normalized) {
    throw new Error("Current page URL is unavailable");
  }

  if (normalized.startsWith(chrome.runtime.getURL(""))) {
    throw new Error("Choose a regular web page before creating a split view");
  }

  return normalized;
}

function buildSplitViewUrl({ layout, primaryUrl, secondaryUrl }) {
  const query = new URLSearchParams({
    layout,
    primary: primaryUrl,
    secondary: secondaryUrl,
  });

  return `${chrome.runtime.getURL("split-view.html")}?${query.toString()}`;
}
