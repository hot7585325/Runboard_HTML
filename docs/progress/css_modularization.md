# 功能進度紀錄：CSS 雙層模組化重構 (CSS Modular Architecture Refactoring)

- **紀錄時間**：2026-09-09
- **當前目標與背景**：
  原專案之樣式全部集中於單一檔案 `css/style.css`，總長度超過 1,500 行。其中目錄節點圖 (`folder_graph`) 與系統資訊 (`sysinfo`) 等高度客製化之特殊視覺元件即佔用超過 42% 之行數。為徹底落實職責分離、消除樣式全域污染風險，並與已實施腳本分離之 JavaScript 架構（`js/*.js`）維持一致對稱性，本次進行全專案 CSS 徹底模組化重構，建立「共用基底 (App Shell / Design Tokens) + 功能專屬樣式 (Feature CSS)」雙層架構，並同步升級 `GEMINI.md` 規範與所有 HTML 檔案引用。

---

## 已完成事項清單

- [x] **共用基底瘦身與純化 (`css/style.css`)**：
  - 由原先 1,506 行大幅縮減至 335 行（精簡達 78%）。
  - 保留 `:root` 主題色彩變數 (Design Tokens)、全域 Reset、Body、側邊欄 (`.sidebar`)、通用按鈕 (`.btn`)、通用編輯/刪除按鈕 (`.delete-btn`, `.edit-btn`)、主內容區佈局 (`.main-content`)、搜尋列工具列 (`.toolbar-container`) 與共用彈出視窗 (`.modal-overlay`, `.modal`)。
- [x] **提取 7 個功能專屬 CSS 模組**：
  - `css/index.css` (41 行)：首頁儀表板卡片、統計網格與懸停特效。
  - `css/favorites.css` (142 行)：分類群組摺疊、常用網站書籤卡片、拖曳狀態指示。
  - `css/notes.css` (135 行)：多色主題便利貼、標籤過濾膠囊、行內就地即時編輯器、深色卡片文字自動反色。
  - `css/tasks.css` (157 行)：任務待辦清單、自訂勾選框、過期/今日/明日日期膠囊、分類完成率徽章。
  - `css/passwords.css` (74 行)：密碼管理卡片、帳號資訊、星號密碼遮罩切換。
  - `css/folder_graph.css` (442 行)：Godot GraphNode 風格節點、畫布縮放拖曳、SVG 貝茲曲線連線、插槽連接埠 (Ports)、副檔名膠囊群、節點收合。
  - `css/sysinfo.css` (196 行)：Hero 網段展示、呼吸動畫 (`sysinfo-pulse`)、系統硬體規格卡片、狀態 Badge。
- [x] **HTML 全數接軌雙層引用**：
  - 升級 `index.html`、`favorites.html`、`notes.html`、`tasks.html`、`passwords.html`、`folder_graph.html`、`sysinfo.html` 之 `<head>`，依序載入 `css/style.css` 與專屬 CSS。
- [x] **更新專案規範 (`GEMINI.md`)**：
  - 第 3 節正式納入「CSS 雙層模組化架構」原則。
  - 第 4 節新增功能 SOP 檢核表更新 HTML `<head>` 結構檢核與專屬樣式建立流程。

---

## 待辦事項 / 已知問題

- [ ] **多主題切換樣式適應 (Themes Support)**：
  - 後續若引入 Slate、Navy、Matrix 等主題切換器，只需在 `css/style.css` 的 `:root` 覆寫變數，各功能專屬模組均自動繼承變數，無需逐一修改。
- [ ] **微型組件抽取 (Micro-components)**：
  - 觀察後續新工具是否出現重複之 Badge 或卡片結構，可適時評估是否提升至基底組件。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 共用基底樣式 | Design Tokens、側邊欄、主版型、按鈕、通用搜尋列、Modal 彈窗 |
| [css/index.css](file:///d:/Private/Runboard/css/index.css) | 功能專屬樣式 | 首頁儀表板卡片與統計數字佈局 |
| [css/favorites.css](file:///d:/Private/Runboard/css/favorites.css) | 功能專屬樣式 | 常用網站分類、書籤網格與拖曳高光 |
| [css/notes.css](file:///d:/Private/Runboard/css/notes.css) | 功能專屬樣式 | 便條紙便利貼網格、就地編輯器與文字色彩反轉 |
| [css/tasks.css](file:///d:/Private/Runboard/css/tasks.css) | 功能專屬樣式 | 任務清單項目、截止日期狀態膠囊與完成率徽章 |
| [css/passwords.css](file:///d:/Private/Runboard/css/passwords.css) | 功能專屬樣式 | 密碼卡片佈局、遮罩切換與帳號資訊 |
| [css/folder_graph.css](file:///d:/Private/Runboard/css/folder_graph.css) | 功能專屬樣式 | 目錄節點圖、畫布變形、SVG 連線、連接埠插槽 |
| [css/sysinfo.css](file:///d:/Private/Runboard/css/sysinfo.css) | 功能專屬樣式 | 系統硬體資訊卡片、網路 Hero 區塊與 Pulse 呼吸動畫 |
| [GEMINI.md](file:///d:/Private/Runboard/GEMINI.md) | 架構規範 | 定義 CSS 雙層架構與新功能開發 SOP 檢核表 |
