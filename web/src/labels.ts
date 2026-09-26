import type { ChapterStatus, ProjectType, Stage } from '../../src/shared/config.ts';

export const TYPE_LABEL: Record<ProjectType, string> = {
  book: '書',
  thesis: '論文',
  other: '長文',
};

export const STAGE_LABEL: Record<Stage, string> = {
  kickoff: '立項',
  outline: '大綱',
  writing: '撰寫',
  revising: '修訂',
  done: '完稿',
};

/** What to say to the AI at each stage. */
export const STAGE_HINT: Record<Stage, { text: string; say: string }> = {
  kickoff: {
    text: '先讓 AI 了解你的寫作目的、讀者、風格與篇幅。',
    say: '開始',
  },
  outline: {
    text: 'AI 會提出書名與章節架構。建立後，在下方拖曳調整章節、修改章名與摘要。',
    say: '幫我訂書名和大綱',
  },
  writing: {
    text: '一次寫一章，寫的過程會即時出現在這裡。讀完選取文字就能留言給 AI。',
    say: '開始寫第一章',
  },
  revising: {
    text: '請 AI 以編輯角度審稿；修改建議會出現在稿子裡，由你接受或拒絕。',
    say: '幫我審這一章',
  },
  done: {
    text: '完稿了！從右上角匯出 Word。',
    say: '幫我做最後檢查',
  },
};

export const STATUS_LABEL: Record<ChapterStatus, string> = {
  idea: '構想',
  draft: '草稿',
  revising: '修訂中',
  done: '完成',
};

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return '剛剛';
  if (diff < 3600) return `${Math.round(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.round(diff / 3600)} 小時前`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)} 天前`;
  return new Date(iso).toLocaleDateString('zh-TW');
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-TW').format(n);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
