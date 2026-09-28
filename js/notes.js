/**
 * Runboard - 便條紙 (Notes)
 * 支援「節點式無限畫布 (Canvas View)」與「傳統清單網格 (List View)」雙檢視模式
 * 具備分區群組框 (Group Frame)、群組鏡頭聚焦 (Focus & Pan)、群組收合堆疊與雙擊行內直接編輯
 * 遵循 GEMINI.md 離線優先與原生 JS 規範
 */
const NotesApp = (function () {
    // 檢視與篩選狀態
    let currentView = localStorage.getItem('runboard_notes_view') || 'canvas';
    let searchKeyword = '';
    let activeGroupFilter = null; // null: 全部, 或 catIdx

    // 畫布視角狀態 (Pan & Zoom)
    let zoom = 1.0;
    let panX = 80;
    let panY = 60;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let isSpacePressed = false;

    // 畫布拖曳狀態
    let isDraggingGroup = false;
    let activeDragGroupIdx = null;
    let dragStartMouseX = 0;
    let dragStartMouseY = 0;
    let dragStartGroupX = 0;
    let dragStartGroupY = 0;

    let isDraggingNode = false;
    let activeDragCatIdx = null;
    let activeDragItemIdx = null;
    let dragStartNodeX = 0;
    let dragStartNodeY = 0;

    // 清單拖曳排序狀態
    let draggedItemInfo = null;
    let draggedCategoryInfo = null;

    // DOM 快取
    let dom = {};

    function initDOM() {
        dom.canvasView = document.getElementById('notes-canvas-view');
        dom.listView = document.getElementById('notes-list-view');
        dom.viewport = document.getElementById('canvas-viewport');
        dom.transformLayer = document.getElementById('canvas-transform-layer');
        dom.groupsLayer = document.getElementById('canvas-groups-layer');
        dom.groupPills = document.getElementById('group-pills');
        dom.canvasControls = document.getElementById('canvas-controls');
        dom.btnModeCanvas = document.getElementById('btn-mode-canvas');
        dom.btnModeList = document.getElementById('btn-mode-list');
        dom.lblZoom = document.getElementById('lbl-zoom');
        dom.listContainer = document.getElementById('notes-list');
        dom.toast = document.getElementById('notes-toast');
    }

    /**
     * 輕量 Toast 提示
     */
    let toastTimer = null;
    function showToast(msg) {
        if (!dom.toast) return;
        dom.toast.innerText = msg;
        dom.toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            dom.toast.classList.remove('show');
        }, 2200);
    }

    function getNotes() {
        const data = Storage.getData();
        if (!data.notes) data.notes = [];
        return data.notes;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatNoteContent(content) {
        if (!content) return '';
        const escaped = escapeHtml(content);
        const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
        return escaped.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="note-link" onclick="event.stopPropagation()">${url}</a>`;
        });
    }

    function isDarkColor(hexColor) {
        if (!hexColor) return false;
        let c = hexColor.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        if (c.length !== 6) return false;
        const r = parseInt(c.substring(0, 2), 16) || 0;
        const g = parseInt(c.substring(2, 4), 16) || 0;
        const b = parseInt(c.substring(4, 6), 16) || 0;
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq < 130;
    }

    /**
     * 一鍵複製便條內容
     */
    async function copyNoteContent(content, e) {
        if (e) e.stopPropagation();
        try {
            await navigator.clipboard.writeText(content || '');
            showToast('📋 已複製便條紙內容！');
        } catch (err) {
            showToast('複製失敗，請手動反白複製');
        }
    }

    /**
     * 檢視模式切換 (Canvas / List)
     */
    function switchView(mode) {
        currentView = mode;
        localStorage.setItem('runboard_notes_view', mode);

        if (dom.btnModeCanvas && dom.btnModeList) {
            dom.btnModeCanvas.classList.toggle('active', mode === 'canvas');
            dom.btnModeList.classList.toggle('active', mode === 'list');
        }

        if (dom.canvasView) dom.canvasView.style.display = mode === 'canvas' ? 'block' : 'none';
        if (dom.listView) dom.listView.style.display = mode === 'list' ? 'block' : 'none';
        if (dom.canvasControls) dom.canvasControls.style.display = mode === 'canvas' ? 'inline-flex' : 'none';

        render();
    }

    function handleSearch(keyword) {
        searchKeyword = (keyword || '').trim().toLowerCase();
        render();
    }

    /**
     * 渲染頂部群組快速切換膠囊
     */
    function renderGroupPills() {
        if (!dom.groupPills) return;
        const categories = getNotes();

        let pillsHtml = `
            <button type="button" class="group-pill ${activeGroupFilter === null ? 'active' : ''}" onclick="NotesApp.focusGroup(null)">
                <span>全部</span> <span class="pill-count">${categories.reduce((acc, c) => acc + (c.items ? c.items.length : 0), 0)}</span>
            </button>
        `;

        categories.forEach((cat, idx) => {
            const count = cat.items ? cat.items.length : 0;
            const isSelected = activeGroupFilter === idx;
            const collapsedIcon = cat.collapsed ? '📁 ' : '📂 ';
            pillsHtml += `
                <button type="button" class="group-pill ${isSelected ? 'active' : ''}" onclick="NotesApp.focusGroup(${idx})" title="點擊聚焦「${escapeHtml(cat.category)}」群組">
                    <span>${collapsedIcon}${escapeHtml(cat.category)}</span>
                    <span class="pill-count">${count}</span>
                </button>
            `;
        });

        dom.groupPills.innerHTML = pillsHtml;
    }

    /**
     * 聚焦至指定群組 (Camera Pan & Zoom to Group)
     */
    function focusGroup(catIdx) {
        activeGroupFilter = catIdx;
        renderGroupPills();

        if (currentView === 'canvas') {
            if (catIdx === null) {
                fitAll();
                return;
            }

            const cat = getNotes()[catIdx];
            if (!cat) return;

            // 計算目標群組之畫布中央座標
            const catX = cat.x !== undefined ? cat.x : 100;
            const catY = cat.y !== undefined ? cat.y : 100;
            const catW = cat.w || (cat.collapsed ? 240 : 380);
            const catH = cat.h || (cat.collapsed ? 60 : 320);

            const viewportRect = dom.viewport.getBoundingClientRect();
            const targetZoom = Math.min(1.0, Math.max(0.4, (viewportRect.width - 160) / (catW + 80)));
            zoom = targetZoom;

            const targetCenterX = catX + catW / 2;
            const targetCenterY = catY + catH / 2;

            panX = Math.round(viewportRect.width / 2 - targetCenterX * zoom);
            panY = Math.round(viewportRect.height / 2 - targetCenterY * zoom);

            applyTransform();

            // 觸發高亮光暈動畫
            setTimeout(() => {
                const frameEl = document.getElementById(`canvas-group-${catIdx}`);
                if (frameEl) {
                    frameEl.classList.remove('is-focused-pulse');
                    void frameEl.offsetWidth; // 強制重繪以重播動畫
                    frameEl.classList.add('is-focused-pulse');
                }
            }, 50);

            showToast(`已聚焦至「${cat.category}」群組`);
        } else {
            // 清單模式滾動至該分類
            if (catIdx !== null) {
                const el = document.getElementById(`list-cat-${catIdx}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // 若收合則自動展開
                    const cat = getNotes()[catIdx];
                    if (cat && cat.collapsed) {
                        toggleCategory(catIdx);
                    }
                }
            }
        }
    }

    /**
     * 畫布視野縮放至容納全部群組 (Fit All)
     */
    function fitAll() {
        const categories = getNotes();
        if (categories.length === 0) {
            resetView();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        categories.forEach(cat => {
            const cx = cat.x || 80;
            const cy = cat.y || 80;
            const cw = cat.w || 340;
            const ch = cat.h || 200;
            if (cx < minX) minX = cx;
            if (cy < minY) minY = cy;
            if (cx + cw > maxX) maxX = cx + cw;
            if (cy + ch > maxY) maxY = cy + ch;
        });

        const totalW = maxX - minX;
        const totalH = maxY - minY;
        const viewportRect = dom.viewport.getBoundingClientRect();

        const scaleX = (viewportRect.width - 160) / (totalW || 1);
        const scaleY = (viewportRect.height - 160) / (totalH || 1);
        zoom = Math.min(1.0, Math.max(0.25, Math.min(scaleX, scaleY)));

        const centerX = minX + totalW / 2;
        const centerY = minY + totalH / 2;
        panX = Math.round(viewportRect.width / 2 - centerX * zoom);
        panY = Math.round(viewportRect.height / 2 - centerY * zoom);

        applyTransform();
        showToast('已檢視全部群組');
    }

    /**
     * 依群組分區自動排列整齊 (Auto Layout)
     */
    async function autoLayout() {
        const categories = getNotes();
        if (!categories || categories.length === 0) return;

        let curX = 60;
        let curY = 60;
        let rowMaxH = 0;

        categories.forEach((cat) => {
            const itemCount = cat.items ? cat.items.length : 0;

            if (cat.collapsed) {
                cat.w = 260;
                cat.h = 56;
            } else if (itemCount === 0) {
                cat.w = 320;
                cat.h = 160;
            } else {
                // 依項目數量計算最佳欄數 (1~3 欄)
                const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(itemCount))));
                const colWidth = 280;
                const gap = 16;
                const pad = 16;

                const colHeights = new Array(cols).fill(54); // 54px 為群組標題高度

                cat.items.forEach((item) => {
                    // 尋找當前最短的欄
                    let minCol = 0;
                    for (let c = 1; c < cols; c++) {
                        if (colHeights[c] < colHeights[minCol]) minCol = c;
                    }

                    const itemW = Math.min(450, Math.max(240, parseInt(item.width) || colWidth));
                    const itemH = Math.min(500, Math.max(120, parseInt(item.height) || 180));

                    item.x = pad + minCol * (colWidth + gap);
                    item.y = colHeights[minCol];
                    item.width = `${itemW}px`;
                    item.height = `${itemH}px`;

                    colHeights[minCol] += itemH + gap;
                });

                cat.w = pad * 2 + cols * colWidth + (cols - 1) * gap;
                cat.h = Math.max(...colHeights) + pad;
            }

            cat.x = curX;
            cat.y = curY;

            curX += (cat.w || 340) + 70;
            if (cat.h > rowMaxH) rowMaxH = cat.h;

            // 超過 3000px 寬度時換行排列
            if (curX > 2800) {
                curX = 60;
                curY += rowMaxH + 80;
                rowMaxH = 0;
            }
        });

        await Storage.save();
        render();
        fitAll();
        showToast('📐 已依群組分區自動排列整齊');
    }

    /**
     * 畫布收合/展開群組
     */
    async function toggleCanvasCategory(catIdx, e) {
        if (e) e.stopPropagation();
        const cat = getNotes()[catIdx];
        if (!cat) return;
        cat.collapsed = !cat.collapsed;
        await Storage.save();
        render();
        showToast(cat.collapsed ? `已收合「${cat.category}」群組` : `已展開「${cat.category}」群組`);
    }

    /**
     * 總體渲染入口
     */
    function render() {
        renderGroupPills();
        if (currentView === 'canvas') {
            renderCanvas();
        } else {
            renderList();
        }
    }

    /**
     * ================= 畫布渲染 (Canvas View) =================
     */
    function renderCanvas() {
        if (!dom.groupsLayer) return;
        const categories = getNotes();

        let canvasHtml = '';

        categories.forEach((cat, catIdx) => {
            const isCollapsed = Boolean(cat.collapsed);
            const catNameMatches = searchKeyword && cat.category && cat.category.toLowerCase().includes(searchKeyword);

            // 確保座標預設值存在
            if (cat.x === undefined || cat.y === undefined) {
                cat.x = 60 + (catIdx % 3) * 440;
                cat.y = 60 + Math.floor(catIdx / 3) * 380;
                cat.w = cat.w || 380;
                cat.h = cat.h || 300;
            }

            // 搜尋關鍵字過濾項目
            const itemsToRender = [];
            if (cat.items) {
                cat.items.forEach((item, itemIdx) => {
                    if (!searchKeyword) {
                        itemsToRender.push({ item, itemIdx });
                    } else {
                        const contentMatch = item.content && item.content.toLowerCase().includes(searchKeyword);
                        if (contentMatch || catNameMatches) {
                            itemsToRender.push({ item, itemIdx });
                        }
                    }
                });
            }

            // 搜尋時無符合便條且群組名稱不符則淡化或隱藏
            const isHiddenBySearch = searchKeyword && itemsToRender.length === 0 && !catNameMatches;
            if (isHiddenBySearch) return;

            const frameStyle = `
                left: ${cat.x}px;
                top: ${cat.y}px;
                width: ${cat.w ? `${cat.w}px` : 'auto'};
                height: ${isCollapsed ? 'auto' : (cat.h ? `${cat.h}px` : 'auto')};
            `;

            // 便條卡片內部 HTML
            let notesHtml = '';
            if (!isCollapsed) {
                if (itemsToRender.length === 0) {
                    notesHtml = `
                        <div style="text-align:center; padding: 30px 10px; color: var(--text-secondary); font-size: 13px;">
                            ${searchKeyword ? '無符合便條' : '此群組尚無便條紙<br><button class="btn btn-small" style="margin-top:8px;" onclick="NotesApp.openAddNote(${catIdx})">＋新增便條紙</button>'}
                        </div>
                    `;
                } else {
                    itemsToRender.forEach(({ item, itemIdx }) => {
                        const bgColor = item.color || '#fde047';
                        const w = item.width ? `width: ${item.width};` : 'width: 260px;';
                        const h = item.height ? `height: ${item.height};` : 'height: 170px;';
                        const x = item.x !== undefined ? `left: ${item.x}px;` : 'position: relative; margin-bottom: 12px;';
                        const y = item.y !== undefined ? `top: ${item.y}px;` : '';
                        const darkClass = isDarkColor(bgColor) ? 'dark-theme' : '';

                        notesHtml += `
                        <div class="canvas-note-card ${darkClass}"
                             id="canvas-note-${catIdx}-${itemIdx}"
                             style="background-color: ${bgColor}; ${w} ${h} ${x} ${y}"
                             ondblclick="NotesApp.enableInlineEdit(event, ${catIdx}, ${itemIdx})"
                             title="按住頂部拖曳位置 · 連點兩下直接編輯內容">
                            
                            <div class="canvas-note-header" onmousedown="NotesApp.onNoteHeaderMouseDown(event, ${catIdx}, ${itemIdx})">
                                <button type="button" class="canvas-note-btn" onclick="NotesApp.copyNoteContent('${escapeHtml(item.content)}', event)" title="複製整張內容">📋</button>
                                <button type="button" class="canvas-note-btn" onclick="NotesApp.openEditNote(${catIdx}, ${itemIdx})" title="完整編輯視窗">✏️</button>
                                <button type="button" class="canvas-note-btn" onclick="NotesApp.deleteNote(${catIdx}, ${itemIdx})" title="刪除便條">✕</button>
                            </div>

                            <div class="canvas-note-body">
                                <div class="canvas-note-content item-title">${formatNoteContent(item.content || '')}</div>
                            </div>
                        </div>
                        `;
                    });
                }
            }

            // 群組框 HTML
            canvasHtml += `
            <div class="canvas-group-frame ${isCollapsed ? 'is-collapsed' : ''}"
                 id="canvas-group-${catIdx}"
                 style="${frameStyle}">
                
                <!-- 群組頂部標題列 (按住可拖曳群組) -->
                <div class="canvas-group-header" onmousedown="NotesApp.onGroupHeaderMouseDown(event, ${catIdx})">
                    <div class="canvas-group-title" title="${escapeHtml(cat.category)}">
                        <span>${isCollapsed ? '📁' : '📂'}</span>
                        <span>${escapeHtml(cat.category)}</span>
                        <span class="group-badge">${cat.items ? cat.items.length : 0} 則便條</span>
                    </div>
                    <div class="canvas-group-actions">
                        <button type="button" class="canvas-group-btn" onclick="NotesApp.openAddNote(${catIdx})" title="新增便條紙至此群組">＋</button>
                        <button type="button" class="canvas-group-btn" onclick="NotesApp.openEditCategory(${catIdx})" title="重新命名分類">✏️</button>
                        <button type="button" class="canvas-group-btn btn-collapse" onclick="NotesApp.toggleCanvasCategory(${catIdx}, event)" title="${isCollapsed ? '展開群組' : '收合群組'}">
                            ${isCollapsed ? '＋' : '－'}
                        </button>
                        <button type="button" class="canvas-group-btn" style="color:var(--danger-color);" onclick="NotesApp.deleteCategory(${catIdx})" title="刪除群組">🗑️</button>
                    </div>
                </div>

                <!-- 群組內部內容區 -->
                <div class="canvas-group-body">
                    ${notesHtml}
                </div>
            </div>
            `;
        });

        dom.groupsLayer.innerHTML = canvasHtml;
    }

    /**
     * ================= 清單渲染 (List View) =================
     */
    function renderList() {
        if (!dom.listContainer) return;
        const categories = getNotes();
        let html = '';
        let totalMatched = 0;

        categories.forEach((cat, catIdx) => {
            const isCollapsed = cat.collapsed ? 'collapsed' : '';
            const catNameMatches = searchKeyword && cat.category && cat.category.toLowerCase().includes(searchKeyword);

            const itemsToRender = [];
            if (cat.items) {
                cat.items.forEach((item, itemIdx) => {
                    if (!searchKeyword) {
                        itemsToRender.push({ item, itemIdx });
                    } else {
                        const contentMatch = item.content && item.content.toLowerCase().includes(searchKeyword);
                        if (contentMatch || catNameMatches) {
                            itemsToRender.push({ item, itemIdx });
                        }
                    }
                });
            }

            if (searchKeyword && itemsToRender.length === 0 && !catNameMatches) {
                return;
            }

            totalMatched += itemsToRender.length;

            html += `
            <div class="category" id="list-cat-${catIdx}" ondragover="NotesApp.handleDragOver(event)" ondragleave="NotesApp.handleDragLeave(event)" ondrop="NotesApp.handleDrop(event, ${catIdx})">
                <div class="category-header">
                    <div class="category-title-area" draggable="true" ondragstart="NotesApp.handleCategoryDragStart(event, ${catIdx})" ondragend="NotesApp.handleCategoryDragEnd(event)" onclick="NotesApp.toggleCategory(${catIdx})">
                        <span class="toggle-icon ${isCollapsed}">▼</span>
                        <div class="category-name">${escapeHtml(cat.category)} (${cat.items ? cat.items.length : 0})</div>
                    </div>
                    <div>
                        <button class="btn btn-small" onclick="NotesApp.openAddNote(${catIdx})">＋新增便條紙</button>
                        <button class="btn btn-small" onclick="NotesApp.openEditCategory(${catIdx})">✏️</button>
                        <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="NotesApp.deleteCategory(${catIdx})">🗑️</button>
                    </div>
                </div>
                <div class="list-container ${isCollapsed}">
            `;

            itemsToRender.forEach(({ item, itemIdx }) => {
                const bgColor = item.color || '#fde047';
                const w = item.width ? `width: ${item.width};` : '';
                const h = item.height ? `height: ${item.height};` : '';
                const darkClass = isDarkColor(bgColor) ? 'dark-theme' : '';

                html += `
                <div class="item-card note-card ${darkClass}" style="background-color: ${bgColor}; ${w} ${h}" draggable="true"
                    ondragstart="NotesApp.handleDragStart(event, ${catIdx}, ${itemIdx})"
                    ondragend="NotesApp.handleDragEnd(event)"
                    ondragover="NotesApp.handleItemDragOver(event)"
                    ondragleave="NotesApp.handleItemDragLeave(event)"
                    ondrop="NotesApp.handleItemDrop(event, ${catIdx}, ${itemIdx})"
                    ondblclick="NotesApp.enableInlineEdit(event, ${catIdx}, ${itemIdx})"
                    data-cat-idx="${catIdx}" data-item-idx="${itemIdx}"
                    title="連點兩下直接編輯內容">
                    <button class="canvas-note-btn" style="position:absolute; right:58px; top:10px;" onclick="NotesApp.copyNoteContent('${escapeHtml(item.content)}', event)" title="複製整張內容">📋</button>
                    <button class="edit-btn" onclick="NotesApp.openEditNote(${catIdx}, ${itemIdx})" title="完整編輯視窗">✏️</button>
                    <button class="delete-btn" onclick="NotesApp.deleteNote(${catIdx}, ${itemIdx})" title="刪除便條">✕</button>
                    <div class="item-title">${formatNoteContent(item.content || '')}</div>
                </div>
                `;
            });

            html += `</div></div>`;
        });

        if (searchKeyword && totalMatched === 0 && categories.length > 0) {
            html = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">沒有找到符合「${escapeHtml(searchKeyword)}」的便條紙</div>`;
        }

        dom.listContainer.innerHTML = html;
    }

    /**
     * 清單分類收合
     */
    async function toggleCategory(catIdx) {
        const cat = getNotes()[catIdx];
        if (!cat) return;
        cat.collapsed = !cat.collapsed;
        await Storage.save();
        render();
    }

    /**
     * ================= 畫布節點與群組拖曳 (Canvas Dragging) =================
     */
    // 群組拖曳
    function onGroupHeaderMouseDown(e, catIdx) {
        if (e.button !== 0) return; // 僅限左鍵
        if (e.target.closest('button')) return; // 避開按鈕
        e.stopPropagation();

        isDraggingGroup = true;
        activeDragGroupIdx = catIdx;
        dragStartMouseX = e.clientX;
        dragStartMouseY = e.clientY;

        const cat = getNotes()[catIdx];
        dragStartGroupX = cat.x !== undefined ? cat.x : 60;
        dragStartGroupY = cat.y !== undefined ? cat.y : 60;

        const el = document.getElementById(`canvas-group-${catIdx}`);
        if (el) el.classList.add('is-dragging');

        window.addEventListener('mousemove', onGroupMouseMove);
        window.addEventListener('mouseup', onGroupMouseUp);
    }

    function onGroupMouseMove(e) {
        if (!isDraggingGroup || activeDragGroupIdx === null) return;
        const dx = (e.clientX - dragStartMouseX) / zoom;
        const dy = (e.clientY - dragStartMouseY) / zoom;

        const newX = Math.round(dragStartGroupX + dx);
        const newY = Math.round(dragStartGroupY + dy);

        const cat = getNotes()[activeDragGroupIdx];
        cat.x = newX;
        cat.y = newY;

        const el = document.getElementById(`canvas-group-${activeDragGroupIdx}`);
        if (el) {
            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
        }
    }

    async function onGroupMouseUp() {
        if (isDraggingGroup && activeDragGroupIdx !== null) {
            const el = document.getElementById(`canvas-group-${activeDragGroupIdx}`);
            if (el) el.classList.remove('is-dragging');
            isDraggingGroup = false;
            activeDragGroupIdx = null;
            await Storage.save();
        }
        window.removeEventListener('mousemove', onGroupMouseMove);
        window.removeEventListener('mouseup', onGroupMouseUp);
    }

    // 便條紙節點拖曳 (在群組內部)
    function onNoteHeaderMouseDown(e, catIdx, itemIdx) {
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        e.stopPropagation();

        isDraggingNode = true;
        activeDragCatIdx = catIdx;
        activeDragItemIdx = itemIdx;
        dragStartMouseX = e.clientX;
        dragStartMouseY = e.clientY;

        const item = getNotes()[catIdx]?.items?.[itemIdx];
        if (!item) return;

        dragStartNodeX = item.x !== undefined ? item.x : 16;
        dragStartNodeY = item.y !== undefined ? item.y : 54;

        const el = document.getElementById(`canvas-note-${catIdx}-${itemIdx}`);
        if (el) el.classList.add('is-dragging');

        window.addEventListener('mousemove', onNoteMouseMove);
        window.addEventListener('mouseup', onNoteMouseUp);
    }

    function onNoteMouseMove(e) {
        if (!isDraggingNode || activeDragCatIdx === null || activeDragItemIdx === null) return;
        const dx = (e.clientX - dragStartMouseX) / zoom;
        const dy = (e.clientY - dragStartMouseY) / zoom;

        const newX = Math.max(10, Math.round(dragStartNodeX + dx));
        const newY = Math.max(50, Math.round(dragStartNodeY + dy));

        const item = getNotes()[activeDragCatIdx]?.items?.[activeDragItemIdx];
        if (!item) return;
        item.x = newX;
        item.y = newY;

        const el = document.getElementById(`canvas-note-${activeDragCatIdx}-${activeDragItemIdx}`);
        if (el) {
            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
        }

        // 動態擴展群組框尺寸，防止溢出
        const cat = getNotes()[activeDragCatIdx];
        const cardW = parseInt(item.width) || 260;
        const cardH = parseInt(item.height) || 170;
        if (newX + cardW + 20 > (cat.w || 380)) {
            cat.w = newX + cardW + 30;
            const groupEl = document.getElementById(`canvas-group-${activeDragCatIdx}`);
            if (groupEl) groupEl.style.width = `${cat.w}px`;
        }
        if (newY + cardH + 20 > (cat.h || 300)) {
            cat.h = newY + cardH + 30;
            const groupEl = document.getElementById(`canvas-group-${activeDragCatIdx}`);
            if (groupEl) groupEl.style.height = `${cat.h}px`;
        }
    }

    async function onNoteMouseUp() {
        if (isDraggingNode && activeDragCatIdx !== null && activeDragItemIdx !== null) {
            const el = document.getElementById(`canvas-note-${activeDragCatIdx}-${activeDragItemIdx}`);
            if (el) el.classList.remove('is-dragging');
            isDraggingNode = false;
            activeDragCatIdx = null;
            activeDragItemIdx = null;
            await Storage.save();
        }
        window.removeEventListener('mousemove', onNoteMouseMove);
        window.removeEventListener('mouseup', onNoteMouseUp);
    }

    /**
     * ================= 畫布平移與縮放互動 (Pan & Zoom) =================
     */
    function applyTransform() {
        if (dom.transformLayer) {
            dom.transformLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        }
        if (dom.lblZoom) {
            dom.lblZoom.innerText = `${Math.round(zoom * 100)}%`;
        }
    }

    function resetView() {
        zoom = 1.0;
        panX = 80;
        panY = 60;
        applyTransform();
        showToast('視角已重設 (100%)');
    }

    function setupCanvasInteractions() {
        if (!dom.viewport) return;

        // 滾輪縮放 (0.2x ~ 2.0x) 以指標位置為錨點
        dom.viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = dom.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.min(Math.max(0.2, zoom * zoomFactor), 2.0);

            panX = mouseX - (mouseX - panX) * (newZoom / zoom);
            panY = mouseY - (mouseY - panY) * (newZoom / zoom);
            zoom = newZoom;

            applyTransform();
        }, { passive: false });

        // 滑鼠中鍵 (1)、右鍵 (2) 或按住空白鍵時拖動畫布
        dom.viewport.addEventListener('mousedown', (e) => {
            if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpacePressed)) {
                e.preventDefault();
                isPanning = true;
                panStartX = e.clientX - panX;
                panStartY = e.clientY - panY;
                dom.viewport.classList.add('is-panning');
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isPanning) {
                panX = e.clientX - panStartX;
                panY = e.clientY - panStartY;
                applyTransform();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (isPanning) {
                isPanning = false;
                dom.viewport.classList.remove('is-panning');
            }
        });

        // 阻擋原生右鍵選單以利順暢平移
        dom.viewport.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // 空白鍵輔助抓取
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                isSpacePressed = true;
                dom.viewport.style.cursor = 'grab';
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                isSpacePressed = false;
                dom.viewport.style.cursor = '';
            }
        });
    }

    /**
     * ================= 雙擊行內直接編輯 (Inline Editing) =================
     */
    function enableInlineEdit(event, catIdx, itemIdx) {
        if (event.target.closest('a') || event.target.closest('button')) return;

        const card = event.currentTarget;
        if (card.querySelector('.inline-note-editor')) return;

        const note = getNotes()[catIdx]?.items?.[itemIdx];
        if (!note) return;

        const originalContent = note.content || '';
        const titleEl = card.querySelector('.item-title') || card.querySelector('.canvas-note-content');
        if (!titleEl) return;

        card.setAttribute('draggable', 'false');

        titleEl.innerHTML = `
            <textarea class="inline-note-editor" placeholder="輸入便條紙內容...">${escapeHtml(originalContent)}</textarea>
            <div class="inline-editor-tips">Ctrl+Enter 儲存 · Esc 取消 · 點擊外部自動儲存</div>
        `;

        const textarea = titleEl.querySelector('.inline-note-editor');
        if (!textarea) return;

        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        const autoAdjustHeight = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(90, textarea.scrollHeight) + 'px';
        };
        autoAdjustHeight();
        textarea.addEventListener('input', autoAdjustHeight);

        textarea.addEventListener('mousedown', (e) => e.stopPropagation());
        textarea.addEventListener('mouseup', (e) => e.stopPropagation());
        textarea.addEventListener('click', (e) => e.stopPropagation());
        textarea.addEventListener('dblclick', (e) => e.stopPropagation());

        let isExited = false;

        async function saveAndClose() {
            if (isExited) return;
            isExited = true;
            const newContent = textarea.value.trim();
            if (!newContent) {
                note.content = originalContent;
            } else if (newContent !== originalContent) {
                note.content = newContent;
                await Storage.save();
            }
            render();
        }

        function cancelAndClose() {
            if (isExited) return;
            isExited = true;
            render();
        }

        textarea.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelAndClose();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveAndClose();
            }
        });

        textarea.addEventListener('blur', () => {
            setTimeout(() => {
                saveAndClose();
            }, 120);
        });
    }

    /**
     * ================= 清單拖曳排序處理 (List Drag & Drop) =================
     */
    function handleDragStart(event, catIdx, itemIdx) {
        event.stopPropagation();
        draggedItemInfo = { catIdx, itemIdx };
        draggedCategoryInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-note');
        setTimeout(() => {
            event.target.classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragStart(event, catIdx) {
        event.stopPropagation();
        draggedCategoryInfo = { catIdx };
        draggedItemInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-category');
        setTimeout(() => {
            event.target.closest('.category').classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragEnd(event) {
        event.target.closest('.category')?.classList.remove('dragging');
        draggedCategoryInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
        document.querySelectorAll('.drag-target-over').forEach(el => el.classList.remove('drag-target-over'));
    }

    function handleDragEnd(event) {
        event.target.classList.remove('dragging');
        draggedItemInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
        document.querySelectorAll('.drag-target-over').forEach(el => el.classList.remove('drag-target-over'));
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(event) {
        const catEl = event.currentTarget;
        if (!catEl.contains(event.relatedTarget)) {
            catEl.classList.remove('drag-over');
        }
    }

    function handleItemDragOver(event) {
        if (!draggedItemInfo) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-target-over');
    }

    function handleItemDragLeave(event) {
        const itemEl = event.currentTarget;
        if (!itemEl.contains(event.relatedTarget)) {
            itemEl.classList.remove('drag-target-over');
        }
    }

    async function handleItemDrop(event, targetCatIdx, targetItemIdx) {
        event.preventDefault();
        event.stopPropagation();
        document.querySelectorAll('.drag-target-over').forEach(el => el.classList.remove('drag-target-over'));
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));

        if (!draggedItemInfo) return;

        const sourceCatIdx = draggedItemInfo.catIdx;
        const sourceItemIdx = draggedItemInfo.itemIdx;

        const categories = getNotes();
        const sourceList = categories[sourceCatIdx]?.items;
        const targetList = categories[targetCatIdx]?.items;
        if (!sourceList || !targetList) return;

        if (sourceCatIdx === targetCatIdx) {
            if (sourceItemIdx === targetItemIdx) return;
            const [movedItem] = sourceList.splice(sourceItemIdx, 1);
            targetList.splice(targetItemIdx, 0, movedItem);
        } else {
            const [movedItem] = sourceList.splice(sourceItemIdx, 1);
            targetList.splice(targetItemIdx, 0, movedItem);
        }

        draggedItemInfo = null;
        await Storage.save();
        render();
    }

    async function handleDrop(event, targetCatIdx) {
        event.preventDefault();
        event.stopPropagation();
        const catEl = event.currentTarget;
        catEl.classList.remove('drag-over');

        const categories = getNotes();

        if (draggedItemInfo) {
            const sourceCatIdx = draggedItemInfo.catIdx;
            const sourceItemIdx = draggedItemInfo.itemIdx;

            const sourceList = categories[sourceCatIdx]?.items;
            const targetList = categories[targetCatIdx]?.items;
            if (!sourceList || !targetList) return;

            if (sourceCatIdx === targetCatIdx) {
                if (sourceItemIdx !== sourceList.length - 1) {
                    const [movedItem] = sourceList.splice(sourceItemIdx, 1);
                    targetList.push(movedItem);
                    await Storage.save();
                    render();
                }
            } else {
                const [movedItem] = sourceList.splice(sourceItemIdx, 1);
                targetList.push(movedItem);
                await Storage.save();
                render();
            }
            draggedItemInfo = null;
        } else if (draggedCategoryInfo) {
            const sourceCatIdx = draggedCategoryInfo.catIdx;
            if (sourceCatIdx === targetCatIdx) return;

            const [movedCat] = categories.splice(sourceCatIdx, 1);
            categories.splice(targetCatIdx, 0, movedCat);

            draggedCategoryInfo = null;
            await Storage.save();
            render();
        }
    }

    /**
     * ================= Modal 彈窗與 CRUD =================
     */
    function openAddCategory() {
        Modal.open({
            title: '新增便條紙分類群組',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" placeholder="例如: 伺服器資訊"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                const categories = getNotes();
                const newX = 60 + (categories.length % 3) * 440;
                const newY = 60 + Math.floor(categories.length / 3) * 380;
                categories.push({
                    category: val,
                    items: [],
                    collapsed: false,
                    x: newX,
                    y: newY,
                    w: 360,
                    h: 220
                });
                await Storage.save();
                render();
                showToast(`已新增分類「${val}」`);
                return true;
            }
        });
    }

    function openEditCategory(catIdx) {
        const cat = getNotes()[catIdx];
        Modal.open({
            title: '編輯分類名稱',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" value="${escapeHtml(cat.category)}"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                cat.category = val;
                await Storage.save();
                render();
                showToast(`已重新命名為「${val}」`);
                return true;
            }
        });
    }

    async function deleteCategory(catIdx) {
        const cat = getNotes()[catIdx];
        if (!confirm(`確定要刪除分類「${cat.category}」及其所有便條紙嗎？`)) return;
        getNotes().splice(catIdx, 1);
        await Storage.save();
        render();
        showToast('已刪除該分類群組');
    }

    function openAddNote(catIdx) {
        Modal.open({
            title: '新增便條紙',
            html: `
                <div class="form-group">
                    <label>便條紙顏色</label>
                    <input type="color" id="ipt-color" value="#fde047" style="height:35px; border-radius:4px; padding:2px; cursor:pointer;">
                </div>
                <div class="form-group">
                    <label>筆記內容</label>
                    <textarea id="ipt-content" rows="6" placeholder="輸入內容..." style="width:100%; background:var(--bg-color); border:1px solid var(--border-color); color:white; padding:10px; border-radius:6px; outline:none; resize:vertical;"></textarea>
                </div>
            `,
            onConfirm: async () => {
                const content = document.getElementById('ipt-content').value.trim();
                const color = document.getElementById('ipt-color').value;
                if (!content) {
                    alert('內容為必填');
                    return false;
                }
                const cat = getNotes()[catIdx];
                if (!cat.items) cat.items = [];

                // 畫布位置初始化
                const existingCount = cat.items.length;
                const noteX = 16 + (existingCount % 2) * 280;
                const noteY = 54 + Math.floor(existingCount / 2) * 190;

                cat.items.push({
                    content,
                    color,
                    x: noteX,
                    y: noteY,
                    width: '260px',
                    height: '170px'
                });

                // 若群組目前為收合狀態則自動展開
                cat.collapsed = false;

                await Storage.save();
                render();
                showToast('已新增便條紙！');
                return true;
            }
        });
    }

    function openEditNote(catIdx, itemIdx) {
        const item = getNotes()[catIdx].items[itemIdx];
        const bgColor = item.color || '#fde047';

        Modal.open({
            title: '完整編輯便條紙',
            html: `
                <div class="form-group">
                    <label>便條紙顏色</label>
                    <input type="color" id="ipt-color" value="${bgColor}" style="height:35px; border-radius:4px; padding:2px; cursor:pointer;">
                </div>
                <div class="form-group">
                    <label>筆記內容</label>
                    <textarea id="ipt-content" rows="6" style="width:100%; background:var(--bg-color); border:1px solid var(--border-color); color:white; padding:10px; border-radius:6px; outline:none; resize:vertical;">${escapeHtml(item.content || '')}</textarea>
                </div>
            `,
            onConfirm: async () => {
                const content = document.getElementById('ipt-content').value.trim();
                const color = document.getElementById('ipt-color').value;
                if (!content) {
                    alert('內容為必填');
                    return false;
                }
                item.content = content;
                item.color = color;
                await Storage.save();
                render();
                showToast('已儲存便條紙修改！');
                return true;
            }
        });
    }

    async function deleteNote(catIdx, itemIdx) {
        if (!confirm('確定要刪除此便條紙嗎？')) return;
        getNotes()[catIdx].items.splice(itemIdx, 1);
        await Storage.save();
        render();
        showToast('已刪除便條紙');
    }

    /**
     * 監聽清單卡片拖拉尺寸變化
     */
    document.addEventListener('mouseup', async (e) => {
        const card = e.target.closest('.note-card');
        if (card) {
            const catIdx = card.getAttribute('data-cat-idx');
            const itemIdx = card.getAttribute('data-item-idx');
            const notes = getNotes();
            if (catIdx !== null && itemIdx !== null && notes[catIdx] && notes[catIdx].items[itemIdx]) {
                const item = notes[catIdx].items[itemIdx];
                const newW = card.style.width;
                const newH = card.style.height;
                let changed = false;
                if (newW && item.width !== newW) { item.width = newW; changed = true; }
                if (newH && item.height !== newH) { item.height = newH; changed = true; }
                if (changed) {
                    await Storage.save();
                }
            }
        }
    });

    /**
     * 初始化入口
     */
    function init() {
        initDOM();
        setupCanvasInteractions();
        applyTransform();

        Storage.init(() => {
            // 初次載入若缺少座標則啟動自動排版
            const categories = getNotes();
            const needsLayout = categories.some(cat => cat.x === undefined || cat.y === undefined);
            if (needsLayout && categories.length > 0) {
                autoLayout();
            } else {
                switchView(currentView);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 公開 API
    return {
        render,
        switchView,
        handleSearch,
        focusGroup,
        fitAll,
        autoLayout,
        resetView,
        toggleCanvasCategory,
        toggleCategory,
        copyNoteContent,
        onGroupHeaderMouseDown,
        onNoteHeaderMouseDown,
        handleDragStart,
        handleCategoryDragStart,
        handleCategoryDragEnd,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleItemDragOver,
        handleItemDragLeave,
        handleItemDrop,
        handleDrop,
        openAddCategory,
        openEditCategory,
        deleteCategory,
        openAddNote,
        openEditNote,
        deleteNote,
        enableInlineEdit
    };
})();

window.NotesApp = NotesApp;
