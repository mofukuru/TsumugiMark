import { SwitchText } from "./SwitchText";

interface Token {
    type: 'text' | 'blank';
    content?: string;
}

/**
 * frontmatter（--- で囲まれたプロパティ）を本文から切り離す。
 * HTML 化すると `## title: ...` のような見出しに化けて壊れてしまうため、DOM には載せない。
 * 直後の空行まで frontmatter 側に含めることで、保存時に元のファイルと同じ形へ戻せる。
 */
export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
    const normalized = content.replace(/\r\n/g, '\n');
    const match = /^---\n[\s\S]*?\n---[ \t]*(?:\n(?:[ \t]*\n)*|$)/.exec(normalized);

    if (!match) return { frontmatter: '', body: normalized };
    return { frontmatter: match[0], body: normalized.slice(match[0].length) };
}

/**
 * 縦書きエディタの DOM を Markdown へ変換する。
 * ブロック要素ごとに変換し、空行要素の個数から改行数を復元する。
 */
export function domToMarkdown(root: HTMLElement, sw: SwitchText): string {
    return tokensToMarkdown(extractTokensFromDOM(root, sw));
}

function extractTokensFromDOM(root: HTMLElement, sw: SwitchText): Token[] {
    const tokens: Token[] = [];
    const nodes = Array.from(root.childNodes);

    nodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;

            if (isEmptyLine(el)) {
                tokens.push({ type: 'blank' });
                return;
            }

            const md = sw.fromHTMLToMarkdown(el).replace(/\s+$/, '');
            if (md.length > 0) {
                tokens.push({ type: 'text', content: md });
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent || '').replace(/\s+$/, '');
            if (text.length > 0) {
                tokens.push({ type: 'text', content: text });
            }
        }
    });

    return tokens;
}

function isEmptyLine(el: HTMLElement): boolean {
    if (el.classList.contains('ve-empty-line')) {
        return true;
    }

    if (el.tagName === 'P') {
        const children = Array.from(el.childNodes);
        const hasOnlyBr = children.length === 1 && children[0].nodeName === 'BR';
        const isEmpty = children.length === 0 || (el.textContent || '').trim() === '';
        return hasOnlyBr || isEmpty;
    }

    return false;
}

function tokensToMarkdown(tokens: Token[]): string {
    let markdown = '';
    let pendingBlanks = 0;
    let hasText = false;

    tokens.forEach(token => {
        if (token.type === 'blank') {
            pendingBlanks++;
            return;
        }

        if (!hasText) {
            if (pendingBlanks > 0) {
                markdown += '\n'.repeat(pendingBlanks);
                pendingBlanks = 0;
            }
            markdown += token.content;
            hasText = true;
        } else {
            const newlineCount = pendingBlanks + 1;
            markdown += '\n'.repeat(newlineCount);
            markdown += token.content;
            pendingBlanks = 0;
        }
    });

    if (pendingBlanks > 0) {
        markdown += '\n'.repeat(pendingBlanks);
    }

    return markdown;
}
