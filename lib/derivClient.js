// Thin wrapper around Deriv's WebSocket API (v3).
// Docs: https://api.deriv.com — verify field names there, APIs do drift over time.
// Everything runs client-side in the browser; there is no backend server.

const APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089"; // 1089 = Deriv's shared demo app id

export class DerivClient {
  constructor({ onBalance, onTick, onContractUpdate, onError } = {}) {
    this.ws = null;
    this.reqId = 1;
    this.pending = new Map(); // req_id -> {resolve, reject}
    this.tickSubs = new Map(); // symbol -> callback
    this.onBalance = onBalance || (() => {});
    this.onTick = onTick || (() => {});
    this.onContractUpdate = onContractUpdate || (() => {});
    this.onError = onError || (() => {});
    this.authorized = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onclose = () => {
        this.authorized = false;
      };
      this.ws.onmessage = (msg) => this._handleMessage(msg);
    });
  }

  _handleMessage(msg) {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch {
      return;
    }

    if (data.error) {
      this.onError(data.error);
      const p = this.pending.get(data.req_id);
      if (p) {
        p.reject(data.error);
        this.pending.delete(data.req_id);
      }
      return;
    }

    if (data.msg_type === "tick" && data.tick) {
      const cb = this.tickSubs.get(data.tick.symbol);
      if (cb) cb(data.tick);
      this.onTick(data.tick);
    }

    if (data.msg_type === "balance" && data.balance) {
      this.onBalance(data.balance);
    }

    if (data.msg_type === "proposal_open_contract" && data.proposal_open_contract) {
      this.onContractUpdate(data.proposal_open_contract);
    }

    if (data.req_id && this.pending.has(data.req_id)) {
      this.pending.get(data.req_id).resolve(data);
      this.pending.delete(data.req_id);
    }
  }

  _send(payload) {
    const req_id = this.reqId++;
    return new Promise((resolve, reject) => {
      this.pending.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...payload, req_id }));
      setTimeout(() => {
        if (this.pending.has(req_id)) {
          this.pending.delete(req_id);
          reject(new Error("Deriv request timed out"));
        }
      }, 15000);
    });
  }

  async authorize(token) {
    const res = await this._send({ authorize: token });
    this.authorized = true;
    await this._send({ balance: 1, subscribe: 1 });
    return res.authorize;
  }

  async getTickHistory(symbol, count = 1000) {
    const res = await this._send({
      ticks_history: symbol,
      count,
      end: "latest",
      style: "ticks",
    });
    return res.history?.prices?.map(Number) || [];
  }

  subscribeTicks(symbol, callback) {
    this.tickSubs.set(symbol, callback);
    this._send({ ticks: symbol, subscribe: 1 });
  }

  unsubscribeTicks(symbol) {
    this.tickSubs.delete(symbol);
    this._send({ forget_all: "ticks" });
  }

  // contractType: DIGITEVEN | DIGITODD | DIGITOVER | DIGITUNDER
  async buyDigitContract({ symbol, contractType, stake, barrier }) {
    const proposalReq = {
      proposal: 1,
      amount: Number(stake.toFixed(2)),
      basis: "stake",
      contract_type: contractType,
      currency: "USD",
      duration: 1,
      duration_unit: "t",
      symbol,
    };
    if (barrier !== undefined) proposalReq.barrier = String(barrier);

    const proposalRes = await this._send(proposalReq);
    const proposalId = proposalRes.proposal.id;
    const price = proposalRes.proposal.ask_price;

    const buyRes = await this._send({ buy: proposalId, price });
    const contractId = buyRes.buy.contract_id;

    // Subscribe to updates for this contract so we learn win/loss.
    this._send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });

    return { contractId, buyPrice: buyRes.buy.buy_price };
  }

  close() {
    if (this.ws) this.ws.close();
  }
}
