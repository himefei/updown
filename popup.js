const customUrlInput = document.querySelector("#custom-url");
const status = document.querySelector("#status");
const actionButtons = [...document.querySelectorAll("button[data-layout]")];

init();

async function init() {
  const settings = await request("split:get-settings");
  customUrlInput.value = settings.customUrl || "";

  customUrlInput.addEventListener("change", async () => {
    const saved = await request("split:save-settings", {
      customUrl: customUrlInput.value.trim(),
    });
    customUrlInput.value = saved.customUrl;
    setStatus("Custom URL saved");
  });

  for (const button of actionButtons) {
    button.addEventListener("click", () => runSplit(button));
  }
}

async function runSplit(button) {
  button.disabled = true;
  setStatus("Opening split view...");

  try {
    const customUrl = customUrlInput.value.trim();
    if (customUrl) {
      await request("split:save-settings", { customUrl });
    }

    await request("split:run", {
      layout: button.dataset.layout,
      target: button.dataset.target,
      customUrl,
    });
    setStatus("Split view opened");
    window.close();
  } catch (error) {
    setStatus(error.message || "Failed to create split", true);
  } finally {
    button.disabled = false;
  }
}

async function request(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload, payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Unknown error");
  }
  return response.result;
}

function setStatus(text, isError = false) {
  status.textContent = text;
  status.style.color = isError ? "#b91c1c" : "#0f766e";
}
