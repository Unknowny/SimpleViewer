var simpleviewer = new function () {
    // Private data
    var self = this,
        win = $(window),
        button_just_moved = false, // for floating close button
        in_fullscreen = false,
        in_drag = false,
        real_size, // natural dimension of the current source content
        clientX, clientY; // mousetracking for scroll zooming

    var sources = {
        all: [], // 1.jpg, 2.jpg, 3.png, ...
        cursor: 0,
        current: function () {
            return this.all[this.cursor];
        }
    }

    var nodes = { // jquery objects
        root: null,
        container: null, // container for nodes.img and nodes.video
        active: null, // alias to nodes.img or nodes.video
        img: null,
        video: null,
        close: null,
        next: null,
        prev: null,
        bg: null
    }

    var conf = {
        _default: {
            margin: 0,  // margin from the corners of window if the content is too big - pixels
            min_size: 100, // minimum size when resizing/showing content - pixels
            close_by_content: false, // close viewer by click on shown content
            close_by_bg: true,
            gui_elements: { // enabled gui elements
                close_button: true,
                bg: false,
                arrows: true
            },
            button_offset: {right: 7, top: 7}, // close button offset from the top right corner - pixels
            floating_button: true // close button tries to stay inside visible area
        },
        gui_elements: {},
        button_offset: {}
    }

    // Public data
    this.nodes = nodes;
    this.shown = function () {
        return shown;
    }

    this.show = function () {
        nodes.container.show();

        if (sources.all.length > 1 && conf.gui_elements.arrows)
            nodes.next.add(nodes.prev).show();

        if (conf.gui_elements.bg)
            nodes.bg.show();

        if (nodes.active === nodes.video)
            nodes.active[0].play();

        shown = true;

        return self;
    }

    this.hide = function () {
        nodes.root.hide();
        if (in_fullscreen) fullscreen(false);

        shown = false;

        return self;
    }

    this.next = function () {
        if (sources.cursor + 1 === sources.all.length) return self;
        update(++sources.cursor);
        updateArrows();
        return self;
    }

    this.prev = function () {
        if (sources.cursor === 0) return self;
        update(--sources.cursor);
        updateArrows();
        return self;
    }

    this.update = update;
    this.fullscreen = fullscreen;
    this.reconfig = reconfig;

    // Init
    setupConfig();

    // Private methods
    function setupConfig (c) {
        if (!c) c = conf._default;

        if (c.margin >= 0)
            conf.margin = parseInt(c.margin);

        if (c.min_size > 0)
            conf.min_size = parseInt(c.min_size);

        if (c.floating_button !== undefined)
            conf.floating_button = Boolean(c.floating_button);

        if (c.gui_elements) {
            if (c.gui_elements.close_button !== undefined) {
                conf.gui_elements.close_button = Boolean(c.gui_elements.close_button);
                if (!conf.gui_elements.close_button)
                    conf.floating_button = false;
            }

            if (c.gui_elements.bg !== undefined)
                conf.gui_elements.bg = Boolean(c.gui_elements.bg);

            if (c.gui_elements.arrows !== undefined)
                conf.gui_elements.arrows = Boolean(c.gui_elements.arrows);
        }

        if (c.close_by_bg !== undefined)
            conf.close_by_bg = Boolean(c.close_by_bg);

        if (c.close_by_content !== undefined)
            conf.close_by_content = Boolean(c.close_by_content);

        if (conf.button_offset) {
            if (c.button_offset.right !== undefined)
                conf.button_offset.right = parseInt(c.button_offset.right);

            if (c.button_offset.top !== undefined)
                conf.button_offset.top = parseInt(c.button_offset.top);
        }
    }

    function reconfig (config) {
        if (nodes.root) {
            nodes.root.remove();
            nodes = {};
        }

        setupConfig(config);

        self.update(sources.current());
        if (shown) self.show();

        return self;
    }

    function widthToHeight (h) {
        return h * real_size.width/real_size.height;
    }

    function heightToWidth (w) {
        return w * real_size.height/real_size.width;
    }

    function getNaturalSize () {
        var node = nodes.active[0];
        if (nodes.active === nodes.video)
            return {width: node.videoWidth, height: node.videoHeight};
        else
            return {width: node.naturalWidth, height: node.naturalHeight};
    }

    function adjustedSize (w, h) {
        // Adjusted to window inner size
        var win_w = win.width(),
            win_h = win.height();

        // too big
        if (w > win_w) {
            w = win_w - conf.margin * 2;
            h = heightToWidth(w);
        }
        if (h > win_h) {
            h = win_h - conf.margin * 2;
            w = widthToHeight(h);
        }

        // too small
        if (w < conf.min_size || h < conf.min_size) {
            if (h < w) {
                h = conf.min_size;
                w = widthToHeight(h);
            }
            else {
                w = conf.min_size;
                h = heightToWidth(w);
            }
        }

        return {width: w, height: h}
    }

    function centrizedPos (w, h) {
        var win_w = win.width(),
            win_h = win.height();

        return {left: (win_w/2) - (w/2), top: (win_h/2) - (h/2)}
    }

    function constructView () {
        nodes.root = $( '<div class="viewer-bg"></div>' +
                        '<div class="viewer-prev"></div><div class="viewer-next"></div>' +
                        '<div class="viewer-container">' +
                            '<span class="viewer-close" style="right:' + conf.button_offset.right + 'px;top:' + conf.button_offset.top +  'px;"></span>' +
                            '<span class="viewer-loading"></span>' +
                            '<a><img class="viewer-content"></a>' +
                            '<a><video class="viewer-content" loop autoplay></video></a>' +
                        '</div>');

        nodes.container = nodes.root.filter('.viewer-container');
        nodes.bg = nodes.root.filter('.viewer-bg');
        nodes.next = nodes.root.filter('.viewer-next');
        nodes.prev = nodes.root.filter('.viewer-prev');
        nodes.close = $('.viewer-close', nodes.container);
        nodes.video = $('video.viewer-content', nodes.container);
        nodes.img = $('img.viewer-content', nodes.container);

        if (!conf.gui_elements.close_button)
            nodes.close.hide();

        if (!conf.gui_elements.arrows)
            nodes.next.add(nodes.prev).hide();

        nodes.root.hide();
        nodes.root.appendTo(document.body);
        setEvents();
    }

    function setEvents () {
        var inner_nodes = nodes.img.add(nodes.video),
            $body = $(document.body);

        // scroll zooming
        inner_nodes
        .on('wheel', wheelResizeHandler)
        .on('mousemove', mouseTrackingHandler)
        .one('mouseover', mouseTrackingHandler)
        // dragging
        .on('mousedown', mousedownDragHandler)
        .on('mouseout mouseup', mouseupDropHandler);

        // for middle click emulation
        inner_nodes.parent()
        .on('mouseup click', function (e) {
            if (e.which !== 3) return false;
        });

        // close viewer
        nodes.close.click(clickCloseHandler);
        if (conf.close_by_bg)
            nodes.bg.on('click', clickCloseHandler);
        if (conf.close_by_content)
            inner_nodes.on('click', clickCloseHandler);

        // next/prev for galleries
        nodes.next.click(self.next);
        nodes.prev.click(self.prev);

        // fullscreen and prev/next on keys
        $body
        .off('keyup', keyupHandler).off('keydown', keydownHandler)
        .on('keyup', keyupHandler).on('keydown', keydownHandler);
    }

    function update (src_arr, cursor) {
        if (!nodes.root) constructView();

        if (src_arr === undefined)
            return;
        else if (typeof src_arr === 'number') {
            sources.cursor = src_arr;
        }
        else {
            sources.all = [].concat(src_arr);
            sources.cursor = cursor || 0;
        }

        loading(true);

        var src = sources.current();

        updateArrows();
        nodes.img.attr('src', '');
        nodes.video.attr('src', '');

        if (/\.(webm|mp4)([?#].*)?$/i.test(src)) {
            nodes.active = nodes.video;
            nodes.img.parent().hide();

            nodes.active.attr('src', src)
            .on('loadedmetadata', function () {
                real_size = getNaturalSize();
                fitToWindow();
                loading(false);
            })
            .on('error', function () {
                loading(-1);
            });
        }
        else {
            nodes.active = nodes.img;
            nodes.video.parent().hide();

            nodes.active.attr('src', src)
            .on('load', function () {
                real_size = getNaturalSize();
                fitToWindow();
                loading(false);
                nodes.active.off('load');
            })
            .on('error', function () {
                loading(-1);
            });
            real_size = getNaturalSize();
            fitToWindow();
        }

        nodes.active.parent().attr('href', src);
        nodes.active.parent().show();

        return self;
    }

    function updateArrows () {
        if (sources.all.length > 1) {
            nodes.prev.add(nodes.next).removeClass('inactive');
            if (sources.cursor === 0) nodes.prev.addClass('inactive');
            if (sources.cursor + 1 === sources.all.length) nodes.next.addClass('inactive');
        }
    }

    function loading (state) {
        nodes.container.removeClass('error');
        if (state === true) nodes.container.addClass('loading');
        if (state === false) nodes.container.removeClass('loading');
        if (state === -1) {
            nodes.container.removeClass('loading');
            nodes.container.addClass('error');
        }
    }

    function dragging (state) {
        if (state) {
            nodes.container.addClass('dragging');
            in_drag = true;
        }
        else {
            nodes.container.removeClass('dragging');
            in_drag = false;
        }
    }

    function fitToWindow () {
        var real_w = real_size.width,
            real_h = real_size.height;

        if (!real_w || !real_h) {
            real_w = win.width()*0.3;
            real_h = win.height()*0.5;
        }

        var size = adjustedSize(real_w, real_h),
            pos = centrizedPos(size.width, size.height);

        contentSize(size.width, size.height);
        containerPos(pos.left, pos.top);
    }

    function fullscreen (state) {
        var d = document, b = document.body;

        if (state === false) {
            if (d.cancelFullscreen)
              d.cancelFullscreen();
            else if (d.mozCancelFullScreen)
              d.mozCancelFullScreen();
            else if (d.webkitCancelFullScreen)
              d.webkitCancelFullScreen();
            in_fullscreen = false;
        }
        else {
            if (b.requestFullscreen)
              b.requestFullscreen();
            else if (b.mozRequestFullScreen)
              b.mozRequestFullScreen();
            else if (b.webkitRequestFullscreen)
              b.webkitRequestFullscreen();
            in_fullscreen = true;
        }

        return self;
    }

    function adjustCloseButton () {
        var size = contentSize(),
            container_pos = containerPos(),
            top, right;

        // right offset
        var delta = -(win.width() - (container_pos.left + size.width));
        if (delta > 0) {
            right = conf.button_offset.right + delta;
            nodes.close.css('right', right + 'px');
            button_just_moved = true;
        }

        // top offset
        if (container_pos.top < 0) {
            top = conf.button_offset.top - container_pos.top;
            nodes.close.css('top', top + 'px');
            button_just_moved = true;
        }

        // revert to original position if content is within window boundaries
        if (button_just_moved) {
            if (isNaN(top))
                nodes.close.css('top', conf.button_offset.top + 'px');
            if (isNaN(right))
                nodes.close.css('right', conf.button_offset.right + 'px');
        }
    }

    function containerPos (x, y) {
        if (x === undefined) return nodes.container.position();

        nodes.container.css({
            'left': x + 'px',
            'top': y + 'px'
        });

        if (conf.floating_button)
            adjustCloseButton();
    }

    function contentSize (w, h) {
        if (w === undefined) {
            var w = nodes.active[0].width,
                h = heightToWidth(w);
            return {width: w, height: h};
        }
        nodes.active[0].width = w;
        nodes.active.parent().css({
            'width': w,
            'height': h
        });
    }

    function resizeBy (multiplier) {
        var pos = containerPos(),
            size = contentSize(),
            win_w = win.width(),
            win_h = win.height();

        // new size
        var w = size.width * multiplier,
            h = heightToWidth(w);

        // return if it's going to be too small
        if (h < conf.min_size || w < conf.min_size) return;

        var offset_x = clientX - pos.left,
            offset_y = clientY - pos.top,
            delta_x = (multiplier - 1) * offset_x,
            delta_y = (multiplier - 1) * offset_y,
            x = pos.left - delta_x,
            y = pos.top - delta_y;

        contentSize(w, h);
        containerPos(x, y);
    }

    // Internal event handlers
    function wheelResizeHandler (e) {
        if (e.originalEvent.deltaY > 0) resizeBy(0.8); // scroll down
        else resizeBy(1.2); // scroll up

        return false;
    }

    function mouseTrackingHandler (e) {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    function mousedownDragHandler (e) {
        if (e.which !== 1) return;

        var pos = containerPos(),
            offset_x = e.clientX - pos.left,
            offset_y = e.clientY - pos.top;

        nodes.active.on('mousemove',
                        {offset_x: offset_x, offset_y: offset_y},
                        mousemoveDragHandler);

        return false;
    }

    function mousemoveDragHandler (e) {
        if (!in_drag) dragging(true);

        containerPos(e.clientX - e.data.offset_x,
                     e.clientY - e.data.offset_y);
    }

    function mouseupDropHandler (e) {
        dragging(false);

        nodes.active.off('mousemove', mousemoveDragHandler);

        if (conf.close_by_content) {
            nodes.active.off('click', clickCloseHandler);
            setTimeout(function () {
                nodes.active.on('click', clickCloseHandler);
            }, 0);
        }
    }

    function clickCloseHandler (e) {
        if (e.which !== 1) return;

        if (conf.close_by_content)
            nodes.active.off('mousemove', mousemoveDragHandler);

        self.hide();
    }

    function keyupHandler (e) {
        if (e.shiftKey || e.ctrlKey || e.altKey || !shown) return;

        // 'f' - fullscreen
        if (e.which === 70 && !in_fullscreen) {
            fullscreen(true);
            win.on('resize', fitToWindow);
        }
        else if (e.which === 70) {
            fullscreen(false);
            setTimeout(function () {
                win.off('resize', fitToWindow);
            }, 100);
        }
        // '0' or 'numpad 0' - fit to window
        else if (e.which === 48 || e.which === 96)
            fitToWindow();
        // if multiple sources
        else if (sources.all.length > 1 ) {
            // '<' - prev
            if (e.which === 37)
                self.prev()
            // '>' or 'space' - next
            else if (e.which === 39 || e.which === 32) {
                self.next();
            }
        }
    }

    function keydownHandler (e) {
        // disable scroll by space when gallery is open
        if (e.which === 32 && shown && sources.all.length > 1) {
            return false;
        }
    }
}

function simpleviewerHandler (e, src) {
    if (e.ctrlKey || e.altKey || e.shiftKey) return;

    // if clicked on the same node twice
    if (simpleviewer.source_node === e.target && simpleviewer.shown()) {
        simpleviewer.hide();
    }
    else {
        simpleviewer.source_node = e.target;
        simpleviewer.update(src || e.target.src);
        simpleviewer.show();
    }

    return false;
}

$(document.head).append(
'<style type="text/css">' +
// main container
'.viewer-container {position:fixed; z-index:7;}' +
// img/video wrapper
'.viewer-container a {cursor:default; display:block; overflow:hidden; max-height:100%; outline:1px solid rgba(0, 0, 0, .7); background-color:lightgray;}' +
    // disable selecting
    '.viewer-container a {-moz-user-select:none; -webkit-user-select:none; -ms-user-select: none; user-select: none;}' +
// arrows
'.viewer-next, .viewer-prev {cursor:pointer; position:fixed; z-index:10; width:150px; height:100%; top:0; background-position:center; background-repeat:no-repeat; background-color:rgba(0,0,0,.45);}' +
'.viewer-next {right:0; background-image:url(http://i.imgur.com/9JXuph4.png);}' +
'.viewer-prev {left:0; background-image:url(http://i.imgur.com/lS19ZRg.png);}' +
'.viewer-next.inactive, .viewer-prev.inactive {background-image:none;}' +
// background
'.viewer-bg {position:fixed; z-index:5; width:100%; height:100%; top:0; left:0; background-color:rgba(0,0,0,.4);}' +
// dragging
'.viewer-container.dragging a {outline:2px dotted rgba(0, 0, 0, 1); cursor:move; box-shadow:0 0 0 2px white;}' +
// zooming by click
'.viewer-container.zoomed {overflow:auto; max-width:100%; max-height:100%;}' +
'.viewer-container.zoomable a {cursor:zoom-in;}' +
'.viewer-container.zoomed a {cursor:zoom-out;}' +
// loading indicator
'.viewer-loading {position:absolute; left:50%; top:50%; margin:-12px 0 0 -12px; width:25px; height:25px; visibility:hidden; background-image:url(http://i.imgur.com/HTpFGms.gif); border-radius:50%; opacity:.7;}' +
'.viewer-container.loading .viewer-loading {visibility:visible;}' +
'.viewer-container.error .viewer-loading {visibility:visible; background-image:url(http://i.imgur.com/xPYn3BA.png);}' +
// close button
'.viewer-close {position:absolute; border-radius:50%; box-shadow:0 0 2px rgba(0, 0, 0, 0.5); opacity:.3; display:block; cursor:pointer; width:40px; height:40px; background-color:rgba(0, 0, 0, 0.5); background-image:url("http://i.imgur.com/ZXAJoup.png");}' +
'.viewer-close:hover {opacity:.6;}' +
'.viewer-close:active {margin:1px -1px; box-shadow:none; border:1px solid rgba(0, 0, 0, 0.5);}' +
'</style>');
