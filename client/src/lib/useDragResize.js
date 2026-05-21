import { useState, useCallback, useEffect, useRef, createElement } from 'react';

/**
 * useDragResize — draggable panel splitter hook
 * @param {object} opts
 * @param {number}  opts.initial     - initial width in px
 * @param {number}  opts.min         - minimum width in px
 * @param {number}  opts.max         - maximum width in px
 * @param {'left'|'right'} opts.side - which panel the width controls
 * @param {string}  opts.storageKey  - localStorage key for persisting width
 * @returns {{ width, handleProps, isDragging }}
 */
export default function useDragResize({ initial, min, max, side, storageKey }) {
  side = side || 'left';
  var stored = storageKey ? parseInt(localStorage.getItem(storageKey)) : NaN;
  var [width, setWidth]         = useState(isNaN(stored) ? initial : stored);
  var [isDragging, setDragging] = useState(false);
  var dragging = useRef(false);
  var startX   = useRef(0);
  var startW   = useRef(0);

  var onMouseDown = useCallback(function(e) {
    e.preventDefault();
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = width;
    setDragging(true);
  }, [width]);

  useEffect(function() {
    function onMove(e) {
      if (!dragging.current) return;
      var delta = side === 'left'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      var next = Math.min(max, Math.max(min, startW.current + delta));
      setWidth(next);
      if (storageKey) {
        try { localStorage.setItem(storageKey, String(Math.round(next))); } catch (_) {}
      }
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      setDragging(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return function() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [min, max, side, storageKey]);

  // Pip indicator rendered via createElement (no JSX in .js file)
  var pip = createElement('div', {
    style: {
      position:      'absolute',
      top:           '50%',
      left:          '50%',
      transform:     'translate(-50%,-50%)',
      width:         4,
      height:        40,
      borderRadius:  99,
      background:    isDragging ? '#00C982' : '#D1D5DB',
      transition:    'background .15s',
      pointerEvents: 'none',
    },
  });

  var handleProps = {
    onMouseDown: onMouseDown,
    title:       'Drag to resize',
    style: {
      width:          6,
      cursor:         'col-resize',
      background:     isDragging ? 'rgba(0,201,130,.12)' : 'transparent',
      borderLeft:     '1px solid ' + (isDragging ? '#00C982' : '#F0F0F0'),
      flexShrink:     0,
      position:       'relative',
      transition:     isDragging ? 'none' : 'background .15s',
      userSelect:     'none',
      WebkitUserSelect:'none',
      zIndex:         10,
    },
    children: pip,
  };

  return { width: width, handleProps: handleProps, isDragging: isDragging };
}
