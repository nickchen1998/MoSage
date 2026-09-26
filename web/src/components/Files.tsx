// 素材: images (assets/) and reference material (notes/). Dropping files here
// copies them into the book's folder — plain files, no database.

import { type DragEvent, useRef, useState } from 'react';
import { api, type BookSummary, type FileEntry, type FileFolder, useLive } from '../api.ts';
import { formatBytes, relativeTime } from '../labels.ts';
import { toast, toastError } from '../toast.tsx';

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function DropZone({
  book,
  folder,
  label,
  accept,
}: {
  book: string;
  folder: FileFolder;
  label: string;
  accept?: string;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 0) return;
    setBusy(true);
    try {
      for (const file of list) {
        if (file.size > 40 * 1024 * 1024) {
          toast(`${file.name} 超過 40 MB，請直接複製到資料夾`, 'error');
          continue;
        }
        const saved = await api.upload(book, folder, file.name, await readAsBase64(file));
        toast(`已複製到 ${saved.path}`, 'success');
      }
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void upload(e.dataTransfer.files);
  };

  return (
    <button
      type="button"
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => input.current?.click()}
      disabled={busy}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => e.target.files && void upload(e.target.files)}
      />
      <strong>{busy ? '複製中…' : label}</strong>
      <span className="muted small">拖曳檔案到這裡，或點一下選擇檔案</span>
    </button>
  );
}

function AssetCard({ book, file }: { book: string; file: FileEntry }) {
  const url = `/files/books/${encodeURIComponent(book)}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
  const snippet = `![${file.name.replace(/\.[^.]+$/, '')}](../${file.path})`;
  return (
    <li className="asset">
      <a className="asset-thumb" href={url} target="_blank" rel="noreferrer">
        {IMAGE.test(file.name) ? (
          <img src={url} alt={file.name} loading="lazy" />
        ) : (
          <span>檔案</span>
        )}
      </a>
      <div className="asset-info">
        <div className="asset-name" title={file.path}>
          {file.name}
        </div>
        <div className="muted small">
          {formatBytes(file.size)} · {relativeTime(file.updatedAt)}
          {file.used === false && <span className="pill pill-warn">未使用</span>}
        </div>
        <div className="asset-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(snippet)
                .then(() => toast('已複製 Markdown，貼到章節裡即可', 'success'))
            }
            title={snippet}
          >
            複製 Markdown
          </button>
          <TrashButton book={book} file={file} folder="assets" />
        </div>
      </div>
    </li>
  );
}

function TrashButton({
  book,
  file,
  folder,
}: {
  book: string;
  file: FileEntry;
  folder: FileFolder;
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => {
        if (!window.confirm(`把 ${file.path} 移到 .mosage/trash？`)) return;
        void api.trashFile(book, folder, file.name).catch(toastError);
      }}
    >
      移除
    </button>
  );
}

export function Files({ book }: { book: BookSummary }) {
  const { data } = useLive(
    () => api.files(book.id),
    book.id,
    (e) => (e.type === 'assets' || e.type === 'book') && e.book === book.id,
  );
  return (
    <main className="files-page">
      <p className="muted">
        素材都是 <code>books/{book.id}/</code> 裡的一般檔案：直接複製進資料夾也可以。 AI
        撰寫時會參考 <code>notes/</code>；圖片放在 <code>assets/</code>，在章節中用
        <code>![圖說](../assets/檔名.png)</code> 插入。
      </p>
      <div className="files-grid">
        <section>
          <div className="section-head">
            <h2>圖片</h2>
            <span className="muted small">assets/</span>
          </div>
          <DropZone book={book.id} folder="assets" label="加入圖片" accept="image/*" />
          <ul className="assets">
            {data?.assets.map((f) => (
              <AssetCard key={f.path} book={book.id} file={f} />
            ))}
          </ul>
          {data && data.assets.length === 0 && <p className="muted small">還沒有圖片。</p>}
        </section>
        <section>
          <div className="section-head">
            <h2>參考資料</h2>
            <span className="muted small">notes/ · 不會匯出</span>
          </div>
          <DropZone book={book.id} folder="notes" label="加入參考資料" />
          <ul className="notes-list">
            {data?.notes.map((f) => (
              <li key={f.path}>
                <a
                  href={`/files/books/${encodeURIComponent(book.id)}/${f.path.split('/').map(encodeURIComponent).join('/')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.name}
                </a>
                <span className="muted small">
                  {formatBytes(f.size)} · {relativeTime(f.updatedAt)}
                </span>
                <TrashButton book={book.id} file={f} folder="notes" />
              </li>
            ))}
          </ul>
          <p className="muted small">
            PDF、Word、文字檔都可以放。要讓 AI 讀得到內容，純文字或 Markdown 最好。
          </p>
        </section>
      </div>
    </main>
  );
}
