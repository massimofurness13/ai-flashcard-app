// Uses existing recordings, never generates/bills for audio or accesses an account.
// node scripts/native-tests/make-audio-return-fixture.mjs OUT FRONT_MP3 BACK_MP3
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [output, frontFile, backFile] = process.argv.slice(2);
if (!output || !frontFile || !backFile) throw Error('Supply output JSON, Spanish MP3, English MP3');
execFileSync(process.execPath, ['scripts/native-tests/make-fixture.mjs', output]);
const fixture = JSON.parse(readFileSync(output, 'utf8'));
// Keep the base identity/settings, replace its exercise and fetch override.
const marker = readFileSync(new URL('./exercise.js', import.meta.url), 'utf8');
const base = JSON.parse(readFileSync(output, 'utf8')).script;
if (!base.endsWith(marker)) throw Error('Base fixture exercise changed');
fixture.script = base.slice(0, base.lastIndexOf(marker))
  .replace("window.fetch=async()=>{throw new TypeError('Network disabled by isolated simulator test')};", '')
  + readFileSync(new URL('./audio-return.js', import.meta.url), 'utf8');
for (const record of fixture.records) {
  const value = record.value;
  if (record.key === 'query:/api/decks/fixture-deck/view') {
    const deck = value.deck;
    deck.frontLanguageCode = 'es-US'; deck.backLanguageCode = 'en-GB';
    deck.cards = deck.cards.slice(0, 2).map(card => ({...card,
      front: 'Quisiera un vaso de agua.', back: 'I would like a glass of water.',
      deck: {...card.deck, frontLanguageCode: 'es-US', backLanguageCode: 'en-GB'},
    }));
    deck._count.cards = 2;
  }
  if (record.key === 'query:/api/library') { value.dailyStudy.total = 2; value.totalCards = 2; }
  for (const deck of value.unfolderedDecks || value.decks || []) {
    deck._count.cards = 2; deck.frontLanguageCode = 'es-US'; deck.backLanguageCode = 'en-GB';
  }
}
for (const [lang, text, file, url] of [
  ['es-US', 'Quisiera un vaso de agua.', frontFile, 'fixture-water-front'],
  ['en-GB', 'I would like a glass of water.', backFile, 'fixture-water-back'],
]) fixture.records.push(
  {key: `audio:v1:${lang}:${text}`, value: url},
  {key: `media:${url}`, value: {__huellaBlob: true, type: 'audio/mpeg', data: readFileSync(file).toString('base64')}},
);
writeFileSync(output, JSON.stringify(fixture));
