"use client";

import { useEffect, useRef, useState } from "react";
import { DerivClient } from "../lib/derivClient";
import { TradingEngine } from "../lib/engine";
import DigitBars from "../components/DigitBars";
import MarketScanner from "../components/MarketScanner";
import ControlsPanel from "../components/ControlsPanel";
import TradeLog from "../components/TradeLog";

const SYMBOLS = [
  { code: "R_10", label: "Volatility 10 Index" },
  { code: "R_25", label: "Volatility 25 Index" },
  { code: "R_50", label: "Volatility 50 Index" },
  { code: "R_75", label: "Volatility 75 Index" },
  { code: "R_100", label: "Volatility 100 Index" },
  { code: "1HZ10V", label: "Volatility 10 (1s) Index" },
  { code: "1HZ25V", label: "Volatility 25 (1s) Index" },
  { code: "1HZ50V", label: "Volatility 50 (1s) Index" },
  { code: "1HZ75V", label: "Volatility 75 (1s) Index" },
  { code: "1HZ100V", label: "Volatility 100 (1s) Index" },
];

const labelFor = (code) => SYMBOLS.find((s) => s.code === code)?.label || code;

export default function Page() {
  const [mode, setMode] = useState("demo"); // demo | real — a label/reminder; the token itself decides
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [balance, setBalance] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [running, setRunning] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [selected, setSelected] = useState(null); // {symbol, setup, score, pct, bars}
  const [statusMsg, setStatusMsg] = useState("Not connected.");
  const [trades, setTrades] = useState([]);
  const [sessionPnl, setSessionPnl] = useState(0);

  const [settings, setSettings] = useState({
    baseStake: 1,
    martingaleMultiplier: 2,
    maxMartingaleSteps: 5,
    maxWinStreak: 5,
    stopLoss: 20,
    targetProfit: 20,
  });

  const clientRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      clientRef.current?.close();
    };
  }, []);

  async function handleConnect() {
    if (!token) return;
    setConnecting(true);
    setErrorMsg("");
    try {
      const client = new DerivClient({
        onBalance: (b) => setBalance(b),
        onError: (err) => setErrorMsg(err.message || "Deriv API error."),
        onContractUpdate: (contract) => engineRef.current?.onContractSettled(contract),
      });
      await client.connect();
      client.authorize(token.trim());
      clientRef.current = client;
      setConnected(true);
      setStatusMsg("Connected. Press Start bot to begin scanning.");
    } catch (err) {
      setErrorMsg(err.error_description || err.message || "Could not connect. Check your token.");
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    engineRef.current?.stop();
    clientRef.current?.close();
    clientRef.current = null;
    engineRef.current = null;
    setConnected(false);
    setRunning(false);
    setBalance(null);
    setRankings([]);
    setSelected(null);
    setStatusMsg("Not connected.");
  }

  function handleEngineEvent(type, payload) {
    if (type === "rankings") {
      setRankings(
        payload.rankings.map((r) => ({ ...r, label: labelFor(r.symbol) }))
      );
    }
    if (type === "scan" && payload.symbol) {
      setSelected(payload);
      setStatusMsg(payload.message);
    }
    if (type === "scan" && !payload.symbol) {
      setStatusMsg(payload.message);
    }
    if (type === "status") {
      setStatusMsg(payload.message);
      if (/stop loss|target profit|stopped/i.test(payload.message)) {
        setRunning(false);
      }
    }
    if (type === "trade_open") {
      setStatusMsg(`Entering ${payload.contractType} on ${labelFor(payload.symbol)} — stake $${payload.stake.toFixed(2)}`);
    }
    if (type === "trade_result") {
      setTrades((prev) => [
        {
          time: new Date().toLocaleTimeString(),
          symbol: labelFor(payload.symbol),
          contractType: payload.contractType || "",
          stake: payload.stake,
          profit: payload.profit,
          won: payload.won,
        },
        ...prev,
      ]);
      setSessionPnl(payload.sessionPnl);
    }
    if (type === "error") {
      setErrorMsg(payload.message);
    }
  }

  function handleStart() {
    if (!clientRef.current) return;
    setTrades([]);
    setSessionPnl(0);
    const engine = new TradingEngine({
      client: clientRef.current,
      symbols: SYMBOLS.map((s) => s.code),
      settings,
      onEvent: handleEngineEvent,
    });
    engineRef.current = engine;
    engine.start();
    setRunning(true);
  }

  function handleStop() {
    engineRef.current?.stop("Stopped by you.");
    setRunning(false);
  }

  return (
    <main className="shell">
      <div className="masthead">
        <div>
          <h1>Digit Scanner</h1>
          <div className="sub">Even/Odd &amp; Over/Under bot for Deriv synthetic indices</div>
        </div>
        <div className="status-row">
          <span>
            <span className={`status-dot ${connected ? "live" : "off"}`} />
            {connected ? (running ? "Running" : "Connected") : "Disconnected"}
          </span>
          {balance && (
            <span className="balance">
              {Number(balance.balance).toFixed(2)}
              <span className="ccy">{balance.currency}</span>
            </span>
          )}
          <span className="balance" style={{ color: sessionPnl >= 0 ? "var(--success)" : "var(--danger)" }}>
            {sessionPnl >= 0 ? "+" : ""}
            {sessionPnl.toFixed(2)}
            <span className="ccy">session</span>
          </span>
        </div>
      </div>

      {!connected ? (
        <div className="connect-bar">
          <div className="mode-toggle">
            <button className={mode === "demo" ? "active" : ""} onClick={() => setMode("demo")}>
              Demo
            </button>
            <button className={mode === "real" ? "active" : ""} onClick={() => setMode("real")}>
              Real
            </button>
          </div>
          <input
            type="password"
            placeholder={mode === "demo" ? "Paste your Deriv DEMO account API token" : "Paste your Deriv REAL account API token"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button className="run-btn start" style={{ width: "auto", padding: "8px 18px" }} onClick={handleConnect} disabled={connecting || !token}>
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </div>
      ) : (
        <div className="connect-bar">
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
            Connected in {mode === "demo" ? "demo" : "real-money"} mode.
          </span>
          <button className="run-btn stop" style={{ width: "auto", padding: "8px 18px", marginLeft: "auto" }} onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="disclaimer" style={{ marginBottom: 18, marginTop: -6 }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      <div className="grid">
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <h2>Market scanner</h2>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{statusMsg}</span>
            </div>
            <div className="panel-body">
              <MarketScanner
                rankings={rankings}
                selectedSymbol={selected?.symbol}
                onSelect={() => {}}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{selected ? `${labelFor(selected.symbol)} — last-digit spread` : "Digit spread"}</h2>
              {selected?.setup && <span style={{ fontSize: 12, color: "var(--gold)" }}>{selected.setup} setup active</span>}
            </div>
            <div className="panel-body">
              <DigitBars pct={selected?.pct} bars={selected?.bars} />
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <h2>Bot controls</h2>
            </div>
            <div className="panel-body">
              <ControlsPanel
                settings={settings}
                onChange={setSettings}
                running={running}
                canStart={connected}
                onStart={handleStart}
                onStop={handleStop}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Trade log</h2>
            </div>
            <div className="panel-body">
              <TradeLog trades={trades} />
            </div>
          </div>
        </div>
      </div>

      <div className="disclaimer">
        <strong>Risk disclaimer.</strong> Synthetic indices are generated by Deriv's own random number
        generator; each tick's last digit is designed to be independent and roughly uniform. Recent
        digit-frequency patterns are not a proven predictor of the next digit, and martingale staking
        increases what a losing streak costs rather than improving your odds. This tool automates the
        rules you defined — it does not guarantee profit, and you can lose your full stake on any
        trade. Test on a demo account before using real funds, and only trade money you can afford to
        lose.
      </div>
    </main>
  );
}
