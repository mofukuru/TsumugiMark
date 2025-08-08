import { App } from "obsidian";
import { unified, Plugin } from "unified";
import remarkParse from "remark-parse";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw"; // rehype-raw をインポート
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, {defaultSchema} from "rehype-sanitize"; // defaultSchemaをインポート
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";
import {toString as hastToString} from 'hast-util-to-string'; // hast-util-to-string をインポート
import {Text, Paragraph, Root} from 'mdast';
import {Node as UnistNode} from 'unist';

// remarkプラグイン：Markdownの連続する空行を検出して特殊なHTMLノードを挿入
const remarkInjectManualBreaks: Plugin<[], Root, Root> = () => {
    return (tree: Root, file) => {
        if (!tree.children) return;

        const newChildren: Root['children'] = []; // Content[] を FlowContent[] に変更
        for (let i = 0; i < tree.children.length; i++) {
            const currentNode = tree.children[i];

            if (i > 0) {
                const previousNode = tree.children[i - 1];

                if (currentNode.position && previousNode.position &&
                    previousNode.type !== 'yaml' &&
                    (previousNode.type === 'paragraph' || previousNode.type === 'heading' || previousNode.type === 'list' || previousNode.type === 'blockquote' || previousNode.type === 'code' || previousNode.type === 'thematicBreak' || previousNode.type === 'html')
                   ) {

                    const blankLineSourceCount = currentNode.position.start.line - previousNode.position.end.line - 1;

                    if (blankLineSourceCount >= 1) {
                        const intentionalBlankParaCount = blankLineSourceCount;
                        for (let j = 0; j < intentionalBlankParaCount; j++) {
                            newChildren.push({
                                type: 'html',
                                value: '<p class="ve-blank"><br></p>'
                            });
                        }
                    }
                }
            }
            newChildren.push(currentNode);
        }
        tree.children = newChildren;
    };
};

export class SwitchText {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async fromMarkdownToHTML(markdownContent: string): Promise<string> {
        let processedMarkdown = markdownContent;

        // Apply Ruby transformations based on the provided patterns
        // Order is important: specific ruby patterns first, then general kanji-based, then escapes.

        processedMarkdown = processedMarkdown.replace(/[\|｜](.+?)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
        // processedMarkdown = processedMarkdown.replace(/[\|｜](.+?)（(.+?)）/g, '<ruby>$1<rt>$2</rt></ruby>');
        // processedMarkdown = processedMarkdown.replace(/[\|｜](.+?)\((.+?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');

        processedMarkdown = processedMarkdown.replace(/([一-龠]+)《(.+?)》/g, '<ruby>$1<rt>$2</rt></ruby>');
        // processedMarkdown = processedMarkdown.replace(/([一-龠]+)（(.+?)）/g, '<ruby>$1<rt>$2</rt></ruby>');
        // processedMarkdown = processedMarkdown.replace(/([一-龠]+)\((.+?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');

        processedMarkdown = processedMarkdown.replace(/[\|｜]《(.+?)》/g, '《$1》');
        // processedMarkdown = processedMarkdown.replace(/[\|｜]（(.+?)）/g, '（$1）');
        // processedMarkdown = processedMarkdown.replace(/[\|｜]\((.+?)\)/g, '($1)');

        // ここではデフォルトスキーマに加えて、style属性を許可する例（注意して使用）
        const schema = {
            ...defaultSchema,
            attributes: {
                ...defaultSchema.attributes,
                p: [...(defaultSchema.attributes?.p || []), 'class'],
                '*': [...(defaultSchema.attributes?.['*'] || []), 'style', 'class'] // すべてのタグにstyleとclassを許可
            }
            // defaultSchema already includes 'ruby', 'rt', 'rp' in tagNames.
            // If you used <rb> explicitly, you might add it here:
            // tagNames: [...defaultSchema.tagNames, 'rb'],
        };

        const file = await unified()
            .use(remarkParse) // Markdownをパース
            .use(remarkInjectManualBreaks)
            .use(remarkBreaks) // Markdown内の改行を<br>として扱う
            .use(remarkRehype, { allowDangerousHtml: true }) // HTMLへの変換（危険なHTMLも許可）
            .use(rehypeRaw) // 生のHTMLノードをパースしてHASTに変換
            .use(rehypeSanitize, schema) // HTMLをサニライズ（上記スキーマを使用）
            .use(rehypeStringify) // HTMLを文字列に変換
            .process(processedMarkdown); // Process the modified markdown
        // console.log("fromMarkdownToHTML: 出力HTML:", String(file).substring(0,100));
        return String(file);
    }

    // HTMLコンテンツをMarkdown文字列に変換する
    async fromHTMLToMarkdown(htmlContent: string): Promise<string> {
        // console.log("fromHTMLToMarkdown: 入力HTML:", htmlContent.substring(0,100));
        // const stringifyOptions: RemarkStringifyOptions = { // 型を明示する場合
        const stringifyOptions = {
            bullet: '-', // リストの箇条書き記号を '-' にする
            listItemIndent: 'one', // リストアイテムのインデントをスペース1つにする
            emphasis: '_', // 強調を *ではなく_にする (例: _italic_)
            strong: '*', // 太字のマーカーを * にする (例: **bold**)
            // 必要に応じて他のオプションも追加できます
            // 例: fence: '`', fences: true, rule: '-' など
        } as const;

        const file = await unified()
            .use(rehypeParse) // HTMLをパースしてRehype ASTに
            .use(rehypeRemark, {
                handlers: {
                  ruby: (h, node: any) => { // node の型を any にするか、適切な型定義を使用
                    // nodeがelementで、tagNameがrubyであり、childrenを持つことを確認
                    if (node.type !== 'element' || node.tagName !== 'ruby' || !Array.isArray(node.children)) {
                      return h.all(node); // 期待する構造でなければデフォルト処理
                    }

                    const rtNode = node.children.find((child: any) => child.type === 'element' && child.tagName === 'rt');

                    if (!rtNode) {
                      return h.all(node); // <rt> がなければデフォルト処理
                    }

                    const rubyText = hastToString(rtNode);

                    // <rt> と <rp> 以外の要素を親文字の候補とする
                    const baseChildren = node.children.filter((child: any) => {
                      if (child.type === 'element') {
                        return child.tagName !== 'rt' && child.tagName !== 'rp';
                      }
                      return true; // テキストノードなどは保持
                    });

                    const baseText = baseChildren.map((child: any) => hastToString(child)).join('');

                    if (baseText.trim() && rubyText.trim()) {
                      // ｜親文字《ルビ文字》 の形式でMarkdownテキストノードを返す
                      return { type: 'text', value: `｜${baseText}《${rubyText}》` };
                    }
                    return h.all(node); // 親文字かルビ文字が空ならデフォルト処理
                  },
                  br: (h, node: any) => {
                    return {type: 'text', value: '\n'};
                  },
                  p: (h, node: any): Paragraph | Paragraph[] => {
                    const children = node.children || [];

                    // 内容が実質的に空か（<br>のみの場合も含む）どうかを判定
                    const isEffectivelyEmpty = children.length === 0 ||
                                               (children.length === 1 && children[0].type === 'element' && children[0].tagName === 'br');

                    if (isEffectivelyEmpty) {
                        // 視覚的に空の <p> 要素はMDASTのブロックフローから省略する
                        return [];
                    }

                    // 通常のコンテンツを持つ段落
                    return {type: 'paragraph', children: h.all(node) as Paragraph['children']};
                  }
                }
            }) // Rehype ASTをRemark AST（Markdown AST）に変換
            .use(remarkStringify, stringifyOptions) // Remark ASTをMarkdown文字列に変換、修正したオプションを適用
            .process(htmlContent);
        // console.log("fromHTMLToMarkdown: 出力Markdown:", String(file).substring(0,100));
        return String(file);
    }
}
