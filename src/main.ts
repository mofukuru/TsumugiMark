import { Plugin, Notice, setIcon, MarkdownView, WorkspaceLeaf } from "obsidian";
import { VerticalEditorView, VERTICAL_EDITOR_VIEW_TYPE } from "./verticaleditorview";
import { SwitchView } from "./switchview";

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
        const sv = new SwitchView(this.app);
        sv.fromMarkdownToVert();
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

    // this.addRibbonIcon("dice", "My Button", (evt: MouseEvent) => {
    //   new Notice("ボタンがクリックされました！");
    // });

    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf && leaf.view instanceof MarkdownView) {
        // const header = leaf.view.containerEl.querySelector(".view-header");
        const header = leaf.view.containerEl.querySelector(".view-actions");
        if (header && !header.querySelector(".vertical-editor-button")) {
          const btn = document.createElement("button");
          btn.classList.add("clickable-icon", "vertical-editor-button");
          setIcon(btn, "notebook-text")
          btn.setAttribute("aria-label", "convert to vertical-editor")
          btn.addEventListener("click", () => {
            const sv = new SwitchView(this.app);
            sv.fromMarkdownToVert();
          });
          header.insertAdjacentElement("afterbegin", btn);
        }
      }
    }));

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
    this.app.workspace.detachLeavesOfType("VERTICAL_EDITOR_VIEW_TYPE");
  }
}
