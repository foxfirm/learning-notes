/**
 * SimpleTree - 轻量级树形拖拽插件
 * 依赖: jQuery
 * 特点: 无内联样式，所有样式通过 CSS 控制
 * 
 * 使用方法:
 *   $('#tree').simpleTree({ data: treeData, treeType: 'right' })
 *   $('#tree').simpleTree('addNode', { id: 'n1', text: '节点', pId: null })
 *   $('#tree').simpleTree('getData')
 *   $('#tree').simpleTree('toJson', true)
 */
(function($) {
    'use strict';

    // ========== 默认配置 ==========
    const defaults = {
        data: [],                    // 树数据 [{ id, text, children }]
        defaultCollapsed: true,     // 默认是否折叠
        treeType: 'right',          // 树类型: 'left' 只可拖出, 'right' 可拖入可内部移动
        dragThreshold: 5,           // 拖拽阈值（像素），超过此值才开始拖拽，防止误触发
        onCopy: null,               // 复制回调 (sourceNode, clonedNode, targetId, position)
        onMove: null,               // 移动回调 (node, targetId, position)
        onDragStart: null,          // 拖拽开始回调
        onDragEnd: null,            // 拖拽结束回调
        onAddNode: null,            // 添加节点回调
        onDeleteNode: null,         // 删除节点回调
        emptyText: '暂无数据，从左侧拖拽节点到这里',  // 空树提示文字
        allowDropToEmpty: true,     // 是否允许拖拽到空树区域
        duplicateCheck: true,       // 是否检查节点名称重复
        keepIdOnCopy: true          // 复制时是否保持原ID
    };

    // ========== 全局拖拽状态 ==========
    let dragState = {
        sourceNode: null,       // 源节点数据
        sourceTree: null,       // 源树容器
        sourceTreeType: null,   // 源树类型 'left'/'right'
        sourceId: null,         // 源节点ID
        clone: null,            // 拖拽克隆元素
        targetNode: null,       // 目标节点元素
        targetPosition: null,   // 目标位置 'before'/'after'/'inside'/'root'
        targetTree: null,       // 目标树容器
        isDragging: false,      // 是否正在拖拽中
        isValidDrop: false      // 当前是否可放置
    };

    // 存储所有实例的内部状态
    const instances = new Map();

    // ========== 辅助函数 ==========
    
    /**
     * 在树数据中查找节点
     * @param {Array} tree 树数据
     * @param {string} id 节点ID
     * @returns {Object|null} 节点信息 { node, parent, index, children }
     */
    function findNode(tree, id) {
        if (!tree) return null;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == id) {
                return { node, parent: null, index: i, children: tree };
            }
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) {
                    found.parent = node;
                    return found;
                }
            }
        }
        return null;
    }

    /**
     * 检查节点名称是否已存在
     */
    function isNodeNameExists(tree, name, excludeId = null) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.text === name && node.id !== excludeId) return true;
            if (node.children && isNodeNameExists(node.children, name, excludeId)) return true;
        }
        return false;
    }

    /**
     * 检查节点ID是否已存在
     */
    function isNodeIdExists(tree, id, excludeId = null) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            if (tree[i].id == id && tree[i].id !== excludeId) return true;
            if (tree[i].children && isNodeIdExists(tree[i].children, id, excludeId)) return true;
        }
        return false;
    }

    /**
     * 判断拖拽目标是否有效
     * 规则:
     *   - 左树 → 右树: 检查名称是否重复
     *   - 右树 → 右树: 不能移动到自身或后代
     *   - 左树 → 左树: 不允许
     */
    function isValidDropTarget(sourceNode, sourceType, targetType, targetNodeId, targetTreeData) {
        // 左树拖到右树：检查重复名称
        if (sourceType === 'left' && targetType === 'right') {
            return !isNodeNameExists(targetTreeData, sourceNode.text);
        }
        // 右树拖到右树：不能移动到自己或后代
        if (sourceType === 'right' && targetType === 'right') {
            if (sourceNode.id == targetNodeId) return false;
            return !isDescendant(sourceNode, targetNodeId);
        }
        return false;
    }

    /**
     * 检查 ancestorId 是否是 descendantId 的祖先
     */
    function isDescendant(parentNode, childId) {
        if (!parentNode?.children) return false;
        for (const child of parentNode.children) {
            if (child.id == childId) return true;
            if (isDescendant(child, childId)) return true;
        }
        return false;
    }

    /**
     * 从树中删除节点
     */
    function removeNode(tree, id) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            if (tree[i].id == id) {
                tree.splice(i, 1);
                return true;
            }
            if (tree[i].children && removeNode(tree[i].children, id)) return true;
        }
        return false;
    }

    /**
     * 插入节点到指定位置
     * @param {Array} tree 树数据
     * @param {string} targetId 目标节点ID
     * @param {Object} newNode 新节点
     * @param {string} position 'before'/'after'/'inside'
     */
    function insertNode(tree, targetId, newNode, position) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == targetId) {
                if (position === 'inside') {
                    if (!node.children) node.children = [];
                    node.children.push(newNode);
                } else if (position === 'before') {
                    tree.splice(i, 0, newNode);
                } else if (position === 'after') {
                    tree.splice(i + 1, 0, newNode);
                }
                return true;
            }
            if (node.children && insertNode(node.children, targetId, newNode, position)) return true;
        }
        return false;
    }

    /**
     * 根据父节点ID添加节点（支持多层级查找）
     */
    function addNodeByParentId(tree, newNode, parentId) {
        if (!parentId) {
            tree.push(newNode);
            return true;
        }
        for (let i = 0; i < tree.length; i++) {
            if (tree[i].id == parentId) {
                if (!tree[i].children) tree[i].children = [];
                tree[i].children.push(newNode);
                return true;
            }
            if (tree[i].children && addNodeByParentId(tree[i].children, newNode, parentId)) return true;
        }
        return false;
    }

    /**
     * 克隆节点
     */
    function cloneNode(node, keepId) {
        const cloned = JSON.parse(JSON.stringify(node));
        if (!keepId) cloned.id = generateId();
        return cloned;
    }

    /**
     * 生成唯一ID
     */
    function generateId() {
        return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    /**
     * 收集所有节点的折叠状态
     */
    function collectCollapsedState($container) {
        const state = {};
        $container.find('li').each(function() {
            const $li = $(this);
            const nodeId = $li.data('id');
            if (!nodeId) return;
            const $children = $li.children('.node-children');
            if ($children.length && $children.is(':visible') === false) {
                state[nodeId] = true;  // true = 折叠
            } else if ($children.length) {
                state[nodeId] = false; // false = 展开
            }
        });
        return state;
    }

    /**
     * 恢复节点的折叠状态
     */
    function restoreCollapsedState($container, state) {
        $container.find('li').each(function() {
            const $li = $(this);
            const nodeId = $li.data('id');
            if (!nodeId || !state.hasOwnProperty(nodeId)) return;
            const $children = $li.children('.node-children');
            if (!$children.length) return;
            
            if (state[nodeId] === true) {
                $children.hide();
                $li.addClass('collapsed');
            } else {
                $children.show();
                $li.removeClass('collapsed');
            }
        });
    }

    /**
     * 获取拖拽放置位置（基于鼠标Y坐标比例）
     */
    function getDropPosition(e, targetEl) {
        if (!targetEl) return 'root';
        const rect = targetEl.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        if (ratio < 0.33) return 'before';
        if (ratio > 0.66) return 'after';
        return 'inside';
    }

    /**
     * HTML转义
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            return m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;');
        });
    }

    /**
     * 将树数据转换为扁平数组（带父节点ID）
     * 输出格式: [{ id, text, pId }, ...]
     */
    function treeToArray(nodes, parentId = null, result = []) {
        if (!nodes) return result;
        for (const node of nodes) {
            result.push({ id: node.id, text: node.text, pId: parentId });
            if (node.children) treeToArray(node.children, node.id, result);
        }
        return result;
    }

    /**
     * 导出树为JSON字符串
     */
    function treeToJson($container, pretty = false) {
        const flatArray = treeToArray($container.data('treeData'));
        return pretty ? JSON.stringify(flatArray, null, 2) : JSON.stringify(flatArray);
    }

    // ========== 渲染函数 ==========
    
    /**
     * 渲染树
     * @param {jQuery} $container 容器元素
     * @param {Array} data 树数据
     * @param {Object} options 配置项
     * @param {boolean} preserveState 是否保留折叠状态
     */
    function renderTree($container, data, options, preserveState = true) {
        const isEmpty = !data || !data.length;
        const instance = instances.get($container[0]);
        let collapsedState = {};

        // 保存/恢复折叠状态
        if (preserveState && !isEmpty && instance) {
            collapsedState = instance.collapsedState || collectCollapsedState($container);
        }

        /**
         * 递归构建HTML
         */
        function buildHtml(nodes) {
            let html = '<ul>';
            for (const node of nodes) {
                const hasChildren = node.children && node.children.length > 0;
                // 确定折叠状态
                let isCollapsed = options.defaultCollapsed;
                if (preserveState && collapsedState[node.id] !== undefined) {
                    isCollapsed = collapsedState[node.id];
                }
                const collapsedStyle = (hasChildren && isCollapsed) ? 'display: none;' : '';
                const collapsedClass = (hasChildren && isCollapsed) ? 'collapsed' : '';
                const isSelected = (instance && instance.selectedNodeId === node.id);
                const nodeTypeClass = hasChildren ? 'folder' : 'leaf';

                html += `<li data-id="${node.id}" class="${collapsedClass}">`;
                html += `<div class="tree-node ${nodeTypeClass} ${isSelected ? 'selected' : ''}" data-id="${node.id}">`;
                html += `<span class="toggle-icon ${hasChildren ? '' : 'empty'}"></span>`;
                html += `<span class="node-icon"></span>`;
                html += `<span class="node-content">${escapeHtml(node.text)}</span>`;
                html += `</div>`;
                if (hasChildren) {
                    html += `<div class="node-children" style="${collapsedStyle}">${buildHtml(node.children)}</div>`;
                }
                html += `</li>`;
            }
            html += '</ul>';
            return html;
        }

        // 空树处理
        if (isEmpty && options.allowDropToEmpty && options.treeType === 'right') {
            $container.html(`<div class="simple-tree-empty"><div class="empty-placeholder">${escapeHtml(options.emptyText)}</div></div>`);
            bindEmptyEvents($container, options);
        } else if (isEmpty) {
            $container.html('<div class="tree-node">无数据</div>');
        } else {
            $container.html(buildHtml(data));
            if (preserveState && Object.keys(collapsedState).length) {
                restoreCollapsedState($container, collapsedState);
            }
            bindEvents($container, options);
        }

        // 更新实例中的折叠状态
        if (instance) {
            instance.collapsedState = collectCollapsedState($container);
        }
    }

    // ========== 事件绑定（带阈值检测） ==========
    
    /**
     * 绑定树事件（点击、双击、拖拽）
     * 拖拽采用阈值检测：只有鼠标移动超过 dragThreshold 像素才真正开始拖拽
     */
    function bindEvents($container, options) {
        const instance = instances.get($container[0]);

        // 点击箭头：切换折叠/展开
        $container.off('click', '.toggle-icon').on('click', '.toggle-icon', function(e) {
            e.stopPropagation();
            const $li = $(this).closest('li');
            const $children = $li.children('.node-children');
            if (!$children.length) return;
            
            if ($children.is(':visible')) {
                $children.hide();
                $li.addClass('collapsed');
                if (instance) instance.collapsedState[$li.data('id')] = true;
            } else {
                $children.show();
                $li.removeClass('collapsed');
                if (instance) instance.collapsedState[$li.data('id')] = false;
            }
        });

        // 双击文件夹：切换折叠/展开
        $container.off('dblclick', '.tree-node.folder').on('dblclick', '.tree-node.folder', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            const $li = $(this).closest('li');
            const $children = $li.children('.node-children');
            
            if ($children.length) {
                if ($children.is(':visible')) {
                    $children.hide();
                    $li.addClass('collapsed');
                    if (instance) instance.collapsedState[$li.data('id')] = true;
                } else {
                    $children.show();
                    $li.removeClass('collapsed');
                    if (instance) instance.collapsedState[$li.data('id')] = false;
                }
            }
        });

        // 单击节点：选中节点
        $container.off('click', '.tree-node').on('click', '.tree-node', function(e) {
            e.stopPropagation();
            const $node = $(this);
            const nodeId = $node.data('id');
            
            if (instance && instance.selectedNodeId) {
                $container.find(`.tree-node[data-id="${instance.selectedNodeId}"]`).removeClass('selected');
            }
            if (instance) instance.selectedNodeId = nodeId;
            $node.addClass('selected');
        });

        // 拖拽事件：带阈值检测（只有移动超过阈值才触发拖拽，避免误触发）
        $container.off('mousedown', '.tree-node').on('mousedown', '.tree-node', function(e) {
            // 只响应左键，且不处理箭头区域
            if (e.which !== 1) return;
            if ($(e.target).hasClass('toggle-icon')) return;
            
            e.preventDefault();
            
            const $node = $(this);
            const startX = e.clientX;
            const startY = e.clientY;
            let dragStarted = false;
            let isClick = true;
            
            /**
             * 检查鼠标移动距离，超过阈值则开始拖拽
             */
            const checkMove = function(moveEvent) {
                // 计算移动距离
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 超过阈值，开始拖拽
                if (distance >= options.dragThreshold && !dragStarted) {
                    dragStarted = true;
                    isClick = false;
                    // 移除临时监听器
                    $(document).off('mousemove.check mouseup.check');
                    // 开始真正的拖拽
                    startDrag(moveEvent, $node[0], $container, options);
                }
            };
            
            /**
             * 鼠标松开时清理
             */
            const cancelCheck = function() {
                $(document).off('mousemove.check mouseup.check');
                // 如果没有开始拖拽，说明是单击/双击，不需要额外处理
                // 选中节点已经在 click 事件中处理了
            };
            
            // 监听鼠标移动和松开
            $(document).on('mousemove.check', checkMove);
            $(document).on('mouseup.check', cancelCheck);
        });
    }

    /**
     * 绑定空树区域的拖拽事件
     */
    function bindEmptyEvents($container, options) {
        const $area = $container.find('.simple-tree-empty');
        $area.off('dragover dragleave drop');
        
        $area.on('dragover', function(e) {
            e.preventDefault();
            if (dragState.sourceNode && dragState.sourceTreeType === 'left' && options.treeType === 'right') {
                $(this).addClass('drag-over-empty');
                dragState.isValidDrop = true;
                dragState.targetPosition = 'root';
                dragState.targetTree = $container;
                updateCloneStatus(true);
            }
        });
        
        $area.on('dragleave', function() {
            $(this).removeClass('drag-over-empty');
            dragState.isValidDrop = false;
            updateCloneStatus(false);
        });
        
        $area.on('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('drag-over-empty');
            if (dragState.isValidDrop) {
                performDropToEmpty(options);
            }
        });
    }

    // ========== 拖拽核心逻辑 ==========
    
    /**
     * 开始拖拽（距离阈值已满足）
     */
    function startDrag(e, nodeEl, $container, options) {
        if (dragState.isDragging) cleanupDrag();
        
        const $node = $(nodeEl);
        const nodeId = $node.data('id');
        const treeData = $container.data('treeData');
        const nodeInfo = findNode(treeData, nodeId);
        if (!nodeInfo) return;

        // 保存拖拽源信息
        dragState.sourceNode = nodeInfo.node;
        dragState.sourceTree = $container;
        dragState.sourceTreeType = options.treeType;
        dragState.sourceId = nodeId;
        dragState.isDragging = true;
        dragState.isValidDrop = false;

        // 添加拖拽样式
        $node.addClass('dragging');

        // 创建克隆元素（样式完全由CSS控制）
        dragState.clone = $(`<div class="simple-tree-clone invalid">${escapeHtml(nodeInfo.node.text)}</div>`)
            .css({ top: e.clientY + 10, left: e.clientX + 10 })
            .appendTo('body');

        if (options.onDragStart) {
            options.onDragStart(nodeInfo.node, options.treeType);
        }

        // 绑定全局事件
        $(document).off('mousemove.simpleTree mouseup.simpleTree');
        $(document).on('mousemove.simpleTree', e => onDragMove(e, options));
        $(document).on('mouseup.simpleTree', e => onDragEnd(e, options));
    }

    /**
     * 拖拽移动中
     */
    function onDragMove(e, options) {
        if (!dragState.isDragging) return;
        e.preventDefault();

        // 更新克隆体位置
        if (dragState.clone) {
            dragState.clone.css({ top: e.clientY + 10, left: e.clientX + 10 });
        }

        // 查找鼠标下方的元素
        const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
        let targetNodeEl = null;
        let isEmptyArea = false;

        for (let i = 0; i < elemUnderCursor.length; i++) {
            const el = elemUnderCursor[i];
            if ($(el).hasClass('tree-node') && el !== dragState.sourceNode) {
                targetNodeEl = el;
                break;
            }
            if ($(el).hasClass('simple-tree-empty')) {
                isEmptyArea = true;
            }
        }

        // 清除旧的高亮
        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over-before drag-over-after drag-over-inside');
            dragState.targetNode = null;
        }

        // 处理空树区域拖拽
        if (isEmptyArea && dragState.sourceTreeType === 'left') {
            const $targetTree = $('.simple-tree-empty').closest('.simple-tree');
            const targetOpt = $targetTree.data('simpleTreeOptions');
            if (targetOpt?.treeType === 'right') {
                dragState.targetTree = $targetTree;
                dragState.targetPosition = 'root';
                dragState.isValidDrop = true;
                updateCloneStatus(true);
                return;
            }
        }

        // 处理普通节点拖拽
        if (targetNodeEl) {
            const $targetTree = $(targetNodeEl).closest('.simple-tree');
            const targetOpt = $targetTree.data('simpleTreeOptions');
            const targetTreeData = $targetTree.data('treeData') || [];
            const targetNodeId = $(targetNodeEl).data('id');
            
            const isValid = isValidDropTarget(
                dragState.sourceNode,
                dragState.sourceTreeType,
                targetOpt?.treeType,
                targetNodeId,
                targetTreeData
            );

            dragState.targetTree = $targetTree;
            dragState.isValidDrop = isValid;
            updateCloneStatus(isValid);

            if (isValid) {
                const position = getDropPosition(e, targetNodeEl);
                dragState.targetNode = targetNodeEl;
                dragState.targetPosition = position;
                $(targetNodeEl).addClass(`drag-over-${position === 'inside' ? 'inside' : position}`);
            }
        } else {
            dragState.isValidDrop = false;
            updateCloneStatus(false);
        }
    }

    /**
     * 拖拽结束
     */
    function onDragEnd(e, options) {
        if (!dragState.isDragging) {
            cleanupDrag();
            return;
        }

        let success = false;
        if (dragState.isValidDrop) {
            if (dragState.targetPosition === 'root') {
                success = performDropToEmpty(options);
            } else if (dragState.targetNode) {
                success = performDrop($(dragState.targetNode).data('id'), dragState.targetPosition);
            }
        }

        if (options.onDragEnd) {
            options.onDragEnd(dragState.sourceNode, success);
        }

        cleanupDrag();
        $('.simple-tree-empty').removeClass('drag-over-empty');
    }

    /**
     * 执行放置（普通节点）
     */
    function performDrop(targetId, position) {
        const sourceNode = dragState.sourceNode;
        const sourceTree = dragState.sourceTree;
        const sourceOpt = sourceTree.data('simpleTreeOptions');
        const targetTree = dragState.targetTree;
        const targetOpt = targetTree.data('simpleTreeOptions');

        if (!sourceOpt || !targetOpt) return false;

        // 左树 → 右树：复制
        if (sourceOpt.treeType === 'left' && targetOpt.treeType === 'right') {
            let targetData = targetTree.data('treeData') || [];
            if (sourceOpt.duplicateCheck && isNodeNameExists(targetData, sourceNode.text)) {
                updateCloneStatus(false);
                return false;
            }
            targetData = JSON.parse(JSON.stringify(targetData));
            const cloned = cloneNode(sourceNode, sourceOpt.keepIdOnCopy);
            if (insertNode(targetData, targetId, cloned, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, targetOpt, true);
                if (sourceOpt.onCopy) sourceOpt.onCopy(sourceNode, cloned, targetId, position);
                return true;
            }
        }
        // 右树 → 右树：移动
        else if (sourceOpt.treeType === 'right' && targetOpt.treeType === 'right') {
            let targetData = targetTree.data('treeData') || [];
            targetData = JSON.parse(JSON.stringify(targetData));
            if (sourceNode.id == targetId) return false;
            removeNode(targetData, sourceNode.id);
            if (insertNode(targetData, targetId, sourceNode, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, targetOpt, true);
                if (sourceOpt.onMove) sourceOpt.onMove(sourceNode, targetId, position);
                return true;
            }
        }
        return false;
    }

    /**
     * 执行放置（空树区域）
     */
    function performDropToEmpty(options) {
        const sourceNode = dragState.sourceNode;
        const sourceTree = dragState.sourceTree;
        const sourceOpt = sourceTree.data('simpleTreeOptions');
        const targetTree = dragState.targetTree;
        const targetOpt = targetTree.data('simpleTreeOptions');

        if (!sourceOpt || !targetOpt) return false;
        if (sourceOpt.treeType !== 'left' || targetOpt.treeType !== 'right') return false;

        let targetData = targetTree.data('treeData') || [];
        if (sourceOpt.duplicateCheck && isNodeNameExists(targetData, sourceNode.text)) return false;

        targetData = JSON.parse(JSON.stringify(targetData));
        const cloned = cloneNode(sourceNode, sourceOpt.keepIdOnCopy);
        targetData.push(cloned);
        targetTree.data('treeData', targetData);
        renderTree(targetTree, targetData, targetOpt, true);

        if (sourceOpt.onCopy) sourceOpt.onCopy(sourceNode, cloned, null, 'root');
        return true;
    }

    /**
     * 更新克隆体的状态样式（只添加/移除CSS类）
     * ✅/❌ 图标通过 CSS 的 ::before 伪元素显示
     */
    function updateCloneStatus(isValid) {
        if (dragState.clone) {
            dragState.clone.removeClass('valid invalid').addClass(isValid ? 'valid' : 'invalid');
        }
    }

    /**
     * 清理拖拽状态
     */
    function cleanupDrag() {
        if (dragState.sourceNode) {
            $('.tree-node.dragging').removeClass('dragging');
        }
        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over-before drag-over-after drag-over-inside');
        }
        if (dragState.clone) {
            dragState.clone.remove();
        }
        
        dragState = {
            sourceNode: null,
            sourceTree: null,
            sourceTreeType: null,
            sourceId: null,
            clone: null,
            targetNode: null,
            targetPosition: null,
            targetTree: null,
            isDragging: false,
            isValidDrop: false
        };
        
        $(document).off('mousemove.simpleTree mouseup.simpleTree');
    }

    // ========== 公共API方法 ==========
    
    /**
     * 搜索节点并高亮
     */
    function searchNodes($container, keyword) {
        const instance = instances.get($container[0]);
        if (!instance) return false;
        
        const treeData = $container.data('treeData');
        if (!keyword?.trim()) {
            clearHighlights($container);
            instance.currentKeyword = '';
            return false;
        }

        const lowerKw = keyword.toLowerCase();
        const matchedIds = [];

        function collectMatches(nodes, path) {
            if (!nodes) return;
            for (const node of nodes) {
                if (node.text?.toLowerCase().includes(lowerKw)) {
                    matchedIds.push(node.id);
                    path.forEach(p => matchedIds.push(p.id));
                }
                if (node.children) collectMatches(node.children, [...path, node]);
            }
        }
        collectMatches(treeData, []);

        // 展开匹配节点的父级
        matchedIds.forEach(id => {
            const $li = $container.find(`li[data-id="${id}"]`);
            const $children = $li.children('.node-children');
            if ($children.length && !$children.is(':visible')) {
                $children.show();
                $li.removeClass('collapsed');
                if (instance.collapsedState) instance.collapsedState[id] = false;
            }
        });

        // 高亮匹配的节点
        clearHighlights($container);
        $container.find('.tree-node').each(function() {
            const nodeInfo = findNode(treeData, $(this).data('id'));
            if (nodeInfo?.node.text?.toLowerCase().includes(lowerKw)) {
                $(this).addClass('highlight');
            }
        });

        instance.currentKeyword = keyword;
        return true;
    }

    function clearHighlights($container) {
        $container.find('.tree-node').removeClass('highlight');
    }

    function clearSearch($container) {
        const inst = instances.get($container[0]);
        if (inst) {
            inst.currentKeyword = '';
            clearHighlights($container);
        }
    }

    /**
     * 添加节点
     * @param {string|object} nodeData 节点名称 或 { id, text, pId, ... }
     * @param {string} targetParentId 目标父节点ID（可选）
     */
    function addNode($container, nodeData, targetParentId = null) {
        const instance = instances.get($container[0]);
        if (!instance) return null;
        
        const opt = instance.options;
        const treeData = $container.data('treeData');
        let newNode;
        let parentId = targetParentId;

        if (typeof nodeData === 'string') {
            const name = nodeData.trim();
            if (!name) return null;
            if (opt.duplicateCheck && isNodeNameExists(treeData, name)) {
                alert(`节点 "${name}" 已存在`);
                return null;
            }
            newNode = { id: generateId(), text: name, children: [] };
        } else if (typeof nodeData === 'object') {
            const name = nodeData.text || nodeData.name;
            if (!name) return null;
            let id = nodeData.id || generateId();
            if (isNodeIdExists(treeData, id)) {
                console.warn(`ID "${id}" 已存在`);
                return null;
            }
            const pId = nodeData.pId !== undefined ? nodeData.pId : parentId;
            if (opt.duplicateCheck && isNodeNameExists(treeData, name, id)) {
                alert(`节点 "${name}" 已存在`);
                return null;
            }
            newNode = { id, text: name, children: nodeData.children || [] };
            if (nodeData.type) newNode.type = nodeData.type;
            parentId = pId;
        } else {
            return null;
        }

        const success = addNodeByParentId(treeData, newNode, parentId);
        if (success) {
            $container.data('treeData', treeData);
            renderTree($container, treeData, opt, true);
            if (opt.onAddNode) opt.onAddNode(newNode, parentId || null);
            return newNode;
        }
        return null;
    }

    /**
     * 删除节点
     */
    function deleteNode($container, nodeId) {
        const instance = instances.get($container[0]);
        if (!instance) return false;
        
        const opt = instance.options;
        const treeData = $container.data('treeData');
        const nodeInfo = findNode(treeData, nodeId);
        
        if (!nodeInfo || !confirm(`确定删除 "${nodeInfo.node.text}"？`)) return false;
        
        removeNode(treeData, nodeId);
        $container.data('treeData', treeData);
        if (instance.selectedNodeId === nodeId) instance.selectedNodeId = null;
        renderTree($container, treeData, opt, true);
        if (opt.onDeleteNode) opt.onDeleteNode(nodeInfo.node);
        return true;
    }

    function deleteSelectedNode($container) {
        const instance = instances.get($container[0]);
        if (!instance?.selectedNodeId) {
            alert('请先选中节点');
            return false;
        }
        return deleteNode($container, instance.selectedNodeId);
    }

    function getSelectedNode($container) {
        const instance = instances.get($container[0]);
        if (!instance?.selectedNodeId) return null;
        return findNode($container.data('treeData'), instance.selectedNodeId)?.node || null;
    }

    function setSelectedNode($container, nodeId) {
        const instance = instances.get($container[0]);
        if (!instance) return;
        instance.selectedNodeId = nodeId;
        renderTree($container, $container.data('treeData'), instance.options, true);
    }

    function getTreeData($container) {
        return $container.data('treeData');
    }

    function setTreeData($container, newData, preserveState = true) {
        const instance = instances.get($container[0]);
        if (!instance) return;
        $container.data('treeData', newData);
        renderTree($container, newData, instance.options, preserveState);
    }

    function expandAllNodes($container) {
        $container.find('.node-children').each(function() {
            const $this = $(this);
            if ($this.length && !$this.is(':visible')) {
                $this.show();
                $this.closest('li').removeClass('collapsed');
            }
        });
        const instance = instances.get($container[0]);
        if (instance?.collapsedState) {
            $container.find('li').each(function() {
                const id = $(this).data('id');
                if (id) instance.collapsedState[id] = false;
            });
        }
    }

    function collapseAllNodes($container) {
        $container.find('.node-children').each(function() {
            const $this = $(this);
            if ($this.length && $this.is(':visible')) {
                $this.hide();
                $this.closest('li').addClass('collapsed');
            }
        });
        const instance = instances.get($container[0]);
        if (instance?.collapsedState) {
            $container.find('li').each(function() {
                const id = $(this).data('id');
                if (id) instance.collapsedState[id] = true;
            });
        }
    }

    function refreshTree($container) {
        const instance = instances.get($container[0]);
        if (instance) {
            renderTree($container, $container.data('treeData'), instance.options, true);
        }
    }

    // ========== 插件注册 ==========
    
    $.fn.simpleTree = function(userOptions) {
        // 方法调用模式
        if (typeof userOptions === 'string') {
            const method = userOptions;
            const args = Array.prototype.slice.call(arguments, 1);
            const results = [];
            
            this.each(function() {
                const $this = $(this);
                switch (method) {
                    case 'search': results.push(searchNodes($this, args[0])); break;
                    case 'clearSearch': results.push(clearSearch($this)); break;
                    case 'addNode': results.push(addNode($this, args[0], args[1])); break;
                    case 'deleteNode': results.push(deleteNode($this, args[0])); break;
                    case 'deleteSelected': results.push(deleteSelectedNode($this)); break;
                    case 'getSelected': results.push(getSelectedNode($this)); break;
                    case 'setSelected': results.push(setSelectedNode($this, args[0])); break;
                    case 'getData': results.push(getTreeData($this)); break;
                    case 'setData': results.push(setTreeData($this, args[0], args[1])); break;
                    case 'expandAll': results.push(expandAllNodes($this)); break;
                    case 'collapseAll': results.push(collapseAllNodes($this)); break;
                    case 'refresh': results.push(refreshTree($this)); break;
                    case 'toJson': results.push(treeToJson($this, args[0] === true)); break;
                    default: console.warn('未知方法:', method);
                }
            });
            return results.length === 1 ? results[0] : results;
        }

        // 初始化模式
        const options = $.extend(true, {}, defaults, userOptions);
        
        return this.each(function() {
            const $this = $(this);
            $this.addClass('simple-tree').data('simpleTreeOptions', options);

            // 确保每个节点都有ID
            function ensureId(nodes) {
                nodes?.forEach(n => {
                    if (!n.id) n.id = generateId();
                    if (n.children) ensureId(n.children);
                });
            }

            // 存储实例状态
            instances.set($this[0], {
                options: options,
                selectedNodeId: null,
                currentKeyword: '',
                collapsedState: {}
            });

            // 初始化数据
            let data = options.data;
            if (data?.length) {
                const copy = JSON.parse(JSON.stringify(data));
                ensureId(copy);
                $this.data('treeData', copy);
                renderTree($this, copy, options, false);
            } else if (options.allowDropToEmpty && options.treeType === 'right') {
                $this.data('treeData', []);
                renderTree($this, [], options, false);
            } else {
                $this.data('treeData', []);
                renderTree($this, [], options, false);
            }
        });
    };
})(jQuery);