/**
 * Tests for NPZ loader — uses a synthetic .npy buffer to avoid real file I/O.
 */
import { strict as assert } from 'assert';
import { test } from 'node:test';
import JSZip from 'jszip';
import { loadNpz } from '../src/npz-loader.js';

/** Build a minimal .npy buffer for a float32 array with given shape. */
function makeNpy(data, shape) {
  const dtype = '<f4';
  const header = `{'descr': '${dtype}', 'fortran_order': False, 'shape': (${shape.join(', ')},), }`;
  const headerPadded = header.padEnd(Math.ceil((header.length + 1) / 64) * 64 - 1, ' ') + '\n';
  const headerLen = headerPadded.length;

  const buf = new ArrayBuffer(10 + headerLen + data.length * 4);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // Magic + version
  '\x93NUMPY'.split('').forEach((c, i) => { bytes[i] = c.charCodeAt(0); });
  bytes[6] = 1; bytes[7] = 0;
  view.setUint16(8, headerLen, true);
  new TextEncoder().encodeInto(headerPadded, bytes.subarray(10));

  // Write float32 values byte-by-byte via DataView to avoid alignment issues
  const dataOffset = 10 + headerLen;
  for (let i = 0; i < data.length; i++) {
    view.setFloat32(dataOffset + i * 4, data[i], true);
  }

  return buf;
}

async function makeNpz(entries) {
  const zip = new JSZip();
  for (const [key, { data, shape }] of Object.entries(entries)) {
    const npy = makeNpy(data, shape);
    zip.file(key + '.npy', npy);
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

test('loadNpz returns correct keys', async () => {
  const npz = await makeNpz({
    'voice-a': { data: [1, 2, 3, 4], shape: [2, 2] },
    'voice-b': { data: [5, 6], shape: [1, 2] },
  });
  const result = await loadNpz(npz);
  assert.ok('voice-a' in result, 'voice-a key present');
  assert.ok('voice-b' in result, 'voice-b key present');
});

test('loadNpz returns correct shape', async () => {
  const npz = await makeNpz({
    'test': { data: [1, 2, 3, 4, 5, 6], shape: [2, 3] },
  });
  const result = await loadNpz(npz);
  assert.deepEqual(result['test'].shape, [2, 3]);
});

test('loadNpz returns correct float32 values', async () => {
  const values = [0.5, 1.5, 2.5, 3.5];
  const npz = await makeNpz({
    'vec': { data: values, shape: [4] },
  });
  const result = await loadNpz(npz);
  const got = Array.from(result['vec'].data);
  values.forEach((v, i) => {
    assert.ok(Math.abs(got[i] - v) < 1e-5, `value[${i}] mismatch`);
  });
});
