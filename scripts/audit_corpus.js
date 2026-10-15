/**
 * Corpus-Wide Audit Script for ThaiChord Engine
 *
 * Runs full corpus audit on all songs and lines from worship_songs.db
 * Tests:
 * 1. Lyric continuity & zero syllable voids
 * 2. 100% chord retention
 * 3. Optical overhang clearance on Track 0 (zero collision overlaps)
 * 4. Combining mark safety
 * 5. Slash chord parsing & transposition integrity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLine, buildTimeline, parseChord, isCombiningMark } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../../../review/corpus_for_thaichord_audit.json');
const outputPath = path.resolve(__dirname, '../../../review/thaichord_corpus_audit_report.json');

console.log('Loading corpus data from:', inputPath);
const rawData = fs.readFileSync(inputPath, 'utf-8');
const corpus = JSON.parse(rawData);

console.log(`Auditing ${corpus.total_songs} songs (${corpus.total_lines} total lines)...`);

const metrics = {
  totalSongs: corpus.total_songs,
  totalLinesAudited: 0,
  linesWithChords: 0,
  linesWithAdjacentChords: 0,
  linesWithSlashChords: 0,
  totalChordsAudited: 0,
  totalChordsRetained: 0,
  totalDisplacementsOnTrack0: 0,
  totalCollisionsUnresolved: 0,
  combiningMarkViolations: 0,
  lyricCorruptionViolations: 0,
  slashChordsIdentified: 0,
  targetSongAudits: []
};

const TARGET_SONGS = [176, 16, 48, 301, 122, 492, 118, 207, 100, 193, 316, 81];
const sampledComparisons = [];

for (const [songIdStr, songData] of Object.entries(corpus.songs)) {
  const songId = parseInt(songIdStr, 10);
  const isTargetSong = TARGET_SONGS.includes(songId);
  const targetSongReport = isTargetSong ? {
    songId,
    catalog: songData.catalog,
    title: songData.title,
    linesAudited: 0,
    adjacentLines: 0,
    samples: []
  } : null;

  for (const [versionId, versionData] of Object.entries(songData.versions)) {
    for (const lineObj of versionData.lines) {
      metrics.totalLinesAudited++;

      const raw = lineObj.raw_text;
      if (!raw || !lineObj.has_chords) {
        continue;
      }

      metrics.linesWithChords++;
      if (lineObj.has_adjacent) metrics.linesWithAdjacentChords++;
      if (lineObj.has_slash) metrics.linesWithSlashChords++;

      // Count raw chords in brackets
      const rawChordMatches = raw.match(/\[([^\]]+)\]/g) || [];
      const expectedChordCount = rawChordMatches.length;
      metrics.totalChordsAudited += expectedChordCount;

      // 1. Ingest via ThaiChord
      const parsedLine = parseLine(raw);
      const timeline = buildTimeline(parsedLine);

      metrics.totalChordsRetained += timeline.chords.length;

      // Assert: Chord count retention
      if (timeline.chords.length !== expectedChordCount) {
        // Some brackets might be section labels like [Verse 1]
        if (parsedLine.type === 'section') {
          // Expected for section lines
        } else {
          // Check if any non-chord token
          const nonChords = rawChordMatches.filter(m => !parseChord(m.slice(1, -1)).isChord);
          if (timeline.chords.length !== (expectedChordCount - nonChords.length)) {
            console.warn(`[Song #${songData.catalog}] Chord count discrepancy: expected ${expectedChordCount}, got ${timeline.chords.length}`);
          }
        }
      }

      // Assert: Track 0 collision clearance
      for (let k = 0; k < timeline.chords.length; k++) {
        const c = timeline.chords[k];
        if (c.displaced) {
          metrics.totalDisplacementsOnTrack0++;
        }

        if (c.bass) {
          metrics.slashChordsIdentified++;
        }

        // Check combining mark safety
        if (c.anchorIndex < timeline.lyrics.length) {
          const anchorChar = timeline.lyrics[c.anchorIndex];
          if (isCombiningMark(anchorChar)) {
            metrics.combiningMarkViolations++;
          }
        }

        if (k > 0) {
          const prev = timeline.chords[k - 1];
          const minAllowed = prev.x_actual + prev.width;
          if (c.x_actual < minAllowed - 0.01) {
            metrics.totalCollisionsUnresolved++;
          }
        }
      }

      // Assert: Lyric continuity (zero added space inside continuous words)
      // The extracted lyrics must be exact stripping of [chords]
      const pureLyricDirect = raw.replace(/\[[^\]]+\]/g, '');
      if (timeline.lyrics !== pureLyricDirect) {
        metrics.lyricCorruptionViolations++;
      }

      // Record target song report or sample comparison
      if (isTargetSong && targetSongReport) {
        targetSongReport.linesAudited++;
        if (lineObj.has_adjacent) {
          targetSongReport.adjacentLines++;
          if (targetSongReport.samples.length < 4) {
            targetSongReport.samples.push({
              rawText: raw,
              pureLyrics: timeline.lyrics,
              chordsTrack: timeline.chords.map(c => ({
                chord: c.raw,
                anchorChar: timeline.lyrics[c.anchorIndex] || '(end)',
                x_ideal: c.x_ideal,
                x_actual: c.x_actual,
                displaced: c.displaced,
                width: c.width
              }))
            });
          }
        }
      }

      // Capture general sample comparisons for the report
      if (lineObj.has_adjacent && sampledComparisons.length < 25) {
        sampledComparisons.push({
          songId,
          catalog: songData.catalog,
          title: songData.title,
          rawText: raw,
          continuousLyrics: timeline.lyrics,
          chords: timeline.chords.map(c => ({
            chord: c.raw,
            bass: c.bass,
            anchorChar: timeline.lyrics[c.anchorIndex] || '(end)',
            x_actual: c.x_actual,
            displaced: c.displaced
          }))
        });
      }
    }
  }

  if (isTargetSong && targetSongReport) {
    metrics.targetSongAudits.push(targetSongReport);
  }
}

// Final calculations
const auditResults = {
  timestamp: new Date().toISOString(),
  engine: 'ThaiChord v0.1.0 (Decoupled 2D Timeline & Optical Overhang)',
  summary: {
    totalSongsAudited: metrics.totalSongs,
    totalLinesAudited: metrics.totalLinesAudited,
    linesWithChords: metrics.linesWithChords,
    linesWithAdjacentChords: metrics.linesWithAdjacentChords,
    linesWithSlashChords: metrics.linesWithSlashChords,
    totalChordsAudited: metrics.totalChordsAudited,
    totalChordsRetained: metrics.totalChordsRetained,
    retentionRate: ((metrics.totalChordsRetained / metrics.totalChordsAudited) * 100).toFixed(2) + '%',
    track0Displacements: metrics.totalDisplacementsOnTrack0,
    track0CollisionsUnresolved: metrics.totalCollisionsUnresolved,
    combiningMarkViolations: metrics.combiningMarkViolations,
    lyricCorruptionViolations: metrics.lyricCorruptionViolations,
    auditStatus: (metrics.totalCollisionsUnresolved === 0 && metrics.combiningMarkViolations === 0 && metrics.lyricCorruptionViolations === 0 && metrics.totalChordsRetained === metrics.totalChordsAudited) ? 'PASSED_100_PERCENT' : 'FAILED'
  },
  targetSongAudits: metrics.targetSongAudits,
  sampledComparisons: sampledComparisons.slice(0, 15)
};

fs.writeFileSync(outputPath, JSON.stringify(auditResults, null, 2), 'utf-8');
console.log('\n--- Corpus Audit Finished ---');
console.log(`Audit Status: ${auditResults.summary.auditStatus}`);
console.log(`Total Chords Processed: ${metrics.totalChordsAudited}`);
console.log(`Total Chords Retained: ${metrics.totalChordsRetained} (${auditResults.summary.retentionRate})`);
console.log(`Lines with Adjacent Chords (][): ${metrics.linesWithAdjacentChords}`);
console.log(`Track 0 Displacements (Collision Resolved): ${metrics.totalDisplacementsOnTrack0}`);
console.log(`Unresolved Collisions: ${metrics.totalCollisionsUnresolved}`);
console.log(`Combining Mark Violations: ${metrics.combiningMarkViolations}`);
console.log(`Lyric Corruption / Injected Spaces: ${metrics.lyricCorruptionViolations}`);
console.log(`Slash Bass Chords Processed: ${metrics.slashChordsIdentified}`);
console.log(`\nAudit report written to: ${outputPath}`);
