import { App } from "obsidian";
import TurndownService from "turndown";
import { Marked, Tokens } from 'marked';

const rubyExtension = {
    name: 'ruby',
    level: 'inline' as const,
    start(src: string) {
        return src.indexOf('《');
    },
    tokenizer(src: string) {
        const rule = /^(?:[|｜](.+?)|([一-龠]+))《(.+?)》/;
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

        this.marked = new Marked();
        this.marked.use({ extensions: [rubyExtension] });
    }

    fromMarkdownToHTML(markdownContent: string): Promise<string> {
        return this.marked.parse(markdownContent) as Promise<string>;
    }

        fromHTMLToMarkdown(htmlContent: string | HTMLElement): string {
        return this.turndownService.turndown(htmlContent);
    }
}
