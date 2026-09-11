/**
 * Runboard - 任務清單 (Tasks) 專屬邏輯
 */
const TasksApp = (function () {
    let draggedItemInfo = null;
    let draggedCategoryInfo = null;
    let searchKeyword = '';
    let hideDone = false;

    function getTasks() {
        const data = Storage.getData();
        if (!data.tasks) data.tasks = [];
        return data.tasks;
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

    // 解析 YYYY-MM-DD 為 Date 物件 (以本地時區計算)
    function parseDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-').map(Number);
        if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function formatShortDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length >= 3) {
            return `${parts[1]}/${parts[2]}`;
        }
        return dateStr;
    }

    // 計算排程時間狀態與產生 Badge HTML (支援開始日期與截止日期)
    function getScheduleBadge(startDate, dueDate, isDone) {
        if (!startDate && !dueDate) return '';

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startObj = parseDate(startDate);
        const dueObj = parseDate(dueDate);

        const startStr = formatShortDate(startDate);
        const dueStr = formatShortDate(dueDate);

        // 顯示字串組合 (例如 09/12 ~ 09/18 或 單一日期)
        let labelDate = '';
        let fullTitle = '';
        if (startDate && dueDate) {
            labelDate = `${startStr} ~ ${dueStr}`;
            fullTitle = `排程: ${startDate} 至 ${dueDate}`;
        } else if (dueDate) {
            labelDate = dueStr;
            fullTitle = `截止日: ${dueDate}`;
        } else {
            labelDate = `${startStr} 起`;
            fullTitle = `開始日: ${startDate}`;
        }

        // 1. 已完成狀態
        if (isDone) {
            return `<span class="task-due-badge done" title="${escapeHtml(fullTitle)}">📅 ${labelDate}</span>`;
        }

        // 2. 截止日判斷
        if (dueObj) {
            const diffMs = dueObj.getTime() - today.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                const overdueDays = Math.abs(diffDays);
                const text = overdueDays === 1 ? '⚠️ 逾期 1 天' : `⚠️ 逾期 ${overdueDays} 天`;
                return `<span class="task-due-badge overdue" title="${escapeHtml(fullTitle)}">${text} (${labelDate})</span>`;
            } else if (diffDays === 0) {
                return `<span class="task-due-badge today" title="${escapeHtml(fullTitle)}">⚡ 今天到期 (${labelDate})</span>`;
            } else if (diffDays === 1) {
                return `<span class="task-due-badge tomorrow" title="${escapeHtml(fullTitle)}">⏰ 明天到期 (${labelDate})</span>`;
            }
        }

        // 3. 開始日判斷 (尚未到達開始日期)
        if (startObj) {
            const diffStartMs = startObj.getTime() - today.getTime();
            const diffStartDays = Math.round(diffStartMs / (1000 * 60 * 60 * 24));
            if (diffStartDays > 0) {
                return `<span class="task-due-badge not-started-yet" title="${escapeHtml(fullTitle)}">⏳ 預計 ${startStr} 開始</span>`;
            }
        }

        // 4. 一般日程
        return `<span class="task-due-badge future" title="${escapeHtml(fullTitle)}">📅 ${labelDate}</span>`;
    }

    // 保留向後相容別名
    function getDueDateBadge(dueDate, isDone) {
        return getScheduleBadge(null, dueDate, isDone);
    }

    function handleSearch(keyword) {
        searchKeyword = (keyword || '').trim().toLowerCase();
        render();
    }

    function toggleHideDone() {
        hideDone = !hideDone;
        const btn = document.getElementById('btn-toggle-done');
        const lbl = document.getElementById('lbl-toggle-done');
        if (btn) {
            if (hideDone) {
                btn.classList.add('active');
                if (lbl) lbl.innerText = '顯示全部';
            } else {
                btn.classList.remove('active');
                if (lbl) lbl.innerText = '隱藏已完成';
            }
        }
        render();
    }

    function render() {
        const listContainer = document.getElementById('tasks-list');
        if (!listContainer) return;

        const categories = getTasks();
        let html = '';
        let totalMatched = 0;

        categories.forEach((cat, catIdx) => {
            const isCollapsed = cat.collapsed ? 'collapsed' : '';
            const catNameMatches = searchKeyword && cat.category && cat.category.toLowerCase().includes(searchKeyword);

            const totalCount = cat.items ? cat.items.length : 0;
            const doneCount = cat.items ? cat.items.filter(item => item.status === 'done').length : 0;
            const isAllDone = totalCount > 0 && doneCount === totalCount;

            // 篩選欲顯示的項目
            const itemsToRender = [];
            if (cat.items) {
                cat.items.forEach((task, taskIdx) => {
                    if (hideDone && task.status === 'done') return;
                    if (searchKeyword) {
                        const textMatch = task.text && task.text.toLowerCase().includes(searchKeyword);
                        if (!textMatch && !catNameMatches) return;
                    }
                    itemsToRender.push({ task, taskIdx });
                });
            }

            // 搜尋時若完全無相符項目且分類名亦不符，則跳過此分類
            if (searchKeyword && itemsToRender.length === 0 && !catNameMatches) {
                return;
            }

            totalMatched += itemsToRender.length;

            html += `
            <div class="category" ondragover="TasksApp.handleDragOver(event)" ondragleave="TasksApp.handleDragLeave(event)" ondrop="TasksApp.handleDrop(event, ${catIdx})">
                <div class="category-header">
                    <div class="category-title-area" draggable="true" ondragstart="TasksApp.handleCategoryDragStart(event, ${catIdx})" ondragend="TasksApp.handleCategoryDragEnd(event)" onclick="TasksApp.toggleCategory(${catIdx})">
                        <span class="toggle-icon ${isCollapsed}">▼</span>
                        <div class="category-name">
                            <span>${escapeHtml(cat.category)}</span>
                            <span class="task-progress-badge ${isAllDone ? 'all-done' : ''}">已完成 ${doneCount}/${totalCount}</span>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-small" onclick="TasksApp.openAddTask(${catIdx})">＋新增任務</button>
                        <button class="btn btn-small" onclick="TasksApp.openEditCategory(${catIdx})">✏️</button>
                        <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="TasksApp.deleteCategory(${catIdx})">🗑️</button>
                    </div>
                </div>
                <div class="task-list ${isCollapsed}">
            `;

            if (itemsToRender.length > 0) {
                itemsToRender.forEach(({ task, taskIdx }) => {
                    const status = task.status || 'not_started';
                    const statusStr = status === 'done' ? '完成' : status === 'in_progress' ? '進行中' : '未開始';
                    const doneClass = status === 'done' ? 'status-done' : '';
                    const scheduleBadge = getScheduleBadge(task.startDate, task.dueDate, status === 'done');

                    const hasDesc = Boolean(task.description && task.description.trim());
                    const hasSolution = Boolean(task.solution && task.solution.trim());
                    const hasDetails = hasDesc || hasSolution;

                    let expandBtnHtml = '';
                    if (hasDetails) {
                        expandBtnHtml = `
                        <button type="button" class="btn-expand-details ${task._expanded ? 'active' : ''}" onclick="TasksApp.toggleTaskExpand(${catIdx}, ${taskIdx})" title="${task._expanded ? '收合詳情' : '展開詳情'}">
                            <span>${hasSolution ? '💡' : '📄'} 詳情</span>
                            <span class="arrow-icon">▼</span>
                        </button>
                        `;
                    }

                    let detailsHtml = '';
                    if (hasDetails) {
                        detailsHtml = `
                        <div class="task-details ${task._expanded ? '' : 'collapsed'}">
                            ${hasDesc ? `
                                <div class="task-desc-box">
                                    <div class="task-desc-header">📝 詳細說明</div>
                                    <div>${escapeHtml(task.description.trim())}</div>
                                </div>
                            ` : ''}
                            ${hasSolution ? `
                                <div class="task-solution-box">
                                    <div class="task-solution-header">💡 完成解法與備註</div>
                                    <div>${escapeHtml(task.solution.trim())}</div>
                                </div>
                            ` : ''}
                        </div>
                        `;
                    }

                    html += `
                    <div class="task-item" draggable="true"
                        ondragstart="TasksApp.handleDragStart(event, ${catIdx}, ${taskIdx})"
                        ondragend="TasksApp.handleDragEnd(event)"
                        ondragover="TasksApp.handleItemDragOver(event)"
                        ondragleave="TasksApp.handleItemDragLeave(event)"
                        ondrop="TasksApp.handleItemDrop(event, ${catIdx}, ${taskIdx})">
                        <div class="task-main-row">
                            <div class="status-badge status-${status}" onclick="TasksApp.toggleTaskStatus(${catIdx}, ${taskIdx})">${statusStr}</div>
                            <div class="task-text ${doneClass}">${escapeHtml(task.text || '')}</div>
                            ${scheduleBadge}
                            ${expandBtnHtml}
                            <div class="task-actions">
                                ${status === 'done' ? `<button class="btn btn-small" title="記錄或編輯解法備註" onclick="TasksApp.promptSolution(${catIdx}, ${taskIdx})">💡</button>` : ''}
                                <button class="btn btn-small" onclick="TasksApp.openEditTask(${catIdx}, ${taskIdx})">✏️</button>
                                <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="TasksApp.deleteTask(${catIdx}, ${taskIdx})">🗑️</button>
                            </div>
                        </div>
                        ${detailsHtml}
                    </div>
                    `;
                });
            } else if (hideDone && totalCount > 0) {
                html += `<div style="color: var(--text-secondary); font-size: 13px; font-style: italic; padding: 10px 15px;">🎉 本分類所有任務皆已完成！</div>`;
            }

            html += `</div></div>`;
        });

        if (searchKeyword && totalMatched === 0 && categories.length > 0) {
            html = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">沒有找到符合「${escapeHtml(searchKeyword)}」的任務</div>`;
        }

        listContainer.innerHTML = html;
    }

    // 切換單一任務詳細內容展開/收合
    function toggleTaskExpand(catIdx, taskIdx) {
        const task = getTasks()[catIdx]?.items[taskIdx];
        if (!task) return;
        task._expanded = !task._expanded;
        render();
    }

    // 彈出解法/覆盤備註記錄視窗
    function promptSolution(catIdx, taskIdx) {
        const task = getTasks()[catIdx]?.items[taskIdx];
        if (!task) return;

        Modal.open({
            title: '💡 記錄完成解法與覆盤備註',
            html: `
                <div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; line-height: 1.5;">
                    任務：<strong style="color: white;">${escapeHtml(task.text)}</strong><br>
                    可在此記錄此問題的解法、踩坑心得或關鍵收穫（留空儲存則清空備註）：
                </div>
                <div class="form-group">
                    <label>解法與備註說明 (支援多行)</label>
                    <textarea id="ipt-task-solution" rows="5" placeholder="例如：在某模組修復了快取機制，需注意跨平台時區差異...">${escapeHtml(task.solution || '')}</textarea>
                </div>
            `,
            onConfirm: async () => {
                const sol = document.getElementById('ipt-task-solution').value.trim();
                if (sol) {
                    task.solution = sol;
                    task._expanded = true; // 填寫後預設展開以利檢視
                } else {
                    delete task.solution;
                }
                await Storage.save();
                render();
                return true;
            }
        });
    }

    // 切換任務狀態: not_started -> in_progress -> done -> not_started
    async function toggleTaskStatus(catIdx, taskIdx) {
        const task = getTasks()[catIdx]?.items[taskIdx];
        if (!task) return;

        let shouldPromptSolution = false;
        if (task.status === 'not_started') {
            task.status = 'in_progress';
        } else if (task.status === 'in_progress') {
            task.status = 'done';
            if (!task.solution) {
                shouldPromptSolution = true;
            }
        } else {
            task.status = 'not_started';
        }

        await Storage.save();
        render();

        if (shouldPromptSolution) {
            setTimeout(() => {
                promptSolution(catIdx, taskIdx);
            }, 60);
        }
    }

    // 收合分類
    async function toggleCategory(catIdx) {
        const cat = getTasks()[catIdx];
        if (!cat) return;
        cat.collapsed = !cat.collapsed;
        await Storage.save();
        render();
    }

    // 拖曳處理
    function handleDragStart(event, catIdx, itemIdx) {
        event.stopPropagation();
        draggedItemInfo = { catIdx, itemIdx };
        draggedCategoryInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-task');
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

        const categories = getTasks();
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

        const categories = getTasks();

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

    // Modal 與 CRUD
    function openAddCategory() {
        Modal.open({
            title: '新增任務分類',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" placeholder="例如: 🚀 待辦衝刺"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                getTasks().push({ category: val, items: [], collapsed: false });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditCategory(catIdx) {
        const cat = getTasks()[catIdx];
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
                return true;
            }
        });
    }

    async function deleteCategory(catIdx) {
        if (!confirm('確定要刪除此分類及所有任務嗎？')) return;
        getTasks().splice(catIdx, 1);
        await Storage.save();
        render();
    }

    function openAddTask(catIdx) {
        Modal.open({
            title: '新增任務',
            html: `
                <div class="form-group">
                    <label>任務主旨 / 標題</label>
                    <input type="text" id="ipt-task" placeholder="輸入任務主旨...">
                </div>
                <div style="display: flex; gap: 12px;">
                    <div class="form-group" style="flex: 1;">
                        <label>開始日期 (選填)</label>
                        <input type="date" id="ipt-task-start">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>截止日期 (選填)</label>
                        <input type="date" id="ipt-task-due">
                    </div>
                </div>
                <div class="form-group">
                    <label>詳細內文說明 (選填，支援多行)</label>
                    <textarea id="ipt-task-desc" rows="3" placeholder="輸入任務背景、具體步驟或驗收標準..."></textarea>
                </div>
            `,
            onConfirm: async () => {
                const text = document.getElementById('ipt-task').value.trim();
                if (!text) {
                    alert('任務主旨為必填');
                    return false;
                }
                const startDate = document.getElementById('ipt-task-start').value || null;
                const dueDate = document.getElementById('ipt-task-due').value || null;
                const description = document.getElementById('ipt-task-desc').value.trim() || null;

                const cat = getTasks()[catIdx];
                if (!cat.items) cat.items = [];

                const newTask = { text, status: 'not_started' };
                if (startDate) newTask.startDate = startDate;
                if (dueDate) newTask.dueDate = dueDate;
                if (description) newTask.description = description;

                cat.items.push(newTask);
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditTask(catIdx, taskIdx) {
        const task = getTasks()[catIdx].items[taskIdx];
        Modal.open({
            title: '編輯任務',
            html: `
                <div class="form-group">
                    <label>任務主旨 / 標題</label>
                    <input type="text" id="ipt-task" value="${escapeHtml(task.text || '')}">
                </div>
                <div style="display: flex; gap: 12px;">
                    <div class="form-group" style="flex: 1;">
                        <label>開始日期 (選填)</label>
                        <input type="date" id="ipt-task-start" value="${task.startDate || ''}">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>截止日期 (選填)</label>
                        <input type="date" id="ipt-task-due" value="${task.dueDate || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>詳細內文說明 (選填，支援多行)</label>
                    <textarea id="ipt-task-desc" rows="3" placeholder="輸入任務背景、具體步驟或驗收標準...">${escapeHtml(task.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>💡 完成解法與覆盤備註 (選填)</label>
                    <textarea id="ipt-task-sol" rows="3" placeholder="記錄完成解法、心得或關鍵經驗...">${escapeHtml(task.solution || '')}</textarea>
                </div>
            `,
            onConfirm: async () => {
                const text = document.getElementById('ipt-task').value.trim();
                if (!text) {
                    alert('任務主旨為必填');
                    return false;
                }
                const startDate = document.getElementById('ipt-task-start').value || null;
                const dueDate = document.getElementById('ipt-task-due').value || null;
                const description = document.getElementById('ipt-task-desc').value.trim() || null;
                const solution = document.getElementById('ipt-task-sol').value.trim() || null;

                task.text = text;

                if (startDate) task.startDate = startDate;
                else delete task.startDate;

                if (dueDate) task.dueDate = dueDate;
                else delete task.dueDate;

                if (description) task.description = description;
                else delete task.description;

                if (solution) task.solution = solution;
                else delete task.solution;

                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deleteTask(catIdx, taskIdx) {
        if (!confirm('確定要刪除此任務嗎？')) return;
        getTasks()[catIdx].items.splice(taskIdx, 1);
        await Storage.save();
        render();
    }

    // 初始化載入
    document.addEventListener('DOMContentLoaded', () => {
        Storage.init(() => {
            render();
        });
    });

    return {
        render,
        handleSearch,
        toggleHideDone,
        toggleTaskStatus,
        toggleTaskExpand,
        promptSolution,
        toggleCategory,
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
        openAddTask,
        openEditTask,
        deleteTask
    };
})();

window.TasksApp = TasksApp;
