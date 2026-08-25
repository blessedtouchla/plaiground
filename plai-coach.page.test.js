'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function run() {
  const page = read('plai.html');
  const index = read('index.html');
  const css = read('site.css');
  const bubbleJs = read('plai-bubble.js');
  const bubbleCss = read('plai-bubble.css');

  assert.ok(page.includes('class="plai-coach-identity"'), 'coach page has the left identity column');
  assert.ok(/<h1>\s*PLAI\s*<\/h1>/.test(page), 'identity name is PLAI');
  assert.ok(page.includes('Your Release Coach'), 'subtitle is Your Release Coach');
  assert.ok(/sounds like PLAY/i.test(page), 'optional PLAY pronunciation hint stays small');
  assert.ok(/she\/her/i.test(page), 'PLAI uses she/her');
  assert.ok(page.includes('class="plai-coach-chat"'), 'right column is the chat shell');
  assert.ok(page.includes('class="plai-coach-log"'), 'chat shell has a message list');
  assert.ok(page.includes('data-plai-coach-form'), 'chat shell has an input form');
  assert.ok(page.includes('id="plai-coach-input"'), 'chat shell has an input');
  assert.ok(page.includes('class="plai-coach-plan"'), 'Action Plan box sits on the page');
  assert.ok(page.includes('id="plai-action-plan-title">Action Plan</h2>'), 'Action Plan is labeled');
  assert.ok(page.indexOf('class="plai-coach-grid"') < page.indexOf('class="plai-coach-plan"'), 'Action Plan sits below identity and chat');
  assert.ok(!/<li\b/.test(page.match(/class="plai-coach-plan"[\s\S]*?<\/section>/)[0]), 'Action Plan stays empty');
  assert.ok(/<div class="plai-coach-log"[^>]*><\/div>/.test(page), 'chat log stays empty');

  assert.ok(!/buy a car at the click of a button/i.test(page), 'coach page must not dump the FAQ car-click essay');
  assert.ok(!/Meet PLAI/i.test(page), 'coach page must not lead with Meet PLAI');
  assert.ok(!/We were already talking on this site/i.test(page), 'coach page must not dump the voice-agent seed');
  assert.ok(page.indexOf('<h1>PLAI</h1>') !== -1, 'page title treatment is the coach name');
  assert.ok(!/<h1>What is PLAI\?<\/h1>/.test(page), 'coach page is not the FAQ PLAI essay');

  assert.ok(page.includes('header class="nav"'), 'logged-out chrome uses the public header');
  assert.ok(page.includes('class="side"'), 'signed-in chrome-swap keeps the app sidebar');
  assert.ok(page.includes('class="app-main"'), 'signed-in chrome-swap wraps the page');
  assert.ok(page.includes('src="site.js"'), 'coach page loads the chrome-swap script');
  assert.ok(page.includes('plai-bubble.js'), 'Talk/Text PLAI still load on the coach page');
  assert.ok(!/href="plai.html">PLAI<\/a>/.test(page.match(/<nav class="side-nav">[\s\S]*?<\/nav>/)[0]), 'do not add PLAI Coach to the signed-in product menu');

  assert.ok(index.includes('data-plai-coach-float'), 'homepage has the circular PLAI float');
  assert.ok(index.includes('Need help getting your track out?'), 'homepage popup copy is locked');
  assert.ok(/href="plai.html">Talk to PLAI<\/a>/.test(index), 'homepage popup links to the coach page');
  assert.ok(index.includes('plai-bubble.js'), 'homepage still loads Talk/Text PLAI');
  assert.ok(css.includes('.plai-coach-float'), 'homepage float is styled');
  const floatBlock = css.match(/\.plai-coach-float\s*\{[\s\S]*?\}/);
  assert.ok(floatBlock, 'homepage float has a position block');
  assert.ok(/bottom:\s*92px/.test(floatBlock[0]), 'homepage float sits above the Talk/Text pair');
  assert.ok(/z-index:\s*3500/.test(floatBlock[0]), 'homepage float stays under the Talk/Text stack');

  ['faq.html', 'how-it-works.html', 'dashboard.html', 'about.html', 'contact.html'].forEach(function (file) {
    assert.ok(!read(file).includes('data-plai-coach-float'), file + ' must not get the homepage-only coach float');
  });

  assert.ok(bubbleJs.includes("text: 'Talk to PLAI'"), 'Talk to PLAI button stays');
  assert.ok(bubbleJs.includes("text: 'Text PLAI'"), 'Text PLAI button stays');
  assert.ok(bubbleJs.includes("AGENT_ID = 'agent_BDVzp3Ar3ABtyov5'"), 'voice agent id stays');
  assert.ok(!page.includes('XAI_API_KEY') && !index.includes('XAI_API_KEY'), 'coach surfaces must not leak XAI_API_KEY');
  assert.ok(!/elevenlabs/i.test(page + index + css), 'no ElevenLabs on the coach structure');
  assert.ok(!/ToneGrid|Tonegrid/.test(page.replace(/<script\b[\s\S]*?<\/script>/gi, '')), 'no ToneGrid in coach page copy');
  assert.ok(!/fetch\s*\(|XMLHttpRequest|\/api\/plai-session/.test(page), 'coach page must not invent a second AI backend');

  const frontend = ['plai.html', 'index.html', 'site.css', 'plai-bubble.js', 'plai-bubble.css'];
  frontend.forEach(function (file) {
    const text = read(file);
    assert.ok(!text.includes('XAI_API_KEY'), file + ' must not leak XAI_API_KEY');
    assert.ok(!/elevenlabs/i.test(text), file + ' must not add ElevenLabs');
  });

  assert.ok(css.includes('#d03083') && css.includes('#782fb1') && css.includes('#f3cb47'), 'coach accents use brand magenta, purple, and gold');
  assert.ok(page.includes('assets/plai-avatar.png'), 'avatar slot is ready for the uploaded PNG');
  assert.ok(page.includes('plai-coach-initials'), 'placeholder is initials, not an invented face');
  assert.ok(!/GenerateImage|stable-diffusion|thispersondoesnotexist/i.test(page + index), 'do not invent a face');

  assert.ok(bubbleCss.includes('.plai-bubble-pill.is-text'), 'Talk/Text chrome file was not replaced');

  console.log('plai-coach.page.test.js ok');
}

run();
