// `mosage status` — the bookshelf, or one book at a glance, for the author
// and for the AI (`--json` is what the skills read).

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Image } from 'mdast';
import type { Book } from '../node/book.ts';
import type { Project } from '../node/project.ts';
import { lineAt, parseChapter } from '../shared/markdown.ts';
import { formatCount } from '../shared/wordcount.ts';
import { bold, cyan, dim, green, magenta, red, yellow } from './style.ts';

const STAGE_LABEL: Record<string, string> = {
  kickoff: '立項（訪談寫作目的）',
  outline: '大綱（訂書名與章節）',
  writing: '撰寫',
  revising: '修訂',
  done: '完稿',
};

const STATUS_LABEL: Record<string, string> = {
  idea: '構想',
  draft: '草稿',
  revising: '修訂中',
  done: '完成',
};

export interface PendingNote {
  chapter: string;
  id: string;
  kind: 'comment' | 'suggest';
  by: string;
  line: number;
  quote?: string;
  body: string;
}

export async function collectStatus(target: Book) {
  const book = await target.summarize();
  const notes: PendingNote[] = [];
  const brokenImages: { chapter: string; line: number; url: string }[] = [];

  for (const chapter of [...book.chapters, ...book.drafts]) {
    const { source } = await target.readChapter(chapter.id);
    const parsed = parseChapter(source);
    for (const a of parsed.annotations) {
      notes.push({
        chapter: chapter.id,
        id: a.id,
        kind: a.kind,
        by: a.by,
        line: lineAt(source, a.start),
        quote: a.quote,
        body: a.body,
      });
    }
    const visit = (node: unknown) => {
      const n = node as { type?: string; children?: unknown[] };
      if (n.type === 'image') {
        const img = node as Image;
        const url = decodeURI(img.url.split(/[?#]/)[0]);
        if (!/^[a-z]+:/i.test(url) && url) {
          const fromChapter = resolve(dirname(target.chapterPath(chapter.id)), url);
          const fromRoot = resolve(target.root, url);
          if (!existsSync(fromChapter) && !existsSync(fromRoot)) {
            brokenImages.push({
              chapter: chapter.id,
              line: img.position?.start.line ?? 0,
              url: img.url,
            });
          }
        }
      }
      n.children?.forEach(visit);
    };
    visit(parsed.tree);
  }
  return { ...book, notes, brokenImages };
}

export async function printStatus(target: Book, json: boolean): Promise<void> {
  const s = await collectStatus(target);
  if (json) {
    process.stdout.write(`${JSON.stringify(s, null, 2)}\n`);
    return;
  }
  const { config } = s;
  const out = (line = '') => process.stdout.write(`${line}\n`);
  const kind = config.type === 'thesis' ? '論文' : config.type === 'book' ? '書' : '寫作專案';

  out();
  out(
    `${bold(config.title || '（尚未命名）')}${config.subtitle ? `  ${dim(config.subtitle)}` : ''}`,
  );
  out(
    dim(
      `${kind}${config.author ? ` · ${config.author}` : ''} · 階段：${STAGE_LABEL[config.stage]}`,
    ),
  );
  const goal = config.targetWords ? ` / 目標 ${formatCount(config.targetWords)}` : '';
  const pct = config.targetWords
    ? `（${Math.round((s.totals.words / config.targetWords) * 100)}%）`
    : '';
  out(dim(`字數 ${formatCount(s.totals.words)}${goal}${pct}`));
  out();

  out(dim(`books/${s.id}/`));
  out();

  if (!s.hasBrief) {
    out(`${yellow('還沒有寫作企劃（brief.md）。')}對 AI 說「開始」進行立項訪談。`);
    out();
  }

  if (s.chapters.length) {
    out(bold('章節'));
    s.chapters.forEach((c, i) => {
      const flags = [
        c.comments ? yellow(`${c.comments} 則留言待 AI 處理`) : '',
        c.suggestions ? magenta(`${c.suggestions} 個 AI 修改建議`) : '',
        c.aiNotes ? cyan(`${c.aiNotes} 則 AI 留言`) : '',
      ].filter(Boolean);
      out(
        `  ${dim(String(i + 1).padStart(2))}  ${c.title}  ${dim(`${STATUS_LABEL[c.status]} · ${formatCount(c.words)} 字 · ${c.id}`)}${flags.length ? `  ${flags.join('  ')}` : ''}`,
      );
    });
    out();
  }
  if (s.drafts.length) {
    out(bold('未排入目錄的草稿'));
    for (const c of s.drafts) out(`  ·  ${c.title}  ${dim(c.id)}`);
    out();
  }
  if (s.missing.length) {
    out(red(`mosage.yaml 列出但找不到的檔案：${s.missing.join('、')}`));
    out();
  }
  if (s.brokenImages.length) {
    out(red('找不到的圖片'));
    for (const b of s.brokenImages)
      out(`  books/${s.id}/chapters/${b.chapter}:${b.line}  ${b.url}`);
    out();
  }
  if (s.notes.length) {
    out(bold('待處理的標記'));
    for (const n of s.notes) {
      const label =
        n.kind === 'suggest'
          ? magenta('AI 建議')
          : n.by === 'ai'
            ? cyan('AI 留言')
            : yellow('給 AI 的留言');
      const text = n.body.replace(/\s+/g, ' ').slice(0, 60);
      out(`  ${label}  ${dim(`books/${s.id}/chapters/${n.chapter}:${n.line}`)}  ${text}`);
    }
    out();
  } else if (s.chapters.length) {
    out(green('沒有待處理的留言或建議。'));
    out();
  }
}

export async function printLibrary(project: Project, json: boolean): Promise<void> {
  const books = await project.listBooks();
  if (json) {
    process.stdout.write(`${JSON.stringify({ root: project.root, books }, null, 2)}\n`);
    return;
  }
  const out = (line = '') => process.stdout.write(`${line}\n`);
  out();
  if (books.length === 0) {
    out(`${yellow('這個專案還沒有任何書。')}`);
    out(
      '用 Claude Code 或 Codex 開啟這個資料夾，說「開始」—— AI 會帶你完成立項訪談並建立第一本書。',
    );
    out();
    return;
  }
  out(bold(`書架（${books.length} 本）`));
  for (const b of books) {
    const c = b.config;
    const kind = c.type === 'thesis' ? '論文' : c.type === 'book' ? '書' : '長文';
    const progress = c.targetWords
      ? `${formatCount(b.totals.words)} / ${formatCount(c.targetWords)} 字`
      : `${formatCount(b.totals.words)} 字`;
    const flags = [
      b.totals.comments ? yellow(`${b.totals.comments} 則留言待處理`) : '',
      b.totals.suggestions ? magenta(`${b.totals.suggestions} 個 AI 建議`) : '',
    ].filter(Boolean);
    out(
      `  ${bold(c.title || '（未命名）')}  ${dim(`${kind} · ${STAGE_LABEL[c.stage]} · ${b.chapters.length} 章 · ${progress} · books/${b.id}/`)}${flags.length ? `  ${flags.join('  ')}` : ''}`,
    );
  }
  out();
  out(dim('查看單本：mosage status <代號>'));
  out();
}
