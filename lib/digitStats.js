// Turns a list of raw tick prices into last-digit statistics, and scores
// markets by how consistent their digit skew is across several window
// sizes — not just the most recent 1000 ticks — since a skew that only
// shows up in one window is more likely to be noise than a real streak.

export function lastDigit(price) {
  const str = String(price);
  const clean = str.includes(".") ? str.replace(".", "") : str;
  return Number(clean[clean.length - 1]);
}

const EVEN = [0, 2, 4, 6, 8];
const ODD = [1, 3, 5, 7, 9];

export function digitFrequency(ticks) {
  const counts = new Array(10).fill(0);
  for (const price of ticks) {
    counts[lastDigit(price)]++;
  }
  const total = ticks.length || 1;
  return counts.map((c) => (c / total) * 100);
}

// windows: array of window sizes to check, e.g. [100, 300, 1000]
export function multiWindowFrequency(ticks, windows) {
  return windows.map((w) => ({
    window: w,
    pct: digitFrequency(ticks.slice(-w)),
  }));
}

function rankBars(pct) {
  const withIdx = pct.map((p, digit) => ({ digit, p }));
  withIdx.sort((a, b) => b.p - a.p);
  return {
    green: withIdx[0], // most appearing
    blue: withIdx[1], // 2nd most
    yellow: withIdx[8], // 2nd least
    red: withIdx[9], // least appearing
  };
}

// Checks the Even/Odd/Over/Under conditions the user specified, for one
// window's percentages. Returns which setups (if any) currently qualify.
export function evaluateSetups(pct) {
  const bars = rankBars(pct);
  const results = {};

  const isEven = (d) => EVEN.includes(d);
  const isOdd = (d) => ODD.includes(d);

  // Even strategy: green & blue on even (>=11%), red<=8.6%, yellow<=9.5%,
  // and red/yellow on odd (or mixed).
  results.EVEN =
    isEven(bars.green.digit) &&
    isEven(bars.blue.digit) &&
    bars.green.p >= 11 &&
    bars.blue.p >= 11 &&
    bars.red.p <= 8.6 &&
    bars.yellow.p <= 9.5;

  // Odd strategy: mirror image.
  results.ODD =
    isOdd(bars.green.digit) &&
    isOdd(bars.blue.digit) &&
    bars.green.p >= 11 &&
    bars.blue.p >= 11 &&
    bars.red.p <= 8.6 &&
    bars.yellow.p <= 9.5;

  // Over 1,2,3: digits 0-3 all below 10% (with red/yellow among them),
  // and at least two digits in 4-9 at >=11%.
  const low0to3 = [0, 1, 2, 3].every((d) => pct[d] < 10);
  const redOrYellowIn0to3 = [0, 1, 2, 3].includes(bars.red.digit) || [0, 1, 2, 3].includes(bars.yellow.digit);
  const strongIn4to9 = [4, 5, 6, 7, 8, 9].filter((d) => pct[d] >= 11).length >= 2;
  results.OVER = low0to3 && redOrYellowIn0to3 && strongIn4to9;

  // Under 8,7,6: mirror image over 6-9.
  const low6to9 = [6, 7, 8, 9].every((d) => pct[d] < 10);
  const redOrYellowIn6to9 = [6, 7, 8, 9].includes(bars.red.digit) || [6, 7, 8, 9].includes(bars.yellow.digit);
  const strongIn0to5 = [0, 1, 2, 3, 4, 5].filter((d) => pct[d] >= 11).length >= 2;
  results.UNDER = low6to9 && redOrYellowIn6to9 && strongIn0to5;

  return { bars, results };
}

// Scores a market 0-100 by how many of the given windows agree on the
// same setup, and how far past the threshold the numbers sit. A setup
// that only appears in the shortest window scores low; one that holds
// across short, medium and long windows scores high.
export function scoreMarket(ticks, windows = [100, 300, 1000, 3000]) {
  const usableWindows = windows.filter((w) => ticks.length >= Math.min(w, 200));
  if (usableWindows.length === 0) return { score: 0, setup: null, perWindow: [] };

  const perWindow = usableWindows.map((w) => {
    const pct = digitFrequency(ticks.slice(-w));
    const { bars, results } = evaluateSetups(pct);
    return { window: w, pct, bars, results };
  });

  const setupTypes = ["EVEN", "ODD", "OVER", "UNDER"];
  let best = { setup: null, score: 0 };

  for (const type of setupTypes) {
    const agreeing = perWindow.filter((pw) => pw.results[type]);
    if (agreeing.length === 0) continue;
    // consistency = fraction of windows that agree
    const consistency = agreeing.length / perWindow.length;
    // magnitude = how far the green/blue bars clear the 11% bar, averaged
    const magnitude =
      agreeing.reduce((sum, pw) => sum + (pw.bars.green.p + pw.bars.blue.p) / 2 - 11, 0) / agreeing.length;
    const score = Math.max(0, Math.min(100, consistency * 70 + Math.min(magnitude, 15) * 2));
    if (score > best.score) best = { setup: type, score, consistency, magnitude };
  }

  return { ...best, perWindow };
}
