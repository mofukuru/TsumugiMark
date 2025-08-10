import { App, TFile, Notice } from "obsidian";
import { SwitchText } from "./SwitchText";
import { ViewRenderer } from "./ViewRenderer";

export class FileManager {
    private app: App;
    public isSavingInternally: boolean = false;

    constructor(app: App) {
        this.app = app;
    }

    async saveContent(file: TFile, editorDiv: HTMLDivElement): Promise<void> {
        if (this.isSavingInternally) return;

        this.isSavingInternally = true;
        const sw = new SwitchText(this.app);
        try {
            const markdownContent = await sw.fromHTMLToMarkdown(editorDiv);
            await this.app.vault.modify(file, markdownContent);
        } catch (error) {
            new Notice("HTMLからMarkdownへの変換または保存中にエラーが発生しました。");
        } finally {
            setTimeout(() => {
                this.isSavingInternally = false;
            }, 100);
        }
    }

    async loadFileContent(fileToLoad: TFile, editorDiv: HTMLDivElement, renderer: ViewRenderer): Promise<void> {
        if (!editorDiv) {
            return;
        }

        const scrollTop = editorDiv.scrollTop;
        const scrollLeft = editorDiv.scrollLeft;

        try {
            const fileContent = await this.app.vault.read(fileToLoad);
            const sw = new SwitchText(this.app);
            const htmlContent = await sw.fromMarkdownToHTML(fileContent);

            requestAnimationFrame(() => {
                editorDiv.empty();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, "text/html");
                Array.from(doc.body.childNodes).forEach(node => {
                    editorDiv.appendChild(node);
                });
                renderer.applyStyles();
                requestAnimationFrame(() => {
                    editorDiv.scrollTop = scrollTop;
                    editorDiv.scrollLeft = scrollLeft;
                });
            });
        } catch (error) {
            renderer.displayEmptyMessage(`ファイル「${fileToLoad.basename}」の読み込みに失敗しました。`);
        }
    }
}
