'use strict';

const marketing = require('../lib/marketing');

const from = process.argv[2] || '';
const to = process.argv[3] || '';

marketing.report(from, to).then((result) => {
  if (result.error === 'bad_range') {
    console.error('Use dates as YYYY-MM-DD.');
    process.exit(1);
  }
  if (result.error === 'range_too_long') {
    console.error('Date range is too long.');
    process.exit(1);
  }
  process.stdout.write(marketing.reportToCsv(result));
}).catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
