import { Plugin, Notice } from "obsidian";
import { VERTICAL_EDITOR_VIEW_TYPE, VerticalEditorView } from "./VerticalEditorView";

export default class VerticalEditorPlugin extends Plugin {
  async onload() {
    // 縦書きエディタビューを登録
    this.registerView(
      VERTICAL_EDITOR_VIEW_TYPE,
      (leaf) => new VerticalEditorView(leaf)
    );

    // 縦書きエディタを開くコマンド
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
          new Notice("アクティブなMarkdownファイルがありません。");
        }
      },
    });

    // プラグイン終了時にビューを削除
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
