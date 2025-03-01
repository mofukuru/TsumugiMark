import { App, MarkdownView, Notice } from "obsidian";

export class SwitchView {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    // async fromMarkdownToVert() {
    //     const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    //     if (!view) return;

    //     const leaf = view.leaf;
    //     const activeFile = this.app.workspace.getActiveFile();

    //     if (activeFile) {
    //         leaf.setViewState({
    //             type: "vertical-editor",
    //             state: { file: activeFile.path },
    //         });
    //     } else {
    //         new Notice("You have no active markdown file.");
    //     }
    // }

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

    // getLeaf(true)にすると新しいタブとして開く
    // async fromMarkdownToVert() {
    //     const activeFile = this.app.workspace.getActiveFile();
    //     const activeLeaf = this.app.workspace.getLeaf(false);

    //     if (activeFile && activeLeaf) {
    //         activeLeaf.setViewState({
    //             type: "vertical-editor",
    //             state: { file: activeFile.path },
    //         });
    //     } else {
    //         new Notice("You have no active markdown file.");
    //     }
    // }

    // 書き換える
    async fromVertToMarkdown() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            const leaf = view.leaf;

            leaf.setViewState({
                type: "markdown",
                state: {},
            });
        }
    }
}
