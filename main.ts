import { Plugin } from "obsidian";
import { VERTICAL_EDITOR_VIEW_TYPE, VerticalEditorView } from "./VerticalEditorView";

export default class VerticalEditorPlugin extends Plugin {
  async onload() {
    this.registerView(
      VERTICAL_EDITOR_VIEW_TYPE,
      (leaf) => new VerticalEditorView(leaf)
    );

    // コマンドで縦書きエディタを開けるようにする
    this.addCommand({
      id: "open-vertical-editor",
      name: "open vertical editor",
      callback: () => {
        this.app.workspace.getLeaf(true).setViewState({
          type: VERTICAL_EDITOR_VIEW_TYPE,
        });
      },
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE);
  }
}
