"use client";

const COLORS = {
  green: "#3f9142",
  blue: "#3e7cb8",
  yellow: "#d4a544",
  red: "#c0453a",
  neutral: "#26304a",
};

export default function DigitBars({ pct, bars }) {
  if (!pct) {
    return <div className="log-empty">No tick data for this market yet.</div>;
  }

  const max = Math.max(...pct, 1);
  const colorFor = (digit) => {
    if (bars?.green?.digit === digit) return COLORS.green;
    if (bars?.blue?.digit === digit) return COLORS.blue;
    if (bars?.yellow?.digit === digit) return COLORS.yellow;
    if (bars?.red?.digit === digit) return COLORS.red;
    return COLORS.neutral;
  };

  return (
    <div className="digit-bars">
      {pct.map((p, digit) => (
        <div className="digit-col" key={digit}>
          <span className="digit-pct">{p.toFixed(1)}%</span>
          <div
            className="digit-bar"
            style={{
              height: `${Math.max((p / max) * 100, 3)}%`,
              background: colorFor(digit),
            }}
          />
          <span className="digit-label">{digit}</span>
        </div>
      ))}
    </div>
  );
}
