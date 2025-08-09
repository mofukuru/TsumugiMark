import { App } from "obsidian";
import TurndownService from "turndown";
import { Marked } from 'marked';

const rubyExtension = {
    name: 'ruby',
    level: 'inline' as const,
    start(src: string) {
        return src.indexOf('《');
    },
    tokenizer(src: string) {
        const rule = /^(?:[\|｜](.+?)|([一-龠]+))《(.+?)》/;
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
    renderer(token: any) {
        return `<ruby>${this.parser.parseInline(token.base)}<rt>${this.parser.parseInline(token.ruby)}</rt></ruby>`;
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

    async fromMarkdownToHTML(markdownContent: string): Promise<string> {
        return this.marked.parse(markdownContent) as string;
    }

    async fromHTMLToMarkdown(htmlContent: string): Promise<string> {
        return this.turndownService.turndown(htmlContent);
    }
}