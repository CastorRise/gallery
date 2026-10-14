# 本地验证记录

验证日期：2026-10-14（Asia/Shanghai）。环境：macOS 26.6.2 / arm64，Node v24.20.0，npm 11.19.0，Git 2.50.1。本地验证阶段的远程操作仅限只读查询；用户随后确认继续远程发布，结果记录如下。

## 结果

- `npm run check`：TypeScript 和 Astro 检查通过，无错误、警告或提示。
- `npm test`：17 项通过。真实 JPEG/PNG/WebP、EXIF/GPS、Orientation、ICC、色值容差、尺寸与不放大；真实 REST/multipart 导入、编辑持久化、revision 冲突、备份、恢复、完整导出、软删除原图保留；Host/Origin/CSRF、路径边界、隐私投影、首次发布摘要。
- Git 测试：临时本地 bare 仓库，实际 commit/push；拒绝后提交保留、重试成功、远程更新造成 non-fast-forward 时不覆盖。错误场景测试没有向 GitHub 推送；后续实际发布由用户另行确认。
- 生产构建：14 个照片详情和全部公开主页面，共 24 页，53 张公开 WebP。构建审计确认没有原图、私有路径、隐藏坐标、本地 API 或后台代码。
- 自动浏览器：9 项通过，1 项手机重复后台流程跳过。桌面与 iPhone 13 尺寸的 Chromium，公开导航、筛选、详情刷新、dialog、方向键、ESC、缩放、信息、触摸滑动、专题、地图城市聚合与筛选、About；后台真实导入、编辑保存、分类、专题、故事模块、实时预览、安全文本渲染、公开故事静态页面及生产预览。后台完整流程在桌面执行，手机检查布局与焦点。
- Axe：首页、Gallery、About 无 critical / serious WCAG A/AA 问题。
- Lighthouse：本地生产首页，桌面及默认手机配置的 Performance / Accessibility / Best Practices / SEO 均为 **100 / 100 / 100 / 100**，LCP 1.6s，CLS 0。原始 JSON/HTML 与截图位于 `.local/qa/`。这是本机 Chromium 测量，不代替真机与线上测试。
- 现有个人网站：87 个已跟踪文件的 SHA-256 全部与开工前一致；Git 工作区状态保持原样。没有修改原站的文件、workflow、Git 配置或 Pages 设置。

## 内容与限制

14 张初始照片来自用户同意复制的现有摄影目录，原始说明逐字保留。来源照片中只有 5 张包含 DateTimeOriginal，其余拍摄参数未提供，不补造。地图为主动设置的粗略城市中心，不代表原图 GPS。Journal 尚无作者提交的真实故事，初始公开状态为空；测试文章均已清理。

HEIC 实际解码检查失败：当前 libvips 缺少 HEVC 解码插件（libde265）。导入会清晰报错；可用 macOS“预览”导出 JPEG 后导入。RAW 不支持，不静默处理。

## 实际远程发布

用户确认继续后，已创建公开仓库 [CastorRise/gallery](https://github.com/CastorRise/gallery)，通过本地后台真实 Publish 流程提交并推送 `93da4fde2f26328a8f7d58e3ceb780f94a6921a4`。独立 Pages 设为 workflow，首次 [GitHub Actions](https://github.com/CastorRise/gallery/actions/runs/38543665701) 的 build/deploy 均成功；Linux CI 的依赖安装、类型检查、17 项测试、生产构建和产物审计通过。

线上 [Gallery](https://castorrise.github.io/gallery/) 的首页、照片详情、专题、Journal、About 均返回 200。真实线上 Chromium 验证：首屏照片加载、Weather 筛选 5 张、浏览器方向键/退出、大图加载、独立详情页刷新、地图 3 个聚合点；没有页面 JavaScript 错误。`.local/library.json`、`api/library`、`admin/` 均返回 404。

现有个人网站的 87 个文件再次与发布前 SHA-256 基线一致，原有 Git 工作区状态保持原样，原站 Pages 仍为 legacy / built。后台仅在本机运行；53 张公开衍生图已提交，`.local`、原图和草稿未被 Git 跟踪。首次发布的结构化证据见 [deployment.json](deployment.json)。

## 复现

安装锁定依赖后运行 README 中的类型检查、API/图片测试、构建和浏览器命令。浏览器测试只复制公开衍生图到独立测试图库，不读取或修改真实本机原图；测试故事不提交或上传。

Astro Pages 配置依据 [官方 GitHub Pages 文档](https://docs.astro.build/en/guides/deploy/github/)。Sharp 元数据和 ICC 处理依据 [官方输出 API](https://sharp.pixelplumbing.com/api-output/)。
