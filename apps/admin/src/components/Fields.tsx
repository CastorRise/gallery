import React from 'react';
import type { Photo } from '../../../../packages/shared/src/index.ts';
export function Field({
  label,
  children,
}: React.PropsWithChildren<{ label: string }>) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Status({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: Photo['status']) => void;
}) {
  return (
    <select
      aria-label="公开状态"
      value={value}
      onChange={(e) => onChange(e.target.value as Photo['status'])}
    >
      <option value="draft">Draft · 草稿</option>
      <option value="published">Published · 公开</option>
      <option value="archived">Archived · 归档</option>
    </select>
  );
}
