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

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await openDefaultSplitView(tab);
  } catch (error) {
    console.error("Failed to open Awesome Split", error);
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
        paneCount: message.paneCount,
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
  paneCount,
}) {
  if (!["horizontal", "vertical"].includes(layout)) {
    throw new Error("Invalid split layout");
  }

  const nextPaneCount = paneCount === 3 ? 3 : 2;

  const currentTab = senderTabId
    ? await chrome.tabs.get(senderTabId)
    : await getActiveTab();

  if (!currentTab.id) {
    throw new Error("Current tab is unavailable");
  }

  const sourceUrl = resolvePrimaryUrl(primaryUrl, currentTab.url);
  const targetUrl = secondaryUrl || (await resolveTargetUrl(target, sourceUrl, customUrl));
  const panes = buildInitialPanes({
    paneCount: nextPaneCount,
    primaryUrl: sourceUrl,
    secondaryUrl: targetUrl,
  });
  const splitViewUrl = buildSplitViewUrl({
    layout,
    panes,
    weights: buildEqualWeights(nextPaneCount),
  });

  await chrome.tabs.update(currentTab.id, {
    url: splitViewUrl,
    active: true,
  });

  return {
    currentTabId: currentTab.id,
    layout,
    splitViewUrl,
    paneCount: nextPaneCount,
    panes,
  };
}

async function openDefaultSplitView(clickedTab) {
  const windowId = clickedTab?.windowId ?? (await getActiveTab()).windowId;
  if (windowId === undefined) {
    throw new Error("Current window is unavailable");
  }

  const window = await chrome.windows.get(windowId);
  const tabs = await chrome.tabs.query({ windowId });
  const eligibleTabs = tabs
    .filter((tab) => isEmbeddableTabUrl(tab.url))
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

  if (eligibleTabs.length < 2) {
    throw new Error("Need at least two regular web tabs in this window");
  }

  const panes = eligibleTabs.slice(0, 2).map((tab) => tab.url);
  const layout = chooseLayout(window.width, window.height);
  const splitViewUrl = buildSplitViewUrl({
    layout,
    panes,
    weights: buildEqualWeights(panes.length),
  });

  await chrome.tabs.create({
    windowId,
    url: splitViewUrl,
    active: true,
    index: Math.min((clickedTab?.index ?? eligibleTabs[1].index ?? 1) + 1, tabs.length),
  });
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

function isEmbeddableTabUrl(url) {
  const normalized = normalizeUrl(url);
  return Boolean(normalized) && !normalized.startsWith(chrome.runtime.getURL(""));
}

function chooseLayout(width = 0, height = 0) {
  return width >= height ? "vertical" : "horizontal";
}

function buildInitialPanes({ paneCount, primaryUrl, secondaryUrl }) {
  if (paneCount === 3) {
    return [primaryUrl, secondaryUrl, secondaryUrl];
  }

  return [primaryUrl, secondaryUrl];
}

function buildEqualWeights(paneCount) {
  return Array.from({ length: paneCount }, () => 1 / paneCount);
}

function buildSplitViewUrl({ layout, panes, weights }) {
  const query = new URLSearchParams({
    layout,
    pages: JSON.stringify(panes),
    weights: JSON.stringify(weights),
  });

  return `${chrome.runtime.getURL("split-view.html")}?${query.toString()}`;
}
