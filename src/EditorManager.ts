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
    private isEditorFocused = false;
    private lastEditorInteraction = 0;
    private isDirty = false;

    constructor(editorDiv: HTMLDivElement, plugin: VerticalEditorPlugin, fileManager: FileManager, settings: VerticalEditorSettings) {
        this.editorDiv = editorDiv;
        this.plugin = plugin;
        this.fileManager = fileManager;
        this.settings = settings;
    }

    setupEventListeners() {
        console.log('=== EditorManager Setup ===');
        console.log('editorDiv:', this.editorDiv);
        console.log('editorDiv contentEditable:', this.editorDiv.contentEditable);
        console.log('editorDiv tabIndex:', this.editorDiv.tabIndex);

        // tabIndexを設定してフォーカス可能にする
        if (this.editorDiv.tabIndex === -1) {
            this.editorDiv.tabIndex = 0;
            console.log('Set tabIndex to 0');
        }

            // クリック時に明示的にフォーカスを設定（preventDefaultしない）
            this.plugin.registerDomEvent(this.editorDiv, 'click', () => {
                console.log('EditorDiv clicked, focusing...');
                this.lastEditorInteraction = Date.now();
                this.isEditorFocused = true;
                this.editorDiv.focus();
            });

        // フォーカス状態を管理
        this.plugin.registerDomEvent(this.editorDiv, 'focusin', () => {
            this.isEditorFocused = true;
                this.lastEditorInteraction = Date.now();
            console.log('Editor focused');
        });
        this.plugin.registerDomEvent(this.editorDiv, 'focusout', () => {
            this.isEditorFocused = false;
            console.log('Editor blurred');
        });

        // focusout, input, selectionchange
        this.plugin.registerDomEvent(this.editorDiv, "focusout", this.onFocusOut);
        this.plugin.registerDomEvent(this.editorDiv, "input", this.onInput);
        this.plugin.registerDomEvent(document, "selectionchange", this.onSelectionChange);

        // documentレベルでキーイベントを捕捉
        this.plugin.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
            const recentlyInteracted = Date.now() - this.lastEditorInteraction < 3000;
            if (this.isEditorFocused || recentlyInteracted) {
                console.log('Key in editor (flag/recent):', e.key);
                this.onKeyDown(e);
            }
        });

        console.log('Event listeners registered');
    }

    removeEventListeners() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.inputTimeout) {
            clearTimeout(this.inputTimeout);
            this.inputTimeout = null;
        }
    }

    setFile(file: TFile | null) {
        this.file = file;
    }

    public resetDirty() {
        this.isDirty = false;
    }

    public getDirty(): boolean {
        return this.isDirty;
    }

    updateSettings(newSettings: VerticalEditorSettings) {
        this.settings = newSettings;
        this.refreshStatusBar();
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            console.log('Enter key pressed, shift:', e.shiftKey);

            if (e.shiftKey) {
                // Shift+Enter: 改行（<br>）を挿入
                this.insertLineBreak();
            } else {
                // Enter: 新しい段落（<p>）を作成
                this.insertParagraphV2();
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

        // カーソルを<br>の後ろに移動
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);

        this.isDirty = true;
    }

    private insertParagraphV2(): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // 現在の段落を見つける
        let currentNode: Node | null = range.startContainer;
        let currentParagraph: HTMLElement | null = null;
        while (currentNode && currentNode !== this.editorDiv) {
            if (currentNode.nodeType === Node.ELEMENT_NODE) {
                const el = currentNode as HTMLElement;
                if (el.tagName === 'P') {
                    currentParagraph = el;
                    break;
                }
            }
            currentNode = currentNode.parentNode;
        }

        const newP = document.createElement('p');

        if (!currentParagraph) {
            newP.innerHTML = '<br>';
            this.editorDiv.appendChild(newP);
        } else {
            // カーソル以降の内容を切り出す
            const after = document.createRange();
            after.setStart(range.endContainer, range.endOffset);
            if (currentParagraph.lastChild) {
                after.setEndAfter(currentParagraph.lastChild);
            } else {
                after.setEndAfter(currentParagraph);
            }

            const fragment = after.extractContents();
            if (fragment.childNodes.length === 0 || (fragment.textContent || '').trim() === '') {
                newP.innerHTML = '<br>';
            } else {
                newP.appendChild(fragment);
            }

            // 現在の段落が空なら高さを確保
            if ((currentParagraph.textContent || '').trim() === '') {
                currentParagraph.innerHTML = '<br>';
            }

            currentParagraph.insertAdjacentElement('afterend', newP);
        }

        // カーソルを新しい段落の先頭へ
        const newRange = document.createRange();
        newRange.setStart(newP, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        this.isDirty = true;
    }

    private onInput = () => {
        // 入力があったらステータスバーを更新
        if (this.inputTimeout) {
            clearTimeout(this.inputTimeout);
        }
        this.inputTimeout = setTimeout(() => {
            this.refreshStatusBar();
        }, 100);

        // 自動保存をデバウンス（2秒後）
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveContentDebounced();
        }, 2000);

        this.isDirty = true;
    };

    private saveContentDebounced = () => {
        if (this.file && this.isDirty) {
            void this.fileManager.saveContent(this.file, this.editorDiv).then(() => {
                this.isDirty = false;
            });
        }
    };

    private onFocusOut = () => {
        // フォーカスアウト時は即座に保存
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.file && this.isDirty) {
            void this.fileManager.saveContent(this.file, this.editorDiv).then(() => {
                this.isDirty = false;
            });
        }
    };

    private onSelectionChange = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (!range.collapsed && this.editorDiv.contains(range.commonAncestorContainer)) {
                let selectedText = range.toString();
                if (this.settings.charCountMode === 'excludeSpaces') {
                    selectedText = selectedText.replace(/\s/g, '');
                }
                this.plugin.updateCharacterCount(this.countCharacters(), selectedText.length);
            } else {
                this.refreshStatusBar();
            }
        }
    };

    private countCharacters(): number {
        if (this.editorDiv) {
            let text = '';
            const walker = document.createTreeWalker(this.editorDiv, NodeFilter.SHOW_TEXT, null);
            let node;
            while ((node = walker.nextNode())) {
                if (node.parentElement && (node.parentElement.tagName === 'RT' || node.parentElement.tagName === 'RP')) {
                    continue;
                }
                text += node.nodeValue;
            }

            if (this.settings.charCountMode === 'excludeSpaces') {
                return text.replace(/\s/g, '').length;
            }
            return text.replace(/\n/g, "").length;
        }
        return 0;
    }

    public refreshStatusBar(): void {
        if (!this.editorDiv || !this.plugin) return;

        if (this.file) {
            const charCount = this.countCharacters();
            this.plugin.updateCharacterCount(charCount);
        } else {
            this.plugin.clearCharacterCount();
        }
    }
}
