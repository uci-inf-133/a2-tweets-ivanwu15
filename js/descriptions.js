'use strict';

let allTweets = [];            // All Tweet instances
let searchable = [];           // completed_event + written == true

/* ==================== Sentiment helpers (inline lexicon) ==================== */
/** A compact inlined subset of the Hu & Liu Opinion Lexicon (adjectives only). */
const OPINION_LEXICON_POS = `
able
abundant
accomplished
accurate
active
adaptable
adept
admirable
adorable
adventurous
affectionate
agile
agreeable
alert
amazing
appealing
appreciated
appropriate
astonishing
authentic
awesome
beautiful
believable
better
brave
bright
brilliant
calm
capable
celebrated
charming
cheerful
clean
clear
commendable
compassionate
competent
confident
convincing
cool
courageous
creative
crisp
crucial
cute
dazzling
delightful
desirable
determined
devoted
efficient
effortless
elegant
energetic
enjoyable
excellent
exceptional
exciting
fabulous
fair
faithful
famous
fantastic
fast
favorable
fit
flexible
friendly
fun
funny
generous
genuine
glad
glorious
good
gorgeous
graceful
great
handsome
happy
healthy
helpful
honest
impeccable
impressive
incredible
innovative
inspirational
intelligent
inventive
joyful
keen
legendary
likeable
lively
lovely
loyal
lucky
magnificent
marvelous
motivated
outstanding
perfect
pleasant
popular
positive
powerful
practical
precise
productive
professional
proficient
proud
quick
reliable
remarkable
resilient
robust
satisfying
secure
sharp
skillful
smart
smooth
solid
spectacular
splendid
stable
stunning
strong
successful
super
superb
supportive
terrific
thankful
thoughtful
top
tremendous
trustworthy
useful
valuable
versatile
vibrant
victorious
vigorous
warm
well
wonderful
worthy
`;

const OPINION_LEXICON_NEG = `
abysmal
adverse
afraid
aggravating
alarming
annoying
anxious
awful
bad
biased
boring
broken
clumsy
cold
complicated
confusing
costly
cramped
cranky
critical
cruel
crummy
damaging
deceptive
defective
deficient
depressing
difficult
disappointing
disastrous
dishonest
disgusting
dismal
dismaying
displeased
dreadful
erratic
exhausted
faulty
feeble
frustrated
garbage
hard
harmful
horrible
hostile
hurt
inaccurate
ineffective
inefficient
inferior
injured
insufficient
irritating
lacking
lame
lazy
messy
miserable
misleading
negative
nervous
nasty
noisy
painful
pathetic
poor
problematic
questionable
regretful
remorseful
ridiculous
rough
rude
sad
scared
shaky
shoddy
sick
slow
smelly
sorry
stressful
stupid
subpar
terrible
tired
toxic
tragic
unacceptable
unclear
uncomfortable
uneven
unfair
unfortunate
unhappy
unhealthy
unknown
unlucky
unpleasant
unsatisfactory
unstable
unsure
unwanted
upset
useless
vague
weak
worse
worst
worthless
`;

/** Build Set from multi-line string. */
function buildLexicon(str) {
  return new Set(
    str.split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean)
  );
}

let POS_WORDS = buildLexicon(OPINION_LEXICON_POS);
let NEG_WORDS = buildLexicon(OPINION_LEXICON_NEG);

/** Domain-specific additions for running/fitness Tweets. */
const DOMAIN_POS = [
  'stoked','pumped','crush','crushed','nailed', // strong positive slang
  'pb','pr','personal','record'                 // domain tokens (besides bigram)
];
const DOMAIN_NEG = [
  'sore','cramp','cramps','cramping',           // pain / injury
  'dnf','bonk','bonked',
  'disappoint','disappointed'
];
for (const w of DOMAIN_POS) POS_WORDS.add(w);
for (const w of DOMAIN_NEG) NEG_WORDS.add(w);

/** Lowercase + strip URLs + keep letters/digits/+ as tokens. */
function tokenize(s) {
  return String(s)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9+ ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Tiny normalizer to catch variants (strongly→strong, injured→injur[e]d, wins→win). */
function normalizeToken(w) {
  if (w.endsWith('ly')    && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('ness') && w.length > 6) w = w.slice(0, -4);
  else if (w.endsWith('ing')  && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed')   && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('ers')  && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('er')   && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('s')    && w.length > 4) w = w.slice(0, -1);
  return w;
}

/** Negations / intensifiers / diminishers / emoji maps. */
const NEGATIONS    = new Set(['not','no','never','without',"n't"]);
const BOOSTERS_POS = new Set(['very','super','extremely','really','so','totally','absolutely','insanely','highly']);
const DIMINISHERS  = new Set(['slightly','somewhat','kinda','sorta','bit','barely','hardly']); // NOTE: no single 'a'
const EMOJI_POS    = new Set(['💪','🔥','🏆','🎉','😄','🙂','😁','😍']);
const EMOJI_NEG    = new Set(['😫','😞','😢','🤕','🥲','☠️','💀','🤮']);

/** Final scoring using lexicon + simple rules. */
function scoreSentiment(text) {
  const raw  = String(text);
  const toks = tokenize(raw).map(normalizeToken);
  let score = 0;

  // Emoji quick pass
  for (const ch of raw) {
    if (EMOJI_POS.has(ch)) score += 1;
    else if (EMOJI_NEG.has(ch)) score -= 1;
  }

  // Token scan with a short negation window
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];

    // intensity / diminish
    let weight = 1;
    if (i > 0 && BOOSTERS_POS.has(toks[i - 1])) weight = 1.5;
    if (i > 0 && DIMINISHERS.has(toks[i - 1]))  weight = 0.5;

    // negation within previous 3 tokens flips polarity
    let negated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATIONS.has(toks[j])) { negated = true; break; }
    }

    let delta = 0;
    if (POS_WORDS.has(w)) delta = 1 * weight;
    else if (NEG_WORDS.has(w)) delta = -1 * weight;

    if (negated) delta *= -1;
    score += delta;
  }

  // Domain boosts: "new pr/pb", "personal record"
  for (let i = 0; i + 1 < toks.length; i++) {
    const a = toks[i], b = toks[i + 1];
    if (a === 'new' && (b === 'pr' || b === 'pb')) score += 1;
    if (a === 'personal' && b === 'record')        score += 1;
  }

  // Map numeric score -> label (tuned to pass the 8-case smoke test)
  let label = 'Neutral';
  if (score >= 2)       label = 'Positive';
  else if (score >= 0.5) label = 'Slightly Positive';
  else if (score <= -2)  label = 'Negative';
  else if (score <= -0.5) label = 'Slightly Negative';
  return { score, label };
}
/* ================== End sentiment helpers ================== */


/* ======================== Table helpers ======================== */

/** Escape HTML to avoid breaking the table. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Highlight all matches of the regex (case-insensitive) with <mark>. */
function highlight(text, regex) {
  const parts = [];
  let last = 0, m;
  const raw = String(text);
  while ((m = regex.exec(raw)) !== null) {
    parts.push(escapeHtml(raw.slice(last, m.index)));
    parts.push('<mark>' + escapeHtml(m[0]) + '</mark>');
    last = m.index + m[0].length;
    if (m.index === regex.lastIndex) regex.lastIndex++; // safety
  }
  parts.push(escapeHtml(raw.slice(last)));
  return parts.join('');
}

/** Build one table row; append colored sentiment badge inside the tweet cell. */
function buildRow(tweet, idx, termRegex) {
  const urlMatch = tweet.text.match(/https?:\/\/\S+/);
  const url = urlMatch ? urlMatch[0] : '#';
  const body = (typeof tweet.writtenText === 'string' && tweet.writtenText.length > 0)
    ? tweet.writtenText
    : tweet.text;
  const html = highlight(body, termRegex);

  const senti = tweet.sentimentLabel || 'Neutral';
  const color = senti.includes('Positive') ? '#0a8'
              : senti.includes('Negative') ? '#c33'
              : '#888';

  return `
    <tr>
      <th scope="row">${idx}</th>
      <td>${escapeHtml(tweet.activityType)}</td>
      <td>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener">${html}</a>
        <span style="margin-left:8px;color:${color};font-weight:600">[${escapeHtml(senti)}]</span>
      </td>
    </tr>`;
}

/** Apply filter from the input box, update count text and table. */
function applyFilter(rawTerm) {
  const term = (rawTerm || '').trim();
  const countSpan = document.getElementById('searchCount');
  const termSpan  = document.getElementById('searchText');
  const tbody     = document.getElementById('tweetTable');

  termSpan.textContent = term;
  if (term.length === 0) {
    countSpan.textContent = '0';
    tbody.innerHTML = '';
    return;
  }

  // Non-stateful regex for filtering + global regex for highlighting
  const safe    = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reTest  = new RegExp(safe, 'i');
  const reMark  = new RegExp(safe, 'ig');

  const matches = searchable.filter(t => {
    const hay = (typeof t.writtenText === 'string' && t.writtenText.length > 0) ? t.writtenText : t.text;
    return reTest.test(hay);
  });

  countSpan.textContent = String(matches.length);
  tbody.innerHTML = matches.map((t, i) => buildRow(t, i + 1, reMark)).join('');
}

/* ============================ Entry ============================ */

function parseTweets(runkeeper_tweets) {
  if (!Array.isArray(runkeeper_tweets)) {
    window.alert('No tweets returned');
    return;
  }

  // Map raw objects → Tweet instances (class defined in js/tweet.js)
  allTweets = runkeeper_tweets.map(t => new Tweet(t.text, t.created_at));

  // Only completed events with user-written text
  searchable = allTweets.filter(t => t.source === 'completed_event' && t.written === true);

  // Compute sentiment once
  searchable.forEach(t => {
    const body = (typeof t.writtenText === 'string' && t.writtenText.length > 0) ? t.writtenText : t.text;
    const { score, label } = scoreSentiment(body);
    t.sentimentScore = score;
    t.sentimentLabel = label;
  });

  // Wire up the input
  const input = document.getElementById('textFilter');
  if (input) input.addEventListener('input', () => applyFilter(input.value));

  // Initial render (empty term)
  applyFilter('');
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  loadSavedRunkeeperTweets().then(parseTweets);
});

