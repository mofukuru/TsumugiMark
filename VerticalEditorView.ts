import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from "obsidian";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null; // markdown file

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

        // make vertical editor
        const editorDiv = container.createDiv({
            cls: "vertical-editor",
        });
        editorDiv.contentEditable = "true";
        editorDiv.style.writingMode = "vertical-rl";
        // editorDiv.style.textOrientation = "upright";
        editorDiv.style.lineHeight = "2";
        editorDiv.style.letterSpacing = "0.1em";
        editorDiv.style.border = "1px solid black";
        editorDiv.style.padding = "10px";
        editorDiv.style.height = "90%";
        editorDiv.style.overflowY = "auto";

        // obtain currently active markdown file
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.file = activeFile;
            // console.log("received file path: ", this.file);

            // read vertical editor the content of markdown file
            const fileContent = await this.app.vault.read(activeFile);
            const htmlFile = await unified()
                .use(remarkParse)
                .use(remarkBreaks)
                .use(remarkRehype)
                .use(rehypeSanitize)
                .use(rehypeStringify)
                .process(fileContent)
            // console.log(String(htmlFile));
            editorDiv.innerHTML = String(htmlFile);
        } else {
            // editorDiv.setText("新規ファイルまたは空の内容です。");
            editorDiv.innerHTML = ("<p>新規ファイルまたは空の内容です。</p>");
        }

        // save edited data
        editorDiv.addEventListener("input", async () => {
            if (this.file) {
                const content = editorDiv.innerText;
                await this.app.vault.modify(this.file, content);
            }
        });
    }

    async onClose(): Promise<void> {
        // add postprocess
    }
}
