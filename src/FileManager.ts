import { App, TFile, Notice } from "obsidian";
import { SwitchText } from "./SwitchText";
import { ViewRenderer } from "./ViewRenderer";
import { t } from "./localization";

interface Token {
    type: 'text' | 'blank';
    content?: string;
}

export class FileManager {
    private app: App;
    public isSavingInternally = false;
    private lastInternalSaveAt = 0;
    private readonly IGNORE_MODIFY_DURATION = 1500;
    private readonly SAVE_INTERNALY_DELAY = 100;

    constructor(app: App) {
        this.app = app;
    }

    async saveContent(file: TFile, editorDiv: HTMLDivElement): Promise<void> {
        if (this.isSavingInternally) return;

        this.isSavingInternally = true;
        this.lastInternalSaveAt = Date.now();
        
        try {
            const originalContent = await this.app.vault.read(file);
            const markdownContent = this.convertDOMToMarkdown(editorDiv);
            
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

    async loadFileContent(fileToLoad: TFile, editorDiv: HTMLDivElement, renderer: ViewRenderer): Promise<void> {
        if (!editorDiv) return;

        const scrollPosition = this.saveScrollPosition(editorDiv);

        try {
            const fileContent = await this.app.vault.read(fileToLoad);
            const htmlContent = await this.convertMarkdownToHTML(fileContent);
            
            this.renderHTMLToEditor(htmlContent, editorDiv, renderer, scrollPosition);
        } catch (error) {
            renderer.displayEmptyMessage(t('Failed to load file "%1".', fileToLoad.basename));
            console.error('Load error:', error);
        }
    }

    private convertDOMToMarkdown(editorDiv: HTMLDivElement): string {
        const clonedDiv = editorDiv.cloneNode(true) as HTMLDivElement;
        const tokens = this.extractTokensFromDOM(clonedDiv);
        return this.tokensToMarkdown(tokens);
    }

    private extractTokensFromDOM(div: HTMLDivElement): Token[] {
        const sw = new SwitchText(this.app);
        const tokens: Token[] = [];
        const nodes = Array.from(div.childNodes);

        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                
                if (this.isEmptyLine(el)) {
                    tokens.push({ type: 'blank' });
                    return;
                }

                const md = sw.fromHTMLToMarkdown(el).trimEnd();
                if (md.length > 0) {
                    tokens.push({ type: 'text', content: md });
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = (node.textContent || '').trimEnd();
                if (text.length > 0) {
                    tokens.push({ type: 'text', content: text });
                }
            }
        });

        return tokens;
    }

    private isEmptyLine(el: HTMLElement): boolean {
        if (el.classList.contains('ve-empty-line')) {
            return true;
        }

        if (el.tagName === 'P') {
            const children = Array.from(el.childNodes);
            const hasOnlyBr = children.length === 1 && children[0].nodeName === 'BR';
            const isEmpty = children.length === 0 || (el.textContent || '').trim() === '';
            return hasOnlyBr || isEmpty;
        }

        return false;
    }

    private tokensToMarkdown(tokens: Token[]): string {
        let markdown = '';
        let pendingBlanks = 0;
        let hasText = false;

        tokens.forEach(token => {
            if (token.type === 'blank') {
                pendingBlanks++;
                return;
            }

            if (!hasText) {
                if (pendingBlanks > 0) {
                    markdown += '\n'.repeat(pendingBlanks);
                    pendingBlanks = 0;
                }
                markdown += token.content;
                hasText = true;
            } else {
                const newlineCount = pendingBlanks + 1;
                markdown += '\n'.repeat(newlineCount);
                markdown += token.content;
                pendingBlanks = 0;
            }
        });

        if (pendingBlanks > 0) {
            markdown += '\n'.repeat(pendingBlanks);
        }

        return markdown;
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
        scrollPosition: { top: number; left: number }
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
            });
        });
    }

    private hasContentChanged(original: string, updated: string): boolean {
        const normalize = (str: string) => str.replace(/\r\n/g, '\n');
        return normalize(original) !== normalize(updated);
    }
}
