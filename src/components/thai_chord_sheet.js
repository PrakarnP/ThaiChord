/**
 * ThaiChord Autonomous Web Component: <thai-chord>
 *
 * Lightweight, zero-dependency, Shadow DOM encapsulated custom element.
 * Renders Decoupled 2D Timeline Grid: Track 0 chords floating optically
 * above Track 1 continuous Thai lyrics with zero voids and native slash chords.
 */

import { parseChordPro } from '../lexer.js';
import { buildTimelineForDoc, createCanvasMeasure } from '../timeline.js';
import { transposeChordPro } from '../transposer.js';

const BaseClass = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates static HTML representation of a ChordPro song with 2D decoupled tracks.
 * Usable for SSR, static site generation, or Web Component rendering.
 *
 * @param {string} chordProText
 * @param {object} [options]
 * @returns {string} HTML string
 */
export function renderChordSheetHtml(chordProText, options = {}) {
  const transpose = parseInt(options.transpose ?? 0, 10) || 0;
  const key = options.key || null;
  const theme = options.theme || 'light';

  const processedChordPro = transpose !== 0
    ? transposeChordPro(chordProText, transpose, key)
    : chordProText;

  const parsedDoc = parseChordPro(processedChordPro);
  const measure = options.measureText || (typeof document !== 'undefined' ? createCanvasMeasure('18.4px system-ui, -apple-system, Sarabun, sans-serif') : null);
  const { metadata, timelines } = buildTimelineForDoc(parsedDoc, { ...options, measureText: measure });

  let html = `<div class="tc-container tc-theme-${escapeHtml(theme)}">`;

  // Render Song Header if title exists
  if (metadata.title) {
    html += `<header class="tc-header">`;
    html += `<h2 class="tc-title">${escapeHtml(metadata.title)}</h2>`;
    if (metadata.artist) {
      html += `<div class="tc-artist">${escapeHtml(metadata.artist)}</div>`;
    }
    const metaBadges = [];
    if (metadata.key) metaBadges.push(`Key: ${escapeHtml(metadata.key)}`);
    if (metadata.tempo) metaBadges.push(`Tempo: ${escapeHtml(metadata.tempo)}`);
    if (metadata.time) metaBadges.push(`Time: ${escapeHtml(metadata.time)}`);
    if (metaBadges.length > 0) {
      html += `<div class="tc-badges">${metaBadges.map(b => `<span class="tc-badge">${b}</span>`).join('')}</div>`;
    }
    html += `</header>`;
  }

  // Render Body Lines
  html += `<main class="tc-sheet-body">`;
  for (const line of timelines) {
    if (line.type === 'section') {
      html += `<div class="tc-section-header">${escapeHtml(line.name)}</div>`;
    } else if (line.type === 'comment') {
      html += `<div class="tc-comment-line">${escapeHtml(line.text)}</div>`;
    } else if (line.type === 'empty') {
      html += `<div class="tc-blank-line"></div>`;
    } else if (line.type === 'lyric') {
      const minWidth = Math.ceil(line.totalWidth || 0);
      html += `<div class="tc-line-block" style="min-width: ${minWidth}px">`;

      // Track 0: Chords
      if (line.chords && line.chords.length > 0) {
        html += `<div class="tc-chord-track" style="width: ${minWidth}px">`;
        for (const chord of line.chords) {
          const leftPx = chord.x_actual.toFixed(1);
          const displacedClass = chord.displaced ? ' tc-displaced' : '';
          html += `<span class="tc-chord-item${displacedClass}" style="left: ${leftPx}px" title="${escapeHtml(chord.raw)}">`;
          html += `<span class="tc-root">${escapeHtml(chord.rootNote || '')}</span>`;
          if (chord.quality) {
            html += `<span class="tc-quality">${escapeHtml(chord.quality)}</span>`;
          }
          if (chord.bass) {
            html += `<span class="tc-slash">/</span><span class="tc-bass">${escapeHtml(chord.bass)}</span>`;
          }
          html += `</span>`;
        }
        html += `</div>`;
      }

      // Track 1: Continuous Unbroken Lyrics (Never sliced or span-split)
      html += `<div class="tc-lyric-track">${escapeHtml(line.lyrics || ' ')}</div>`;
      html += `</div>`;
    }
  }
  html += `</main></div>`;

  return html;
}

export const COMPONENT_CSS = `
  :host {
    display: block;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Sarabun", "Noto Sans Thai", sans-serif;
    color: var(--tc-text, #1e293b);
    background-color: var(--tc-bg, transparent);
    --tc-chord-color: #0284c7;
    --tc-bass-color: #db2777;
    --tc-section-color: #7c3aed;
    --tc-comment-color: #64748b;
    --tc-border-color: #e2e8f0;
  }

  :host([theme="dark"]), .tc-theme-dark {
    --tc-text: #f8fafc;
    --tc-bg: #0f172a;
    --tc-chord-color: #38bdf8;
    --tc-bass-color: #f472b6;
    --tc-section-color: #c084fc;
    --tc-comment-color: #94a3b8;
    --tc-border-color: #334155;
  }

  :host([theme="print"]), .tc-theme-print {
    --tc-text: #000000;
    --tc-bg: #ffffff;
    --tc-chord-color: #111827;
    --tc-bass-color: #374151;
    --tc-section-color: #1f2937;
    --tc-comment-color: #4b5563;
    --tc-border-color: #9ca3af;
  }

  .tc-container {
    padding: 1.25rem;
    box-sizing: border-box;
  }

  .tc-header {
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--tc-border-color);
    padding-bottom: 0.75rem;
  }

  .tc-title {
    margin: 0 0 0.25rem 0;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .tc-artist {
    font-size: 1rem;
    color: var(--tc-comment-color);
    margin-bottom: 0.5rem;
  }

  .tc-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .tc-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    background-color: var(--tc-border-color);
    color: var(--tc-text);
  }

  .tc-sheet-body {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .tc-section-header {
    font-weight: 700;
    font-size: 1.15rem;
    color: var(--tc-section-color);
    margin-top: 1rem;
    margin-bottom: 0.25rem;
    letter-spacing: 0.01em;
  }

  .tc-comment-line {
    font-style: italic;
    color: var(--tc-comment-color);
    margin: 0.25rem 0;
  }

  .tc-blank-line {
    height: 1rem;
  }

  .tc-line-block {
    position: relative;
    display: block;
    margin-bottom: 0.35rem;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .tc-chord-track {
    position: relative;
    height: 1.5em;
    font-family: "SF Mono", "Consolas", "Monaco", "Liberation Mono", monospace;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--tc-chord-color);
    white-space: nowrap;
    user-select: none;
  }

  .tc-chord-item {
    position: absolute;
    top: 0;
    white-space: nowrap;
    line-height: 1.5em;
    cursor: default;
    transition: transform 0.15s ease-out;
  }

  .tc-chord-item:hover {
    transform: translateY(-1px);
  }

  .tc-slash {
    opacity: 0.6;
    margin: 0 1px;
  }

  .tc-bass {
    color: var(--tc-bass-color);
  }

  .tc-lyric-track {
    position: relative;
    font-size: 1.15rem;
    line-height: 1.6;
    white-space: pre;
    color: var(--tc-text);
    /* Essential OpenType GSUB/GPOS ligatures preserved */
    font-feature-settings: "liga" 1, "kern" 1;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
`;

/**
 * Autonomous Custom Element: <thai-chord>
 */
export class ThaiChordSheet extends BaseClass {
  static get observedAttributes() {
    return ['chordpro', 'transpose', 'key', 'theme'];
  }

  constructor() {
    super();
    this._chordpro = '';
    this._transpose = 0;
    this._key = '';
    this._theme = 'light';

    if (typeof this.attachShadow === 'function') {
      this.attachShadow({ mode: 'open' });
    }
  }

  connectedCallback() {
    if (this.hasAttribute('chordpro')) {
      this._chordpro = this.getAttribute('chordpro') || '';
    } else if (!this._chordpro && this.textContent) {
      // Support inner text ChordPro notation
      this._chordpro = this.textContent.trim();
    }
    if (this.hasAttribute('transpose')) {
      this._transpose = parseInt(this.getAttribute('transpose'), 10) || 0;
    }
    if (this.hasAttribute('key')) {
      this._key = this.getAttribute('key') || '';
    }
    if (this.hasAttribute('theme')) {
      this._theme = this.getAttribute('theme') || 'light';
    }
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'chordpro') {
      this._chordpro = newValue || '';
    } else if (name === 'transpose') {
      this._transpose = parseInt(newValue, 10) || 0;
    } else if (name === 'key') {
      this._key = newValue || '';
    } else if (name === 'theme') {
      this._theme = newValue || 'light';
    }
    this.render();
  }

  get chordpro() {
    return this._chordpro;
  }

  set chordpro(val) {
    this._chordpro = String(val || '');
    this.render();
  }

  get transpose() {
    return this._transpose;
  }

  set transpose(val) {
    this._transpose = parseInt(val, 10) || 0;
    this.render();
  }

  get key() {
    return this._key;
  }

  set key(val) {
    this._key = String(val || '');
    this.render();
  }

  get theme() {
    return this._theme;
  }

  set theme(val) {
    this._theme = String(val || 'light');
    this.render();
  }

  render() {
    if (!this.shadowRoot) return;

    const htmlContent = renderChordSheetHtml(this._chordpro, {
      transpose: this._transpose,
      key: this._key,
      theme: this._theme
    });

    this.shadowRoot.innerHTML = `<style>${COMPONENT_CSS}</style>${htmlContent}`;
  }
}

/**
 * Registers custom elements <thai-chord> and <thai-chord-sheet> in browser.
 */
export function registerCustomElement() {
  if (typeof customElements !== 'undefined') {
    if (!customElements.get('thai-chord')) {
      customElements.define('thai-chord', ThaiChordSheet);
    }
    if (!customElements.get('thai-chord-sheet')) {
      customElements.define('thai-chord-sheet', ThaiChordSheet);
    }
  }
}

// Auto-register if in browser
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
  registerCustomElement();
}
