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

    constructor(editorDiv: HTMLDivElement, plugin: VerticalEditorPlugin, fileManager: FileManager, settings: VerticalEditorSettings) {
        this.editorDiv = editorDiv;
        this.plugin = plugin;
        this.fileManager = fileManager;
        this.settings = settings;
    }

    setupEventListeners() {
        this.editorDiv.addEventListener("focusout", this.onFocusOut);
        document.addEventListener("selectionchange", this.onSelectionChange);
    }

    removeEventListeners() {
        this.editorDiv.removeEventListener("focusout", this.onFocusOut);
        document.removeEventListener("selectionchange", this.onSelectionChange);
    }

    setFile(file: TFile | null) {
        this.file = file;
    }

    updateSettings(newSettings: VerticalEditorSettings) {
        this.settings = newSettings;
        this.refreshStatusBar();
    }

    private onFocusOut = () => {
        if (this.file) {
                        this.fileManager.saveContent(this.file, this.editorDiv);
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
            while (node = walker.nextNode()) {
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