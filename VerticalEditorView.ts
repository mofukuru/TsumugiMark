import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from "obsidian";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null; // 編集中のMarkdownファイル

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VERTICAL_EDITOR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file ? this.file.basename : "vertical_editor";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // 縦書きエディタを作成
        const editorDiv = container.createDiv({
            cls: "vertical-editor",
        });
        editorDiv.contentEditable = "true";
        editorDiv.style.writingMode = "vertical-rl";
        editorDiv.style.textOrientation = "upright";
        editorDiv.style.border = "1px solid black";
        editorDiv.style.padding = "10px";
        editorDiv.style.height = "90%";
        editorDiv.style.overflowY = "scroll";

        // 現在アクティブなMarkdownファイルを取得
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.file = activeFile;

            // Markdownの内容を縦書きエディタに読み込む
            const fileContent = await this.app.vault.read(activeFile);
            editorDiv.setText(fileContent);
        } else {
            editorDiv.setText("新規ファイルまたは空の内容です。");
        }

        // 編集内容を保存する処理
        editorDiv.addEventListener("input", async () => {
            if (this.file) {
                const content = editorDiv.innerText;
                await this.app.vault.modify(this.file, content);
            }
        });
    }

    async onClose(): Promise<void> {
        // 必要に応じて後処理を追加
    }
}
