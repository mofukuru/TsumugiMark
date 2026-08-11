import { VerticalEditorSettings } from "./setting";
import { getCollapsedCursorRange, getRangeRect } from "./CursorUtils";

/**
 * タイプライターモード: 編集中の列(縦書きの「現在行」)を常に画面中央へ追従させる。
 *
 * 縦書きエディタのスクロール軸は水平(scrollLeft)。補正は絶対座標ではなく
 * scrollBy による相対補正で行う。column-align-right では flex-direction: row-reverse により
 * コンテンツが左方向へオーバーフローし scrollLeft の座標系が反転するため、
 * 絶対値計算だと writing-mode / alignment ごとに分岐が必要になってしまうからである。
 */
export class TypewriterScroller {
    private scrollContainer: HTMLElement;
    private editorDiv: HTMLDivElement;
    private settings: VerticalEditorSettings;

    private enabled = false;
    private composing = false;
    /** ホイール等の手動スクロール中は追従を止めるためのフラグ */
    private suspended = false;

    private pendingFrame: number | null = null;
    private pendingSmooth = false;

    private resizeObserver: ResizeObserver | null = null;
    private listenerAbort: AbortController | null = null;

    /** この距離未満のズレは補正しない(1文字入力ごとの微小な揺れ防止) */
    private readonly DEAD_ZONE_PX = 2;

    constructor(scrollContainer: HTMLElement, editorDiv: HTMLDivElement, settings: VerticalEditorSettings) {
        this.scrollContainer = scrollContainer;
        this.editorDiv = editorDiv;
        this.settings = settings;

        if (settings.enableTypewriterMode) {
            this.enable();
        }
    }

    updateSettings(newSettings: VerticalEditorSettings): void {
        this.settings = newSettings;
        if (newSettings.enableTypewriterMode) {
            if (this.enabled) {
                // フォントサイズ等の変更でレイアウトが変わっている可能性があるため測り直す
                this.updateEdgeMargin();
                this.requestRecenter(true);
            } else {
                this.enable();
            }
        } else {
            this.disable();
        }
    }

    enable(): void {
        if (this.enabled) return;
        this.enabled = true;
        this.suspended = false;

        this.scrollContainer.addClass('typewriter-enabled');
        this.updateEdgeMargin();

        // ペイン幅が変わると端部余白(コンテナ幅の半分)も変わるため追随させる
        this.resizeObserver = new ResizeObserver(() => {
            this.updateEdgeMargin();
            this.requestRecenter(false);
        });
        this.resizeObserver.observe(this.scrollContainer);

        this.listenerAbort = new AbortController();
        const options: AddEventListenerOptions = { passive: true, signal: this.listenerAbort.signal };
        this.scrollContainer.addEventListener('wheel', this.onManualScroll, options);
        this.scrollContainer.addEventListener('pointerdown', this.onManualScroll, options);

        this.requestRecenter(true);
    }

    disable(): void {
        if (!this.enabled) return;
        this.enabled = false;
        this.suspended = false;
        this.composing = false;

        if (this.pendingFrame !== null) {
            cancelAnimationFrame(this.pendingFrame);
            this.pendingFrame = null;
        }

        this.resizeObserver?.disconnect();
        this.resizeObserver = null;

        this.listenerAbort?.abort();
        this.listenerAbort = null;

        this.scrollContainer.removeClass('typewriter-enabled');
        this.scrollContainer.style.removeProperty('--ve-typewriter-margin');
    }

    destroy(): void {
        this.disable();
    }

    /** 文字入力による再センタリング要求。手動スクロールによる停止も解除する。 */
    notifyTyping(): void {
        if (!this.enabled) return;
        this.suspended = false;
        this.requestRecenter(false);
    }

    /** カーソル移動(クリック・矢印キー)による再センタリング要求。 */
    notifyCursorMove(): void {
        if (!this.enabled) return;
        // 「入力時のみ」設定では、カーソル移動では追従も停止解除もしない
        if (this.settings.typewriterOnlyWhenTyping) return;
        this.suspended = false;
        this.requestRecenter(true);
    }

    /** ファイル読み込み直後など、内容が丸ごと入れ替わったときの再センタリング要求。 */
    notifyContentReloaded(): void {
        if (!this.enabled) return;
        this.suspended = false;
        this.updateEdgeMargin();
        this.requestRecenter(false);
    }

    /** IME 変換中フラグ。変換中は画面が揺れないよう追従を保留する。 */
    setComposing(flag: boolean): void {
        this.composing = flag;
        if (!flag) {
            // 確定時に一度だけ追従する
            this.requestRecenter(false);
        }
    }

    private onManualScroll = (): void => {
        this.suspended = true;
    };

    /**
     * 端部余白: 文書の最初/最後の列も画面中央に来られるようコンテナ幅の半分を左右に確保する。
     * scroll container の padding ではなく editorDiv の margin にしているのは、
     * flex コンテナの inline-end 側 padding がオーバーフロー時にブラウザに無視されるため。
     */
    private updateEdgeMargin(): void {
        const margin = Math.max(0, Math.round(this.scrollContainer.clientWidth / 2));
        this.scrollContainer.style.setProperty('--ve-typewriter-margin', `${margin}px`);
    }

    /**
     * requestAnimationFrame で 1 フレーム 1 回にまとめる。
     * 連続入力のたびに getBoundingClientRect() でレイアウトを強制同期させないための節約。
     */
    private requestRecenter(smooth: boolean): void {
        if (!this.enabled) return;

        if (this.pendingFrame === null) {
            this.pendingSmooth = smooth;
            this.pendingFrame = requestAnimationFrame(() => {
                this.pendingFrame = null;
                this.recenter(this.pendingSmooth);
            });
        } else {
            // 入力による要求(smooth=false)が1つでも混じったら即時スクロールを優先する。
            // 入力中に smooth を使うとアニメーション中に次の補正が重なって行き過ぎるため。
            this.pendingSmooth = this.pendingSmooth && smooth;
        }
    }

    private recenter(smooth: boolean): void {
        if (!this.enabled || this.composing || this.suspended) return;

        const range = getCollapsedCursorRange(this.editorDiv);
        if (!range) return;

        const cursorRect = getRangeRect(range);
        if (!cursorRect) return;

        const containerRect = this.scrollContainer.getBoundingClientRect();
        const cursorCenter = cursorRect.left + cursorRect.width / 2;
        const containerCenter = containerRect.left + containerRect.width / 2;
        const delta = cursorCenter - containerCenter;

        if (Math.abs(delta) < this.DEAD_ZONE_PX) return;

        this.scrollContainer.scrollBy({ left: delta, behavior: smooth ? 'smooth' : 'auto' });
    }
}
