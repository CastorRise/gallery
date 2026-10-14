# CastorRise Gallery

独立的摄影作品网站与 macOS 本地管理工作室。公开站目标地址为 **https://castorrise.github.io/gallery/**，仓库为 **CastorRise/gallery**。公开站使用暗色摄影画廊设计，所有照片按原始比例展示。后台只在本机运行。

现有个人网站和摄影页面只作为初次照片与说明的读取来源，不修改任何原站文件或部署配置。本项目没有公网后台、付费服务器、在线数据库或硬编码凭据。

## 架构与目录

```text
apps/web/                 Astro 静态站：Home / Gallery / Photos / Collections / Map / Journal / About
apps/admin/               React + Vite 管理界面、Express 本地 API
packages/shared/          TypeScript 类型、Zod 校验、隐私投影、schema 迁移
packages/image-processing/ Sharp、ExifReader，方向与 ICC 处理
content/gallery.json      可提交的公开内容快照（仅已发布条目）
public/images/            可提交的 WebP 衍生图
scripts/                  数据验证、公开资源生成、发布、构建审计
.local/                   本机图库，Git 忽略；绝不能上传
.github/workflows/        只部署公开站的 GitHub Actions
```

样式采用原生 CSS 变量与组件样式，避免为已有轻量布局引入额外框架。公开站交互使用少量 TypeScript；Leaflet 只在地图页加载。字体 Inter 本地托管，无远程字体请求。故事使用结构化 JSON 文本模块，不执行用户 HTML 或 MDX。

## 环境与安装

macOS、Node.js >=22.12（建议 Node 24 LTS）、npm、Git。远程发布另需已登录的 GitHub CLI；`gh auth status` 检查登录。本地管理不需要 GitHub Token。

```sh
cd gallery
npm ci
```

不要在现有个人网站目录中执行本项目命令。仓库中的 `package-lock.json` 固定依赖。

## 启动公开网站

```sh
npm run dev
```

访问 http://127.0.0.1:4321/gallery/ 。开发服务器读取上一次公开快照；后台编辑后的内容需执行“构建与预览变更”或 `npm run build` 才会更新。

生产预览：

```sh
npm run build
npm run preview
```

`npm run build` 从本地图库生成隐私过滤后的内容，再构建静态站。仅构建已提交的公开快照用 `npm run build:web`；这是 CI 使用的命令。

## 启动本地后台

```sh
npm run admin
```

访问 http://127.0.0.1:4173 。命令先构建 React 界面，再启动单一 Node 服务。开发模式用 `npm run admin:dev`。需要更换端口时：`GALLERY_ADMIN_PORT=4175 npm run admin`。

服务只监听 `127.0.0.1`，校验 Host、Origin、会话 CSRF；不开放跨域访问。前端不保存认证 Token。后台生产页面使用 CSP。公开网站不访问本地 API。

## 导入与编辑照片

1. Library 中拖入照片或使用文件选择器，可以一次选择多张；浏览器逐张上传并显示进度，服务端逐张处理。
2. 支持 JPEG、PNG、WebP；HEIC 取决于 Sharp/libvips 是否具备 HEVC 解码能力。已验证本机 Sharp 缺少 HEVC 解码器；此环境会明确显示错误；RAW 无可靠解码支持时拒绝，不静默失败。
3. 单张最大 80 MB，解码上限 1 亿像素；动画、多页图片拒绝。文件内容由解码器验证，不靠扩展名判断。
4. 原图保存到 `.local/originals`，生成 480 / 960 / 1600 / 2400px WebP（按原图尺寸选择，绝不放大；小图保留原尺寸）。方向自动纠正，ICC-aware 转换至 sRGB 并嵌入配置，不增加饱和度、对比度或锐化。公开衍生图移除 EXIF/XMP，拍摄参数另存为允许公开的字段。
5. 新导入默认 Draft、隐藏地点。点击照片编辑标题、描述、Alt、分类、日期、公开状态、精选与地点；顶部“保存修改”持久化到本机。
6. 可按状态、分类、文字筛选，批量设置分类、状态、精选；拖拽图片或使用箭头排序。
7. “归档作品”要求确认，原始照片保留；从 Archived 状态可恢复。归档时会移除专题和故事中的引用，首页封面必要时换成其他公开作品。

相机、镜头、焦距、光圈、快门、ISO、原始拍摄日期只显示文件实际存在的 EXIF。初始来源照片可能已经移除参数，不补造。

## 地点隐私

- 不公开：城市、标签和坐标全部从公开数据移除。
- 仅城市：公开城市名称，可手动提供地图城市中心；公开时取整至 0.1°，不能将原图 GPS 自动当成城市中心。
- 近似位置：将所填拍摄坐标取整至 0.01°；标签是主动公开的文字，请自行选择合适的粒度。
- 精确位置：每次坐标变化后，必须重新勾选明确确认。

初始地图标记使用手动指定的粗略城市中心，不表示原始拍摄地点。公开 WebP 本身不含 GPS。地图底图会向 OpenStreetMap 请求公开瓦片；不发送原图、后台数据或隐藏 GPS。

## 专题、故事、分类与 About

Collections 支持创建、编辑、删除确认、封面、公开状态、照片选择、自定义顺序和专题排序。发布专题不可引用草稿或归档照片；请先公开照片或调整引用。

Journal 支持标题、副标题、封面、日期、地点及段落、引用、全宽图片、双图、多图组合、说明。拖拽或箭头调整模块顺序，右侧实时预览。文本按普通文字渲染，输入 `<script>` 只会显示文本。草稿故事不会进入公开构建；内容真实写好后再设为 Published。

Categories 可新增、重命名、排序、删除；被任何作品引用的分类须先调整作品分类，至少保留一个分类。

Settings 编辑网站名称、宣言、首页封面、介绍、理念、设备和邮箱。介绍默认留空，不虚构经历、奖项或联系方式。

## 本地发布与 GitHub Pages

后台 Publish 的“构建与预览变更”执行内容校验、图片存在与尺寸检查、GPS/元数据检查、凭据和路径模式扫描、公开快照生成、Astro 生产构建和构建隔离审计，显示照片/专题/故事的新增、修改、移除，以及分类、设置变化和 Git 状态。摘要以 origin/main 的公开快照为基线，首次未推送时显示全部新增；重复预览不会重置待发布数量。这一步不会推送。

远程发布需要先由用户确认创建独立仓库。首次由维护者在确认之后执行：

```sh
gh repo create CastorRise/gallery --public --source=. --remote=origin
```

不要加 `--push`，也不要对现有个人站操作。独立仓库发布分支是 `main`。在 **gallery 仓库**的 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。不更改 `CastorRise.github.io` 的设置。

后台重新预览，在明确看到摘要后输入 `PUBLISH CastorRise/gallery` 并点击确认，才创建提交、执行 `git push origin main`。发布计划锁定图库 revision 和工作区文件摘要；内容变化需重建预览。只接受经核对的 CastorRise/gallery HTTPS origin 与 main 分支。推送使用本机 Git/gh 认证，不使用浏览器 Token。

推送失败保留本地数据和提交，可重试；远程冲突需要手动处理，不 force、不自动覆盖。GitHub Actions 只构建/上传 `apps/web/dist`；不会构建后台、读取 `.local` 或上传原图。Push 成功不等于部署成功，请查看仓库 Actions / Pages。

Astro 固定 `site=https://castorrise.github.io`、`base=/gallery/`，内页和图片均带 base。照片详情生成独立静态路径，支持直接访问和刷新；有 canonical、OG、sitemap 和 robots。GitHub Pages 静态资源缓存由托管平台控制。

## 数据、备份与恢复

`.local/library.json` 为本机完整数据，schema v2。写入前做完整校验、自动创建 `.local/backups/<id>.json` 元数据快照，再用原子 rename 替换，revision 防止多标签页覆盖。v1→v2 迁移由 `packages/shared/src/index.ts` 明确处理；未知版本拒绝打开。后续迁移先完整备份，再增加明确迁移分支和测试。

自动备份是元数据快照，依赖 `.local/originals` 与 `.local/processed` 持续保留；不会复制原图来无限占用磁盘。Settings 中可手动备份、查看和确认恢复。恢复前再备份当前状态，校验图片引用。快照保留，不自动删原始照片或历史备份。

“导出完整备份”生成 `.local/exports/gallery-<timestamp>.tar.gz` 并下载，包含完整 metadata、originals、processed、backups。备份包不公开、不进 Git。建议将导出文件存到外置磁盘，包含私人照片，请自行保管。

新机器恢复完整包：先停止后台，备份当前 `.local`，再将导出包解压至一个**新空目录**，核对包内路径只包含 library.json / originals / processed / backups 后，以该目录运行：

```sh
GALLERY_DATA_DIR=/absolute/path/to/restored-data npm run admin
```

确认图库正确后可继续使用该目录。不要覆盖已有数据；服务不提供任意路径读写接口。公开 Git 仓库不具备恢复原图或草稿的能力。

## 测试与维护

```sh
npm run validate
npm run check
npm test
npm run build
npm run build -w @gallery/admin
npx playwright install chromium
npm run test:browser
npm run format
```

API/图片测试使用临时文件并清理；浏览器后台使用公开衍生图复制的独立测试图库，不触碰真实原图或草稿。浏览器测试结束后可删除 `.local/browser-fixture` 和 `test-results`（仅测试产物）。

无障碍：语义化标签、跳转链接、当前导航、焦点状态、dialog 焦点返回、方向键、ESC、触摸滑动、缩放、Alt、reduced-motion。性能：原比例与 width/height 避免布局偏移，srcset、懒加载、首屏高优先级、自托管字体、地图页独立加载。实际 Lighthouse 结果见 `docs/verification.md`；分数依赖测试设备和网络，不代表真实手机验收。

后续维护遵循 [AGENTS.md](AGENTS.md)。修改图片管线、隐私投影、发布或本地访问控制时，必须复测相应真实流程。升级依赖先检查兼容，再运行类型检查、API/图片测试和构建。

## 常见问题

- **图库看起来未更新**：编辑只修改本机图库；执行构建与预览才生成公开快照。
- **EXIF 空白**：来源照片可能已移除拍摄参数；界面隐藏缺失值。
- **HEIC 失败**：本机 Sharp 解码器缺少 HEVC；先用 macOS“预览”导出高质量 JPEG 再导入。不上传第三方转换网站。
- **刷新后会话失效**：后台重启会生成新 CSRF Token，刷新页面即可。
- **保存冲突**：另一标签页已修改 revision，刷新后重试；未保存内容可先复制保留。
- **无法推送**：检查 `gh auth status`、origin、main 分支及远程更新。不要使用 force push。
- **端口占用**：先关闭旧服务或指定 GALLERY_ADMIN_PORT；API 随端口同步校验 Origin。
- **首次克隆没有私有图库**：可直接 `build:web` 查看公开内容；启动后台导入自己的照片，或恢复完整备份。不要将公开快照误认为完整私有备份。
