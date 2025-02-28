import { Plugin, Notice, setIcon, MarkdownView, WorkspaceLeaf } from "obsidian";
import { VerticalEditorView } from "./VerticalEditorView";
import { SwitchView } from "./switchview";

export default class VerticalEditorPlugin extends Plugin {
  async onload() {
    // register vertical editor view
    this.registerView(
      "vertical-editor",
      (leaf) => new VerticalEditorView(leaf)
    );

    // command to open vertical editor
    this.addCommand({
      id: "open-vertical-editor",
      name: "open vertical editor",
      callback: () => {
        this.fromMarkdownToVert();
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
        const header = leaf.view.containerEl.querySelector(".view-header");
        if (header && !header.querySelector(".vertical-editor")) {
          const btn = document.createElement("button");
          btn.classList.add("clickable-icon", "vertical-editor");
          setIcon(btn, "notebook-text")
          btn.setAttribute("aria-label", "convert to vertical-editor")
          btn.addEventListener("click", () => {
            let sv = new SwitchView(this.app);
            sv.fromMarkdownToVert();
          });
          const titleContainer = header.querySelector(".view-header-title-container");
          if (titleContainer) {
            titleContainer.insertAdjacentElement("afterend", btn);
          } else {
            header.appendChild(btn);
          }
        }
      }
    }));

    // delete view when finish plugin
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) {
          const leaves = this.app.workspace.getLeavesOfType(
            "vertical-editor"
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
    this.app.workspace.detachLeavesOfType("vertical-editor");
  }

  async fromMarkdownToVert() {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.app.workspace.getLeaf(true).setViewState({
        type: "vertical-editor",
        state: { file: activeFile.path },
      });
    } else {
      new Notice("You have no active markdown file.");
    }
  }
}
