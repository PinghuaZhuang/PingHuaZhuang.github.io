var checkConfigs = [
    {
        comparison: 't',
        getValue: function (dragRect, condition) {
            return dragRect[condition ? 'top' : 'bottom'];
        },
        getStyleProp: function () {
            return 'top';
        },
        getStyleValue: function (dragRect, token, condition) {
            return condition ? token.value : token.value - dragRect.height;
        },
    },
    {
        comparison: 'l',
        getValue: function (dragRect, condition) {
            return dragRect[condition ? 'left' : 'right'];
        },
        getStyleProp: function () {
            return 'left';
        },
        getStyleValue: function (dragRect, token, condition) {
            return condition ? token.value : token.value - dragRect.width;
        },
    },
    {
        comparison: 'h',
        getValue: function (dragRect, condition) {
            return condition
                ? dragRect.top + dragRect.height / 2
                : dragRect.left + dragRect.width / 2;
        },
        getStyleProp: function (condition) {
            return condition ? 'top' : 'left';
        },
        getStyleValue: function (dragRect, token, condition) {
            return condition
                ? token.value - dragRect.height / 2
                : token.value - dragRect.width / 2;
        },
    },
];
var nearestConfigs = {
    h: [
        {
            getDistance: function (token, targetRect) {
                return targetRect.left - token.rect.right;
            },
            getPosition: function (token, targetRect) {
                return token.rect.right;
            },
        },
        {
            getDistance: function (token, targetRect) {
                return token.rect.left - targetRect.right;
            },
            getPosition: function (token, targetRect) {
                return targetRect.right;
            },
        },
    ],
    v: [
        {
            getDistance: function (token, targetRect) {
                return targetRect.top - token.rect.bottom;
            },
            getPosition: function (token, targetRect) {
                return token.rect.bottom;
            },
        },
        {
            getDistance: function (token, targetRect) {
                return token.rect.top - targetRect.bottom;
            },
            getPosition: function (token, targetRect) {
                return targetRect.bottom;
            },
        },
    ],
};
var LINES = ['ht', 'hc', 'hb', 'vl', 'vc', 'vr'];
var SnapLine = (function () {
    function SnapLine(option) {
        this.option = {
            gap: 3,
            lines: LINES,
        };
        Object.assign(this.option, option);
        this.createLines();
    }
    SnapLine.prototype.createLines = function () {
        var _this = this;
        var lines = {};
        this.option.lines.forEach(function (lineType) {
            var node = document.createElement('div');
            lines[lineType] = {
                handle: {
                    show: function () {
                        node.style.display = 'block';
                    },
                    hide: function () {
                        node.style.display = 'none';
                    },
                    isShow: function () {
                        return node.style.display !== 'none';
                    },
                },
                target: node,
                type: lineType,
            };
            node.classList.add('snap-line', "snap-line-".concat(lineType));
            node.dataset.direction = lineType[0];
            if (!_this.option.noStyle) {
                node.style.cssText = "display:none;opacity:0.7;position:absolute;background:#4DAEFF;z-index:1000;pointer-events:none;".concat(lineType[0] === 'h'
                    ? 'width:100%;height:1px;left:0;transform:translateY(-1px);'
                    : 'width:1px;height:100%;top:0;transform:translateX(-1px);');
            }
            document.body.append(node);
        });
        return (this.lines = lines);
    };
    SnapLine.prototype.generateGrid = function (elementsOrSelect) {
        var nodeList = SnapLine.querySelectorAll(elementsOrSelect);
        var grid = (this.grid = {
            h: [],
            v: [],
        });
        var max = -Infinity;
        nodeList.forEach(function (node) {
            if (!(node instanceof HTMLElement)) {
                return;
            }
            var rect = node.getBoundingClientRect();
            var top = rect.top, bottom = rect.bottom, left = rect.left, right = rect.right, height = rect.height, width = rect.width;
            [
                top,
                top + height / 2,
                bottom,
                left,
                left + width / 2,
                right,
            ].forEach(function (value, index) {
                var direction = index > 2 ? 'v' : 'h';
                var target = grid[direction];
                if (value > max) {
                    max = value;
                }
                var token = {
                    handle: {},
                    target: node,
                    value: value,
                    direction: direction,
                    type: LINES[index],
                    rect: rect,
                };
                target.push(token);
            });
        });
        return grid;
    };
    SnapLine.prototype.check = function (dragNode, elementsOrSelect) {
        var _this = this;
        if (elementsOrSelect == null && this.grid == null) {
            throw new Error("\u627E\u4E0D\u5230\u5BF9\u9F50\u7EBF");
        }
        if (elementsOrSelect == null) {
            var showLines_1 = [];
            [
                ['hb', 'ht'],
                ['vr', 'vl'],
                ['hc', 'vc'],
            ].map(function (group, index) {
                var config = checkConfigs[index];
                group.forEach(function (o) {
                    var lineType = o;
                    var dragRect = dragNode.getBoundingClientRect();
                    var condition = lineType.charAt(index > 1 ? 0 : 1) === config.comparison;
                    var direction = lineType.charAt(0);
                    var originValue = config.getValue(dragRect, condition);
                    var tokens = _this.searchNearly(originValue, _this.grid[direction]);
                    if (!tokens)
                        return dragNode.classList.remove("snap-active");
                    tokens = tokens.filter(function (t) { return t.target !== dragNode; });
                    if (!tokens.length)
                        return dragNode.classList.remove("snap-active");
                    if (_this.option.onSnap) {
                        _this.option.onSnap({
                            snaps: tokens,
                            direction: direction,
                            lineType: lineType,
                            target: dragNode,
                            targetRect: dragRect,
                        });
                    }
                    dragNode.classList.add("snap-active");
                    tokens.forEach(function (token) {
                        if (showLines_1.includes(lineType))
                            return;
                        var prop = config.getStyleProp(condition);
                        var value = config.getStyleValue(dragRect, token, condition);
                        var line = _this.lines[lineType];
                        if (line == null)
                            return;
                        dragNode.style[prop] = "".concat(value, "px");
                        line.target.style[prop] = "".concat(token.value, "px");
                        line.handle.show();
                        showLines_1.push(lineType);
                    });
                });
            });
            Object.entries(this.lines).forEach(function (_a) {
                var key = _a[0], lineToken = _a[1];
                !showLines_1.includes(key) && lineToken.handle.hide();
            });
        }
        else {
            this.generateGrid(elementsOrSelect);
            this.check(dragNode);
        }
    };
    SnapLine.prototype.uncheck = function () {
        this.grid = null;
        Object.values(this.lines).forEach(function (item) { return item.handle.hide(); });
        Array.from(document.querySelectorAll('.snap-line-active')).forEach(function (item) {
            return item.classList.remove('snap-line-active');
        });
    };
    SnapLine.prototype.destroy = function () {
        for (var _i = 0, _a = Object.entries(this.lines); _i < _a.length; _i++) {
            var _b = _a[_i], _ = _b[0], v = _b[1];
            v.target.remove();
        }
        this.uncheck();
    };
    SnapLine.prototype.nearest = function (_a) {
        var _b;
        var tokens = _a.snaps, direction = _a.direction, targetRect = _a.targetRect, lineType = _a.lineType;
        var container = (_b = this.lines[lineType]) === null || _b === void 0 ? void 0 : _b.target;
        if (container == null)
            return;
        var mins = [
            { distance: Infinity, token: null, config: null },
            { distance: Infinity, token: null, config: null },
        ];
        tokens.forEach(function (token) {
            nearestConfigs[direction].forEach(function (t, ti) {
                var distance = t.getDistance(token, targetRect);
                if (distance > 0 && distance < mins[ti].distance) {
                    mins[ti] = { distance: distance, token: token, config: t };
                }
            });
        });
        return [mins, container];
    };
    SnapLine.prototype.isNearly = function (dragValue, targetValue) {
        var gap = this.option.gap;
        return Math.abs(dragValue - targetValue) <= gap;
    };
    SnapLine.prototype.searchNearly = function (dragValue, arr) {
        var i = 0;
        var len = arr.length;
        var result = [];
        for (; i < len; i++) {
            if (this.isNearly(dragValue, arr[i].value)) {
                result.push(arr[i]);
            }
        }
        return result;
    };
    SnapLine.querySelectorAll = function (elementsOrSelect) {
        if (typeof elementsOrSelect === 'string') {
            return document.querySelectorAll(elementsOrSelect);
        }
        return elementsOrSelect;
    };
    return SnapLine;
}());
export default SnapLine;
//# sourceMappingURL=SnapLine.js.map