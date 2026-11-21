'use strict';

/**
 * Optional rebuild for data/cmu-trim.json.
 * Source: CMU Pronouncing Dictionary, cmudict.dict, BSD-style license,
 * https://github.com/cmusphinx/cmudict
 *
 * This script does not download the dictionary. Pass a local cmudict.dict path.
 * It keeps syllable count (vowel phonemes, the ones with a stress digit) and
 * the rhyme part (last stressed vowel, plus the consonants after it).
 *
 * Usage: node scripts/build-cmudict.js /path/to/cmudict.dict
 *
 * The notebook rhyme check still forces gone/on to exact and room/soon to near
 * when a raw dictionary vowel would split them. See lib/word-engine.js.
 */

const fs = require('fs');
const path = require('path');

const VOWEL = /[0-9]$/;

function rhymePart(phones) {
  var last = -1;
  var i;
  for (i = 0; i < phones.length; i += 1) {
    if (VOWEL.test(phones[i]) && /1/.test(phones[i])) last = i;
  }
  if (last < 0) {
    for (i = phones.length - 1; i >= 0; i -= 1) {
      if (VOWEL.test(phones[i])) { last = i; break; }
    }
  }
  if (last < 0) return { vowel: '', coda: '' };
  var vowel = phones[last].replace(/[0-9]/g, '');
  var coda = phones.slice(last + 1).map(function (phone) { return phone.replace(/[0-9]/g, ''); }).join('');
  return { vowel: vowel, coda: coda };
}

function syllables(phones) {
  return phones.filter(function (phone) { return VOWEL.test(phone); }).length || 1;
}

function main() {
  var src = process.argv[2];
  if (!src) {
    console.error('Pass a cmudict.dict path. Nothing was written.');
    process.exit(1);
  }
  var text = fs.readFileSync(src, 'utf8');
  var out = {};
  text.split(/\n/).forEach(function (line) {
    if (!line || line.charAt(0) === ';') return;
    var bits = line.trim().split(/\s+/);
    if (bits.length < 2) return;
    var word = bits[0].toLowerCase().replace(/\(\d+\)$/, '');
    if (!/^[a-z][a-z']*$/.test(word)) return;
    if (out[word]) return;
    var phones = bits.slice(1);
    var part = rhymePart(phones);
    out[word] = { syl: syllables(phones), vowel: part.vowel, coda: part.coda };
  });
  var dest = path.join(__dirname, '..', 'data', 'cmu-trim.json');
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log('Wrote ' + Object.keys(out).length + ' words to ' + dest);
}

if (require.main === module) main();

module.exports = { rhymePart: rhymePart, syllables: syllables };
