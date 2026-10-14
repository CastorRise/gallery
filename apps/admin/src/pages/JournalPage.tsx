import React from 'react';
import type {
  Block,
  Journal,
  Library,
} from '../../../../packages/shared/src/index.ts';
import { Field, Status } from '../components/Fields';
import { large, move, thumb, uid } from '../helpers';
import type { Setter } from '../types';

interface Props {
  data: Library;
  drag: string;
  setDrag: Setter<string>;
  change: (data: Library) => void;
  selector: (
    ids: string[],
    onChange: (ids: string[]) => void,
    max?: number,
  ) => React.ReactNode;
  coverSelect: (
    value: string | undefined,
    onChange: (id: string | undefined) => void,
    ids?: string[],
  ) => React.ReactNode;
  journalId: string | undefined;
  setJournalId: Setter<string | undefined>;
  journal: Journal | undefined;
  updateJournal: (patch: Partial<Journal>) => void;
}
export default function JournalPage({
  data,
  drag,
  setDrag,
  change,
  selector,
  coverSelect,
  journalId,
  setJournalId,
  journal,
  updateJournal,
}: Props) {
  return (
    <>
      <div className="toolbar">
        <button
          className="primary"
          onClick={() => {
            const id = uid();
            change({
              ...data,
              journals: [
                ...data.journals,
                {
                  id,
                  title: '新摄影故事',
                  subtitle: '',
                  place: '',
                  date: new Date().toISOString().slice(0, 10),
                  status: 'draft',
                  blocks: [],
                },
              ],
            });
            setJournalId(id);
          }}
        >
          ＋ 新建故事
        </button>
        <select
          aria-label="选择故事"
          value={journalId ?? ''}
          onChange={(e) => setJournalId(e.target.value || undefined)}
        >
          <option value="">选择故事…</option>
          {data.journals.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title} · {j.status}
            </option>
          ))}
        </select>
        {journal && (
          <button
            className="danger"
            onClick={() => {
              if (window.confirm(`确认删除故事“${journal.title}”？`)) {
                change({
                  ...data,
                  journals: data.journals.filter((j) => j.id !== journal.id),
                });
                setJournalId(undefined);
              }
            }}
          >
            删除故事
          </button>
        )}
      </div>
      {journal ? (
        <div className="journal-editor">
          <section className="panel">
            <Field label="文章标题">
              <input
                value={journal.title}
                onChange={(e) => updateJournal({ title: e.target.value })}
              />
            </Field>
            <Field label="副标题">
              <input
                value={journal.subtitle}
                onChange={(e) => updateJournal({ subtitle: e.target.value })}
              />
            </Field>
            <div className="field-row">
              <Field label="日期">
                <input
                  type="date"
                  value={journal.date.slice(0, 10)}
                  onChange={(e) => updateJournal({ date: e.target.value })}
                />
              </Field>
              <Field label="地点">
                <input
                  value={journal.place}
                  onChange={(e) => updateJournal({ place: e.target.value })}
                />
              </Field>
            </div>
            <Field label="封面">
              {coverSelect(journal.coverId, (coverId) =>
                updateJournal({ coverId }),
              )}
            </Field>
            <Field label="公开状态">
              <Status
                value={journal.status}
                onChange={(status) => updateJournal({ status })}
              />
            </Field>
            <h3>内容模块 · 拖拽调整顺序</h3>
            {journal.blocks.map((b, i) => (
              <div
                className="block-editor"
                key={b.id}
                draggable
                onDragStart={() => setDrag(b.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = journal.blocks.findIndex((x) => x.id === drag);
                  if (from >= 0)
                    updateJournal({
                      blocks: move(journal.blocks, from, i),
                    });
                }}
              >
                <header>
                  <span>
                    {String(i + 1).padStart(2, '0')} / {b.type}
                  </span>
                  <div>
                    <button
                      aria-label={`模块 ${i + 1} 上移`}
                      disabled={i === 0}
                      onClick={() =>
                        updateJournal({
                          blocks: move(journal.blocks, i, i - 1),
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`模块 ${i + 1} 下移`}
                      disabled={i === journal.blocks.length - 1}
                      onClick={() =>
                        updateJournal({
                          blocks: move(journal.blocks, i, i + 1),
                        })
                      }
                    >
                      ↓
                    </button>
                    <button
                      aria-label={`删除模块 ${i + 1}`}
                      onClick={() => {
                        if (window.confirm('确认删除这个内容模块？'))
                          updateJournal({
                            blocks: journal.blocks.filter((x) => x.id !== b.id),
                          });
                      }}
                    >
                      ×
                    </button>
                  </div>
                </header>
                {['paragraph', 'quote'].includes(b.type) ? (
                  <textarea
                    aria-label={`模块 ${i + 1} 文字`}
                    value={b.text}
                    onChange={(e) =>
                      updateJournal({
                        blocks: journal.blocks.map((x) =>
                          x.id === b.id ? { ...x, text: e.target.value } : x,
                        ),
                      })
                    }
                  />
                ) : (
                  selector(
                    b.photoIds,
                    (photoIds) =>
                      updateJournal({
                        blocks: journal.blocks.map((x) =>
                          x.id === b.id ? { ...x, photoIds } : x,
                        ),
                      }),
                    b.type === 'image' ? 1 : b.type === 'pair' ? 2 : undefined,
                  )
                )}
                {b.type !== 'paragraph' && (
                  <input
                    aria-label={`模块 ${i + 1} 说明`}
                    placeholder="照片说明 / 引用来源"
                    value={b.caption}
                    onChange={(e) =>
                      updateJournal({
                        blocks: journal.blocks.map((x) =>
                          x.id === b.id ? { ...x, caption: e.target.value } : x,
                        ),
                      })
                    }
                  />
                )}
              </div>
            ))}
            <div className="add-blocks">
              {(
                [
                  'paragraph',
                  'quote',
                  'image',
                  'pair',
                  'grid',
                ] as Block['type'][]
              ).map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    updateJournal({
                      blocks: [
                        ...journal.blocks,
                        {
                          id: uid(),
                          type,
                          text: '',
                          photoIds: [],
                          caption: '',
                        },
                      ],
                    })
                  }
                >
                  ＋{' '}
                  {
                    {
                      paragraph: '段落',
                      quote: '引用',
                      image: '全宽图片',
                      pair: '双图并排',
                      grid: '多图组合',
                    }[type]
                  }
                </button>
              ))}
            </div>
          </section>
          <section className="panel journal-preview">
            <p className="eyebrow">LIVE PREVIEW / 实时预览</p>
            <p className="preview-meta">
              {journal.date} / {journal.place}
            </p>
            <h2>{journal.title}</h2>
            <p>{journal.subtitle}</p>
            {journal.coverId && (
              <img
                src={large(data.photos.find((p) => p.id === journal.coverId)!)}
                alt="故事封面"
              />
            )}
            {journal.blocks.map((b) => (
              <div key={b.id} className={`preview-block ${b.type}`}>
                {b.type === 'paragraph' ? (
                  <p>{b.text}</p>
                ) : b.type === 'quote' ? (
                  <blockquote>
                    {b.text}
                    <cite>{b.caption}</cite>
                  </blockquote>
                ) : (
                  <>
                    <div>
                      {b.photoIds.map((id) => {
                        const p = data.photos.find((p) => p.id === id);
                        return p && <img key={id} src={thumb(p)} alt={p.alt} />;
                      })}
                    </div>
                    <span>{b.caption}</span>
                  </>
                )}
              </div>
            ))}
          </section>
        </div>
      ) : (
        <p className="help">新建摄影故事后，可添加段落、引用和图片模块。</p>
      )}
    </>
  );
}
