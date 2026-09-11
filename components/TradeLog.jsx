"use client";

export default function TradeLog({ trades }) {
  if (!trades || trades.length === 0) {
    return <div className="log-empty">No trades yet this session.</div>;
  }

  return (
    <div>
      <div className="log-row" style={{ color: "var(--text-dim)" }}>
        <span>Time</span>
        <span>Market / type</span>
        <span>Stake</span>
        <span>Result</span>
      </div>
      {trades.map((t, i) => (
        <div className="log-row" key={i}>
          <span>{t.time}</span>
          <span>
            {t.symbol} — {t.contractType}
          </span>
          <span>${t.stake.toFixed(2)}</span>
          <span className={t.won ? "win" : "loss"}>
            {t.won ? "+" : ""}
            {t.profit.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}
