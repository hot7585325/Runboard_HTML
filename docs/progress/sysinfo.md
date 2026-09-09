# 功能進度紀錄：系統與網路資訊 (System & Network Information Dashboard)

- **紀錄時間**：2026-09-09
- **當前目標與背景**：
  為使用者提供一站式的本機硬體規格診斷與網際網路對外連線檢測面板。因應使用者在終端機 `ipconfig` 與外部查 IP 網站（如 WhatIsMyIP）獲取數值不同的常見網路概念，將純本機無伺服器網頁環境（`file:///` 協定）下可獲取的網路與硬體參數全面儀表板化，包含：對外實體公網 IP、電信商 (ISP)、即時網路延遲 (Ping)、WebRTC 內網探測、CPU 邏輯核心數、系統記憶體、GPU 顯示卡型號、螢幕顯示規格、作業系統版本與本機時鐘等，並支援一鍵複製 IP 與匯出 Markdown 系統診斷報告。

---

## 已完成事項清單

- [x] **實體多頁與規範遵從 (`GEMINI.md`)**：
  - 建立專屬實體視圖 [sysinfo.html](file:///d:/Private/Runboard/sysinfo.html)，採用原生 `<a href="...">` 頁面跳轉。
  - 依序載入 `style.css`、`storage.js`、`nav.js`、`modal.js` 及專屬 `js/sysinfo.js`。
  - 嚴格維持離線優先，零外部 CDN，純原生 JavaScript 打造。
  - 於 [js/nav.js](file:///d:/Private/Runboard/js/nav.js) 全域選單註冊 `{ title: '🖥️ 系統資訊', url: 'sysinfo.html' }`。
  - 於 [index.html](file:///d:/Private/Runboard/index.html) 與 [js/index.js](file:///d:/Private/Runboard/js/index.js) 儀表板整合「系統資訊」卡片，即時呈現連線與核心摘要。
  - 針對即使未連線 `data.json` 也能即時查看硬體與外網 IP 的特性進行架構適配，以頂部輕量通知列呈現授權提示，不阻擋面板呈現。
- [x] **網際網路對外 IP (Public IPv4) 與地理網路 Hero 卡片**：
  - 整合多來源非同步查詢機制（主要使用無 CORS 限制、免 API Key 的 `https://ipwho.is/`，並以 `https://api.ipify.org` 作為備援）。
  - 醒目大字體呈現實體公網 IP，附帶「📋 複製 IP」按鈕與「✓ 已複製！」即時按鈕狀態回饋。
  - 解析網路業者 (ISP，如中華電信 HiNet)、ASN 自治組織、國旗圖標（如 🇹🇼）、城市、時區與經緯度。
  - 即時連線狀態動態呼吸燈 🟢 與網路連線判定（斷線時即時轉為 🔴 離線）。
- [x] **內網與連線品質診斷 (Network Quality & Local Probe)**：
  - 即時連線回應延遲 (RTT Ping ms) 測量與品質等級標籤（綠/藍/黃）。
  - 透過 WebRTC (`RTCPeerConnection`) 嘗試探測區域網路 IP；若受現代瀏覽器 mDNS 隱私保護機制匿名化，自動標註並附帶安全說明。
  - Network Information API 整合：估算連線類型（4G / Wi-Fi / 乙太網路）、下行頻寬（Mbps）與省流量模式狀態。
- [x] **電腦硬體運算規格檢測 (Hardware Specifications)**：
  - CPU 處理器邏輯核心數 (`navigator.hardwareConcurrency`)。
  - 系統裝置記憶體估算 (`navigator.deviceMemory`)。
  - 透過 WebGL 上下文延伸模組 (`WEBGL_debug_renderer_info`) 深度探測真實硬體顯示卡 (GPU 渲染器型號，如 NVIDIA / Intel / AMD)。
  - WebGL 2.0 硬體圖形加速支援檢驗。
  - 電池狀態檢測 (Battery Status API，支援筆電顯示電量百分比與充電狀態)。
- [x] **螢幕與顯示規格分析 (Screen & Display)**：
  - 實體螢幕解析度、扣除工作列之可用工作區尺寸、目前視窗尺寸。
  - 螢幕縮放比率 (DPI，`window.devicePixelRatio`) 與色彩深度 (24-bit / 32-bit)。
- [x] **作業系統與執行環境 (OS & Browser Environment)**：
  - 精確辨識作業系統平台（Windows 10/11）與 64 位元架構 (x86_64)。
  - 瀏覽器核心名稱與精確版本號（Edge / Chrome / Firefox）。
  - 系統偏好語言代碼與暗色/亮色主題偏好偵測。
- [x] **本機時鐘與效能診斷 (Local Clock & Performance)**：
  - 秒級動態即時跳動本機時鐘與時區識別（`Asia/Taipei UTC+08:00`）。
  - Chromium JavaScript 引擎記憶體堆疊使用量（已用 / 總分配 / 限制上限 MB）。
  - 頁面 DOM 加載耗時 (ms) 與 IndexedDB 授權快取狀態。
- [x] **快捷操作列與報告複製**：
  - 「🔄 重新整理」按鈕：一鍵重新檢測 IP 與網路延遲。
  - 「📋 複製診斷報告」按鈕：一鍵將全機規格、網路數據整理為結構清晰的 Markdown 報告存入剪貼簿。

---

## 待辦事項 / 後續優化規劃

- [ ] **自訂通訊協定終端機召喚 (`run-term://`)**：
  - 若使用者需要，可提供一鍵安裝的 `.reg` 檔案與工具按鈕，點擊網頁直接彈出 Windows Terminal / CMD。
- [ ] **微型本機橋接器 (Local Bridge) 選配支援**：
  - 支援以微型 PowerShell 腳本在背景執行，突破瀏覽器沙盒以百分之百精確讀取 Windows 原生 `ipconfig` 網卡清單、MAC 位址與預設閘道。
- [ ] **DNS 查詢與速度測試工具 (DNS & Speedtest Lite)**：
  - 擴充輕量連線速度測量或主流公共 DNS（1.1.1.1、8.8.8.8）延遲對比。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [sysinfo.html](file:///d:/Private/Runboard/sysinfo.html) | 視圖頁面 | 系統與網路資訊主頁面、Hero IP 卡片與規格網格佈局 |
| [js/sysinfo.js](file:///d:/Private/Runboard/js/sysinfo.js) | 核心邏輯 | 負責外網 IP 查詢、Ping 延遲測量、硬體規格探測、時鐘與報告複製 |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 全域樣式 | 定義 Hero IP 卡片、呼吸燈動畫、規格網格與狀態徽章樣式 |
| [js/nav.js](file:///d:/Private/Runboard/js/nav.js) | 導覽組件 | 側邊欄全域註冊「🖥️ 系統資訊」導航項目 |
| [index.html](file:///d:/Private/Runboard/index.html) | 首頁視圖 | 首頁工作區儀表板新增系統資訊卡片 |
| [js/index.js](file:///d:/Private/Runboard/js/index.js) | 首頁邏輯 | 首頁儀表板整合系統連線狀態與處理器核心數摘要 |
