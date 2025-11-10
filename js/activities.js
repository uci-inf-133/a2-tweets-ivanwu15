'use strict';

// ---------- Unified size for all charts ----------
const CHART_W = 600;  // width in pixels
const CHART_H = 300;  // height in pixels

let tweet_array = [];

/** Count items by a key function. */
function countBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** Arithmetic mean. */
function mean(nums) {
  const v = nums.filter(n => Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/** Try to locate the <p> element that contains the summary line. */
function getSummaryParagraph() {
  const ids = ['weekdayOrWeekendLonger', 'longestActivityType', 'shortestActivityType'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (typeof el.closest === 'function') {
      const p = el.closest('p');
      if (p) return p;
    }
    // Fallback walk-up
    let node = el;
    while (node && node.tagName && node.tagName.toLowerCase() !== 'p') {
      node = node.parentElement;
    }
    if (node) return node;
  }
  return null;
}

/**
 * Put the toggle button right under the summary line,
 * and keep #distanceVis immediately after it.
 */
function pinButtonUnderSummary() {
  const btn = document.getElementById('aggregate');
  const vis = document.getElementById('distanceVis');
  if (!btn || !vis || !vis.parentNode) return;

  let anchor = document.getElementById('toggleAnchor');
  let summaryP = getSummaryParagraph();

  // If we found the summary <p>, ensure an anchor exists right after it
  if (summaryP && summaryP.parentNode) {
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.id = 'toggleAnchor';
      summaryP.insertAdjacentElement('afterend', anchor);
    } else if (anchor.previousElementSibling !== summaryP) {
      summaryP.insertAdjacentElement('afterend', anchor);
    }
  } else {
    // Fallback: if summary <p> not found, place anchor above the first chart
    const firstChart = document.getElementById('activityVis');
    if (!anchor) {
      anchor = document.createElement('div');
      anchor.id = 'toggleAnchor';
    }
    if (firstChart && firstChart.parentNode && anchor.parentNode !== firstChart.parentNode) {
      firstChart.parentNode.insertBefore(anchor, firstChart);
    } else if (firstChart && firstChart.parentNode && anchor.nextElementSibling !== firstChart) {
      firstChart.parentNode.insertBefore(anchor, firstChart);
    }
  }

  // Move the button into the anchor
  if (btn.parentNode !== anchor) anchor.appendChild(btn);

  // Ensure the distance chart container follows the button
  if (vis.parentNode !== anchor.parentNode) {
    anchor.parentNode.insertBefore(vis, anchor.nextSibling);
  } else if (anchor.nextElementSibling !== vis) {
    anchor.parentNode.insertBefore(vis, anchor.nextSibling);
  }

  btn.style.display = 'inline-block';
  btn.style.margin = '8px 0 12px 0';
}

function parseTweets(runkeeper_tweets) {
  if (!Array.isArray(runkeeper_tweets)) {
    window.alert('No tweets returned');
    return;
  }

  // Map raw objects -> Tweet instances (class defined in js/tweet.js)
  tweet_array = runkeeper_tweets.map(t => new Tweet(t.text, t.created_at));

  // Only completed events for activities/distances
  const completed = tweet_array.filter(t => t.source === 'completed_event');

  // ===== A) Distinct activity types & Top-3 by count =====
  const counts = Array.from(
    countBy(completed, t => t.activityType),
    ([activity, count]) => ({ activity, count })
  )
    .filter(d => d.activity !== 'unknown')
    .sort((a, b) => b.count - a.count);

  const top3 = counts.slice(0, 3);
  const topDomain = top3.map(d => d.activity); // keep colors consistent

  // Fill sentence placeholders
  document.getElementById('numberActivities').innerText = String(counts.length);
  document.getElementById('firstMost').innerText  = top3[0]?.activity ?? 'N/A';
  document.getElementById('secondMost').innerText = top3[1]?.activity ?? 'N/A';
  document.getElementById('thirdMost').innerText  = top3[2]?.activity ?? 'N/A';

  // ===== B) Longest/shortest among top-3 (by mean distance) =====
  const distancesByType = {};
  top3.forEach(d => (distancesByType[d.activity] = []));
  completed.forEach(t => {
    if (distancesByType[t.activityType]) distancesByType[t.activityType].push(t.distance);
  });

  const means = Object.entries(distancesByType)
    .map(([activity, arr]) => ({ activity, mean: mean(arr) }))
    .sort((a, b) => b.mean - a.mean);

  document.getElementById('longestActivityType').innerText  = means[0]?.activity || 'N/A';
  document.getElementById('shortestActivityType').innerText = means.at(-1)?.activity || 'N/A';

  // ===== C) Weekend vs weekday (top-3 combined) =====
  const topNames = new Set(top3.map(d => d.activity));
  const dowOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const distRows = completed
    .filter(t => topNames.has(t.activityType) && t.distance > 0)
    .map(t => ({ Weekday: t.weekdayName, Distance: t.distance, Activity: t.activityType }));

  const perDay = dowOrder.map(name => {
    const ds = distRows.filter(r => r.Weekday === name).map(r => r.Distance);
    return { name, mean: mean(ds) };
  });
  const bestDow =
    perDay.reduce((best, cur) => (cur.mean > best.mean ? cur : best), { name: 'Sun', mean: -1 }).name;
  document.getElementById('weekdayOrWeekendLonger').innerText =
    (bestDow === 'Sun' || bestDow === 'Sat') ? 'the weekend' : 'weekdays';

  // === Pin the button under the summary NOW, before drawing charts ===
  pinButtonUnderSummary();

  // ======================= Charts =======================

  // Chart 1: counts per activity (bar)
  const barSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Number of Tweets containing each type of activity.',
    data: { values: counts.map(d => ({ Activity: d.activity, Count: d.count })) },
    mark: 'bar',
    encoding: {
      x: { field: 'Activity', type: 'nominal', sort: '-y' },
      y: { field: 'Count', type: 'quantitative' },
      tooltip: [{ field: 'Activity' }, { field: 'Count' }]
    },
    width: CHART_W,
    height: CHART_H
  };
  vegaEmbed('#activityVis', barSpec, { actions: false });

  // ---- Extra credit: One chart with two layers, toggled by a Vega param ----
  // Remove the unused aggregated container if present (we only use #distanceVis).
  const oldAgg = document.getElementById('distanceVisAggregated');
  if (oldAgg && oldAgg.parentNode) oldAgg.parentNode.removeChild(oldAgg);

  // Build a single layered spec:
  // Layer 1: RAW points (visible when showMean=false)
  // Layer 2: MEAN points (aggregate -> calculate Distance=MeanDistance; visible when showMean=true)
  const distLayerSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'Raw vs Mean distances by weekday for top-3 activities (single chart, toggle).',
    data: { values: distRows }, // [{Weekday, Distance, Activity}]
    params: [{ name: 'showMean', value: false }], // initial view shows RAW
    layer: [
      {
        mark: { type: 'point', tooltip: true },
        encoding: {
          x: { field: 'Weekday', type: 'ordinal', sort: dowOrder, title: 'Weekday' },
          y: { field: 'Distance', type: 'quantitative', title: 'Distance (mi)' },
          color: { field: 'Activity', type: 'nominal', scale: { domain: topDomain } },
          opacity: {
            // If showMean is true, hide raw layer
            condition: { test: 'showMean', value: 0 },
            value: 1
          }
        }
      },
      {
        transform: [
          { aggregate: [{ op: 'mean', field: 'Distance', as: 'MeanDistance' }],
            groupby: ['Weekday', 'Activity'] },
          // Rename to Distance so both layers share ONE y-scale/axis
          { calculate: 'datum.MeanDistance', as: 'Distance' }
        ],
        mark: { type: 'point', tooltip: true },
        encoding: {
          x: { field: 'Weekday', type: 'ordinal', sort: dowOrder, title: 'time (day)' },
          y: { field: 'Distance', type: 'quantitative', title: 'Distance (mi)' },
          color: { field: 'Activity', type: 'nominal', scale: { domain: topDomain } },
          opacity: {
            // If showMean is false, hide mean layer
            condition: { test: 'showMean', value: 1 },
            value: 0
          }
        }
      }
    ],
    width: CHART_W,
    height: CHART_H
  };

  // Embed once; keep the Vega view to toggle the param without re-embedding
  vegaEmbed('#distanceVis', distLayerSpec, { actions: false }).then(({ view }) => {
    const btn = document.getElementById('aggregate');
    let showingMean = false;
    if (btn) {
      btn.textContent = 'Show means';
      btn.onclick = () => {
        showingMean = !showingMean;
        // Toggle Vega param and run the view — no re-embed, instant switch
        view.signal('showMean', showingMean).run();
        btn.textContent = showingMean ? 'Show raw points' : 'Show means';
      };
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  loadSavedRunkeeperTweets().then(parseTweets);
});
