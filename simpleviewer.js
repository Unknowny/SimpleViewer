function SimpleViewer (config) {
    // Private data
    var self = this,
        drag_state = false, // drag'n'drop indicator
        natural_size; // natural dimension of the source content

    var nodes = { // jquery objects
        main: null, // main view div container
        active: null, // alias to nodes.img or nodes.video
        img: null,
        video: null,
        button: null // close button
    }

    var conf = {
        margin: 0, // margin from the corners of window if the content is too big - pixels
        min_size: 100, // minimum size when resizing/showing content - pixels
        button_html: '', // html inside close button
        draggable: true,
        floating_button: true, // close button tries to stay inside visible area
        zoom: 'scroll', // zoom method - scroll/click/none
        close_by: 'button' // close method - button/content
    }

    // Public data
    this.nodes = nodes;
    this.shown = false;

    this.show = function () {
        nodes.main.show();
        if (nodes.active === nodes.video)
            nodes.active[0].play();

        self.shown = true;
    };

    this.hide = function () {
        nodes.main.hide();
        self.shown = false;
    };

    this.update = update;
    this.centrize = centrize;
    this.reconfig = reconfig;

    // Init
    if (config) setupConfig(config);

    // Private methods
    function setupConfig (c) {
        if (c.margin >= 0)
            conf.margin = c.margin;

        if (c.min_size > 0)
            conf.min_size = c.min_size;

        if (c.button_html)
            conf.button_html = c.button_html;

        if (typeof c.draggable === 'boolean')
            conf.draggable = c.draggable;

        if (typeof c.floating_button === 'boolean')
            conf.floating_button = c.floating_button;

        if (c.zoom === 'click') conf.zoom = 'click';
        else if (c.zoom === 'scroll') conf.zoom = 'scroll';
        else if (c.zoom === 'none') conf.zoom = 'none';

        if (c.close_by === 'content') conf.close_by == 'content';
        else if (c.close_by === 'button') conf.close_by == 'button';

        log(conf);
    }

    function reconfig (config) {
        if (nodes.main) {
            var prev_src = nodes.active[0].src;
            nodes.main.remove();
            nodes = {};
        }

        setupConfig(config);

        if (self.shown) {
            self.update(prev_src);
            self.show();
        }
    }

    function adjustedWidth (h) {
        return h * natural_size.width/natural_size.height;
    }

    function adjustedHeight (w) {
        return w * natural_size.height/natural_size.width;
    }

    function getNaturalSize () {
        var node = nodes.active[0];
        if (nodes.active === nodes.video)
            return {width: node.videoWidth, height: node.videoHeight};
        else
            return {width: node.naturalWidth, height: node.naturalHeight};
    }

    function constructView () {
        nodes.main = $('<div class="viewer">' +
                        '<button class="viewer-close">' + conf.button_html + '</button>' +
                        '<img class="viewer-content">' +
                        '<video class="viewer-content" loop autoplay></video>' +
                    '</div>');

        if (conf.zoom === 'scroll')
            nodes.main.addClass('scrollzoom');
        else if (conf.zoom === 'click')
            nodes.main.addClass('clickzoom');

        if (conf.draggable)
            nodes.main.addClass('draggable');

        nodes.button = $('.viewer-close', nodes.main);
        nodes.video = $('video.viewer-content', nodes.main);
        nodes.img = $('img.viewer-content', nodes.main);

        nodes.main.hide();
        nodes.main.appendTo(document.body);
        setEvents();
    }

    function update (src) {
        if (!nodes.main) constructView();

        if (/\.(webm|mp4)([?#].*)?$/i.test(src)) {
            nodes.active = nodes.video;
            nodes.img.hide();

            nodes.active.prop('src', src)
            .on('loadedmetadata', function () {
                natural_size = getNaturalSize();
                centrize();
            });
        }
        else {
            nodes.active = nodes.img;
            nodes.video.hide();

            nodes.active.prop('src', src);
            natural_size = getNaturalSize();
            centrize();
        }

        nodes.active.show();
    }

    function setEvents () {
        if (conf.draggable)
            nodes.img.add(nodes.video)
            .on('wheel', wheelResizeHandler)
            .on('mousedown', mousedownDragHandler)
            .on('mouseup', mouseupDropHandler);

        nodes.button
        .on('click', clickCloseHandler);
    }

    function centrize () {
        var window_w = $(window).width(),
            window_h = $(window).height(),
            w = natural_size.width,
            h = natural_size.height,
            x, y;

        // resize if too big
        if (w > window_w) {
            w = window_w - conf.margin * 2;
            h = adjustedHeight(w);
        }
        if (h > window_h) {
            h = window_h - conf.margin * 2;
            w = adjustedWidth(h);
        }

        // resize if too small
        if (w < conf.min_size || h < conf.min_size) {
            if (h < w) {
                h = conf.min_size;
                w = adjustedWidth(h);
            }
            else {
                w = conf.min_size;
                h = adjustedHeight(w);
            }
        }

        x = (window_w/2) - (w/2);
        y = (window_h/2) - (h/2);

        viewSize(w, h);
        viewPos(x, y);
    }

    // function adjustCloseButton () {
    //     var window_w = $(window).width(),
    //         window_h = $(window).height(),
    //         size = viewSize(),
    //         pos = viewPos(),
    //         x, y, delta, btn_pos;

    //     if (pos.left >= 0) {
    //         delta = -(window_w - (pos.left + size.width));

    //         if (delta > 0) {
    //             btn_pos = nodes.button.position();
    //             log(delta, btn_pos.left)
    //             x = btn_pos.left - delta;
    //         }
    //     }

    //     // if (pos.top <= 0) log('H');

    //     nodes.button.css({
    //         'left': x + 'px'
    //         // 'height': h + 'px'
    //     });
    // }

    function viewSize (w, h) {
        if (w === undefined)
            return {width: nodes.main.width(), height: nodes.main.height()};

        nodes.active[0].width = w;

        nodes.main.css({
            'width': w + 'px',
            'height': h + 'px'
        });
    }

    function viewPos (x, y) {
        if (x === undefined) return nodes.main.position();

        nodes.main.css({
            'left': x + 'px',
            'top': y + 'px'
        });

        // if (conf.floating_button) adjustCloseButton();
    }

    function resizeBy (delta) {
        var pos = viewPos(),
            size = viewSize();

        var w = size.width + delta,
            h = adjustedHeight(w);
            delta_x = delta / 2,
            delta_y = adjustedHeight(delta) / 2,
            x = pos.left - delta_x,
            y = pos.top - delta_y;

        if (h < conf.min_size || w < conf.min_size) return;

        // IM ONTO SOMETHING
        // var str = pos.left + ' - ' + delta + ' / ' + 2;
        //     log(str); log(x + ' real: ' + eval(str) + ' try: ' + (pos.left - delta / 2));
        // var str2 = pos.top + ' - ' + '(' + h + ' - ' + size.height + ' )' + ' / ' + 2;
        //     log(str2); log(y + ' real: ' + eval(str2) + ' try: ' + (pos.top - (h - size.height) / 2));

        viewSize(w, h);
        viewPos(x, y);
    }

    function setDragState (state) {
        if (state === true) {
            nodes.main.addClass('dragging');
            drag_state = true;
        }
        else if (state === false) {
            nodes.main.removeClass('dragging');
            drag_state = false;
        }
    }

    function wheelResizeHandler (e) {
        var delta = 50;

        if (e.originalEvent.deltaY > 0) resizeBy(-delta); // scroll down
        else resizeBy(delta); // scroll up

        return false;
    }

    function mousedownDragHandler (e) {
        if (e.which !== 1) return;

        // offset_x, offset_y - mouse offset relative to self node
        var offset_x = e.clientX - viewPos().left,
            offset_y = e.clientY - viewPos().top,
            $node = $(this);

        $node.on('mousemove', function (e) {
            if (!drag_state) {
                setDragState(true);
                $node.on('mouseout', mouseupDropHandler);
            }

            viewPos(e.clientX - offset_x,
                    e.clientY - offset_y);
        });

        return false;
    }

    function mouseupDropHandler (e) {
        if (drag_state) setDragState(false);

        // clear drag'n'drop events
        $(this).off('mousemove mouseout');
    }

    function clickCloseHandler (e) {
        if (e.which !== 1) return;

        self.hide();
    }

}

function simpleviewerHandler (e, src) {
    if (e.ctrlKey || e.altKey || e.shiftKey) return;

    // if clicked on the same node twice
    if (simpleviewer.source_node === e.target && simpleviewer.shown) {
        simpleviewer.hide();
    }
    else {
        simpleviewer.source_node = e.target;
        simpleviewer.update(src || e.target.src);
        simpleviewer.show();
    }

    return false;
}

// Main
var simpleviewer = new SimpleViewer();
$(document.head).append('<style type="text/css">' +
                        '.viewer {position:fixed; outline:1px solid rgba(0, 0, 0, .7);}' +
                        '.viewer.draggable {}' +
                        '.viewer.scrollzoom {}' +
                        '.viewer.clickzoom {}' +
                        '.viewer.dragging {outline:2px dotted rgba(0, 0, 0, 1); cursor:move; box-shadow:0 0 0 2px white;}' +
                        '.viewer-close {position:absolute; padding:0; cursor:pointer; right:7px; top:7px; width:40px; height:40px; background-color:rgba(213, 75, 75, 0.3); border:2px outset rgba(213, 75, 75, 0.3);}' +
                        '.viewer-close:hover {background-color:rgba(213, 75, 75, 0.45);}' +
                        '.viewer-close:active {border:2px inset rgba(213, 75, 75, 0.3); top:8px;}' +
                        '.viewer-close:focus {outline:0;} .viewer-close::-moz-focus-inner {border:0;}' + // remove ugly dotted border
                        '</style>');
