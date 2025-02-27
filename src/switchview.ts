import { App, MarkdownView } from "obsidian";

export class SwitchView {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async fromMarkdownToVert() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            const leaf = view.leaf;

            leaf.setViewState({
                type: VERTICAL_EDITOR_VIEW_TYPE,
                state: {},
            });
        }

    }

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
