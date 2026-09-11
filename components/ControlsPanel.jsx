"use client";

export default function ControlsPanel({ settings, onChange, running, onStart, onStop, canStart }) {
  const set = (key) => (e) => {
    const value = e.target.value === "" ? "" : Number(e.target.value);
    onChange({ ...settings, [key]: value });
  };

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label>Base stake (USD)</label>
          <input type="number" min="0.35" step="0.01" value={settings.baseStake} onChange={set("baseStake")} disabled={running} />
        </div>
        <div className="field">
          <label>Martingale multiplier</label>
          <input type="number" min="1" step="0.1" value={settings.martingaleMultiplier} onChange={set("martingaleMultiplier")} disabled={running} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Max martingale steps</label>
          <input type="number" min="1" step="1" value={settings.maxMartingaleSteps} onChange={set("maxMartingaleSteps")} disabled={running} />
        </div>
        <div className="field">
          <label>Stop after N wins in a row</label>
          <input type="number" min="0" step="1" value={settings.maxWinStreak} onChange={set("maxWinStreak")} disabled={running} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Stop loss (USD, session)</label>
          <input type="number" min="1" step="1" value={settings.stopLoss} onChange={set("stopLoss")} disabled={running} />
        </div>
        <div className="field">
          <label>Target profit (USD, session)</label>
          <input type="number" min="1" step="1" value={settings.targetProfit} onChange={set("targetProfit")} disabled={running} />
        </div>
      </div>

      {!running ? (
        <button className="run-btn start" onClick={onStart} disabled={!canStart}>
          Start bot
        </button>
      ) : (
        <button className="run-btn stop" onClick={onStop}>
          Stop bot
        </button>
      )}

      <p className="limits-note">
        Martingale raises the stake after every loss, so a losing streak gets expensive fast — the
        "max martingale steps" cap resets you to base stake rather than letting it compound forever.
        Stop loss and target profit apply to the whole session, not a single trade.
      </p>
    </div>
  );
}
