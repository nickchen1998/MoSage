import { spawn } from 'node:child_process';
import { basename, extname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import type { Book } from '../node/book.ts';
import type { ExportFormat } from '../node/export/index.ts';
import { Project } from '../node/project.ts';
import { startServer } from '../node/server.ts';
import type { ProjectType } from '../shared/config.ts';
import { init, installSkills } from './init.ts';
import { BOOK_TEMPLATE_DIR, VERSION, WEB_DIR } from './paths.ts';
import { printLibrary, printStatus } from './status.ts';
import { bold, cyan, dim, green, red, yellow } from './style.ts';

const HELP = `
${bold('MoSage')} ${dim(`v${VERSION}`)} — 和 AI 一起寫書、寫論文

${bold('建立專案')}（一個專案可以放很多本書）
  ${cyan('npx mosage init <資料夾>')}          建立寫作專案
      --author <作者>  --no-install  --no-git  --force

${bold('在專案資料夾裡')}
  ${cyan('mosage dev')}                         開啟寫作介面（預設 http://localhost:5280）
      --port <埠號>  --host <位址>  --no-open
  ${cyan('mosage new <代號>')}                  新增一本書（通常由 AI 在立項時執行）
      --title <書名>  --type book|thesis|other
  ${cyan('mosage status [書]')}                 書架總覽／單本書的章節、字數、待處理標記
      --json
  ${cyan('mosage export [書] [docx|html|md]')}  匯出（預設 Word）到 output/<書>/
      --out <檔案路徑>
  ${cyan('mosage import <檔案.docx|.md>')}      匯入既有稿件，依標題切成章節（預設建立新書）
      --book <代號>  --title <書名>  --no-split  --unlisted
  ${cyan('mosage sync-skills')}                 升級 mosage 後，更新專案裡的 AI skills

  [書] 可省略：在書的資料夾裡執行、或專案只有一本書時會自動判斷。
`;

const FORMATS = new Set(['docx', 'html', 'md']);

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args as string[], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {}
}

async function ask(question: string, fallback: string): Promise<string> {
  if (!process.stdin.isTTY) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} ${dim(`(${fallback})`)} `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

function projectType(value: unknown): ProjectType | undefined {
  if (value === undefined) return undefined;
  if (value === 'book' || value === 'thesis' || value === 'other') return value;
  throw new Error('--type 只能是 book、thesis 或 other');
}

async function main(argv: string[]) {
  // Bare `mosage` opens the UI inside a project, and explains itself elsewhere.
  if (argv.length === 0) {
    try {
      Project.find();
    } catch {
      process.stdout.write(HELP);
      return;
    }
  }
  const [command = 'dev', ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    strict: false,
    options: {
      port: { type: 'string' },
      host: { type: 'string' },
      'no-open': { type: 'boolean' },
      out: { type: 'string' },
      json: { type: 'boolean' },
      type: { type: 'string' },
      title: { type: 'string' },
      author: { type: 'string' },
      book: { type: 'string' },
      'no-install': { type: 'boolean' },
      'no-git': { type: 'boolean' },
      force: { type: 'boolean' },
      'no-split': { type: 'boolean' },
      unlisted: { type: 'boolean' },
    },
  });
  const opt = (name: string) =>
    typeof values[name] === 'string' ? (values[name] as string) : undefined;

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(HELP);
      return;

    case 'version':
    case '--version':
    case '-v':
      process.stdout.write(`${VERSION}\n`);
      return;

    case 'init':
    case 'create': {
      const dir = positionals[0] ?? (await ask('專案資料夾名稱？', 'my-writing'));
      await init({
        dir,
        author: opt('author'),
        install: !values['no-install'],
        git: !values['no-git'],
        force: Boolean(values.force),
      });
      return;
    }

    case 'dev':
    case 'start':
    case 'open': {
      const project = Project.find();
      const host = opt('host') ?? '127.0.0.1';
      const running = await startServer(project, {
        port: opt('port') ? Number(opt('port')) : 5280,
        host,
        webDir: WEB_DIR,
        bookTemplateDir: BOOK_TEMPLATE_DIR,
      });
      process.stdout.write(
        `\n${green('●')} ${bold('MoSage 寫作介面')}  ${cyan(running.url)}\n${dim(`  專案：${project.root}`)}\n`,
      );
      if (host !== '127.0.0.1' && host !== 'localhost') {
        process.stdout.write(
          `${yellow('!')} 伺服器對 ${host} 開放 —— 同一個網路上的任何人都能讀寫你的稿件。\n`,
        );
      }
      process.stdout.write(dim('  按 Ctrl+C 結束\n\n'));
      if (!values['no-open']) openBrowser(running.url);
      const stop = async () => {
        await running.close();
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      return;
    }

    case 'new': {
      const project = Project.find();
      const book = await project.createBook(BOOK_TEMPLATE_DIR, {
        id: positionals[0],
        title: opt('title'),
        type: projectType(opt('type')),
      });
      process.stdout.write(
        `${green('✔')} 已建立 ${bold(`books/${book.id}/`)}（book.yaml、brief.md、STYLE.md、chapters/、assets/、notes/）\n`,
      );
      return;
    }

    case 'status': {
      const project = Project.find();
      const json = Boolean(values.json);
      const explicit = positionals[0];
      let book: Book | null = null;
      if (explicit) book = project.book(explicit);
      else {
        try {
          book = await project.resolveBook();
        } catch {
          book = null;
        }
      }
      if (book) await printStatus(book, json);
      else await printLibrary(project, json);
      return;
    }

    case 'export': {
      const project = Project.find();
      const format = positionals.find((p) => FORMATS.has(p.replace(/^\./, '')))?.replace(/^\./, '');
      const bookId = positionals.find((p) => !FORMATS.has(p.replace(/^\./, '')));
      const book = await project.resolveBook(bookId);
      const { exportManuscript } = await import('../node/export/index.ts');
      const result = await exportManuscript(book, (format ?? 'docx') as ExportFormat, opt('out'));
      process.stdout.write(
        `${green('✔')} 已匯出 ${bold(result.path)} ${dim(`(${Math.max(1, Math.round(result.bytes / 1024))} KB)`)}\n`,
      );
      return;
    }

    case 'import': {
      const file = positionals[0];
      if (!file) throw new Error('請指定要匯入的檔案，例如：mosage import 書稿.docx');
      const project = Project.find();
      const target = opt('book');
      let book: Book;
      let created = false;
      const existing = target ? await project.listBookIds() : [];
      if (target && existing.includes(target)) {
        book = project.book(target);
      } else {
        const title = opt('title') ?? basename(file, extname(file));
        book = await project.createBook(BOOK_TEMPLATE_DIR, { id: target, title });
        await book.updateConfig((doc) => doc.set('stage', 'writing'));
        created = true;
      }
      const { importFile } = await import('../node/import/index.ts');
      const result = await importFile(book, file, {
        split: !values['no-split'],
        listed: !values.unlisted,
      });
      if (created) process.stdout.write(`${green('✔')} 建立新書 ${bold(`books/${book.id}/`)}\n`);
      process.stdout.write(`${green('✔')} 匯入 ${result.created.length} 個章節\n`);
      for (const id of result.created) process.stdout.write(dim(`   chapters/${id}\n`));
      if (result.assets.length) {
        process.stdout.write(dim(`   另存了 ${result.assets.length} 張圖片到 assets/imported/\n`));
      }
      for (const w of result.warnings) process.stdout.write(`${yellow('!')} ${w}\n`);
      if (created) {
        process.stdout.write(
          dim(
            '\n  建議接著請 AI 讀過稿子、補齊 brief.md 與 STYLE.md（對 AI 說「幫我整理這本匯入的書」）。\n',
          ),
        );
      }
      return;
    }

    case 'sync-skills': {
      const project = Project.find();
      const names = await installSkills(project.root);
      process.stdout.write(`${green('✔')} 已更新 ${names.length} 個 skills：${names.join('、')}\n`);
      return;
    }

    default:
      process.stdout.write(`${red(`不認得的指令：${command}`)}\n${HELP}`);
      process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`${red('✖')} ${(err as Error).message ?? err}\n`);
  process.exit(1);
});
