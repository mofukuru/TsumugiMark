import { VerticalEditorSettings } from "./setting";

/**
 * マウスホイールの縦回転を横スクロールに変換する。
 *
 * 縦書きエディタのスクロール軸は水平だが、ホイールの縦回転はブラウザが縦スクロールとして扱うため、
 * そのままでは文章を読み進められない。読み進める方向へ動くよう、ホイールを下に回したとき
 * vertical-rl なら左へ、vertical-lr なら右へスクロールする。
 *
 * 次の場合はブラウザ標準の動作に任せる:
 * - Ctrl/Cmd + ホイール（ズーム）
 * - Shift + ホイール（ブラウザが既に横スクロールへ変換している）
 * - トラックパッドの横スワイプなど、横成分が主体の入力
 * - 横方向にはみ出していない（スクロールする余地がない）とき
 */
export class WheelScroller {
    private scrollContainer: HTMLElement;
    private settings: VerticalEditorSettings;
    private listenerAbort = new AbortController();

    /** deltaMode が行単位のときの 1 行あたりのピクセル数（Firefox 系の一般的な値） */
    private readonly LINE_HEIGHT_PX = 16;

    constructor(scrollContainer: HTMLElement, settings: VerticalEditorSettings) {
        this.scrollContainer = scrollContainer;
        this.settings = settings;

        // preventDefault するため passive にはできない
        this.scrollContainer.addEventListener('wheel', this.onWheel, {
            passive: false,
            signal: this.listenerAbort.signal,
        });
    }

    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
    }

    destroy(): void {
        this.listenerAbort.abort();
    }

    private onWheel = (e: WheelEvent): void => {
        if (!this.settings.wheelScrollHorizontally) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (e.deltaY === 0 || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;

        const container = this.scrollContainer;
        if (container.scrollWidth <= container.clientWidth) return;

        // vertical-rl は左へ、vertical-lr は右へ読み進める
        const direction = this.settings.writingMode === 'vertical-lr' ? 1 : -1;
        container.scrollBy({ left: this.toPixels(e) * direction });
        e.preventDefault();
    };

    private toPixels(e: WheelEvent): number {
        switch (e.deltaMode) {
            case WheelEvent.DOM_DELTA_LINE:
                return e.deltaY * this.LINE_HEIGHT_PX;
            case WheelEvent.DOM_DELTA_PAGE:
                return e.deltaY * this.scrollContainer.clientWidth;
            default:
                return e.deltaY;
        }
    }
}
