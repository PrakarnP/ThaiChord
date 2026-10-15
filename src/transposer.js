/**
 * ThaiChord Dual-Note Slash Chord Transposer
 *
 * Transposes chords by semitone offsets (+/- 11) with lockstep dual-note
 * transposition for slash chords (root and bass notes) and musical enharmonic normalization.
 */

import { parseChord } from './lexer.js';

// Pitch class map (0 to 11)
export const PITCH_MAP = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

export const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_SCALE  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Key signatures typically using sharps
const SHARP_KEYS = new Set([
  'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m'
]);

// Key signatures typically using flats
const FLAT_KEYS = new Set([
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb',
  'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'
]);

// Roots that naturally bias toward sharp or flat spelling
const FLAT_ROOT_PITCHES = new Set([10, 3, 8]); // Bb, Eb, Ab

/**
 * Normalizes pitch to 0-11 range.
 * @param {number} pitch
 * @returns {number}
 */
export function normalizePitch(pitch) {
  return ((pitch % 12) + 12) % 12;
}

/**
 * Parses note name to pitch class.
 * @param {string} note E.g. 'C', 'F#', 'Bb'
 * @returns {number|null} Pitch 0-11 or null if invalid
 */
export function noteToPitch(note) {
  if (!note || typeof note !== 'string') return null;
  const clean = note.trim().replace(/\u266F/g, '#').replace(/\u266D/g, 'b');
  return PITCH_MAP[clean] ?? null;
}

/**
 * Determines whether to prefer flats based on key or root context.
 *
 * @param {string|null} targetKey
 * @param {number|null} rootPitch
 * @param {boolean} [sourceHadFlat=false]
 * @returns {boolean}
 */
export function shouldPreferFlats(targetKey, rootPitch, sourceHadFlat = false) {
  if (targetKey) {
    const cleanKey = targetKey.trim().replace(/\u266F/g, '#').replace(/\u266D/g, 'b');
    if (FLAT_KEYS.has(cleanKey) || cleanKey.includes('b')) return true;
    if (SHARP_KEYS.has(cleanKey) || cleanKey.includes('#')) return false;
  }

  if (rootPitch !== null && rootPitch !== undefined) {
    if (FLAT_ROOT_PITCHES.has(rootPitch)) return true;
    if (rootPitch === 6) return false; // F# preferred in worship
    if (rootPitch === 1) return sourceHadFlat; // C# vs Db
  }

  return sourceHadFlat;
}

/**
 * Transposes an individual note by semitones.
 *
 * @param {string} note Note name (e.g. 'C', 'F#', 'Bb')
 * @param {number} semitones Semitone delta (-11 to +11)
 * @param {boolean} [preferFlats=false]
 * @returns {string} Transposed note name
 */
export function transposeNote(note, semitones, preferFlats = false) {
  const currentPitch = noteToPitch(note);
  if (currentPitch === null) return note;

  const newPitch = normalizePitch(currentPitch + semitones);
  const scale = preferFlats ? FLAT_SCALE : SHARP_SCALE;
  return scale[newPitch];
}

/**
 * Transposes a chord string by semitones with lockstep dual-note slash chord support.
 * Both root and bass notes are transposed synchronously.
 *
 * Examples:
 * - transposeChord('C/E', 2) -> 'D/F#'
 * - transposeChord('Am/G', 1) -> 'Bbm/Ab'
 * - transposeChord('G/B', -1) -> 'F#/A#'
 * - transposeChord('Dsus4/F#', -2) -> 'Csus4/E'
 *
 * @param {string} chordStr Chord string to transpose
 * @param {number} semitones Semitones offset (-11 to +11)
 * @param {string} [targetKey] Optional target musical key
 * @returns {string} Transposed chord string
 */
export function transposeChord(chordStr, semitones, targetKey = null) {
  if (!semitones || semitones === 0) return chordStr;

  const parsed = parseChord(chordStr);
  if (!parsed.isChord || !parsed.rootNote) {
    return chordStr;
  }

  const rootPitch = noteToPitch(parsed.rootNote);
  if (rootPitch === null) return chordStr;

  const newRootPitch = normalizePitch(rootPitch + semitones);

  // Determine accidental preference
  const sourceHadFlat = parsed.accidental === 'b' || (parsed.bassAccidental === 'b');
  const preferFlats = shouldPreferFlats(targetKey, newRootPitch, sourceHadFlat);

  // Transpose root
  const newRoot = transposeNote(parsed.rootNote, semitones, preferFlats);

  // Transpose bass note in lockstep if slash chord
  let newBass = null;
  if (parsed.bass) {
    const bassPitch = noteToPitch(parsed.bass);
    if (bassPitch !== null) {
      // Determine bass preference based on the chord's new root scale context
      // E.g., if new root is 'F#' (sharp key), bass pitch 10 must be 'A#'
      // E.g., if new root is 'Bb' (flat key), bass pitch 8 must be 'Ab'
      let bassPreferFlats = preferFlats;
      if (newRoot === 'F#' || newRoot === 'B' || newRoot === 'E' || newRoot === 'A' || newRoot === 'D') {
        bassPreferFlats = false;
      } else if (newRoot === 'Bb' || newRoot === 'Eb' || newRoot === 'Ab' || newRoot === 'Db' || newRoot === 'F') {
        bassPreferFlats = true;
      }
      newBass = transposeNote(parsed.bass, semitones, bassPreferFlats);
    }
  }

  const result = newRoot + parsed.quality + (newBass ? `/${newBass}` : '');
  return result;
}

/**
 * Transposes an entire ChordPro document by semitones.
 * Updates all chords within brackets and the {key: ...} directive.
 *
 * @param {string} chordProText Full ChordPro text
 * @param {number} semitones Semitones offset (-11 to +11)
 * @param {string} [targetKey] Optional target musical key
 * @returns {string} Transposed ChordPro text
 */
export function transposeChordPro(chordProText, semitones, targetKey = null) {
  if (typeof chordProText !== 'string' || semitones === 0) {
    return chordProText;
  }

  // Regex to match chords inside brackets [CHORD]
  // and directives like {key: X}
  const chordRegex = /\[([^\]]+)\]/g;
  const keyDirectiveRegex = /^(\s*\{\s*(?:key|k)\s*:\s*)([^}]+)(\})/gim;

  // 1. Transpose {key: ...} directives
  let result = chordProText.replace(keyDirectiveRegex, (match, prefix, currentKey, suffix) => {
    const transposedKey = transposeNote(currentKey.trim(), semitones, shouldPreferFlats(targetKey, null, currentKey.includes('b')));
    return `${prefix}${transposedKey}${suffix}`;
  });

  // 2. Transpose chord brackets
  result = result.replace(chordRegex, (match, inner) => {
    const parsed = parseChord(inner);
    if (parsed.isChord) {
      const transposed = transposeChord(inner, semitones, targetKey);
      return `[${transposed}]`;
    }
    return match;
  });

  return result;
}
