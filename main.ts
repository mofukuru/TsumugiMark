import { Plugin, Notice } from "obsidian";
import { VERTICAL_EDITOR_VIEW_TYPE, VerticalEditorView } from "./VerticalEditorView";

export default class VerticalEditorPlugin extends Plugin {
  async onload() {
    // register vertical editor view
    this.registerView(
      VERTICAL_EDITOR_VIEW_TYPE,
      (leaf) => new VerticalEditorView(leaf)
    );

    // command to open vertical editor
    this.addCommand({
      id: "open-vertical-editor",
      name: "open vertical editor",
      callback: () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          this.app.workspace.getLeaf(true).setViewState({
            type: VERTICAL_EDITOR_VIEW_TYPE,
            state: { file: activeFile.path },
          });
        } else {
          new Notice("You have no active markdown file.");
        }
      },
      // id: "toggle-vertical-editor",
      // name: "Toggle Vertical Editor",
      // callback: () => {
      //   const activeLeaf = this.app.workspace.activeLeaf;
      //   if (activeLeaf) {
      //     const view = activeLeaf.view;

      //     // Check if the current view is a Markdown view
      //     if (view.getViewType() === "markdown") {
      //       const activeFile = this.app.workspace.getActiveFile();
      //       if (activeFile) {
      //         // Switch to vertical editor view
      //         // activeLeaf.setViewState({
      //         //   type: VERTICAL_EDITOR_VIEW_TYPE,
      //         //   state: { file: activeFile.path },
      //         // });
      //         this.app.workspace.getLeaf(true).setViewState({
      //           type: VERTICAL_EDITOR_VIEW_TYPE,
      //           state: { file: activeFile.path },
      //         });
      //       } else {
      //         new Notice("No active markdown file.");
      //       }
      //     } else if (view.getViewType() === VERTICAL_EDITOR_VIEW_TYPE) {
      //       // Switch back to markdown view
      //       const file = (view as VerticalEditorView).file;
      //       if (file) {
      //         activeLeaf.setViewState({
      //           type: "markdown",
      //           state: { file: file.path },
      //         });
      //       } else {
      //         new Notice("Unable to switch back to markdown view.");
      //       }
      //     }
      //   } else {
      //     new Notice("No active workspace leaf.");
      //   }
      // },
    });
    this.addCommand({
      id: 'analyze-md',
      name: 'Analyze markdown file',
      editorCallback: (editor) => {
        const content = editor.getValue();
        // new Notice(`${content}`);
        const lines = content.split(/\r?\n/);
        const emptyLines = lines.filter(line => line.trim() === '').length;
        new Notice(`Total lines: ${lines.length}, Empty lines: ${emptyLines}`);
      }
    });


    // delete view when finish plugin
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) {
          const leaves = this.app.workspace.getLeavesOfType(
            VERTICAL_EDITOR_VIEW_TYPE
          );
          leaves.forEach((leaf) => {
            const view = leaf.view as VerticalEditorView;
            view.file = file;
          });
        }
      })
    );
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE);
  }
}
