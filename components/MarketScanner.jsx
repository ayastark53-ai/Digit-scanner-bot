"use client";

export default function MarketScanner({ rankings, selectedSymbol, onSelect }) {
  if (!rankings || rankings.length === 0) {
    return <div className="log-empty">Connect an account to start scanning markets.</div>;
  }

  return (
    <div>
      {rankings.map((r, i) => (
        <div
          key={r.symbol}
          className={`market-row ${r.symbol === selectedSymbol ? "selected" : ""}`}
          onClick={() => onSelect(r.symbol)}
        >
          <span className="rank">{i + 1}</span>
          <span className="name">{r.label}</span>
          <span className="setup">{r.setup ? `${r.setup} setup` : "no setup"}</span>
          <span className={`score ${r.score >= 50 ? "good" : "weak"}`}>
            {r.setup ? `${r.score.toFixed(0)}/100` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
