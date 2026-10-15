/**
 * ThaiChord Decoupled 2D Timeline & Optical Overhang Engine
 *
 * Implements a strict two-track model:
 * Track 0: Chords ({ raw, root, bass, x_ideal, x_actual, width, displaced, shiftAmount })
 * Track 1: Continuous lyrics with character visual width metrics (0px added, never sliced)
 */

import { isCombiningMark, isLeadingVowel, isThaiCharacter } from './lexer.js';

export const DEFAULT_TIMELINE_OPTIONS = {
  thaiConsonantWidth: 8.8,   // Calibrated to 16px Sarabun / Noto Sans Thai typography
  thaiCombiningWidth: 0,     // Crucial: Upper/lower vowels, tone marks have 0 advance width
  spaceWidth: 5.5,           // Calibrated space width in Sarabun
  latinCharWidth: 8.5,       // Visual width of Latin letters and numbers
  otherCharWidth: 8.5,       // Visual width of other symbols
  chordCharWidth: 8.0,       // Character width in chord font (monospace/semi-proportional)
  chordPadding: 4,           // Subtle breathing room
  minChordGap: 6             // Minimum clearance between adjacent chords on Track 0
};

let cachedMeasureCanvas = null;
let cachedMeasureCtx = null;

/**
 * Creates a browser-based exact canvas text measurement function.
 * @param {string} font E.g. '16px "Sarabun", sans-serif'
 * @returns {((text: string) => number)|null}
 */
export function createCanvasMeasure(font = '16px "Sarabun", sans-serif') {
  if (typeof document === 'undefined') return null;
  if (!cachedMeasureCanvas) {
    cachedMeasureCanvas = document.createElement('canvas');
    cachedMeasureCtx = cachedMeasureCanvas.getContext('2d');
  }
  cachedMeasureCtx.font = font;
  return function(text) {
    return cachedMeasureCtx.measureText(text).width;
  };
}

/**
 * Calculates character metrics for Track 1 (unbroken continuous lyrics).
 * Thai combining marks (upper/lower vowels, tone marks) produce 0 advance width.
 * When measureText is passed, uses exact canvas font measurements.
 *
 * @param {string} lyrics Continuous lyrics string
 * @param {object} [options]
 * @returns {object} { charPositions: object[], totalLyricWidth: number }
 */
export function calculateCharPositions(lyrics, options = {}) {
  const opts = { ...DEFAULT_TIMELINE_OPTIONS, ...options };
  const charPositions = [];

  // 1. If exact canvas/DOM measurement function is provided:
  if (typeof opts.measureText === 'function') {
    const totalLyricWidth = opts.measureText(lyrics);
    for (let i = 0; i < lyrics.length; i++) {
      const x_start = opts.measureText(lyrics.substring(0, i));
      const x_next = (i < lyrics.length - 1) ? opts.measureText(lyrics.substring(0, i + 1)) : totalLyricWidth;
      const width = Math.max(0, x_next - x_start);
      charPositions.push({
        char: lyrics[i],
        index: i,
        x_start,
        width,
        x_end: x_start + width,
        isCombining: isCombiningMark(lyrics[i]),
        isLeadingVowel: isLeadingVowel(lyrics[i])
      });
    }
    return {
      charPositions,
      totalLyricWidth
    };
  }

  // 2. Headless fallback calculation
  let currentX = 0;
  for (let i = 0; i < lyrics.length; i++) {
    const ch = lyrics[i];
    let width = 0;

    if (typeof opts.measureChar === 'function') {
      width = opts.measureChar(ch, i, lyrics);
    } else {
      if (isCombiningMark(ch)) {
        width = opts.thaiCombiningWidth;
      } else if (ch === ' ') {
        width = opts.spaceWidth;
      } else if (isThaiCharacter(ch)) {
        width = opts.thaiConsonantWidth;
      } else if (/[a-zA-Z0-9]/.test(ch)) {
        width = opts.latinCharWidth;
      } else {
        width = opts.otherCharWidth;
      }
    }

    const x_start = currentX;
    const x_end = currentX + width;
    currentX += width;

    charPositions.push({
      char: ch,
      index: i,
      x_start,
      width,
      x_end,
      isCombining: isCombiningMark(ch),
      isLeadingVowel: isLeadingVowel(ch)
    });
  }

  return {
    charPositions,
    totalLyricWidth: currentX
  };
}

/**
 * Measures the visual width of a chord string on Track 0.
 *
 * @param {string} rawChord
 * @param {object} [options]
 * @returns {number}
 */
export function measureChordWidth(rawChord, options = {}) {
  const opts = { ...DEFAULT_TIMELINE_OPTIONS, ...options };
  if (typeof opts.measureChord === 'function') {
    return opts.measureChord(rawChord);
  }
  const len = rawChord ? rawChord.length : 0;
  return len * opts.chordCharWidth + opts.chordPadding;
}

/**
 * Resolves Track-0 chord collisions with Optical Overhang.
 *
 * When chords overlap on Track 0, they shift horizontally on Track 0 ONLY.
 * Track 1 (the lyrics) remains 100% serene: zero characters pushed, zero spaces added.
 *
 * @param {object[]} chords List of parsed chords with anchorIndex and x_ideal
 * @param {object} [options]
 * @returns {object[]} List of resolved chords with x_actual, displaced, and shiftAmount
 */
export function resolveChordCollisions(chords, options = {}) {
  const opts = { ...DEFAULT_TIMELINE_OPTIONS, ...options };
  if (!chords || chords.length === 0) return [];

  // Stable sort: sort primarily by anchorIndex, preserving original order for ties
  const sorted = [...chords].sort((a, b) => {
    if (a.anchorIndex !== b.anchorIndex) {
      return a.anchorIndex - b.anchorIndex;
    }
    return (a.order ?? 0) - (b.order ?? 0);
  });

  const resolved = [];

  for (let k = 0; k < sorted.length; k++) {
    const chord = sorted[k];
    const width = measureChordWidth(chord.raw, opts);

    if (k === 0) {
      const x_actual = Math.max(0, chord.x_ideal);
      resolved.push({
        ...chord,
        width,
        x_actual,
        displaced: x_actual !== chord.x_ideal,
        shiftAmount: Math.max(0, x_actual - chord.x_ideal)
      });
    } else {
      const prev = resolved[k - 1];
      const minAllowedX = prev.x_actual + prev.width + opts.minChordGap;

      if (chord.x_ideal < minAllowedX) {
        // Overlap detected: displace along Track 0 ONLY
        const x_actual = minAllowedX;
        resolved.push({
          ...chord,
          width,
          x_actual,
          displaced: true,
          shiftAmount: minAllowedX - chord.x_ideal
        });
      } else {
        const x_actual = chord.x_ideal;
        resolved.push({
          ...chord,
          width,
          x_actual,
          displaced: false,
          shiftAmount: 0
        });
      }
    }
  }

  return resolved;
}

/**
 * Builds the complete 2D Timeline Grid for a parsed line.
 * Decouples Track 0 (chords) and Track 1 (unbroken lyrics).
 *
 * @param {object} parsedLine Line object from parseLine()
 * @param {object} [options]
 * @returns {object} Timeline representation
 */
export function buildTimeline(parsedLine, options = {}) {
  const opts = { ...DEFAULT_TIMELINE_OPTIONS, ...options };

  if (!parsedLine || parsedLine.type !== 'lyric') {
    return {
      type: parsedLine ? parsedLine.type : 'unknown',
      raw: parsedLine ? parsedLine.raw : '',
      lyrics: parsedLine?.lyrics ?? '',
      charPositions: [],
      chords: [],
      totalLyricWidth: 0,
      totalWidth: 0
    };
  }

  const { lyrics, chords } = parsedLine;
  const { charPositions, totalLyricWidth } = calculateCharPositions(lyrics, opts);

  // Compute x_ideal for each chord based on anchorIndex
  const chordsWithIdeal = chords.map((chord) => {
    let x_ideal = 0;
    if (chord.isEndTurnaround || chord.anchorIndex >= lyrics.length) {
      x_ideal = totalLyricWidth;
    } else if (charPositions[chord.anchorIndex]) {
      x_ideal = charPositions[chord.anchorIndex].x_start;
    } else {
      x_ideal = 0;
    }

    return {
      ...chord,
      x_ideal
    };
  });

  // Resolve Track 0 collisions
  const resolvedChords = resolveChordCollisions(chordsWithIdeal, opts);

  // Calculate total timeline width
  let maxChordEnd = 0;
  for (const c of resolvedChords) {
    const end = c.x_actual + c.width;
    if (end > maxChordEnd) {
      maxChordEnd = end;
    }
  }

  const totalWidth = Math.max(totalLyricWidth, maxChordEnd);

  return {
    type: 'lyric',
    raw: parsedLine.raw,
    lyrics, // NEVER sliced or broken: 100% continuous
    charPositions,
    chords: resolvedChords,
    totalLyricWidth,
    totalWidth
  };
}

/**
 * Builds 2D timelines for all lines in a parsed ChordPro document.
 *
 * @param {object} parsedDoc Output of parseChordPro()
 * @param {object} [options]
 * @returns {object} { metadata, timelines: object[] }
 */
export function buildTimelineForDoc(parsedDoc, options = {}) {
  if (!parsedDoc || !Array.isArray(parsedDoc.lines)) {
    return { metadata: {}, timelines: [] };
  }

  const timelines = parsedDoc.lines.map((line) => {
    if (line.type === 'lyric') {
      return buildTimeline(line, options);
    }
    return {
      type: line.type,
      raw: line.raw,
      name: line.name,
      text: line.text,
      lyrics: '',
      chords: [],
      totalLyricWidth: 0,
      totalWidth: 0
    };
  });

  return {
    metadata: parsedDoc.metadata,
    timelines
  };
}
