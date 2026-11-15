# Web PDF Studio

本地优先的现代化 PDF 编辑、批注与格式转换工作台，同时支持浏览器开发调试与 Windows 桌面独立运行（基于 PyWebView + FastAPI + PyMuPDF + React）。

## 核心功能

- **多维交互式批注与排版**：
  - **添加文字**：支持单击自适应拓宽/多行自动增高、按住拖拽定宽框选、所见即所得行内编辑、前置底色覆盖开关、`Enter` 换行 / `Ctrl+Enter` 完成 / `Esc` 取消。
  - **改原文**：直接点击 PDF 原文段落，自动采样背景色覆盖后就地改写（支持 CJK 字体与页面旋转）。
  - **矢量绘制与图形**：自由画笔、荧光高亮、矩形、圆形、直线与箭头，支持填充、线宽/颜色调整及旋转控制。
  - **电子签名、印章与水印**：高分辨率画板手写签名与图片导入、自定义印章与多角度平铺/居中水印。
- **页面管理与文档工具**：
  - 缩略图拖拽重排、插入空白页、合并外部 PDF / 图片（JPG/PNG/WebP/BMP）、单页/全页 90° 旋转、复制与删除，且批注随页面操作同步旋转或迁移。
  - 全文关键词检索与高亮跳转、加密 PDF 密码解锁、单步可撤销画布移动/缩放与快捷键支持。
- **多格式转换与导出**：
  - 本地无损矢量合成导出标准 PDF（嵌入 `NotoSansSC` 中文字体）或指定页码范围导出。
  - 导出高清多页 PNG/JPEG 图片压缩包、纯文本 / Markdown、以及基于本地 Python 后端 (`pdf2docx` + `PyMuPDF`) 的高精度 Word (`.docx`) 转换。

## 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + `pdfjs-dist` + `pdf-lib` + `pdf-fontkit` + `docx` + `jszip`
- **桌面壳与本地后端**：Python + FastAPI + Uvicorn + `pdf2docx` + `PyMuPDF` + `pywebview` + PyInstaller

## 本地开发与构建

### 1. 安装依赖

```bash
npm install
pip install -r server/requirements.txt
# 如需桌面窗口与单文件打包，另需安装：
pip install pywebview pyinstaller
```

### 2. 开发模式运行

```bash
# 启动本地 PDF 转 Word 后端 (127.0.0.1:8000)
npm run server

# 启动前端开发服务器 (127.0.0.1:5173)
npm run dev
```

### 3. 代码检查与生产构建

```bash
npm run lint
npx tsc --noEmit
npm run build
```

### 4. 运行桌面端或打包 Windows `.exe`

```bash
# 直接以桌面窗口启动
npm run desktop

# 打包为单文件 Web_PDF_Studio.exe（输出在 dist/ 目录）
npm run build:exe
```

## 预编译下载

可直接在仓库右侧 **Releases** 页面下载已打包的 Windows 单文件可执行程序 `Web_PDF_Studio.exe`（无需单独配置 Node.js 或 Python 环境即可双击运行）。
