import { App, Notice, WorkspaceLeaf } from "obsidian";
import { VERTICAL_EDITOR_VIEW_TYPE, VerticalEditorView } from "./VerticalEditorView"; // VERTICAL_EDITOR_VIEW_TYPE をインポート

export class SwitchView {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async fromMarkdownToVert() {
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            new Notice("縦書きエディタで開くアクティブなマークダウンファイルがありません。");
            return;
        }

        // 既存の縦書きエディタビューで同じファイルが開かれていないか確認する (オプション)
        // より高度な実装では、既存のビューを探してアクティブ化することも検討できます。
        // const existingLeaves = this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE);
        // for (const leaf of existingLeaves) {
        //     if (leaf.view instanceof VerticalEditorView && leaf.view.file?.path === activeFile.path) {
        //         this.app.workspace.setActiveLeaf(leaf, { focus: true });
        //         return;
        //     }
        // }

        let leaf: WorkspaceLeaf | null = null;
        // 新しいリーフを右側に分割して作成することを試みる
        // 'split' 以外にも 'tab' (新しいタブ) や false (現在のリーフを置き換える) などが指定可能
        try {
            leaf = this.app.workspace.getLeaf('split', 'vertical'); // 'vertical' は分割方向
        } catch (error) {
            // console.error("リーフの取得に失敗しました:", error);
            new Notice("縦書きエディタ用の表示領域を確保できませんでした。");
            return;
        }

        if (leaf) {
            await leaf.setViewState({
                type: VERTICAL_EDITOR_VIEW_TYPE,
                state: { file: activeFile.path }, // VerticalEditorView の setState に渡される state
                active: true, // 新しいビューをアクティブにする
            });
            this.app.workspace.revealLeaf(leaf); // リーフが表示されるようにする
        } else {
            new Notice("縦書きエディタ用のリーフを作成または発見できませんでした。");
        }
    }

    // fromVertToMarkdown メソッドは、縦書きエディタから標準のMarkdownビューに戻す処理を記述します。
    // このメソッドも同様に、対応するファイルを見つけてMarkdownビューとして開くロジックが必要です。
    async fromVertToMarkdown() {
        // 現在アクティブなリーフを取得
        const currentLeaf = this.app.workspace.getLeaf();

        if (currentLeaf && currentLeaf.view.getViewType() === VERTICAL_EDITOR_VIEW_TYPE) {
            const verticalView = currentLeaf.view as VerticalEditorView; // VerticalEditorView にキャスト (型安全のためには import してキャスト)
            const fileToOpen = verticalView.file; // VerticalEditorView が保持しているファイル情報を取得

            if (fileToOpen) {
                // 新しいリーフを取得するか、既存のリーフを再利用してMarkdownビューを開く
                // ここでは、現在のリーフをMarkdownビューに置き換える例を示します。
                await currentLeaf.setViewState({
                    type: "markdown",
                    state: { file: fileToOpen.path, mode: "source" }, // ソースモードで開く
                    active: true,
                });
                this.app.workspace.revealLeaf(currentLeaf);
            } else {
                new Notice("Markdownビューに戻すためのファイル情報が見つかりません。");
            }
        } else {
            new Notice("アクティブなビューは縦書きエディタではありません。");
        }
    }
}
