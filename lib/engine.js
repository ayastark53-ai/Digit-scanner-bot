import { scoreMarket } from "./digitStats";
import { EntryWatcher } from "./strategy";

const WINDOWS = [100, 300, 1000, 3000];

export class TradingEngine {
  constructor({ client, symbols, settings, onEvent }) {
    this.client = client;
    this.symbols = symbols; // list of symbol codes to scan
    this.settings = settings; // {baseStake, martingaleMultiplier, maxMartingaleSteps, stopLoss, targetProfit, maxWinStreak}
    this.onEvent = onEvent || (() => {}); // (type, payload) for the UI log

    this.tickCache = new Map(); // symbol -> array of prices
    this.running = false;
    this.inTrade = false;
    this.currentSymbol = null;
    this.watcher = null;

    this.sessionPnl = 0;
    this.currentStake = settings.baseStake;
    this.martingaleStep = 0;
    this.winStreak = 0;
  }

  async start() {
    this.running = true;
    this.sessionPnl = 0;
    this.currentStake = this.settings.baseStake;
    this.martingaleStep = 0;
    this.winStreak = 0;

    // Pull history for every candidate symbol first.
    for (const symbol of this.symbols) {
      const history = await this.client.getTickHistory(symbol, 3000);
      this.tickCache.set(symbol, history);
      this.client.subscribeTicks(symbol, (tick) => this._onTick(symbol, tick));
    }

    this._pickBestMarket();
    this.onEvent("status", { message: "Scanning started." });
  }

  stop(reason) {
    this.running = false;
    this.inTrade = false;
    for (const symbol of this.symbols) {
      this.client.unsubscribeTicks(symbol);
    }
    this.onEvent("status", { message: reason || "Stopped." });
  }

  _pickBestMarket() {
    let best = null;
    const rankings = [];

    for (const symbol of this.symbols) {
      const ticks = this.tickCache.get(symbol) || [];
      if (ticks.length < 200) continue;
      const result = scoreMarket(ticks, WINDOWS);
      rankings.push({ symbol, setup: result.setup, score: result.score || 0 });
      if (result.setup && (!best || result.score > best.score)) {
        best = { symbol, ...result };
      }
    }

    rankings.sort((a, b) => b.score - a.score);
    this.onEvent("rankings", { rankings });

    if (!best) {
      this.currentSymbol = null;
      this.watcher = null;
      this.onEvent("scan", { message: "No market currently meets any setup. Waiting..." });
      return;
    }

    const topWindow = best.perWindow.find((pw) => pw.window === WINDOWS[0]) || best.perWindow[0];
    this.currentSymbol = best.symbol;
    this.watcher = new EntryWatcher(best.setup, topWindow.bars);
    this.onEvent("scan", {
      message: `Selected ${best.symbol} — ${best.setup} setup, score ${best.score.toFixed(0)}/100`,
      symbol: best.symbol,
      setup: best.setup,
      score: best.score,
      pct: topWindow.pct,
      bars: topWindow.bars,
    });
  }

  _onTick(symbol, tick) {
    if (!this.running) return;

    const arr = this.tickCache.get(symbol) || [];
    arr.push(Number(tick.quote));
    if (arr.length > 5000) arr.shift();
    this.tickCache.set(symbol, arr);

    // Re-score periodically so we can switch markets between trades.
    if (!this.inTrade && arr.length % 20 === 0) {
      this._pickBestMarket();
    }

    if (this.inTrade || symbol !== this.currentSymbol || !this.watcher) return;

    const result = this.watcher.push(Number(tick.quote));
    if (result.fire) {
      this._enterTrade(symbol, result.contractType, result.barrier);
    }
  }

  async _enterTrade(symbol, contractType, barrier) {
    this.inTrade = true;
    const stake = this.currentStake;
    this.onEvent("trade_open", { symbol, contractType, stake });

    try {
      const { contractId } = await this.client.buyDigitContract({
        symbol,
        contractType,
        stake,
        barrier,
      });
      this._pendingContract = { contractId, symbol, contractType, stake };
    } catch (err) {
      this.onEvent("error", { message: err.message || "Trade failed to place." });
      this.inTrade = false;
    }
  }

  // Called by the UI layer when the Deriv client reports a contract as settled.
  onContractSettled(contract) {
    const pending = this._pendingContract;
    if (!pending || contract.contract_id !== pending.contractId) return;
    if (!contract.is_sold) return; // still open

    const profit = Number(contract.profit);
    const won = profit > 0;
    this.sessionPnl += profit;

    this.onEvent("trade_result", {
      symbol: pending.symbol,
      stake: pending.stake,
      profit,
      won,
      sessionPnl: this.sessionPnl,
    });

    if (won) {
      this.winStreak++;
      this.martingaleStep = 0;
      this.currentStake = this.settings.baseStake;
    } else {
      this.winStreak = 0;
      this.martingaleStep++;
      if (this.martingaleStep >= this.settings.maxMartingaleSteps) {
        this.onEvent("status", {
          message: `Max martingale steps (${this.settings.maxMartingaleSteps}) reached — resetting to base stake.`,
        });
        this.martingaleStep = 0;
        this.currentStake = this.settings.baseStake;
      } else {
        this.currentStake = Number(
          (this.settings.baseStake * Math.pow(this.settings.martingaleMultiplier, this.martingaleStep)).toFixed(2)
        );
      }
    }

    this._pendingContract = null;
    this.inTrade = false;

    if (this.sessionPnl <= -Math.abs(this.settings.stopLoss)) {
      this.stop(`Stop loss hit (${this.sessionPnl.toFixed(2)} USD). Bot stopped.`);
      return;
    }
    if (this.sessionPnl >= Math.abs(this.settings.targetProfit)) {
      this.stop(`Target profit reached (+${this.sessionPnl.toFixed(2)} USD). Bot stopped.`);
      return;
    }
    if (this.settings.maxWinStreak && this.winStreak >= this.settings.maxWinStreak) {
      this.stop(`${this.winStreak} wins in a row — pausing to re-check market conditions, as planned.`);
      return;
    }

    this._pickBestMarket();
  }
}
