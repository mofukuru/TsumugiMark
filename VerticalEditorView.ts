import { ItemView, WorkspaceLeaf } from "obsidian";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VERTICAL_EDITOR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "縦書きエディタ";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1]; // Viewのコンテナを取得
        container.empty(); // 既存のコンテンツを削除

        // 縦書きエディタを作成
        const editorDiv = container.createDiv({
            cls: "vertical-editor",
        });
        editorDiv.contentEditable = "true";
        editorDiv.setText("ここに縦書きテキストを入力してください");

        // 縦書きスタイルを適用
        editorDiv.style.writingMode = "vertical-rl";
        editorDiv.style.textOrientation = "upright";
        editorDiv.style.border = "1px solid black";
        editorDiv.style.padding = "10px";
        editorDiv.style.height = "90%";
        editorDiv.style.overflowY = "scroll";
    }

    async onClose(): Promise<void> {
        // 必要に応じてクリーンアップ処理を記述
    }
}
