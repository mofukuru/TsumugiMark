import { Plugin, Notice, setIcon, MarkdownView, WorkspaceLeaf, TFile } from "obsidian";
import { VerticalEditorView, VERTICAL_EDITOR_VIEW_TYPE } from "./VerticalEditorView";
import { SwitchView } from "./SwitchView";
import {VerticalEditorSettingTab, VerticalEditorSettings, DEFAULT_SETTINGS} from "./setting";
import { t } from "./localization";

export default class VerticalEditorPlugin extends Plugin {
  settings: VerticalEditorSettings;
  statusBarItemEl: HTMLElement;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new VerticalEditorSettingTab(this.app, this));

    this.statusBarItemEl = this.addStatusBarItem();
    this.clearCharacterCount();

    // register vertical editor view
    this.registerView(
      VERTICAL_EDITOR_VIEW_TYPE,
      (leaf) => new VerticalEditorView(leaf, this.settings, this)
    );

    // command to open vertical editor
    this.addCommand({
      id: "open-vertical-editor",
      name: t("open vertical editor"),
      callback: () => {
        const sv = new SwitchView(this.app);
        sv.fromMarkdownToVert();
      },
    });

    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      const activeView = leaf?.view;

      if (leaf && leaf.view instanceof MarkdownView) {
        // const header = leaf.view.containerEl.querySelector(".view-header");
        const header = leaf.view.containerEl.querySelector(".view-actions");
        if (header && !header.querySelector(".vertical-editor-button")) {
          const btn = (header as HTMLElement).createEl("button");
          btn.classList.add("clickable-icon", "vertical-editor-button");
          setIcon(btn, "notebook-text")
          btn.setAttribute("aria-label", t("convert to vertical-editor"))
          btn.addEventListener("click", () => {
            const sv = new SwitchView(this.app);
            sv.fromMarkdownToVert();
          });
          header.prepend(btn);
        }
      }

      if (activeView && activeView.getViewType() === VERTICAL_EDITOR_VIEW_TYPE) {
        const verticalView = activeView as VerticalEditorView;
        if (typeof verticalView.refreshStatusBar === 'function') {
          verticalView.refreshStatusBar();
        }
      } else {
        this.clearCharacterCount();
      }
    }));

    // main.ts の VerticalEditorPlugin クラス内 onload メソッドに追加
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        // 変更されたファイルがTFileインスタンスであるか確認 (フォルダでないことを保証)
        if (file instanceof TFile) {
          // 現在開かれているすべての縦書きエディタのビューを取得
          this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
            const view = leaf.view as VerticalEditorView; // ビューをVerticalEditorView型にキャスト

            // 縦書きエディタでファイルが開かれており、かつ変更されたファイルと同じパスであるか確認
            if (view.file && view.file.path === file.path) {
              // new Notice(`Markdown側の変更を検知: ${file.basename} を再読み込みします。`); // デバッグ用通知
              if (!view.isSavingInternally) {
              // VerticalEditorView にあるファイル内容を再読み込みするメソッドを呼び出す
              // view.loadFileContent(file) を呼び出すことで、
              // Markdownファイルから最新の内容を読み込み、HTMLに変換して縦書きエディタに表示します。
                view.loadFileContent(file);
              }
            }
          });
        }
      })
    );

  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettingsAndUpdateViews() {
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(VERTICAL_EDITOR_VIEW_TYPE).forEach(leaf => {
      if (leaf.view instanceof VerticalEditorView) {
        leaf.view.updateSettings(this.settings);
      }
    });
  }

  onunload() {
    this.clearCharacterCount();
  }

  updateCharacterCount(totalCount: number, selectionCount?: number) {
    if (this.statusBarItemEl) {
      if (selectionCount && selectionCount > 0) {
        this.statusBarItemEl.setText(t('Selected: %1 / Total: %2', String(selectionCount), String(totalCount)));
      } else if (totalCount > 0) {
        this.statusBarItemEl.setText(t('Characters: %1', String(totalCount)));
      } else {
        this.statusBarItemEl.setText('');
      }
    }
  }

  clearCharacterCount() {
    if (this.statusBarItemEl) {
      if (this.statusBarItemEl) {
        this.statusBarItemEl.setText('');
      }
    }
  }
}
