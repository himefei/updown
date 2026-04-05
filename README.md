# Awesome Split

A Chrome extension prototype that opens two or three web pages inside one Chrome tab using a split-view page.

## What it does

- Clicking the extension icon directly opens a new Awesome Split tab.
- Uses the first two regular web tabs in the current browser window for the initial split view.
- Keeps the original browser tabs open.
- Opens the current split pages inside one split-view tab and supports adding a third page by URL.
- Supports `2-up` and `3-up` layouts.
- Supports `Left / Right` and `Top / Bottom` layouts.
- Automatically chooses `Left / Right` on wide windows and `Top / Bottom` on tall windows when launched from the extension icon.
- Adds a top toolbar that shows the current split pages, supports drag-reorder inside the split view, and lets you add a page by entering a URL.
- Adds a three-dot menu on each split pane so the layout can be changed from inside split view.
- Reordering panes and switching split direction preserve the existing pane instances instead of recreating them.

## Important limitation

This extension does **not** patch Chrome's native split view UI.
Chrome extensions cannot inject items into the browser's built-in split view menu, so this project recreates the workflow with an extension page that contains iframes.

Some websites may still resist being embedded because of iframe policies, login isolation, or browser security behavior. The extension includes header-relaxation rules to improve compatibility, but it cannot guarantee every site will render correctly inside a frame.

Adding a brand-new pane by typing a URL still creates a new page instance. Chrome extensions cannot transplant an already-running browser tab or its live renderer process into an iframe inside the split view.

## Install locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder.

## How to use

1. Open a Chrome window with at least two regular web tabs.
2. Click the Awesome Split extension icon.
3. A new Awesome Split tab opens using the first two regular web tabs from that window.
4. Drag the toolbar chips to reorder panes.
5. Enter a URL in the toolbar input if you want to add a third page.
6. Use the three-dot menu inside any pane to switch layouts, edit the pane URL, reload it, or remove a pane.

## Notes

- The extension uses normal web tabs from the current window as its initial source pages.
- Chrome internal pages like `chrome://` are not eligible as split panes.
- The split is implemented inside one extension tab, not inside Chrome's native split view feature.
