import type { Library } from '../../../../packages/shared/src/index.ts';
import type { Plan } from '../../../../scripts/publication.ts';
import { api } from '../api';
import { Field } from '../components/Fields';
import type { Setter } from '../types';

interface Props {
  run: (fn: () => Promise<void>) => Promise<void>;
  dirty: boolean;
  persist: (next?: Library) => Promise<Library>;
  setNotice: Setter<string>;
  plan: Plan | undefined;
  setPlan: Setter<Plan | undefined>;
  confirmation: string;
  setConfirmation: Setter<string>;
}
export default function PublishPage({
  run,
  dirty,
  persist,
  setNotice,
  plan,
  setPlan,
  confirmation,
  setConfirmation,
}: Props) {
  return (
    <section className="panel publish-panel">
      <h2>发布到 CastorRise/gallery</h2>
      <p className="help">
        先验证内容、生成公开资源并执行生产构建。此步骤只在本机运行。检查变更摘要后，单独确认
        Git Commit 与 Push。
      </p>
      <button
        className="primary"
        onClick={() =>
          run(async () => {
            if (dirty) await persist();
            setPlan(await api<Plan>('publish/preview', {}));
            setConfirmation('');
            setNotice('内容校验与生产构建通过，请检查摘要');
          })
        }
      >
        构建与预览变更
      </button>
      {plan && (
        <>
          <div className="publish-summary">
            {(['photos', 'collections', 'journals'] as const).map((key, i) => (
              <div key={key}>
                <h3>{['照片', '专题', '摄影故事'][i]}</h3>
                <p>
                  新增 {plan.summary[key].added} · 修改{' '}
                  {plan.summary[key].modified} · 移除{' '}
                  {plan.summary[key].removed}
                </p>
              </div>
            ))}
            <p>
              网站设置：
              {plan.summary.settings ? '已修改' : '未修改'} · 分类：
              {plan.summary.categories ? '已修改' : '未修改'}
            </p>
          </div>
          <details>
            <summary>构建日志与 Git 状态</summary>
            <pre>
              {plan.log}
              {'\n'}
              {plan.git}
            </pre>
          </details>
          {!plan.pushAvailable ? (
            <p className="help remote-note">
              尚未创建或配置独立远程仓库。请先在当前 Codex 对话确认创建
              CastorRise/gallery，再配置 origin；本次构建结果可本地预览。
            </p>
          ) : (
            <>
              <Field label="输入 PUBLISH CastorRise/gallery 确认提交并推送">
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <button
                className="primary"
                disabled={confirmation !== 'PUBLISH CastorRise/gallery'}
                onClick={() =>
                  run(async () => {
                    const result = await api<{
                      sha: string;
                      log: string;
                    }>('publish/confirm', {
                      id: plan.id,
                      confirmation,
                    });
                    setPlan(undefined);
                    setNotice(
                      `已推送提交 ${result.sha}。GitHub Actions 部署结果请在仓库中确认。`,
                    );
                  })
                }
              >
                确认提交并推送
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
