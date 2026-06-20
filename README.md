# TsumugiMark

TsumugiMark is a vertical writing plugin for [Obsidian](https://obsidian.md). It lets you open any Markdown note in a dedicated vertical-writing pane — ideal for composing novels, screenplays, and other Japanese texts.

> **Note: This plugin is in beta. Some features may not be fully stable. Always test on a copy of your vault before using on important files.**

## Features

### Core Features

- **Vertical Writing View**: Opens the active Markdown file in a separate pane using CSS `writing-mode: vertical-rl` (or `vertical-lr`).
- **Live Preview**: Changes saved in the standard Markdown editor are reflected in the vertical pane in real time.
- **Edit in Vertical View**: Type and edit directly in the vertical pane. Changes are auto-saved back to the original Markdown file.
- **Heading Creation**: Type `#` (or `##`, `###`, up to `######`) at the start of a paragraph and press Space to instantly convert it to the corresponding heading level.
- **Ruby Character Support**: Supports furigana using the `|漢字《かんじ》` or `漢字《かんじ》` syntax.
- **Character Count**: Displays the total character count in the status bar. Selecting text also shows the selection count.
- **Auto-Open in Vertical Mode**: Optionally open every Markdown note automatically in the vertical editor without clicking the toolbar button each time.
- **Customization**: Font family, font size, line height, letter spacing, writing direction, column alignment, auto-indent, and character count mode are all configurable from the settings panel.

### Advanced Features

- **Writing Direction**: Switch between right-to-left (traditional Japanese vertical writing) and left-to-right from settings.
- **Column Alignment**: Position the text columns on screen — Left, Center, or Right — to suit your reading and editing comfort.
- **Auto-Save**: Edits are saved automatically 2 seconds after you stop typing. Closing the pane also triggers an immediate save.
- **Markdown Round-Trip**: The vertical editor converts Markdown to HTML for display and back to Markdown on save, preserving headings, bold, italic, ruby, hard line breaks, and blank lines.
- **External Edit Detection**: If the underlying Markdown file is modified outside the vertical editor (e.g. in the standard editor), the vertical pane reloads automatically.

## How to Use

### Opening the Vertical Editor

**Method 1 — Toolbar button**
1. Open any Markdown file.
2. Click the **notebook icon** that appears in the top-right action bar of the editor pane.
3. The screen splits and the vertical editor opens on the right.

**Method 2 — Command palette**
1. Press `Cmd/Ctrl + P` to open the command palette.
2. Run `TsumugiMark: Open vertical editor`.

### Creating Headings Directly in the Vertical Editor

You can add headings without switching back to the Markdown source view.

1. Place your cursor in an empty paragraph (press `Enter` to create one if needed).
2. Type `#` for H1, `##` for H2, `###` for H3, and so on (up to `######` for H6).
3. Press **Space** — the paragraph is immediately converted to the corresponding heading element.
4. Type your heading text. The heading is saved to the Markdown file as `# Title`, `## Title`, etc. on the next auto-save.

### Auto-Open in Vertical Mode

When enabled, every Markdown note you open is automatically displayed in the vertical editor — no need to click the toolbar button each time.

1. Open **Settings → TsumugiMark**.
2. Toggle **Open all notes in vertical mode** on.
3. Open any Markdown note — it will switch to the vertical editor automatically.

> If a vertical editor pane is already open for the same file, clicking that file's tab will bring the existing pane into focus instead of creating a new one.

### Customizing Writing Direction

1. Open **Settings → TsumugiMark**.
2. Set **Writing direction** to:
   - **Right to left (traditional)** — the default; columns flow from right to left, as in traditional Japanese vertical writing.
   - **Left to right** — columns flow from left to right.

### Adjusting Column Alignment

1. Open **Settings → TsumugiMark**.
2. Set **Column alignment** to **Left**, **Center**, or **Right**.
   - **Right** (default) is the natural starting position for right-to-left vertical writing.
   - **Center** is useful when you prefer the text to sit in the middle of the screen.
   - **Left** is natural for left-to-right vertical writing.

## Settings

Access all settings via **Settings → TsumugiMark**.

| Setting | Description |
|---|---|
| **Character count mode** | Count characters including or excluding spaces and line breaks. |
| **Font family** | Font used in the vertical editor (e.g. `"Yu Mincho", serif`). |
| **Font size** | Font size (e.g. `18px`, `1.2em`). |
| **Line height** | Line height / spacing between columns (e.g. `1.8`, `2`). |
| **Letter spacing** | Space between individual characters (e.g. `0px`, `0.1em`). |
| **Characters per column** | Target number of characters per column. Automatically updates **Max width**. |
| **Writing direction** | `Right to left (traditional)` or `Left to right`. |
| **Column alignment** | Horizontal position of the text block on screen: `Left`, `Center`, or `Right`. |
| **Open all notes in vertical mode** | Automatically open Markdown notes in the vertical editor. |
| **Enable automatic paragraph indentation** | Indents the first character of each paragraph by 1em (novel style). |
| **Max width** | Maximum column height in CSS units (e.g. `500px`, `auto`). Normally set automatically by **Characters per column**. |

## Important Notes

### Beta Status
This plugin is in beta. Layout may break in edge cases — always keep a backup of your vault when trying new features.

### Heading Syntax
The `#` + Space heading shortcut only applies when the **entire paragraph** contains nothing but `#` characters. For example:
- `###` + Space → H3 ✓
- `## Hello` + Space at the end → no conversion (already has content) ✓

### Writing Direction and Alignment
For right-to-left (`vertical-rl`) writing, **Right** alignment places the first column at the right edge of the screen, which is the conventional reading position. Choosing **Left** alignment with `vertical-rl` will place the first column at the left edge, which may feel unconventional.

### Round-Trip Fidelity
The Markdown ↔ HTML conversion handles common inline syntax (headings, bold, italic, ruby, line breaks). Complex syntax such as tables, task lists, and raw HTML may not round-trip perfectly.

## Version History

### 1.0.2
- **Heading creation in the vertical editor** — type `#` (or `##`–`######`) at the start of a paragraph and press Space to convert it to a heading; headings are saved as proper Markdown syntax (`# Title`)
- **Auto-open in vertical mode** — new toggle in settings opens every Markdown note in the vertical editor automatically
- **Writing direction setting** — choose right-to-left (default) or left-to-right vertical writing
- **Column alignment setting** — position text columns at the left, center, or right of the screen
- Fixed scroll being blocked when column alignment was set to Right
- Fixed headings and other block elements not converting correctly to Markdown on save (was caused by passing `HTMLElement` directly to TurndownService instead of `outerHTML`)
- Fixed auto-open scroll not working: moved flex/overflow handling to a dedicated inner scroll container so Obsidian's `.view-content` styles do not interfere
- Switched auto-open trigger from `file-open` to `active-leaf-change` for reliable activation

### 1.0.1
- Improved ruby annotation parsing — fixed the `start()` detection function and added iteration mark (`々`, `〆`, etc.) support
- Refactored `EditorManager` for more reliable cursor positioning and paragraph splitting
- Improved `FileManager`: more robust blank-line round-tripping and external-edit detection
- Improved heading and empty-line CSS for cleaner vertical layout
- Fixed various editor and save-cycle bugs

### 1.0.0
- Initial release
- Vertical writing view with `writing-mode: vertical-rl`
- Live preview of changes from the standard Markdown editor
- Direct editing in the vertical pane with auto-save
- Ruby character support (`|漢字《かんじ》` and auto-detect)
- Character count in the status bar (including selection count)
- Font, size, line height, letter spacing, and auto-indent customization
- Characters-per-column setting with automatic max-width calculation

## License

This plugin is released under the [MIT License](LICENSE).
