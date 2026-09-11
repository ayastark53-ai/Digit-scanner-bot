import { lastDigit } from "./digitStats";

const EVEN = new Set([0, 2, 4, 6, 8]);
const ODD = new Set([1, 3, 5, 7, 9]);

// Watches a live stream of ticks (call .push(price) per tick) and reports
// when the entry condition for the chosen setup fires. One watcher per
// active market/setup pair; call reset() after every trade or when the
// scanner moves to a different market.
export class EntryWatcher {
  constructor(setupType, bars) {
    this.setupType = setupType; // EVEN | ODD | OVER | UNDER
    this.bars = bars; // {green, blue, yellow, red} from evaluateSetups
    this.stage = "waiting_trigger"; // waiting_trigger -> watching -> fire
    this.watchCount = 0;
  }

  reset(bars) {
    if (bars) this.bars = bars;
    this.stage = "waiting_trigger";
    this.watchCount = 0;
  }

  // Returns { fire: bool, contractType, barrier } — fire=true means enter now.
  push(price) {
    const digit = lastDigit(price);

    if (this.setupType === "EVEN" || this.setupType === "ODD") {
      const triggerDigits = [this.bars.red.digit, this.bars.yellow.digit];
      const oppositeSet = this.setupType === "EVEN" ? ODD : EVEN;

      if (this.stage === "waiting_trigger") {
        if (triggerDigits.includes(digit)) {
          this.stage = "watching";
          this.watchCount = 0;
          this._streak = oppositeSet.has(digit) ? 1 : 0;
        }
        return { fire: false };
      }

      if (this.stage === "watching") {
        this.watchCount++;
        if (oppositeSet.has(digit)) {
          this._streak = (this._streak || 0) + 1;
        } else {
          this._streak = 0;
        }
        if (this._streak >= 2) {
          this.reset();
          return {
            fire: true,
            contractType: this.setupType === "EVEN" ? "DIGITEVEN" : "DIGITODD",
          };
        }
        if (this.watchCount >= 5) {
          this.reset(); // gave up, go back to waiting for a fresh trigger
        }
        return { fire: false };
      }
    }

    if (this.setupType === "OVER") {
      // trigger: least-appearing among 1,2,3 shows up
      const triggerSet = new Set([1, 2, 3]);
      if (this.stage === "waiting_trigger") {
        if (triggerSet.has(digit) && (digit === this.bars.red.digit || digit === this.bars.yellow.digit)) {
          this.stage = "watching";
          return { fire: false };
        }
        return { fire: false };
      }
      if (this.stage === "watching") {
        this.reset();
        if (digit >= 4 && digit <= 9) {
          return { fire: true, contractType: "DIGITOVER", barrier: 3 };
        }
        return { fire: false };
      }
    }

    if (this.setupType === "UNDER") {
      // trigger: least-appearing among 6,7,8 shows up
      const triggerSet = new Set([6, 7, 8]);
      if (this.stage === "waiting_trigger") {
        if (triggerSet.has(digit) && (digit === this.bars.red.digit || digit === this.bars.yellow.digit)) {
          this.stage = "watching";
          return { fire: false };
        }
        return { fire: false };
      }
      if (this.stage === "watching") {
        this.reset();
        if (digit >= 0 && digit <= 4) {
          return { fire: true, contractType: "DIGITUNDER", barrier: 6 };
        }
        return { fire: false };
      }
    }

    return { fire: false };
  }
}
