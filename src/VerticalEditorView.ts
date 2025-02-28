import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { SwitchText } from "./switchtext";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null; // markdown file

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return "vertical-editor";
    }

    getDisplayText(): string {
        return this.file ? this.file.basename : "vertical_editor";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // make vertical editor
        const editorDiv = container.createDiv({
            cls: "vertical-editor",
        });
        editorDiv.contentEditable = "true";
        editorDiv.style.writingMode = "vertical-rl";
        // editorDiv.style.textOrientation = "upright";
        editorDiv.style.lineHeight = "2";
        editorDiv.style.letterSpacing = "0.2em";
        editorDiv.style.border = "1px solid black";
        editorDiv.style.padding = "10px";
        editorDiv.style.height = "90%";
        editorDiv.style.overflowY = "auto";

        // obtain currently active markdown file
        // これはあるわけがないか？
        const activeFile = this.app.workspace.getActiveFile();

        let sw = new SwitchText(this.app);
        this.file = await sw.fromMarkdownToHTML(activeFile, editorDiv);
        console.log(editorDiv);

        editorDiv.addEventListener("input", async () => {
            if (this.file) {
                const content = editorDiv.innerText;
                console.log(content);
                await this.app.vault.modify(this.file, content);
            }
        });
    }

    async onClose(): Promise<void> {
        // add postprocess
    }
}
