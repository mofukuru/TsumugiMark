import {App, PluginSettingTab, Setting} from 'obsidian';
import VerticalEditorPlugin from "./main";
import { t } from './localization';

export type CharCountMode = 'includeSpaces' | 'excludeSpaces';
export type WritingMode = 'vertical-rl' | 'vertical-lr';
export type ColumnAlignment = 'left' | 'center' | 'right';

// 設定項目のインターフェースを定義
export interface VerticalEditorSettings {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    letterSpacing: string;
    maxHeight: string;
    charsPerColumn: string;
    charCountMode: CharCountMode;
    enableAutoIndent: boolean;
    writingMode: WritingMode;
    columnAlignment: ColumnAlignment;
    autoOpenVertical: boolean;
}

// 設定のデフォルト値を定義
export const DEFAULT_SETTINGS: VerticalEditorSettings = {
    fontFamily: '游明朝, "Yu Mincho", YuMincho, "Hiragino Mincho ProN", "MS PMincho", serif',
    fontSize: '18px',
    lineHeight: '1.8',
    letterSpacing: '0',
    maxHeight: 'auto',
    charsPerColumn: 'auto',
    charCountMode: 'includeSpaces',
    enableAutoIndent: true,
    writingMode: 'vertical-rl',
    columnAlignment: 'right',
    autoOpenVertical: false,
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

        new Setting(containerEl)
            .setName(t('Character count mode'))
            .setDesc(t('Select character count mode.'))
            .addDropdown(dropdown => dropdown
                .addOption('includeSpaces', t('Include spaces'))
                .addOption('excludeSpaces', t('Exclude spaces'))
                .setValue(this.plugin.settings.charCountMode)
                .onChange(async (value) => {
                    this.plugin.settings.charCountMode = value as CharCountMode;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // フォントファミリー設定
        new Setting(containerEl)
            .setName(t('Font family'))
            .setDesc(t('Set the font family for the vertical editor. (e.g., "Yu Mincho", "MS PMincho", serif)'))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.fontFamily)
                .setValue(this.plugin.settings.fontFamily)
                .onChange(async (value) => {
                    this.plugin.settings.fontFamily = value;
                    await this.plugin.saveSettingsAndUpdateViews(); // 設定を保存し、ビューを更新
                }));

        // フォントサイズ設定
        new Setting(containerEl)
            .setName(t('Font size'))
            .setDesc(t('Set the font size for the vertical editor. (e.g., 18px, 1.2em)'))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.fontSize)
                .setValue(this.plugin.settings.fontSize)
                .onChange(async (value) => {
                    this.plugin.settings.fontSize = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 行間の設定
        new Setting(containerEl)
            .setName(t('Line height'))
            .setDesc(t('Set the line height for the vertical editor. (e.g., 1.8, 2)'))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.lineHeight)
                .setValue(this.plugin.settings.lineHeight)
                .onChange(async (value) => {
                    this.plugin.settings.lineHeight = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 文字間の設定
        new Setting(containerEl)
            .setName(t('Letter spacing'))
            .setDesc(t('Set the letter spacing for the vertical editor. (e.g., 0px, 0.1em)'))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.letterSpacing)
                .setValue(this.plugin.settings.letterSpacing)
                .onChange(async (value) => {
                    this.plugin.settings.letterSpacing = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 一行の最大幅（文字数）の設定
        new Setting(containerEl)
            .setName(t('Characters per column'))
            .setDesc(t('Set the number of characters per line in the vertical editor. If the specified number of characters is not met, adjust with the "Max width" setting.'))
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

        // 縦書きの方向設定
        new Setting(containerEl)
            .setName(t('Writing direction'))
            .setDesc(t('Set the writing direction for the vertical editor.'))
            .addDropdown(dropdown => dropdown
                .addOption('vertical-rl', t('Right to left (traditional)'))
                .addOption('vertical-lr', t('Left to right'))
                .setValue(this.plugin.settings.writingMode)
                .onChange(async (value) => {
                    this.plugin.settings.writingMode = value as WritingMode;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 列の配置設定
        new Setting(containerEl)
            .setName(t('Column alignment'))
            .setDesc(t('Set the horizontal position of the text columns on screen.'))
            .addDropdown(dropdown => dropdown
                .addOption('left', t('Left'))
                .addOption('center', t('Center'))
                .addOption('right', t('Right'))
                .setValue(this.plugin.settings.columnAlignment)
                .onChange(async (value) => {
                    this.plugin.settings.columnAlignment = value as ColumnAlignment;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 全ノートを縦書きで自動表示
        new Setting(containerEl)
            .setName(t('Open all notes in vertical mode'))
            .setDesc(t('Automatically open Markdown notes in the vertical editor.'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoOpenVertical)
                .onChange(async (value) => {
                    this.plugin.settings.autoOpenVertical = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        new Setting(containerEl).setName(t('Advanced')).setHeading();

        // 自動字下げの設定
        new Setting(containerEl)
            .setName(t('Enable automatic paragraph indentation'))
            .setDesc(t('Automatically indent the first line of each paragraph (novel style).'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoIndent)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoIndent = value;
                    await this.plugin.saveSettingsAndUpdateViews();
                }));

        // 一行の最大幅の設定
        new Setting(containerEl)
            .setName(t('Max width'))
            .setDesc(t('Set the max width of a line in the vertical editor. This allows you to adjust the number of characters per line. (e.g., 500px, 30em, auto)'))
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
