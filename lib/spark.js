'use strict';

/**
 * What's hot spark. Sample items are original writing topics, not news reports.
 * A live feed is used only when SPARK_FEEDS is set. No counts are invented.
 * News lanes are evergreen frames to write from. They are not breaking news,
 * and they do not claim that a real event happened.
 *
 * Browse levels: category, then a short topic, then a headline frame.
 * Spark ideas (flip, answer song, cause) open only after a headline.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparkCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var SAMPLE_LABEL = 'Topics to write from. Not breaking news. Sample, no live source is connected.';
  var LANES = [
    { id: 'trending', label: 'Trending' },
    { id: 'news-world', label: 'News · world' },
    { id: 'news-music', label: 'News · music' },
    { id: 'news-movies', label: 'News · movies' },
    { id: 'news-regional', label: 'News · regional' },
    { id: 'causes', label: 'Causes' },
    { id: 'mindset', label: 'Mindset' },
  ];
  var GROUPS = [
    { id: 'trending', label: 'Trending', lanes: ['trending'] },
    { id: 'news', label: 'News', lanes: ['news-world', 'news-music', 'news-movies', 'news-regional'] },
    { id: 'causes', label: 'Causes', lanes: ['causes'] },
    { id: 'mindset', label: 'Mindset', lanes: ['mindset'] },
  ];
  var BROWSE = {
    pickTopic: 'Pick a topic. A starter sentence lands in the box, and you can change every word.',
    pickHeadline: 'Pick a headline frame. Then the song ideas open, like flip the angle or an answer song.',
    topics: 'Topics',
    headlines: 'Headline frames',
    daily: 'Daily spark',
    empty: 'Nothing in this lane right now.',
    news: 'Topics to write from. Not breaking news.',
    search: 'Search topics',
    searchEmpty: 'No topics match that search.',
    showMore: 'Show more',
  };
  var ASK = {
    lead: 'You can start writing now, or answer a few questions first.',
    optional: 'These questions are optional. The more you put in, the more human the draft feels. Leave one blank and it stays out of the lyric.',
    feel: 'How do you feel about this?',
    feelHint: 'Mad, tender, curious, done with it',
    story: 'Any personal experience with it?',
    storyHint: 'A real moment, if you have one',
    keep: 'What do you want the song to hold onto?',
    keepHint: 'A detail, a name, a sound',
    start: 'Start writing',
    startAway: 'Start writing in Song Helper',
  };

  var TRAGEDY_RE = /\b(killed|killing|murder|shot dead|shooting|suicide|overdose|funeral|massacre|bombing|war crime|died|death toll|tragedy|earthquake)\b/i;
  var FLIP = 'Write it from the person beside you, not from a speech.';
  var ANSWER = 'An answer song from someone this leaves out.';
  var CAUSE_LINE = 'A song can name this cause. Keep it neutral: no party, no candidate, and no invented total.';

  var SAMPLES = [];

  function add(lane, slug, topic, rows, cause) {
    rows.forEach(function (row, index) {
      SAMPLES.push({
        id: lane + '-' + slug + '-' + index,
        lane: lane,
        topic: topic,
        headline: row[0],
        title: row[1],
        detail: row[2],
        flip: FLIP,
        answer: ANSWER,
        cause: cause || '',
      });
    });
  }

  add('trending', 'single', 'A new single', [
    ['Heard it once', 'The single that followed me home', 'I heard it once and it followed me home.'],
    ['Still in my head', 'It is still playing when I lock the door', 'It is still in my head when I lock the door.'],
  ]);
  add('trending', 'tour', 'A tour', [
    ['Coming through town', 'They are coming through my city', 'They are coming through town and I already know who I would take.'],
    ['Who I would take', 'The person I would stand with', 'I already know who I would take, and I have not asked them yet.'],
  ]);
  add('trending', 'sound', 'A viral sound', [
    ['The sound in every pocket', 'Everyone has the same sound', 'Everybody has the same sound in their pocket and I want my own.'],
    ['I want my own', 'A sound that is mine', 'I want a sound that is mine, not the one already in every pocket.'],
  ]);
  add('trending', 'local', 'A local show', [
    ['Name on the list', 'My name is on the list', 'The room is small, the lights are late, and my name is on the list.'],
    ['Small room, late lights', 'A small room and late lights', 'The lights are late and the room is small enough to hear my breath.'],
  ]);
  add('trending', 'reunion', 'A reunion', [
    ['Same room again', 'We are in the same room again', 'We have not been in the same room in years and the song still knows us.'],
    ['The song still knows', 'The song remembers us', 'The song still knows us, even if we forgot the words.'],
  ]);
  add('trending', 'debut', 'A debut', [
    ['First thing with my name', 'The first thing with my name on it', 'This is the first thing with my name on it and my hands are shaking.'],
    ['Hands still shaking', 'My hands have not settled', 'My hands are still shaking and the song is already out of them.'],
  ]);
  add('trending', 'remix', 'A remix', [
    ['The original underneath', 'I can still hear the original', 'They took the song apart and I can still hear the original underneath.'],
    ['Taken apart', 'The song taken apart', 'Someone took it apart, and the first version is still in there.'],
  ]);
  add('trending', 'farewell', 'A farewell show', [
    ['Nobody says last', 'Nobody wants to say last', 'The last night in this room, and nobody wants to say last.'],
    ['Last night in the room', 'The last night we get this room', 'It is the last night in this room, and we are all pretending it is a regular one.'],
  ]);
  add('trending', 'collab', 'A collab', [
    ['Two voices, one hook', 'Two voices on one hook', 'Two voices, one hook, and I am trying not to step on their line.'],
    ['Do not step on the line', 'Leave room for their line', 'I am trying not to step on their line, and they are leaving room for mine.'],
  ]);
  add('trending', 'video', 'A music video', [
    ['Camera on a feeling', 'A camera pointed at a feeling', 'They pointed a camera at a feeling I usually keep off screen.'],
    ['Kept off screen', 'The part I keep off screen', 'The part I keep off screen is the part they want in the frame.'],
  ]);
  add('trending', 'festival', 'A festival', [
    ['The set I cannot miss', 'One set I cannot miss', 'Too many stages, one wristband, and the set I cannot miss.'],
    ['One wristband', 'One wristband, too many stages', 'One wristband, too many stages, and I still have to pick a direction.'],
  ]);
  add('trending', 'listen', 'A first listen', [
    ['Watched their face', 'I watched their face, not the speaker', 'I played it for one person and watched their face instead of the speaker.'],
    ['Played it for one person', 'The first person who heard it', 'I played it for one person, and their face told me more than the speakers did.'],
  ]);

  add('news-world', 'rent', 'Rent and wages', [
    ['Rent outruns the paycheck', 'The month the rent moved first', 'I did the math on the kitchen table and the rent won.'],
    ['Math on the table', 'The math on the kitchen table', 'The math is on the table, and I already know how it ends.'],
  ]);
  add('news-world', 'grocery', 'The grocery bill', [
    ['A lighter cart', 'The cart got lighter', 'The cart got lighter and the total did not.'],
    ['The total stayed high', 'The total did not come down', 'I put things back, and the total still looked like a dare.'],
  ]);
  add('news-world', 'heat', 'A heat stretch', [
    ['The night will not cool', 'A night that will not cool off', 'The fan is doing all it can and the night will not cool.'],
    ['Fan on the floor', 'The fan is on the floor', 'The fan is on the floor and the room is still holding the day.'],
  ]);
  add('news-world', 'housing', 'Housing', [
    ['Listings ask for more', 'Every listing asks for more', 'Every listing asks for more than the last place I left.'],
    ['The place I left', 'More than the place I left', 'The place I left was not enough, and the next one asks for more.'],
  ]);
  add('news-world', 'shift', 'The night shift', [
    ['Home at sunrise', 'I get home at sunrise', 'I come home when the street is starting its day.'],
    ['The street starts its day', 'The street is starting without me', 'The street starts its day as I am finally turning the key.'],
  ]);
  add('news-world', 'power', 'A power cut', [
    ['The block went dark', 'The block went dark at once', 'The block went dark and we met in the hallway with our phones.'],
    ['Hallway with phones', 'Phones lighting the hallway', 'We stood in the hallway and let the phones be the lights.'],
  ]);
  add('news-world', 'school', 'School days', [
    ['Bell and backpack', 'The bell and the backpack', 'The bell, the backpack, and the version of me that still fits in that hallway.'],
    ['The hallway version', 'The version of me in that hallway', 'There is a version of me that still fits in that hallway.'],
  ]);
  add('news-world', 'block', 'A changing block', [
    ['A different name', 'The corner has a different name', 'The place on the corner has a different name now.'],
    ['What the block kept', 'What the block decided to keep', 'The block changed its signs and kept the same cracks in the sidewalk.'],
  ]);
  add('news-world', 'commute', 'The commute', [
    ['Same train, same seat', 'The same train and the same seat', 'Same train, same seat, a different song in the headphones.'],
    ['A different song', 'A different song in the headphones', 'The seat is the same and the song in my headphones is not.'],
  ]);
  add('news-world', 'clinic', 'A clinic wait', [
    ['Number on a slip', 'A number on a slip of paper', 'I have the number on a slip of paper and the clock will not move.'],
    ['The clock will not move', 'Waiting on a clock that will not move', 'The clock will not move, and my number is still a rumor.'],
  ]);
  add('news-world', 'vote', 'A local vote', [
    ['Signs on the lawns', 'Signs on the lawns, no speech from me', 'The signs are on the lawns and I am still deciding what I owe the block.'],
    ['What I owe the block', 'Deciding what I owe the block', 'I am still deciding what I owe the block, and the signs are not going to tell me.'],
  ]);
  add('news-world', 'care', 'Childcare', [
    ['When the day runs long', 'Someone has to be there', 'Someone has to be there when the day runs long, and today it is me.'],
    ['Today it is me', 'Today the long day is mine', 'The day ran long, and today the one who stays is me.'],
  ]);

  add('news-music', 'album', 'Album week', [
    ['The record is out', 'The record is out in the world', 'The record is out and I am pretending I am not checking the page.'],
    ['Pretending not to look', 'Pretending I am not looking', 'I am pretending not to look, and I have already looked.'],
  ]);
  add('news-music', 'tour', 'Tour season', [
    ['My city is on it', 'My city made the list', 'The dates are up and my city is on the list.'],
    ['Dates on the wall', 'The dates are on the wall', 'I put the dates on the wall like they were already a plan.'],
  ]);
  add('news-music', 'festival', 'Festival season', [
    ['One name circled twice', 'I circled one name twice', 'The lineup came out and I circled one name twice.'],
    ['Lineup on the fridge', 'The lineup is on the fridge', 'The lineup is on the fridge, and one name has a circle around it.'],
  ]);
  add('news-music', 'reunion', 'A reunion tour', [
    ['Back in the same photo', 'They are back in the same photo', 'They are back in the same photo and I remember the first one.'],
    ['I remember the first', 'I remember the first photo', 'I remember the first photo, before any of us knew there would be another.'],
  ]);
  add('news-music', 'debut', 'A debut record', [
    ['Someone finally said it', 'A first record that finally says it', 'Someone\'s first record, and it sounds like they finally said it.'],
    ['A first record', 'The first record with their name', 'A first record can sound like a person finally telling the truth.'],
  ]);
  add('news-music', 'hometown', 'Hometown show', [
    ['Before the posters', 'The room that knew them first', 'They came back to the room that knew them before the posters.'],
    ['The room that knew them', 'Before anyone printed a poster', 'The room knew them before the posters did.'],
  ]);
  add('news-music', 'split', 'A band splits', [
    ['Songs keep their names', 'The songs still have all their names', 'The group is done and the songs still have all of their names.'],
    ['The group is done', 'The group is done, the songs are not', 'The group is done, and the songs did not get the memo.'],
  ]);
  add('news-music', 'radio', 'Radio day', [
    ['Nobody changed the station', 'Nobody reached for the dial', 'It came on in the car and nobody changed the station.'],
    ['On in the car', 'It came on in the car', 'It came on in the car, and for once nobody talked over it.'],
  ]);

  add('news-movies', 'opening', 'Opening night', [
    ['Tickets from weeks ago', 'Tickets we bought weeks ago', 'We bought the tickets weeks ago and I still do not know what to wear.'],
    ['I do not know what to wear', 'Still deciding what to wear', 'The tickets are old news in my pocket and I still do not know what to wear.'],
  ]);
  add('news-movies', 'sequel', 'A sequel', [
    ['The ending opened again', 'They opened the ending again', 'They brought the story back and I am not sure I wanted the ending opened.'],
    ['Brought the story back', 'The story came back', 'They brought the story back, and I had already made peace with the ending.'],
  ]);
  add('news-movies', 'awards', 'Awards season', [
    ['Watched it from the couch', 'I watched the work from the couch', 'People in good clothes talking about work I watched from the couch.'],
    ['Good clothes, real work', 'Good clothes around real work', 'Good clothes, real work, and I am still on the couch where I met it.'],
  ]);
  add('news-movies', 'score', 'A soundtrack', [
    ['The song stayed after', 'The song stayed after the scene', 'The scene ended and the song stayed in the parking lot.'],
    ['Out in the parking lot', 'Still hearing it in the parking lot', 'I was in the parking lot and the song had not ended.'],
  ]);
  add('news-movies', 'cut', 'A director cut', [
    ['A longer version', 'A longer version of a movie I knew', 'A longer version of a movie I thought I already knew.'],
    ['I thought I knew it', 'I thought I already knew the movie', 'I thought I knew it, and the longer cut had a scene I had never met.'],
  ]);
  add('news-movies', 'home', 'A home premiere', [
    ['Same night, different couches', 'The same night on different couches', 'It landed for everyone on the same night, on different couches.'],
    ['Landed for everyone', 'It landed for everyone at once', 'It landed for everyone, and we were not in the same room.'],
  ]);
  add('news-movies', 'credits', 'The credits', [
    ['Stayed through the names', 'I stayed through the names', 'I stayed through the names because leaving felt rude.'],
    ['Leaving felt rude', 'Leaving before the names felt rude', 'Leaving felt rude, so I stayed for people I will never meet.'],
  ]);
  add('news-movies', 'remake', 'A remake', [
    ['Someone else\'s voice', 'Told again in someone else\'s voice', 'They told a story I grew up with, in someone else\'s voice.'],
    ['A story I grew up with', 'The story I grew up inside', 'It is a story I grew up with, and the voice is not the one I remember.'],
  ]);

  add('news-regional', 'neighborhood', 'The neighborhood', [
    ['The block already knows', 'Everybody on the block already knows', 'Everybody on this block knows the story, and we still tell it.'],
    ['We still tell it', 'We tell the story anyway', 'We already know it, and we still tell it like it is new.'],
  ]);
  add('news-regional', 'festival', 'A street festival', [
    ['Street closed for music', 'The street is closed for music', 'The street is closed for music and the food smoke is the map.'],
    ['Follow the food smoke', 'The food smoke is the map', 'If you get lost, follow the food smoke back to the music.'],
  ]);
  add('news-regional', 'game', 'The Friday game', [
    ['Lights on at the field', 'The lights are on at the field', 'The lights are on at the field and the whole town is in the stands.'],
    ['Whole town in the stands', 'The whole town is in the stands', 'The whole town is in the stands, and the field is the only quiet place.'],
  ]);
  add('news-regional', 'mural', 'A new mural', [
    ['A face on the wall', 'A wall I know has a face now', 'A wall I walked past for years has a face on it now.'],
    ['Years of walking past', 'I walked past that wall for years', 'I walked past that wall for years, and now it looks back.'],
  ]);
  add('news-regional', 'market', 'The farmers market', [
    ['Saturday paper bags', 'Saturday morning and paper bags', 'Saturday morning, paper bags, and the person who saves the peaches.'],
    ['They saved the peaches', 'Someone saved the peaches', 'They saved the peaches, which means they saved a small kindness for me.'],
  ]);
  add('news-regional', 'library', 'The library', [
    ['A free room', 'A free room with a free card', 'A free room, a free card, and a table by the window.'],
    ['Table by the window', 'The table by the window', 'The table by the window is the best seat I do not have to pay for.'],
  ]);
  add('news-regional', 'hall', 'City hall', [
    ['The meeting runs long', 'The meeting runs long again', 'The meeting runs long and the microphone still works.'],
    ['The microphone still works', 'The microphone is still on', 'The microphone still works, which means somebody still has the floor.'],
  ]);
  add('news-regional', 'party', 'A block party', [
    ['Speakers in a driveway', 'Speakers set in a driveway', 'Speakers in a driveway and every cousin in the same yard.'],
    ['Cousins in the yard', 'Every cousin in the same yard', 'Every cousin is in the same yard, and the speakers know the words.'],
  ]);

  [
    ['climate', 'Environment and climate', 'The weather is not a backdrop anymore. It is in the song.', 'Weather in the song', 'Not a backdrop'],
    ['mental', 'Mental health', 'I can say the hard day out loud without turning it into a lesson.', 'Say the hard day', 'Not a lesson'],
    ['home', 'Homelessness', 'A person on my block has a name, and the song can learn it.', 'A person with a name', 'On my block'],
    ['animals', 'Animal welfare', 'The ones who cannot file a complaint still count in the chorus.', 'They still count', 'No complaint to file'],
    ['school', 'Education', 'A desk, a teacher, and a kid who stays when the bell is done.', 'After the bell', 'A desk and a teacher'],
    ['race', 'Racial justice', 'The song can tell the truth about a system without naming a party.', 'Tell the truth', 'No party in the lyric'],
    ['women', 'Women\'s rights', 'Her name stays in the verse, and the choice stays hers.', 'Her name stays', 'The choice stays hers'],
    ['lgbtq', 'LGBTQ+ rights', 'They get to be in the song as themselves, not as a debate.', 'In the song as themselves', 'Not as a debate'],
    ['veterans', 'Veterans', 'They came home to a quiet room and the song can sit with that.', 'Home to a quiet room', 'Sit with that'],
    ['recovery', 'Addiction recovery', 'One clean morning is a whole verse, and nobody has to explain the calendar.', 'One clean morning', 'No calendar to explain'],
    ['hunger', 'Hunger', 'The fridge light is the loudest thing in the kitchen.', 'The fridge light', 'Loudest thing in the kitchen'],
    ['immigration', 'Immigration', 'A suitcase, a new street, and a name people keep asking them to repeat.', 'A name they repeat', 'Suitcase on a new street'],
    ['guns', 'Gun violence', 'The block learned a siren by heart, and the song refuses to glorify it.', 'The block learned a siren', 'No glory in it'],
    ['health', 'Healthcare', 'The waiting room has a screen and nobody is watching it.', 'Nobody is watching', 'A room full of waiting'],
    ['water', 'Clean water', 'The tap should be ordinary. In this song, it is the whole point.', 'The tap should be ordinary', 'Water is the point'],
    ['domestic', 'Domestic violence', 'The lock on the inside of the door is a character in the song.', 'The lock on the door', 'Inside the apartment'],
    ['foster', 'Foster care', 'A kid with a bag by the door still deserves a chorus that stays.', 'A bag by the door', 'A chorus that stays'],
    ['disability', 'Disability rights', 'Access is not a favor. The song can say that without pity.', 'Access is not a favor', 'Without pity'],
    ['elder', 'Elder care', 'Their stories are long and the song does not talk over them.', 'Do not talk over them', 'Stories that are long'],
    ['literacy', 'Literacy', 'The first page they read on their own can be the hook.', 'The first page', 'Read on their own'],
    ['arts', 'Arts access', 'Every kid should get an instrument before someone tells them no.', 'An instrument first', 'Before someone says no'],
    ['mentor', 'Youth mentorship', 'One adult who stays is a whole bridge.', 'One adult who stays', 'That can be the bridge'],
    ['housing', 'Fair housing', 'A key that actually turns can be the whole chorus.', 'A key that actually turns', 'A door of their own'],
    ['libraries', 'Public libraries', 'A room that asks for nothing is worth a song.', 'A room that asks for nothing', 'Keep the doors open'],
    ['ocean', 'Ocean health', 'The water we swim in is also the water we owe.', 'The water we owe', 'What we swim in'],
    ['workers', 'Worker safety', 'They should come home with the same body they left with.', 'Come home whole', 'The shift should end safe'],
    ['peace', 'Peace', 'A quiet street is not nothing. It can be the whole record.', 'A quiet street', 'Not nothing'],
    ['second', 'Second chances', 'A past should not be the only song a person gets to sing.', 'Not the only song', 'Room to start again'],
  ].forEach(function (row) {
    add('causes', row[0], row[1], [
      [row[3], row[1] + ' in the first verse', row[2]],
      [row[4], 'A second look at ' + row[1].toLowerCase(), 'The song can stay with ' + row[1].toLowerCase() + ' and still leave room for my own line.'],
    ], CAUSE_LINE);
  });

  [
    ['belief', 'Self-belief', 'I keep waiting for proof that I am allowed to start.', 'Waiting on proof', 'The mirror is not the judge I keep treating it as.', 'The mirror is not the judge'],
    ['discipline', 'Discipline', 'I said I would show up, and the morning is still dark.', 'Morning is still dark', 'The work is boring and I am doing it anyway.', 'Doing it anyway'],
    ['start', 'Fear of starting', 'The page is blank because starting would make it real.', 'Starting makes it real', 'I keep sharpening the pencil so I do not have to write.', 'Sharpening the pencil'],
    ['compare', 'Comparison', 'I keep measuring myself against someone who is not in the room.', 'Someone not in the room', 'Their highlight is not my homework.', 'Not my homework'],
    ['patience', 'Patience', 'The thing I want is growing slower than my nerves.', 'Slower than my nerves', 'I check the door again, and it is still just a door.', 'Still just a door'],
    ['burnout', 'Burnout', 'I love the work and I cannot find the door out of it.', 'Cannot find the door', 'Rest feels like quitting, and I know that is a lie.', 'Rest is not quitting'],
    ['thanks', 'Gratitude', 'I can name three ordinary things in this room that held me up.', 'What held me up', 'Thank you is a whole verse if I mean a person.', 'Thank you is a verse'],
    ['bounds', 'Boundaries', 'I can love you and still lock the hour that is mine.', 'The hour that is mine', 'No is a complete sentence and I am learning the melody.', 'No is a sentence'],
    ['over', 'Starting over', 'The old key does not fit, so I am learning the new door.', 'Learning the new door', 'I packed light on purpose.', 'Packed on purpose'],
    ['money', 'Money mindset', 'I can talk about the bill without making it my worth.', 'The bill is not my worth', 'Enough is a feeling I get to define.', 'I get to define enough'],
    ['fail', 'Failure', 'I missed, and the miss is not the whole song.', 'The miss is not the song', 'I can say what happened without a speech about grit.', 'No speech about grit'],
    ['back', 'Comeback', 'I am back in the room that watched me leave.', 'Back in the room', 'The second try gets a cleaner hook.', 'A cleaner hook'],
    ['imposter', 'Imposter feelings', 'They clapped and I still felt like I snuck in.', 'I still felt like I snuck in', 'My name was on the list and I did not believe it.', 'My name was on the list'],
    ['perfect', 'Perfectionism', 'I sanded the line until it had no fingerprints left.', 'No fingerprints left', 'Done is kinder than perfect, and I do not trust it yet.', 'Kinder than perfect'],
    ['rest', 'Rest', 'I put the phone in another room and the quiet was loud.', 'The quiet was loud', 'A day off is not a debt.', 'Not a debt'],
    ['focus', 'Focus', 'One tab, one line, and the rest can wait outside.', 'The rest can wait', 'I came back to the same bar and finished it.', 'Finished the same bar'],
    ['courage', 'Courage', 'My voice shook and I sang the note anyway.', 'Sang it anyway', 'Brave can be a small door that I open.', 'A small door'],
    ['loose', 'Letting go', 'I am setting it down without calling that losing.', 'Setting it down', 'The shelf is lighter. So am I, almost.', 'The shelf is lighter'],
    ['confident', 'Confidence', 'I walked in like the room had a chair for me.', 'A chair for me', 'I can take up the hook without apologizing.', 'Without apologizing'],
    ['talk', 'Self-talk', 'The voice in my head needs a kinder writer.', 'A kinder writer', 'I would not say that sentence to a friend.', 'Not to a friend'],
    ['habits', 'Habits', 'Same hour, same corner, a promise I can keep.', 'A promise I can keep', 'I stacked a small day on top of a small day.', 'Small day on a small day'],
    ['later', 'Procrastination', 'I cleaned the desk so I would not have to start.', 'Cleaned the desk instead', 'Later is a room I keep decorating.', 'The room called later'],
    ['no', 'Rejection', 'They said no, and the song does not have to shrink.', 'The song does not shrink', 'A closed door is not a verdict on my whole life.', 'Not my whole life'],
    ['lone', 'Loneliness', 'The room is full and I am still looking for my person.', 'Looking for my person', 'I ate across from an empty chair.', 'An empty chair'],
    ['forgive', 'Forgiveness', 'I can put the weight down without pretending it was light.', 'It was not light', 'Forgiven is not the same as forgotten, and both can sing.', 'Not the same as forgotten'],
    ['ambition', 'Ambition', 'I want the big room and I want to recognize myself in it.', 'Recognize myself there', 'Hungry can be holy if it does not eat me.', 'Do not let it eat me'],
    ['humble', 'Humility', 'I can be proud and still ask who helped me hold the note.', 'Who helped me hold it', 'The applause is loud. The credit is wider.', 'The credit is wider'],
    ['steady', 'Consistency', 'I showed up on a day when nobody was counting.', 'Nobody was counting', 'Boring progress is still progress.', 'Still progress'],
    ['finish', 'Fear of finishing', 'If I end it, I have to let people hear it.', 'Let people hear it', 'The last line is the one I keep rewriting.', 'Rewriting the last line'],
    ['help', 'Asking for help', 'I said I need you, and the ceiling did not fall.', 'The ceiling stayed up', 'Help is not a smaller version of me.', 'Not a smaller me'],
    ['envy', 'Jealousy', 'Their win sat in my chest like it was mine to lose.', 'Like it was mine', 'I can clap and still tell the truth to myself later.', 'Clap and tell the truth'],
    ['worth', 'Self-worth', 'I am not a tab that has to stay open to matter.', 'I do not have to stay open', 'Worthy showed up before any prize did.', 'Before any prize'],
    ['motion', 'Momentum', 'One finished line made the next one less afraid.', 'The next line', 'I do not want to break the streak of showing up.', 'Do not break the streak'],
    ['doubt', 'Doubt', 'The doubt talks first. I can let the verse answer.', 'Let the verse answer', 'I am allowed to begin before I feel sure.', 'Before I feel sure'],
    ['show', 'Showing up', 'Half ready still counts if I am in the room.', 'Half ready counts', 'I came anyway, and that is the lyric.', 'I came anyway'],
    ['sayno', 'Saying no', 'I left the plan that needed me to disappear.', 'I left the plan', 'My no saved a yes I actually mean.', 'A yes I mean'],
    ['wins', 'Small wins', 'I finished the verse. That can be the celebration.', 'That can be enough', 'A small win still gets a drum.', 'Still gets a drum'],
    ['trust', 'Trust', 'I handed them the verse and did not hover.', 'I did not hover', 'Trust is a second key on the same ring.', 'A second key'],
    ['self', 'Identity', 'I am more than the job that knows my schedule.', 'More than the job', 'The name I chose gets the hook.', 'The name I chose'],
    ['hope', 'Hope', 'Hope is not a speech. It is the light I left on.', 'The light I left on', 'I can want a future without faking today.', 'Without faking today'],
    ['shame', 'Shame', 'I can tell it without asking the song to punish me.', 'Do not punish me', 'Shame talks in a whisper and I am done hiding the line.', 'Done hiding the line'],
    ['enough', 'Enough', 'I can stop before I empty myself out.', 'Before I empty out', 'Enough is a place, not a prize.', 'A place, not a prize'],
    ['step', 'The first step', 'I only have to do the next honest thing.', 'The next honest thing', 'The staircase does not need my whole plan.', 'Not my whole plan'],
    ['promise', 'Keeping a promise', 'I told myself tomorrow, and tomorrow is this morning.', 'Tomorrow is this morning', 'A promise to myself still counts when nobody claps.', 'It still counts'],
    ['grief', 'Grief', 'The chair is empty and I still set a glass down.', 'The empty chair', 'I still set a place for a voice that is quiet now.', 'A place still set'],
    ['joy', 'Joy', 'Joy does not have to be loud to be the chorus.', 'Joy can be the chorus', 'I let a good minute last.', 'Let a good minute last'],
  ].forEach(function (row) {
    add('mindset', row[0], row[1], [
      [row[3], row[1] + ' in my own words', row[2]],
      [row[5], 'Another way into ' + row[1].toLowerCase(), row[4]],
    ]);
  });

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function dayIndex(now) {
    var t = now ? new Date(now) : new Date();
    var start = Date.UTC(t.getUTCFullYear(), 0, 0);
    var day = Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - start) / 86400000);
    return ((day % SAMPLES.length) + SAMPLES.length) % SAMPLES.length;
  }

  function decorate(row) {
    var title = clean(row.title);
    return {
      id: row.id,
      lane: row.lane,
      topic: clean(row.topic),
      headline: clean(row.headline || title),
      title: title,
      detail: row.detail,
      flip: row.flip,
      answer: row.answer,
      cause: row.cause || '',
      sourceLabel: row.sourceLabel || SAMPLE_LABEL,
      sourceUrl: row.sourceUrl || '',
      sample: row.sample !== false,
    };
  }

  function samples() {
    return SAMPLES.map(decorate);
  }

  function dailySpark(now) {
    var row = decorate(SAMPLES[dayIndex(now)]);
    row.daily = true;
    row.dailyNote = 'Daily spark. This pick is a sample rotation, not a live chart.';
    return row;
  }

  function byLane(lane) {
    var id = String(lane || '').trim();
    return samples().filter(function (row) { return !id || row.lane === id; });
  }

  function tragedy(text) {
    return TRAGEDY_RE.test(String(text || ''));
  }

  function itemText(item) {
    if (!item) return '';
    return [item.topic, item.headline, item.title, item.detail, item.flip, item.answer, item.cause].join(' ');
  }

  function inLanes(items, lanes) {
    var list = (items || []).filter(function (item) {
      return item && !tragedy(itemText(item));
    });
    if (!lanes || !lanes.length) return list;
    return list.filter(function (item) { return lanes.indexOf(item.lane) !== -1; });
  }

  function topicsFor(items, lanes) {
    var seen = {};
    var out = [];
    inLanes(items, lanes).forEach(function (item) {
      var label = clean(item.topic);
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push({ id: label, label: label, lane: item.lane });
    });
    return out;
  }

  function headlinesFor(items, lanes, topic) {
    var want = clean(topic);
    if (!want) return [];
    var seen = {};
    var out = [];
    inLanes(items, lanes).forEach(function (item) {
      if (clean(item.topic) !== want) return;
      var label = clean(item.headline || item.title);
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push({ id: label, label: label, topic: want, lane: item.lane });
    });
    return out;
  }

  function sparksFor(items, lanes, topic, headline) {
    var wantTopic = clean(topic);
    var wantHeadline = clean(headline);
    if (!wantTopic || !wantHeadline) return [];
    return inLanes(items, lanes).filter(function (item) {
      return clean(item.topic) === wantTopic && clean(item.headline || item.title) === wantHeadline;
    });
  }

  function starterFor(items, lanes, topic, headline) {
    var wantTopic = clean(topic);
    if (!wantTopic) return null;
    var rows = inLanes(items, lanes).filter(function (item) {
      return clean(item.topic) === wantTopic;
    });
    var wantHeadline = clean(headline);
    if (wantHeadline) {
      var exact = rows.filter(function (item) {
        return clean(item.headline || item.title) === wantHeadline;
      });
      if (exact[0]) return exact[0];
    }
    return rows[0] || null;
  }

  function nextSeedValue(current, previous, next) {
    var now = clean(current);
    var prior = clean(previous);
    var incoming = clean(next);
    if (!incoming) return now;
    if (!now) return incoming;
    if (prior && (now === prior || now === prior.slice(0, incoming.length))) return incoming;
    return now;
  }

  function pack(now) {
    return {
      ok: true,
      demo: true,
      notice: SAMPLE_LABEL,
      lanes: LANES,
      groups: GROUPS,
      daily: dailySpark(now),
      items: samples(),
    };
  }

  return {
    ASK: ASK,
    BROWSE: BROWSE,
    GROUPS: GROUPS,
    LANES: LANES,
    SAMPLE_LABEL: SAMPLE_LABEL,
    byLane: byLane,
    dailySpark: dailySpark,
    headlinesFor: headlinesFor,
    nextSeedValue: nextSeedValue,
    pack: pack,
    samples: samples,
    sparksFor: sparksFor,
    starterFor: starterFor,
    topicsFor: topicsFor,
    tragedy: tragedy,
  };
}));
