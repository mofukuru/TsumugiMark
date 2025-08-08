import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, TAbstractFile, Notice } from "obsidian";
import { SwitchText } from "./switchText";
import { VerticalEditorSettings, DEFAULT_SETTINGS } from "./setting";
import VerticalEditorPlugin from "./main";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null;
    editorDiv: HTMLDivElement; // editorDivへの参照を保持
    private debounceTimer: number | null = null;
    isSavingInternally: boolean = false;
    private settings: VerticalEditorSettings;
    private plugin: VerticalEditorPlugin;

    constructor(leaf: WorkspaceLeaf, settings: VerticalEditorSettings, plugin: VerticalEditorPlugin) {
        super(leaf);
        this.settings = settings;
        this.plugin = plugin;
    }

    getViewType(): string {
        return VERTICAL_EDITOR_VIEW_TYPE;
    }

    getDisplayText(): string {
        // ファイル名が存在すればそれを、なければデフォルトのテキストを表示
        return this.file ? this.file.basename : "縦書きエディタ";
    }

    getIcon(): string {
        // アイコン名を返す（例: "text" や Obsidian が提供する他のアイコン）
        return "text-glyph"; // より適切なアイコンに変更可能
    }

    // 設定に基づいてスタイルを適用するメソッド
    applyStyles(): void {
        if (!this.editorDiv) return;
        this.editorDiv.style.fontFamily = this.settings.fontFamily || DEFAULT_SETTINGS.fontFamily;
        this.editorDiv.style.fontSize = this.settings.fontSize || DEFAULT_SETTINGS.fontSize;
        this.editorDiv.style.lineHeight = this.settings.lineHeight || DEFAULT_SETTINGS.lineHeight;
        this.editorDiv.style.letterSpacing = this.settings.letterSpacing || DEFAULT_SETTINGS.letterSpacing;
        // maxWidth は縦書きモードでは「高さ」に相当するため、height に適用する
        // ただし、writing-mode: vertical-rl の場合、CSSのwidthが縦書きの「高さ」、CSSのheightが縦書きの「幅」になる。
        // したがって、一行の最大幅（文字数）を制御するには、CSSのheightプロパティを調整する必要がある。
        this.editorDiv.style.height = this.settings.maxHeight || DEFAULT_SETTINGS.maxHeight;
        this.editorDiv.style.lineBreak = "strict";
    }

    // 外部から設定が更新されたときに呼び出されるメソッド
    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
        this.applyStyles(); // スタイルを再適用
        this.refreshStatusBar();
    }

    // このメソッドはビューの状態が設定される際に呼び出されます。
    // ビューが初めて開かれる時や、ビューにナビゲートした際に呼び出されることが多いです。
    async setState(state: any, result: ViewStateResult): Promise<void> {
        // console.log("VerticalEditorView: setState が次のstateで呼び出されました:", state);
        const filePath = state?.file; // stateオブジェクトからファイルパスを取得
        let fileChanged = false; // ファイルが変更されたかどうかのフラグ

        if (filePath && typeof filePath === 'string') {
            // 新しいファイルパスが現在のファイルパスと異なる場合のみ更新
            if (!this.file || this.file.path !== filePath) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    this.file = file; // TFileインスタンスであればthis.fileに設定
                    fileChanged = true;
                    // console.log("VerticalEditorView: setStateでファイルが設定されました:", this.file.path);
                } else {
                    this.file = null; // ファイルが見つからないかTFileでなければnullに
                    fileChanged = true;
                    // console.warn(`VerticalEditorView: パス「${filePath}」のファイルが見つからないか、TFileではありません。`);
                }
            }
        } else if (this.file) { // stateにファイルがないが、ビューにはファイルが設定されていた場合
            this.file = null; // this.fileをnullにリセット
            fileChanged = true;
            // console.log("VerticalEditorView: stateにファイルパスがないため、this.fileがnullにリセットされました。");
        }

        // 親クラスのsetStateを呼び出すことが重要です。
        // これにより、Obsidianフレームワークがビューの変更を認識し、getDisplayText()などを再評価するきっかけとなります。
        await super.setState(state, result);

        // editorDivが初期化済みで、かつファイルが実際に変更された（または初回ロードの）場合にコンテンツをロード
        if (this.editorDiv && fileChanged) {
            if (this.file) {
                await this.loadFileContent(this.file);
            } else {
                this.displayEmptyMessage("ファイルが指定されていません。");
            }
        } else if (this.editorDiv && !this.file && !filePath) {
            // editorDivは準備できているが、ファイルが指定されていない場合（例: stateなしで直接ビューが開かれた）
             this.displayEmptyMessage("ファイルを開くか、選択してください。");
        }
        // this.updateDisplayText(); // タブのタイトルを更新 -> 削除。super.setState() と getDisplayText() で処理される
        this.applyStyles();
        this.refreshStatusBar();
    }

    // ビューの状態を保存するために重要です。
    getState(): any {
        return { file: this.file?.path };
    }

    // このメソッドはビューが初めて開かれる際に呼び出されます。
    async onOpen(): Promise<void> {
        // containerEl.children[1] はObsidianのビューでコンテンツ要素を取得する標準的な方法です。
        const container = this.containerEl.children[1] as HTMLElement; // Cast to HTMLElement for style property
        container.empty(); // 既存のコンテンツをクリア
        container.addClass(VERTICAL_EDITOR_VIEW_TYPE + "-container"); // スタイル付けのためのクラスを追加
        // Make the parent container a grid container.
        // This will allow the child (editorDiv) to stretch and correctly size itself
        // when writing-mode is vertical.
        container.style.display = "grid";

        // editorDivを作成し、クラスと編集可能性を設定
        this.editorDiv = container.createDiv({ cls: VERTICAL_EDITOR_VIEW_TYPE });
        // 縦書きエディタを編集できるようにするかどうか？
        this.editorDiv.contentEditable = "false";

        // 縦書きのための基本的なスタイルを適用
        this.editorDiv.style.writingMode = "vertical-rl";
        // Let the editorDiv stretch to the grid cell.
        // Its CSS height (screen width in vertical-rl) will become container.width.
        // Its CSS width (screen height in vertical-rl) will become container.height.
        // Remove explicit height: this.editorDiv.style.height = "100%";
        this.editorDiv.style.padding = "20px"; // 内側の余白
        this.editorDiv.style.outline = "none"; // 枠線をなくす
        this.editorDiv.style.contain = "layout style paint";

        this.applyStyles();

        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .${VERTICAL_EDITOR_VIEW_TYPE} p {
                margin: 0;
            }
            /* Ensure editorDiv itself takes up the grid cell if it's the only child */
            .${VERTICAL_EDITOR_VIEW_TYPE} {
                /* width and height will be determined by grid stretch */
                box-sizing: border-box; /* Include padding in width/height calculations */
            }
        `;
        this.containerEl.appendChild(styleEl);
        // console.log("VerticalEditorView: onOpen。初期のthis.file:", this.file?.path);

        // コンテンツの読み込みは主にsetStateによって処理されます。
        // もしthis.fileが既に設定されていれば（例：ビューが復元された場合など）、ここでコンテンツを読み込みます。
        // そうでなければ、setStateが呼び出されてloadFileContentをトリガーします。
        if (this.file) {
            await this.loadFileContent(this.file);
        } else {
            // 一時的な読み込みメッセージか空の状態を表示します。
            // setStateがファイル情報を取得した際にこれを更新します。
            this.displayEmptyMessage("ファイルを読み込み中...");
        }

        // エディタ内の変更を検知するイベントリスナー
        this.editorDiv.addEventListener("input", async () => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = window.setTimeout(async () => {
                this.refreshStatusBar();
                if (this.file) {
                    this.isSavingInternally = true;
                    const htmlContent = this.editorDiv.innerHTML;
                    // console.log(`VerticalEditorView: ${this.file.path} のコンテンツが変更されました。保存処理は現在コメントアウトされています。`);
                    // TODO: SwitchTextを使用してHTMLからMarkdownへの変換を実装し、保存する。
                    const sw = new SwitchText(this.app);
                    try {
                        const markdownContent = await sw.fromHTMLToMarkdown(htmlContent);
                        await this.app.vault.modify(this.file, markdownContent);
                        // new Notice("ファイルが保存されました。");
                    } catch (error) {
                        new Notice("HTMLからMarkdownへの変換または保存中にエラーが発生しました。");
                        // console.error("Error converting HTML to Markdown or saving:", error);
                    } finally {
                        setTimeout(() => {
                            this.isSavingInternally = false;
                        }, 0);
                    }
                }
        }, 1000);
        });
        this.refreshStatusBar();
    }

    async saveContent() {
        if (this.file) {
            this.isSavingInternally = true;
            const htmlContent = this.editorDiv.innerHTML;
            const sw = new SwitchText(this.app);
            try {
                const markdownContent = await sw.fromHTMLToMarkdown(htmlContent);
                await this.app.vault.modify(this.file, markdownContent);
            } catch (error) {
                new Notice("HTMLからMarkdownへの変換または保存中にエラーが発生しました。");
            } finally {
                setTimeout(() => {
                    this.isSavingInternally = false;
                }, 100);
            }
        }
    }

    // ファイルの内容をエディタに読み込むヘルパーメソッド
    async loadFileContent(fileToLoad: TFile): Promise<void> {
        // console.log(`VerticalEditorView: loadFileContent が ${fileToLoad.path} のために呼び出されました。`);
        if (!this.editorDiv) {
            // console.error("VerticalEditorView: loadFileContentでeditorDivが初期化されていません。");
            return;
        }
        this.editorDiv.empty(); // 以前のコンテンツをクリア

        try {
            const fileContent = await this.app.vault.read(fileToLoad); // ファイル内容を読み込む
            const sw = new SwitchText(this.app);
            const htmlContent = await sw.fromMarkdownToHTML(fileContent); // MarkdownをHTMLに変換

            // console.log("設定するHTMLコンテンツ:", htmlContent.substring(0, 100) + "..."); // HTMLの一部をログに出力
            // this.editorDiv.innerHTML = htmlContent; // エディタにHTMLを設定
            requestAnimationFrame(() => {
                if (this.editorDiv && this.file === fileToLoad) {
                    this.editorDiv.innerHTML = htmlContent;
                    this.applyStyles();
                    this.refreshStatusBar();
                }
            });
            this.file = fileToLoad; // this.fileを確実に更新
            // this.applyStyles();
            // this.refreshStatusBar();
            // this.updateDisplayText(); // タブのタイトルを更新 -> 削除
        } catch (error) {
            // console.error(`VerticalEditorView: ファイル ${fileToLoad.path} の読み込みまたは処理中にエラー:`, error);
            this.displayEmptyMessage(`ファイル「${fileToLoad.basename}」の読み込みに失敗しました。`);
        }
    }

    // エディタにメッセージを表示するヘルパーメソッド（例：ファイルがロードされていない場合）
    displayEmptyMessage(message: string): void {
        if (this.editorDiv) {
            // メッセージは横書きで見やすいようにスタイル調整
            this.editorDiv.innerHTML = `<div style="writing-mode: horizontal-tb; text-align: center; color: grey; padding-top: 50px;">${message}</div>`;
            this.applyStyles();
        }
        this.plugin.clearCharacterCount();
        // this.updateDisplayText(); // メッセージ表示時もタブタイトルを更新（ファイル名がない状態になる） -> 削除
    }

    private countCharacters(): number {
        if (this.editorDiv) {
            let count = 0;
            // TreeWalkerを使用してテキストノードのみを効率的に走査
            const walker = document.createTreeWalker(
                this.editorDiv,
                NodeFilter.SHOW_TEXT, // テキストノードのみを対象
                null // カスタムフィルタは不要
            );

            let node;
            while (node = walker.nextNode()) {
                // 親要素が <rt> または <rp> の場合はカウントから除外
                if (node.parentElement && (node.parentElement.tagName === 'RT' || node.parentElement.tagName === 'RP')) {
                    continue;
                }
                count += node.nodeValue?.replace(/\n/g, "").length || 0;
            }
            return count;
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

    // 表示テキスト（タブタイトル）を更新するヘルパーメソッドは不要になったため削除
    // updateDisplayText(): void {
    //     // ObsidianのAPIにはタブタイトルを直接リフレッシュする明確なメソッドがないため、
    //     // ヘッダーの更新を試みることで間接的に更新を促します。
    //     // this.leaf.updateHeader(); // Error: Property 'updateHeader' does not exist on type 'WorkspaceLeaf'.
    // }

    // ビューが閉じられる際に呼び出されます。
    async onClose(): Promise<void> {
        // リソースやイベントリスナーなどをクリーンアップします。
        // console.log("VerticalEditorView: 次のファイルのために閉じられました:", this.file?.path);
        // editorDiv自体に設定されたリスナーは、ビューと共に破棄されるため、手動での削除は通常不要です。
    }
}
