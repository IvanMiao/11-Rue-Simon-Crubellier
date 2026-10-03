import { strict as assert } from 'node:assert';
import { CELLS, CHAPTER_GRID, chapterNumeral, cellTitle } from './damier';

const chapters = CELLS.map((cell) => cell.chapter).filter(
  (chapter): chapter is number => chapter !== null
);
assert.equal(CELLS.length, 100);
assert.equal(new Set(chapters).size, 99);
assert.deepEqual([...chapters].sort((a, b) => a - b), Array.from({ length: 99 }, (_, i) => i + 1));
assert.equal(CELLS.find((cell) => cell.id === '-1:1')?.chapter, null);
assert.equal(cellTitle('3:1'), '巴特尔布思, 5');
assert.equal(chapterNumeral(99), 'XCIX');
assert.equal(CHAPTER_GRID[5][5], 1);

const byChapter = new Map(CELLS.filter((cell) => cell.chapter !== null).map((cell) => [cell.chapter!, cell]));
for (let chapter = 1; chapter < 99; chapter += 1) {
  const from = byChapter.get(chapter)!;
  const to = byChapter.get(chapter + 1)!;
  const deltas = [Math.abs(from.floor - to.floor), Math.abs(from.col - to.col)].sort();
  const knightMove = deltas[0] === 1 && deltas[1] === 2;
  assert.equal(knightMove, chapter !== 65, `${chapter}→${chapter + 1}`);
}

console.log('damier checks passed');
