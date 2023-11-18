/**
 * 判断是否是文本节点
 */
function isTextNode(node) {
    return node.nodeType === 3;
}
function isCommentNode(node) {
    return node.nodeType === 8;
}
/**
 * 判断是否是非空文本节点
 */
function isPlainTextNode(node) {
    var _a;
    return isTextNode(node) && !!((_a = node.textContent) === null || _a === void 0 ? void 0 : _a.length);
}
/**
 * 获取节点的区间内所有元素的 DOMRect
 * 文本节点换行后会被切分多个 DOMRect
 */
function getTextNodeRects(node, startOffset, endOffset) {
    if (startOffset === undefined)
        startOffset = 0;
    if (endOffset === undefined)
        endOffset = node.textContent.length;
    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);
    return Array.from(range.getClientRects()).filter((o) => o.width !== 0 && o.height !== 0);
}
/**
 * 获取 Range 内的文本
 */
function getStartAndEndRangeText(range) {
    const { startContainer, endContainer, startOffset, endOffset } = range;
    let startText = '';
    let endText = '';
    if (isSingle(range)) {
        startText = endText = sliceText(startContainer, startOffset, endOffset);
    }
    else {
        startText = sliceText(startContainer, startOffset);
        endText = sliceText(endContainer, 0, endOffset);
    }
    return {
        start: startText,
        end: endText,
    };
}
/**
 * 获取节点中某区间的文本
 */
function sliceText(node, startOffset, endOffset) {
    return node.textContent ? node.textContent.slice(startOffset, endOffset) : '';
}
/**
 * 从节点开始, 遍历往后的文本节点
 */
function* nodeAfterIterator(node, isGoBack = false) {
    yield node;
    if (!isGoBack && node.childNodes.length > 0) {
        yield* nodeAfterIterator(node.childNodes[0], false);
    }
    else if (node.nextSibling) {
        yield* nodeAfterIterator(node.nextSibling, false);
    }
    else if (node.parentNode) {
        yield* nodeAfterIterator(node.parentNode, true);
    }
}
/**
 * 获取 Range 内的所有非空文本节点
 */
function* nodeRangeIterator(range) {
    const { startContainer, endContainer, startOffset, endOffset } = range;
    const start = getRangeFrontierTextNode(startContainer, startOffset);
    const end = getRangeFrontierTextNode(endContainer, endOffset);
    if (isSingle(range)) {
        if (isPlainTextNode(start)) {
            yield start;
        }
        return;
    }
    const iterator = nodeAfterIterator(start);
    let nextNode = iterator.next().value; // start
    while (nextNode && nextNode !== end) {
        if (isPlainTextNode(nextNode)) {
            yield nextNode;
        }
        nextNode = iterator.next().value;
    }
    if (nextNode && isPlainTextNode(nextNode)) {
        yield nextNode; // end
    }
}
/**
 * 判断选中文本是否只有一个节点
 */
function isSingle(range) {
    const { startContainer, endContainer } = range;
    return startContainer === endContainer;
}
/**
 * 判断2个DOMRect垂直方向是否允许合并
 */
function isAdjacentV(left, right) {
    // 由于line-height, 这里高度有一些误差
    return left.width === right.width && Math.abs(left.bottom - right.top) < 1;
}
/**
 * 判断2个DOMRect水平方向是否允许合并
 */
function isAdjacentH(left, right) {
    return left.right === right.left;
}
/**
 * 获取开始和结束的文本节点
 * 节点类型是 Text、Comment 或 CDATASection(xml)之一
 * HTML中没有 CDATASection
 * @param target range.startContainer || range.endContainer
 */
function getRangeFrontierTextNode(target, offset) {
    return isTextNode(target) || isCommentNode(target)
        ? target
        : getRangeFrontierTextNode(target.childNodes[offset], 0);
}
function findRectIncludePoint(rects, point, expand = 0) {
    let expandX;
    let expandY;
    if (typeof expand === 'number') {
        expandX = expandY = expand;
    }
    else {
        [expandX, expandY] = expand;
    }
    let result;
    rects.forEach((rect) => {
        if (rect.x - expandX > point.x || rect.y - expandY > point.y)
            return;
        if (rect.right + expandX < point.x || rect.bottom + expandY < point.y)
            return;
        result = rect;
    });
    return result;
}

class TextRange {
    constructor(options = {}) {
        var _a;
        /**
         * 是否裁剪过文本节点
         * @default false
         */
        this.split = false;
        const { container, range, id, splitText = false } = options;
        this.options = options;
        this.root = container !== null && container !== void 0 ? container : document.body;
        let selection;
        const _range = range !== null && range !== void 0 ? range : (((_a = (selection = getSelection())) === null || _a === void 0 ? void 0 : _a.isCollapsed)
            ? undefined
            : selection.getRangeAt(0));
        if (_range == null) {
            throw new Error('range parameter is reqired.');
        }
        this.range = _range;
        this.id = id !== null && id !== void 0 ? id : TextRange.generateId();
        this.data = this.export();
        splitText && this.splitText();
        if (this.isEmpty) {
            console.warn(`ID: ${this.id}, No text selected.`);
        }
    }
    *[Symbol.iterator]() {
        yield* nodeRangeIterator(this.range);
    }
    get single() {
        return isSingle(this.range);
    }
    get commonAncestorElement() {
        const container = this.range.commonAncestorContainer;
        return container instanceof Element ? container : container.parentElement;
    }
    get isEmpty() {
        return this.range.collapsed;
    }
    text() {
        return this.range.toString();
    }
    textNodes() {
        return [...this];
    }
    trimTextNodes() {
        const textNodes = this.textNodes();
        textNodes.shift();
        textNodes.pop();
        return textNodes;
    }
    rect() {
        return this.range.getBoundingClientRect();
    }
    /**
     * 获取所有元素的 DOMRect
     */
    rects() {
        if (this.isEmpty)
            return [];
        const rects = [];
        const [startTextNode, startOffset] = this.getStart();
        const [endTextNode, endOffset] = this.getEnd();
        const trimTextNodes = this.trimTextNodes();
        if (this.single) {
            rects.push(...getTextNodeRects(startTextNode, startOffset, endOffset));
            return rects;
        }
        rects.push(...getTextNodeRects(startTextNode, startOffset));
        for (const textNode of trimTextNodes) {
            rects.push(...getTextNodeRects(textNode));
        }
        rects.push(...getTextNodeRects(endTextNode, 0, endOffset));
        return rects;
    }
    /**
     * 水平方向相邻的 DOMRect 合并
     */
    mergeRects(v) {
        const rects = this.rects();
        if (!rects.length)
            return [];
        let rect = rects[0];
        const mergeRects = [rect];
        rects.reduce((pre, cur) => {
            if (isAdjacentH(pre, cur)) {
                pre.width += cur.width;
                pre.height = Math.max(pre.height, cur.height);
                pre.y = Math.min(pre.y, cur.y);
                return pre;
            }
            if (v && isAdjacentV(pre, cur)) {
                pre.height += Math.floor(cur.height);
                return pre;
            }
            mergeRects.push(cur);
            return cur;
        });
        return mergeRects;
    }
    getStart() {
        const { startContainer, startOffset } = this.range;
        const node = getRangeFrontierTextNode(startContainer, startOffset);
        const changed = this.split || startContainer !== node;
        if (changed) {
            this.range.setStart(node, 0);
        }
        return [node, startContainer !== node ? 0 : startOffset];
    }
    getEnd() {
        const { endContainer, endOffset } = this.range;
        const node = getRangeFrontierTextNode(endContainer, endOffset);
        const changed = this.split || endContainer !== node;
        let offset = isPlainTextNode(node) ? node.textContent.length : 0;
        if (changed) {
            this.range.setEnd(node, offset);
        }
        return [node, changed ? offset : endOffset];
    }
    /**
     * 导出数据
     */
    export() {
        if (this.split) {
            console.warn(`Exporting data must come before cropping.`);
        }
        const { start, end } = getStartAndEndRangeText(this.range);
        const [startTextNode, startOffset] = this.getStart();
        const [endTextNode, endOffset] = this.getEnd();
        return {
            id: this.id,
            start: {
                path: TextRange.getPath(startTextNode, this.root),
                offset: startOffset,
                text: start,
            },
            end: {
                path: TextRange.getPath(endTextNode, this.root),
                offset: endOffset,
                text: end,
            },
        };
    }
    /**
     * 替换文本节点
     * 替换成新的节点后, range会发生变化
     */
    replace(render) {
        if (!this.options.splitText)
            this.splitText();
        const textNodes = this.textNodes();
        textNodes.forEach((o) => {
            const { parentNode, nextSibling } = o;
            if (parentNode == null)
                return;
            const newNode = render(o);
            if (newNode == null)
                return;
            if (nextSibling) {
                parentNode.insertBefore(newNode, nextSibling);
            }
            else {
                parentNode.appendChild(newNode);
            }
        });
        this.update();
    }
    /**
     * 如果是相邻的文本节点则合并到新节点中
     */
    replaceNodes(render) {
        if (!this.options.splitText)
            this.splitText();
        const textNodes = this.textNodes();
        const cns = [[textNodes[0]]];
        textNodes.reduce((pre, cur) => {
            var _a, _b;
            if (pre.nextSibling === cur && ((_a = cur.textContent) === null || _a === void 0 ? void 0 : _a.trim())) {
                cns[cns.length - 1].push(cur);
            }
            else {
                ((_b = cur.textContent) === null || _b === void 0 ? void 0 : _b.trim()) && cns.push([cur]);
            }
            return cur;
        });
        cns.forEach((nodes) => {
            if (!nodes.length)
                return;
            const { parentNode, nextSibling } = nodes[nodes.length - 1];
            if (parentNode == null)
                return;
            const newNode = render(nodes);
            if (newNode == null)
                return;
            if (nextSibling) {
                parentNode.insertBefore(newNode, nextSibling);
            }
            else {
                parentNode.appendChild(newNode);
            }
            newNode.normalize();
        });
    }
    /**
     * 更新 range
     * 替换节点后会导致 range 发生变化(range.collapsed === true)
     */
    update() {
        this.getStart();
        this.getEnd();
    }
    /**
     * 裁剪开始节点和结束节点
     */
    splitText() {
        this.split = true;
        const { startContainer, startOffset, endContainer, endOffset } = this.range;
        if (this.single) {
            if (isTextNode(startContainer) && startOffset !== endOffset) {
                isTextNode(endContainer) && endContainer.splitText(endOffset);
                startContainer.splitText(startOffset);
                startContainer.nextSibling &&
                    this.range.setStart(startContainer.nextSibling, 0);
            }
            return;
        }
        if (isTextNode(startContainer)) {
            startContainer.splitText(startOffset);
            startContainer.nextSibling &&
                this.range.setStart(startContainer.nextSibling, 0);
        }
        if (isTextNode(endContainer)) {
            endContainer.splitText(endOffset);
        }
    }
    /**
     * 判断坐标是否在 Range 内.
     */
    isPointInRange(point, expand = 0) {
        return !!findRectIncludePoint(this.mergeRects(), point, expand);
    }
    /**
     * 判断 Range 是否在可视区域内
     * @param {number} [threshold] 目标元素与视窗重叠的阈值（0~1）
     */
    isIntersecting(threshold) {
        const { left, top, right, bottom, height, width } = this.rect();
        // 数据有些小偏差, 所以这里最小距离 1px
        const min = 1;
        const minDistanceX = threshold == null ? min : Math.max(width * threshold, min);
        const minDistanceY = threshold == null ? min : Math.max(height * threshold, min);
        const { clientHeight, clientWidth } = document.body;
        if (right < minDistanceX || left > clientWidth - minDistanceX)
            return false;
        if (bottom < minDistanceY || top > clientHeight - minDistanceY)
            return false;
        return true;
    }
    static generateId() {
        return String(new Date().getTime());
    }
    /**
     * 根据配置创建 TextRange
     */
    static create(config, root) {
        const range = TextRange.createRange(config, root);
        return new TextRange({ id: config.id, range, container: root });
    }
    /**
     * 根据配置创建 Range
     */
    static createRange(config, root) {
        root = root !== null && root !== void 0 ? root : document.body;
        const range = document.createRange();
        const { start, end } = config;
        range.setStart(this.getNodeByPath(start.path, root), start.offset);
        range.setEnd(this.getNodeByPath(end.path, root), end.offset);
        return range;
    }
    /**
     * 获取指定节点的 path
     * 用户修改文本后尽可能不影响选中的位置
     */
    static getPath(textNode, root = document.body) {
        let parentElement = textNode.parentElement;
        const path = [
            0,
            Array.from(parentElement.childNodes).findIndex((o) => textNode === o),
        ];
        let cur = parentElement;
        parentElement = parentElement.parentElement;
        while (parentElement) {
            if (cur === parentElement.firstElementChild) {
                if (parentElement === root) {
                    break;
                }
                else {
                    cur = parentElement;
                    parentElement = cur.parentElement;
                    path.unshift(0);
                }
            }
            else {
                cur = cur.previousElementSibling;
                path[0]++;
            }
        }
        if (parentElement == null) {
            throw new Error('The node must be within the root node.');
        }
        return path;
    }
    /**
     * 根据 path 获取指定节点
     */
    static getNodeByPath(path, root = document.body) {
        let node = root;
        path.reduce((_node, index, i) => {
            if (node == null)
                return node;
            const isLast = i === path.length - 1;
            const childs = isLast ? _node.childNodes : _node.children;
            if (childs[index]) {
                node = childs[index];
            }
            else {
                throw new Error('Path error, node not found.');
            }
            return node;
        }, node);
        return node;
    }
}

export { TextRange as default };
