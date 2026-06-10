/**
 * SimpleTree - 最终修复版（复制后节点可拖拽）
 */
(function($) {
    'use strict';

    const defaults = {
        data: [],
        defaultCollapsed: true,
        onCopy: null,
        onMove: null,
        onDragStart: null,
        onDragEnd: null
    };

    let dragState = {
        sourceNode: null,
        sourceTree: null,
        sourceId: null,
        clone: null,
        targetNode: null,
        targetPosition: null,
        isDragging: false
    };

    // ========== 工具函数 ==========
    
    function findNode(tree, id) {
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == id) return { node, parent: null, index: i, children: tree };
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

    function removeNode(tree, id) {
        for (let i = 0; i < tree.length; i++) {
            if (tree[i].id == id) {
                tree.splice(i, 1);
                return true;
            }
            if (tree[i].children && removeNode(tree[i].children, id)) {
                return true;
            }
        }
        return false;
    }

    function insertNode(tree, targetId, newNode, position) {
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
            if (node.children && insertNode(node.children, targetId, newNode, position)) {
                return true;
            }
        }
        return false;
    }

    function cloneNode(node) {
        return JSON.parse(JSON.stringify(node));
    }

    function isDescendant(parentNode, childId) {
        if (!parentNode.children) return false;
        for (let child of parentNode.children) {
            if (child.id == childId) return true;
            if (isDescendant(child, childId)) return true;
        }
        return false;
    }

    // ========== 折叠状态保存和恢复 ==========
    
    function collectCollapsedState($container) {
        const state = {};
        $container.find('li').each(function() {
            const $li = $(this);
            const $treeNode = $li.find('.tree-node').first();
            const nodeId = $treeNode.data('id');
            if (!nodeId) return;
            
            const $children = $li.children('.node-children');
            if ($children.length && $children.is(':visible') === false) {
                state[nodeId] = true;
            } else if ($children.length) {
                state[nodeId] = false;
            }
        });
        return state;
    }

    function restoreCollapsedState($container, state) {
        $container.find('li').each(function() {
            const $li = $(this);
            const $treeNode = $li.find('.tree-node').first();
            const nodeId = $treeNode.data('id');
            if (!nodeId) return;
            
            const $children = $li.children('.node-children');
            const $icon = $li.find('.toggle-icon');
            
            if ($children.length && state.hasOwnProperty(nodeId)) {
                if (state[nodeId] === true) {
                    $children.hide();
                    $icon.text('▶');
                } else {
                    $children.show();
                    $icon.text('▼');
                }
            }
        });
    }

    function getDropPosition(e, targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const y = e.clientY;
        const height = rect.height;
        const ratio = (y - rect.top) / height;
        if (ratio < 0.33) return 'before';
        if (ratio > 0.66) return 'after';
        return 'inside';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // 生成唯一ID
    function generateId() {
        return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    // ========== 渲染函数 ==========
    
    function renderTree($container, data, options, preserveState = true) {
        if (!data || !data.length) {
            $container.html('<div class="tree-node">无数据</div>');
            return;
        }

        let collapsedState = {};
        if (preserveState) {
            collapsedState = collectCollapsedState($container);
        }

        function buildHtml(nodes) {
            let html = '<ul>';
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const hasChildren = node.children && node.children.length > 0;
                let isCollapsed = options.defaultCollapsed;
                if (preserveState && collapsedState.hasOwnProperty(node.id)) {
                    isCollapsed = collapsedState[node.id];
                }
                const collapsedStyle = (hasChildren && isCollapsed) ? 'display: none;' : '';
                
                html += `<li data-id="${node.id}">`;
                html += `<div class="tree-node" data-id="${node.id}">`;
                html += `<span class="toggle-icon ${hasChildren ? '' : 'empty'}" data-id="${node.id}">${hasChildren ? (isCollapsed ? '▶' : '▼') : ''}</span>`;
                html += `<span class="node-content">${escapeHtml(node.text)}</span>`;
                html += `</div>`;
                if (hasChildren) {
                    html += `<div class="node-children" data-parent="${node.id}" style="${collapsedStyle}">${buildHtml(node.children)}</div>`;
                }
                html += `</li>`;
            }
            html += '</ul>';
            return html;
        }

        $container.html(buildHtml(data));
        
        if (preserveState && Object.keys(collapsedState).length > 0) {
            restoreCollapsedState($container, collapsedState);
        }
        
        bindEvents($container, options);
    }

    // ========== 事件绑定 ==========
    
    function bindEvents($container, options) {
        // 折叠/展开事件
        $container.off('click.simpleTree', '.toggle-icon');
        $container.on('click.simpleTree', '.toggle-icon', function(e) {
            e.stopPropagation();
            const $icon = $(this);
            const $node = $icon.closest('.tree-node');
            const $li = $node.closest('li');
            const $children = $li.children('.node-children');
            
            if ($children.length && $children.is(':visible')) {
                $children.hide();
                $icon.text('▶');
            } else if ($children.length) {
                $children.show();
                $icon.text('▼');
            }
        });

        // 拖拽事件 - 使用事件委托
        $container.off('mousedown.simpleTree', '.tree-node');
        $container.on('mousedown.simpleTree', '.tree-node', function(e) {
            if (e.which !== 1) return;
            if ($(e.target).hasClass('toggle-icon')) return;
            
            e.preventDefault();
            startDrag(e, this, $container, options);
        });
    }

    // ========== 拖拽逻辑 ==========
    
    function startDrag(e, nodeEl, $container, options) {
        if (dragState.isDragging) cleanupDrag();
        
        const $node = $(nodeEl);
        const nodeId = $node.data('id');
        
        if (!nodeId) {
            console.warn('无法获取节点ID');
            return;
        }
        
        const treeData = $container.data('treeData');
        if (!treeData) {
            console.warn('无法获取树数据');
            return;
        }
        
        const nodeInfo = findNode(treeData, nodeId);
        
        if (!nodeInfo) {
            console.warn('找不到节点数据', nodeId);
            console.log('当前树数据:', treeData);
            return;
        }
        
        dragState.sourceNode = nodeInfo.node;
        dragState.sourceTree = $container;
        dragState.sourceId = nodeId;
        dragState.isDragging = true;
        
        $node.addClass('dragging');
        
        dragState.clone = $('<div class="simple-tree-clone">')
            .text(nodeInfo.node.text)
            .css({ top: e.clientY + 10, left: e.clientX + 10 })
            .appendTo('body');
        
        if (options.onDragStart) {
            options.onDragStart(nodeInfo.node, $container.attr('id'));
        }
        
        $(document).off('mousemove.simpleTree mouseup.simpleTree');
        $(document).on('mousemove.simpleTree', function(me) {
            onDragMove(me, options);
        });
        $(document).on('mouseup.simpleTree', function(me) {
            onDragEnd(me, options);
        });
    }
    
    function onDragMove(e, options) {
        if (!dragState.isDragging) return;
        e.preventDefault();
        
        if (dragState.clone) {
            dragState.clone.css({ top: e.clientY + 10, left: e.clientX + 10 });
        }
        
        const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
        let targetNodeEl = null;
        for (let i = 0; i < elemUnderCursor.length; i++) {
            const el = elemUnderCursor[i];
            if ($(el).hasClass('tree-node') && el !== dragState.sourceNode) {
                targetNodeEl = el;
                break;
            }
        }
        
        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over-before drag-over-after drag-over-inside');
            dragState.targetNode = null;
        }
        
        if (targetNodeEl) {
            const $targetTree = $(targetNodeEl).closest('.simple-tree');
            const $sourceTree = dragState.sourceTree;
            const sourceId = $sourceTree.attr('id');
            const targetId = $targetTree.attr('id');
            
            const isValid = (sourceId === 'leftTree' && targetId === 'rightTree') ||
                           (sourceId === 'rightTree' && targetId === 'rightTree');
            
            if (isValid) {
                const position = getDropPosition(e, targetNodeEl);
                dragState.targetNode = targetNodeEl;
                dragState.targetPosition = position;
                
                if (position === 'before') {
                    $(targetNodeEl).addClass('drag-over-before');
                } else if (position === 'after') {
                    $(targetNodeEl).addClass('drag-over-after');
                } else {
                    $(targetNodeEl).addClass('drag-over-inside');
                }
            }
        }
    }
    
    function onDragEnd(e, options) {
        if (!dragState.isDragging) {
            cleanupDrag();
            return;
        }
        
        let success = false;
        
        if (dragState.targetNode && dragState.targetPosition) {
            const targetId = $(dragState.targetNode).data('id');
            success = performDrop(targetId, dragState.targetPosition, options);
        }
        
        if (options.onDragEnd) {
            options.onDragEnd(dragState.sourceNode, success);
        }
        
        cleanupDrag();
    }
    
    function performDrop(targetId, position, options) {
        const sourceNode = dragState.sourceNode;
        const sourceTree = dragState.sourceTree;
        const sourceId = dragState.sourceId;
        
        // 查找目标树
        let targetTree = null;
        $('.simple-tree').each(function() {
            if ($(this).find(`[data-id="${targetId}"]`).length > 0) {
                targetTree = $(this);
            }
        });
        
        if (!targetTree) return false;
        
        const sourceTreeId = sourceTree.attr('id');
        const targetTreeId = targetTree.attr('id');
        
        let success = false;
        
        // 左 -> 右（复制）
        if (sourceTreeId === 'leftTree' && targetTreeId === 'rightTree') {
            let targetData = targetTree.data('treeData');
            // 深拷贝目标数据
            targetData = JSON.parse(JSON.stringify(targetData));
            targetTree.data('treeData', targetData);
            
            const cloned = cloneNode(sourceNode);
            // 生成全新ID，确保唯一
            cloned.id = generateId();
            
            if (insertNode(targetData, targetId, cloned, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, { 
                    defaultCollapsed: options.defaultCollapsed,
                    onCopy: options.onCopy,
                    onMove: options.onMove,
                    onDragStart: options.onDragStart,
                    onDragEnd: options.onDragEnd
                }, true);
                if (options.onCopy) {
                    options.onCopy(sourceNode, cloned, targetId, position);
                }
                success = true;
            }
        }
        // 右 -> 右（移动）
        else if (sourceTreeId === 'rightTree' && targetTreeId === 'rightTree') {
            let targetData = targetTree.data('treeData');
            targetData = JSON.parse(JSON.stringify(targetData));
            targetTree.data('treeData', targetData);
            
            if (sourceId == targetId) return false;
            
            const targetNodeInfo = findNode(targetData, targetId);
            if (targetNodeInfo && isDescendant(sourceNode, targetId)) return false;
            
            removeNode(targetData, sourceId);
            if (insertNode(targetData, targetId, sourceNode, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, { 
                    defaultCollapsed: options.defaultCollapsed,
                    onCopy: options.onCopy,
                    onMove: options.onMove,
                    onDragStart: options.onDragStart,
                    onDragEnd: options.onDragEnd
                }, true);
                if (options.onMove) {
                    options.onMove(sourceNode, targetId, position);
                }
                success = true;
            }
        }
        
        return success;
    }
    
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
            sourceId: null,
            clone: null,
            targetNode: null,
            targetPosition: null,
            isDragging: false
        };
        
        $(document).off('mousemove.simpleTree mouseup.simpleTree');
    }
    
    // ========== 插件入口 ==========
    
    $.fn.simpleTree = function(userOptions) {
        const options = $.extend({}, defaults, userOptions);
        
        return this.each(function() {
            const $this = $(this);
            $this.addClass('simple-tree');
            
            function ensureId(nodes) {
                for (let i = 0; i < nodes.length; i++) {
                    if (!nodes[i].id) {
                        nodes[i].id = generateId();
                    }
                    if (nodes[i].children) {
                        ensureId(nodes[i].children);
                    }
                }
            }
            
            if (options.data && options.data.length) {
                const dataCopy = JSON.parse(JSON.stringify(options.data));
                ensureId(dataCopy);
                $this.data('treeData', dataCopy);
                renderTree($this, dataCopy, options, false);
            }
        });
    };
    
})(jQuery);