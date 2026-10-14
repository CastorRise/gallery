import type { Library, Photo } from '../../../../packages/shared/src/index.ts';
import { Field, Status } from '../components/Fields';
import { large, thumb } from '../helpers';
import type { Setter } from '../types';

interface Props {
  data: Library;
  busy: boolean;
  setEditing: Setter<string | undefined>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  progress: number;
  visible: Photo[];
  search: string;
  setSearch: Setter<string>;
  status: string;
  setStatus: Setter<string>;
  category: string;
  setCategory: Setter<string>;
  selected: string[];
  setSelected: Setter<string[]>;
  batch: (patch: Partial<Photo>) => void;
  archive: () => Promise<void>;
  photo: Photo | undefined;
  editing: string | undefined;
  drag: string;
  setDrag: Setter<string>;
  reorderPhoto: (source: string, target: string) => void;
  editPhoto: (id: string, patch: Partial<Photo>) => void;
}
export default function LibraryPage({
  data,
  busy,
  setEditing,
  importFiles,
  progress,
  visible,
  search,
  setSearch,
  status,
  setStatus,
  category,
  setCategory,
  selected,
  setSelected,
  batch,
  archive,
  photo,
  editing,
  drag,
  setDrag,
  reorderPhoto,
  editPhoto,
}: Props) {
  return (
    <>
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) importFiles(e.dataTransfer.files);
        }}
      >
        <span className="upload-icon">＋</span>
        <strong>把照片拖到这里，或选择文件</strong>
        <span>
          JPEG / PNG / WebP / HEIC（环境支持时） · 每张最大 80 MB ·
          原图仅保存在本机
        </span>
        <input
          aria-label="导入照片"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.heic"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) importFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {progress > 0 && (
        <div className="progress">
          <progress max="100" value={progress} />
          <span>{progress}% 已上传；服务端随后处理图片</span>
        </div>
      )}
      <div className="toolbar">
        <input
          aria-label="搜索照片"
          placeholder="搜索作品或地点…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="按状态筛选"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全部状态</option>
          <option value="published">已公开</option>
          <option value="draft">草稿</option>
          <option value="archived">归档</option>
        </select>
        <select
          aria-label="按分类筛选"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">全部分类</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button onClick={() => setSelected(visible.map((p) => p.id))}>
          全选结果
        </button>
      </div>
      {selected.length > 0 && (
        <div className="batch-bar">
          <span>已选 {selected.length} 张</span>
          <select
            aria-label="批量修改分类"
            value=""
            onChange={(e) => {
              if (e.target.value) batch({ categoryId: e.target.value });
            }}
          >
            <option value="">修改分类…</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              batch({
                status: 'published',
                publishedAt: new Date().toISOString(),
              })
            }
          >
            设为公开
          </button>
          <button onClick={() => batch({ status: 'draft' })}>设为草稿</button>
          <button onClick={() => batch({ featured: true })}>设为精选</button>
          <button onClick={() => batch({ featured: false })}>取消精选</button>
          <button className="danger" onClick={archive}>
            归档作品
          </button>
          <button onClick={() => setSelected([])}>取消选择</button>
        </div>
      )}
      <div className="library-layout">
        <div className="library-grid">
          {visible.map((p, i) => (
            <article
              key={p.id}
              className={`library-card ${p.id === editing ? 'active' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                reorderPhoto(drag, p.id);
                setDrag('');
              }}
            >
              <div className="library-image">
                <img
                  src={thumb(p)}
                  alt={p.title}
                  draggable
                  onDragStart={() => setDrag(p.id)}
                  onClick={() => setEditing(p.id)}
                />
                <input
                  aria-label={`选择 ${p.title}`}
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, p.id]
                        : selected.filter((id) => id !== p.id),
                    )
                  }
                />
                <span className={`badge ${p.status}`}>{p.status}</span>
              </div>
              <button className="photo-title" onClick={() => setEditing(p.id)}>
                {p.title}
              </button>
              <div className="card-bottom">
                <span>
                  {p.width} × {p.height}
                  {p.featured ? ' · ★' : ''}
                </span>
                <div>
                  <button
                    aria-label={`向前移动 ${p.title}`}
                    disabled={i === 0}
                    onClick={() => reorderPhoto(p.id, visible[i - 1].id)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`向后移动 ${p.title}`}
                    disabled={i === visible.length - 1}
                    onClick={() => reorderPhoto(p.id, visible[i + 1].id)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {photo && (
          <aside className="photo-editor panel">
            <div className="editor-heading">
              <h2>作品信息</h2>
              <button
                aria-label="关闭作品编辑"
                onClick={() => setEditing(undefined)}
              >
                ×
              </button>
            </div>
            <img src={large(photo)} alt={photo.title} />
            <Field label="标题">
              <input
                value={photo.title}
                onChange={(e) => editPhoto(photo.id, { title: e.target.value })}
              />
            </Field>
            <Field label="描述">
              <textarea
                value={photo.description}
                onChange={(e) =>
                  editPhoto(photo.id, {
                    description: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Alt 文本">
              <input
                value={photo.alt}
                onChange={(e) => editPhoto(photo.id, { alt: e.target.value })}
              />
            </Field>
            <Field label="分类">
              <select
                value={photo.categoryId}
                onChange={(e) =>
                  editPhoto(photo.id, {
                    categoryId: e.target.value,
                  })
                }
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="拍摄日期">
              <input
                value={photo.takenAt}
                placeholder="YYYY-MM-DD"
                onChange={(e) =>
                  editPhoto(photo.id, { takenAt: e.target.value })
                }
              />
            </Field>
            <Field label="公开状态">
              <Status
                value={photo.status}
                onChange={(status) =>
                  editPhoto(photo.id, {
                    status,
                    ...(status === 'published' && !photo.publishedAt
                      ? { publishedAt: new Date().toISOString() }
                      : {}),
                  })
                }
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={photo.featured}
                onChange={(e) =>
                  editPhoto(photo.id, {
                    featured: e.target.checked,
                  })
                }
              />
              精选作品
            </label>
            <h3>地点与隐私</h3>
            <Field label="公开范围">
              <select
                value={photo.location.privacy}
                onChange={(e) =>
                  editPhoto(photo.id, {
                    location: {
                      ...photo.location,
                      privacy: e.target.value as Photo['location']['privacy'],
                      confirmPrecise: false,
                    },
                  })
                }
              >
                <option value="hidden">不公开地点</option>
                <option value="city">仅公开城市</option>
                <option value="approximate">
                  公开近似位置（坐标取整至 0.01°）
                </option>
                <option value="precise">公开精确位置</option>
              </select>
            </Field>
            <Field label="城市">
              <input
                value={photo.location.city}
                onChange={(e) =>
                  editPhoto(photo.id, {
                    location: {
                      ...photo.location,
                      city: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="地点名称">
              <input
                value={photo.location.label}
                onChange={(e) =>
                  editPhoto(photo.id, {
                    location: {
                      ...photo.location,
                      label: e.target.value,
                    },
                  })
                }
              />
            </Field>
            {photo.location.privacy === 'city' && (
              <>
                <p className="help">
                  城市坐标用于地图中心，公开时取整至 0.1°。不要填写住宅位置。
                </p>
                {(['cityLatitude', 'cityLongitude'] as const).map((key, i) => (
                  <Field key={key} label={i ? '城市中心经度' : '城市中心纬度'}>
                    <input
                      type="number"
                      step="any"
                      value={photo.location[key] ?? ''}
                      onChange={(e) =>
                        editPhoto(photo.id, {
                          location: {
                            ...photo.location,
                            [key]:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </>
            )}
            {['approximate', 'precise'].includes(photo.location.privacy) && (
              <>
                {(['latitude', 'longitude'] as const).map((key, i) => (
                  <Field key={key} label={i ? '经度' : '纬度'}>
                    <input
                      type="number"
                      step="any"
                      value={photo.location[key] ?? ''}
                      onChange={(e) =>
                        editPhoto(photo.id, {
                          location: {
                            ...photo.location,
                            [key]:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            confirmPrecise: false,
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </>
            )}
            {photo.location.privacy === 'precise' && (
              <label className="check privacy-confirm">
                <input
                  type="checkbox"
                  checked={photo.location.confirmPrecise}
                  onChange={(e) =>
                    editPhoto(photo.id, {
                      location: {
                        ...photo.location,
                        confirmPrecise: e.target.checked,
                      },
                    })
                  }
                />
                我主动确认在公开网站显示精确坐标
              </label>
            )}
            <h3>EXIF · 从原图读取</h3>
            {Object.keys(photo.exif).length ? (
              <dl className="exif">
                {Object.entries(photo.exif).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="help">原文件未包含可读取的拍摄参数。</p>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
