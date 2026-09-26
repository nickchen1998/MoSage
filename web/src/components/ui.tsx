import { type ReactNode, useEffect, useState } from 'react';

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'modal modal-wide' : 'modal'} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="關閉">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function CopyText({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-text"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      title="複製"
    >
      <code>{label ?? text}</code>
      <span className="copy-state">{copied ? '已複製' : '複製'}</span>
    </button>
  );
}

/** Click-to-edit single line / multi line text. */
export function EditableText({
  value,
  placeholder,
  onSave,
  multiline,
  className,
}: {
  value: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void> | void;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = async () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) await onSave(draft.trim());
  };

  if (!editing) {
    return (
      <button
        type="button"
        className={`editable ${className ?? ''} ${value ? '' : 'is-empty'}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }}
        title="點一下編輯"
      >
        {value || placeholder}
      </button>
    );
  }
  const common = {
    className: `editable-input ${className ?? ''}`,
    value: draft,
    autoFocus: true,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: () => void commit(),
    onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  };
  return multiline ? (
    <textarea
      {...common}
      rows={3}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void commit();
      }}
    />
  ) : (
    <input
      {...common}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setEditing(false);
        if (e.key === 'Enter') void commit();
      }}
    />
  );
}
