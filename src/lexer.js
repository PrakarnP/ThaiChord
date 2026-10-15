/**
 * ThaiChord Continuous Script Lexer & ChordPro Parser
 *
 * Designed for Thai and Asian scriptio continua languages.
 * Extracts 100% continuous, unbroken lyric strings and anchors chords
 * to base consonants with leading vowel and combining mark safety.
 */

// Thai Unicode Character Constants and Ranges
export const THAI_CONSONANTS_START = 0x0E01; // ก
export const THAI_CONSONANTS_END = 0x0E2E;   // ฮ

// Leading vowels (Sara E, Sara Ae, Sara O, Sara Ai Maimuan, Sara Ai Maimalai)
export const LEADING_VOWELS = new Set([
  '\u0E40', // เ (Sara E)
  '\u0E41', // แ (Sara Ae)
  '\u0E42', // โ (Sara O)
  '\u0E43', // ใ (Sara Ai Maimuan)
  '\u0E44'  // ไ (Sara Ai Maimalai)
]);

// Upper and lower combining vowels, tone marks, and special diacritics (non-spacing)
export const COMBINING_MARKS = new Set([
  '\u0E31', // ั (Mai Han-Akat)
  '\u0E34', // ิ (Sara I)
  '\u0E35', // ี (Sara Ii)
  '\u0E36', // ึ (Sara Ue)
  '\u0E37', // ื (Sara Uee)
  '\u0E38', // ุ (Sara U)
  '\u0E39', // ู (Sara Uu)
  '\u0E3A', // ฺ (Phinthu)
  '\u0E47', // ็ (Maitaikhu)
  '\u0E48', // ่ (Mai Ek)
  '\u0E49', // ้ (Mai Tho)
  '\u0E4A', // ๊ (Mai Tri)
  '\u0E4B', // ๋ (Mai Chattawa)
  '\u0E4C', // ์ (Thanthakhat / Karan)
  '\u0E4D', // ํ (Nikkhahit)
  '\u0E4E'  // ๎ (Yamakkan)
]);

/**
 * Checks whether a character is a Thai consonant (ก - ฮ).
 * @param {string} ch
 * @returns {boolean}
 */
export function isThaiConsonant(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= THAI_CONSONANTS_START && code <= THAI_CONSONANTS_END;
}

/**
 * Checks whether a character is a Thai leading vowel (เ, แ, โ, ใ, ไ).
 * @param {string} ch
 * @returns {boolean}
 */
export function isLeadingVowel(ch) {
  return LEADING_VOWELS.has(ch);
}

/**
 * Checks whether a character is a Thai non-spacing combining mark (upper/lower vowel, tone mark, thanthakhat).
 * @param {string} ch
 * @returns {boolean}
 */
export function isCombiningMark(ch) {
  return COMBINING_MARKS.has(ch);
}

/**
 * Checks whether a character is any Thai Unicode character.
 * @param {string} ch
 * @returns {boolean}
 */
export function isThaiCharacter(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 0x0E00 && code <= 0x0E7F;
}

/**
 * Parses a chord string into structured components.
 * Supports root note, accidentals (#, b, ♯, ♭), chord qualities, and slash bass notes.
 * Examples: 'C', 'Am', 'C/E', 'G/B', 'Am/G', 'Dsus4/F#', 'Bbm/Ab', 'C#m7b5/G'
 *
 * @param {string} chordStr
 * @returns {object} Structured chord object
 */
export function parseChord(chordStr) {
  if (!chordStr || typeof chordStr !== 'string') {
    return {
      raw: '',
      root: null,
      accidental: '',
      rootNote: null,
      quality: '',
      bass: null,
      bassRoot: null,
      bassAccidental: '',
      isChord: false
    };
  }

  const raw = chordStr.trim();
  // Normalize unicode accidentals
  let normalized = raw.replace(/\u266F/g, '#').replace(/\u266D/g, 'b');

  // Check for musical directives (measure bars, slashes, repeats, N.C.)
  if (/^(?:\||\|\||\/|\/\/|%|x\d+|\(x\d+\)|N\.C\.)$/i.test(normalized)) {
    return {
      raw,
      root: null,
      accidental: '',
      rootNote: null,
      quality: '',
      bass: null,
      bassRoot: null,
      bassAccidental: '',
      isDirective: true,
      isChord: true
    };
  }

  // Handle parenthesized optional chord, e.g. (G7), (Am)
  let isOptional = false;
  let targetStr = normalized;
  if (targetStr.startsWith('(') && targetStr.endsWith(')')) {
    targetStr = targetStr.slice(1, -1).trim();
    isOptional = true;
  }

  // Handle modulation chords, e.g. D/F#(E/G#) or G(A)
  let altChord = null;
  const modMatch = targetStr.match(/^([A-G][^(\s]*)\s*\(([^)]+)\)$/);
  if (modMatch) {
    targetStr = modMatch[1].trim();
    altChord = modMatch[2].trim();
  }

  // Standard Chord Regex:
  // Root: [A-G]
  // Accidental: [#b]?
  // Quality: anything before optional slash bass
  // Bass: /[A-G][#b]?
  const regex = /^([A-G])([#b]?)([^/]*?)(?:\/([A-G])([#b]?))?$/;
  const match = targetStr.match(regex);

  if (!match) {
    return {
      raw,
      root: null,
      accidental: '',
      rootNote: null,
      quality: '',
      bass: null,
      bassRoot: null,
      bassAccidental: '',
      isChord: false
    };
  }

  const root = match[1];
  const accidental = match[2] || '';
  const rootNote = root + accidental;
  const quality = match[3] || '';
  const bassRoot = match[4] || null;
  const bassAccidental = match[5] || '';
  const bass = bassRoot ? bassRoot + bassAccidental : null;

  return {
    raw,
    root,
    accidental,
    rootNote,
    quality,
    bass,
    bassRoot,
    bassAccidental,
    isOptional,
    altChord,
    isChord: true
  };
}

/**
 * Snapping logic:
 * Anchors chords to initial base consonants of Thai syllables.
 * - If placed before a leading vowel (เ-, แ-, โ-, ใ-, ไ-), snap the visual anchor to the following consonant.
 * - Never anchor to combining marks, tone marks, or codas. If placed on a combining mark, snap back to base consonant.
 * - If placed at or beyond the lyric length, marks as line-end turnaround chord.
 *
 * @param {string} lyrics Full continuous lyrics string
 * @param {number} charIndex Character index where chord was placed
 * @returns {object} Snapping resolution details
 */
export function snapAnchor(lyrics, charIndex) {
  if (charIndex >= lyrics.length) {
    return {
      anchorIndex: lyrics.length,
      snapped: false,
      isEndTurnaround: true,
      snappedFromLeadingVowel: false
    };
  }

  const ch = lyrics[charIndex];

  // 1. Leading vowel snap:
  // If bracket is before leading vowel, snap visual anchor to the following base consonant
  if (isLeadingVowel(ch)) {
    let target = charIndex + 1;
    while (target < lyrics.length && !isThaiConsonant(lyrics[target])) {
      target++;
    }
    if (target < lyrics.length) {
      return {
        anchorIndex: target,
        snapped: true,
        isEndTurnaround: false,
        snappedFromLeadingVowel: true
      };
    }
  }

  // 2. Combining mark safety:
  // Never anchor to combining marks (upper vowels, lower vowels, tone marks, thanthakhat)
  if (isCombiningMark(ch)) {
    let target = charIndex;
    while (target > 0 && !isThaiConsonant(lyrics[target])) {
      target--;
    }
    return {
      anchorIndex: target,
      snapped: target !== charIndex,
      isEndTurnaround: false,
      snappedFromLeadingVowel: false
    };
  }

  // Normal consonant or other character anchor
  return {
    anchorIndex: charIndex,
    snapped: false,
    isEndTurnaround: false,
    snappedFromLeadingVowel: false
  };
}

const SECTION_NAME_REGEX = /^(?:Intro|Verse|Chorus|Bridge|Pre-Chorus|Outro|Ending|Solo|Interlude|Instrumental|Tag|Coda|Hook|ข้อ|ท่อน|ฮุก)(?:\s*\d+)?$/i;

/**
 * Parses a single line of ChordPro text into continuous lyrics and structured chord tokens.
 *
 * @param {string} line Raw line
 * @returns {object} Parsed line object
 */
export function parseLine(line) {
  const trimmed = line.trim();

  // Empty line
  if (trimmed.length === 0) {
    return {
      type: 'empty',
      raw: line,
      lyrics: '',
      chords: []
    };
  }

  // Directive check: {name: value} or {directive}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim();
    const colonIdx = inner.indexOf(':');
    let name = inner;
    let value = '';
    if (colonIdx !== -1) {
      name = inner.slice(0, colonIdx).trim().toLowerCase();
      value = inner.slice(colonIdx + 1).trim();
    } else {
      name = name.toLowerCase();
    }

    return {
      type: 'directive',
      raw: line,
      name,
      value
    };
  }

  // Section Header check in square brackets, e.g. [Chorus], [Verse 1], [Intro]
  // ONLY if the line consists solely of a SINGLE bracketed section name:
  const singleBracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
  if (singleBracketMatch) {
    const inner = singleBracketMatch[1].trim();
    if (SECTION_NAME_REGEX.test(inner)) {
      return {
        type: 'section',
        raw: line,
        name: inner,
        lyrics: '',
        chords: []
      };
    }
  }

  // Parse continuous lyrics (Track 1) and raw chord occurrences
  let lyrics = '';
  const rawChords = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '[') {
      const closeIdx = line.indexOf(']', i + 1);
      if (closeIdx !== -1) {
        const chordStr = line.slice(i + 1, closeIdx);
        const parsedChord = parseChord(chordStr);
        rawChords.push({
          parsedChord,
          charIndex: lyrics.length
        });
        i = closeIdx + 1;
        continue;
      }
    }
    lyrics += line[i];
    i++;
  }

  // Resolve snapping logic for each chord against the full continuous lyrics
  const chords = rawChords.map((entry, index) => {
    const snap = snapAnchor(lyrics, entry.charIndex);
    return {
      ...entry.parsedChord,
      order: index,
      charIndex: entry.charIndex,
      anchorIndex: snap.anchorIndex,
      snapped: snap.snapped,
      isEndTurnaround: snap.isEndTurnaround,
      snappedFromLeadingVowel: snap.snappedFromLeadingVowel
    };
  });

  return {
    type: 'lyric',
    raw: line,
    lyrics, // 100% UNBROKEN CONTINUOUS STRING
    chords
  };
}

/**
 * Parses full ChordPro document into metadata and line objects.
 *
 * @param {string} chordProText Full ChordPro text
 * @returns {object} { metadata: Record<string, string>, lines: object[] }
 */
export function parseChordPro(chordProText) {
  if (typeof chordProText !== 'string') {
    return { metadata: {}, lines: [] };
  }

  const rawLines = chordProText.split(/\r?\n/);
  const metadata = {};
  const lines = [];

  for (const rawLine of rawLines) {
    const parsed = parseLine(rawLine);
    if (parsed.type === 'directive') {
      const name = parsed.name;
      const value = parsed.value;
      if (name === 't' || name === 'title') metadata.title = value;
      else if (name === 'st' || name === 'subtitle' || name === 'artist') metadata.artist = value;
      else if (name === 'key') metadata.key = value;
      else if (name === 'tempo') metadata.tempo = value;
      else if (name === 'time') metadata.time = value;
      else if (name === 'c' || name === 'comment') {
        lines.push({
          type: 'comment',
          raw: rawLine,
          text: value
        });
        continue;
      }
    }
    lines.push(parsed);
  }

  return {
    metadata,
    lines
  };
}
