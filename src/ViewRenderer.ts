import { VerticalEditorSettings, DEFAULT_SETTINGS } from "./setting";
import VerticalEditorPlugin from "./main";

export class ViewRenderer {
    private editorDiv: HTMLDivElement;
    private settings: VerticalEditorSettings;
    private plugin: VerticalEditorPlugin;
    private resizeObserver: ResizeObserver | null = null;

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
        this.editorDiv.style.setProperty('--vertical-editor-writing-mode', this.settings.writingMode || DEFAULT_SETTINGS.writingMode);

        // 自動字下げの設定に応じてクラスを切り替え
        if (this.settings.enableAutoIndent) {
            this.editorDiv.addClass('auto-indent-enabled');
        } else {
            this.editorDiv.removeClass('auto-indent-enabled');
        }

        // 列の配置をコンテナのクラスで切り替え
        const container = this.editorDiv.parentElement;
        if (container) {
            container.removeClass('column-align-left', 'column-align-center', 'column-align-right');
            container.addClass(`column-align-${this.settings.columnAlignment || DEFAULT_SETTINGS.columnAlignment}`);
        }

        // center以外に切り替えたときはObserverを解除し、center時は中央スクロールを反映
        if ((this.settings.columnAlignment || DEFAULT_SETTINGS.columnAlignment) !== 'center') {
            this.resizeObserver?.disconnect();
            this.resizeObserver = null;
        } else {
            // クラス適用後のレイアウト確定を待って中央化する
            requestAnimationFrame(() => this.applyCenterScroll());
        }
    }

    applyCenterScroll(): void {
        const alignment = this.settings.columnAlignment || DEFAULT_SETTINGS.columnAlignment;
        const container = this.editorDiv.parentElement as HTMLElement | null;
        if (!container || alignment !== 'center') return;

        const doCenter = () => {
            // コンテンツが収まる場合は scrollWidth === clientWidth となり 0（CSSの中央寄せを維持）
            container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
        };

        doCenter();

        if (!this.resizeObserver) {
            this.resizeObserver = new ResizeObserver(doCenter);
            this.resizeObserver.observe(container);
        }
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
