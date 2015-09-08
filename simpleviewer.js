var simpleviewer = new function () {
    // Private data
    var self = this,
        win = $(window),
        button_just_moved = false, // for floating close button
        in_fullscreen = in_drag = in_slideshow = stretching = shown = false,
        sshow_timeout = 2000, // slideshow interval in milliseconds
        sshow_pause = sshow_reset_time = false,
        loading_state = 1, // 1 - loading, 0 - loaded, -1 - error
        video_re = /\.(webm|mp4)([?#].*)?$/i,
        real_size, // natural dimension of the current source content
        clientX, clientY; // mousetracking for scroll zooming

    var sources = {
        all: [], // 1.jpg, 2.jpg, 3.png, ...
        cursor: 0,
        current: function () {
            return this.all[this.cursor];
        },
        next: function () {
            return this.all[this.cursor + 1] || false;
        },
        prev: function () {
            return this.all[this.cursor - 1] || false;
        }
    }

    var nodes = { // jquery objects
        root: null,
        container: null, // container for nodes.img and nodes.video
        active: null, // alias to nodes.img or nodes.video
        img: null,
        video: null,
        close: null,
        arrows: null, // alias to nodes.next.add(nodes.prev)
        next: null,
        prev: null,
        bg: null,
        // slideshow toolbar
        sshow_control: null, // container for sshow_ elements
        sshow_stretch: null,
        sshow_time: null,
        sshow_time_up: null,
        sshow_time_down: null,
        sshow_playpause: null
    }

    var conf = {
        _default: {
            margin: 0,  // margin from the corners of window if the content is too big - pixels
            min_size: 100, // minimum size when resizing/showing content - pixels
            close_by_content: true, // close viewer by click on shown content
            close_by_bg: true,
            gui_elements: { // enabled gui elements
                close_button: false,
                bg: true,
                arrows: true
            },
            button_offset: {right: 7, top: 7}, // close button offset from the top right corner - pixels
            floating_button: true // close button tries to stay inside visible area
        },
        gui_elements: {},
        button_offset: {}
    }

    // Public data
    this.shown = function () {
        return shown;
    }

    this.show = function () {
        if (shown) return false;

        nodes.container.show();

        if (sources.all.length > 1 && conf.gui_elements.arrows)
            nodes.arrows.show();

        if (conf.gui_elements.bg)
            nodes.bg.show();

        if (nodes.active === nodes.video)
            nodes.active[0].play();

        shown = true;
    }

    this.hide = function () {
        if (!shown) return false;

        if (in_fullscreen) toggleFullscreen();
        if (in_slideshow) toggleSlideshow();

        nodes.root.hide();

        shown = false;
    }

    this.next = function () {
        if (sources.cursor + 1 === sources.all.length) return false;

        if (in_slideshow && arguments[0])
            sshow_reset_time = true;

        sources.cursor++

        preload(sources.next());
        update(sources.cursor);
        updateArrows();
        return true;
    }

    this.prev = function () {
        if (sources.cursor === 0) return false;

        if (in_slideshow && arguments[0])
            sshow_reset_time = true;

        sources.cursor--

        preload(sources.prev());
        update(sources.cursor);
        updateArrows();
        return true;
    }

    this.update = update;
    this.reconfig = reconfig;
    this.handler = handler;

    // Init
    setupConfig(conf._default);

    // Private methods
    function setupConfig (c) {
        if (!c) return;

        if (c.margin >= 0)
            conf.margin = parseInt(c.margin);

        if (c.min_size > 0)
            conf.min_size = parseInt(c.min_size);

        if (c.floating_button !== undefined)
            conf.floating_button = Boolean(c.floating_button);

        if (typeof c.gui_elements === 'object') {
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

        if (config === null)
            config = conf._default;
        else if (typeof config !== 'object')
            config = {};

        setupConfig(config);

        self.update(sources.current());
        if (shown) self.show();
    }

    function preload (url) {
        if (video_re.test(url))
            document.createElement('video').src = url;
        else
            (new Image()).src = url;
    }

    function widthToHeight (h) {
        return h * real_size.width/real_size.height;
    }

    function heightToWidth (w) {
        return w * real_size.height/real_size.width;
    }

    function getNaturalSize () {
        var node = nodes.active[0],
            video = nodes.active === nodes.video,
            real_w, real_h;

        real_w = video ? node.videoWidth : node.naturalWidth;
        real_h = video ? node.videoHeight : node.naturalHeight;

        if (!real_w) real_w = win.width()*0.3;
        if (!real_h) real_h = win.height()*0.5;

        return {width: real_w, height: real_h};
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
        nodes.root = $(
        '<div class="viewer-bg"></div>' +
        '<div class="viewer-arrow viewer-prev"></div>' +
        '<div class="viewer-arrow viewer-next"></div>' +
        '<div class="viewer-container">' +
            '<div class="viewer-close"></div>' +
            '<div class="viewer-status"></div>' +
            '<a><img class="viewer-content"></a>' +
            '<a><video class="viewer-content" loop autoplay></video></a>' +
        '</div>' +
        '<div class="viewer-slideshow-control">' +
            '<div class="viewer-slideshow-stretch"></div>' +
            '<div class="viewer-slideshow-time-down"></div>' +
            '<div class="viewer-slideshow-time"></div>' +
            '<div class="viewer-slideshow-time-up"></div>' +
            '<div class="viewer-slideshow-play "></div>' +
        '</div>');

        nodes.container = nodes.root.filter('.viewer-container');
        nodes.bg = nodes.root.filter('.viewer-bg');
        nodes.next = nodes.root.filter('.viewer-next');
        nodes.prev = nodes.root.filter('.viewer-prev');
        nodes.arrows = nodes.next.add(nodes.prev);
        nodes.close = $('.viewer-close', nodes.container);
        nodes.video = $('video.viewer-content', nodes.container);
        nodes.img = $('img.viewer-content', nodes.container);

        nodes.sshow_control = nodes.root.filter('.viewer-slideshow-control');
        nodes.sshow_stretch = $('.viewer-slideshow-stretch', nodes.sshow_control);
        nodes.sshow_time = $('.viewer-slideshow-time', nodes.sshow_control);
        nodes.sshow_time_up = $('.viewer-slideshow-time-up', nodes.sshow_control);
        nodes.sshow_time_down = $('.viewer-slideshow-time-down', nodes.sshow_control);
        nodes.sshow_playpause = $('.viewer-slideshow-play', nodes.sshow_control);

        if (!conf.gui_elements.close_button)
            nodes.close.hide();

        if (!conf.gui_elements.arrows)
            nodes.arrows.hide();

        nodes.active = nodes.video;
        nodes.img.parent().hide();

        nodes.close.css({'right': conf.button_offset.right, 'top': conf.button_offset.top});
        nodes.sshow_time.text(sshow_timeout);

        nodes.root.hide();
        nodes.root.appendTo(document.body);
        setEvents();
    }

    function setEvents () {
        var content_nodes = nodes.img.add(nodes.video),
            $body = $(document.body);

        // scroll zooming
        content_nodes
        .on('wheel', wheelResizeHandler)
        .on('mousemove', mouseTrackingHandler)
        .one('mouseover', mouseTrackingHandler)
        // dragging
        .on('mousedown', mousedownDragHandler)
        .on('mouseout mouseup', mouseupDropHandler);

        // for middle click emulation
        content_nodes.parent()
        .on('mouseup click', function (e) {
            if (e.which !== 3) return false;
        });

        // slideshow controls
        nodes.sshow_playpause.click(slideshowTogglePause);
        nodes.sshow_time_down.click(function () {
            slideshowTimeout(sshow_timeout - 1000);
        });
        nodes.sshow_time_up.click(function () {
            slideshowTimeout(sshow_timeout + 1000);
        });
        nodes.sshow_stretch.click(function () {
            if (stretching) stretching = false;
            else stretching = true;
            adjustToWindow();
            nodes.sshow_stretch.toggleClass('viewer-slideshow-stretched');
        })

        // loading
        nodes.video.on('loadedmetadata', loadHandler);
        nodes.img.on('load', loadHandler);

        // error
        content_nodes.on('error', errorHandler);

        // close viewer
        nodes.close.click(clickCloseHandler);
        if (conf.close_by_bg)
            nodes.bg.on('click', clickCloseHandler);
        if (conf.close_by_content)
            content_nodes.on('click', clickCloseHandler);

        // next/prev for galleries
        nodes.next.click(self.next);
        nodes.prev.click(self.prev);

        // fullscreen and prev/next on keys
        $body
        .off('keyup', keyupHandler).off('keydown', keydownHandler)
        .on('keyup', keyupHandler).on('keydown', keydownHandler);
    }

    function update (urls, cursor) {
        if (!nodes.root || !nodes.root.length) constructView();

        if (urls === undefined) return;

        if (typeof urls === 'number') {
            sources.cursor = urls;
        }
        else {
            sources.all = [].concat(urls);

            if (!cursor || cursor < 0 || cursor >= sources.all.length)
                cursor = 0;

            sources.cursor = cursor;
        }

        loading(1);

        if (sources.all.length > 1) {
            preload(sources.next());
            preload(sources.prev());
            updateArrows();
        }

        var url = sources.current();

        if (video_re.test(url)) {
            nodes.active = nodes.video;
            nodes.img.parent().hide();
        }
        else {
            nodes.active = nodes.img;
            nodes.video.parent().hide();
        }

        nodes.active
        .off('error', errorHandler)
        .attr('src', '')
        .attr('src', url)
        .on('error', errorHandler);

        real_size = getNaturalSize();
        adjustToWindow();

        nodes.active.parent().attr('href', url);
        nodes.active.parent().show();
    }

    function updateArrows () {
        if (sources.all.length > 1) {
            nodes.arrows.removeClass('viewer-arrow-inactive');
            if (sources.cursor === 0) nodes.prev.addClass('viewer-arrow-inactive');
            if (sources.cursor + 1 === sources.all.length) nodes.next.addClass('viewer-arrow-inactive');
        }
    }

    function loading (state) {
        nodes.container.removeClass('viewer-error');
        if (state === 1) nodes.container.addClass('viewer-loading');
        if (state === 0) nodes.container.removeClass('viewer-loading');
        if (state === -1) {
            nodes.container.removeClass('viewer-loading');
            nodes.container.addClass('viewer-error');
        }

        loading_state = state;
    }

    function dragging (state) {
        if (state) nodes.container.addClass('viewer-dragging');
        else nodes.container.removeClass('viewer-dragging');

        in_drag = state;
    }

    function adjustToWindow () {
        if (stretching) stretchToWindow();
        else fitToWindow();
    }

    function fitToWindow () {
        var size = adjustedSize(real_size.width, real_size.height),
            pos = centrizedPos(size.width, size.height);

        contentSize(size.width, size.height);
        containerPos(pos.left, pos.top);
    }

    function stretchToWindow () {
        var win_w = win.width(),
            win_h = win.height(),
            real_w = real_size.width,
            real_h = real_size.height,
            new_pos, w, h;

        if (win_w/win_h > real_w/real_h)
            h = win_h;
        else
            w = win_w;

        if (isNaN(w)) w = widthToHeight(h);
        if (isNaN(h)) h = heightToWidth(w);

        new_pos = centrizedPos(w, h);
        contentSize(w, h);
        containerPos(new_pos.left, new_pos.top);
    }

    function toggleFullscreen () {
        var d = document, b = document.body;

        if (!in_fullscreen) {
            if (b.requestFullscreen)
              b.requestFullscreen();
            else if (b.mozRequestFullScreen)
              b.mozRequestFullScreen();
            else if (b.webkitRequestFullscreen)
              b.webkitRequestFullscreen();
            in_fullscreen = true;
            win.on('resize', adjustToWindow);
        }
        else {
            if (d.cancelFullscreen)
              d.cancelFullscreen();
            else if (d.mozCancelFullScreen)
              d.mozCancelFullScreen();
            else if (d.webkitCancelFullScreen)
              d.webkitCancelFullScreen();
            in_fullscreen = false;
            setTimeout(function () {
                win.off('resize', adjustToWindow);
            }, 100);
        }
    }

    function toggleSlideshow () {
        if (sources.all.length === 1) return false;

        if (!in_slideshow) {
            in_slideshow = true;
            var orig_timeout = prev_timeout = sshow_timeout,
                countdown = sshow_timeout - 1000;

            nodes.sshow_control.show();
            nodes.sshow_time.text(sshow_timeout/1000);
            if (conf.gui_elements.arrows) nodes.arrows.hide();
            if (conf.gui_elements.close_button) nodes.close.hide();

            var intv_id = setInterval(function () {

                // stop
                if (!in_slideshow) {
                    sshow_timeout = orig_timeout;
                    nodes.sshow_time.text(orig_timeout/1000)
                    clearInterval(intv_id);
                    return;
                }

                // change timeout
                if (sshow_timeout !== prev_timeout) {
                    prev_timeout = sshow_timeout;
                    countdown = sshow_timeout + 1000;
                }

                if (sshow_reset_time) {
                    countdown = sshow_timeout + 1000;
                    sshow_reset_time = false;
                }

                // pause
                if (sshow_pause || loading_state === 1);
                // count down
                else {
                    if (countdown)
                        countdown -= 1000
                    // next
                    if (!countdown) {
                        self.next() || self.update(0);
                        countdown = sshow_timeout;
                    }
                }

            }, 1000);
        }
        else {
            in_slideshow = false;

            nodes.sshow_control.hide();
            if (conf.gui_elements.arrows) nodes.arrows.show();
            if (conf.gui_elements.close_button) nodes.close.show();
        }
    }

    function slideshowTogglePause () {
        if (!sshow_pause) sshow_pause = true;
        else sshow_pause = false;

        nodes.sshow_playpause.toggleClass('viewer-slideshow-pause');
    }

    function slideshowTimeout (timeout) {
        if (timeout < 1000) return;

        sshow_timeout = timeout;
        nodes.sshow_time.text(timeout/1000);
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
        if (multiplier < 1)
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
        nodes.active.off('mousemove', mousemoveDragHandler);
    }

    function clickCloseHandler (e) {
        if (e.which !== 1) return;

        if (in_drag) {
            dragging(false);
            return;
        }

        self.hide();
    }

    function errorHandler (e) {
        if (loading_state === -1) return;

        loading(-1);
    }

    function loadHandler (e) {
        if (loading_state === 0) return;

        real_size = getNaturalSize();
        adjustToWindow();
        loading(0);
    }

    function keyupHandler (e) {
        if (e.shiftKey || e.ctrlKey || e.altKey || !shown) return;

        switch (e.which) {
            // 'f' - fullscreen
            case 70:
                toggleFullscreen();
                break;
            // 'esc' - stop slideshow or close viewer
            case 27:
                if (in_slideshow)
                    toggleSlideshow();
                else
                    self.hide();
                break;
            // 's' - slideshow
            case 83:
                toggleSlideshow();
                break;
            // 'down' - slideshow speed down
            case 40:
                if (in_slideshow)
                    slideshowTimeout(sshow_timeout - 1000);
                break;
            // 'up' - slideshow speed up
            case 38:
                if (in_slideshow)
                    slideshowTimeout(sshow_timeout + 1000);
                break;
            // '0' or 'numpad 0' - fit to window
            case 48:
            case 96:
                fitToWindow();
                break;
            // '<' - prev
            case 37:
                if (sources.all.length > 1)
                    self.prev(e)
                break;
            // 'cancel' - pause/play slideshow
            case 3:
                if (in_slideshow)
                    slideshowTogglePause();
                break;
            // 'space' - pause/play slideshow or next source
            case 32:
                if (in_slideshow)
                    slideshowTogglePause();
                else if (sources.all.length > 1)
                    self.next(e);
                break;
            // '>' - next
            case 39:
                if (sources.all.length > 1)
                    self.next(e);
                break;
        }
    }

    function keydownHandler (e) {
        // disable some of default actions
        keycodes = [32, 39, 37, 40, 38];
        if (keycodes.indexOf(e.which) != -1)
            e.preventDefault();
    }

    // Public shortcut handler
    function handler () {
        var urls = this.src,
            cursor = 0;

        if (arguments.length === 1 && typeof arguments[0] === 'string')
            urls = [arguments[0]];

        if (arguments[0].data || arguments.length >= 2) {
            var node = arguments[0].nodeName ? arguments[0] : this,
                arg = arguments[0].data || arguments[1],
                neighbor_nodes;

            if (typeof arg === 'string')
                neighbor_nodes = $(arg);
            else if (typeof arg === 'object' || arg.length !== undefined)
                neighbor_nodes = arg;

            urls = [];

            function get_url (node, arg) {
                if (typeof arg === 'function')
                    return arg.call(node, node);
                else if (typeof arg === 'string')
                    return node.getAttribute(arg);
                else
                    return node.src;
            }

            for (var i = 0; i < neighbor_nodes.length; i++) {log(node)
                if (node === neighbor_nodes[i]) cursor = i;

                var url = get_url(neighbor_nodes[i], arguments[2]);
                urls.push(url);
            };
        }

        self.update(urls, cursor);
        self.show();

        return false;
    }

}

$(document.head).append('<style type="text/css">' +
// main container
'.viewer-container {position:fixed; z-index:110;}' +
// img/video wrapper
'.viewer-container a {cursor:default; display:block; overflow:hidden; max-height:100%; outline:1px solid rgba(0, 0, 0, .7); background-color:lightgray; user-select: none; -moz-user-select:none; -webkit-user-select:none; -ms-user-select: none;}' +
    // dragging
    '.viewer-container.viewer-dragging a {outline:2px dotted rgba(0, 0, 0, 1); cursor:move; box-shadow:0 0 0 2px white;}' +
// sprite users
'.viewer-next:after, .viewer-prev:after, .viewer-container.viewer-error .viewer-status, .viewer-close {background-image:url("data:image/png; base64,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"); background-repeat:no-repeat; display:block;}' +
// arrows
'.viewer-arrow {width:50%; height:35px; bottom:0; z-index:120; position:fixed; cursor:pointer; background-color:rgba(0,0,0,.25);}' +
'.viewer-arrow-inactive {cursor:default;}' +
'.viewer-arrow:after {position:absolute; top:50%; left:50%; width:15px; height:25px; margin:-12px 0 0 -7px; opacity:.5; content:"";}' +
'.viewer-arrow:hover:after {opacity:1;}' +
'.viewer-arrow-inactive:after {display:none;}' +
'.viewer-next {right:0;}' +
'.viewer-next:after {background-position:-75px 0;}' +
'.viewer-prev {left:0;}' +
'.viewer-prev:after {background-position:-95px 0;}' +
// background
'.viewer-bg {position:fixed; z-index:100; width:100%; height:100%; top:0; left:0; background-color:rgba(0,0,0,.4);}' +
// loading status
'.viewer-status {position:absolute; left:50%; top:50%; margin:-12px 0 0 -12px; width:25px; height:25px; visibility:hidden; background-image:url("data:image/gif; base64,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"); border-radius:50%; opacity:.7;}' +
'.viewer-container.viewer-loading .viewer-status {visibility:visible;}' +
    // error
    '.viewer-container.viewer-error .viewer-status {visibility:visible; background-position:-45px 0;}' +
// close button
'.viewer-close {position:absolute; border-radius:50%; box-shadow:0 0 2px rgba(0, 0, 0, 0.5); opacity:.3; display:block; cursor:pointer; width:40px; height:40px; background-position:0 0; background-color:rgba(0, 0, 0, 0.5);}' +
'.viewer-close:hover {opacity:.6;}' +
'.viewer-close:active {margin:1px -1px; box-shadow:none; border:1px solid rgba(0, 0, 0, 0.5);}' +
// slideshow toolbar
'.viewer-slideshow-control {width:185px; height:24px; background-color:rgba(0,0,0,.45); position:fixed; border-radius:4px 4px 0 0; left:50%; overflow:hidden; bottom:0; margin-left:-92px; z-index:120; opacity:.5; cursor:default; font-family:DejaVu Serif, Georgia, Liberation Serif, serif;}' +
'.viewer-slideshow-control:hover {opacity:.8;}' +
    // slideshow toolbar items
    '.viewer-slideshow-control > * {float:left; cursor:pointer; font-weight:bold; color:white; height:24px; font-size:18px; user-select: none; -moz-user-select:none; -webkit-user-select:none; -ms-user-select: none;}' +
    '.viewer-slideshow-control > *:hover {background-color:rgba(0,0,0,.5);}' +
    '.viewer-slideshow-stretch {width:80px; position:absolute; left:0;}' +
    '.viewer-slideshow-stretch.viewer-slideshow-stretched:after {text-decoration:line-through;}' +
    '.viewer-slideshow-stretch:after {content:"stretch"; text-align:center; padding:0 5px;}' +
    '.viewer-slideshow-time-down {margin-left:83px;}' +
    '.viewer-slideshow-time-down:after {content:"⬇";}' +
    '.viewer-slideshow-time-up:after {content:"⬆";}' +
    '.viewer-slideshow-time {margin:0 3px;}' +
    '.viewer-slideshow-time:hover {background-color:transparent; cursor:default;}' +
    '.viewer-slideshow-time:after {content:"s";}' +
    '.viewer-slideshow-play {position:absolute; right:0; width:32px; text-align:center;}' +
    '.viewer-slideshow-play:after {content:"▮▮"; position:relative; top:-1px;}' +
    '.viewer-slideshow-pause:after {content:"▶";}' +
'</style>');
