import { ItemView, WorkspaceLeaf, TFile, ViewStateResult } from "obsidian";
import { VerticalEditorSettings } from "./setting";
import VerticalEditorPlugin from "./main";
import { FileManager } from "./FileManager";
import { ViewRenderer } from "./ViewRenderer";
import { EditorManager } from "./EditorManager";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null;
    editorDiv: HTMLDivElement;
    
    private settings: VerticalEditorSettings;
    private plugin: VerticalEditorPlugin;

    private fileManager: FileManager;
    private viewRenderer: ViewRenderer;
    private editorManager: EditorManager;

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
        return this.file ? this.file.basename : "縦書きエディタ";
    }

    getIcon(): string {
        return "text-glyph";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass(VERTICAL_EDITOR_VIEW_TYPE + "-container", "vertical-editor-grid-container");

        this.editorDiv = container.createDiv({ cls: VERTICAL_EDITOR_VIEW_TYPE });
        this.editorDiv.contentEditable = "true";
        this.editorDiv.addClass('vertical-editor-view');

        this.fileManager = new FileManager(this.app);
        this.viewRenderer = new ViewRenderer(this.editorDiv, this.settings, this.plugin);
        this.editorManager = new EditorManager(this.editorDiv, this.plugin, this.fileManager, this.settings);

        this.editorManager.setupEventListeners();
        this.viewRenderer.applyStyles();

        if (this.file) {
            this.loadFileContent(this.file);
        } else {
            this.viewRenderer.displayEmptyMessage("ファイルを読み込み中...");
        }
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        const filePath = state?.file;
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
                this.viewRenderer.displayEmptyMessage("ファイルが指定されていません。");
            }
        }
        this.refreshStatusBar();
    }

    getState(): any {
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
        this.refreshStatusBar();
    }

    refreshStatusBar(): void {
        if (this.editorManager) {
            this.editorManager.refreshStatusBar();
        }
    }

    async onClose(): Promise<void> {
        this.editorManager.removeEventListeners();
        if (this.file) {
            await this.fileManager.saveContent(this.file, this.editorDiv.innerHTML);
        }
    }
}