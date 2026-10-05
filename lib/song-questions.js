'use strict';

/**
 * Song Helper question bank.
 * Kind of song is a lane (love, heartbreak, hype, and the rest), not a create mode.
 * Create modes are Write, Funny, Mad Libs, Superhero, Poem, and Battle.
 * Questions are optional. A later answer follows the one before it.
 * Ask another: a new follow-up when they answered, or a different question
 * at the same depth when they have not. Skip stays available.
 * Region is optional and is not a question in this bank.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongQuestions = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function clip(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max || 80);
  }

  function step(id, variants) {
    return { id: id, variants: variants };
  }

  function variant(plain, funny, funnySad, hint) {
    return {
      plain: plain,
      funny: funny,
      funnySad: funnySad || funny,
      hint: hint || 'Optional. A real detail beats a general one.',
    };
  }

  var KINDS = [
    { id: 'love', label: 'Love' },
    { id: 'heartbreak', label: 'Heartbreak' },
    { id: 'hype', label: 'Hype' },
    { id: 'petty', label: 'Petty' },
    { id: 'grateful', label: 'Grateful / healing' },
    { id: 'nostalgic', label: 'Nostalgic' },
    { id: 'angry', label: 'Angry' },
    { id: 'mindset', label: 'Mindset / cause / news' },
  ];

  var KIND_STEPS = {
    love: [
      step('who', [
        variant(
          'Who is this love song for?',
          'Who is this love song teasing, sweetly?',
          'Who is the joke actually about, the one that still hurts?',
          'A name or a nickname.'
        ),
        variant(
          'Who should hear this and know it is theirs?',
          'Who are we clowning, kindly?',
          'Who gets the soft joke that is really a confession?',
          'A name or a nickname.'
        ),
      ]),
      step('moment', [
        variant(
          'What moment with {who} is the song about?',
          'What ridiculous moment with {who} is the whole bit?',
          'What moment with {who} is funny only because it hurt?',
          'A room, a time, or one thing they did.'
        ),
        variant(
          'Where were you with {who} when it felt like a love song?',
          'Where were you with {who} when it got absurd?',
          'Where were you with {who} when the joke stopped being only a joke?',
          'Name the place.'
        ),
      ]),
      step('changed', [
        variant(
          'After {moment}, what changed?',
          'After {moment}, what got funnier, or harder to admit?',
          'After {moment}, what still aches when you laugh?',
          'One sentence about what is different now.'
        ),
        variant(
          'What is different between you and {who} now?',
          'What would {who} tease you about now?',
          'What do you and {who} pretend is fine?',
          'One concrete change.'
        ),
      ]),
      step('unsaid', [
        variant(
          'What still cannot be said out loud to {who}?',
          'What joke would you still not tell {who} to their face?',
          'What sad joke about {who} stays in your mouth?',
          'The line you would not text.'
        ),
        variant(
          'What would you sing to {who} and never text?',
          'What punchline about {who} do you keep to yourself?',
          'What would you laugh about alone, about {who}?',
          'One sentence, in your words.'
        ),
      ]),
    ],
    heartbreak: [
      step('who', [
        variant('Who broke it, or who did you lose?', 'Who is this breakup clowning, without being cruel?', 'Who is the joke you only tell when it still stings?', 'A name or a nickname.'),
        variant('Who is the heartbreak song for?', 'Who would laugh if they heard this, and who would not?', 'Who are you roasting because missing them is easier that way?', 'A name or a nickname.'),
      ]),
      step('moment', [
        variant('What moment with {who} broke, or ended?', 'What tiny moment with {who} became the whole punchline?', 'What moment with {who} is funny in the mean way heartbreak is funny?', 'One scene.'),
        variant('What was the last ordinary thing {who} did?', 'What boring thing did {who} do that you now find hilarious?', 'What ordinary thing from {who} do you still laugh at so you do not cry?', 'A hoodie, a text, a door.'),
      ]),
      step('changed', [
        variant('After {moment}, what changed in the room?', 'After {moment}, what is the ridiculous new routine?', 'After {moment}, what habit is both funny and sad?', 'One change you can point at.'),
        variant('What do you do now that {who} is not there?', 'What silly thing do you do because {who} is gone?', 'What do you joke about doing now that {who} left?', 'One habit.'),
      ]),
      step('unsaid', [
        variant('What can you still not say out loud about {who}?', 'What roast of {who} is really a confession?', 'What joke about {who} is just the thing you cannot say?', 'One sentence.'),
        variant('What text to {who} is still sitting there?', 'What petty text to {who} did you type and not send?', 'What unsent text to {who} is a joke covering a real line?', 'The words, if you want them in the song.'),
      ]),
    ],
    hype: [
      step('who', [
        variant('Who is in your corner for this?', 'Who is the hype man, even if it is you?', 'Who are you bigging up so you do not have to say you were scared?', 'A name, a crew, or yourself.'),
        variant('Who needs to hear that you made it through?', 'Who should be embarrassed they doubted you?', 'Who gets the brag that is really relief?', 'A name or a nickname.'),
      ]),
      step('moment', [
        variant('What moment are you celebrating?', 'What win is so specific it is funny?', 'What win still feels like a close call?', 'One scene you can point at.'),
        variant('Where were you when it turned in your favor?', 'Where were you when the win got ridiculous?', 'Where were you when you almost blew it and did not?', 'Name the place.'),
      ]),
      step('changed', [
        variant('What changed after {moment}?', 'What ridiculous upgrade happened after {moment}?', 'What got lighter after {moment}, even if you will not gloat?', 'One real change.'),
        variant('What can you do now that you could not before?', 'What silly thing can you finally afford, or finally stop doing?', 'What did you stop surviving and start enjoying?', 'One proof.'),
      ]),
      step('proof', [
        variant('What detail proves the hype is true?', 'What petty little proof makes the brag land?', 'What proof is quiet, not a shout?', 'A bill paid, a key, a time of night.'),
        variant('What would a camera catch that shows the win?', 'What object in the room is the trophy?', 'What small object is the real trophy?', 'Something you can touch.'),
      ]),
    ],
    petty: [
      step('who', [
        variant('Who is this petty song about?', 'Who are we roasting, lightly?', 'Who are you mocking because you are still mad?', 'Someone you know. Not a public figure.'),
        variant('Who did the small thing you are not letting go?', 'Who committed the tiny crime?', 'Who did the small thing that was not small to you?', 'A nickname is enough.'),
      ]),
      step('moment', [
        variant('What did {who} actually do?', 'What did {who} do that is funny when you say it out loud?', 'What did {who} do that you joke about so you stay in control?', 'One concrete move.'),
        variant('Where were you when {who} did it?', 'Where did the petty thing go down?', 'Where did it happen, when it stopped being funny?', 'Name the place.'),
      ]),
      step('changed', [
        variant('What did you do after {moment}?', 'What was your hilarious comeback, real or imagined?', 'What did you do after {moment} that you are not proud of?', 'One reaction.'),
        variant('What are you still holding from that moment?', 'What souvenir of the pettiness is still in the room?', 'What are you still not over, exactly?', 'An object or a habit.'),
      ]),
      step('unsaid', [
        variant('What would you say to {who} if you were braver, or meaner?', 'What is the joke you would tell {who} to their face?', 'What line to {who} is too sharp to send?', 'Keep it about the moment, not a slur or a threat.'),
        variant('What are you pretending you are over?', 'What are you jokingly "so over"?', 'What are you not over, said in one sentence?', 'One sentence.'),
      ]),
    ],
    grateful: [
      step('who', [
        variant('Who helped, or who are you thanking?', 'Who is the unlikely hero of this thank-you?', 'Who showed up when it was not funny yet?', 'A name or a nickname.'),
        variant('Who stayed?', 'Who stayed, even when it was awkward?', 'Who stayed when you were not easy to stay for?', 'A name is enough.'),
      ]),
      step('moment', [
        variant('What moment with {who} are you grateful for?', 'What small moment with {who} is the whole thank-you?', 'What moment with {who} still makes you quiet?', 'One scene.'),
        variant('What did {who} do that you still remember?', 'What did {who} do that sounds small and means everything?', 'What did {who} do that you have not laughed off?', 'One action.'),
      ]),
      step('changed', [
        variant('What healed, or got lighter, after {moment}?', 'What got easier, even if you joke that you are still a mess?', 'What is softer now, after {moment}?', 'One change.'),
        variant('What can you do now because {who} showed up?', 'What silly thing is possible now because {who} showed up?', 'What do you no longer have to survive alone?', 'One proof.'),
      ]),
      step('keep', [
        variant('What do you want the song to thank them for, in one line?', 'What thank-you line would embarrass {who}, in a good way?', 'What thank-you can you still not say out loud to {who}?', 'Your words.'),
        variant('What object or place holds that thanks?', 'What object is the funny souvenir of being helped?', 'What object still reminds you that you made it through?', 'Something you can point at.'),
      ]),
    ],
    nostalgic: [
      step('who', [
        variant('Who is in the memory?', 'Who is the funniest person in this memory?', 'Who is in the memory you miss and joke about so it hurts less?', 'A name or a nickname.'),
        variant('Who else was there?', 'Who else would remember it wrong, on purpose?', 'Who else was there that you do not talk about much?', 'A name, or "just me."'),
      ]),
      step('moment', [
        variant('What moment are you going back to?', 'What moment is ridiculous now and was serious then?', 'What moment do you replay when the room is quiet?', 'One scene.'),
        variant('Where did it happen?', 'Where did this nostalgic bit actually happen?', 'Where does the memory live, a room or a street?', 'Name the place.'),
      ]),
      step('changed', [
        variant('What is gone now that was there then?', 'What is gone that you can only joke about?', 'What is gone that you have not replaced?', 'One change.'),
        variant('What do you still do the same way?', 'What old habit is still funny because you kept it?', 'What habit from then did you keep?', 'One habit.'),
      ]),
      step('keep', [
        variant('What detail from then has to be in the song?', 'What silly detail from then has to survive?', 'What detail from then do you protect?', 'A sound, a smell, an object.'),
        variant('What would you say to the you from that moment?', 'What joke would you tell your past self?', 'What would you tell that version of you, without the joke?', 'One sentence.'),
      ]),
    ],
    angry: [
      step('who', [
        variant('Who is the anger for, or what is it about?', 'Who is getting the roast, fairly?', 'Who is the anger about, under the joke?', 'A person you know, or a situation. Not a public figure.'),
        variant('Who crossed the line?', 'Who did the thing you can describe in one funny, sharp sentence?', 'Who crossed a line you are done laughing off?', 'A nickname is enough.'),
      ]),
      step('moment', [
        variant('What happened that set it off?', 'What happened that is wild when you say it plain?', 'What happened that you are done joking away?', 'One scene.'),
        variant('Where were you when it happened?', 'Where were you when it got absurd?', 'Where were you when you got quiet and angry?', 'Name the place.'),
      ]),
      step('changed', [
        variant('What changed in you after {moment}?', 'What boundary did you turn into a punchline?', 'What boundary is not a joke anymore?', 'One change.'),
        variant('What did you stop accepting?', 'What nonsense did you finally clock?', 'What did you stop excusing?', 'One line.'),
      ]),
      step('unsaid', [
        variant('What do you want said out loud, cleanly?', 'What is the sharp joke that is also the truth?', 'What sentence is the anger, with no costume?', 'No threats, no slurs.'),
        variant('What would a fair verse say that a scream would not?', 'What bar makes the point without a threat?', 'What do you need heard, in one sentence?', 'One sentence.'),
      ]),
    ],
    mindset: [
      step('story', [
        variant('What is the story, in one sentence?', 'What is the story, said in a way that makes the point and the joke?', 'What is the hard part of this story, in one sentence?', 'Use your idea or the headline. Keep it specific.'),
        variant('What headline or moment are you actually writing about?', 'What part of this story is begging for a punchline?', 'What part of this story is not a punchline?', 'One concrete piece.'),
      ]),
      step('who', [
        variant('Who is affected, up close?', 'Who is the person in the story, not the crowd?', 'Who is carrying this, by name or nickname?', 'A person, not a statistic.'),
        variant('Who do you want the song to stand with?', 'Who would you hand the mic to?', 'Who needs the verse more than the headline does?', 'A name or a role you know.'),
      ]),
      step('keep', [
        variant('What should the song hold onto?', 'What detail keeps the song from turning into a speech?', 'What detail keeps this human?', 'A detail, a name, a sound.'),
        variant('What do you refuse to turn into a slogan?', 'What truth is funnier, or sadder, than the slogan?', 'What will you not smooth over?', 'One line.'),
      ]),
      step('say', [
        variant('What would you say to {who} about it?', 'What would you say to {who} that tells the truth and lands a joke?', 'What would you say to {who} with no joke in the way?', 'One sentence.'),
        variant('What do you want a listener to do, or remember?', 'What should they laugh at, then remember?', 'What should they remember after the song ends?', 'One action or one picture.'),
      ]),
    ],
  };

  var OWN_IDEA = [
    step('idea', [
      variant('What is the idea, in one sentence?', 'What is the funny version of the idea, in one sentence?', 'What is the tender version of the idea, in one sentence?', 'A blank box is enough.'),
      variant('Say the idea like a text to a friend.', 'Say the idea like a group-chat joke.', 'Say the idea like you are not ready to perform it.', 'Your words.'),
    ]),
    step('who', [
      variant('Who or what is it about?', 'Who is the comic center of it?', 'Who is it about, if you drop the joke?', 'A name, a place, or a thing.'),
      variant('Who else is in the picture?', 'Who else would make this funnier?', 'Who else was there when it mattered?', 'Optional.'),
    ]),
    step('happened', [
      variant('What happened?', 'What happened that is worth a laugh?', 'What happened that you have not brushed off?', 'One concrete sentence.'),
      variant('Where did it happen?', 'Where did the bit take place?', 'Where were you when it landed?', 'Name a place if you want.'),
    ]),
  ];

  var TOPIC_FOLLOWUPS = [
    { id: 'feel', ask: 'How do you feel about this?', hint: 'Mad, tender, curious, done with it' },
    { id: 'story', ask: 'Any personal experience with it?', hint: 'A real moment, if you have one' },
    { id: 'keep', ask: 'What do you want the song to hold onto?', hint: 'A detail, a name, a sound' },
  ];

  var MODE_EXTRA = {
    write: step('keep-line', [
      variant('Anything you want kept word for word?', 'Any line that has to stay, even inside the joke?', 'Any line that has to stay, even if the rest is playful?', 'Optional. Skip if the answers above are enough.'),
      variant('What sentence should the draft not rewrite?', 'What sentence should the joke not sand down?', 'What sentence should stay tender?', 'Optional.'),
    ]),
    funny: step('joke', [
      variant('What is the joke, in one sentence?', 'What is the actual joke?', 'What is the joke that is also a little sad?', 'The meter comes later. This is the point.'),
      variant('Who is in on the joke?', 'Who is allowed to laugh?', 'Who is the joke for, if it is not only you?', 'A name or "just me."'),
    ]),
    superhero: step('hero', [
      variant('What is your name in this story?', 'What do they call you when the cape is a hoodie?', 'What name do you use when you are the one who stayed?', 'You are the hero. Not a trademarked character.'),
      variant('What ordinary object is your proof?', 'What silly object is the origin story?', 'What object proves you showed up?', 'Something you can touch.'),
    ]),
    poem: step('image', [
      variant('What single image should the poem turn on?', 'What image is the poem, if it is also a joke?', 'What image should the poem not decorate?', 'One picture.'),
      variant('What form do you hear: short lines, a story, or a loop?', 'Do you want a punchline form, or a picture form?', 'Do you want it spare, or said twice?', 'Sonnet, haiku, free verse, or your own words.'),
    ]),
    battle: step('fight', [
      variant('What are the verses fighting about?', 'What is the roast about, kept light?', 'What are you battling that is not really a joke?', 'A late bus, a borrowed jacket, a real disagreement.'),
      variant('What do you refuse to lose the argument about?', 'What is the one point the punchline has to hit?', 'What point is serious even if the verse is sharp?', 'One sentence.'),
    ]),
  };

  var PARTS = [
    { id: 'song', label: 'Whole song' },
    { id: 'verse', label: 'Verse' },
    { id: 'hook', label: 'Hook' },
    { id: 'bars', label: 'Bars' },
    { id: 'bridge', label: 'Bridge' },
  ];

  var PART_STEPS = {
    verse: [
      step('who', [
        variant('Who is in this verse?', 'Who is the verse clowning?', 'Who is in this verse, under the joke?', 'A name or a nickname.'),
        variant('Who walks into the scene?', 'Who shows up and makes it a bit?', 'Who shows up and changes the temperature?', 'A name is enough.'),
      ]),
      step('happened', [
        variant('What happened in this verse?', 'What happens in this verse that is worth a laugh?', 'What happens in this verse that you do not laugh off?', 'One concrete sentence.'),
        variant('What can a camera see in this verse?', 'What prop does the verse need?', 'What object holds the verse?', 'Something you can point at.'),
      ]),
      step('why', [
        variant('Why does this verse matter?', 'Why is this verse the funny part?', 'Why does this verse matter, even if you play it light?', 'One sentence.'),
        variant('What changes by the last line of the verse?', 'What is the turn, even if it is a punchline?', 'What turns by the last line?', 'One change.'),
      ]),
    ],
    hook: [
      step('line', [
        variant('What is the hook sentence, the one you would actually sing?', 'What is the hook, the joke you could chant?', 'What is the hook, the line that is funny and true?', 'A full sentence.'),
        variant('If they were in front of you, what would the chorus say?', 'What would the chorus roast, kindly?', 'What would the chorus admit?', 'A full sentence.'),
      ]),
      step('happened', [
        variant('What happened that the hook is about?', 'What happened that the hook turns into a joke?', 'What happened that the hook will not joke away?', 'One sentence.'),
        variant('Where does the hook take place?', 'Where does the joke-hook live?', 'Where is the hook happening?', 'A place.'),
      ]),
      step('why', [
        variant('Why does that hook matter?', 'Why is that the line people should yell back?', 'Why does that line have to stay?', 'One sentence.'),
        variant('What should the hook hold onto?', 'What word in the hook is the punchline?', 'What word in the hook is the truth?', 'A detail.'),
      ]),
    ],
    bars: [
      step('about', [
        variant('What are these bars about?', 'What are these bars joking about?', 'What are these bars serious about, under the flex?', 'One sentence.'),
        variant('What point do the bars have to win?', 'What is the bar they cannot dodge?', 'What point is not a punchline?', 'One sentence.'),
      ]),
      step('proof', [
        variant('What detail proves it?', 'What silly proof makes the bar true?', 'What proof is too real to exaggerate?', 'An object, a place, a time.'),
        variant('What line of yours has to stay inside the bars?', 'What line is the joke you wrote, not the helper?', 'What line has to stay yours?', 'Optional. Your words.'),
      ]),
    ],
    bridge: [
      step('turn', [
        variant('What turns in the bridge?', 'What is the twist, even if it is a joke?', 'What turns when the joke runs out?', 'The moment the song changes.'),
        variant('What does the bridge admit that the hook did not?', 'What does the bridge confess after the punchline?', 'What does the bridge say quieter?', 'One sentence.'),
      ]),
      step('who', [
        variant('Who sees it differently in the bridge?', 'Who finally gets the joke in the bridge?', 'Who sees it differently when it is not funny?', 'A name or a nickname.'),
        variant('Who is the bridge talking to?', 'Who is the bridge roasting, or thanking?', 'Who is the bridge for?', 'A name is enough.'),
      ]),
      step('why', [
        variant('Why does the song need this turn?', 'Why does the joke need this turn?', 'Why does the song need this turn, not another punchline?', 'One sentence.'),
        variant('What should be different after the bridge?', 'What should the last chorus do after the joke turns?', 'What should the last chorus hold after the turn?', 'One change.'),
      ]),
    ],
  };

  function blank(id, labels, funnyLabels, hint) {
    return { id: id, labels: labels, funnyLabels: funnyLabels || labels, hint: hint || 'One or two words, or a short phrase.' };
  }

  var MADLIBS = {
    love: [
      blank('call', ['A name you call them', 'What you call them when nobody is listening'], ['A ridiculous pet name', 'What you call them as a joke'], 'A name or nickname.'),
      blank('place', ['A place you were together', 'The room the love song lives in'], ['The least romantic place you two have been', 'Where the date went sideways'], 'A real place.'),
      blank('object', ['Something they left in the room', 'An object that is theirs'], ['The silly object they left behind', 'The prop that gives the joke away'], 'Something you can touch.'),
      blank('time', ['A time of day', 'How late it got'], ['The time the bit happened', 'When it stopped being only funny'], 'A clock time or a part of the day.'),
      blank('promise', ['A promise you actually made', 'What you said you would do'], ['A promise you made as a joke and meant', 'A promise you are scared was serious'], 'Your words.'),
      blank('unsaid', ['A word you cannot say out loud', 'The line you would not text'], ['The punchline you will not say to their face', 'The soft word under the joke'], 'One word or a short line.'),
    ],
    heartbreak: [
      blank('call', ['What you still call them', 'The name in your phone'], ['The nickname you use when you are pretending you are over it', 'What the group chat calls them'], 'A name.'),
      blank('left', ['What they left behind', 'The object still in the room'], ['The ridiculous thing they left', 'The object you joke about and have not moved'], 'Something you can touch.'),
      blank('place', ['The last place you saw them', 'Where it ended'], ['Where the breakup got awkwardly funny', 'The place you avoid and joke about'], 'A real place.'),
      blank('text', ['The text you did not send', 'What you almost typed'], ['The petty text you did not send', 'The joke text that was really a plea'], 'A sentence.'),
      blank('habit', ['A habit you kept', 'What you still do at that hour'], ['The silly habit you kept', 'The habit that is not funny at 1am'], 'One habit.'),
      blank('hour', ['The time of night', 'When the room gets quiet'], ['The hour the joke wears off', 'When you stop performing fine'], 'A time.'),
    ],
    hype: [
      blank('win', ['The win, said plain', 'What you pulled off'], ['The win, said like a brag and a joke', 'The tiny win you are treating like a parade'], 'One fact.'),
      blank('place', ['Where the win happened', 'The room you were in'], ['Where the celebration got silly', 'The unglamorous place the win happened'], 'A place.'),
      blank('proof', ['The proof you can point at', 'The object that shows it'], ['The funniest proof', 'The quiet proof'], 'A key, a bill, a shoe.'),
      blank('crew', ['Who was with you', 'Who you would shout out'], ['Who hyped you too loud', 'Who knew you were nervous'], 'A name.'),
      blank('before', ['What it was like before', 'The old struggle, in a few words'], ['The old struggle, as a joke you survived', 'What you do not laugh at from before'], 'A short phrase.'),
      blank('now', ['What you can do now', 'The new ordinary'], ['The ridiculous new ordinary', 'The new ordinary you do not take for granted'], 'One change.'),
    ],
    petty: [
      blank('who', ['Who did it', 'The nickname in this song'], ['Who we are roasting', 'Who the joke is not ready to forgive'], 'Not a public figure.'),
      blank('did', ['What they did', 'The small offense'], ['The offense, said so it is funny', 'The offense, said so it is not only funny'], 'One move.'),
      blank('place', ['Where it happened', 'The scene of the crime'], ['Where the petty thing went down', 'The place you are still side-eyeing'], 'A place.'),
      blank('receipt', ['The receipt you are holding', 'Your comeback, in a few words'], ['The joke receipt', 'The line you did not send'], 'A short line.'),
      blank('object', ['The object involved', 'What is still sitting there'], ['The prop of the pettiness', 'The object you have not thrown out'], 'Something you can touch.'),
      blank('over', ['What you are pretending you are over', 'The thing you keep bringing up'], ['The thing you are "so over"', 'The thing you are not over'], 'A short phrase.'),
    ],
    grateful: [
      blank('who', ['Who you are thanking', 'Who stayed'], ['Who is the unlikely hero', 'Who stayed when it was not cute'], 'A name.'),
      blank('did', ['What they did', 'The help, said plain'], ['The help, said like a toast and a joke', 'The help you still get quiet about'], 'One action.'),
      blank('place', ['Where it happened', 'The room where they showed up'], ['The unglamorous room where they showed up', 'Where you were when it got lighter'], 'A place.'),
      blank('object', ['An object that holds the thanks', 'What they handed you'], ['The funny souvenir of being helped', 'The object you kept'], 'Something you can touch.'),
      blank('before', ['What was heavy before', 'What you were carrying'], ['The mess, said with a smile', 'The mess you do not joke away'], 'A short phrase.'),
      blank('lighter', ['What is lighter now', 'What you can do because of them'], ['What is lighter, even if you are still a mess', 'What you can say thank you for out loud'], 'One change.'),
    ],
    nostalgic: [
      blank('when', ['When it was', 'The year or the season, in your words'], ['When it was, said like a bit', 'When it was, without dressing it up'], 'A time.'),
      blank('place', ['Where the memory lives', 'The old room or street'], ['The place that is funny now', 'The place you miss'], 'A place.'),
      blank('who', ['Who was there', 'The person in the memory'], ['Who was the character', 'Who you miss in that room'], 'A name.'),
      blank('sound', ['A sound from then', 'What you could hear'], ['The goofy sound you remember', 'The sound you still wait for'], 'A sound.'),
      blank('object', ['An object from then', 'What you kept'], ['The junk you kept', 'The object you will not throw out'], 'Something you can touch.'),
      blank('gone', ['What is gone now', 'What you cannot get back'], ['What is gone that you can joke about', 'What is gone that the joke cannot cover'], 'A short phrase.'),
    ],
    angry: [
      blank('who', ['Who it is about', 'Who crossed the line'], ['Who the roast is for', 'Who you are done joking about'], 'Not a public figure.'),
      blank('did', ['What they did', 'The line they crossed'], ['What they did, said so it lands', 'What they did, with no extra heat'], 'One move. No threats.'),
      blank('place', ['Where it happened', 'The room it happened in'], ['Where it got absurd', 'Where you got quiet'], 'A place.'),
      blank('line', ['The sentence you want heard', 'What a fair verse would say'], ['The sharp joke that is also fair', 'The sentence with the joke taken out'], 'No slurs, no threats.'),
      blank('object', ['The object in the scene', 'What was in your hand or on the table'], ['The prop of the argument', 'The object that proves it happened'], 'Something you can touch.'),
      blank('after', ['What you stopped accepting', 'The boundary'], ['The boundary, as a punchline', 'The boundary, said plain'], 'One change.'),
    ],
    mindset: [
      blank('story', ['The story in a few words', 'The headline in your words'], ['The story, with the joke you actually mean', 'The story, without a slogan'], 'One concrete piece.'),
      blank('who', ['Who is affected, up close', 'The person in the song'], ['Who you would hand the mic', 'Who is carrying it'], 'A person, not a crowd.'),
      blank('place', ['Where it is happening', 'The place a listener can picture'], ['The place the joke has to respect', 'The place that keeps it real'], 'A place.'),
      blank('keep', ['What the song should hold onto', 'The detail that is not a slogan'], ['The detail that saves it from a speech', 'The detail that keeps it human'], 'A detail.'),
      blank('say', ['What you would say to them', 'One sentence for the person in it'], ['What you would say that tells the truth and lands', 'What you would say with no joke in the way'], 'One sentence.'),
      blank('do', ['What you want remembered', 'The picture that should stay'], ['What they should laugh at, then remember', 'What should stay after the song'], 'One picture or action.'),
    ],
  };

  function kindById(id) {
    var key = String(id || '');
    for (var i = 0; i < KINDS.length; i += 1) {
      if (KINDS[i].id === key) return KINDS[i];
    }
    return KINDS[0];
  }

  function isSad(mood) {
    var value = String(mood || '').toLowerCase();
    return value === 'heartbroken' || value === 'sad' || value === 'healing' || value === 'angry';
  }

  function voiceKey(ctx) {
    if (ctx && ctx.mode === 'funny' && isSad(ctx.mood)) return 'funnySad';
    if (ctx && ctx.mode === 'funny') return 'funny';
    return 'plain';
  }

  function answerMap(session) {
    var map = {};
    (session.saved || []).forEach(function (row) {
      if (row && row.id && row.text && !map[row.id]) map[row.id] = row.text;
    });
    return map;
  }

  function fill(text, session) {
    var answers = answerMap(session);
    var who = answers.who || answers.call || '';
    var moment = answers.moment || answers.happened || answers.story || '';
    var topic = clip(session.topic, 80);
    var line = String(text || '');
    if (who) line = line.replace(/\{who\}/g, who);
    else {
      line = line.replace(/\s+with \{who\}/g, '');
      line = line.replace(/\s+to \{who\}/g, '');
      line = line.replace(/\s+about \{who\}/g, '');
      line = line.replace(/\s+and \{who\}/g, '');
      line = line.replace(/\{who\}/g, 'they');
    }
    line = line.replace(/\{moment\}/g, moment ? clip(moment, 80) : 'that moment');
    line = line.replace(/\s{2,}/g, ' ').replace(/\s+([?.])/g, '$1').trim();
    if (session.mode === 'superhero') line = 'You are the hero. ' + line;
    else if (session.mode === 'poem') line = 'One picture. ' + line;
    else if (session.mode === 'battle' && session.part === 'song') line = 'For the battle: ' + line;
    if (topic) line += ' This stays about ' + topic + '.';
    return line;
  }

  function madlibSteps(kind) {
    var pack = MADLIBS[kind] || MADLIBS.love;
    return pack.map(function (item) {
      var labels = item.labels;
      var funny = item.funnyLabels || labels;
      return step(item.id, labels.map(function (label, index) {
        return {
          plain: label,
          funny: funny[index] || funny[0] || label,
          funnySad: funny[index] || label,
          hint: item.hint,
          madlib: true,
        };
      }));
    });
  }

  function chain(session) {
    var steps;
    if (session.part && session.part !== 'song' && PART_STEPS[session.part]) {
      steps = PART_STEPS[session.part].slice();
    } else if (session.mode === 'madlibs') {
      steps = madlibSteps(session.kind || 'love');
    } else {
      steps = (KIND_STEPS[session.kind] || KIND_STEPS.love).slice();
      if (MODE_EXTRA[session.mode]) steps = steps.concat([MODE_EXTRA[session.mode]]);
    }
    return steps;
  }

  function open(ctx) {
    var src = ctx || {};
    return {
      kind: kindById(src.kind).id,
      mode: src.mode || 'write',
      mood: src.mood || '',
      topic: clip(src.topic, 120),
      part: src.part || 'song',
      index: 0,
      variant: 0,
      followVariant: 0,
      draft: '',
      pending: null,
      saved: [],
    };
  }

  function sync(session, ctx) {
    var src = ctx || {};
    if (src.mood != null) session.mood = src.mood;
    if (src.topic != null) session.topic = clip(src.topic, 120);
    return session;
  }

  function current(session) {
    if (!session) return null;
    if (session.pending) return session.pending;
    var steps = chain(session);
    if (session.index >= steps.length) return null;
    var item = steps[session.index];
    var variants = item.variants;
    var picked = variants[session.variant % variants.length];
    var key = voiceKey(session);
    return {
      id: item.id,
      depth: session.index,
      ask: fill(picked[key] || picked.plain, session),
      hint: picked.hint,
      madlib: Boolean(picked.madlib),
      custom: false,
      follow: false,
    };
  }

  function followAsks(session, answer) {
    var bit = clip(answer, 80);
    var quoted = '"' + bit + '"';
    if (session.mode === 'funny' && isSad(session.mood)) {
      return [
        'You said ' + quoted + '. What is the joke you would still not say out loud?',
        'You wrote ' + quoted + '. What makes that funny and sad at the same time?',
      ];
    }
    if (session.mode === 'funny') {
      return [
        'You said ' + quoted + '. What is the punchline hiding in that?',
        'You wrote ' + quoted + '. What silly detail did you leave out?',
      ];
    }
    if (session.mode === 'madlibs') {
      return [
        'You filled ' + quoted + '. What else was in that scene?',
        'You wrote ' + quoted + '. What is the other word that has to sit next to it?',
      ];
    }
    return [
      'You said ' + quoted + '. What happened right after that?',
      'You wrote ' + quoted + '. What detail would a camera catch?',
    ];
  }

  function remember(session, id, text) {
    var value = clip(text, 280);
    if (!value) return;
    session.saved.push({
      id: id || 'note',
      ask: session.pending ? session.pending.ask : (current(session) ? current(session).ask : ''),
      text: value,
      depth: session.pending ? session.pending.depth : session.index,
    });
  }

  function askAnother(session) {
    var draft = clip(session.draft, 280);
    var cur = current(session);
    if (!session || !cur) return session;
    if (draft) {
      remember(session, cur.id, draft);
      var bank = followAsks(session, draft);
      session.pending = {
        id: cur.id + '-follow',
        depth: cur.depth,
        ask: bank[session.followVariant % bank.length],
        hint: 'This follow-up comes from what you just wrote. Optional.',
        follow: true,
        custom: false,
      };
      session.followVariant += 1;
      session.draft = '';
      return session;
    }
    if (session.pending && session.pending.follow) {
      var previous = session.saved.length ? session.saved[session.saved.length - 1].text : '';
      var again = followAsks(session, previous || 'that');
      session.pending = {
        id: cur.id,
        depth: cur.depth,
        ask: again[session.followVariant % again.length],
        hint: 'A different follow-up, same moment. Optional.',
        follow: true,
        custom: false,
      };
      session.followVariant += 1;
      return session;
    }
    session.variant += 1;
    return session;
  }

  function skip(session) {
    if (!session) return session;
    session.draft = '';
    session.pending = null;
    session.followVariant = 0;
    session.variant = 0;
    session.index += 1;
    return session;
  }

  function next(session) {
    if (!session) return session;
    var draft = clip(session.draft, 280);
    var cur = current(session);
    if (cur && draft) remember(session, cur.id, draft);
    session.draft = '';
    session.pending = null;
    session.followVariant = 0;
    session.variant = 0;
    session.index += 1;
    return session;
  }

  function ownQuestion(session, ask) {
    var text = clip(ask, 180);
    if (!session || !text) return session;
    var cur = current(session);
    session.pending = {
      id: 'own',
      depth: cur ? cur.depth : session.index,
      ask: text,
      hint: 'Answer the question you wrote. Optional, and your words can stay in the song.',
      custom: true,
      follow: false,
    };
    session.draft = '';
    return session;
  }

  function view(session) {
    var cur = current(session);
    if (!cur) {
      return { done: true, ask: '', hint: '', depth: session ? session.index : 0, saved: (session && session.saved) || [] };
    }
    return {
      done: false,
      id: cur.id,
      ask: cur.ask,
      hint: cur.hint,
      depth: cur.depth,
      madlib: Boolean(cur.madlib),
      custom: Boolean(cur.custom),
      follow: Boolean(cur.follow),
      saved: session.saved || [],
    };
  }

  function madlibs(kind) {
    var pack = MADLIBS[kindById(kind).id] || MADLIBS.love;
    return pack.map(function (item) {
      return { id: item.id, label: item.labels[0], hint: item.hint };
    });
  }

  function savedTexts(session) {
    return (session && session.saved ? session.saved : []).map(function (row) {
      return { id: row.id, ask: row.ask, text: row.text };
    });
  }

  return {
    KINDS: KINDS,
    PARTS: PARTS,
    TOPIC_FOLLOWUPS: TOPIC_FOLLOWUPS,
    askAnother: askAnother,
    kindById: kindById,
    madlibs: madlibs,
    next: next,
    open: open,
    ownIdea: function () { return OWN_IDEA; },
    ownQuestion: ownQuestion,
    savedTexts: savedTexts,
    skip: skip,
    sync: sync,
    view: view,
  };
}));
