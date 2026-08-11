import VerticalEditorPlugin from "./main";
import { FileManager } from "./FileManager";
import { TFile } from "obsidian";
import { VerticalEditorSettings } from "./setting";
import { TypewriterScroller } from "./TypewriterScroller";
import { LineCountBar } from "./LineCountBar";
import { RubyMatch, matchBotenAtEnd, matchRubyAtEnd } from "./SwitchText";

export class EditorManager {
    private editorDiv: HTMLDivElement;
    private plugin: VerticalEditorPlugin;
    private fileManager: FileManager;
    private file: TFile | null = null;
    private settings: VerticalEditorSettings;
    private typewriterScroller: TypewriterScroller | null;
    private lineCountBar: LineCountBar | null;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private inputTimeout: ReturnType<typeof setTimeout> | null = null;
    private isDirty = false;
    private isComposing = false;
    /** ハイライト中の段落（切り替え時にクラスを外すため保持する） */
    private activeParagraph: HTMLElement | null = null;

    private readonly AUTO_SAVE_DELAY = 2000;
    private readonly STATUS_BAR_UPDATE_DELAY = 100;

    constructor(
        editorDiv: HTMLDivElement,
        plugin: VerticalEditorPlugin,
        fileManager: FileManager,
        settings: VerticalEditorSettings,
        typewriterScroller: TypewriterScroller | null = null,
        lineCountBar: LineCountBar | null = null
    ) {
        this.editorDiv = editorDiv;
        this.plugin = plugin;
        this.fileManager = fileManager;
        this.settings = settings;
        this.typewriterScroller = typewriterScroller;
        this.lineCountBar = lineCountBar;
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
        // 再読み込みで DOM ごと入れ替わるため、ハイライトの参照も捨てる
        this.activeParagraph = null;
    }

    getDirty(): boolean {
        return this.isDirty;
    }

    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
        if (!newSettings.highlightActiveParagraph) {
            this.sweepActiveParagraph();
        }
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
        this.plugin.registerDomEvent(this.editorDiv, "compositionstart", this.onCompositionStart);
        this.plugin.registerDomEvent(this.editorDiv, "compositionend", this.onCompositionEnd);
    }

    private onCompositionStart = (): void => {
        this.isComposing = true;
        this.typewriterScroller?.setComposing(true);
    };

    private onCompositionEnd = (): void => {
        this.isComposing = false;
        this.typewriterScroller?.setComposing(false);
        // 全角の 》）} は IME 確定で入力されるため、ここでも一度ライブ変換を試す
        if (this.tryConvertMarkupAtCursor()) {
            this.isDirty = true;
        }
    };

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
        } else if (e.key === ' ') {
            this.handleSpaceForHeading(e);
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
            if (current.nodeType === Node.ELEMENT_NODE) {
                const tag = (current as HTMLElement).tagName;
                if (tag === 'P' || /^H[1-6]$/.test(tag)) {
                    return current as HTMLElement;
                }
            }
            current = current.parentNode;
        }
        return null;
    }

    private handleSpaceForHeading(e: KeyboardEvent): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (!range.collapsed) return;

        const currentBlock = this.findParentParagraph(range.startContainer);

        // <p> 要素内のケース
        if (currentBlock && currentBlock.tagName === 'P') {
            const text = currentBlock.textContent || '';
            const m = /^(#{1,6})$/.exec(text.trim());
            if (!m) return;

            e.preventDefault();
            e.stopPropagation();
            this.convertNodeToHeading(currentBlock, m[1].length);
            return;
        }

        // <p> 外（空ノートの先頭等）: テキストノードが editorDiv の直接の子の場合
        if (!currentBlock) {
            const container = range.startContainer;
            if (container.nodeType !== Node.TEXT_NODE) return;
            if (container.parentElement !== this.editorDiv) return;

            const text = container.textContent || '';
            const m = /^(#{1,6})$/.exec(text.trim());
            if (!m) return;

            e.preventDefault();
            e.stopPropagation();

            const level = m[1].length;
            const heading = document.createElement(`h${level}`);
            heading.innerHTML = '<br>';
            this.editorDiv.insertBefore(heading, container);
            (container as ChildNode).remove();
            this.moveCursorInsideHeading(heading);
            this.isDirty = true;
        }
    }

    private convertNodeToHeading(node: HTMLElement, level: number): void {
        const heading = document.createElement(`h${level}`);
        heading.innerHTML = '<br>';
        node.replaceWith(heading);
        this.moveCursorInsideHeading(heading);
        this.isDirty = true;
    }

    private moveCursorInsideHeading(heading: HTMLElement): void {
        const selection = window.getSelection();
        if (!selection) return;

        const br = heading.querySelector('br');
        const range = document.createRange();
        if (br) {
            range.setStartBefore(br);
        } else {
            range.setStart(heading, 0);
        }
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
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
        this.typewriterScroller?.notifyTyping();
        if (!this.isComposing) {
            this.tryConvertMarkupAtCursor();
        }
        this.lineCountBar?.scheduleUpdate();
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
        const isInsideEditor = this.editorDiv.contains(range.commonAncestorContainer);

        if (range.collapsed && isInsideEditor) {
            this.typewriterScroller?.notifyCursorMove();
            this.updateActiveParagraph(range);
            this.lineCountBar?.scheduleUpdate();
        }

        if (!range.collapsed && isInsideEditor) {
            const selectedText = this.getSelectedText(range);
            this.plugin.updateCharacterCount(this.countCharacters(), selectedText.length);
        } else {
            this.refreshStatusBar();
        }
    };

    /** カーソルのある段落にハイライト用クラスを付け替える。 */
    private updateActiveParagraph(range: Range): void {
        if (!this.settings.highlightActiveParagraph) {
            if (this.activeParagraph) this.clearActiveParagraph();
            return;
        }

        const paragraph = this.findParentParagraph(range.startContainer);
        if (paragraph === this.activeParagraph) return;

        this.clearActiveParagraph();
        if (paragraph) {
            paragraph.addClass('ve-active-paragraph');
            this.activeParagraph = paragraph;
        }
    }

    private clearActiveParagraph(): void {
        this.activeParagraph?.removeClass('ve-active-paragraph');
        this.activeParagraph = null;
    }

    /** 設定 OFF 時やファイル再読み込み後に、取り残されたハイライトを掃除する。 */
    private sweepActiveParagraph(): void {
        this.clearActiveParagraph();
        this.editorDiv.querySelectorAll('.ve-active-paragraph')
            .forEach(el => el.removeClass('ve-active-paragraph'));
    }

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

    /**
     * 選択範囲にルビを振る（ルビ挿入コマンドの実体）。
     * ルビ本体は未入力の状態で <rt> にカーソルを置き、そのまま入力できるようにする。
     */
    insertRuby(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        if (range.collapsed) return false;
        if (!this.editorDiv.contains(range.commonAncestorContainer)) return false;

        const baseText = range.toString();
        if (baseText.length === 0) return false;

        range.deleteContents();

        const ruby = document.createElement('ruby');
        ruby.setAttribute('data-ruby-syntax', 'pipe-full-angle');
        ruby.appendChild(document.createTextNode(baseText));
        const rt = document.createElement('rt');
        ruby.appendChild(rt);
        range.insertNode(ruby);

        const rubyRange = document.createRange();
        rubyRange.setStart(rt, 0);
        rubyRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(rubyRange);

        this.isDirty = true;
        this.scheduleAutoSave();
        return true;
    }

    /**
     * カーソル直前のテキストがルビ／傍点記法ならその場で要素へ変換する（ライブ変換）。
     * 保存→再読み込みを待たずに縦書き表示へ反映させるための処理。
     */
    private tryConvertMarkupAtCursor(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        if (!range.collapsed) return false;

        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return false;
        if (!this.editorDiv.contains(node)) return false;
        // 既存のルビ・傍点の内部では発動させない（二重変換の防止）
        if (this.isInsideConvertedMarkup(node)) return false;

        const textNode = node as Text;
        const textBeforeCursor = (textNode.textContent || '').slice(0, range.startOffset);
        if (textBeforeCursor.length === 0) return false;

        // 1打鍵ごとに全記法の正規表現を回さないよう、閉じ括弧が入力されたときだけ判定する
        if (!'》）)}'.includes(textBeforeCursor[textBeforeCursor.length - 1])) return false;

        const boten = matchBotenAtEnd(textBeforeCursor);
        if (boten) {
            const strong = document.createElement('strong');
            strong.addClass('ve-boten');
            strong.appendChild(document.createTextNode(boten.text));
            return this.replaceTextRangeWithElement(textNode, textBeforeCursor.length - boten.raw.length, boten.raw.length, strong);
        }

        const ruby = matchRubyAtEnd(textBeforeCursor);
        if (ruby) {
            return this.replaceTextRangeWithElement(
                textNode,
                textBeforeCursor.length - ruby.raw.length,
                ruby.raw.length,
                this.buildRubyElement(ruby)
            );
        }

        return false;
    }

    private buildRubyElement(match: RubyMatch): HTMLElement {
        const ruby = document.createElement('ruby');
        ruby.setAttribute('data-ruby-syntax', match.syntax);
        // 丸括弧形式は全角/半角パイプの別も保存時の復元に必要
        if (match.pipe && (match.syntax === 'pipe-full-paren' || match.syntax === 'pipe-half-paren')) {
            ruby.setAttribute('data-ruby-pipe', match.pipe === '｜' ? 'full' : 'half');
        }

        if (match.mono) {
            match.mono.forEach(pair => {
                ruby.appendChild(document.createTextNode(pair.base));
                const rt = document.createElement('rt');
                rt.setText(pair.ruby);
                ruby.appendChild(rt);
            });
            return ruby;
        }

        ruby.appendChild(document.createTextNode(match.base));
        const rt = document.createElement('rt');
        rt.setText(match.ruby);
        ruby.appendChild(rt);
        return ruby;
    }

    private isInsideConvertedMarkup(node: Node): boolean {
        let current: Node | null = node;
        while (current && current !== this.editorDiv) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const el = current as HTMLElement;
                if (el.tagName === 'RUBY' || el.tagName === 'RT' || el.tagName === 'RP') return true;
                if (el.classList.contains('ve-boten')) return true;
                if (el.classList.contains('ve-protected')) return true;
            }
            current = current.parentNode;
        }
        return false;
    }

    /** テキストノードの [start, start+length) を要素で置き換え、カーソルをその直後へ移す。 */
    private replaceTextRangeWithElement(textNode: Text, start: number, length: number, element: HTMLElement): boolean {
        const parent = textNode.parentNode;
        if (!parent) return false;

        const target = start > 0 ? textNode.splitText(start) : textNode;
        target.splitText(length); // 記法より後ろのテキストを切り離す
        parent.replaceChild(element, target);

        const selection = window.getSelection();
        if (selection) {
            const range = document.createRange();
            range.setStartAfter(element);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        this.isDirty = true;
        return true;
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
            // 保護ブロックは表示用に元の Markdown ソースを抱えているため本文の文字数に混ぜない
            if (parent && parent.closest('.ve-protected')) {
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
