# Roadmap

Planned updates for TsumugiMark. Priorities may change based on feedback — requests and bug reports are welcome in [Issues](https://github.com/mofukuru/tsumugi-mark/issues).

## v1.1.1 — Released

- [x] Scroll horizontally with the mouse wheel (#5)

## v1.1.2 — Fixes & issue requests

- [ ] Support `==highlight==` syntax (compatibility with Sidebar Highlights) (#5)
- [ ] Preserve annotations/comments written for Sidebar Highlights (#5)
- [ ] Restore the scroll position correctly when the file is reloaded after external edits
- [ ] Avoid reloading twice on external file changes
- [ ] Paste as plain text so formatting from other apps does not break the Markdown
- [ ] Unify all UI text in English

## v1.2.0 — Editing experience

- [ ] Undo / Redo that works with paragraph, heading and ruby conversions
- [ ] Save status indicator and `Ctrl/Cmd + S` to save immediately
- [ ] Button to switch back from the vertical editor to the Markdown editor
- [ ] Choose how the vertical editor opens (split / new tab / replace current pane)
- [ ] "Open in vertical editor" in the file menu and context menu
- [ ] Keyboard shortcuts for emphasis dots, ruby and highlight
- [ ] Reorganized settings: grouped sections, sliders for numeric values, dependent options shown only when relevant

## v1.3.0 — Features for writers

- [ ] Focus mode (dim paragraphs other than the one being edited)
- [ ] Manuscript paper (genkō yōshi) mode with page count
- [ ] Extended word count: manuscript-page conversion, goal and progress, words written today
- [ ] Heading outline with jump-to navigation

## Ideas (unscheduled)

- Automatic tate-chū-yoko for short half-width numbers
- Hanging punctuation and strict line breaking options
- Live preview of style settings in the settings tab
- Round-trip tests for the Markdown ↔ HTML conversion
