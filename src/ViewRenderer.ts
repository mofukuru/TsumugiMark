import { VerticalEditorSettings, DEFAULT_SETTINGS } from "./setting";
import VerticalEditorPlugin from "./main";

export class ViewRenderer {
    private editorDiv: HTMLDivElement;
    private settings: VerticalEditorSettings;
    private plugin: VerticalEditorPlugin;

    constructor(editorDiv: HTMLDivElement, settings: VerticalEditorSettings, plugin: VerticalEditorPlugin) {
        this.editorDiv = editorDiv;
        this.settings = settings;
        this.plugin = plugin;
    }

    applyStyles(): void {
        if (!this.editorDiv) return;
        this.editorDiv.style.fontFamily = this.settings.fontFamily || DEFAULT_SETTINGS.fontFamily;
        this.editorDiv.style.fontSize = this.settings.fontSize || DEFAULT_SETTINGS.fontSize;
        this.editorDiv.style.lineHeight = this.settings.lineHeight || DEFAULT_SETTINGS.lineHeight;
        this.editorDiv.style.letterSpacing = this.settings.letterSpacing || DEFAULT_SETTINGS.letterSpacing;
        this.editorDiv.style.height = this.settings.maxHeight || DEFAULT_SETTINGS.maxHeight;
        // this.editorDiv.style.lineBreak = "strict";
        // this.editorDiv.style.wordBreak = 'keep-all';
    }

    displayEmptyMessage(message: string): void {
        if (this.editorDiv) {
            this.editorDiv.innerHTML = `<div style="writing-mode: horizontal-tb; text-align: center; color: grey; padding-top: 50px;">${message}</div>`;
            this.applyStyles();
        }
        this.plugin.clearCharacterCount();
    }

    updateSettings(newSettings: VerticalEditorSettings) {
        this.settings = newSettings;
        this.applyStyles();
    }
}
