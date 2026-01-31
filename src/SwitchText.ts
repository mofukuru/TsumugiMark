import { App } from "obsidian";
import TurndownService from "turndown";
import { Marked, Tokens } from 'marked';

const rubyExtension = {
    name: 'ruby',
    level: 'inline' as const,
    start(src: string) {
        // Look for pipe characters first
        const pipeMatch = src.search(/[|｜]/);
        if (pipeMatch !== -1) return pipeMatch;

        // Look for Japanese characters followed by 《 (auto-detect case)
        const japaneseMatch = src.match(/[一-龠々〆ヵヶぁ-ゔゞゝヽヾァ-ヴー]+(?=《)/);
        if (japaneseMatch) return src.indexOf(japaneseMatch[0]);

        return -1;
    },
    tokenizer(src: string) {
        const rule = /^(?:[|｜](.+?)|([一-龠々〆ヵヶぁ-ゔゞゝヽヾァ-ヴー]+))《(.+?)》/;
        const match = rule.exec(src);
        if (match) {
            const baseText = match[1] || match[2];
            const rubyText = match[3];
            const token = {
                type: 'ruby',
                raw: match[0],
                base: this.lexer.inlineTokens(baseText),
                ruby: this.lexer.inlineTokens(rubyText)
            };
            return token;
        }
    },
    renderer(token: Tokens.Generic) {
        const base = token.base as Tokens.Generic[];
        const ruby = token.ruby as Tokens.Generic[];
        return `<ruby>${this.parser.parseInline(base)}<rt>${this.parser.parseInline(ruby)}</rt></ruby>`;
    }
};

export class SwitchText {
    private app: App;
    private turndownService: TurndownService;
    private marked: Marked;

    constructor(app: App) {
        this.app = app;

        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            emDelimiter: '_',
            strongDelimiter: '**',
            linkStyle: 'inlined',
            linkReferenceStyle: 'full',
            preformattedCode: true,
            blankReplacement: (content: string, node: Node) => {
                // 空要素は空白行として保持
                if ((node as HTMLElement).tagName === 'P') {
                    return '\n\n';
                }
                return '';
            }
        });

        this.turndownService.addRule('ruby', {
            filter: 'ruby',
            replacement: (content: string, node: Node) => {
                const element = node as HTMLElement;
                const rt = element.querySelector('rt');
                const rtText = rt ? rt.textContent || '' : '';
                const temp = element.cloneNode(true) as HTMLElement;
                temp.querySelectorAll('rt, rp').forEach(child => child.remove());
                const baseText = temp.textContent || '';
                return `｜${baseText}《${rtText}》`;
            }
        });

        // 段落内の<br>を行末スペース2つに変換（優先度高）
        this.turndownService.addRule('lineBreak', {
            filter: (node: Node) => {
                if (node.nodeName !== 'BR') return false;
                const parent = node.parentElement;
                // 段落内の<br>で、かつ他にテキストがある場合
                if (parent && parent.tagName === 'P') {
                    const siblings = Array.from(parent.childNodes);
                    const hasOtherContent = siblings.some(n =>
                        n !== node && (n.nodeType === Node.TEXT_NODE && n.textContent?.trim() || n.nodeType === Node.ELEMENT_NODE)
                    );
                    return hasOtherContent;
                }
                return false;
            },
            replacement: () => '  \n'
        });

        // ve-empty-line を空行として処理（1要素につき \n\n = 1段落）
        this.turndownService.addRule('veEmptyLine', {
            filter: (node: Node) => {
                if (!(node instanceof HTMLElement)) return false;
                return node.classList && node.classList.contains('ve-empty-line');
            },
            replacement: () => '\n\n'
        });

        // 空段落（<p><br></p>のみ）を空行として保持（ve-empty-line は除外）
        this.turndownService.addRule('emptyParagraph', {
            filter: (node: Node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.tagName !== 'P') return false;
                if (node.classList && node.classList.contains('ve-empty-line')) return false;
                const children = Array.from(node.childNodes);
                // <br>だけ、または完全に空の段落
                const hasOnlyBr = children.length === 1 && children[0].nodeName === 'BR';
                const isEmpty = children.length === 0 || (node.textContent?.trim() === '');
                return hasOnlyBr || isEmpty;
            },
            replacement: () => '\n\n'
        });

        this.marked = new Marked();
        
        // レンダラーをカスタマイズして、改行を強制的に <br> に変換する
        const renderer = {
            text(token: Tokens.Text): string {
                // テキストトークン内の改行コード(\n)を、無条件で <br> に置換する
                // これにより breaks: true が効かないケースでも強制改行させる
                if ('tokens' in token && token.tokens) {
                    return this.parser.parseInline(token.tokens);
                }
                return token.text.replace(/\n/g, '<br>');
            }
        };
        
        this.marked.use({
            extensions: [rubyExtension],
            renderer: renderer as any,
            breaks: true, // 段落内の改行を<br>として保持
            gfm: true     // GitHub Flavored Markdown
        });
    }

    async fromMarkdownToHTML(markdownContent: string): Promise<string> {
        // 1. 改行コードを \n (LF) に統一する (Windows/CRLF対策)
        const normalizedContent = markdownContent.replace(/\r\n/g, '\n');

        // 2. 2つ以上の連続改行を検出し、空行要素に置換する
        // ユーザーの見た目基準: Enter を N 回押した = N-1 行の空き
        // \n\n (2つ) = Enter 2回 = 1行分の空き
        // \n\n\n (3つ) = Enter 3回 = 2行分の空き
        const preProcessedContent = normalizedContent.replace(/\n{2,}/g, (match) => {
            // 計算式: match.length - 1 (見た目通りの行数)
            const count = match.length - 1;
            const emptyLineStr = '<p class="ve-empty-line"><br></p>';
            
            // 前後に \n\n を挟むことで、marked が前後のテキストを正しく段落として認識できるようにする
            return '\n\n' + emptyLineStr.repeat(count) + '\n\n';
        });

        let html = await this.marked.parse(preProcessedContent) as string;

        // 既存処理: 空の段落パターンを検出して <br> を挿入
        html = html.replace(/<p>\s*<\/p>/g, '<p><br></p>');

        return html;
    }

        fromHTMLToMarkdown(htmlContent: string | HTMLElement): string {
        return this.turndownService.turndown(htmlContent);
    }
}
