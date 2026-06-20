import { ItemView, WorkspaceLeaf, TFile, ViewStateResult } from "obsidian";
import { VerticalEditorSettings } from "./setting";
import VerticalEditorPlugin from "./main";
import { FileManager } from "./FileManager";
import { ViewRenderer } from "./ViewRenderer";
import { EditorManager } from "./EditorManager";
import { t } from "./localization";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

interface VerticalEditorViewState {
    [key: string]: unknown;
    file?: string;
}

export class VerticalEditorView extends ItemView {
    file: TFile | null = null;
    editorDiv!: HTMLDivElement;

    private settings: VerticalEditorSettings;
    private plugin: VerticalEditorPlugin;

    private fileManager!: FileManager;
    private viewRenderer!: ViewRenderer;
    private editorManager!: EditorManager;
    private fileModifyEventRef: any = null;

    get isSavingInternally(): boolean {
        return this.fileManager.isSavingInternally;
    }

    constructor(leaf: WorkspaceLeaf, settings: VerticalEditorSettings, plugin: VerticalEditorPlugin) {
        super(leaf);
        this.settings = settings;
        this.plugin = plugin;
    }

    getViewType(): string {
        return VERTICAL_EDITOR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file ? this.file.basename : t("Vertical Editor");
    }

    getIcon(): string {
        return "text-glyph";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass(VERTICAL_EDITOR_VIEW_TYPE + "-container", "vertical-editor-grid-container");

        // Obsidian の .view-content スタイルと干渉しないよう専用スクロールコンテナを挟む
        const scrollContainer = container.createDiv({ cls: "vertical-editor-scroll-container" });

        this.editorDiv = scrollContainer.createDiv({ cls: VERTICAL_EDITOR_VIEW_TYPE });
        this.editorDiv.contentEditable = "true";
        this.editorDiv.addClass('vertical-editor-view');

        this.fileManager = new FileManager(this.app);
        this.viewRenderer = new ViewRenderer(this.editorDiv, this.settings, this.plugin);
        this.editorManager = new EditorManager(this.editorDiv, this.plugin, this.fileManager, this.settings);

        this.viewRenderer.applyStyles();

        // DOMに接続された後でイベントリスナーを設定
        await new Promise(resolve => setTimeout(resolve, 0));
        this.editorManager.setupEventListeners();
        this.setupFileWatcher();

        if (this.file) {
            await this.loadFileContent(this.file);
        } else {
            this.viewRenderer.displayEmptyMessage(t("Loading file..."));
        }
    }

    async setState(state: VerticalEditorViewState, result: ViewStateResult): Promise<void> {
        const filePath = state?.file as string;
        let fileChanged = false;

        if (filePath && typeof filePath === 'string') {
            if (!this.file || this.file.path !== filePath) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                this.file = file instanceof TFile ? file : null;
                fileChanged = true;
            }
        } else if (this.file) {
            this.file = null;
            fileChanged = true;
        }

        await super.setState(state, result);

        if (this.editorDiv && fileChanged) {
            this.editorManager.setFile(this.file);
            if (this.file) {
                await this.loadFileContent(this.file);
            } else {
                this.viewRenderer.displayEmptyMessage(t("No file specified."));
            }
        }
        this.refreshStatusBar();
    }

    getState(): VerticalEditorViewState {
        return { file: this.file?.path };
    }
    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
        this.viewRenderer.updateSettings(newSettings);
        if (this.editorManager) {
            this.editorManager.updateSettings(newSettings);
        }
        this.refreshStatusBar();
    }

    async loadFileContent(fileToLoad: TFile): Promise<void> {
        await this.fileManager.loadFileContent(fileToLoad, this.editorDiv, this.viewRenderer);
        if (this.editorManager) {
            this.editorManager.resetDirty();
        }
        this.refreshStatusBar();
    }

    refreshStatusBar(): void {
        if (this.editorManager) {
            this.editorManager.refreshStatusBar();
        }
    }

    private setupFileWatcher(): void {
        // 既存の監視を解除
        if (this.fileModifyEventRef) {
            this.app.vault.offref(this.fileModifyEventRef);
            this.fileModifyEventRef = null;
        }

        // ファイル変更を監視
        this.fileModifyEventRef = this.app.vault.on('modify', async (modifiedFile) => {
            // 現在のファイルが変更された場合
            if (this.file && modifiedFile.path === this.file.path) {
                // 内部保存中は無視（無限ループ防止）
                if (this.fileManager.shouldIgnoreExternalModify()) {
                    return;
                }
                // 外部変更を検出したので、リロード
                await this.loadFileContent(this.file);
            }
        });
    }

    async onClose(): Promise<void> {
        // イベント監視を解除
        if (this.fileModifyEventRef) {
            this.app.vault.offref(this.fileModifyEventRef);
            this.fileModifyEventRef = null;
        }

        this.editorManager.removeEventListeners();

        // 実際に編集があった場合のみ保存
        if (this.file && this.editorManager.getDirty()) {
            await this.fileManager.saveContent(this.file, this.editorDiv);
        }
    }
}
