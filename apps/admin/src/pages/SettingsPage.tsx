import React from 'react';
import type { Library } from '../../../../packages/shared/src/index.ts';
import { api } from '../api';
import { Field } from '../components/Fields';
import type { Backup, Setter } from '../types';

interface Props {
  data: Library;
  change: (data: Library) => void;
  coverSelect: (
    value: string | undefined,
    onChange: (id: string | undefined) => void,
    ids?: string[],
  ) => React.ReactNode;
  run: (fn: () => Promise<void>) => Promise<void>;
  dirty: boolean;
  persist: (next?: Library) => Promise<Library>;
  setBackups: Setter<Backup[]>;
  setNotice: Setter<string>;
  backups: Backup[];
  setData: Setter<Library | undefined>;
  setDirty: Setter<boolean>;
}
export default function SettingsPage({
  data,
  change,
  coverSelect,
  run,
  dirty,
  persist,
  setBackups,
  setNotice,
  backups,
  setData,
  setDirty,
}: Props) {
  return (
    <div className="split-editor">
      <section className="panel">
        <h2>网站信息</h2>
        {(['name', 'manifesto', 'bio', 'philosophy', 'email'] as const).map(
          (key, i) => (
            <Field
              key={key}
              label={
                ['网站名称', '摄影宣言', '摄影师介绍', '摄影理念', '联系邮箱'][
                  i
                ]
              }
            >
              {['bio', 'philosophy'].includes(key) ? (
                <textarea
                  value={data.settings[key]}
                  onChange={(e) =>
                    change({
                      ...data,
                      settings: {
                        ...data.settings,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              ) : (
                <input
                  value={data.settings[key]}
                  onChange={(e) =>
                    change({
                      ...data,
                      settings: {
                        ...data.settings,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              )}
            </Field>
          ),
        )}
        <Field label="首页封面">
          {coverSelect(data.settings.homeCoverId, (homeCoverId) =>
            change({
              ...data,
              settings: { ...data.settings, homeCoverId },
            }),
          )}
        </Field>
        <Field label="设备 · 每行一项">
          <textarea
            value={data.settings.equipment.join('\n')}
            onChange={(e) =>
              change({
                ...data,
                settings: {
                  ...data.settings,
                  equipment: e.target.value.split('\n'),
                },
              })
            }
          />
        </Field>
      </section>
      <section className="panel">
        <h2>备份与恢复</h2>
        <p className="help">
          每次保存会自动备份元数据。原始图片和处理图片保留在本机。完整导出包包含原图，请自行妥善保管。
        </p>
        <div className="backup-actions">
          <button
            onClick={() =>
              run(async () => {
                if (dirty) await persist();
                await api('backups', {});
                setBackups(await api<Backup[]>('backups'));
                setNotice('本地备份已创建');
              })
            }
          >
            创建备份
          </button>
          <button
            onClick={() =>
              run(async () => {
                setBackups(await api<Backup[]>('backups'));
              })
            }
          >
            查看备份
          </button>
          <button
            onClick={() =>
              run(async () => {
                if (dirty) await persist();
                const result = await api<{ url: string }>('export', {});
                window.location.assign(result.url);
                setNotice('完整备份包已生成，正在下载');
              })
            }
          >
            导出完整备份
          </button>
        </div>
        <div className="backup-list">
          {backups.map((b) => (
            <div key={b.id}>
              <span>
                {b.createdAt.slice(0, 19)}
                <small>{b.photos} 张照片</small>
              </span>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      '确认恢复此备份？当前元数据会先自动备份，原图保留。',
                    )
                  )
                    run(async () => {
                      setData(
                        await api<Library>('restore', {
                          id: b.id,
                          confirm: true,
                        }),
                      );
                      setDirty(false);
                      setNotice('备份已恢复');
                    });
                }}
              >
                恢复
              </button>
            </div>
          ))}
        </div>
        <h3>运行边界</h3>
        <p className="help">
          后台仅绑定 127.0.0.1。公开站没有管理接口。GitHub 认证由本机 gh
          处理，不在浏览器存储 Token。
        </p>
      </section>
    </div>
  );
}
