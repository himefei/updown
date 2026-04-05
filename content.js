const ROOT_ID = "updown-split-root";

initOverlay();

function initOverlay() {
  if (window.top !== window || document.getElementById(ROOT_ID)) {
    return;
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <button id="updown-split-toggle" type="button" aria-label="Open split menu">...</button>
    <div id="updown-split-menu" hidden>
      <button type="button" data-layout="vertical" data-target="duplicate">Open left / right split for this page</button>
      <button type="button" data-layout="horizontal" data-target="duplicate">Open top / bottom split for this page</button>
      <button type="button" data-layout="vertical" data-target="custom">Open left / right split with custom URL</button>
      <button type="button" data-layout="horizontal" data-target="custom">Open top / bottom split with custom URL</button>
      <button type="button" data-action="set-custom-url">Set custom URL</button>
    </div>
    <div id="updown-split-toast" hidden></div>
  `;

  document.documentElement.append(root);

  const toggle = root.querySelector("#updown-split-toggle");
  const menu = root.querySelector("#updown-split-menu");
  const toast = root.querySelector("#updown-split-toast");

  toggle.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) {
      menu.hidden = true;
    }
  });

  menu.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    if (action === "set-custom-url") {
      const settings = await request("split:get-settings");
      const nextValue = window.prompt("Custom URL for split target", settings.customUrl || "");
      if (nextValue === null) {
        return;
      }

      await request("split:save-settings", { customUrl: nextValue.trim() });
      showToast(toast, "Custom URL saved");
      menu.hidden = true;
      return;
    }

    button.disabled = true;
    try {
      await request("split:run", {
        layout: button.dataset.layout,
        target: button.dataset.target,
      });
      menu.hidden = true;
      showToast(toast, "Split view opened in this tab");
    } catch (error) {
      showToast(toast, error.message || "Failed to split page", true);
    } finally {
      button.disabled = false;
    }
  });
}

async function request(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload, payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Unknown error");
  }
  return response.result;
}

function showToast(node, text, isError = false) {
  node.textContent = text;
  node.hidden = false;
  node.dataset.error = isError ? "true" : "false";

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    node.hidden = true;
  }, 2200);
}
