import { describe, expect, it } from 'vitest';
import vectors from './generated/node_picker_vectors.json';
import {
  NodeBlocked, NodeNotReady, NodePicker, classifyNode, discoverWindowMs, failKey, readConfigAnswer, STOP_REASON_HOST_LAPSE, switchState,
  configRequest,
} from './nodePicker';
import { SimBus, SimNode } from './multinodeSim';
import {
  MN_NODE_TIMEOUT_MS, MN_STATE_BOOTLOADER, MN_STATE_SELECTED, CAN_ID_ENTER_BOOTLOADER, CAN_ID_MULTINODE_CONFIG_RESP, encodeMnDiscover, encodeMultinodeConfigRespResponse, MN_VERSION,
} from './generated/urtcCanIds';

const SINGLE_HEAD = 0x120;

function makeBus(addresses: number[], options: { releaseOnLapse?: boolean; config?: { stored: number; running: number } | null } = {}) {
  const bus = new SimBus();
  addresses.forEach((address, index) => bus.add(new SimNode(address, 3 + address, 0x1000 + address + (index > 0 && addresses[index - 1] === address ? 0x100 : 0), 0)));
  bus.step(100);
  const io = { send: (id: number, data: number[]) => bus.hostSend(id, data), now: () => bus.now, sleep: async (ms: number) => { bus.step(ms); } };
  const picker = new NodePicker(io, {
    releaseOnLapse: options.releaseOnLapse,
    toolName: (tool) => `T${tool}`,
    readConfig: options.config === undefined ? undefined : async () => options.config ?? null,
  });
  bus.onHostFrame = (id, data) => picker.onFrame(id, data);
  return { bus, picker, io };
}

describe('the vectors shared with the Python picker', () => {
  it('classifies a head the way they say', () => {
    expect(vectors.classify.length).toBeGreaterThan(30);
    for (const c of vectors.classify) expect(classifyNode(c.state, c.conflict, c.alive), JSON.stringify(c)).toBe(c.status);
  });
  it('reads the switch the way they say', () => {
    for (const c of vectors.switch) expect(switchState(c.config as never), JSON.stringify(c)).toBe(c.switch);
  });
  it('maps a refusal to the text the way they say', () => {
    for (const c of vectors.fail) expect(`NP_${failKey(c.reason).toUpperCase()}`, c.reason).toBe(c.key);
  });
  it('knows the state bits', () => {
    expect(vectors.state_bits.bootloader).toBe(MN_STATE_BOOTLOADER);
    expect(vectors.state_bits.selected).toBe(MN_STATE_SELECTED);
  });
});

describe('the window of the tool heads', () => {
  it('waits long enough for every answer', () => {
    expect(discoverWindowMs()).toBeGreaterThan(62);
    expect(discoverWindowMs()).toBeLessThan(200);
  });

  it('treats a bus where nobody answers as one head and lets everything pass', async () => {
    const { picker } = makeBus([]);
    await picker.scan();
    expect(picker.mode).toBe('legacy');
    expect(picker.rows()).toEqual([]);
    expect(picker.maySend()).toBe(true);
    expect(() => picker.gate(SINGLE_HEAD)).not.toThrow();
    expect(picker.takeNotices().map(n => n.key)).toEqual(['sw_unknown', 'msg_legacy']);
  });

  it('lists the heads without selecting any', async () => {
    const { picker, bus } = makeBus([2, 5], { config: { stored: 1, running: 1 } });
    await picker.scan();
    expect(picker.rows().map(r => [r.address, r.status, r.selectable, r.mine])).toEqual([[2, 'ready', true, false], [5, 'ready', true, false]]);
    expect(picker.rows()[0].serial).toBe('00001002');
    expect(picker.rows()[0].tool).toBe('T5');
    expect(picker.wanted).toBeNull();
    expect(picker.maySend()).toBe(false);
    expect(picker.takeNotices().map(n => n.key)).toEqual(['msg_found']);
    expect(bus.nodes.every(n => n.obeyed.length === 0)).toBe(true);
  });

  it('selects nothing until the person confirms', async () => {
    const { picker } = makeBus([2, 5], { config: { stored: 1, running: 1 } });
    await picker.scan();
    expect(picker.ask(5)).toBe(true);
    expect(picker.snapshot().confirm).toEqual({ node: 5, tool: 'T8', serial: '00001005' });
    expect(picker.wanted).toBeNull();
    picker.cancel();
    expect(picker.snapshot().confirm).toBeNull();
    expect(await picker.confirm()).toBe(false);
    picker.ask(5);
    expect(await picker.confirm()).toBe(true);
    expect(picker.wanted).toBe(5);
    expect(picker.maySend()).toBe(true);
    expect(picker.rows().find(r => r.address === 5)).toMatchObject({ status: 'selected', mine: true });
    expect(picker.takeNotices().at(-1)).toMatchObject({ key: 'msg_selected', params: { node: 5 } });
    await picker.release();
    expect(picker.wanted).toBeNull();
    expect(picker.maySend()).toBe(false);
  });

  it('refuses a head in conflict, with a fault or gone, and says why', async () => {
    const { picker, bus } = makeBus([6, 6, 9, 11]);
    bus.nodes[1].serial = 0x9999;
    bus.nodes[2].fault = true;
    bus.nodes[2].statusNow = true;
    await picker.scan();
    const rows = Object.fromEntries(picker.rows().map(r => [r.address, r]));
    expect(rows[6]).toMatchObject({ status: 'conflict', selectable: false });
    expect(rows[9]).toMatchObject({ status: 'fault', selectable: false });
    expect(rows[11].selectable).toBe(true);
    expect(picker.ask(6)).toBe(false);
    expect(picker.ask(9)).toBe(false);
    expect(picker.ask(20)).toBe(false);
    expect(picker.takeNotices().slice(-3).map(n => n.key)).toEqual(['fail_conflict', 'fail_fault', 'fail_not_announced']);
    bus.nodes[3].enabled = false;
    bus.step(MN_NODE_TIMEOUT_MS + 100);
    expect(picker.rows().find(r => r.address === 11)?.status).toBe('lost');
    expect(picker.ask(11)).toBe(false);
    expect(picker.takeNotices().at(-1)?.key).toBe('fail_gone');
    expect(picker.wanted).toBeNull();
    await expect(picker.select(6)).rejects.toBeInstanceOf(NodeNotReady);
  });

  it('says what the switch of the extension is', async () => {
    for (const [config, key, level] of [
      [{ stored: 0, running: 0 }, 'sw_off', 'info'], [{ stored: 1, running: 0 }, 'sw_pending_on', 'warning'],
      [{ stored: 0, running: 1 }, 'sw_pending_off', 'warning'], [null, 'sw_unknown', 'info'],
    ] as const) {
      const { picker } = makeBus([3], { config });
      await picker.scan();
      expect(picker.takeNotices()[0]).toMatchObject({ key, level });
    }
    const { picker } = makeBus([3], { config: { stored: 1, running: 1 } });
    await picker.scan();
    expect(picker.takeNotices().map(n => n.key)).toEqual(['msg_found']);
  });

  it('puts every head in its safe state when the selected head is lost, and shows why', async () => {
    const { picker, bus } = makeBus([2, 5], { config: { stored: 1, running: 1 } });
    await picker.scan();
    picker.ask(2);
    await picker.confirm();
    picker.takeNotices();
    bus.nodes[0].enabled = false;
    for (let i = 0; i < MN_NODE_TIMEOUT_MS / 10 + 20; i++) { bus.step(10); await picker.tick(); }
    expect(picker.takeNotices().at(-1)).toMatchObject({ key: 'lapse_released', level: 'warning', params: { node: 2, whyKey: 'why_gone' } });
    expect(bus.safeStateCalls.get(5)).toBe(1);
    expect(bus.nodes[1].stopReason).toBe(STOP_REASON_HOST_LAPSE);
    expect(picker.wanted).toBeNull();
    expect(picker.maySend()).toBe(false);
    expect(picker.takeLapses().map(l => [l.node, l.reason, l.released])).toEqual([[2, 'gone', true]]);
  });

  it('can leave the outputs alone, and says so', async () => {
    const { picker, bus } = makeBus([2, 5], { config: { stored: 1, running: 1 }, releaseOnLapse: false });
    await picker.scan();
    picker.ask(2);
    await picker.confirm();
    bus.nodes[0].fault = true;
    bus.nodes[0].statusNow = true;
    for (let i = 0; i < 30; i++) { bus.step(10); await picker.tick(); }
    expect(picker.takeNotices().filter(n => n.key.startsWith('lapse')).at(-1)).toMatchObject({ key: 'lapse_kept', level: 'error', params: { whyKey: 'why_fault' } });
    expect(bus.safeStateCalls.size).toBe(0);
    expect(picker.wanted).toBeNull();
  });

  it('never lapses while it works', async () => {
    const { picker, io } = makeBus([3], { config: { stored: 1, running: 1 } });
    await picker.scan();
    picker.ask(3);
    await picker.confirm();
    for (let i = 0; i < 500; i++) { await io.sleep(10); await picker.tick(); }
    expect(picker.wanted).toBe(3);
    expect(picker.takeLapses()).toEqual([]);
  });

  it('lets a single-head frame go only to the confirmed head', async () => {
    const { picker, bus } = makeBus([2, 5], { config: { stored: 1, running: 1 } });
    expect(() => picker.gate(SINGLE_HEAD)).not.toThrow();         // not searched yet: the heads ignore it by themselves
    await picker.scan();
    expect(() => picker.gate(SINGLE_HEAD)).toThrow(NodeBlocked);
    expect(() => picker.gate(CAN_ID_ENTER_BOOTLOADER)).toThrow(NodeBlocked);
    const discover = encodeMnDiscover(MN_VERSION, 2);
    expect(() => picker.gate(discover.id, discover.data)).not.toThrow();   // the extension's own frames
    expect(() => picker.gate(CAN_ID_MULTINODE_CONFIG_RESP, [])).not.toThrow();    // the read of the switch
    picker.ask(2);
    await picker.confirm();
    expect(() => picker.gate(SINGLE_HEAD)).not.toThrow();
    bus.hostSend(SINGLE_HEAD, []);
    expect(bus.nodes[0].obeyed.length).toBe(1);
    expect(bus.nodes[1].obeyed.length).toBe(0);
  });

  it('lets the bootloader frames of the selected head through after the enter-bootloader frame, and does not call the silence a lapse', async () => {
    const { picker, bus } = makeBus([2, 5], { config: { stored: 1, running: 1 } });
    await picker.scan();
    picker.ask(2);
    await picker.confirm();
    picker.takeNotices();
    picker.gate(CAN_ID_ENTER_BOOTLOADER);
    bus.nodes[0].enabled = false;
    for (let i = 0; i < MN_NODE_TIMEOUT_MS / 10 + 20; i++) { bus.step(10); await picker.tick(); }
    expect(() => picker.gate(0x7F1)).not.toThrow();
    expect(picker.takeNotices().filter(n => n.key.startsWith('lapse'))).toEqual([]);
    expect(bus.safeStateCalls.size).toBe(0);
    expect(() => picker.gate(SINGLE_HEAD)).toThrow(NodeBlocked);
    await picker.release();
    expect(() => picker.gate(0x7F1)).toThrow(NodeBlocked);
  });

  it('reads the answer of the head about its switch', () => {
    const answer = encodeMultinodeConfigRespResponse(1, 0, 0, 3);
    expect(readConfigAnswer(answer.id, answer.data)).toEqual({ stored: 1, running: 0 });
    expect(readConfigAnswer(0x120, answer.data)).toBeNull();
    expect(readConfigAnswer(answer.id, [1])).toBeNull();
    expect(configRequest().id).toBe(CAN_ID_MULTINODE_CONFIG_RESP);
  });

  it('turns a failing bus into a notice, not a crash', async () => {
    const picker = new NodePicker({ send: () => { throw new Error('adapter unplugged'); }, now: () => 0, sleep: async () => {} });
    await picker.scan();
    expect(picker.mode).toBe('idle');
    expect(picker.takeNotices().at(-1)).toMatchObject({ key: 'msg_scan_failed', level: 'error', params: { text: 'adapter unplugged' } });
  });
});
