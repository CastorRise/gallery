import type { Library } from '../../../../packages/shared/src/index.ts';
import { move, uid } from '../helpers';

interface Props {
  data: Library;
  change: (data: Library) => void;
}
export default function CategoriesPage({ data, change }: Props) {
  return (
    <section className="panel category-panel">
      <h2>分类管理</h2>
      <p className="help">分类由数据驱动。删除前需将其作品移动到其他分类。</p>
      {data.categories
        .toSorted((a, b) => a.order - b.order)
        .map((c, i, all) => (
          <div className="category-row" key={c.id}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <input
              aria-label={`分类名称 ${c.id}`}
              value={c.name}
              onChange={(e) =>
                change({
                  ...data,
                  categories: data.categories.map((x) =>
                    x.id === c.id ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <span>
              {data.photos.filter((p) => p.categoryId === c.id).length} 张
            </span>
            <button
              aria-label={`分类 ${c.name} 上移`}
              disabled={i === 0}
              onClick={() =>
                change({
                  ...data,
                  categories: move(all, i, i - 1).map((x, order) => ({
                    ...x,
                    order,
                  })),
                })
              }
            >
              ↑
            </button>
            <button
              aria-label={`分类 ${c.name} 下移`}
              disabled={i === all.length - 1}
              onClick={() =>
                change({
                  ...data,
                  categories: move(all, i, i + 1).map((x, order) => ({
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
              aria-label={`删除分类 ${c.name}`}
              disabled={
                data.categories.length < 2 ||
                data.photos.some((p) => p.categoryId === c.id)
              }
              onClick={() => {
                if (window.confirm(`确认删除分类 ${c.name}？`))
                  change({
                    ...data,
                    categories: data.categories.filter((x) => x.id !== c.id),
                  });
              }}
            >
              删除
            </button>
          </div>
        ))}
      <button
        className="primary"
        onClick={() =>
          change({
            ...data,
            categories: [
              ...data.categories,
              {
                id: uid(),
                name: '新分类',
                order: data.categories.length,
              },
            ],
          })
        }
      >
        ＋ 新建分类
      </button>
    </section>
  );
}
