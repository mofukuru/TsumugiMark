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
        this.editorDiv.style.setProperty('--vertical-editor-font-family', this.settings.fontFamily || DEFAULT_SETTINGS.fontFamily);
        this.editorDiv.style.setProperty('--vertical-editor-font-size', this.settings.fontSize || DEFAULT_SETTINGS.fontSize);
        this.editorDiv.style.setProperty('--vertical-editor-line-height', this.settings.lineHeight || DEFAULT_SETTINGS.lineHeight);
        this.editorDiv.style.setProperty('--vertical-editor-letter-spacing', this.settings.letterSpacing || DEFAULT_SETTINGS.letterSpacing);
        this.editorDiv.style.setProperty('--vertical-editor-max-height', this.settings.maxHeight || DEFAULT_SETTINGS.maxHeight);
    }

    displayEmptyMessage(message: string): void {
        if (this.editorDiv) {
            this.editorDiv.empty();
            this.editorDiv.createDiv({ cls: 'vertical-editor-message', text: message });
            this.applyStyles();
        }
        this.plugin.clearCharacterCount();
    }

    updateSettings(newSettings: VerticalEditorSettings) {
        this.settings = newSettings;
        this.applyStyles();
    }
}
