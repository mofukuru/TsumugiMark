import { App } from "obsidian";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, {defaultSchema} from "rehype-sanitize"; // defaultSchemaをインポート
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";

export class SwitchText {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async fromMarkdownToHTML(markdownContent: string): Promise<string> {
        // console.log("fromMarkdownToHTML: 入力Markdown:", markdownContent.substring(0,100));
        // サニタイズスキーマをカスタマイズして、より多くのHTML要素や属性を許可することも可能
        // ここではデフォルトスキーマに加えて、style属性を許可する例（注意して使用）
        const schema = {
            ...defaultSchema,
            attributes: {
                ...defaultSchema.attributes,
                '*': [...(defaultSchema.attributes?.['*'] || []), 'style', 'class'] // すべてのタグにstyleとclassを許可
            }
        };

        const file = await unified()
            .use(remarkParse) // Markdownをパース
            .use(remarkBreaks) // Markdown内の改行を<br>として扱う
            .use(remarkRehype, { allowDangerousHtml: true }) // HTMLへの変換（危険なHTMLも許可）
            .use(rehypeSanitize, schema) // HTMLをサニライズ（上記スキーマを使用）
            .use(rehypeStringify) // HTMLを文字列に変換
            .process(markdownContent);
        // console.log("fromMarkdownToHTML: 出力HTML:", String(file).substring(0,100));
        return String(file);
    }

    // HTMLコンテンツをMarkdown文字列に変換する
    async fromHTMLToMarkdown(htmlContent: string): Promise<string> {
        // console.log("fromHTMLToMarkdown: 入力HTML:", htmlContent.substring(0,100));

        // remark-stringifyのオプションを定義
        // const stringifyOptions: RemarkStringifyOptions = { // 型を明示する場合
        const stringifyOptions = {
            bullet: '-', // リストの箇条書き記号を '-' にする
            listItemIndent: 'one', // リストアイテムのインデントをスペース1つにする
            emphasis: '_', // 強調を *ではなく_にする (例: _italic_)
            strong: '*', // 太字のマーカーを * にする (例: **bold**)
            // 必要に応じて他のオプションも追加できます
            // 例: fence: '`', fences: true, rule: '-' など
        } as const; // Add 'as const' for literal type inference

        const file = await unified()
            .use(rehypeParse) // HTMLをパースしてRehype ASTに
            .use(rehypeRemark, {
                // ハンドラを追加して特定のHTML要素の変換方法をカスタマイズ可能
                // 例: <div class="custom"> -> カスタムMarkdown構文
            }) // Rehype ASTをRemark AST（Markdown AST）に変換
            .use(remarkStringify, stringifyOptions) // Remark ASTをMarkdown文字列に変換、修正したオプションを適用
            .process(htmlContent);
        // console.log("fromHTMLToMarkdown: 出力Markdown:", String(file).substring(0,100));
        return String(file);
    }
}
