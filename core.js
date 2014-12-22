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
        '!html');

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
'!css' +
'</style>');
