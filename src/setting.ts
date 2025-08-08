import {App, PluginSettingTab, Setting} from 'obsidian';
import VerticalEditorPlugin from "./main";

export type CharCountMode = 'includeSpaces' | 'excludeSpaces';

// 設定項目のインターフェースを定義
export interface VerticalEditorSettings {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    letterSpacing: string; // 文字間隔の設定を追加
    maxHeight: string; // 一行の最大文字数（または幅）の設定を追加
    charsPerColumn: string;
    charCountMode: CharCountMode;
}

// 設定のデフォルト値を定義
export const DEFAULT_SETTINGS: VerticalEditorSettings = {
    fontFamily: '游明朝, "Yu Mincho", YuMincho, "Hiragino Mincho ProN", "MS PMincho", serif',
    fontSize: '18px',
    lineHeight: '1.8',
    letterSpacing: '0', // デフォルトの文字間隔
    maxHeight: 'auto', // デフォルトの最大幅（自動）
    charsPerColumn: 'auto',
    charCountMode: 'includeSpaces',
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
        containerEl.createEl('h2', { text: 'TsumugiMark Settings' });

        new Setting(containerEl)
            .setName('Character Count Mode')
            .setDesc('文字数カウントのモードを選択します。')
            .addDropdown(dropdown => dropdown
                .addOption('includeSpaces', '空白を含める')
                .addOption('excludeSpaces', '空白を含めない')
                .setValue(this.plugin.settings.charCountMode)
                .onChange(async (value: CharCountMode) => {
                    this.plugin.settings.charCountMode = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

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

        // 文字間の設定
        new Setting(containerEl)
            .setName('Letter Spacing')
            .setDesc('縦書きエディタの文字間隔を設定します。(例: 0px, 0.1em)')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.letterSpacing)
                .setValue(this.plugin.settings.letterSpacing)
                .onChange(async (value) => {
                    this.plugin.settings.letterSpacing = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 一行の最大幅（文字数）の設定
        new Setting(containerEl)
            .setName('Characters per Column')
            .setDesc('縦書きエディタの一行の文字数を設定します。指定した文字数にならない場合は、"Max Width"の項目で調整してください。')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.charsPerColumn)
                .setValue(this.plugin.settings.charsPerColumn)
                .onChange(async (value) => {
                    const intendedChars = parseInt(value, 10);

                    if (!isNaN(intendedChars) && intendedChars > 0) {
                        const fontSizeStr = this.plugin.settings.fontSize || "18px";
                        const letterSpacingStr = this.plugin.settings.letterSpacing || "0px";

                        const fontSizePx = parseFloat(fontSizeStr);
                        const letterSpacingPx = parseFloat(letterSpacingStr);

                        if (isNaN(fontSizePx)) {
                            console.error("Vertical Editor: Font size is invalid. Using default 18px for calculation.");
                        }
                        if (isNaN(letterSpacingPx)) {
                            console.error("Vertical Editor: Letter spacing is invalid. Using default 0px for calculation.");
                        }

                        const actualCharHeightPx = fontSizePx + letterSpacingPx;

                        if (actualCharHeightPx <= 0) {
                            console.error("Vertical Editor: Calculated character height is zero or negative. Aborting height update.");
                            return; // 無効な高さ計算を避ける
                        }

                        const viewPadding = 40;
                        const calculatedMaxHeight = intendedChars * actualCharHeightPx + viewPadding;

                        // 計算結果を "〇〇px" という文字列形式で maxHeight 設定に保存
                        this.plugin.settings.maxHeight = `${Math.round(calculatedMaxHeight)}px`;

                    } else if (value === "") {
                        // Nothing
                    } else {
                        // 無効な入力（例: "abc"）の場合。現状では特に何もしないか、
                        // 以前の有効な値を保持するなどの処理も考えられます。
                        // (parseInt が NaN を返すので、最初の if 条件で弾かれます)
                        console.warn("Vertical Editor: Invalid input for Characters per Column - ", value);
                    }
                    await this.plugin.saveSettingsAndUpdateViews();
            }));

        containerEl.createEl('h2', { text: 'Advanced' });
        // 一行の最大幅の設定
        new Setting(containerEl)
            .setName('Max Width')
            .setDesc('縦書きエディタの一行の最大幅を設定します。これにより一行の文字数を調整できます。(例: 500px, 30em, auto)')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.maxHeight)
                .setValue(this.plugin.settings.maxHeight)
                .onChange(async (value) => {
                    if (DEFAULT_SETTINGS.charsPerColumn === "auto") {
                        this.plugin.settings.maxHeight = value;
                        await this.plugin.saveSettingsAndUpdateViews();
                    }
                }));

    }
}
