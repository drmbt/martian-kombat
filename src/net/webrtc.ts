// WebRTC transport over PeerJS cloud broker (SPEC §C decision, V18). Implements
// the same Transport interface as the loopback pair, so NetSession neither
// knows nor cares that inputs now cross a real DataChannel. This layer is I/O
// glue — wall clock and network are fine here (it is NOT src/engine/); all
// determinism lives below it in the session/engine.
//
// Signaling: PeerJS public broker. Host claims a room id, guest connects to it.
// No infra of our own. The room-owning Peer outlives any single DataConnection
// so a dropped peer can reconnect into the same room (T46 rejoin builds on the
// `onReconnect` hook here).
import { Peer, type DataConnection } from 'peerjs';
import type { NetMsg, Transport, TransportStatus } from './transport';

/** namespace room codes on the shared public broker so short human codes don't
 *  collide with other apps' peer ids */
const ROOM_PREFIX = 'martian-kombat-';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1 ambiguity
const CODE_LEN = 5;

export function makeRoomCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

const roomPeerId = (code: string): string => ROOM_PREFIX + code.trim().toUpperCase();

/** A live DataConnection presented as a Transport. Rebindable: on rejoin the
 *  PeerLink swaps in a fresh DataConnection without NetSession noticing more
 *  than a 'connecting'→'open' blip. */
class WebRtcTransport implements Transport {
  private msgCb: ((msg: NetMsg) => void) | null = null;
  private statusCb: ((status: TransportStatus, detail?: string) => void) | null = null;
  private conn: DataConnection | null = null;
  private closed = false;

  constructor(conn: DataConnection) {
    this.bind(conn);
  }

  /** attach to a DataConnection (initial or post-rejoin) */
  bind(conn: DataConnection): void {
    if (this.closed) return;
    this.conn = conn;
    this.emitStatus(conn.open ? 'open' : 'connecting');
    conn.on('open', () => this.emitStatus('open'));
    conn.on('data', (data) => this.msgCb?.(data as NetMsg));
    conn.on('close', () => {
      if (this.conn === conn && !this.closed) this.emitStatus('closed', 'peer closed');
    });
    conn.on('error', (err) => {
      if (this.conn === conn && !this.closed) this.emitStatus('error', err.type);
    });
  }

  send(msg: NetMsg): void {
    if (this.closed) return;
    // reliable + ordered DataChannel (PeerJS default) — lockstep needs both
    if (this.conn?.open) this.conn.send(msg);
  }

  onMessage(cb: (msg: NetMsg) => void): void {
    this.msgCb = cb;
  }

  onStatus(cb: (status: TransportStatus, detail?: string) => void): void {
    this.statusCb = cb;
    if (this.conn) cb(this.conn.open ? 'open' : 'connecting');
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.conn?.close();
    this.emitStatus('closed');
  }

  private emitStatus(s: TransportStatus, detail?: string): void {
    this.statusCb?.(s, detail);
  }
}

export interface PeerLink {
  /** the human-facing room code (host: created; guest: the one joined) */
  readonly code: string;
  /** resolves once the DataChannel is open and ready to carry NetMsgs */
  readonly transport: Promise<Transport>;
  /** called when a later DataConnection replaces the current one (T46) */
  onReconnect(cb: () => void): void;
  /** tear down the Peer and its broker registration */
  destroy(): void;
}

interface HostOptions {
  /** reuse an existing code (rematch in the same room); default: fresh code */
  code?: string;
  /** ms to wait for the guest before rejecting `transport` */
  timeoutMs?: number;
}

/** Claim a room and wait for a guest. The Peer stays alive after connect so a
 *  dropped guest can reconnect into the same code. */
export function hostRoom(opts: HostOptions = {}): PeerLink {
  const code = opts.code ?? makeRoomCode();
  const peer = new Peer(roomPeerId(code));
  return buildLink(peer, code, opts.timeoutMs ?? 60_000, (link, resolve, reject, fail) => {
    peer.on('open', () => undefined); // registered; now waiting for a guest
    peer.on('connection', (conn) => link.accept(conn, resolve));
    peer.on('error', (err) => fail(reject, `broker error: ${err.type}`));
  });
}

interface JoinOptions {
  timeoutMs?: number;
}

/** Connect to an existing room code as the guest. */
export function joinRoom(code: string, opts: JoinOptions = {}): PeerLink {
  const peer = new Peer();
  return buildLink(peer, code, opts.timeoutMs ?? 30_000, (link, resolve, reject, fail) => {
    peer.on('open', () => {
      const conn = peer.connect(roomPeerId(code), { reliable: true });
      link.accept(conn, resolve);
    });
    peer.on('error', (err) => {
      // unavailable-id / peer-unavailable = "no such room" — surface plainly
      const noRoom = err.type === 'peer-unavailable' || err.type === 'unavailable-id';
      fail(reject, noRoom ? `no room "${code}"` : `broker error: ${err.type}`);
    });
  });
}

/** Shared PeerLink plumbing: owns the first-connection promise, holds a single
 *  WebRtcTransport across reconnects, and fires onReconnect on later channels. */
function buildLink(
  peer: Peer,
  code: string,
  timeoutMs: number,
  wire: (
    link: { accept: (conn: DataConnection, resolve: (t: Transport) => void) => void },
    resolve: (t: Transport) => void,
    reject: (e: Error) => void,
    fail: (reject: (e: Error) => void, msg: string) => void,
  ) => void,
): PeerLink {
  let transport: WebRtcTransport | null = null;
  let reconnectCb: (() => void) | null = null;
  let settled = false;

  const accept = (conn: DataConnection, resolve: (t: Transport) => void): void => {
    if (transport) {
      // a later channel: rebind the existing transport and notify (rejoin)
      transport.bind(conn);
      reconnectCb?.();
      return;
    }
    transport = new WebRtcTransport(conn);
    const onOpen = (): void => {
      if (settled) return;
      settled = true;
      resolve(transport as Transport);
    };
    if (conn.open) onOpen();
    else conn.on('open', onOpen);
  };

  const transportPromise = new Promise<Transport>((resolve, reject) => {
    const fail = (rej: (e: Error) => void, msg: string): void => {
      if (settled) return;
      settled = true;
      rej(new Error(msg));
    };
    const timer = setTimeout(() => fail(reject, 'connection timed out'), timeoutMs);
    const wrappedResolve = (t: Transport): void => {
      clearTimeout(timer);
      resolve(t);
    };
    wire({ accept }, wrappedResolve, reject, fail);
  });

  return {
    code,
    transport: transportPromise,
    onReconnect(cb: () => void): void {
      reconnectCb = cb;
    },
    destroy(): void {
      transport?.close();
      peer.destroy();
    },
  };
}
