// Keep a global array so it is accessible from the console if needed
var tweet_array = [];

// Return "September 23rd, 2018" style strings
function formatDate(d) {
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const day = d.getDate();
  const suffix = (n => {
    if (n % 10 === 1 && n % 100 !== 11) return 'st';
    if (n % 10 === 2 && n % 100 !== 12) return 'nd';
    if (n % 10 === 3 && n % 100 !== 13) return 'rd';
    return 'th';
  })(day);
  return `${months[d.getMonth()]} ${day}${suffix}, ${d.getFullYear()}`;
}

// Helper to set all elements with a given class
function setTextByClass(className, text) {
  document.querySelectorAll('.' + className).forEach(el => el.textContent = text);
}

function parseTweets(runkeeper_tweets) {
	//Do not proceed if no tweets loaded
	if(runkeeper_tweets === undefined) {
		window.alert('No tweets returned');
		return;
	}

	tweet_array = runkeeper_tweets.map(function(tweet) {
		return new Tweet(tweet.text, tweet.created_at);
	});

	//sorted_tweets = tweet_array.sort((a, b) => a.time - b.time);

	const options = {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	};
	
	//This line modifies the DOM, searching for the tag with the numberTweets ID and updating the text.
	//It works correctly, your task is to update the text of the other tags in the HTML file!
	document.getElementById('numberTweets').innerText = tweet_array.length;	

    // First / last date in the dataset
    const times = tweet_array.map(t => t.time.getTime());
    const first = new Date(Math.min(...times));
    const last  = new Date(Math.max(...times));
    document.getElementById('firstDate').innerText = formatDate(first);
    document.getElementById('lastDate').innerText  = formatDate(last);

    // Split by source
    const total = tweet_array.length;
    const completed = tweet_array.filter(t => t.source === 'completed_event');
    const live       = tweet_array.filter(t => t.source === 'live_event');
    const achieve    = tweet_array.filter(t => t.source === 'achievement');
    const misc       = tweet_array.filter(t => t.source === 'miscellaneous');

    const pct = (n, d) => (100 * n / d).toFixed(2) + '%';

    setTextByClass('completedEvents', String(completed.length));
    setTextByClass('completedEventsPct', pct(completed.length, total));
    setTextByClass('liveEvents', String(live.length));
    setTextByClass('liveEventsPct', pct(live.length, total));
    setTextByClass('achievements', String(achieve.length));
    setTextByClass('achievementsPct', pct(achieve.length, total));
    setTextByClass('miscellaneous', String(misc.length));
    setTextByClass('miscellaneousPct', pct(misc.length, total));

    // Among completed events, count those with user-written text
    const writtenCompleted = completed.filter(t => t.written);
    setTextByClass('written', String(writtenCompleted.length));
    setTextByClass('writtenPct', pct(writtenCompleted.length, completed.length));
}

//Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function (event) {
	loadSavedRunkeeperTweets().then(parseTweets);
});