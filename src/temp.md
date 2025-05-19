# A1

Obsidianプラグインに設定画面を追加し、縦書きエディタのフォントファミリー、フォントサイズ、行間などをユーザーがカスタマイズできるようにしたいのですね。

これには、以下の手順で進めます。

1.  **設定項目の定義**: プラグインで管理したい設定項目（例：フォントファミリー、フォントサイズ、行間）とそのデフォルト値を決めます。
2.  **設定タブクラスの作成**: Obsidianの `PluginSettingTab` を拡張したクラスを作成し、設定UIを構築します。
3.  **設定の読み込みと保存**: メインプラグインクラス (`main.ts`) で設定を読み込み、保存する処理を実装します。
4.  **設定の適用**: `VerticalEditorView` で読み込まれた設定値を使用してエディタのスタイルを適用します。また、設定が変更された際に動的にスタイルが更新されるようにします。

以下に、具体的なコード例を示します。

まず、新しいファイル `setting.ts` を作成します。

**`setting.ts` の内容:**

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import VerticalEditorPlugin from './main'; // main.ts の VerticalEditorPlugin クラスをインポート

// 設定項目のインターフェースを定義
export interface VerticalEditorSettings {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    // 今後、他の設定項目を追加できます
}

// 設定のデフォルト値を定義
export const DEFAULT_SETTINGS: VerticalEditorSettings = {
    fontFamily: '游明朝, "Yu Mincho", YuMincho, "Hiragino Mincho ProN", "MS PMincho", serif',
    fontSize: '18px',
    lineHeight: '1.8',
};

// 設定タブを管理するクラス
export class VerticalEditorSettingTab extends PluginSettingTab {
    plugin: VerticalEditorPlugin;

    constructor(app: App, plugin: VerticalEditorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty(); // 設定画面をクリア
        containerEl.createEl('h2', { text: 'Vertical Editor Settings' });

        // フォントファミリー設定
        new Setting(containerEl)
            .setName('Font Family')
            .setDesc('縦書きエディタのフォントファミリーを設定します。(例: "游明朝", "MS PMincho", serif)')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.fontFamily)
                .setValue(this.plugin.settings.fontFamily)
                .onChange(async (value) => {
                    this.plugin.settings.fontFamily = value;
                    await this.plugin.saveSettingsAndUpdateViews(); // 設定を保存し、ビューを更新
                }));

        // フォントサイズ設定
        new Setting(containerEl)
            .setName('Font Size')
            .setDesc('縦書きエディタのフォントサイズを設定します。(例: 18px, 1.2em)')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.fontSize)
                .setValue(this.plugin.settings.fontSize)
                .onChange(async (value) => {
                    this.plugin.settings.fontSize = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 行間の設定
        new Setting(containerEl)
            .setName('Line Height')
            .setDesc('縦書きエディタの行間を設定します。(例: 1.8, 2)')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.lineHeight)
                .setValue(this.plugin.settings.lineHeight)
                .onChange(async (value) => {
                    this.plugin.settings.lineHeight = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));
    }
}
```

次に、`main.ts` を修正して、設定の読み込み、保存、設定タブの追加処理を実装します。

**`main.ts` の修正点:**

```typescript
import { Plugin, Notice, setIcon, MarkdownView, WorkspaceLeaf, TFile } from "obsidian"; // TFile をインポート
import { VerticalEditorView, VERTICAL_EDITOR_VIEW_TYPE } from "./verticaleditorview";
import { SwitchView } from "./switchview";
// setting.ts から必要なものをインポート
import { VerticalEditorSettingTab, VerticalEditorSettings, DEFAULT_SETTINGS } from "./setting";

export default class VerticalEditorPlugin extends Plugin {
  settings: VerticalEditorSettings; // settings プロパティを追加

  async onload() {
    await this.loadSettings(); // 設定をロード

    // 設定タブを追加
    this.addSettingTab(new VerticalEditorSettingTab(this.app, this));

    // register vertical editor view
    this.registerView(
      VERTICAL_EDITOR_VIEW_TYPE,
      // VerticalEditorView のコンストラクタに settings を渡すように変更
      (leaf) => new VerticalEditorView(leaf, this.settings)
    );

    // command to open vertical editor
    this.addCommand({
      id: "open-vertical-editor",
      name: "open vertical editor",
      callback: () => {
        const sv = new SwitchView(this.app);
        sv.fromMarkdownToVert();
      },
    });

    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf && leaf.view instanceof MarkdownView) {
        const header = leaf.view.containerEl.querySelector(".view-actions");
        if (header && !header.querySelector(".vertical-editor-button")) {
          const btn = document.createElement("button");
          btn.classList.add("clickable-icon", "vertical-editor-button");
          setIcon(btn, "notebook-text")
          btn.setAttribute("aria-label", "convert to vertical-editor")
          btn.addEventListener("click", () => {
            const sv = new SwitchView(this.app);
            sv.fromMarkdownToVert();
          });
          header.insertAdjacentElement("afterbegin", btn);
        }
      }
    }));

    // file-open イベントリスナー (以前の回答からの修正をマージ)
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file instanceof TFile) { // TFile の場合のみ処理
          this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view as VerticalEditorView;
            if (view.file?.path === file.path) { // 同じファイルが開かれている場合
              view.loadFileContent(file); // コンテンツを再読み込み
            } else if (!view.file) { // ビューがファイルを開いていない場合
              // 必要に応じて、新しく開かれたファイルをこのビューに割り当てるロジック
              // view.file = file;
              // view.loadFileContent(file);
            }
          });
        }
      })
    );

    // vault 'modify' イベントリスナー (以前の回答から)
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view as VerticalEditorView;
            if (view.file && view.file.path === file.path) {
              view.loadFileContent(file);
            }
          });
        }
      })
    );
  }

  // 設定を読み込むメソッド
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  // 設定を保存し、開いているビューを更新するメソッド
  async saveSettingsAndUpdateViews() {
    await this.saveData(this.settings);
    // 開いているすべての VerticalEditorView に設定の更新を通知
    this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
      if (leaf.view instanceof VerticalEditorView) {
        leaf.view.updateSettings(this.settings);
      }
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE);
  }
}
```

最後に、`verticaleditorview.ts` を修正して、設定をコンストラクタで受け取り、スタイルに適用し、設定変更時に更新できるようにします。

**`verticaleditorview.ts` の修正点:**

```typescript
import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, Notice } from "obsidian";
import { SwitchText } from "./switchtext";
// setting.ts から VerticalEditorSettings をインポート
import { VerticalEditorSettings, DEFAULT_SETTINGS } from "./setting"; // DEFAULT_SETTINGSも使うかもしれないのでインポート

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null;
    editorDiv: HTMLDivElement;
    private settings: VerticalEditorSettings; // settings プロパティを追加

    // コンストラクタで settings を受け取る
    constructor(leaf: WorkspaceLeaf, settings: VerticalEditorSettings) {
        super(leaf);
        this.settings = settings; // 受け取った設定を保存
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

    // 設定に基づいてスタイルを適用するメソッド
    applyStyles(): void {
        if (!this.editorDiv) return;
        this.editorDiv.style.fontFamily = this.settings.fontFamily || DEFAULT_SETTINGS.fontFamily;
        this.editorDiv.style.fontSize = this.settings.fontSize || DEFAULT_SETTINGS.fontSize;
        this.editorDiv.style.lineHeight = this.settings.lineHeight || DEFAULT_SETTINGS.lineHeight;
    }

    // 外部から設定が更新されたときに呼び出されるメソッド
    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
        this.applyStyles(); // スタイルを再適用
        // 必要であれば、エディタの再描画など他の処理もここに追加
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass(VERTICAL_EDITOR_VIEW_TYPE + "-container");

        this.editorDiv = container.createDiv({ cls: VERTICAL_EDITOR_VIEW_TYPE });
        this.editorDiv.contentEditable = "true";

        // 基本スタイルを設定
        this.editorDiv.style.writingMode = "vertical-rl";
        this.editorDiv.style.height = "100%";
        this.editorDiv.style.padding = "20px";

        // 保存された設定に基づいてスタイルを適用
        this.applyStyles();

        // イベントリスナー (入力時の保存処理 - 前回の回答でコメントアウト解除した部分)
        this.editorDiv.addEventListener("input", async () => {
            if (this.file) {
                const htmlContent = this.editorDiv.innerHTML;
                // console.log(`VerticalEditorView: ${this.file.path} のコンテンツが変更されました。`); // 保存処理中のログ
                const sw = new SwitchText(this.app);
                try {
                    const markdownContent = await sw.fromHTMLToMarkdown(htmlContent);
                    await this.app.vault.modify(this.file, markdownContent);
                    // new Notice("ファイルが保存されました。"); // 頻繁に表示されるためコメントアウト推奨
                } catch (error) {
                    new Notice("HTMLからMarkdownへの変換または保存中にエラーが発生しました。");
                    console.error("Error converting HTML to Markdown or saving:", error);
                }
            }
        });

        // setState でファイルが指定されていれば、それをロード
        // (this.file は setState によって設定される可能性がある)
        if (this.file) {
            await this.loadFileContent(this.file);
        } else {
            this.displayEmptyMessage("ファイルを開くか、選択してください。");
        }
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        console.log("VerticalEditorView: setState が次のstateで呼び出されました:", state);
        const filePath = state?.file;
        let fileChanged = false;

        if (filePath && typeof filePath === 'string') {
            if (!this.file || this.file.path !== filePath) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    this.file = file;
                    fileChanged = true;
                } else {
                    this.file = null;
                    fileChanged = true;
                }
            }
        } else if (this.file) {
            this.file = null;
            fileChanged = true;
        }

        await super.setState(state, result);

        if (this.editorDiv && fileChanged) {
            if (this.file) {
                await this.loadFileContent(this.file);
            } else {
                this.displayEmptyMessage("ファイルが指定されていません。");
            }
        } else if (this.editorDiv && !this.file && !filePath) {
             this.displayEmptyMessage("ファイルを開くか、選択してください。");
        }
        this.applyStyles(); // setStateが呼ばれた際にもスタイルを適用（特に初期化時）
    }

    getState(): any {
        return { file: this.file?.path };
    }

    async loadFileContent(fileToLoad: TFile): Promise<void> {
        console.log(`VerticalEditorView: loadFileContent が ${fileToLoad.path} のために呼び出されました。`);
        if (!this.editorDiv) {
            console.error("VerticalEditorView: loadFileContentでeditorDivが初期化されていません。");
            return;
        }
        this.editorDiv.empty();

        try {
            const fileContent = await this.app.vault.read(fileToLoad);
            const sw = new SwitchText(this.app);
            const htmlContent = await sw.fromMarkdownToHTML(fileContent);
            this.editorDiv.innerHTML = htmlContent;
            this.file = fileToLoad;
            this.applyStyles(); // コンテンツロード後にもスタイルを適用
        } catch (error) {
            console.error(`VerticalEditorView: ファイル ${fileToLoad.path} の読み込みまたは処理中にエラー:`, error);
            this.displayEmptyMessage(`ファイル「${fileToLoad.basename}」の読み込みに失敗しました。`);
        }
    }

    displayEmptyMessage(message: string): void {
        if (this.editorDiv) {
            this.editorDiv.innerHTML = `<div style="writing-mode: horizontal-tb; text-align: center; color: grey; padding-top: 50px;">${message}</div>`;
            this.applyStyles(); // 空のメッセージ表示時も基本スタイルは適用
        }
    }

    async onClose(): Promise<void> {
        console.log("VerticalEditorView: 次のファイルのために閉じられました:", this.file?.path);
    }
}
```

**変更のポイント:**

  * **`setting.ts`**:
      * `VerticalEditorSettings` インターフェースで設定項目を定義します。
      * `DEFAULT_SETTINGS` で各設定の初期値を定義します。
      * `VerticalEditorSettingTab` クラスで、Obsidianの設定画面にUI要素（テキスト入力など）を追加し、値が変更されたら `this.plugin.saveSettingsAndUpdateViews()` を呼び出します。
  * **`main.ts`**:
      * `settings` プロパティを持ち、`loadSettings` でデータを読み込み、`saveSettingsAndUpdateViews` でデータを保存し、さらに開いている縦書きエディタビューに設定の更新を通知します。
      * `onload` で設定タブを `this.addSettingTab()` を使って登録します。
      * `VerticalEditorView` を登録する際に、コンストラクタに `this.settings` を渡します。
  * **`verticaleditorview.ts`**:
      * コンストラクタで `settings` を受け取り、インスタンス変数に保持します。
      * `applyStyles()` メソッドを作成し、保持している設定値に基づいて `editorDiv` のスタイルを実際に変更します。
      * `updateSettings(newSettings)` メソッドを作成し、メインプラグインから新しい設定が渡されたときに内部の `settings` を更新し、`applyStyles()` を呼び出して表示に反映させます。
      * `onOpen`、`loadFileContent`、`setState`、`displayEmptyMessage` の中で、適宜 `applyStyles()` を呼び出して、ビューの初期化時やコンテンツ変更時にもスタイルが適用されるようにします。

これで、Obsidianの設定画面から縦書きエディタのフォントファミリー、フォントサイズ、行間を変更でき、その設定がエディタに反映されるようになります。また、設定を変更すると、既に開いている縦書きエディタの表示も動的に更新されます。

# A2

縦書きエディタで編集しようとすると、カーソルが右上に強制的に移動してしまい、正常に入力できないとのこと、承知いたしました。

この問題は、いくつかの要因が複合的に絡み合って発生している可能性がありますが、最も可能性が高いのは、\*\*入力イベントによってファイルが保存され、その保存処理が即座にビューの再読み込みを引き起こし、結果としてエディタの内容が更新されてカーソル位置が失われる（または初期位置に戻る）\*\*というループが発生していることです。

具体的には以下の流れが考えられます：

1.  ユーザーが縦書きエディタで文字を入力する。
2.  `verticaleditorview.ts` の `editorDiv` の `input` イベントリスナーが発火する。
3.  イベントリスナー内で `this.app.vault.modify(this.file, markdownContent)` が実行され、ファイルが保存される。
4.  このファイル保存（`modify`）を `main.ts` の `this.app.vault.on('modify', ...)` イベントリスナーが検知する。
5.  `main.ts` の `modify` リスナーは、縦書きエディタビュー (`VerticalEditorView`) の `loadFileContent(file)` メソッドを呼び出す。
6.  `loadFileContent` メソッド内で `this.editorDiv.innerHTML = htmlContent;` が実行され、エディタのDOMが再構築される。
7.  DOMが再構築された結果、カーソルは初期位置（縦書きの場合は右上や先頭）に移動してしまう。

このループを防ぐために、縦書きエディタ自身が保存処理を行っている間は、`main.ts` の `modify` リスナーによるビューの再読み込みを一時的に抑制する仕組みを導入します。

以下に修正案を提示します。

**1. `verticaleditorview.ts` の修正**

`VerticalEditorView` クラスに、現在自身が保存処理中であることを示すフラグ `isCurrentlySaving` を追加し、保存処理の前後にこのフラグを操作します。

```typescript
// verticaleditorview.ts

import { ItemView, WorkspaceLeaf, TFile, ViewStateResult, Notice } from "obsidian";
import { SwitchText } from "./switchtext";
import { VerticalEditorSettings, DEFAULT_SETTINGS } from "./setting"; // 既存のインポート

export const VERTICAL_EDITOR_VIEW_TYPE = "vertical-editor";

export class VerticalEditorView extends ItemView {
    file: TFile | null = null;
    editorDiv: HTMLDivElement;
    private settings: VerticalEditorSettings;
    public isCurrentlySaving: boolean = false; // ★ 保存中フラグを追加

    constructor(leaf: WorkspaceLeaf, settings: VerticalEditorSettings) {
        super(leaf);
        this.settings = settings;
    }

    // ... (getViewType, getDisplayText, getIcon, applyStyles, updateSettings は変更なし) ...

    async onOpen(): Promise<void> {
        // ... (既存の onOpen の前半部分は変更なし) ...
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass(VERTICAL_EDITOR_VIEW_TYPE + "-container");

        this.editorDiv = container.createDiv({ cls: VERTICAL_EDITOR_VIEW_TYPE });
        this.editorDiv.contentEditable = "true";

        this.editorDiv.style.writingMode = "vertical-rl";
        this.editorDiv.style.height = "100%";
        this.editorDiv.style.padding = "20px";
        this.applyStyles();

        // イベントリスナーの修正
        this.editorDiv.addEventListener("input", async () => {
            if (this.file) {
                const htmlContent = this.editorDiv.innerHTML;
                const sw = new SwitchText(this.app);
                try {
                    const markdownContent = await sw.fromHTMLToMarkdown(htmlContent);

                    this.isCurrentlySaving = true; // ★ 保存開始をマーク
                    await this.app.vault.modify(this.file, markdownContent);
                    // new Notice("ファイルが保存されました。"); // 頻繁なのでコメントアウト推奨

                    // フラグを少し遅れて下ろすことで、'modify'イベントハンドラが
                    // このフラグを正しく認識する時間を確保します。
                    // 0msのsetTimeoutでも、イベントキューの次のティックで実行されるため効果がある場合があります。
                    setTimeout(() => {
                        this.isCurrentlySaving = false; // ★ 保存完了後にマークを解除
                    }, 0);

                } catch (error) {
                    new Notice("HTMLからMarkdownへの変換または保存中にエラーが発生しました。");
                    console.error("Error converting HTML to Markdown or saving:", error);
                    this.isCurrentlySaving = false; // ★ エラー時もマークを解除
                }
            }
        });

        if (this.file) {
            await this.loadFileContent(this.file);
        } else {
            this.displayEmptyMessage("ファイルを開くか、選択してください。");
        }
    }

    // ... (setState, getState, loadFileContent, displayEmptyMessage, onClose は変更なし) ...
    // loadFileContent内で isCurrentlySaving を気にする必要は、この修正案の範囲では直接的にはありません。
    // main.ts側で呼び出しを制御するためです。
}
```

**変更点:**

  * `public isCurrentlySaving: boolean = false;` をクラスのプロパティとして追加しました。
  * `input` イベントリスナー内で、`app.vault.modify` を呼び出す直前に `this.isCurrentlySaving = true;` を設定し、処理が終わった後（またはエラー発生時）に `setTimeout(() => { this.isCurrentlySaving = false; }, 0);` でフラグを `false` に戻しています。`setTimeout` を使うことで、`modify` イベントが処理されるタイミングでフラグが正しく反映されている可能性を高めます。

**2. `main.ts` の修正**

`app.vault.on('modify', ...)` のイベントリスナー内で、`VerticalEditorView` の `isCurrentlySaving` フラグを確認し、フラグが `true` の場合は `loadFileContent` の呼び出しをスキップするようにします。

```typescript
// main.ts

// ... (既存のインポートは変更なし) ...
import { VerticalEditorView, VERTICAL_EDITOR_VIEW_TYPE } from "./verticaleditorview"; // VerticalEditorView の型情報を得るため
import { TFile } from "obsidian"; // TFile を明示的にインポート

// ... (VerticalEditorPlugin クラスの定義と onload メソッド前半は変更なし) ...

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VerticalEditorSettingTab(this.app, this));
    this.registerView(
      VERTICAL_EDITOR_VIEW_TYPE,
      (leaf) => new VerticalEditorView(leaf, this.settings)
    );

    // ... (addCommand, active-leaf-change リスナーは変更なし) ...

    // file-open イベントリスナー (変更なし)
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        // file が TFile のインスタンスであるかを確認した方がより安全です
        if (file instanceof TFile) {
          this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view as VerticalEditorView;
            // view.file の存在も確認するとより安全
            if (view.file && view.file.path === file.path) {
              // view.loadFileContent(file); // このイベントでの再読み込みは必要に応じて検討
            } else if (!view.file) {
              // ...
            }
          });
        }
      })
    );

    // vault 'modify' イベントリスナーの修正
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view as VerticalEditorView; // キャストして isCurrentlySaving にアクセス
            // ビューがファイルを持っていて、そのパスが変更されたファイルのパスと一致し、
            // かつ、ビューが現在自身で保存中でない場合
            if (view.file && view.file.path === file.path && !view.isCurrentlySaving) {
              // console.log(`External modification detected for ${file.basename}, reloading vertical editor.`); // デバッグ用
              view.loadFileContent(file);
            } else if (view.file && view.file.path === file.path && view.isCurrentlySaving) {
              // console.log(`Internal save detected for ${file.basename}, skipping reload in vertical editor to preserve cursor.`); // デバッグ用
            }
          });
        }
      })
    );
  }

// ... (loadSettings, saveSettingsAndUpdateViews, onunload は変更なし) ...
```

**変更点:**

  * `app.vault.on('modify', ...)` リスナー内で、`loadFileContent` を呼び出す前に `!view.isCurrentlySaving` という条件を追加しました。これにより、縦書きエディタが自身で保存処理を行っている最中は、このリスナーによる `loadFileContent` の呼び出しがスキップされ、カーソル位置が保持されることが期待できます。

**試していただきたいこと:**

上記の修正を適用した後、再度縦書きエディタで入力を試してみてください。これにより、入力中にカーソルが飛んでしまう問題が改善される可能性があります。

**それでも問題が解決しない場合:**

  * **ブラウザのデベロッパーツールのコンソールを確認**: 何かエラーメッセージが出力されていないか確認してください。
  * **CSSの確認**: `writing-mode: vertical-rl;` 以外に、`editorDiv` やその親要素に適用されているCSS（特に `position`, `overflow`, `height`, `padding` など）が影響している可能性も考えられます。一度最小限のCSS（`writing-mode` と基本的なサイズ指定のみ）で試してみるのも有効です。
  * **生成されるHTMLの構造**: `fromMarkdownToHTML` で変換されたHTMLが非常に複雑な構造になっている場合、それが縦書きの `contentEditable` と相性が悪い可能性も考えられます。生成されるHTMLを確認し、できるだけシンプルな構造（例: テキストは直接 `editorDiv` の子要素か、またはシンプルな `<p>` タグで囲まれる程度）になるように `switchtext.ts` を調整することも検討できます。
  * **`contentEditable` の代替**: もし `contentEditable` の制御が難しい場合、より高度なエディタライブラリ（CodeMirror や Monaco Editor を縦書き表示用にカスタマイズするなど）の導入を検討する必要があるかもしれませんが、これは大幅な作業量の増加を意味します。

まずは上記のフラグによる制御で、自己更新ループを断ち切ることから試してみてください。

MEMO: このエラーはもともとmarkdownの内容がすぐに縦書きエディタに反映される機能をつけていないときには発生していなかった。

# A3

超高速でタイピングするとカーソルが飛ぶ問題が再発するとのこと、承知いたしました。これは、前回提案した `isSavingInternally` フラグと `setTimeout(..., 0)` を使った対策でも、非常に短い間隔での連続的な入力とファイル保存処理、そして `modify` イベントの連鎖のタイミングによっては、まだ競合が発生してしまう可能性があることを示唆しています。

特に、超高速タイピング時は以下の状況が考えられます。

1.  `input` イベントが非常に短い間隔で連続発生する。
2.  `setTimeout(..., 0)` で `isSavingInternally` フラグを `false` に戻す処理がキューに入るが、その実行前に次の `input` イベントが処理を開始してしまう。
3.  `this.app.vault.modify()` が非同期処理であり、完了するまでの時間も影響する。複数の `modify()` が実質的に並行して走るような状況に近い形になることも。
4.  `main.ts` の `modify` イベントリスナーが、予期せぬタイミングで `isSavingInternally` が `false` になっている瞬間を捉えてしまい、`loadFileContent` を実行してしまう。

この問題をより根本的に解決するためには、入力処理とファイル保存処理の頻度を適切に制御する「デバウンス（debounce）」または「スロットリング（throttling）」の導入を改めて検討するか、さらにフラグ管理を厳密にする必要があります。

### 提案される対策

#### 1\. デバウンス処理の強化・確実な導入

前回の回答でも触れましたが、縦書きエディタの `input` イベントに対してデバウンス処理を導入し、ユーザーの入力が一定時間（例: 500ミリ秒～1秒程度）止まってからファイル保存処理 (`this.app.vault.modify`) を行うようにします。これにより、高速タイピング中にはファイル保存が頻繁に発生しなくなり、`modify` イベントの連鎖による競合のリスクを大幅に低減できます。

**`verticaleditorview.ts` の `onOpen` 内のイベントリスナー部分の修正例:**

```typescript
// verticaleditorview.ts

export class VerticalEditorView extends ItemView {
    // ... (他のプロパティ) ...
    private debounceTimer: number | null = null; // デバウンス用のタイマーID
    isSavingInternally: boolean = false; // このフラグは引き続き使用

    // ... (constructor, getViewType, etc.) ...

    async onOpen(): Promise<void> {
        // ... (既存のonOpenの初期化処理) ...

        this.editorDiv.addEventListener("input", () => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = window.setTimeout(async () => {
                if (this.file) {
                    // isSavingInternally をチェックして、既に保存処理が走っていたら何もしない
                    // (デバウンスにより基本的には不要かもしれないが、念のため)
                    if (this.isSavingInternally) {
                        // console.log("VerticalEditorView: Debounced save called, but already saving. Skipping.");
                        return;
                    }

                    this.isSavingInternally = true;
                    // console.log("VerticalEditorView: Debounced save starting. isSavingInternally set to true.");
                    const htmlContent = this.editorDiv.innerHTML;
                    const sw = new SwitchText(this.app);
                    try {
                        const markdownContent = await sw.fromHTMLToMarkdown(htmlContent);
                        await this.app.vault.modify(this.file, markdownContent);
                        // new Notice("ファイルが保存されました。 (Debounced)");
                    } catch (error) {
                        new Notice("HTMLからMarkdownへの変換または保存中にエラーが発生しました。");
                        // console.error("Error during debounced save:", error);
                    } finally {
                        // デバウンスされた保存処理が終わった後にフラグを解除
                        // ここでの setTimeout は、main.ts 側の modify イベント処理との
                        // タイミングを調整する意味合いが強いため、残すか、
                        // あるいはデバウンス間隔が十分長ければ不要かもしれません。
                        // まずは setTimeout なしで試してみて、問題があれば追加を検討します。
                        this.isSavingInternally = false;
                        // console.log("VerticalEditorView: Debounced save finished. isSavingInternally set to false.");

                        // もし setTimeout を使う場合:
                        // setTimeout(() => {
                        //     this.isSavingInternally = false;
                        //     console.log("VerticalEditorView: Debounced save finished. isSavingInternally set to false (delayed).");
                        // }, 0);
                    }
                }
            }, 1000); // 1000ミリ秒 (1秒) のデバウンス時間。この値は調整可能です。
        });
    }

    // ... (loadFileContent や他のメソッドは前回提案のまま) ...
}
```

**デバウンス処理のポイント:**

  * `input` イベントが発生するたびにタイマーをリセットします。
  * タイマーが指定時間（例: 1秒）経過するまで次の `input` イベントがなければ、実際に保存処理を実行します。
  * `isSavingInternally` フラグは、デバウンスされた保存処理の開始から終了まで `true` にしておき、`main.ts` 側がその保存による `modify` イベントで `loadFileContent` を誤って呼び出さないようにします。
  * デバウンス処理のコールバック内の `finally` ブロックで `isSavingInternally` を `false` に戻す際、`setTimeout(..., 0)` を使うかどうかは、デバウンス間隔の長さや実際の挙動を見ながら調整します。デバウンス間隔が十分にあれば、`main.ts` の `modify` イベントがフラグを正しく認識する時間が確保されるため、必須ではないかもしれません。

#### 2\. `isSavingInternally` フラグの管理をさらに厳密にする（カウンター方式など）

もしデバウンスだけでは不十分な場合（例えば、保存処理が非常に重く、デバウンス間隔中に完了しないことが稀にあるなど）、フラグを単純なブール値ではなく、カウンターにするなどの方法も考えられます。

  * 保存処理を開始するたびにカウンターをインクリメント。
  * 保存処理が完了するたびにカウンターをデクリメント。
  * `main.ts` 側では、カウンターが `0` より大きい場合は `loadFileContent` をスキップする。

これはより複雑になりますが、複数の非同期保存処理が重なった場合の制御には有効です。ただし、現状ではデバウンス処理の適切な導入で解決する可能性が高いと思われます。

#### 3\. `loadFileContent` 時のカーソル位置保存・復元処理の試み（最終手段に近い）

これは以前にも触れましたが、`loadFileContent` がどうしても呼び出されてしまう場合に、カーソル位置をできるだけ正確に保存し、`innerHTML` を書き換えた後に復元するというアプローチです。
`contenteditable` 要素でこれを完璧に行うのは非常に難易度が高く、特に縦書きや複雑なDOM構造では困難を極めます。そのため、他の方法で `loadFileContent` の不必要な呼び出しを避けるのが優先です。

### 推奨する次のステップ

まずは、**デバウンス処理（上記1の提案）を確実に導入・調整する**ことをお勧めします。

1.  `verticaleditorview.ts` の `input` イベントリスナーを上記のデバウンス処理に置き換えてください。
2.  デバウンス時間（例では `1000` ミリ秒）を調整してみてください。短すぎると高速タイピング時に問題が再発しやすく、長すぎると保存の反映が遅く感じられるかもしれません。アプリケーションの特性に合わせて最適な値を見つける必要があります。
3.  デバウンス処理内の `finally` ブロックで `isSavingInternally = false;` とする部分で、`setTimeout(..., 0)` を使うか使わないか、両方試して挙動を確認してください。
4.  `main.ts` の `modify` イベントリスナー内の `if (!view.isSavingInternally)` のチェックは引き続き有効です。

デバウンス処理により、高速タイピング中の一時的な編集中間状態でのファイル保存と `modify` イベントの発生が抑制され、ユーザーがタイピングを止めたタイミングでまとめて処理が行われるため、カーソルの飛びや処理の競合が大幅に改善されることが期待できます。

もしデバウンス処理を導入しても問題が完全には解消しない場合は、その時の具体的な挙動や、`console.log` などで追跡したフラグや関数の呼び出し順序などを教えていただけると、さらに詳細な原因究明と対策の検討が可能です。
