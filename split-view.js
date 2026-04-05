const MAX_PANES = 3;
const MIN_PANES = 2;
const SPLITTER_SIZE = 8;
const MIN_PAIR_RATIO = 0.18;

const root = document.querySelector("#split-root");
const toolbarTabs = document.querySelector("#toolbar-tabs");
const toolbarForm = document.querySelector("#toolbar-form");
const toolbarUrlInput = document.querySelector("#toolbar-url-input");
const addUrlButton = document.querySelector("#add-url-button");
const layoutHorizontalButton = document.querySelector("#layout-horizontal-button");
const layoutVerticalButton = document.querySelector("#layout-vertical-button");
const notice = document.querySelector("#notice");

const state = readStateFromUrl();
const paneNodeById = new Map();
const splitterNodes = [];
let draggedPaneId = null;
let suppressChipClickUntil = 0;

render();
wireEvents();

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const layout = params.get("layout") === "vertical" ? "vertical" : "horizontal";
  const panes = readPanes(params);
  const weights = normalizeWeights(readWeights(params), panes.length);

  return { layout, panes, weights };
}

function readPanes(params) {
  const pagesParam = params.get("pages");
  if (pagesParam) {
    try {
      const pages = JSON.parse(pagesParam);
      const panes = pages
        .map((item) => {
          if (typeof item === "string") {
            return createPane(item);
          }

          return createPane(item?.url, item?.label);
        })
        .filter(Boolean)
        .slice(0, MAX_PANES);

      if (panes.length >= MIN_PANES) {
        return panes;
      }
    } catch {
      // Ignore malformed URL state and fall back to older params.
    }
  }

  const primary = normalizeUrl(params.get("primary")) || "https://example.com/";
  const secondary = normalizeUrl(params.get("secondary")) || "https://www.google.com/";
  return [createPane(primary), createPane(secondary)].filter(Boolean);
}

function readWeights(params) {
  const weightsParam = params.get("weights");
  if (!weightsParam) {
    return [];
  }

  try {
    const weights = JSON.parse(weightsParam);
    return Array.isArray(weights) ? weights : [];
  } catch {
    return [];
  }
}

function wireEvents() {
  document.addEventListener("click", handleDocumentClick);
  root.addEventListener("pointerdown", handleRootPointerDown);
  root.addEventListener("dblclick", handleRootDoubleClick);
  toolbarTabs.addEventListener("click", handleToolbarClick);

  toolbarTabs.addEventListener("dragstart", handleToolbarDragStart);
  toolbarTabs.addEventListener("dragover", handleToolbarDragOver);
  toolbarTabs.addEventListener("dragleave", handleToolbarDragLeave);
  toolbarTabs.addEventListener("drop", handleToolbarDrop);
  toolbarTabs.addEventListener("dragend", clearToolbarDragState);

  toolbarForm.addEventListener("submit", handleToolbarSubmit);
  layoutHorizontalButton.addEventListener("click", () => setLayout("horizontal"));
  layoutVerticalButton.addEventListener("click", () => setLayout("vertical"));
}

function handleDocumentClick(event) {
}

function handleRootPointerDown(event) {
  const splitter = event.target.closest(".splitter");
  if (!splitter) {
    return;
  }

  startResize(event, Number(splitter.dataset.index));
}

function handleRootDoubleClick(event) {
  if (!event.target.closest(".splitter")) {
    return;
  }

  resetSplitWeights();
}

function handleToolbarDragStart(event) {
  const chip = event.target.closest(".toolbar-chip");
  if (!chip) {
    return;
  }

  draggedPaneId = chip.dataset.paneId;
  chip.dataset.dragging = "true";
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", chip.dataset.url || "");
}

function handleToolbarDragOver(event) {
  if (draggedPaneId) {
    event.preventDefault();
  }

  const chip = event.target.closest(".toolbar-chip");
  clearChipDropTargets();
  if (chip) {
    chip.dataset.dropTarget = "true";
  }
}

function handleToolbarDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) {
    return;
  }

  clearToolbarDragState();
}

function handleToolbarDrop(event) {
  event.preventDefault();

  const targetChip = event.target.closest(".toolbar-chip");
  const sourceId = draggedPaneId;
  clearToolbarDragState();
  suppressChipClickUntil = Date.now() + 250;

  if (!sourceId) {
    return;
  }

  reorderPanes(sourceId, targetChip?.dataset.paneId || null);
  flashNotice("Pane order updated");
}

function handleToolbarClick(event) {
  const removeButton = event.target.closest(".toolbar-chip-remove");
  if (removeButton) {
    removePane(Number(removeButton.dataset.index));
    return;
  }

  const chip = event.target.closest(".toolbar-chip");
  if (!chip || Date.now() < suppressChipClickUntil) {
    return;
  }

  const index = Number(chip.dataset.index);
  const nextValue = window.prompt("Enter a URL for this pane", state.panes[index].url);
  if (nextValue === null) {
    return;
  }

  const normalized = resolveInputToUrl(nextValue);
  if (!normalized) {
    flashNotice("Enter a valid page URL", true);
    return;
  }

  state.panes[index] = createPane(normalized);
  render();
  flashNotice("Pane URL updated");
}

function handleToolbarSubmit(event) {
  event.preventDefault();
  const url = resolveInputToUrl(toolbarUrlInput.value.trim());
  if (!url) {
    flashNotice("Enter a valid page URL", true);
    return;
  }

  addPane(url);
  toolbarUrlInput.value = "";
}

function render() {
  renderToolbar();
  renderSplitRoot();
  writeUrlState();
}

function renderToolbar() {
  layoutHorizontalButton.dataset.active = state.layout === "horizontal" ? "true" : "false";
  layoutVerticalButton.dataset.active = state.layout === "vertical" ? "true" : "false";
  toolbarTabs.innerHTML = state.panes
    .map(
      (pane, index) => `
        <div class="toolbar-chip" draggable="true" data-index="${index}" data-pane-id="${pane.id}" data-url="${escapeHtml(pane.url)}">
          <span class="toolbar-chip-index">${index + 1}</span>
          <div class="toolbar-chip-text">
            <span class="toolbar-chip-title">${escapeHtml(pane.label)}</span>
            <span class="toolbar-chip-subtitle">${escapeHtml(compactUrl(pane.url))}</span>
          </div>
          <button class="toolbar-chip-remove" type="button" data-index="${index}" aria-label="Remove page ${index + 1}" ${state.panes.length <= MIN_PANES ? "disabled" : ""}>x</button>
        </div>
      `,
    )
    .join("");

  const canAdd = state.panes.length < MAX_PANES;
  addUrlButton.disabled = !canAdd;
  addUrlButton.textContent = canAdd ? "Add Page" : "3 Pages Max";
  toolbarUrlInput.disabled = !canAdd;
  toolbarUrlInput.placeholder = canAdd ? "https://example.com or youtube.com" : "Maximum 3 pages";
}

function renderSplitRoot() {
  root.dataset.layout = state.layout;
  const activePaneIds = new Set(state.panes.map((pane) => pane.id));
  for (const paneId of paneNodeById.keys()) {
    if (!activePaneIds.has(paneId)) {
      const paneNode = paneNodeById.get(paneId);
      paneNode?.remove();
      paneNodeById.delete(paneId);
    }
  }

  state.panes.forEach((pane, index) => {
    const paneNode = getOrCreatePaneNode(pane);
    syncPaneNode(paneNode, pane, index);
    if (paneNode.parentElement !== root) {
      root.appendChild(paneNode);
    }
  });

  syncSplitterNodes();

  applyLayout();
}

function getOrCreatePaneNode(pane) {
  let paneNode = paneNodeById.get(pane.id);
  if (paneNode) {
    return paneNode;
  }

  paneNode = document.createElement("article");
  paneNode.className = "pane";
  paneNode.dataset.paneId = pane.id;

  const frame = document.createElement("iframe");
  frame.className = "pane-frame";
  frame.referrerPolicy = "no-referrer";

  const badge = document.createElement("div");
  badge.className = "pane-badge";

  paneNode.append(frame, badge);
  paneNodeById.set(pane.id, paneNode);
  return paneNode;
}

function syncPaneNode(paneNode, pane, index) {
  paneNode.dataset.index = String(index);
  const frame = paneNode.querySelector(".pane-frame");
  const badge = paneNode.querySelector(".pane-badge");

  badge.textContent = String(index + 1);
  if (frame.title !== pane.label) {
    frame.title = pane.label;
  }

  if (paneNode.dataset.url !== pane.url) {
    paneNode.dataset.url = pane.url;
    frame.src = pane.url;
  }
}

function createSplitterNode(index) {
  const splitter = document.createElement("div");
  splitter.className = "splitter";
  splitter.dataset.index = String(index);
  splitter.dataset.layout = state.layout;
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-label", "Resize split views");
  return splitter;
}

function applyLayout() {
  state.panes.forEach((pane, index) => {
    const paneNode = paneNodeById.get(pane.id);
    if (!paneNode) {
      return;
    }

    paneNode.style.order = String(index * 2);
    paneNode.style.flex = `${state.weights[index]} 1 0px`;
  });

  splitterNodes.forEach((splitter, index) => {
    const isVisible = index < state.panes.length - 1;
    splitter.hidden = !isVisible;
    splitter.dataset.layout = state.layout;
    splitter.dataset.index = String(index);
    splitter.style.order = String(index * 2 + 1);
    splitter.style.display = isVisible ? "block" : "none";
    splitter.setAttribute("aria-hidden", isVisible ? "false" : "true");
  });
}

function syncSplitterNodes() {
  const neededCount = Math.max(0, state.panes.length - 1);
  while (splitterNodes.length < neededCount) {
    const splitter = createSplitterNode(splitterNodes.length);
    splitterNodes.push(splitter);
    root.appendChild(splitter);
  }
}

function startResize(event, splitterIndex) {
  event.preventDefault();
  const splitter = event.target.closest(".splitter");
  splitter.dataset.dragging = "true";
  splitter.setPointerCapture(event.pointerId);

  const move = (nextEvent) => {
    const bounds = root.getBoundingClientRect();
    const axisSize = state.layout === "vertical" ? bounds.width : bounds.height;
    const axisStart = state.layout === "vertical" ? bounds.left : bounds.top;
    const pointer = state.layout === "vertical" ? nextEvent.clientX : nextEvent.clientY;
    const usableSize = axisSize - (state.panes.length - 1) * SPLITTER_SIZE;
    const beforeWeight = sumWeights(state.weights.slice(0, splitterIndex));
    const pairWeight = state.weights[splitterIndex] + state.weights[splitterIndex + 1];
    const pairStart = axisStart + beforeWeight * usableSize + splitterIndex * SPLITTER_SIZE;
    const pairSize = Math.max(1, pairWeight * usableSize);
    const localRatio = (pointer - pairStart) / pairSize;
    const clampedRatio = clamp(localRatio, MIN_PAIR_RATIO, 1 - MIN_PAIR_RATIO);

    state.weights[splitterIndex] = pairWeight * clampedRatio;
    state.weights[splitterIndex + 1] = pairWeight - state.weights[splitterIndex];
    state.weights = normalizeWeights(state.weights, state.panes.length);
    applyLayout();
  };

  const finish = () => {
    splitter.dataset.dragging = "false";
    if (splitter.hasPointerCapture(event.pointerId)) {
      splitter.releasePointerCapture(event.pointerId);
    }
    splitter.removeEventListener("pointermove", move);
    splitter.removeEventListener("pointerup", finish);
    splitter.removeEventListener("pointercancel", finish);
    writeUrlState();
  };

  splitter.addEventListener("pointermove", move);
  splitter.addEventListener("pointerup", finish);
  splitter.addEventListener("pointercancel", finish);
}

function resetSplitWeights() {
  state.weights = buildEqualWeights(state.panes.length);
  applyLayout();
  writeUrlState();
  flashNotice(state.panes.length === 2 ? "Split ratio reset to 50 / 50" : "Split panes reset to an even layout");
}

function setLayout(layout) {
  state.layout = layout;
  render();
  flashNotice(state.layout === "horizontal" ? "Switched to top / bottom split" : "Switched to left / right split");
}

function reorderPanes(sourceId, targetId) {
  const sourceIndex = state.panes.findIndex((pane) => pane.id === sourceId);
  if (sourceIndex === -1) {
    return;
  }

  let targetIndex = targetId ? state.panes.findIndex((pane) => pane.id === targetId) : state.panes.length - 1;
  if (targetIndex === -1) {
    targetIndex = state.panes.length - 1;
  }

  if (targetIndex === sourceIndex) {
    return;
  }

  [state.panes[sourceIndex], state.panes[targetIndex]] = [state.panes[targetIndex], state.panes[sourceIndex]];
  [state.weights[sourceIndex], state.weights[targetIndex]] = [state.weights[targetIndex], state.weights[sourceIndex]];
  render();
}

function addPane(url, label = "") {
  if (state.panes.length >= MAX_PANES) {
    flashNotice("Awesome Split supports up to 3 panes", true);
    return;
  }

  const pane = createPane(url, label);
  if (!pane) {
    flashNotice("Enter a valid page URL", true);
    return;
  }

  state.panes.push(pane);
  state.weights = buildEqualWeights(state.panes.length);
  render();
  flashNotice("Added page to Awesome Split");
}

function removePane(index) {
  if (state.panes.length <= MIN_PANES) {
    flashNotice("At least 2 panes are required", true);
    return;
  }

  state.panes.splice(index, 1);
  state.weights.splice(index, 1);
  state.weights = normalizeWeights(state.weights, state.panes.length);
  render();
  flashNotice("Pane removed");
}

function clearToolbarDragState() {
  draggedPaneId = null;
  for (const chip of toolbarTabs.querySelectorAll(".toolbar-chip")) {
    chip.dataset.dragging = "false";
    chip.dataset.dropTarget = "false";
  }
}

function clearChipDropTargets() {
  for (const chip of toolbarTabs.querySelectorAll(".toolbar-chip")) {
    chip.dataset.dropTarget = "false";
  }
}

function writeUrlState() {
  const pages = state.panes.map((pane) => ({ url: pane.url, label: pane.label }));
  const params = new URLSearchParams({
    layout: state.layout,
    pages: JSON.stringify(pages),
    weights: JSON.stringify(state.weights),
  });

  window.history.replaceState(null, "", `?${params.toString()}`);
}

function createPane(url, label = "") {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return null;
  }

  return {
    id: createId(),
    url: normalized,
    label: label || deriveLabel(normalized),
  };
}

function deriveLabel(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") || parsed.pathname || url;
  } catch {
    return url;
  }
}

function compactUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function normalizeWeights(weights, paneCount) {
  if (!Array.isArray(weights) || weights.length !== paneCount) {
    return buildEqualWeights(paneCount);
  }

  const normalized = weights.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
  if (normalized.length !== paneCount) {
    return buildEqualWeights(paneCount);
  }

  const total = sumWeights(normalized);
  if (total <= 0) {
    return buildEqualWeights(paneCount);
  }

  return normalized.map((value) => value / total);
}

function buildEqualWeights(paneCount) {
  return Array.from({ length: paneCount }, () => 1 / paneCount);
}

function sumWeights(values) {
  return values.reduce((sum, value) => sum + value, 0);
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

function resolveInputToUrl(value) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }

  const normalized = normalizeUrl(trimmed);
  if (normalized && looksLikeAddress(trimmed)) {
    return normalized;
  }

  if (normalized && /^https?:\/\//i.test(trimmed)) {
    return normalized;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function looksLikeAddress(value) {
  return /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|[^\s]+\.[^\s]+|[^\s]+\/[^\s]*)$/i.test(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `pane-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function flashNotice(message, isError = false) {
  notice.textContent = message;
  notice.hidden = false;
  notice.style.background = isError ? "rgba(153, 27, 27, 0.92)" : "rgba(15, 23, 42, 0.86)";

  window.clearTimeout(flashNotice.timeoutId);
  flashNotice.timeoutId = window.setTimeout(() => {
    notice.hidden = true;
  }, 2400);
}
