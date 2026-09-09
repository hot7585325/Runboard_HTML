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

    // 計算截止日期狀態與產生 Badge HTML
    function getDueDateBadge(dueDate, isDone) {
        if (!dueDate) return '';

        const parts = dueDate.split('-').map(Number);
        if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return '';

        const [y, m, d] = parts;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(y, m - 1, d);

        const diffMs = target.getTime() - today.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const formattedDate = `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;

        if (isDone) {
            return `<span class="task-due-badge done" title="截止日: ${escapeHtml(dueDate)}">📅 ${formattedDate}</span>`;
        }

        if (diffDays < 0) {
            const overdueDays = Math.abs(diffDays);
            const text = overdueDays === 1 ? '⚠️ 逾期 1 天' : `⚠️ 逾期 ${overdueDays} 天`;
            return `<span class="task-due-badge overdue" title="截止日: ${escapeHtml(dueDate)}">${text} (${formattedDate})</span>`;
        } else if (diffDays === 0) {
            return `<span class="task-due-badge today" title="截止日: ${escapeHtml(dueDate)}">⚡ 今天到期</span>`;
        } else if (diffDays === 1) {
            return `<span class="task-due-badge tomorrow" title="截止日: ${escapeHtml(dueDate)}">⏰ 明天到期</span>`;
        } else {
            return `<span class="task-due-badge future" title="截止日: ${escapeHtml(dueDate)}">📅 ${formattedDate}</span>`;
        }
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
                    const dueBadge = getDueDateBadge(task.dueDate, status === 'done');

                    html += `
                    <div class="task-item" draggable="true"
                        ondragstart="TasksApp.handleDragStart(event, ${catIdx}, ${taskIdx})"
                        ondragend="TasksApp.handleDragEnd(event)"
                        ondragover="TasksApp.handleItemDragOver(event)"
                        ondragleave="TasksApp.handleItemDragLeave(event)"
                        ondrop="TasksApp.handleItemDrop(event, ${catIdx}, ${taskIdx})">
                        <div class="status-badge status-${status}" onclick="TasksApp.toggleTaskStatus(${catIdx}, ${taskIdx})">${statusStr}</div>
                        <div class="task-text ${doneClass}">${escapeHtml(task.text || '')}</div>
                        ${dueBadge}
                        <div class="task-actions">
                            <button class="btn btn-small" onclick="TasksApp.openEditTask(${catIdx}, ${taskIdx})">✏️</button>
                            <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="TasksApp.deleteTask(${catIdx}, ${taskIdx})">🗑️</button>
                        </div>
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

    // 切換任務狀態: not_started -> in_progress -> done -> not_started
    async function toggleTaskStatus(catIdx, taskIdx) {
        const task = getTasks()[catIdx]?.items[taskIdx];
        if (!task) return;

        if (task.status === 'not_started') task.status = 'in_progress';
        else if (task.status === 'in_progress') task.status = 'done';
        else task.status = 'not_started';

        await Storage.save();
        render();
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
                    <label>任務內容</label>
                    <input type="text" id="ipt-task" placeholder="輸入任務內容...">
                </div>
                <div class="form-group">
                    <label>截止日期 (選填)</label>
                    <input type="date" id="ipt-task-due">
                </div>
            `,
            onConfirm: async () => {
                const text = document.getElementById('ipt-task').value.trim();
                if (!text) {
                    alert('內容為必填');
                    return false;
                }
                const dueDate = document.getElementById('ipt-task-due').value || null;
                const cat = getTasks()[catIdx];
                if (!cat.items) cat.items = [];
                const newTask = { text, status: 'not_started' };
                if (dueDate) newTask.dueDate = dueDate;
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
                    <label>任務內容</label>
                    <input type="text" id="ipt-task" value="${escapeHtml(task.text || '')}">
                </div>
                <div class="form-group">
                    <label>截止日期 (選填)</label>
                    <input type="date" id="ipt-task-due" value="${task.dueDate || ''}">
                </div>
            `,
            onConfirm: async () => {
                const text = document.getElementById('ipt-task').value.trim();
                if (!text) {
                    alert('內容為必填');
                    return false;
                }
                const dueDate = document.getElementById('ipt-task-due').value || null;
                task.text = text;
                if (dueDate) {
                    task.dueDate = dueDate;
                } else {
                    delete task.dueDate;
                }
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
