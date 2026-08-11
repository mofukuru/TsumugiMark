import { App } from "obsidian";
import TurndownService from "turndown";
import { Marked, Tokens } from 'marked';
import { t } from "./localization";

/**
 * ルビ記法の種類。保存時に元の記法へ復元するため、生成した <ruby> の
 * data-ruby-syntax 属性に記録しておく。
 */
export type RubySyntax =
    | 'pipe-full-angle'   // ｜漢字《かんじ》
    | 'pipe-half-angle'   // |漢字《かんじ》
    | 'auto-angle'        // 漢字《かんじ》（パイプなし自動検出）
    | 'pipe-full-paren'   // ｜漢字（かんじ）
    | 'pipe-half-paren'   // |漢字(かんじ)
    | 'denden'            // {漢字|かんじ}
    | 'denden-mono';      // {漢字|かん|じ}（モノルビ）

export interface RubyMatch {
    raw: string;
    syntax: RubySyntax;
    base: string;
    ruby: string;
    /**
     * 丸括弧形式で実際に使われたパイプ文字。
     * 全角パイプ＋半角括弧のような混在も書き換えずに復元するため、括弧種別とは別に保持する。
     */
    pipe?: '|' | '｜' | null;
    /** モノルビのときだけ、親文字1文字とルビの対応を持つ */
    mono: { base: string; ruby: string }[] | null;
}

/** 傍点（カクヨム記法 《《text》》）のマッチ結果 */
export interface BotenMatch {
    raw: string;
    text: string;
}

const JAPANESE_BASE_CHARS = '一-龠々〆ヵヶぁ-ゔゞゝヽヾァ-ヴー';

/**
 * 各ルビ記法のパターン本体（アンカーなし）。
 * marked のトークナイザ（先頭一致）と、入力中のライブ変換（末尾一致）で
 * 同じ定義を使い回すために、アンカーを付けずに保持している。
 */
const RUBY_PATTERNS: { source: string; build: (m: RegExpExecArray) => RubyMatch }[] = [
    {
        // ｜漢字《かんじ》 / |漢字《かんじ》
        source: '([|｜])([^|｜《》\\n]+)《([^《》\\n]+)》',
        build: (m) => ({
            raw: m[0],
            syntax: m[1] === '｜' ? 'pipe-full-angle' : 'pipe-half-angle',
            base: m[2],
            ruby: m[3],
            mono: null,
        }),
    },
    {
        // ｜漢字（かんじ） / |漢字(かんじ)
        // 丸括弧形式はパイプ必須。パイプなしだと通常の文章と区別できず誤検出するため。
        source: '([|｜])([^|｜（）()\\n]+)([（(])([^（）()\\n]+)[）)]',
        build: (m) => ({
            raw: m[0],
            // 記法の種別は開き括弧で決め、パイプの全角/半角は pipe として別に持つ
            syntax: m[3] === '（' ? 'pipe-full-paren' : 'pipe-half-paren',
            base: m[2],
            ruby: m[4],
            pipe: m[1] as '|' | '｜',
            mono: null,
        }),
    },
    {
        // {漢字|かんじ} / {漢字|かん|じ}（でんでんマークダウン）
        source: '\\{([^{}|\\n]+)((?:\\|[^{}|\\n]*)+)\\}',
        build: (m) => {
            const base = m[1];
            const parts = m[2].split('|').slice(1);
            const baseChars = Array.from(base);
            // ルビの区切り数が親文字数と一致するときだけモノルビとして1文字ずつ対応させる
            if (parts.length > 1 && parts.length === baseChars.length) {
                return {
                    raw: m[0],
                    syntax: 'denden-mono' as RubySyntax,
                    base,
                    ruby: parts.join(''),
                    mono: baseChars.map((c, i) => ({ base: c, ruby: parts[i] })),
                };
            }
            return {
                raw: m[0],
                syntax: 'denden' as RubySyntax,
                base,
                ruby: parts.join('|'),
                mono: null,
            };
        },
    },
    {
        // 漢字《かんじ》（パイプなしの自動検出）
        source: `([${JAPANESE_BASE_CHARS}]+)《([^《》\\n]+)》`,
        build: (m) => ({
            raw: m[0],
            syntax: 'auto-angle',
            base: m[1],
            ruby: m[2],
            mono: null,
        }),
    },
];

const BOTEN_SOURCE = '《《([^《》\\n]+)》》';

const RUBY_HEAD_PATTERNS = RUBY_PATTERNS.map(p => ({ regex: new RegExp('^(?:' + p.source + ')'), build: p.build }));
const RUBY_TAIL_PATTERNS = RUBY_PATTERNS.map(p => ({ regex: new RegExp('(?:' + p.source + ')$'), build: p.build }));
const BOTEN_HEAD_PATTERN = new RegExp('^(?:' + BOTEN_SOURCE + ')');
const BOTEN_TAIL_PATTERN = new RegExp('(?:' + BOTEN_SOURCE + ')$');

/** 文字列の先頭がルビ記法ならその内容を返す（marked トークナイザ用）。 */
export function matchRubyAtStart(src: string): RubyMatch | null {
    for (const pattern of RUBY_HEAD_PATTERNS) {
        const m = pattern.regex.exec(src);
        if (m) return pattern.build(m);
    }
    return null;
}

/** 文字列の末尾がルビ記法ならその内容を返す（入力中のライブ変換用）。 */
export function matchRubyAtEnd(text: string): RubyMatch | null {
    for (const pattern of RUBY_TAIL_PATTERNS) {
        const m = pattern.regex.exec(text);
        if (m) return pattern.build(m);
    }
    return null;
}

export function matchBotenAtStart(src: string): BotenMatch | null {
    const m = BOTEN_HEAD_PATTERN.exec(src);
    return m ? { raw: m[0], text: m[1] } : null;
}

export function matchBotenAtEnd(text: string): BotenMatch | null {
    const m = BOTEN_TAIL_PATTERN.exec(text);
    return m ? { raw: m[0], text: m[1] } : null;
}

/**
 * 丸括弧形式のときだけ、実際に使われたパイプの全角/半角を属性として書き出す。
 * 山括弧形式は syntax 自体がパイプ種別を含んでいるため不要。
 */
export function rubyPipeAttribute(syntax: RubySyntax, pipe: string | null | undefined): string {
    if (syntax !== 'pipe-full-paren' && syntax !== 'pipe-half-paren') return '';
    if (pipe !== '|' && pipe !== '｜') return '';
    return ` data-ruby-pipe="${pipe === '｜' ? 'full' : 'half'}"`;
}

/** data-ruby-pipe 属性（無ければ記法の既定）から復元用のパイプ文字を決める。 */
export function rubyPipeCharacter(syntax: RubySyntax, attribute: string | null): string {
    if (attribute === 'full') return '｜';
    if (attribute === 'half') return '|';
    return syntax === 'pipe-full-paren' ? '｜' : '|';
}

export function escapeHTML(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 縦書きで編集する需要がなく、往復変換で壊れてしまう記法を
 * 「保護ブロック」（読み取り専用の横書きチップ）として描画する。
 * 元の Markdown は data-md-source に退避し、保存時はそこから逐語復元する。
 */
function protectedBlockHTML(type: string, raw: string, label: string): string {
    const source = raw.replace(/\s+$/, '');
    // 改行・引用符・パイプを属性値へ安全に格納するため encodeURIComponent でエンコードする
    return `<div class="ve-protected" contenteditable="false" data-ve-type="${type}" data-md-source="${encodeURIComponent(source)}">`
        + `<div class="ve-protected-label">${escapeHTML(label)}</div>`
        + `<pre class="ve-protected-source">${escapeHTML(source)}</pre>`
        + `</div>\n`;
}

/** 傍点（カクヨム記法 《《強調》》）。ルビより先に評価させる必要がある。 */
const botenExtension = {
    name: 'boten',
    level: 'inline' as const,
    start(src: string) {
        const index = src.indexOf('《《');
        return index === -1 ? -1 : index;
    },
    tokenizer(src: string) {
        const match = matchBotenAtStart(src);
        if (!match) return;
        return {
            type: 'boten',
            raw: match.raw,
            tokens: this.lexer.inlineTokens(match.text),
        };
    },
    renderer(token: Tokens.Generic) {
        // styles.css で strong は既に傍点表示になっているため、見た目は自動的に傍点になる
        return `<strong class="ve-boten">${this.parser.parseInline(token.tokens as Tokens.Generic[])}</strong>`;
    }
};

const rubyExtension = {
    name: 'ruby',
    level: 'inline' as const,
    start(src: string) {
        const candidates: number[] = [];

        const pipeIndex = src.search(/[|｜]/);
        if (pipeIndex !== -1) candidates.push(pipeIndex);

        const braceIndex = src.indexOf('{');
        if (braceIndex !== -1) candidates.push(braceIndex);

        const autoMatch = new RegExp(`[${JAPANESE_BASE_CHARS}]+(?=《)`).exec(src);
        if (autoMatch) candidates.push(autoMatch.index);

        return candidates.length > 0 ? Math.min(...candidates) : -1;
    },
    tokenizer(src: string) {
        const match = matchRubyAtStart(src);
        if (!match) return;

        return {
            type: 'ruby',
            raw: match.raw,
            syntax: match.syntax,
            pipe: match.pipe ?? null,
            mono: match.mono,
            base: match.mono ? [] : this.lexer.inlineTokens(match.base),
            ruby: match.mono ? [] : this.lexer.inlineTokens(match.ruby),
        };
    },
    renderer(token: Tokens.Generic) {
        const syntax = token.syntax as RubySyntax;
        const mono = token.mono as { base: string; ruby: string }[] | null;
        const attributes = `data-ruby-syntax="${syntax}"${rubyPipeAttribute(syntax, token.pipe as string | null)}`;

        if (mono) {
            const inner = mono
                .map(pair => `${escapeHTML(pair.base)}<rt>${escapeHTML(pair.ruby)}</rt>`)
                .join('');
            return `<ruby ${attributes}>${inner}</ruby>`;
        }

        const base = token.base as Tokens.Generic[];
        const ruby = token.ruby as Tokens.Generic[];
        return `<ruby ${attributes}>${this.parser.parseInline(base)}<rt>${this.parser.parseInline(ruby)}</rt></ruby>`;
    }
};

/**
 * Obsidian 固有のインライン記法（wikilink / 埋め込み / 脚注参照）。
 * turndown のエスケープで \[\[...\]\] に化けてリンクが壊れるのを防ぐため、
 * 原文を data-md-source に持つ読み取り専用スパンにする。
 */
const obsidianInlineExtension = {
    name: 'obsidianInline',
    level: 'inline' as const,
    start(src: string) {
        const m = /!?\[\[|\[\^/.exec(src);
        return m ? m.index : -1;
    },
    tokenizer(src: string) {
        const embed = /^!\[\[([^\]\n]+)\]\]/.exec(src);
        if (embed) {
            return { type: 'obsidianInline', raw: embed[0], kind: 'embed', display: embed[1] };
        }

        const wikilink = /^\[\[([^\]\n]+)\]\]/.exec(src);
        if (wikilink) {
            const target = wikilink[1];
            const pipeIndex = target.indexOf('|');
            // 表示名はエイリアスがあればエイリアス、なければターゲットそのもの
            const display = pipeIndex >= 0 ? target.slice(pipeIndex + 1) : target;
            return { type: 'obsidianInline', raw: wikilink[0], kind: 'wikilink', display };
        }

        const footnote = /^\[\^([^\]\s]+)\]/.exec(src);
        if (footnote) {
            return { type: 'obsidianInline', raw: footnote[0], kind: 'footnote', display: footnote[0] };
        }
    },
    renderer(token: Tokens.Generic) {
        const source = encodeURIComponent(token.raw);
        const display = escapeHTML(String(token.display));
        const kind = token.kind as string;

        if (kind === 'embed') {
            return `<span class="ve-embed" contenteditable="false" data-md-source="${source}">${display}</span>`;
        }
        if (kind === 'wikilink') {
            return `<span class="ve-wikilink" contenteditable="false" data-md-source="${source}">${display}</span>`;
        }
        return `<span class="ve-footnote" contenteditable="false" data-md-source="${source}">${display}</span>`;
    }
};

/**
 * 脚注定義行 `[^1]: 説明`。
 * marked の標準ブロックルール（リンク参照定義）に食われて消えてしまうため、
 * ブロックレベルの拡張として先に捕捉する。
 */
const footnoteDefExtension = {
    name: 'footnoteDef',
    level: 'block' as const,
    start(src: string) {
        const m = /^\[\^/m.exec(src);
        return m ? m.index : -1;
    },
    tokenizer(src: string) {
        const m = /^\[\^([^\]\s]+)\]:[^\n]*(?:\n|$)/.exec(src);
        if (!m) return;
        return { type: 'footnoteDef', raw: m[0], text: m[0].replace(/\n$/, '') };
    },
    renderer(token: Tokens.Generic) {
        return protectedBlockHTML('footnote', String(token.text), t('Footnote (read-only in vertical editor)'));
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

        this.registerTurndownRules();

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
            },
            // 表は縦書きで表示・編集する需要がないうえ、往復変換でセルがばらばらの段落に分解されるため保護する
            table(token: Tokens.Table): string {
                return protectedBlockHTML('table', token.raw, t('Table (read-only in vertical editor)'));
            },
            // フェンスコード（インラインコードは対象外）
            code(token: Tokens.Code): string {
                return protectedBlockHTML('code', token.raw, t('Code block (read-only in vertical editor)'));
            },
            blockquote(token: Tokens.Blockquote): string | false {
                // コールアウトだけ保護し、通常の引用は従来どおり <blockquote> として描画する
                if (/^>\s*\[!/.test(token.raw.replace(/^\s+/, ''))) {
                    return protectedBlockHTML('callout', token.raw, t('Callout (read-only in vertical editor)'));
                }
                return false;
            }
        };

        this.marked.use({
            // marked は extensions を unshift で登録するため、配列の後ろほど先に評価される。
            // 《《傍点》》 がルビとして誤マッチしないよう boten を末尾（＝最優先）に置く。
            extensions: [footnoteDefExtension, obsidianInlineExtension, rubyExtension, botenExtension] as any,
            renderer: renderer as any,
            breaks: true, // 段落内の改行を<br>として保持
            gfm: true     // GitHub Flavored Markdown
        });
    }

    private registerTurndownRules(): void {
        // 保護ブロック: 表示用の DOM は一切見ず、常に属性から逐語復元する
        this.turndownService.addRule('veProtected', {
            filter: (node: Node) => {
                if (!(node instanceof HTMLElement)) return false;
                return node.classList.contains('ve-protected') && node.hasAttribute('data-md-source');
            },
            replacement: (_content: string, node: Node) => {
                const source = (node as HTMLElement).getAttribute('data-md-source') || '';
                return decodeURIComponent(source);
            }
        });

        // wikilink / 埋め込み / 脚注参照も同様に原文を復元する
        this.turndownService.addRule('veInlineSource', {
            filter: (node: Node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (!node.hasAttribute('data-md-source')) return false;
                return node.classList.contains('ve-wikilink')
                    || node.classList.contains('ve-embed')
                    || node.classList.contains('ve-footnote');
            },
            replacement: (_content: string, node: Node) => {
                const source = (node as HTMLElement).getAttribute('data-md-source') || '';
                return decodeURIComponent(source);
            }
        });

        this.turndownService.addRule('ruby', {
            filter: 'ruby',
            replacement: (_content: string, node: Node) => {
                return this.rubyToMarkdown(node as HTMLElement);
            }
        });

        // 傍点は **太字** と保存形式が混ざらないよう専用ルールで書き戻す
        this.turndownService.addRule('boten', {
            filter: (node: Node) => {
                if (!(node instanceof HTMLElement)) return false;
                return node.tagName === 'STRONG' && node.classList.contains('ve-boten');
            },
            replacement: (content: string) => `《《${content}》》`
        });

        // 取り消し線（turndown 標準にはルールが無く、無言で ~~ が消えてしまう）
        this.turndownService.addRule('strikethrough', {
            filter: (node: Node) => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
            replacement: (content: string) => `~~${content}~~`
        });

        // タスクリストのチェックボックス
        this.turndownService.addRule('taskListCheckbox', {
            filter: (node: Node) => {
                if (!(node instanceof HTMLElement)) return false;
                return node.tagName === 'INPUT'
                    && node.getAttribute('type') === 'checkbox'
                    && node.parentElement?.tagName === 'LI';
            },
            replacement: (_content: string, node: Node) => {
                return (node as HTMLInputElement).checked ? '[x] ' : '[ ] ';
            }
        });

        // リストマーカーを Obsidian 標準の "- 項目"（1スペース）に合わせて差分ノイズを減らす
        this.turndownService.addRule('listItem', {
            filter: 'li',
            replacement: (content: string, node: Node, options: TurndownService.Options) => {
                let text = content
                    .replace(/^\n+/, '')
                    .replace(/\n+$/, '\n')
                    // marked はチェックボックスの後ろに空白を入れて描画するため、
                    // taskListCheckbox ルールの分と重ならないよう 1 個に正規化する
                    .replace(/^(\[[ xX]\])\s+/, '$1 ');

                const parent = node.parentNode as HTMLElement | null;
                let prefix = `${options.bulletListMarker} `;
                if (parent && parent.nodeName === 'OL') {
                    const start = parent.getAttribute('start');
                    const index = Array.prototype.indexOf.call(parent.children, node);
                    prefix = `${start ? Number(start) + index : index + 1}. `;
                }

                // 継続行はマーカー幅ぶん字下げする
                text = text.replace(/\n/gm, '\n' + ' '.repeat(prefix.length));

                return prefix + text + (node.nextSibling && !/\n$/.test(text) ? '\n' : '');
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

        // 見出し内の <br>（編集時のプレースホルダー）は無視する
        this.turndownService.addRule('brInHeading', {
            filter: (node: Node) => {
                if (node.nodeName !== 'BR') return false;
                const parent = node.parentElement;
                return parent ? /^H[1-6]$/.test(parent.tagName) : false;
            },
            replacement: () => ''
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
    }

    /** <ruby> 要素を data-ruby-syntax に記録された元の記法へ復元する。 */
    private rubyToMarkdown(element: HTMLElement): string {
        const syntax = element.getAttribute('data-ruby-syntax') as RubySyntax | null;

        if (syntax === 'denden-mono') {
            return this.monoRubyToMarkdown(element);
        }

        const rtElements = Array.from(element.querySelectorAll('rt'));
        const rubyText = rtElements.map(rt => rt.textContent || '').join('');

        const temp = element.cloneNode(true) as HTMLElement;
        temp.querySelectorAll('rt, rp').forEach(child => child.remove());
        const baseText = temp.textContent || '';

        // ルビ未入力のまま保存されたケースは親文字だけに戻す
        if (rubyText.length === 0) return baseText;

        switch (syntax) {
            case 'pipe-half-angle':
                return `|${baseText}《${rubyText}》`;
            case 'auto-angle':
                return `${baseText}《${rubyText}》`;
            case 'pipe-full-paren':
                return `${rubyPipeCharacter(syntax, element.getAttribute('data-ruby-pipe'))}${baseText}（${rubyText}）`;
            case 'pipe-half-paren':
                return `${rubyPipeCharacter(syntax, element.getAttribute('data-ruby-pipe'))}${baseText}(${rubyText})`;
            case 'denden':
                return `{${baseText}|${rubyText}}`;
            case 'pipe-full-angle':
            default:
                // 属性なし（手書き HTML や他プラグイン由来）は従来どおりの記法にフォールバック
                return `｜${baseText}《${rubyText}》`;
        }
    }

    private monoRubyToMarkdown(element: HTMLElement): string {
        let base = '';
        const rubies: string[] = [];

        Array.from(element.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                base += node.textContent || '';
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const el = node as HTMLElement;
            if (el.tagName === 'RT') {
                rubies.push(el.textContent || '');
            } else if (el.tagName !== 'RP') {
                base += el.textContent || '';
            }
        });

        if (rubies.length === 0 || rubies.join('').length === 0) return base;
        return `{${base}|${rubies.join('|')}}`;
    }

    async fromMarkdownToHTML(markdownContent: string): Promise<string> {
        // 1. 改行コードを \n (LF) に統一する (Windows/CRLF対策)
        const normalizedContent = markdownContent.replace(/\r\n/g, '\n');

        // 2. 2つ以上の連続改行を検出し、空行要素に置換する（コードフェンスの外だけ）
        const preProcessedContent = this.insertEmptyLineMarkers(normalizedContent);

        let html = await this.marked.parse(preProcessedContent) as string;

        // 既存処理: 空の段落パターンを検出して <br> を挿入
        html = html.replace(/<p>\s*<\/p>/g, '<p><br></p>');

        return html;
    }

    /**
     * 連続改行を空行要素へ置換する。
     * ユーザーの見た目基準: Enter を N 回押した = N-1 行の空き
     * \n\n (2つ) = Enter 2回 = 1行分の空き / \n\n\n (3つ) = 2行分の空き
     *
     * コードフェンスの中には注入しない。注入するとコード本文に literal な HTML タグが混入し、
     * さらに renderer に渡る token.raw が汚染されて元に戻せなくなるため。
     */
    private insertEmptyLineMarkers(content: string): string {
        const replaceOutsideFence = (text: string) => text.replace(/\n{2,}/g, (match) => {
            const count = match.length - 1;
            const emptyLineStr = '<p class="ve-empty-line"><br></p>';
            // 前後に \n\n を挟むことで、marked が前後のテキストを正しく段落として認識できるようにする
            return '\n\n' + emptyLineStr.repeat(count) + '\n\n';
        });

        let result = '';
        let cursor = 0;

        for (const range of this.findFenceRanges(content)) {
            result += replaceOutsideFence(content.slice(cursor, range.start));
            result += content.slice(range.start, range.end);
            cursor = range.end;
        }
        result += replaceOutsideFence(content.slice(cursor));

        return result;
    }

    /**
     * コードフェンスの範囲（開始行の先頭〜終了行の末尾。終了行の改行は含めない）を返す。
     * 終了行の改行を範囲に含めないのは、フェンス直後の空行を範囲外に残して
     * 空行要素の注入対象にするため。
     */
    private findFenceRanges(content: string): { start: number; end: number }[] {
        const ranges: { start: number; end: number }[] = [];
        const lines = content.split('\n');

        let offset = 0;
        let fenceStart = -1;
        let fenceChar = '';
        let fenceLength = 0;

        for (const line of lines) {
            const lineStart = offset;
            const lineEnd = offset + line.length;
            offset = lineEnd + 1; // 改行ぶん

            const match = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(line);

            if (fenceStart === -1) {
                if (match) {
                    fenceStart = lineStart;
                    fenceChar = match[1][0];
                    fenceLength = match[1].length;
                }
                continue;
            }

            // 閉じフェンスは同じ文字・同じ長さ以上で、後ろに情報文字列を持たない行
            if (match && match[1][0] === fenceChar && match[1].length >= fenceLength && match[2].trim() === '') {
                ranges.push({ start: fenceStart, end: lineEnd });
                fenceStart = -1;
            }
        }

        // 閉じられていないフェンス（書きかけ）は、開始行以降すべてをフェンス内として扱う
        if (fenceStart !== -1) {
            ranges.push({ start: fenceStart, end: content.length });
        }

        return ranges;
    }

    fromHTMLToMarkdown(htmlContent: string | HTMLElement): string {
        // HTMLElement を直接渡すと TurndownService はその子ノードのみ処理し、
        // <h1> 等のラッパー要素自体が無視されて見出し記法が失われる。
        // outerHTML (文字列) を渡すことでルート要素ごと変換される。
        const input = htmlContent instanceof HTMLElement ? htmlContent.outerHTML : htmlContent;
        return this.unescapeObsidianSyntax(this.turndownService.turndown(input));
    }

    /**
     * 縦書きエディタ内で新規にタイプされた記法はプレーンテキストなので、
     * turndown の標準エスケープで \[\[リンク\]\] のように壊されてしまう。
     * エスケープ機構自体は平文中の * や # を守る安全装置なので変更せず、
     * Obsidian 記法に限定したアンエスケープを後処理で行う。
     */
    private unescapeObsidianSyntax(markdown: string): string {
        return markdown
            .replace(/\\\[\\\[/g, '[[')
            .replace(/\\\]\\\]/g, ']]')
            .replace(/\\\[\^/g, '[^')
            .replace(/\\\[!/g, '[!');
    }
}
