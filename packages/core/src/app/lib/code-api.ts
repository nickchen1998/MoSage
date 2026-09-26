import type { CodeHost, RemoteInfo } from './code-remote';
import { call, jsonInit } from './settings-api';

export type FileState = 'pushed' | 'modified' | 'added' | 'deleted';

export type CodeStatus = {
  exists: boolean;
  isRepo: boolean;
  remoteUrl: string | null;
  remote: RemoteInfo | null;
  unsupportedRemote: boolean;
  savedRemote: string | null;
  host: CodeHost | null;
  branch: string | null;
  pushedSha: string | null;
  pushedAt: string | null;
  changes: Array<{ path: string; state: Exclude<FileState, 'pushed'> }>;
};

export type CodeFile = {
  path: string;
  text: string;
  truncated: boolean;
  deleted: boolean;
  href: string | null;
};

export const getCodeStatus = () => call<CodeStatus>('/__code');

export const getCodeTree = () =>
  call<{ status: CodeStatus; files: Array<{ path: string; state: FileState }> }>('/__code/tree');

export const getCodeFile = (path: string) =>
  call<CodeFile>(`/__code/file?path=${encodeURIComponent(path)}`);

export const connectCode = (url: string, host?: CodeHost | null) =>
  call<CodeStatus>('/__code/connect', jsonInit('POST', { url, ...(host ? { host } : {}) }));

export const pushCode = (message: string) =>
  call<{ sha: string; committed: boolean; status: CodeStatus }>(
    '/__code/push',
    jsonInit('POST', { message }),
  );

/** "12 minutes ago", for when origin last got a push. */
export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(-Math.round(seconds / size), unit);
  }
  return 'just now';
}
