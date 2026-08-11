import { VerticalEditorSettings, DEFAULT_SETTINGS } from "./setting";
import { getCollapsedCursorRange, getRangeRect, findTopLevelBlock } from "./CursorUtils";
import { t } from "./localization";

/**
 * 行数(表示列数)バー。
 *
 * ここでの「行」は段落数でも改行数でもなく、縦書きで実際に画面に並ぶ縦の列の本数(折り返しを含む)。
 * 「一行の文字数」設定で列の長さを制御する仕様のため、この定義がユーザーの直感と一致する。
 *
 * writing-mode: vertical-rl では 1 列の水平幅 = その要素の line-height になるので、
 * ブロックの offsetWidth ÷ line-height で列数を求められる。
 */
export class LineCountBar {
    private viewContainer: HTMLElement;
    private editorDiv: HTMLDivElement;
    private settings: VerticalEditorSettings;

    private barEl: HTMLElement | null = null;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private lastText = '';

    private readonly UPDATE_DEBOUNCE_DELAY = 300;

    constructor(viewContainer: HTMLElement, editorDiv: HTMLDivElement, settings: VerticalEditorSettings) {
        this.viewContainer = viewContainer;
        this.editorDiv = editorDiv;
        this.settings = settings;

        if (settings.showLineCountBar) {
            this.attach();
        }
    }

    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
        if (newSettings.showLineCountBar) {
            this.attach();
            // フォント・行間・一行の文字数の変更でも列数が変わるため測り直す
            this.updateNow();
        } else {
            this.detach();
        }
    }

    /** 連続入力のたびにレイアウト計測(reflow)が走らないようデバウンスする。 */
    scheduleUpdate(): void {
        if (!this.barEl) return;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.updateNow();
        }, this.UPDATE_DEBOUNCE_DELAY);
    }

    updateNow(): void {
        if (!this.barEl) return;

        // 空メッセージ表示中は行数に意味がないため空表示にする
        if (this.editorDiv.querySelector(':scope > .vertical-editor-message')) {
            this.setText('');
            return;
        }

        const { total, current } = this.measure();
        if (total === 0) {
            this.setText('');
            return;
        }

        this.setText(current !== null
            ? t('Line %1 of %2', String(current), String(total))
            : t('Lines: %1', String(total)));
    }

    destroy(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.detach();
    }

    private attach(): void {
        if (this.barEl) return;

        const bar = this.viewContainer.createDiv({ cls: 'vertical-editor-info-bar' });
        // スクロールコンテナより前(ペイン上部)に置く
        this.viewContainer.prepend(bar);
        this.barEl = bar;
        this.lastText = '';

        // ペイン幅の変更や maxHeight: auto での折り返し変化に追随する
        this.resizeObserver = new ResizeObserver(() => this.updateNow());
        this.resizeObserver.observe(this.editorDiv);

        this.updateNow();
    }

    private detach(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;

        this.barEl?.remove();
        this.barEl = null;
        this.lastText = '';
    }

    private setText(text: string): void {
        // 同じ文字列でも setText するとバーの高さ再計算 → ResizeObserver 再発火のループになり得るため差分のみ反映する
        if (!this.barEl || text === this.lastText) return;
        this.lastText = text;
        this.barEl.setText(text);
    }

    /**
     * ブロック要素の 1 列あたりの幅(line-height)。
     * 見出しは font-size が大きく列ピッチも異なるため、必ずブロックごとに求める。
     * ただしエディタ内のスタイルはタグ種別でしか変わらないので、
     * 1 回の計測中はタグ名単位でキャッシュして getComputedStyle の呼び出しを抑える。
     */
    private getColumnPitch(el: HTMLElement, cache?: Map<string, number>): number {
        const cached = cache?.get(el.tagName);
        if (cached !== undefined) return cached;

        const pitch = this.computeColumnPitch(el);
        cache?.set(el.tagName, pitch);
        return pitch;
    }

    private computeColumnPitch(el: HTMLElement): number {
        const style = getComputedStyle(el);
        const pitch = parseFloat(style.lineHeight);
        if (!isNaN(pitch) && pitch > 0) return pitch;

        // line-height: normal のときは数値化できないのでフォントサイズから概算する
        const fontSize = parseFloat(style.fontSize);
        return !isNaN(fontSize) && fontSize > 0 ? fontSize * 1.2 : 1;
    }

    /** ブロックが占める列数。 */
    private countColumns(el: HTMLElement, cache: Map<string, number>): number {
        // 保護ブロックは横書きチップなので列数計算が成立しない。1 ブロック = 1 行として数える
        if (el.classList.contains('ve-protected')) return 1;

        const pitch = this.getColumnPitch(el, cache);
        return Math.max(1, Math.round(el.offsetWidth / pitch));
    }

    private measure(): { total: number; current: number | null } {
        const blocks = Array.from(this.editorDiv.children) as HTMLElement[];

        const range = getCollapsedCursorRange(this.editorDiv);
        const cursorBlock = range ? findTopLevelBlock(this.editorDiv, range.startContainer) : null;

        const pitchCache = new Map<string, number>();
        let total = 0;
        let current: number | null = null;

        for (const block of blocks) {
            const columns = this.countColumns(block, pitchCache);
            if (block === cursorBlock && range) {
                const indexInBlock = this.getColumnIndexInBlock(block, range, columns, pitchCache);
                if (indexInBlock !== null) {
                    current = total + indexInBlock;
                }
            }
            total += columns;
        }

        return { total, current };
    }

    /** ブロック内でカーソルが何列目(1 始まり)にあるかを、カーソル矩形の水平位置から求める。 */
    private getColumnIndexInBlock(
        block: HTMLElement,
        range: Range,
        columns: number,
        cache: Map<string, number>
    ): number | null {
        if (block.classList.contains('ve-protected')) return 1;

        const cursorRect = getRangeRect(range);
        if (!cursorRect) return null;

        const blockRect = block.getBoundingClientRect();
        const pitch = this.getColumnPitch(block, cache);
        const cx = cursorRect.left + cursorRect.width / 2;

        const writingMode = this.settings.writingMode || DEFAULT_SETTINGS.writingMode;
        const offset = writingMode === 'vertical-lr'
            ? cx - blockRect.left   // 左の列から右へ流れる
            : blockRect.right - cx; // vertical-rl: 右の列から左へ流れる

        const index = Math.floor(offset / pitch) + 1;
        return Math.min(Math.max(index, 1), columns);
    }
}
