/**
 * カーソル(キャレット)位置の矩形取得ユーティリティ。
 * タイプライターモードと行数バーの双方が同じフォールバック順序を必要とするため共通化している。
 */

/** editorDiv 内にある折りたたまれた(選択範囲のない)カーソル Range を返す。無ければ null。 */
export function getCollapsedCursorRange(editorDiv: HTMLElement): Range | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return null;
    if (!editorDiv.contains(range.startContainer)) return null;

    return range;
}

/**
 * Range の画面座標矩形を返す。
 * 要素境界や空段落では getBoundingClientRect() が幅高さ 0 の空矩形を返すため、
 * getClientRects() → 親要素の矩形、の順にフォールバックする。
 */
export function getRangeRect(range: Range): DOMRect | null {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;

    const rects = range.getClientRects();
    if (rects.length > 0 && (rects[0].width > 0 || rects[0].height > 0)) {
        return rects[0];
    }

    const node = range.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    if (!element) return null;

    const elementRect = element.getBoundingClientRect();
    if (elementRect.width === 0 && elementRect.height === 0) return null;
    return elementRect;
}

/** カーソルを含むブロック要素(editorDiv の直接の子)を返す。 */
export function findTopLevelBlock(editorDiv: HTMLElement, node: Node): HTMLElement | null {
    let current: Node | null = node;
    while (current && current.parentNode !== editorDiv) {
        current = current.parentNode;
        if (!current || current === editorDiv) return null;
    }
    if (current && current.nodeType === Node.ELEMENT_NODE) {
        return current as HTMLElement;
    }
    return null;
}
