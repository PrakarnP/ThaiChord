/**
 * ThaiChord Test Suite
 * Comprehensive automated assertions testing all 6 core requirements and edge cases.
 */

import assert from 'node:assert/strict';
import {
  parseChord,
  parseLine,
  parseChordPro,
  snapAnchor,
  isCombiningMark,
  isLeadingVowel,
  buildTimeline,
  buildTimelineForDoc,
  transposeChord,
  transposeChordPro,
  renderChordSheetHtml
} from '../src/index.js';

export function runTestSuite() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name, passed: true });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      results.push({ name, passed: false, error: err });
      console.error(`  ✗ ${name}`);
      console.error(err);
    }
  }

  console.log('\n--- ThaiChord Unit Test Suite ---\n');

  // Test 1: Stacked chords [C][A/C#]พระองค์ -> continuous "พระองค์", Track 0 resolved
  test('Test 1: Stacked chords [C][A/C#]พระองค์ -> continuous "พระองค์", Track 0 resolved', () => {
    const input = '[C][A/C#]พระองค์';
    const parsed = parseLine(input);

    // Continuous lyrics: Track 1 is unbroken, exactly "พระองค์" with no inserted spaces
    assert.equal(parsed.lyrics, 'พระองค์', 'Lyrics must be unbroken "พระองค์"');
    assert.equal(parsed.chords.length, 2, 'Must have 2 chords');
    assert.equal(parsed.chords[0].raw, 'C');
    assert.equal(parsed.chords[1].raw, 'A/C#');
    assert.equal(parsed.chords[1].bass, 'C#');

    const timeline = buildTimeline(parsed);
    assert.equal(timeline.lyrics, 'พระองค์', 'Timeline lyric track must be identical unbroken string');

    const [c1, c2] = timeline.chords;
    assert.equal(c1.x_ideal, 0, 'First chord starts at x=0');
    assert.equal(c2.x_ideal, 0, 'Second chord initially targets x=0');

    // Track 0 collision resolver should displace c2 so it does not collide with c1
    assert.ok(c2.x_actual >= c1.x_actual + c1.width, 'Track 0 must shift c2 to the right of c1');
    assert.equal(c2.displaced, true, 'c2 must be marked as displaced');
    assert.ok(c2.shiftAmount > 0, 'c2 shiftAmount must be greater than 0');
  });

  // Test 2: Mid-word verbal particle ทรง[Em][Am/C]ชำระข้า -> continuous "ทรงชำระข้า", slash bass preserved
  test('Test 2: Mid-word verbal particle ทรง[Em][Am/C]ชำระข้า -> continuous "ทรงชำระข้า", slash bass preserved', () => {
    const input = 'ทรง[Em][Am/C]ชำระข้า';
    const parsed = parseLine(input);

    assert.equal(parsed.lyrics, 'ทรงชำระข้า', 'Lyrics must be continuous without slicing');
    assert.equal(parsed.chords.length, 2);

    const c1 = parsed.chords[0];
    const c2 = parsed.chords[1];

    assert.equal(c1.raw, 'Em');
    assert.equal(c1.charIndex, 3, 'Em is placed at index 3 (character ช)');
    assert.equal(c1.anchorIndex, 3);

    assert.equal(c2.raw, 'Am/C');
    assert.equal(c2.root, 'A');
    assert.equal(c2.quality, 'm');
    assert.equal(c2.bass, 'C', 'Slash bass must be preserved as C');
    assert.equal(c2.charIndex, 3);
    assert.equal(c2.anchorIndex, 3);

    const timeline = buildTimeline(parsed);
    assert.equal(timeline.lyrics, 'ทรงชำระข้า');
    assert.ok(timeline.chords[1].x_actual > timeline.chords[0].x_actual, 'Am/C must be shifted past Em on Track 0');
    assert.equal(timeline.chords[1].displaced, true);
  });

  // Test 3: Phrase-end turnaround [F#m]ความอาย [E] -> unbroken "ความอาย ", chord E at end
  test('Test 3: Phrase-end turnaround [F#m]ความอาย [E] -> unbroken "ความอาย ", chord E at end', () => {
    const input = '[F#m]ความอาย [E]';
    const parsed = parseLine(input);

    assert.equal(parsed.lyrics, 'ความอาย ', 'Lyrics must be unbroken "ความอาย "');
    assert.equal(parsed.chords.length, 2);

    const [c1, c2] = parsed.chords;
    assert.equal(c1.raw, 'F#m');
    assert.equal(c1.anchorIndex, 0);

    assert.equal(c2.raw, 'E');
    assert.equal(c2.isEndTurnaround, true, 'Trailing chord must be detected as end turnaround');
    assert.equal(c2.anchorIndex, parsed.lyrics.length);

    const timeline = buildTimeline(parsed);
    assert.equal(timeline.lyrics, 'ความอาย ');
    assert.equal(timeline.chords[1].x_ideal, timeline.totalLyricWidth, 'E should be positioned at the end of the line');
    assert.ok(timeline.chords[1].x_actual >= timeline.totalLyricWidth);
  });

  // Test 4: Slash chord dual transposition (C/E -> D/F#, Dsus4/F# -> Csus4/E)
  test('Test 4: Slash chord dual transposition (C/E -> D/F#, Dsus4/F# -> Csus4/E, Am/G -> Bbm/Ab, G/B -> F#/A#)', () => {
    // Lockstep transposition of root and bass notes
    assert.equal(transposeChord('C/E', 2), 'D/F#', 'C/E +2 must transpose to D/F#');
    assert.equal(transposeChord('Dsus4/F#', -2), 'Csus4/E', 'Dsus4/F# -2 must transpose to Csus4/E');
    assert.equal(transposeChord('Am/G', 1), 'Bbm/Ab', 'Am/G +1 must transpose to Bbm/Ab');
    assert.equal(transposeChord('G/B', -1), 'F#/A#', 'G/B -1 must transpose to F#/A#');

    // Enharmonic key context
    assert.equal(transposeChord('A/C#', 2), 'B/D#', 'A/C# +2 must transpose to B/D#');
    assert.equal(transposeChord('F/A', 2), 'G/B', 'F/A +2 must transpose to G/B');
  });

  // Test 5: Leading vowel snap ([D]แลก snaps anchor to ล)
  test('Test 5: Leading vowel snap ([D]แลก snaps anchor to ล)', () => {
    const input = '[D]แลก';
    const parsed = parseLine(input);

    assert.equal(parsed.lyrics, 'แลก', 'Lyrics must preserve leading vowel bound to consonant');
    assert.equal(parsed.chords.length, 1);

    const chord = parsed.chords[0];
    assert.equal(chord.raw, 'D');
    assert.equal(chord.charIndex, 0, 'Bracket was placed at index 0 (before แ)');
    assert.equal(chord.anchorIndex, 1, 'Visual anchor must snap to index 1 (consonant ล)');
    assert.equal(chord.snapped, true, 'Must flag snapped as true');
    assert.equal(chord.snappedFromLeadingVowel, true, 'Must flag snappedFromLeadingVowel as true');

    // Also test Sara E (เ)
    const input2 = '[G]เปลี่ยน';
    const parsed2 = parseLine(input2);
    assert.equal(parsed2.lyrics, 'เปลี่ยน');
    assert.equal(parsed2.chords[0].charIndex, 0);
    assert.equal(parsed2.chords[0].anchorIndex, 1, 'Anchor must snap past เ to ป');
    assert.equal(parsed2.chords[0].snappedFromLeadingVowel, true);
  });

  // Test 6: Combining mark safety (chords never slice เ-ีย, ั, ำ, tone marks)
  test('Test 6: Combining mark safety (chords never slice เ-ีย, ั, ำ, tone marks)', () => {
    // Combining marks must have 0 advance width in timeline
    assert.equal(isCombiningMark('ั'), true, 'ั is a combining mark');
    assert.equal(isCombiningMark('ิ'), true, 'ิ is a combining mark');
    assert.equal(isCombiningMark('ี'), true, 'ี is a combining mark');
    assert.equal(isCombiningMark('่'), true, '่ is a tone mark');
    assert.equal(isCombiningMark('้'), true, '้ is a tone mark');
    assert.equal(isCombiningMark('์'), true, '์ is thanthakhat');

    // Grapheme cluster with เ-ีย and mai tho: เช่น 'เปรียบ'
    // If a chord is accidentally placed after consonant but before combining mark:
    const inputCluster = 'เร[A]ียน';
    const parsedCluster = parseLine(inputCluster);
    assert.equal(parsedCluster.lyrics, 'เรียน', 'Word remains unbroken');
    // Anchor should snap to base consonant 'ร' (index 1), not to combining mark 'ี'
    assert.equal(parsedCluster.chords[0].anchorIndex, 1, 'Chord must anchor to consonant ร, never to combining mark ี');

    // Timeline zero width advance for combining marks
    const timeline = buildTimeline(parseLine('ฉัน'));
    const maiHanAkat = timeline.charPositions.find(p => p.char === 'ั');
    assert.ok(maiHanAkat, 'Mai Han-Akat exists in positions');
    assert.equal(maiHanAkat.width, 0, 'Combining mark ั must have 0px advance width');
    assert.equal(maiHanAkat.isCombining, true);
  });

  // Test 7: Full ChordPro document parsing & HTML generation
  test('Test 7: Full ChordPro document parsing & HTML generation', () => {
    const chordProDoc = `{title: ความหวังของข้า}
{artist: Hillside Worship}
{key: C}

[Chorus]
[C][A/C#]พระองค์ ทรง[Em][Am/C]ชำระข้า
[F#m]ความอาย [E]
[D]แลกเปลี่ยนความตายเป็นชีวิต`;

    const parsedDoc = parseChordPro(chordProDoc);
    assert.equal(parsedDoc.metadata.title, 'ความหวังของข้า');
    assert.equal(parsedDoc.metadata.artist, 'Hillside Worship');
    assert.equal(parsedDoc.metadata.key, 'C');

    const timelines = buildTimelineForDoc(parsedDoc);
    assert.ok(timelines.timelines.length > 0);

    const html = renderChordSheetHtml(chordProDoc, { transpose: 2 });
    assert.ok(html.includes('ความหวังของข้า'), 'HTML must contain title');
    assert.ok(html.includes('Key: D'), 'Key must be transposed to D in badges');
    assert.ok(html.includes('พระองค์ ทรงชำระข้า'), 'Lyric track must contain continuous Thai phrase');
    assert.ok(html.includes('tc-chord-track'), 'Track 0 must be present');
    assert.ok(html.includes('tc-lyric-track'), 'Track 1 must be present');
  });

  // Test 8: Document ChordPro transposition
  test('Test 8: Full document ChordPro transposition with dual slash chords', () => {
    const input = `{title: Praise}
{key: G}
[G]ฉัน[D/F#]รัก[Em]พระองค์ [Dsus4/F#]`;

    const transposed = transposeChordPro(input, 2);
    assert.ok(transposed.includes('{key: A}'), 'Key G transposed +2 must be A');
    assert.ok(transposed.includes('[A]ฉัน[E/G#]รัก[F#m]พระองค์ [Esus4/G#]'), 'All chords transposed accurately');
  });

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log(`\n========================================`);
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}
