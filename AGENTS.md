# 项目交付规范

对拾时（study-time）的每次修改，必须：

1. 在 CHANGELOG.md 按版本、日期及 Added / Changed / Fixed 等类别记录实际变更、兼容性和验证情况；不得将未经验证的行为写成已验证。
2. 更新版本并执行相关测试和 APK 构建，沿用现有包名与签名，递增 Android versionCode。
3. 提交并推送到 GitHub，发布对应版本的 Release，并附上 APK 和 SHA-256 校验文件。
4. 将该版本的新安装包复制到 D 盘根目录并核对 SHA-256。
5. 不提交签名密钥、本地 SDK 配置或构建缓存。
