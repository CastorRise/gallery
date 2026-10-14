# 实施阶段与边界

## Phase 1：公开核心

独立 npm Monorepo、统一暗色设计系统、首页、可搜索筛选/排序的 Gallery、14 个静态详情页面、保留宽高比的网格和全屏 dialog 浏览器。键盘、缩放、信息与所属专题、缓存复用、懒加载、手机滑动。

## Phase 2：本地管理与图片

React/Vite 工作室及 loopback Node API，真实 Dashboard、拖拽/批量文件选择、上传进度、EXIF、Sharp 变体、图片编辑、批量修改、归档确认、分类与排序。原图保留，默认草稿和隐藏地点。真实 JPEG/PNG/WebP、EXIF/GPS、Orientation、ICC、颜色与尺寸测试通过。

## Phase 3：专题、地图与故事

专题 CRUD、顺序与封面、城市/专题地图筛选、同位置聚合、结构化故事模块与实时预览、模块拖拽/箭头排序、About 设置。初始专题按已有作品整理；没有捏造作者的旅行故事、获奖记录或缺失 EXIF。Journal 从空状态开始，测试中的故事仅存在于隔离测试图库。

## Phase 4：发布、校验与备份

公开数据投影、文件/元数据检查、公开快照 schema 校验、凭据/路径模式扫描、生产构建和产物审计、发布摘要、单独的提交推送确认、失败重试。Git 错误场景在临时本地 bare 仓库中测试，覆盖失败后提交保留与 non-fast-forward 不覆盖；用户确认后，真实后台 Publish 流程已完成 GitHub 提交与推送。

自动元数据备份、完整 tar.gz 导出、备份选择与确认恢复、v1→v2 迁移。独立 GitHub Actions 工作流只上传公开站。

**远程阶段已完成：** 用户确认后创建 `CastorRise/gallery`，启用 Actions Pages；真实后台提交和推送成功，GitHub Actions 的 build/deploy 均成功，线上页面及交互已验证。具体证据见 `deployment.json`。

## Phase 5：质量与文档

TypeScript/Astro 检查、API/图片/隐私/Git 测试、桌面/手机尺寸浏览器流程、无障碍扫描、Lighthouse、README、维护 AGENTS 与验证记录。

测试工具对手机尺寸和触摸事件进行浏览器模拟，真实手机仍由用户验收。当前 HEIC 支持受本机解码器限制；失败明确提示改用 macOS“预览”导出 JPEG。RAW 拒绝。
