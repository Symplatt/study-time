# 拾时 · Android 学习计时

简洁的离线学习计时应用，Android 8.0 及以上可用。界面使用内置 WebView 渲染，所有资源随 APK 打包，无需网络、账号或额外权限。

## 功能

- 首页开始、暂停/继续、结束并保存；每日累计与记录列表。
- 顶部日期折角打开日历，带记录标记，可查看过去日期。
- 近一周（7 天）、近一个月（30 天）、近一年（12 个月）柱状图。
- 总时长、日均时长、专注次数、学习天数和单日/单月最佳。
- 原生 SharedPreferences 持久化，退出、锁屏或进程被回收后恢复计时。
- 按每段起止时间差累计，暂停不计入；跨午夜按当地日期拆分。
- 底部“设置”根页面并列提供数据导入、导出按钮，支持 JSON 导入导出，导出复制到剪切板，导入使用系统文件选择器，不申请全盘存储权限。

## 1.0.3 更新

- 移除带图标和软件名称的顶部导航栏，底部新增“设置”。
- 数据导入、导出按钮并列放在设置根页面，导入预览也直接在该页面展开。
- Android versionCode 递增至 4，包名不变；因原签名缺失，经用户授权改用新本地签名。
- 新签名无法覆盖旧签名版本：请先在旧版导出备份，卸载后安装新版并导入恢复。

## 1.0.2 更新

- 首页按钮统一为“暂停/继续”。
- 移除日均学习卡片的解释文字。
- 修正导出/导入图标，导出改为复制 JSON 数据到剪切板。
- Android 内部版本号递增至 3，沿用原包名和签名。
- 完整变更及验证范围见 [CHANGELOG.md](CHANGELOG.md)。

## 历史本地版本 1.1.0 更新

- 移除装饰性文案；保留计时、日期、数据状态与操作说明。
- 顶栏与正文之间添加浅色细分隔线；今日徽标和统计图标保持直立。
- 使用原生 FrameLayout 处理状态栏、导航栏及屏幕缺口的安全区域，WebView 在安全区域内布局。
- 导入前显示预览，合并记录并去重；编号冲突保留本机记录；错误文件整份拒绝。
- 导出仅包含已结束的记录，不包含当前计时；单个文件上限 10 MB。
- 新包沿用旧版包名及签名，直接覆盖安装可保留设备内的记录，无需卸载。

## 计时方式

每次开始或继续保存起始时间戳，暂停或结束保存结束时间戳。显示值为已完成片段的时长总和加上当前时间与正在进行片段开始时间之差。每秒刷新只是重绘，不累计秒数，因此后台限流不造成计时漂移。手动修改系统时钟会影响尚未结束片段，建议保持手机自动设置日期和时间。历史记录不会因重绘修改。

数据仅保存在设备内，卸载或清除应用数据会移除记录。首次启动为空白数据，不包含演示记录。

## 开发与验证

```text
node --test tests/*.test.cjs
node scripts/serve.cjs
node scripts/bundle.cjs
```

浏览器预览：http://localhost:4173 。网页预览使用浏览器本地存储，与安装包数据独立。

Android 项目在 `android` 中，使用 JDK 17+、Gradle 8.14、Android SDK 35 和 Android Gradle Plugin 8.11.1。在 Android Studio 打开该目录即可构建，也可配置 `local.properties` 的 `sdk.dir` 后运行 `gradle assembleDebug`。先运行 `npm run bundle` 将最新界面写入 Android assets。

本地 HTML 采用 Android 官方建议的 `loadDataWithBaseURL` 载入，禁用文件访问与外部导航；APK 未申请网络权限。
参考：https://developer.android.com/develop/ui/views/layout/webapps/load-local-content

也可完全离线构建：在项目目录运行 `./scripts/build-apk.ps1 -Sdk <SDK目录> -Jdk <JDK目录>`，脚本直接使用官方 aapt2、javac、d8、zipalign、apksigner，不依赖 Gradle 下载。输出 `dist/shishi-1.0.3.apk`。

交付 APK 为本地测试签名包，不是应用商店发布包；签名密钥保存在本项目 `.tools/debug.keystore`，后续升级需保留该密钥。

## 验证范围

- 16 项计时、统计及备份自动测试通过。
- 手机宽度预览检查通过；开始、暂停、刷新恢复、继续、结束保存、历史日期与三种统计范围均经界面操作验证。
- APK 构建成功，v2 / v3 签名验证通过。
- 1.1.0 浏览器预览确认精简界面、图标、分隔线、文件导入预览、统计更新及重复导入拦截。
- 浏览器内导出按钮已触发，但预览工具未捕获下载事件，未据此确认下载完成。
- 尚未在实体 Android 手机验证状态栏、系统文件选择器及覆盖安装。

原生适配依据：
- https://developer.android.com/develop/ui/views/layout/edge-to-edge
- https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets
- https://developer.android.com/training/data-storage/shared/documents-files
