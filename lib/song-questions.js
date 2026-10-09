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
  var STORY_MAX = 1500;

  function clip(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max || 80);
  }

  function storyAnswer(value) {
    var text = String(value == null ? '' : value).replace(/\r\n/g, '\n');
    text = text.replace(/^\s+/, '').replace(/\s+$/, '');
    if (text.length > STORY_MAX) {
      var err = new Error('long');
      err.code = 'long';
      throw err;
    }
    return text;
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
          'Tell me about the person this love song is for.',
          'Tell me the sweet story you would tease them with.',
          'Tell me about the person the joke is really about, the one that still hurts.',
          'A name, or the moment you picture.'
        ),
        variant(
          "Who's in the room with you? Tell me what they're doing.",
          'Walk me through the silly thing they do that you love.',
          'Tell me what they were doing the last time the joke stopped being only a joke.',
          'A name, or what their hands were doing.'
        ),
      ]),
      step('moment', [
        variant(
          'Take me there. What did that place look and sound like?',
          'Take me to the ridiculous place this love song actually happened.',
          'Take me back to the room where the joke stopped being only a joke.',
          'A room, a sound, or what you could see.'
        ),
        variant(
          'Walk me through a moment with {who} that felt easy.',
          'Walk me through the bit with {who} that you still act out.',
          'Walk me through the moment with {who} you laugh at so it hurts less.',
          'One scene, in order.'
        ),
      ]),
      step('changed', [
        variant(
          "What's something of theirs you still have? Tell me how you ended up keeping it.",
          'Tell me the funny story of the thing of theirs you never gave back.',
          'Tell me about the thing of theirs you kept, and why you have not joked it away.',
          'How it ended up with you.'
        ),
        variant(
          'Take me to the day you decided to keep it.',
          'Walk me through the silly reason it is still in the room.',
          'Tell me where it sits now, and what you do when you see it.',
          'One place, one habit.'
        ),
      ]),
      step('unsaid', [
        variant(
          "What's something they said that stuck with you? Tell me when they said it.",
          'Tell me the line they said that you still quote when you are teasing.',
          'Tell me the line they said that you laugh about because you cannot say the real one.',
          'When they said it, and the words.'
        ),
        variant(
          'Tell me about something you still have not said out loud to {who}.',
          'Tell me the joke you would still not tell {who} to their face.',
          'Walk me through the text to {who} you typed and did not send.',
          'Your words. They can stay in the song.'
        ),
      ]),
    ],
    heartbreak: [
      step('who', [
        variant('Tell me about a good day with them, before it broke.', 'Tell me a good day with them that you can still laugh about.', 'Tell me a good day with them that you joke about so it stings less.', 'Start before the hard part.'),
        variant('Tell me how you met, back when it was easy.', 'Walk me through the meet-cute you would roast now.', 'Tell me the day you met, before you had to make a joke of it.', 'One afternoon is enough.'),
      ]),
      step('moment', [
        variant('Tell me about the last regular moment you had together.', 'Tell me the last boring moment that turned into the whole bit.', 'Tell me the last ordinary moment you still laugh at so you do not cry.', 'A hoodie, a text, a door.'),
        variant('Walk me through that regular moment like you are still in it.', 'Walk me through the tiny thing {who} did that is funny now.', 'Walk me through the ordinary thing from {who} that you have not put down.', 'What they did, then what you did.'),
      ]),
      step('changed', [
        variant('What did they leave behind? Tell me where it is now.', 'Tell me the ridiculous thing they left, and where you hid it.', 'Tell me what they left, and why you have not moved it.', 'The object and the spot.'),
        variant('Take me to the spot where that thing still sits.', 'Take me to the drawer you joke about opening.', 'Take me to the place you still check, even when you say you are fine.', 'A shelf, a chair, a pocket.'),
      ]),
      step('unsaid', [
        variant('Tell me about the text you typed and never sent.', 'Tell me the petty text you typed, laughed at, and did not send.', 'Tell me the text you typed as a joke because the real line was too much.', 'The words, if you want them in the song.'),
        variant('Walk me through the moment you almost hit send.', 'Walk me through the night you almost sent the roast.', 'Walk me through the minute you put the phone down.', 'Where you were, and what stopped you.'),
      ]),
    ],
    hype: [
      step('who', [
        variant('Tell me about the person who believed in you first.', 'Tell me about the person who hyped you before it was funny.', 'Tell me about the person who believed in you when you could not joke about it yet.', 'A name, a crew, or yourself.'),
        variant('Tell me about a day you were proud of yourself, even a small one.', 'Tell me the small win you would brag about in the group chat.', 'Tell me the small win that felt like relief more than a brag.', 'One day is enough.'),
      ]),
      step('moment', [
        variant('Take me to the moment it turned.', 'Take me to the second the win got ridiculous.', 'Take me to the moment you almost blew it and did not.', 'Where you were standing.'),
        variant('Walk me through where you were standing when you knew.', 'Walk me through the room when the brag became real.', 'Walk me through the quiet second before you let yourself smile.', 'The floor, the door, the clock.'),
      ]),
      step('changed', [
        variant('Tell me how you got the thing that proves it.', 'Tell me the funny errand that ended with proof in your hand.', 'Tell me how you got the proof, without turning it into a shout.', 'A key, a bill, a shoe.'),
        variant('Walk me through the day that thing became yours.', 'Walk me through the silly victory lap after you got it.', 'Tell me where you put it, and who you did not tell yet.', 'One afternoon.'),
      ]),
      step('proof', [
        variant('What did someone say when it landed? Tell me the face they made.', 'Tell me the joke somebody made when the win landed, and the face that gave them away.', 'Tell me what they said when it landed, and the face that was really relief.', 'The words and the look.'),
        variant('Walk me through the first person you told.', 'Walk me through the first person you roasted with the good news.', 'Tell me the first person you told, and what you left out.', 'Who, and where you were.'),
      ]),
    ],
    petty: [
      step('who', [
        variant('Tell me how you met this person.', 'Tell me the funny way you met the person this roast is about.', 'Tell me how you met them, back before you had to joke about it.', 'Someone you know. Not a public figure.'),
        variant('Tell me what they were like before the small thing.', 'Walk me through the version of them you actually liked.', 'Tell me a regular day with them, before the line got crossed.', 'One easy memory first.'),
      ]),
      step('moment', [
        variant('Walk me through what they did, step by step.', 'Walk me through what {who} did, the way you would tell it at the table.', 'Walk me through what {who} did, the part you joke about so you stay in control.', 'One move, then the next.'),
        variant('Tell me the moment you realized it was not nothing.', 'Tell me the second the tiny crime stopped being funny.', 'Tell me when you knew you were going to write about it.', 'What you saw, then what you felt.'),
      ]),
      step('changed', [
        variant('Take me to where it went down.', 'Take me to the least glamorous place the petty thing happened.', 'Take me to the room where it stopped being a joke.', 'What you could see and hear.'),
        variant('Walk me through the room. What was on the table?', 'Walk me through the props, like you are setting the bit.', 'Tell me what was in your hand when you decided not to laugh it off.', 'A cup, a phone, a chair.'),
      ]),
      step('unsaid', [
        variant("What's still sitting there? Tell me why you haven't moved it.", 'Tell me the souvenir you joke about and still have not thrown out.', 'Tell me the thing you have not moved, and the night you almost did.', 'The object and the reason.'),
        variant('Tell me the sentence you still have not sent to {who}.', 'Tell me the roast you would say to {who} and have not sent.', 'Walk me through the text to {who} that is still sitting in the box.', 'Keep it about the moment. No slurs, no threats.'),
      ]),
    ],
    grateful: [
      step('who', [
        variant('Tell me about the day they showed up for you.', 'Tell me the unlikely day they showed up, the one you would toast.', 'Tell me the day they showed up, before you could laugh about how bad it was.', 'A name and a day.'),
        variant('Tell me about a small kindness you still smile about.', 'Tell me the tiny favor that became the whole joke of gratitude.', 'Tell me a small kindness you have not brushed off.', 'One gesture.'),
      ]),
      step('moment', [
        variant("What did they do that you'll never forget?", 'What did {who} do that sounds small and still makes you grin?', 'What did {who} do that you still cannot joke all the way through?', 'One action, then what you did.'),
        variant('Walk me through what they did, from the door to the moment it landed.', 'Walk me through the help like it is a short comedy.', 'Walk me through what {who} did, and the second you got quiet.', 'Start at the door.'),
      ]),
      step('changed', [
        variant('Take me to the room they walked into.', 'Take me to the unglamorous room where the thank-you actually happened.', 'Take me to the room where it got lighter.', 'What it looked and sounded like.'),
        variant('What did that room look and sound like? Tell me.', 'Tell me the funny detail in that room you still remember.', 'Tell me the sound in that room you have not forgotten.', 'A light, a song, a chair.'),
      ]),
      step('keep', [
        variant('Tell me about something they gave you.', 'Tell me the funny souvenir they handed you.', 'Tell me the thing they gave you that you still cannot talk about lightly.', 'How it came to you.'),
        variant('Walk me through where you keep it now.', 'Walk me through the silly place of honor you gave it.', 'Tell me the spot it lives, and when you last touched it.', 'A shelf, a pocket, a phone.'),
      ]),
    ],
    nostalgic: [
      step('who', [
        variant('Tell me about the funniest person in this memory.', 'Tell me about the person who made that memory a bit.', 'Tell me about the person you miss, the one you joke about so it hurts less.', 'A name, and what they were doing.'),
        variant('Tell me a good afternoon from back then.', 'Walk me through an afternoon that is ridiculous now and was serious then.', 'Tell me an easy afternoon you replay when the room is quiet.', 'One afternoon.'),
      ]),
      step('moment', [
        variant("Walk me through that place like I'm seeing it.", 'Walk me through the place like you are giving a tour of the bit.', 'Walk me through the room you miss, one thing at a time.', 'The door, the light, the noise.'),
        variant('Take me there. What did it smell like?', 'Take me to the snack, the cologne, the street.', 'Tell me the smell that puts you back there before you are ready.', 'One smell is enough.'),
      ]),
      step('changed', [
        variant('What sound takes you right back there? Tell me about it.', 'Tell me the goofy sound that still drops you into that year.', 'Tell me the sound you still wait for, even when you joke that you do not.', 'A song, a laugh, a door.'),
        variant('Tell me about an object from then that you still have.', 'Tell me the junk from then that you refuse to throw out.', 'Tell me the object you kept, and the day you almost let it go.', 'How it survived.'),
      ]),
      step('keep', [
        variant('Tell your younger self what happens next.', 'Tell your past self the punchline they have not lived yet.', 'Tell that version of you what happens next, without the joke.', 'One sentence, in your words.'),
        variant('Walk me through the moment you knew that time was over.', 'Walk me through the last funny minute before it changed.', 'Tell me the moment you knew you could not get that room back.', 'Where you were standing.'),
      ]),
    ],
    angry: [
      step('who', [
        variant('Tell me what things were like before the line got crossed.', 'Tell me the regular days before this turned into a roast.', 'Tell me what it was like before you had to stop laughing it off.', 'A person you know, or a situation. Not a public figure.'),
        variant('Tell me about a regular day with them, before you were angry.', 'Walk me through a normal day you would still joke about.', 'Tell me an easy hour from before, so the song knows what changed.', 'One regular hour.'),
      ]),
      step('moment', [
        variant('Walk me through what happened.', 'Walk me through what happened, plain enough to be funny and sharp.', 'Walk me through what happened, the part you are done joking away.', 'One scene, in order. No threats.'),
        variant('Tell me the moment it set you off.', 'Tell me the second it got absurd.', 'Tell me the moment you got quiet.', 'What you saw first.'),
      ]),
      step('changed', [
        variant('Take me to where you were.', 'Take me to the place it got ridiculous.', 'Take me to the place you got quiet and angry.', 'What the room was doing.'),
        variant('What did that place look and sound like right then?', 'Tell me the sound in the room when you clocked it.', 'Tell me what you could hear when you stopped excusing it.', 'A voice, a door, a song.'),
      ]),
      step('unsaid', [
        variant('What do you want them to finally hear? Tell me when you first felt it.', 'Tell me the sharp true line, and the day you first thought it.', 'Tell me the sentence under the joke, and when it showed up.', 'No threats, no slurs.'),
        variant('Walk me through the sentence you have not said out loud yet.', 'Walk me through the bar you would say to their face and have not.', 'Tell me the sentence you need heard, and what has stopped you.', 'One sentence. Keep it fair.'),
      ]),
    ],
    mindset: [
      step('story', [
        variant('Tell me about one real person this touches.', 'Tell me about the one person who makes this story a scene, not a speech.', 'Tell me about the person carrying this, before you make a point.', 'A person, not a statistic.'),
        variant('Tell me a day in their life that makes this real.', 'Walk me through a regular day of theirs that the joke has to respect.', 'Tell me an ordinary hour of theirs that the headline skips.', 'Morning, work, the ride home.'),
      ]),
      step('who', [
        variant("Take me to where it's happening.", 'Take me to the place the joke is not allowed to flatten.', 'Take me to the place this is actually happening.', 'A street, a kitchen, a screen.'),
        variant('Walk me through the street, the room, or the screen.', 'Walk me through it like you are showing a friend the bit and the truth.', 'Walk me through what a person there would notice first.', 'One block, one room, one tab.'),
      ]),
      step('keep', [
        variant('Tell me a small thing you saw that made it real for you.', 'Tell me the small thing you saw that keeps this from turning into a slogan.', 'Tell me the small thing you saw that you will not smooth over.', 'A detail a camera could catch.'),
        variant("What's one detail a camera would catch? Tell me when you saw it.", 'Tell me the prop that makes the point without a speech.', 'Tell me the detail you refuse to turn into a slogan, and where you were.', 'When you saw it.'),
      ]),
      step('say', [
        variant('What would you say to them face to face?', 'What would you say to {who} that tells the truth and still lands?', 'What would you say to {who} with no joke in the way?', 'One sentence, like you are in the room.'),
        variant('Walk me through the moment you knew what you wanted the song to say.', 'Tell me the moment the punchline and the point showed up together.', 'Tell me the moment you knew the joke was not the whole song.', 'Where you were when it hit.'),
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
        'You said ' + quoted + '. Tell me the story behind the joke you would still not say out loud.',
        'You wrote ' + quoted + '. Walk me through what makes that funny and sad at the same time.',
      ];
    }
    if (session.mode === 'funny') {
      return [
        'You said ' + quoted + '. Tell me the story the punchline is hiding.',
        'You wrote ' + quoted + '. Walk me through the silly detail you left out.',
      ];
    }
    if (session.mode === 'madlibs') {
      return [
        'You filled ' + quoted + '. Tell me what else was in that scene.',
        'You wrote ' + quoted + '. Walk me through the other word that has to sit next to it.',
      ];
    }
    return [
      'You said ' + quoted + '. Tell me what happened right after that.',
      'You wrote ' + quoted + '. Walk me through what a camera would catch.',
    ];
  }

  function remember(session, id, text) {
    var value = storyAnswer(text);
    if (!value) return;
    session.saved.push({
      id: id || 'note',
      ask: session.pending ? session.pending.ask : (current(session) ? current(session).ask : ''),
      text: value,
      depth: session.pending ? session.pending.depth : session.index,
    });
  }

  function askAnother(session) {
    var draft = storyAnswer(session.draft);
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
    var draft = storyAnswer(session.draft);
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
    STORY_MAX: STORY_MAX,
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
