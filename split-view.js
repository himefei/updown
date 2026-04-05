const root = document.querySelector("#split-root");
const panes = [...document.querySelectorAll(".pane")];
const notice = document.querySelector("#notice");
const swapButton = document.querySelector("#swap-button");

const state = readStateFromUrl();
render();
wireEvents();

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    layout: params.get("layout") === "vertical" ? "vertical" : "horizontal",
    primaryUrl: normalizeUrl(params.get("primary")) || "https://example.com/",
    secondaryUrl: normalizeUrl(params.get("secondary")) || "https://www.google.com/",
  };
}

function wireEvents() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest(".pane-toggle");
    if (toggle) {
      const pane = toggle.closest(".pane");
      const menu = pane.querySelector(".pane-menu");
      const nextHidden = !menu.hidden;
      closeMenus();
      menu.hidden = nextHidden;
      return;
    }

    const actionButton = event.target.closest(".pane-menu button");
    if (actionButton) {
      const pane = actionButton.closest(".pane");
      runPaneAction(pane, actionButton);
      return;
    }

    if (!event.target.closest(".pane-toolbar")) {
      closeMenus();
    }
  });

  swapButton.addEventListener("click", () => {
    const previousPrimary = state.primaryUrl;
    state.primaryUrl = state.secondaryUrl;
    state.secondaryUrl = previousPrimary;
    render();
    flashNotice("Primary and secondary panes swapped");
  });
}

function runPaneAction(pane, button) {
  const action = button.dataset.action;
  if (action === "layout") {
    state.layout = button.dataset.layout === "vertical" ? "vertical" : "horizontal";
    render();
    flashNotice(state.layout === "horizontal" ? "Switched to top / bottom split" : "Switched to left / right split");
    return;
  }

  if (action === "reload") {
    pane.querySelector(".pane-frame").src = pane.dataset.url;
    flashNotice("Pane reloaded");
    return;
  }

  if (action === "edit-url") {
    const key = pane.dataset.pane === "primary" ? "primaryUrl" : "secondaryUrl";
    const nextValue = window.prompt("Enter a URL for this pane", state[key]);
    if (nextValue === null) {
      return;
    }

    const normalized = normalizeUrl(nextValue);
    if (!normalized) {
      flashNotice("URL is empty", true);
      return;
    }

    state[key] = normalized;
    render();
    flashNotice("Pane URL updated");
  }
}

function render() {
  root.dataset.layout = state.layout;
  writeUrlState();

  for (const pane of panes) {
    const key = pane.dataset.pane === "primary" ? "primaryUrl" : "secondaryUrl";
    const url = state[key];
    pane.dataset.url = url;
    pane.querySelector(".pane-frame").src = url;
    pane.querySelector(".pane-menu").hidden = true;
  }
}

function writeUrlState() {
  const params = new URLSearchParams({
    layout: state.layout,
    primary: state.primaryUrl,
    secondary: state.secondaryUrl,
  });
  window.history.replaceState(null, "", `?${params.toString()}`);
}

function closeMenus() {
  for (const menu of document.querySelectorAll(".pane-menu")) {
    menu.hidden = true;
  }
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

function flashNotice(message, isError = false) {
  notice.textContent = message;
  notice.hidden = false;
  notice.style.background = isError ? "rgba(153, 27, 27, 0.92)" : "rgba(15, 23, 42, 0.86)";

  window.clearTimeout(flashNotice.timeoutId);
  flashNotice.timeoutId = window.setTimeout(() => {
    notice.hidden = true;
  }, 2200);
}
