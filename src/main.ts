import { Plugin, Notice, setIcon, MarkdownView, WorkspaceLeaf, TFile } from "obsidian";
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

    // main.ts の VerticalEditorPlugin クラス内 onload メソッドに追加
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        // 変更されたファイルがTFileインスタンスであるか確認 (フォルダでないことを保証)
        if (file instanceof TFile) {
          // 現在開かれているすべての縦書きエディタのビューを取得
          this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view as VerticalEditorView; // ビューをVerticalEditorView型にキャスト

            // 縦書きエディタでファイルが開かれており、かつ変更されたファイルと同じパスであるか確認
            if (view.file && view.file.path === file.path) {
              // new Notice(`Markdown側の変更を検知: ${file.basename} を再読み込みします。`); // デバッグ用通知
              if (!view.isSavingInternally) {
              // VerticalEditorView にあるファイル内容を再読み込みするメソッドを呼び出す
              // view.loadFileContent(file) を呼び出すことで、
              // Markdownファイルから最新の内容を読み込み、HTMLに変換して縦書きエディタに表示します。
                view.loadFileContent(file);
              }
            }
          });
        }
      })
    );

    // delete view when finish plugin
    // this.registerEvent(
    //   this.app.workspace.on("file-open", (file) => {
    //     if (file) {
    //       const leaves = this.app.workspace.getLeavesOfType(
    //         VERTICAL_EDITOR_VIEW_TYPE
    //       );
    //       leaves.forEach((leaf) => {
    //         const view = leaf.view as VerticalEditorView;
    //         view.file = file;
    //       });
    //     }
    //   })
    // );
  }

  onunload() {
    this.app.workspace.detachLeavesOfType("VERTICAL_EDITOR_VIEW_TYPE");
  }
}
