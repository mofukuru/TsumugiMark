import VerticalEditorPlugin from "./main";
import { FileManager } from "./FileManager";
import { TFile } from "obsidian";
import { VerticalEditorSettings } from "./setting";

export class EditorManager {
    private editorDiv: HTMLDivElement;
    private plugin: VerticalEditorPlugin;
    private fileManager: FileManager;
    private file: TFile | null = null;
    private settings: VerticalEditorSettings;
    private saveTimeout: NodeJS.Timeout | null = null;
    private inputTimeout: NodeJS.Timeout | null = null;
    private isDirty = false;

    private readonly AUTO_SAVE_DELAY = 2000;
    private readonly STATUS_BAR_UPDATE_DELAY = 100;

    constructor(
        editorDiv: HTMLDivElement,
        plugin: VerticalEditorPlugin,
        fileManager: FileManager,
        settings: VerticalEditorSettings
    ) {
        this.editorDiv = editorDiv;
        this.plugin = plugin;
        this.fileManager = fileManager;
        this.settings = settings;
    }

    setupEventListeners(): void {
        this.setupEditorFocus();
        this.registerInputHandlers();
        this.registerKeyboardHandlers();
    }

    removeEventListeners(): void {
        this.clearTimeouts();
    }

    setFile(file: TFile | null): void {
        this.file = file;
    }

    resetDirty(): void {
        this.isDirty = false;
    }

    getDirty(): boolean {
        return this.isDirty;
    }

    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
        this.refreshStatusBar();
    }

    refreshStatusBar(): void {
        const charCount = this.countCharacters();
        this.plugin.updateCharacterCount(charCount, 0);
    }

    private setupEditorFocus(): void {
        if (this.editorDiv.tabIndex === -1) {
            this.editorDiv.tabIndex = 0;
        }

        this.plugin.registerDomEvent(this.editorDiv, 'click', () => {
            this.editorDiv.focus();
        });
    }

    private registerInputHandlers(): void {
        this.plugin.registerDomEvent(this.editorDiv, "input", this.onInput);
        this.plugin.registerDomEvent(this.editorDiv, "focusout", this.onFocusOut);
        this.plugin.registerDomEvent(document, "selectionchange", this.onSelectionChange);
    }

    private registerKeyboardHandlers(): void {
        this.plugin.registerDomEvent(this.editorDiv, "keydown", (e: KeyboardEvent) => {
            if (e.isComposing) return;
            this.onKeyDown(e);
        });
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            if (e.shiftKey) {
                this.insertLineBreak();
            } else {
                this.insertParagraph();
            }
        }
    };

    private insertLineBreak(): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        range.insertNode(br);

        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);

        this.isDirty = true;
    }

    private insertParagraph(): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const currentParagraph = this.findParentParagraph(range.startContainer);
        const newParagraph = document.createElement('p');

        if (!currentParagraph) {
            newParagraph.innerHTML = '<br>';
            this.editorDiv.appendChild(newParagraph);
        } else {
            this.splitParagraph(range, currentParagraph, newParagraph);
        }

        this.moveCursorToParagraphStart(newParagraph);
        this.isDirty = true;
    }

    private findParentParagraph(node: Node): HTMLElement | null {
        let current: Node | null = node;
        while (current && current !== this.editorDiv) {
            if (current.nodeType === Node.ELEMENT_NODE && (current as HTMLElement).tagName === 'P') {
                return current as HTMLElement;
            }
            current = current.parentNode;
        }
        return null;
    }

    private splitParagraph(range: Range, currentParagraph: HTMLElement, newParagraph: HTMLElement): void {
        const afterRange = document.createRange();
        afterRange.setStart(range.endContainer, range.endOffset);
        
        if (currentParagraph.lastChild) {
            afterRange.setEndAfter(currentParagraph.lastChild);
        } else {
            afterRange.setEndAfter(currentParagraph);
        }

        const fragment = afterRange.extractContents();
        const isFragmentEmpty = fragment.childNodes.length === 0 || (fragment.textContent || '').trim() === '';
        
        if (isFragmentEmpty) {
            newParagraph.innerHTML = '<br>';
        } else {
            newParagraph.appendChild(fragment);
        }

        if ((currentParagraph.textContent || '').trim() === '') {
            currentParagraph.innerHTML = '<br>';
        }

        currentParagraph.insertAdjacentElement('afterend', newParagraph);
    }

    private moveCursorToParagraphStart(paragraph: HTMLElement): void {
        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        range.setStart(paragraph, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    private onInput = (): void => {
        this.scheduleStatusBarUpdate();
        this.scheduleAutoSave();
        this.isDirty = true;
    };

    private onFocusOut = (): void => {
        this.clearTimeouts();
        this.saveIfDirty();
    };

    private onSelectionChange = (): void => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!range.collapsed && this.editorDiv.contains(range.commonAncestorContainer)) {
            const selectedText = this.getSelectedText(range);
            this.plugin.updateCharacterCount(this.countCharacters(), selectedText.length);
        } else {
            this.refreshStatusBar();
        }
    };

    private getSelectedText(range: Range): string {
        let text = range.toString();
        if (this.settings.charCountMode === 'excludeSpaces') {
            text = text.replace(/\s/g, '');
        }
        return text;
    }

    private scheduleStatusBarUpdate(): void {
        if (this.inputTimeout) {
            clearTimeout(this.inputTimeout);
        }
        this.inputTimeout = setTimeout(() => {
            this.refreshStatusBar();
        }, this.STATUS_BAR_UPDATE_DELAY);
    }

    private scheduleAutoSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveIfDirty();
        }, this.AUTO_SAVE_DELAY);
    }

    private saveIfDirty(): void {
        if (this.file && this.isDirty) {
            void this.fileManager.saveContent(this.file, this.editorDiv).then(() => {
                this.isDirty = false;
            });
        }
    }

    private clearTimeouts(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.inputTimeout) {
            clearTimeout(this.inputTimeout);
            this.inputTimeout = null;
        }
    }

    private countCharacters(): number {
        if (!this.editorDiv) return 0;

        let text = '';
        const walker = document.createTreeWalker(
            this.editorDiv,
            NodeFilter.SHOW_TEXT,
            null
        );

        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (parent && (parent.tagName === 'RT' || parent.tagName === 'RP')) {
                continue;
            }
            text += node.textContent || '';
        }

        if (this.settings.charCountMode === 'excludeSpaces') {
            text = text.replace(/\s/g, '');
        }

        return text.length;
    }
}
