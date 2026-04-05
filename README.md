# UpDown Split

A Chrome extension prototype that opens two web pages inside one Chrome tab using a split-view page.

## What it does

- Adds a floating `...` menu at the bottom-right of most web pages.
- Opens the current page and a second page inside one split-view tab.
- Supports `Left / Right` and `Top / Bottom` layouts.
- Adds a three-dot menu on each split pane so the layout can be changed from inside split view.
- Supports splitting with a saved custom URL.
- Provides the same actions in the extension popup.

## Important limitation

This extension does **not** patch Chrome's native split view UI.
Chrome extensions cannot inject items into the browser's built-in split view menu, so this project recreates the workflow with an extension page that contains two iframes.

Some websites may still resist being embedded because of iframe policies, login isolation, or browser security behavior. The extension includes header-relaxation rules to improve compatibility, but it cannot guarantee every site will render correctly inside a frame.

## Install locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder.

## How to use

1. Open any regular web page.
2. Click the floating `...` button in the bottom-right corner.
3. Choose `top / bottom` or `left / right`.
4. The current tab will switch to the split-view page.
5. Use the three-dot menu inside either pane to switch layouts again.

You can also click the extension toolbar icon and trigger the same actions from the popup.

## Notes

- The extension works on normal web pages that allow content scripts.
- It will not appear on Chrome internal pages like `chrome://`.
- The split is implemented inside one extension tab, not inside Chrome's native split view feature.
