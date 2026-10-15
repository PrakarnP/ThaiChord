/**
 * ThaiChord: The Continuous Script Chord Placing Engine & Notation Standard
 * Designed for Thai, Lao, Khmer, and Asian scriptio continua languages.
 */

export * from './lexer.js';
export * from './timeline.js';
export * from './transposer.js';
export * from './components/thai_chord_sheet.js';

import { parseChordPro, parseChord, parseLine } from './lexer.js';
import { buildTimeline, buildTimelineForDoc } from './timeline.js';
import { transposeChord, transposeChordPro } from './transposer.js';
import { ThaiChordSheet, registerCustomElement, renderChordSheetHtml } from './components/thai_chord_sheet.js';

// Auto-register custom element if in browser context
registerCustomElement();

export default {
  parseChordPro,
  parseChord,
  parseLine,
  buildTimeline,
  buildTimelineForDoc,
  transposeChord,
  transposeChordPro,
  ThaiChordSheet,
  registerCustomElement,
  renderChordSheetHtml
};
