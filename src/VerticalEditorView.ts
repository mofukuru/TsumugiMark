import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, TAbstractFile, Notice } from "obsidian";
import { SwitchText } from "./switchtext";

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null;
    editorDiv: HTMLDivElement; // editorDivへの参照を保持

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
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
    }

    // ビューの状態を保存するために重要です。
    getState(): any {
        return { file: this.file?.path };
    }

    // このメソッドはビューが初めて開かれる際に呼び出されます。
    async onOpen(): Promise<void> {
        // containerEl.children[1] はObsidianのビューでコンテンツ要素を取得する標準的な方法です。
        const container = this.containerEl.children[1];
        container.empty(); // 既存のコンテンツをクリア
        container.addClass(VERTICAL_EDITOR_VIEW_TYPE + "-container"); // スタイル付けのためのクラスを追加

        // editorDivを作成し、クラスと編集可能性を設定
        this.editorDiv = container.createDiv({ cls: VERTICAL_EDITOR_VIEW_TYPE });
        this.editorDiv.contentEditable = "true";

        // 縦書きのための基本的なスタイルを適用
        this.editorDiv.style.writingMode = "vertical-rl";
        this.editorDiv.style.height = "100%"; // 高さを100%に
        this.editorDiv.style.padding = "20px"; // 内側の余白
        this.editorDiv.style.fontSize = "18px"; // フォントサイズ
        this.editorDiv.style.lineHeight = "1.8"; // 行間
        // 一般的な日本語フォントを指定（ユーザーの環境に合わせて調整が必要な場合あり）
        this.editorDiv.style.fontFamily = '游明朝, "Yu Mincho", YuMincho, "Hiragino Mincho ProN", "MS PMincho", serif';

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
            if (this.file) {
                const htmlContent = this.editorDiv.innerHTML;
                // console.log(`VerticalEditorView: ${this.file.path} のコンテンツが変更されました。保存処理は現在コメントアウトされています。`);
                // TODO: SwitchTextを使用してHTMLからMarkdownへの変換を実装し、保存する。
                const sw = new SwitchText(this.app);
                try {
                    const markdownContent = await sw.fromHTMLToMarkdown(htmlContent);
                    await this.app.vault.modify(this.file, markdownContent);
                    new Notice("ファイルが保存されました。");
                } catch (error) {
                    new Notice("HTMLからMarkdownへの変換または保存中にエラーが発生しました。");
                    // console.error("Error converting HTML to Markdown or saving:", error);
                }
            }
        });
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
            this.editorDiv.innerHTML = htmlContent; // エディタにHTMLを設定
            this.file = fileToLoad; // this.fileを確実に更新
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
        }
        // this.updateDisplayText(); // メッセージ表示時もタブタイトルを更新（ファイル名がない状態になる） -> 削除
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
