import { App, TFile, Notice } from "obsidian";
import { SwitchText } from "./SwitchText";
import { ViewRenderer } from "./ViewRenderer";
import { t } from "./localization";

export class FileManager {
    private app: App;
    public isSavingInternally = false;

    constructor(app: App) {
        this.app = app;
    }

    async saveContent(file: TFile, editorDiv: HTMLDivElement): Promise<void> {
        if (this.isSavingInternally) return;

        this.isSavingInternally = true;
        const sw = new SwitchText(this.app);
        try {
            // 編集内容の HTML をクローンして処理（元の DOM を保持するため）
            const clonedDiv = editorDiv.cloneNode(true) as HTMLDivElement;

            const markdownContent = sw.fromHTMLToMarkdown(clonedDiv);

            // 元のファイル内容と比較して、実際に変更があるときだけ保存
            const originalContent = await this.app.vault.read(file);

            // 正規化して比較（改行コードの統一のみ。末尾の空行も保持するため trim しない）
            const normalizedOriginal = originalContent.replace(/\r\n/g, '\n');
            const normalizedNew = markdownContent.replace(/\r\n/g, '\n');

            if (normalizedOriginal !== normalizedNew) {
                await this.app.vault.modify(file, markdownContent);
            }
        } catch (_error) {
            new Notice(t("Error during conversion from HTML to Markdown or saving."));
        } finally {
            window.setTimeout(() => {
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

            // 連続改行を空行として視覚化
            // \n\n のみ → そのまま（段落区切り）
            // \n\n\n 以上 → \n\n + [[EMPTY_LINE]] (空行数-1個)
            const displayContent = fileContent.replace(/\n{2,}/g, (m) => {
                const blankLines = m.length - 1;
                if (blankLines === 1) {
                    // \n\n = 空行1つ、そのままで OK
                    return m;
                }
                // \n\n\n 以上 = 空行2つ以上
                // 最初の \n\n は段落区切りで、残りを [[EMPTY_LINE]] として可視化
                return '\n\n' + '[[EMPTY_LINE]]\n'.repeat(blankLines - 1);
            });

            const sw = new SwitchText(this.app);
            let htmlContent = await sw.fromMarkdownToHTML(displayContent);

            // プレースホルダーを視覚的な空行に置換
            htmlContent = htmlContent
                .replace(/<p>\s*\[\[EMPTY_LINE\]\]\s*<\/p>/g, '<p class="ve-empty-line"><br></p>')
                .replace(/\[\[EMPTY_LINE\]\]/g, '<p class="ve-empty-line"><br></p>');

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
        } catch (_error) {
            renderer.displayEmptyMessage(t('Failed to load file "%1".', fileToLoad.basename));
        }
    }
}
