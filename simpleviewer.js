function SimpleViewer (tag, conf) {
    // Private data
    var viewer = this,
        shown = true,
        video = false,
        dropped = true, // drag'n'drop indicator
        natural_size;

    // Public data
    this.tag = null;
    this.source_tag = null;
    this.conf = {
        margin: 0
    }

    this.shown = function () {
        return shown;
    }

    this.show = function () {
        if (shown && !viewer.tag) return;

        // if tag detached from body
        if (!$.contains(document.documentElement, viewer.tag[0]))
            viewer.tag.appendTo(document.body);

        viewer.tag.show();
        if (video) viewer.tag[0].play();

        shown = true;
    };

    this.hide = function () {
        if (!shown) return;

        viewer.tag.hide();
        shown = false;
    };

    this.update = updateTag;

    // Init
    if (tag) viewer.update(tag);
    if (conf) {
        viewer.conf.margin = conf.margin * 0.01;
    }

    // Private methods
    function inDrag (state) {
        if (state === true) {
            viewer.tag.addClass('dragging');
            dropped = false;
        }
        else if (state === false) {
            viewer.tag.removeClass('dragging');
            dropped = true;
        }
    }

    function adjustWidth (h) {
        return h * natural_size.width/natural_size.height;
    }

    function adjustHeight (w) {
        return w * natural_size.height/natural_size.width;
    }

    function adjustToWindow (w, h) {
        var window_w = $(window).width(),
            window_h = $(window).height();

        if (w > window_w) {
            w = window_w - (window_w * viewer.conf.margin);
            h = adjustHeight(w);
        }
        if (h > window_h) {
            h = window_h - (window_h * viewer.conf.margin);
            w = adjustWidth(h);
        }

        var x = (window_w/2) - (w/2),
            y = (window_h/2) - (h/2);

        w = Math.floor(w);
        h = Math.floor(h);
        x = Math.floor(x);
        y = Math.floor(y);

        return {width: w, height: h, left: x, top: y};
    }

    function getNaturalSize (tag) {
        if (video) return {width: tag.videoWidth, height: tag.videoHeight};
        else return {width: tag.naturalWidth, height: tag.naturalHeight};
    }

    function getSource (tag) {
        if (video) return tag.currentSrc;
        else return tag.src;
    }

    function updateTag (tag) {
        viewer.source_tag = tag;

        video = tag.tagName === 'VIDEO';
        natural_size = getNaturalSize(tag);

        var size = adjustToWindow(natural_size.width, natural_size.height),
            src = getSource(tag);

        if (!viewer.tag) constructTag();

        viewer.tag.remove();
        constructTag();
        if (shown) viewer.tag.show();

        viewer.tag.prop({
            'width': size.width,
            'src': src
        });

        moveTag(size.left, size.top);
    }

    function constructTag () {
        viewer.tag = $(video ? '<video loop autoplay></video>' : '<img>');
        viewer.tag.addClass('viewer');
        setEvents();
    }

    function setEvents () {
        viewer.tag
        // resize events
        .on('wheel', wheelHandler)
        // drag'n'drop events
        .on('mousedown', mousedownHandler)
        .on('mouseup', mouseupHandler);
    }

    function resizeTag (delta) {
        var prev_h = viewer.tag.height(),
            pos = viewer.tag.position();

        viewer.tag[0].width += delta;

        var x = pos.left - delta / 2,
            y = pos.top - (viewer.tag.height() - prev_h) / 2;

        moveTag(x, y);
    }

    function moveTag (x, y) {
        viewer.tag.css({
            'left': x + 'px',
            'top': y + 'px'
        });
    }

    function wheelHandler (e) {
        var delta = 50;

        if (e.originalEvent.deltaY > 0) resizeTag(-delta); // scroll down
        else resizeTag(delta); // scroll up

        e.preventDefault();
    }

    function mousedownHandler (e) {
            if (e.which !== 1) return;

            // offset_x, offset_y - mouse offset relative to viewer tag
            var offset_x = e.clientX - viewer.tag.position().left,
                offset_y = e.clientY - viewer.tag.position().top;

            viewer.tag.on('mousemove', function (e) {
                if (dropped) {
                    inDrag(true);
                    viewer.tag.on('mouseout', function () {
                        viewer.tag.trigger('mouseup');
                    });
                }

                moveTag(e.clientX - offset_x,
                        e.clientY - offset_y);
            });

            e.preventDefault();
    }

    function mouseupHandler (e) {
        if (e.which !== 1) return;

        if (!dropped) inDrag(false);
        else viewer.hide();
        // clear drag'n'drop events
        viewer.tag.off('mousemove mouseout');
    }

}

// Main
var simple_viewer = new SimpleViewer();
$(document.head).append('<style type="text/css">' +
                        '.viewer {position:fixed; outline:1px solid rgba(0, 0, 0, .7);}' +
                        '.viewer.dragging {outline:2px dotted rgba(0, 0, 0, 1); box-shadow:0 0 0 2px white;}' +
                        '</style>');

$(document.body).on('click', '.simpleviewer', function (e) {
    if (e.ctrlKey || e.altKey || e.shiftKey) return;
    e.preventDefault()

    if (simple_viewer.source_tag === e.target && simple_viewer.shown()) {
        simple_viewer.hide();
        return;
    }

    simple_viewer.update(e.target);
    simple_viewer.show();
});
