import type { Library } from '../../../../packages/shared/src/index.ts';
import { thumb } from '../helpers';
import type { Dashboard, Page, Setter } from '../types';

interface Props {
  data: Library;
  dashboard: Dashboard | undefined;
  setPage: Setter<Page>;
  setEditing: Setter<string | undefined>;
}
export default function DashboardPage({
  data,
  dashboard,
  setPage,
  setEditing,
}: Props) {
  return (
    <>
      <div className="stats">
        {[
          ['作品总数', data.photos.length],
          [
            '已公开',
            data.photos.filter((p) => p.status === 'published').length,
          ],
          ['草稿', data.photos.filter((p) => p.status === 'draft').length],
          ['专题', data.collections.length],
          ['摄影故事', data.journals.length],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <h2>
            最近导入 <span>RECENT IMPORTS</span>
          </h2>
          <div className="recent-list">
            {data.photos
              .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 5)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPage('Library');
                    setEditing(p.id);
                  }}
                >
                  <img src={thumb(p)} alt="" />
                  <div>
                    <strong>{p.title}</strong>
                    <span>
                      {p.createdAt.slice(0, 10)} · {p.status}
                    </span>
                  </div>
                  <span>↗</span>
                </button>
              ))}
          </div>
        </section>
        <section className="panel">
          <h2>工作区状态</h2>
          <dl className="status-list">
            <dt>网站构建</dt>
            <dd>
              {dashboard?.build?.ok
                ? `成功 · ${dashboard.build.builtAt}`
                : dashboard?.build?.builtAt
                  ? '最近构建失败 · ' + dashboard.build.builtAt
                  : '尚未在后台构建'}
            </dd>
            <dt>Git 状态</dt>
            <dd>
              <pre>{dashboard?.git || '工作区干净'}</pre>
            </dd>
          </dl>
          <h2>最近公开</h2>
          {data.photos
            .filter((p) => p.status === 'published')
            .toSorted((a, b) =>
              (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
            )
            .slice(0, 4)
            .map((p) => (
              <p className="recent-published" key={p.id}>
                {p.title}
                <span>{p.publishedAt?.slice(0, 10)}</span>
              </p>
            ))}
        </section>
      </div>
    </>
  );
}
