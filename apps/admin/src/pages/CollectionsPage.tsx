import React from 'react';
import type {
  Collection,
  Library,
} from '../../../../packages/shared/src/index.ts';
import { Field, Status } from '../components/Fields';
import { move, uid } from '../helpers';
import type { Setter } from '../types';

interface Props {
  data: Library;
  drag: string;
  setDrag: Setter<string>;
  change: (data: Library) => void;
  setCollectionId: Setter<string | undefined>;
  collectionId: string | undefined;
  collection: Collection | undefined;
  updateCollection: (patch: Partial<Collection>) => void;
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
}
export default function CollectionsPage({
  data,
  drag,
  setDrag,
  change,
  setCollectionId,
  collectionId,
  collection,
  updateCollection,
  selector,
  coverSelect,
}: Props) {
  return (
    <div className="split-editor">
      <section className="panel entity-list">
        <button
          className="primary"
          onClick={() => {
            const id = uid();
            change({
              ...data,
              collections: [
                ...data.collections,
                {
                  id,
                  name: '新专题',
                  englishName: '',
                  description: '',
                  photoIds: [],
                  status: 'draft',
                  createdAt: new Date().toISOString(),
                  order: data.collections.length,
                },
              ],
            });
            setCollectionId(id);
          }}
        >
          ＋ 新建专题
        </button>
        {data.collections
          .toSorted((a, b) => a.order - b.order)
          .map((c, i, all) => (
            <div
              key={c.id}
              className={c.id === collectionId ? 'selected entity' : 'entity'}
              draggable
              onDragStart={() => setDrag(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = all.findIndex((x) => x.id === drag);
                if (from >= 0)
                  change({
                    ...data,
                    collections: move(all, from, i).map((x, order) => ({
                      ...x,
                      order,
                    })),
                  });
              }}
            >
              <button onClick={() => setCollectionId(c.id)}>
                <strong>{c.name}</strong>
                <span>
                  {c.photoIds.length} 张 · {c.status}
                </span>
              </button>
              <div className="entity-actions">
                <button
                  aria-label={`向上移动专题 ${c.name}`}
                  disabled={i === 0}
                  onClick={() =>
                    change({
                      ...data,
                      collections: move(all, i, i - 1).map((x, order) => ({
                        ...x,
                        order,
                      })),
                    })
                  }
                >
                  ↑
                </button>
                <button
                  aria-label={`向下移动专题 ${c.name}`}
                  disabled={i === all.length - 1}
                  onClick={() =>
                    change({
                      ...data,
                      collections: move(all, i, i + 1).map((x, order) => ({
                        ...x,
                        order,
                      })),
                    })
                  }
                >
                  ↓
                </button>
                <button
                  className="danger"
                  aria-label={`删除专题 ${c.name}`}
                  onClick={() => {
                    if (
                      window.confirm(`确认删除专题“${c.name}”？照片会保留。`)
                    ) {
                      change({
                        ...data,
                        collections: data.collections.filter(
                          (x) => x.id !== c.id,
                        ),
                      });
                      if (c.id === collectionId) setCollectionId(undefined);
                    }
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
      </section>
      <section className="panel">
        {collection ? (
          <>
            <h2>编辑专题</h2>
            <Field label="名称">
              <input
                value={collection.name}
                onChange={(e) => updateCollection({ name: e.target.value })}
              />
            </Field>
            <Field label="英文名称">
              <input
                value={collection.englishName}
                onChange={(e) =>
                  updateCollection({ englishName: e.target.value })
                }
              />
            </Field>
            <Field label="描述">
              <textarea
                value={collection.description}
                onChange={(e) =>
                  updateCollection({ description: e.target.value })
                }
              />
            </Field>
            <Field label="公开状态">
              <Status
                value={collection.status}
                onChange={(status) => updateCollection({ status })}
              />
            </Field>
            <Field label="封面">
              {coverSelect(
                collection.coverId,
                (coverId) => updateCollection({ coverId }),
                collection.photoIds,
              )}
            </Field>
            <h3>照片选择</h3>
            {selector(collection.photoIds, (photoIds) =>
              updateCollection({
                photoIds,
                coverId: photoIds.includes(collection.coverId ?? '')
                  ? collection.coverId
                  : photoIds[0],
              }),
            )}
            <h3>专题照片顺序</h3>
            {collection.photoIds.map((id, i) => (
              <div
                className="ordered-item"
                key={id}
                draggable
                onDragStart={() => setDrag(id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = collection.photoIds.indexOf(drag);
                  if (from >= 0)
                    updateCollection({
                      photoIds: move(collection.photoIds, from, i),
                    });
                }}
              >
                <span>{data.photos.find((p) => p.id === id)?.title}</span>
                <button
                  aria-label={`照片 ${i + 1} 上移`}
                  disabled={i === 0}
                  onClick={() =>
                    updateCollection({
                      photoIds: move(collection.photoIds, i, i - 1),
                    })
                  }
                >
                  ↑
                </button>
                <button
                  aria-label={`照片 ${i + 1} 下移`}
                  disabled={i === collection.photoIds.length - 1}
                  onClick={() =>
                    updateCollection({
                      photoIds: move(collection.photoIds, i, i + 1),
                    })
                  }
                >
                  ↓
                </button>
              </div>
            ))}
          </>
        ) : (
          <p className="help">选择或新建一个专题。</p>
        )}
      </section>
    </div>
  );
}
