import { App, TFile } from "obsidian";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";

export class SwitchText {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async fromMarkdownToHTML(activeFile: TFile | null, editorDiv: HTMLDivElement) {
        let file = null;

        if (activeFile) {
            file = activeFile;
            const fileContent = await this.app.vault.read(activeFile);
            const htmlFile = await unified()
                .use(remarkParse)
                .use(remarkBreaks)
                .use(remarkRehype)
                .use(rehypeSanitize)
                .use(rehypeStringify)
                .process(fileContent)
            editorDiv.innerHTML = String(htmlFile);
        } else {
            // editorDiv.setText("新規ファイルまたは空の内容です。");
            editorDiv.innerHTML = ("<p>新規ファイルまたは空の内容です。</p>");
        }

        return file;
    }

    // NOTE: これが必要かどうか
    async fromHTMLToMarkdown(activeFile: TFile | null) {
        if (activeFile) {
            const fileContent = await this.app.vault.read(activeFile);
            const markdownFile = await unified()
                .use(rehypeParse)
                .use(rehypeRemark)
                .use(remarkStringify)
                .process()
        }
    }
}
