# ThaiChord 🇹🇭🎸

> **The Continuous Script Chord Placing Engine & Notation Standard**  
> Designed for Thai, Lao, Khmer, and Asian *scriptio continua* languages with zero syllable voids and native bass slash chord support.

## Why ThaiChord?

Standard Western ChordPro implementations (ChordSheetJS, OnSong, etc.) model music as rigid column boxes:
$$\text{Width} = \max(\text{ChordWidth}, \text{LyricWidth})$$

In Western languages where words are space-delimited, this works. In Asian continuous scripts (like Thai), words flow without spaces. As a result, standard ChordPro punches artificial voids directly inside words (`ควา      มอาย`, `ทรง      ชำระข้า`, `ผู้ใดเปรียบเหมือน       พระองค์`).

**ThaiChord** solves this fundamentally through a **Decoupled 2D Timeline Grid**:
- **Continuous Lyric Layer (Track 1)**: Native continuous Thai text is never sliced or broken across HTML span boundaries, preserving OpenType GSUB/GPOS ligatures and tone mark stacking.
- **Optical Overhang (Track 0)**: Chords float above lyrics and overhang naturally into following syllables without widening or pushing characters apart.
- **Track-0 Collision Resolution**: When adjacent or passing chords collide, displacement happens *only on the Chord Track*, keeping Thai words 100% serene.
- **First-Class Slash Chords**: Full harmonic parsing and simultaneous dual-note transposition for bass inversions (e.g., `C/E`, `G/B`, `Am/G`, `Dsus4/F#`).

## Architecture

- **`src/lexer.js`**: Syllable-aware continuous lexer with initial base consonant snapping.
- **`src/timeline.js`**: 2D coordinate geometry and optical overhang collision resolver.
- **`src/transposer.js`**: Exact musical transposer supporting roots, accidentals, and slash bass.
- **`src/components/thai_chord_sheet.js`**: Zero-dependency Web Component (`<thai-chord>`).

## License
I DON'T EVNE KNOW HOW TO DO OR FIND ONE PLEASE HELP


## Additional
เปนคนไทยค่บ :>
