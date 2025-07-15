# 🚀 X中文过滤器 - Chrome扩展发布指南

## 📋 发布前准备清单

### 1. 生成PNG图标 ✅
1. 在浏览器中打开 `icons/generate-icons.html`
2. 右键保存以下4个图标到 `icons/` 文件夹：
   - `icon-16.png` (16×16)
   - `icon-32.png` (32×32) 
   - `icon-48.png` (48×48)
   - `icon-128.png` (128×128)

### 2. 检查必需文件 ✅
确保以下文件存在且功能正常：
- [x] `manifest.json` - 扩展配置文件
- [x] `content.js` - 核心过滤逻辑
- [x] `popup.html` - 弹窗界面
- [x] `popup.js` - 弹窗逻辑
- [x] `styles.css` - 样式文件
- [ ] `icons/icon-16.png` - 需要生成
- [ ] `icons/icon-32.png` - 需要生成
- [ ] `icons/icon-48.png` - 需要生成
- [ ] `icons/icon-128.png` - 需要生成

### 3. 需要排除的文件
以下文件**不要**包含在发布包中：
- `demo/` 文件夹（演示文件）
- `test_filter.js` 测试文件
- `README.md` 说明文档
- `PUBLISH_GUIDE.md` 本指南
- `icons/icon.svg` SVG源文件
- `icons/generate-icons.html` 图标生成器
- `.git/` 版本控制文件夹

## 📦 打包步骤

### 方法1: 手动打包（推荐）
1. 创建一个新文件夹 `extension-release/`
2. 复制以下文件到新文件夹：
   ```
   extension-release/
   ├── manifest.json
   ├── content.js
   ├── popup.html
   ├── popup.js
   ├── styles.css
   └── icons/
       ├── icon-16.png
       ├── icon-32.png
       ├── icon-48.png
       └── icon-128.png
   ```
3. 选中 `extension-release/` 文件夹内的所有文件
4. 右键 → "发送到" → "压缩文件夹" 或使用7-Zip压缩
5. 命名为 `x-chinese-filter-extension.zip`

### 方法2: 使用命令行
```bash
# Windows PowerShell
Compress-Archive -Path manifest.json,content.js,popup.html,popup.js,styles.css,icons -DestinationPath x-chinese-filter-extension.zip
```

## 🌐 上传到Chrome网上应用店

### 准备材料
1. **开发者账号** - 需要付费注册($5一次性费用)
2. **扩展包** - `x-chinese-filter-extension.zip`
3. **宣传图片**：
   - 小磁贴图标：128×128 (必需)
   - 大磁贴图标：440×280 (推荐)
   - 屏幕截图：1280×800 或 640×400 (必需)
   - 宣传图片：1400×560 (可选)

### 发布流程
1. 访问 [Chrome网上应用店开发者信息中心](https://chrome.google.com/webstore/devconsole)
2. 点击"添加新项"
3. 上传 `x-chinese-filter-extension.zip`
4. 填写商店信息：
   - **名称**：X中文帖子过滤器
   - **摘要**：隐藏X(Twitter)上的中文帖子和广告，让您的时间线更清爽
   - **详细说明**：详细介绍功能特性
   - **类别**：生产效率工具
   - **语言**：中文（简体）
5. 上传截图和图标
6. 设置隐私政策（如需要）
7. 提交审核

### 审核时间
- 通常需要1-3个工作日
- 首次发布可能需要更长时间
- 如被拒绝，会收到具体原因和修改建议

## ⚠️ 重要提醒

1. **版本号管理**：每次更新需要增加 `manifest.json` 中的版本号
2. **权限说明**：在商店描述中清楚说明为什么需要各种权限
3. **隐私政策**：如果收集用户数据，需要提供隐私政策链接
4. **测试**：发布前在不同网站充分测试功能
5. **备份**：保留源代码和发布包的备份

## 🎯 发布后优化

- 定期更新以适配X.com的页面变化
- 根据用户反馈改进功能
- 监控扩展性能和错误报告
- 维护良好的用户评价

---

**好运！🍀 如有问题，请参考 [Chrome扩展开发文档](https://developer.chrome.com/docs/extensions/)** 