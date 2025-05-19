import { ItemView, WorkspaceLeaf, TFile, ViewStateResult } from "obsidian";
import { SwitchText } from "./switchtext";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VERTICAL_EDITOR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file ? this.file.basename : "vertical_editor";
    }

    getIcon(): string {
        return "text";
    }

    async setState(state: { file?: string }, result: ViewStateResult): Promise<void> {
        if (state.file) {
            const file = this.app.vault.getAbstractFileByPath(state.file);
            if (file instanceof TFile) {
                this.file = file;
            }
        }

        await super.setState(state, result);
    }

    getState(): { file?: string } {
        return { file: this.file?.path };
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // make vertical editor
        const editorDiv = container.createDiv({
            cls: VERTICAL_EDITOR_VIEW_TYPE,
        });
        editorDiv.contentEditable = "true";

        // obtain currently active markdown file
        let activeFile: TFile | null = null;
        const checkState = setInterval(async () => {
            const state = this.leaf.getViewState().state;
            console.log("state", state);

            if (typeof state?.file === "string") {
                clearInterval(checkState);
                const file = this.app.vault.getAbstractFileByPath(state.file);
                if (file instanceof TFile) {
                    activeFile = file;
                }
            } else {
                activeFile = this.app.workspace.getActiveFile();
            }

            console.log("activefile", activeFile?.path);
        }, 50);

        if (!activeFile) {
            console.log("not found");
            return;
        }
        console.log("got it!");

        let sw = new SwitchText(this.app);
        const fileContent = await this.app.vault.read(activeFile);
        const htmlContent = await sw.fromMarkdownToHTML(fileContent);
        console.log(htmlContent);

        editorDiv.innerHTML = htmlContent;
        this.file = activeFile;

        editorDiv.addEventListener("input", async () => {
            if (this.file) {
                const content = editorDiv.innerHTML;
                console.log(content);
                await this.app.vault.modify(this.file, content);
            }
        });
    }

    async onClose(): Promise<void> {
        // add postprocess
    }
}
