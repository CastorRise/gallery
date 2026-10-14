import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  Collection,
  Journal,
  Library,
  Photo,
} from '../../../packages/shared/src/index.ts';
import { api, csrfToken, initSession } from './api';
import { thumb } from './helpers';
import CategoriesPage from './pages/CategoriesPage';
import CollectionsPage from './pages/CollectionsPage';
import DashboardPage from './pages/DashboardPage';
import JournalPage from './pages/JournalPage';
import LibraryPage from './pages/LibraryPage';
import PublishPage from './pages/PublishPage';
import SettingsPage from './pages/SettingsPage';
import './style.css';
import type { Dashboard, Page } from './types';
function App() {
  const [page, setPage] = useState<Page>('Dashboard');
  const [data, setData] = useState<Library>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [collectionId, setCollectionId] = useState<string>();
  const [journalId, setJournalId] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [plan, setPlan] = useState<any>();
  const [confirmation, setConfirmation] = useState('');
  const [backups, setBackups] = useState<
    { id: string; createdAt: string; photos: number }[]
  >([]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    run(async () => {
      await initSession();
      setData(await api<Library>('library'));
    });
  }, []);
  useEffect(() => {
    if (data)
      api<Dashboard>('dashboard')
        .then(setDashboard)
        .catch(() => {});
  }, [page, data?.revision]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(next: Library) {
    setData(next);
    setDirty(true);
    setPlan(undefined);
  }
  async function persist(next = data!) {
    const saved = await api<Library>('library', next, 'PUT');
    setData(saved);
    setDirty(false);
    return saved;
  }
  function editPhoto(id: string, patch: Partial<Photo>) {
    change({
      ...data!,
      photos: data!.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }
  function reorderPhoto(source: string, target: string) {
    const photos = [...data!.photos].sort((a, b) => a.order - b.order);
    const a = photos.findIndex((p) => p.id === source),
      b = photos.findIndex((p) => p.id === target);
    if (a < 0 || b < 0) return;
    const [item] = photos.splice(a, 1);
    photos.splice(b, 0, item);
    change({ ...data!, photos: photos.map((p, order) => ({ ...p, order })) });
  }
  async function importFiles(files: FileList | File[]) {
    await run(async () => {
      if (dirty) await persist();
      const all = Array.from(files);
      setProgress(0);
      let count = 0;
      const failures: string[] = [];
      for (const file of all) {
        const form = new FormData();
        form.append('photos', file);
        const result = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/import');
          xhr.setRequestHeader('X-Gallery-CSRF', csrfToken());
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setProgress(
                Math.round(((count + e.loaded / e.total) / all.length) * 100),
              );
          };
          xhr.onload = () => {
            try {
              const json = JSON.parse(xhr.responseText);
              xhr.status < 400 ? resolve(json) : reject(Error(json.error));
            } catch {
              reject(Error('导入响应无效'));
            }
          };
          xhr.onerror = () => reject(Error('本地连接失败'));
          xhr.send(form);
        });
        setData(result.library);
        failures.push(
          ...result.errors.map((e: any) => `${e.name}: ${e.message}`),
        );
        count++;
        setProgress(Math.round((count / all.length) * 100));
      }
      setDirty(false);
      setNotice(`已处理 ${all.length} 个文件，${failures.length} 个失败`);
      if (failures.length) setError(failures.join('\n'));
    });
  }
  async function archive() {
    if (
      !selected.length ||
      !window.confirm(
        `确认将 ${selected.length} 张作品移至归档？原始照片将保留。`,
      )
    )
      return;
    await run(async () => {
      const current = dirty ? await persist() : data!;
      setData(
        await api<Library>('archive', {
          ids: selected,
          revision: current.revision,
          confirm: true,
        }),
      );
      setSelected([]);
      setEditing(undefined);
      setDirty(false);
      setNotice('作品已归档，原始照片保留');
    });
  }
  function batch(patch: Partial<Photo>) {
    change({
      ...data!,
      photos: data!.photos.map((p) =>
        selected.includes(p.id) ? { ...p, ...patch } : p,
      ),
    });
  }
  function updateCollection(patch: Partial<Collection>) {
    change({
      ...data!,
      collections: data!.collections.map((c) =>
        c.id === collectionId ? { ...c, ...patch } : c,
      ),
    });
  }
  function updateJournal(patch: Partial<Journal>) {
    change({
      ...data!,
      journals: data!.journals.map((j) =>
        j.id === journalId ? { ...j, ...patch } : j,
      ),
    });
  }
  const pages: Page[] = [
    'Dashboard',
    'Library',
    'Collections',
    'Journal',
    'Categories',
    'Settings',
    'Publish',
  ];
  const photo = data?.photos.find((p) => p.id === editing);
  const collection = data?.collections.find((c) => c.id === collectionId);
  const journal = data?.journals.find((j) => j.id === journalId);
  const visible =
    data?.photos
      .filter(
        (p) =>
          (status === 'all' || p.status === status) &&
          (!category || p.categoryId === category) &&
          `${p.title} ${p.description} ${p.location.city}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((a, b) => a.order - b.order) ?? [];
  const selector = (
    ids: string[],
    onChange: (ids: string[]) => void,
    max?: number,
  ) => (
    <div className="photo-selector">
      {data?.photos
        .filter((p) => p.status !== 'archived')
        .map((p) => (
          <label key={p.id} className={ids.includes(p.id) ? 'checked' : ''}>
            <input
              type="checkbox"
              checked={ids.includes(p.id)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...ids, p.id]
                  : ids.filter((id) => id !== p.id);
                if (max && next.length > max) {
                  setError(`此模块最多选择 ${max} 张照片`);
                  return;
                }
                onChange(next);
              }}
            />
            <img src={thumb(p)} alt={p.title} />
            <span>{p.title}</span>
          </label>
        ))}
    </div>
  );
  const coverSelect = (
    value: string | undefined,
    onChange: (id: string | undefined) => void,
    ids?: string[],
  ) => (
    <select
      aria-label="封面照片"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">无封面</option>
      {data?.photos
        .filter((p) => p.status !== 'archived' && (!ids || ids.includes(p.id)))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
    </select>
  );
  return (
    <div className="studio">
      <aside className="sidebar">
        <a className="brand" href="/">
          CASTORRISE<span>LOCAL STUDIO</span>
        </a>
        <div className="local-indicator">
          <i /> LOCAL ONLY
        </div>
        <nav aria-label="后台导航">
          {pages.map((p, i) => (
            <button
              key={p}
              onClick={() => {
                setPage(p);
                setError('');
              }}
              aria-label={p}
              aria-current={page === p ? 'page' : undefined}
            >
              <span>0{i + 1}</span>
              {p}
            </button>
          ))}
        </nav>
        <p className="sidebar-note">
          Your photographs.
          <br />
          Your own space.
        </p>
        <a
          className="preview-link"
          href="http://127.0.0.1:4321/gallery/"
          target="_blank"
          rel="noreferrer"
        >
          打开公开站预览 ↗
        </a>
      </aside>
      <div className="workspace">
        <header className="studio-header">
          <div>
            <span>CASTORRISE / </span>
            {page}
          </div>
          <div>
            <span className="save-state">
              {dirty ? '有未保存修改' : '已保存至本机'}
            </span>
            <button
              className="primary"
              disabled={busy || !data || !dirty}
              onClick={() =>
                run(async () => {
                  await persist();
                  setNotice('修改已保存，自动备份已创建');
                })
              }
            >
              {busy ? '处理中…' : '保存修改'}
            </button>
          </div>
        </header>
        <main className="studio-main">
          <div className="page-title">
            <div>
              <p className="eyebrow">YOUR PHOTOGRAPHIC ARCHIVE</p>
              <h1>{page}</h1>
            </div>
            <span className="revision">REV {data?.revision ?? '—'}</span>
          </div>
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {!data ? (
            <p>正在读取本地图库…</p>
          ) : (
            <fieldset className="page-content" disabled={busy}>
              {page === 'Dashboard' && (
                <DashboardPage
                  data={data}
                  dashboard={dashboard}
                  setPage={setPage}
                  setEditing={setEditing}
                />
              )}
              {page === 'Library' && (
                <LibraryPage
                  data={data}
                  busy={busy}
                  setEditing={setEditing}
                  importFiles={importFiles}
                  progress={progress}
                  visible={visible}
                  search={search}
                  setSearch={setSearch}
                  status={status}
                  setStatus={setStatus}
                  category={category}
                  setCategory={setCategory}
                  selected={selected}
                  setSelected={setSelected}
                  batch={batch}
                  archive={archive}
                  photo={photo}
                  editing={editing}
                  drag={drag}
                  setDrag={setDrag}
                  reorderPhoto={reorderPhoto}
                  editPhoto={editPhoto}
                />
              )}
              {page === 'Collections' && (
                <CollectionsPage
                  data={data}
                  drag={drag}
                  setDrag={setDrag}
                  change={change}
                  setCollectionId={setCollectionId}
                  collectionId={collectionId}
                  collection={collection}
                  updateCollection={updateCollection}
                  selector={selector}
                  coverSelect={coverSelect}
                />
              )}
              {page === 'Journal' && (
                <JournalPage
                  data={data}
                  drag={drag}
                  setDrag={setDrag}
                  change={change}
                  selector={selector}
                  coverSelect={coverSelect}
                  journalId={journalId}
                  setJournalId={setJournalId}
                  journal={journal}
                  updateJournal={updateJournal}
                />
              )}
              {page === 'Categories' && (
                <CategoriesPage data={data} change={change} />
              )}
              {page === 'Settings' && (
                <SettingsPage
                  data={data}
                  change={change}
                  coverSelect={coverSelect}
                  run={run}
                  dirty={dirty}
                  persist={persist}
                  setBackups={setBackups}
                  setNotice={setNotice}
                  backups={backups}
                  setData={setData}
                  setDirty={setDirty}
                />
              )}
              {page === 'Publish' && (
                <PublishPage
                  run={run}
                  dirty={dirty}
                  persist={persist}
                  setNotice={setNotice}
                  plan={plan}
                  setPlan={setPlan}
                  confirmation={confirmation}
                  setConfirmation={setConfirmation}
                />
              )}
            </fieldset>
          )}
        </main>
        <footer className="studio-footer">
          CASTORRISE LOCAL STUDIO <span>PRIVATE DATA STAYS ON THIS MAC</span>
        </footer>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
