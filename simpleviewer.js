function SimpleViewer (tag) {
    // Private data
    var viewer = this,
        shown = true,
        dropped = true, // drag'n'drop indicator
        originalTag, naturalSize, src;

    // Public data
    this.tag = null;

    this.show = function () {
        if (shown && !viewer.tag) return;

        viewer.tag.show();
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
        return h * naturalSize.width/naturalSize.height;
    }

    function adjustHeight (w) {
        return w * naturalSize.height/naturalSize.width;
    }

    function adjustToWindow (w, h) {
        var window_w = $(window).width(),
            window_h = $(window).height();

        if (w > window_w) {
            w = window_w * 0.9;
            h = adjustHeight(w);
        }
        if (h > window_h) {
            h = window_h * 0.9;
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
        return {width: tag.naturalWidth, height: tag.naturalHeight};
    }

    function updateTag (tag) {
        if (!viewer.tag) constructTag(tag);

        src = tag.src;
        naturalSize = getNaturalSize(tag);
        originalTag = tag;
        var size = adjustToWindow(naturalSize.width, naturalSize.height)

        viewer.tag.attr({
            'width': size.width,
            'src': src
        });

        moveTag(size.left, size.top);
    }

    function constructTag (tag) {
        viewer.tag = $('<img class="viewer">');

        viewer.tag
        // resize events
        .on('wheel', function (e) {
            var delta = 50;

            if (e.originalEvent.deltaY > 0) resizeTag(-delta); // scroll down
            else resizeTag(delta); // scroll up

            e.preventDefault();
        })
        // drag'n'drop events
        .on('mousedown', function (e) {
            // offset_x, offset_y - mouse offset relative to viewer tag
            var offset_x = e.clientX - viewer.tag.offset().left,
                offset_y = e.clientY - viewer.tag.offset().top;

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
        })
        .on('mouseup', function (e) {
            if (!dropped) inDrag(false);
            else viewer.hide();
            // clean drag'n'drop events
            viewer.tag.off('mousemove mouseout');
        });

        viewer.tag.hide();
        viewer.tag.appendTo(document.body);
    }

    function resizeTag (delta) {
        var old_h = viewer.tag[0].height,
            pos = viewer.tag.offset();

        viewer.tag[0].width += delta;

        var x = pos.left - delta / 2,
            y = pos.top - (viewer.tag[0].height - old_h) / 2;

        moveTag(x, y);
    }

    function moveTag (x, y) {
        viewer.tag.css({
            'left': x + 'px',
            'top': y + 'px'
        })
    }

}

(function () {
    var style = '.viewer {position: fixed; border: 1px solid rgba(0, 0, 0, .7);}' +
                '.viewer.dragging {outline: 2px dotted rgba(0, 0, 0, 1); box-shadow: 0 0 0 2px white;}'
    $(document.head).append('<style type="text/css">' + style + '</style>')

    var viewer = new SimpleViewer();

    $(document.body).on('click', '.simpleviewer', function (e) {
        viewer.update(e.target);
        viewer.show();
        e.preventDefault();
    })
})()
