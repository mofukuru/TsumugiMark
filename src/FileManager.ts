import { App, TFile, Notice } from "obsidian";
import { SwitchText } from "./SwitchText";
import { ViewRenderer } from "./ViewRenderer";
import { domToMarkdown, splitFrontmatter } from "./MarkdownDocument";
import { t } from "./localization";

export class FileManager {
    private app: App;
    public isSavingInternally = false;
    private lastInternalSaveAt = 0;
    private readonly IGNORE_MODIFY_DURATION = 1500;
    private readonly SAVE_INTERNALY_DELAY = 100;

    /**
     * frontmatter（--- で囲まれたプロパティ）は DOM に載せずに退避しておく。
     * HTML 化すると `## title: ...` のような見出しに化けて完全に壊れてしまうため。
     */
    private frontmatter = '';

    constructor(app: App) {
        this.app = app;
    }

    async saveContent(file: TFile, editorDiv: HTMLDivElement): Promise<void> {
        if (this.isSavingInternally) return;

        this.isSavingInternally = true;
        this.lastInternalSaveAt = Date.now();
        
        try {
            const originalContent = await this.app.vault.read(file);
            const markdownContent = this.frontmatter + this.convertDOMToMarkdown(editorDiv);

            if (this.hasContentChanged(originalContent, markdownContent)) {
                await this.app.vault.modify(file, markdownContent);
            }
        } catch (error) {
            new Notice(t("Error during conversion from HTML to Markdown or saving."));
            console.error('Save error:', error);
        } finally {
            window.setTimeout(() => {
                this.isSavingInternally = false;
            }, this.SAVE_INTERNALY_DELAY);
        }
    }

    shouldIgnoreExternalModify(): boolean {
        const sinceSave = Date.now() - this.lastInternalSaveAt;
        return this.isSavingInternally || sinceSave < this.IGNORE_MODIFY_DURATION;
    }

    async loadFileContent(
        fileToLoad: TFile,
        editorDiv: HTMLDivElement,
        renderer: ViewRenderer,
        onRendered?: () => void
    ): Promise<void> {
        if (!editorDiv) return;

        const scrollPosition = this.saveScrollPosition(editorDiv);

        try {
            const fileContent = await this.app.vault.read(fileToLoad);
            // 外部で frontmatter だけ編集された場合にも追随できるよう、読み込みのたびに取り直す
            const body = this.extractFrontmatter(fileContent);
            const htmlContent = await this.convertMarkdownToHTML(body);

            this.renderHTMLToEditor(htmlContent, editorDiv, renderer, scrollPosition, onRendered);
        } catch (error) {
            renderer.displayEmptyMessage(t('Failed to load file "%1".', fileToLoad.basename));
            console.error('Load error:', error);
        }
    }

    /**
     * frontmatter を切り出して保持し、本文だけを返す。
     * 直後の空行まで含めて保持することで、保存時に元のファイルと同じ形へ復元できる。
     */
    private extractFrontmatter(content: string): string {
        const { frontmatter, body } = splitFrontmatter(content);
        // 前のファイルの frontmatter が残らないよう、無い場合も必ず上書きする
        this.frontmatter = frontmatter;
        return body;
    }

    private convertDOMToMarkdown(editorDiv: HTMLDivElement): string {
        const clonedDiv = editorDiv.cloneNode(true) as HTMLDivElement;
        return domToMarkdown(clonedDiv, new SwitchText(this.app));
    }

    private async convertMarkdownToHTML(fileContent: string): Promise<string> {
        const sw = new SwitchText(this.app);
        // SwitchText側で空行処理を完結させるため、ここでの後処理を削除
        return await sw.fromMarkdownToHTML(fileContent);
    }

    private saveScrollPosition(editorDiv: HTMLDivElement): { top: number; left: number } {
        return {
            top: editorDiv.scrollTop,
            left: editorDiv.scrollLeft
        };
    }

    private renderHTMLToEditor(
        htmlContent: string,
        editorDiv: HTMLDivElement,
        renderer: ViewRenderer,
        scrollPosition: { top: number; left: number },
        onRendered?: () => void
    ): void {
        requestAnimationFrame(() => {
            editorDiv.empty();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, "text/html");

            Array.from(doc.body.childNodes).forEach(node => {
                editorDiv.appendChild(node.cloneNode(true));
            });

            renderer.applyStyles();

            requestAnimationFrame(() => {
                editorDiv.scrollTop = scrollPosition.top;
                editorDiv.scrollLeft = scrollPosition.left;
                renderer.applyCenterScroll();
                // 描画が確定してから行数バー等に通知する（列数の計測にはレイアウトが必要）
                onRendered?.();
            });
        });
    }

    private hasContentChanged(original: string, updated: string): boolean {
        const normalize = (str: string) => str.replace(/\r\n/g, '\n');
        return normalize(original) !== normalize(updated);
    }
}
