/**
 * cup-ux-trace.js — Browser-side UX workflow tracer
 *
 * Captures clicks, mouse paths, scroll depth, focus events,
 * and computes heuristic gaze estimates for UX analysis.
 *
 * Usage:
 *   import { UXTrace } from './cup-ux-trace.js';
 *   const trace = new UXTrace({ sampleRate: 60 });
 *   trace.start();
 *   // ... user interacts ...
 *   const report = trace.stop();
 *   console.log(report);           // Full trace data
 *   trace.overlay();               // Render visual overlay
 *   trace.download();              // Download JSON report
 */

// ── Event Types ──────────────────────────────────────────────────
/** @typedef {'click'|'move'|'scroll'|'focus'|'blur'|'keydown'} EventKind */

/**
 * @typedef {Object} TraceEvent
 * @property {EventKind} kind
 * @property {number} t        - timestamp (ms since trace start)
 * @property {number} x        - viewport X
 * @property {number} y        - viewport Y
 * @property {string} target   - CSS selector of event target
 * @property {string} [tag]    - element tagName
 * @property {string} [text]   - truncated innerText (clicks only)
 * @property {Object} [meta]   - extra data (scrollY, key, etc.)
 */

/**
 * @typedef {Object} GazePoint
 * @property {number} x
 * @property {number} y
 * @property {number} t        - timestamp
 * @property {number} dwell    - estimated dwell time (ms)
 * @property {string} pattern  - 'f-scan'|'z-scan'|'gutenberg'|'fixation'
 */

/**
 * @typedef {Object} WorkflowNode
 * @property {string} id
 * @property {string} action   - 'click'|'input'|'navigate'|'scroll'
 * @property {string} target   - CSS selector
 * @property {string} label    - human readable
 * @property {number} t
 * @property {number} duration - ms spent before next action
 * @property {WorkflowNode[]} children
 */

// ── Utility ──────────────────────────────────────────────────────
function cssSelector(el) {
  if (!el || el === document.body || el === document.documentElement) return 'body';
  if (el.id) return '#' + CSS.escape(el.id);
  let path = el.tagName.toLowerCase();
  if (el.className && typeof el.className === 'string') {
    const cls = el.className.trim().split(/\s+/).slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
    path += cls;
  }
  return path;
}

function truncate(str, len) {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

// ── Heuristic Gaze Model ─────────────────────────────────────────
/**
 * Estimates gaze position based on mouse position + reading patterns.
 *
 * Research basis:
 * - Chen et al. (2001): mouse-gaze correlation r=0.84 within 200px
 * - Nielsen (2006): F-pattern for text-heavy pages
 * - Gutenberg diagram: gravity from top-left to bottom-right
 *
 * We blend mouse position (weighted 0.7) with pattern-predicted
 * position (weighted 0.3) based on time-in-viewport.
 */
class GazeEstimator {
  constructor() {
    this.points = [];
    this._lastMouse = { x: 0, y: 0, t: 0 };
    this._viewW = window.innerWidth;
    this._viewH = window.innerHeight;
  }

  /** Feed a mouse move event */
  feed(x, y, t) {
    const dt = t - this._lastMouse.t;
    this._lastMouse = { x, y, t };

    // Predict gaze = mouse (0.7) + reading pattern (0.3)
    const pattern = this._predictPattern(x, y, t);
    const gx = x * 0.7 + pattern.x * 0.3;
    const gy = y * 0.7 + pattern.y * 0.3;

    // Estimate dwell: if mouse barely moved, eyes are fixating
    const dist = Math.hypot(x - (this.points.length ? this.points[this.points.length - 1].x : x),
                            y - (this.points.length ? this.points[this.points.length - 1].y : y));
    const dwell = dist < 30 ? Math.min(dt, 2000) : Math.min(dt * 0.3, 500);

    this.points.push({ x: gx, y: gy, t, dwell, pattern: pattern.name });
  }

  /** Predict where eyes would be based on F-pattern / Z-pattern */
  _predictPattern(mouseX, mouseY, t) {
    const normX = mouseX / this._viewW;
    const normY = mouseY / this._viewH;

    // F-pattern: eyes scan left side heavily, sweep right occasionally
    if (normX < 0.6 && normY < 0.7) {
      return { x: this._viewW * 0.15, y: mouseY, name: 'f-scan' };
    }
    // Z-pattern: diagonal sweep (common for sparse layouts)
    if (normY > 0.3 && normY < 0.7) {
      const zx = this._viewW * (0.2 + normY * 0.6);
      return { x: zx, y: mouseY, name: 'z-scan' };
    }
    // Gutenberg: gravity toward primary/terminal optical areas
    return {
      x: mouseX * 0.8 + this._viewW * 0.1,
      y: mouseY * 0.8 + this._viewH * 0.1,
      name: 'gutenberg'
    };
  }

  getPoints() { return this.points; }

  /** Compute attention heatmap as grid cells */
  heatmap(cellSize = 40) {
    const cols = Math.ceil(this._viewW / cellSize);
    const rows = Math.ceil(this._viewH / cellSize);
    const grid = Array.from({ length: rows }, () => new Float32Array(cols));

    for (const p of this.points) {
      const c = Math.min(Math.floor(p.x / cellSize), cols - 1);
      const r = Math.min(Math.floor(p.y / cellSize), rows - 1);
      if (c >= 0 && r >= 0) grid[r][c] += p.dwell;
    }
    return { grid, cellSize, cols, rows };
  }
}

// ── Workflow Tree Builder ────────────────────────────────────────
class WorkflowBuilder {
  constructor() {
    this.root = { id: 'root', action: 'start', target: 'document', label: 'Session Start', t: 0, duration: 0, children: [] };
    this._current = this.root;
    this._counter = 0;
  }

  addAction(action, target, label, t) {
    // Close previous node's duration
    if (this._current.children.length) {
      const prev = this._current.children[this._current.children.length - 1];
      prev.duration = t - prev.t;
    }

    const node = {
      id: `n${++this._counter}`,
      action,
      target,
      label: truncate(label, 50),
      t,
      duration: 0,
      children: []
    };

    // Navigation events create new branches
    if (action === 'navigate') {
      this.root.children.push(node);
      this._current = node;
    } else {
      this._current.children.push(node);
    }
    return node;
  }

  getTree() {
    return this.root;
  }

  /** Flatten tree to ordered list of actions */
  flatten() {
    const result = [];
    const walk = (node, depth) => {
      result.push({ ...node, depth, children: undefined });
      (node.children || []).forEach(c => walk(c, depth + 1));
    };
    walk(this.root, 0);
    return result;
  }
}

// ── Main Tracer ──────────────────────────────────────────────────
export class UXTrace {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.sampleRate=30]       - mouse samples per second
   * @param {boolean} [opts.captureKeys=false]   - record keydown events
   * @param {boolean} [opts.autoOverlay=false]   - show overlay on stop
   * @param {string} [opts.sessionId]            - custom session ID
   */
  constructor(opts = {}) {
    this.sampleRate = opts.sampleRate || 30;
    this.captureKeys = opts.captureKeys || false;
    this.autoOverlay = opts.autoOverlay || false;
    this.sessionId = opts.sessionId || crypto.randomUUID();

    this.events = [];
    this.gaze = new GazeEstimator();
    this.workflow = new WorkflowBuilder();
    this._running = false;
    this._startTime = 0;
    this._handlers = {};
    this._moveInterval = 1000 / this.sampleRate;
    this._lastMoveTime = 0;
    this._scrollMax = 0;
    this._overlayEl = null;
  }

  /** Start recording */
  start() {
    if (this._running) return;
    this._running = true;
    this._startTime = performance.now();

    this._handlers.click = (e) => this._onClick(e);
    this._handlers.mousemove = (e) => this._onMouseMove(e);
    this._handlers.scroll = () => this._onScroll();
    this._handlers.focusin = (e) => this._onFocus(e);

    document.addEventListener('click', this._handlers.click, { passive: true });
    document.addEventListener('mousemove', this._handlers.mousemove, { passive: true });
    document.addEventListener('scroll', this._handlers.scroll, { passive: true });
    document.addEventListener('focusin', this._handlers.focusin, { passive: true });

    if (this.captureKeys) {
      this._handlers.keydown = (e) => this._onKeyDown(e);
      document.addEventListener('keydown', this._handlers.keydown, { passive: true });
    }
  }

  /** Stop recording, return report */
  stop() {
    if (!this._running) return this.report();
    this._running = false;

    document.removeEventListener('click', this._handlers.click);
    document.removeEventListener('mousemove', this._handlers.mousemove);
    document.removeEventListener('scroll', this._handlers.scroll);
    document.removeEventListener('focusin', this._handlers.focusin);
    if (this._handlers.keydown) {
      document.removeEventListener('keydown', this._handlers.keydown);
    }

    if (this.autoOverlay) this.overlay();
    return this.report();
  }

  /** Generate full report */
  report() {
    const duration = this._running
      ? performance.now() - this._startTime
      : (this.events.length ? this.events[this.events.length - 1].t : 0);

    const clicks = this.events.filter(e => e.kind === 'click');
    const moves = this.events.filter(e => e.kind === 'move');

    // Compute mouse path length
    let pathLength = 0;
    for (let i = 1; i < moves.length; i++) {
      pathLength += Math.hypot(moves[i].x - moves[i - 1].x, moves[i].y - moves[i - 1].y);
    }

    // Click clustering — group clicks within 80px
    const clusters = this._clusterPoints(clicks, 80);

    // Dead zones — viewport quadrants with < 5% of gaze dwell
    const heatmap = this.gaze.heatmap(80);
    const deadZones = this._findDeadZones(heatmap);

    // Fitts's Law: flag small targets that got clicked
    const fittsViolations = clicks.filter(c => {
      const el = document.querySelector(c.target);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width < 32 || rect.height < 32;
    }).map(c => ({ target: c.target, t: c.t }));

    return {
      sessionId: this.sessionId,
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      duration: Math.round(duration),
      scrollDepthMax: this._scrollMax,
      scrollDepthPct: Math.round((this._scrollMax / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100),
      events: this.events,
      metrics: {
        totalClicks: clicks.length,
        totalMoves: moves.length,
        mousePathLength: Math.round(pathLength),
        clicksPerMinute: duration > 0 ? +(clicks.length / (duration / 60000)).toFixed(1) : 0,
        avgTimeBetweenClicks: clicks.length > 1
          ? Math.round(clicks.reduce((s, c, i) => i > 0 ? s + (c.t - clicks[i - 1].t) : s, 0) / (clicks.length - 1))
          : 0,
        clickClusters: clusters,
        fittsViolations,
        deadZones,
      },
      gaze: {
        points: this.gaze.getPoints(),
        heatmap: heatmap,
        patternDistribution: this._gazePatternDist(),
      },
      workflow: this.workflow.getTree(),
      workflowFlat: this.workflow.flatten(),
    };
  }

  /** Render visual overlay on the page */
  overlay() {
    if (this._overlayEl) this._overlayEl.remove();

    const report = this.report();
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    Object.assign(canvas.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      width: '100%', height: '100%', pointerEvents: 'none',
      opacity: '0.6',
    });
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Draw gaze heatmap
    const { grid, cellSize, cols, rows } = report.gaze.heatmap;
    let maxDwell = 0;
    for (const row of grid) for (const v of row) if (v > maxDwell) maxDwell = v;
    if (maxDwell > 0) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const intensity = grid[r][c] / maxDwell;
          if (intensity > 0.05) {
            const hue = 60 - intensity * 60; // yellow → red
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${intensity * 0.5})`;
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    // Draw mouse path
    const moves = report.events.filter(e => e.kind === 'move');
    if (moves.length > 1) {
      ctx.beginPath();
      ctx.moveTo(moves[0].x, moves[0].y);
      for (let i = 1; i < moves.length; i++) {
        ctx.lineTo(moves[i].x, moves[i].y);
      }
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw click points
    const clicks = report.events.filter(e => e.kind === 'click');
    for (const c of clicks) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(248, 113, 113, 0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(248, 113, 113, 1)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Create container with close button
    const container = document.createElement('div');
    container.id = 'cup-ux-trace-overlay';
    Object.assign(container.style, { position: 'fixed', inset: '0', zIndex: '99998' });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close Trace';
    Object.assign(closeBtn.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: '100000',
      padding: '8px 16px', background: '#161622', color: '#d8d8e4',
      border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
      cursor: 'pointer', fontFamily: 'system-ui', fontSize: '13px',
    });
    closeBtn.addEventListener('click', () => container.remove());

    // Metrics panel
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed', bottom: '12px', left: '12px', zIndex: '100000',
      padding: '12px 16px', background: 'rgba(22,22,34,0.95)',
      border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
      color: '#d8d8e4', fontFamily: 'system-ui', fontSize: '12px',
      lineHeight: '1.6', maxWidth: '320px', backdropFilter: 'blur(8px)',
    });
    const m = report.metrics;
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;color:#818cf8;">📊 UX Trace Report</div>
      <div>Duration: <strong>${(report.duration / 1000).toFixed(1)}s</strong></div>
      <div>Clicks: <strong>${m.totalClicks}</strong> (${m.clicksPerMinute}/min)</div>
      <div>Mouse Path: <strong>${(m.mousePathLength / 1000).toFixed(1)}k px</strong></div>
      <div>Scroll Depth: <strong>${report.scrollDepthPct}%</strong></div>
      <div>Avg Click Interval: <strong>${(m.avgTimeBetweenClicks / 1000).toFixed(1)}s</strong></div>
      <div>Click Clusters: <strong>${m.clickClusters.length}</strong></div>
      <div>Fitts Violations: <strong style="color:${m.fittsViolations.length ? '#f87171' : '#34d399'}">${m.fittsViolations.length}</strong></div>
      <div>Dead Zones: <strong style="color:${m.deadZones.length ? '#fbbf24' : '#34d399'}">${m.deadZones.length}</strong></div>
      <div style="margin-top:4px;color:#9090a8;">Gaze: ${Object.entries(this._gazePatternDist()).map(([k, v]) => `${k} ${v}%`).join(' · ')}</div>
    `;

    container.appendChild(canvas);
    container.appendChild(closeBtn);
    container.appendChild(panel);
    document.body.appendChild(container);
    this._overlayEl = container;
  }

  /** Download report as JSON */
  download(filename) {
    const report = this.report();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `ux-trace-${this.sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Private event handlers ──────────────────────────────────────
  _t() { return Math.round(performance.now() - this._startTime); }

  _onClick(e) {
    const t = this._t();
    const target = cssSelector(e.target);
    const ev = {
      kind: 'click', t, x: e.clientX, y: e.clientY,
      target, tag: e.target.tagName, text: truncate(e.target.innerText, 40),
    };
    this.events.push(ev);

    // Feed gaze estimator (clicks = strong fixation)
    this.gaze.feed(e.clientX, e.clientY, t);

    // Build workflow tree
    const label = e.target.innerText?.trim()?.slice(0, 30) || e.target.tagName;
    this.workflow.addAction('click', target, label, t);
  }

  _onMouseMove(e) {
    const now = performance.now();
    if (now - this._lastMoveTime < this._moveInterval) return;
    this._lastMoveTime = now;
    const t = this._t();
    this.events.push({ kind: 'move', t, x: e.clientX, y: e.clientY, target: '' });
    this.gaze.feed(e.clientX, e.clientY, t);
  }

  _onScroll() {
    const t = this._t();
    const y = window.scrollY;
    if (y > this._scrollMax) this._scrollMax = y;
    this.events.push({ kind: 'scroll', t, x: 0, y, target: '', meta: { scrollY: y } });
  }

  _onFocus(e) {
    const t = this._t();
    const target = cssSelector(e.target);
    this.events.push({ kind: 'focus', t, x: 0, y: 0, target, tag: e.target.tagName });
    this.workflow.addAction('input', target, e.target.tagName, t);
  }

  _onKeyDown(e) {
    if (!this.captureKeys) return;
    const t = this._t();
    this.events.push({
      kind: 'keydown', t, x: 0, y: 0,
      target: cssSelector(e.target), meta: { key: e.key },
    });
  }

  // ── Analysis helpers ────────────────────────────────────────────
  _clusterPoints(points, radius) {
    const clusters = [];
    const used = new Set();
    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const cluster = [points[i]];
      used.add(i);
      for (let j = i + 1; j < points.length; j++) {
        if (used.has(j)) continue;
        if (Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y) <= radius) {
          cluster.push(points[j]);
          used.add(j);
        }
      }
      if (cluster.length >= 2) {
        const cx = cluster.reduce((s, p) => s + p.x, 0) / cluster.length;
        const cy = cluster.reduce((s, p) => s + p.y, 0) / cluster.length;
        clusters.push({
          center: { x: Math.round(cx), y: Math.round(cy) },
          count: cluster.length,
          targets: [...new Set(cluster.map(c => c.target))],
        });
      }
    }
    return clusters;
  }

  _findDeadZones(heatmap) {
    const { grid, cols, rows } = heatmap;
    let totalDwell = 0;
    for (const row of grid) for (const v of row) totalDwell += v;
    if (totalDwell === 0) return [];

    // Check quadrants
    const zones = [];
    const quads = [
      { name: 'top-left', r0: 0, r1: Math.floor(rows / 2), c0: 0, c1: Math.floor(cols / 2) },
      { name: 'top-right', r0: 0, r1: Math.floor(rows / 2), c0: Math.floor(cols / 2), c1: cols },
      { name: 'bottom-left', r0: Math.floor(rows / 2), r1: rows, c0: 0, c1: Math.floor(cols / 2) },
      { name: 'bottom-right', r0: Math.floor(rows / 2), r1: rows, c0: Math.floor(cols / 2), c1: cols },
    ];
    for (const q of quads) {
      let qDwell = 0;
      for (let r = q.r0; r < q.r1; r++)
        for (let c = q.c0; c < q.c1; c++)
          qDwell += grid[r][c];
      if (qDwell / totalDwell < 0.05) {
        zones.push({ quadrant: q.name, dwellPct: +((qDwell / totalDwell) * 100).toFixed(1) });
      }
    }
    return zones;
  }

  _gazePatternDist() {
    const points = this.gaze.getPoints();
    if (!points.length) return { 'f-scan': 0, 'z-scan': 0, 'gutenberg': 0 };
    const counts = {};
    for (const p of points) counts[p.pattern] = (counts[p.pattern] || 0) + 1;
    const total = points.length;
    const dist = {};
    for (const [k, v] of Object.entries(counts)) dist[k] = Math.round((v / total) * 100);
    return dist;
  }
}

// ── Auto-attach helper for prototypes ────────────────────────────
/**
 * Quick-start: adds a floating "🔍 Trace" button to any page.
 * Call UXTrace.auto() at the bottom of your HTML.
 */
UXTrace.auto = function(opts = {}) {
  const trace = new UXTrace(opts);
  const btn = document.createElement('button');
  btn.textContent = '🔍 Start Trace';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '12px', right: '12px', zIndex: '99990',
    padding: '8px 14px', background: '#818cf8', color: '#0b0b11',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontFamily: 'system-ui', fontSize: '13px', fontWeight: '600',
    boxShadow: '0 4px 16px rgba(129,140,248,0.3)',
  });
  let running = false;
  btn.addEventListener('click', () => {
    if (!running) {
      trace.start();
      btn.textContent = '⏹ Stop Trace';
      btn.style.background = '#f87171';
      running = true;
    } else {
      const report = trace.stop();
      btn.textContent = '📥 Download';
      btn.style.background = '#34d399';
      running = false;
      btn.addEventListener('click', () => trace.download(), { once: true });
    }
  });
  document.body.appendChild(btn);
  return trace;
};
