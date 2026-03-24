import fsp from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { KittenTTS } from '../src/index.node.ts';

const PROFILE_OPTIONS = {
  docs: { warmupRuns: 1, measuredRuns: 3 },
  full: { warmupRuns: 1, measuredRuns: 7 },
};

function parseArgs(argv) {
  const options = {
    profile: 'docs',
    models: null,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--quiet') {
      options.quiet = true;
      continue;
    }

    if (arg === '--profile') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --profile');
      }
      if (!Object.hasOwn(PROFILE_OPTIONS, value)) {
        throw new Error(`Unknown profile: ${value}`);
      }
      options.profile = value;
      index += 1;
      continue;
    }

    if (arg === '--models') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --models');
      }
      options.models = value.split(',').map((item) => item.trim()).filter(Boolean);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

const CLI_OPTIONS = parseArgs(process.argv.slice(2));
const ACTIVE_PROFILE = PROFILE_OPTIONS[CLI_OPTIONS.profile];

const VOICE = 'Leo';
const WORKLOADS = [
  {
    key: 'short',
    label: 'Short prompts',
    texts: [
      'Hello from quick bench.',
      'This is a slightly longer sentence to evaluate text to speech generation speed on a local CPU machine.',
    ],
    notes: 'Legacy short workload used by the earlier docs benchmark.',
  },
  {
    key: 'long',
    label: 'Long prompt batch',
    texts: [
      'KittenTTS is running on a local Apple Silicon machine, and this benchmark is intended to measure steady state synthesis throughput rather than a single quick demo clip.',
      'The longer workload helps reveal whether model setup costs are eventually amortized once the model is already loaded and the generator is producing more audio continuously.',
      'This longer pass is intended to expose steady-state throughput on the CPU path once one-time startup overhead matters less than raw synthesis speed.',
    ],
    notes: 'Longer batch intended to better amortize setup overhead and expose steady-state CPU throughput.',
  },
];
const STAT_OPTIONS = [
  { key: 'median', label: 'Median' },
  { key: 'p90', label: 'P90' },
];
const DEFAULT_MODEL_KEY = 'nano';
const DEFAULT_WORKLOAD_KEY = 'long';
const DEFAULT_STAT_KEY = 'median';
const WARMUP_RUNS = ACTIVE_PROFILE.warmupRuns;
const MEASURED_RUNS = ACTIVE_PROFILE.measuredRuns;

const MODEL_CONFIGS = [
  {
    key: 'nano',
    label: 'Nano FP32',
    nodeModelId: 'KittenML/kitten-tts-nano-0.8-fp32',
  },
  {
    key: 'micro',
    label: 'Micro INT8',
    nodeModelId: 'KittenML/kitten-tts-micro-0.8',
  },
  {
    key: 'mini',
    label: 'Mini INT8',
    nodeModelId: 'KittenML/kitten-tts-mini-0.8',
  },
];

const DOCS_OUTPUT = new URL('../docs/speed-comparison.json', import.meta.url);
const REVIEW_OUTPUT = new URL('../review-audio/speed-comparison.json', import.meta.url);

function logProgress(message) {
  if (!CLI_OPTIONS.quiet) {
    console.error(`[benchmark-approaches] ${message}`);
  }
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function summarizeSeries(values, digits = 2) {
  if (!values.length) return null;
  return {
    median: round(median(values), digits),
    p90: round(percentile(values, 0.9), digits),
    min: round(Math.min(...values), digits),
    max: round(Math.max(...values), digits),
  };
}

async function runTextBatch(tts, texts) {
  let totalGenMs = 0;
  let totalAudioS = 0;

  for (const text of texts) {
    const started = performance.now();
    const audio = await tts.generate(text, { voice: VOICE });
    totalGenMs += performance.now() - started;
    totalAudioS += audio.duration;
  }

  return {
    total_gen_ms: round(totalGenMs, 1),
    total_audio_s: round(totalAudioS, 3),
    ms_per_1s_audio: round(totalGenMs / totalAudioS, 2),
    rtf: round((totalAudioS * 1000) / totalGenMs, 2),
  };
}

async function benchmarkWorkload(tts, workload) {
  logProgress(`workload ${workload.key}: warmup ${WARMUP_RUNS}, measured ${MEASURED_RUNS}`);
  let warmup = null;
  for (let warmupIndex = 0; warmupIndex < WARMUP_RUNS; warmupIndex += 1) {
    warmup = await runTextBatch(tts, workload.texts);
  }

  const runs = [];
  for (let runIndex = 0; runIndex < MEASURED_RUNS; runIndex += 1) {
    const metrics = await runTextBatch(tts, workload.texts);
    runs.push({ iteration: runIndex + 1, ...metrics });
  }

  const totalAudioS = median(runs.map((run) => run.total_audio_s)) ?? 0;
  return {
    key: workload.key,
    label: workload.label,
    notes: workload.notes,
    texts: workload.texts,
    warmup_runs: WARMUP_RUNS,
    measured_runs: MEASURED_RUNS,
    warmup,
    runs,
    summary: {
      total_audio_s_per_run: round(totalAudioS, 3),
      total_gen_ms: summarizeSeries(runs.map((run) => run.total_gen_ms), 1),
      ms_per_1s_audio: summarizeSeries(runs.map((run) => run.ms_per_1s_audio), 2),
      rtf: summarizeSeries(runs.map((run) => run.rtf), 2),
    },
  };
}

async function benchmarkLoadedTts(tts) {
  const workloads = [];
  for (const workload of WORKLOADS) {
    workloads.push(await benchmarkWorkload(tts, workload));
  }
  return workloads;
}

async function benchmarkNodeCpu(modelConfig) {
  logProgress(`node cpu: loading ${modelConfig.key}`);
  const loadStart = performance.now();
  const tts = await KittenTTS.from_pretrained(modelConfig.nodeModelId, { runtime: 'cpu' });
  const loadMs = performance.now() - loadStart;

  try {
    return {
      key: 'node-cpu',
      label: 'Node CPU',
      runtime: 'node-cpu',
      source: 'fresh-local',
      model: modelConfig.nodeModelId,
      model_short: modelConfig.key,
      load_ms: round(loadMs, 1),
      runtime_requested: 'cpu',
      runtime_actual: tts.runtime,
      execution_providers: tts.executionProviders,
      notes: 'Direct Node runtime on CPU.',
      workloads: await benchmarkLoadedTts(tts),
    };
  } finally {
    await tts.release();
  }
}

function getWorkloadSummary(approach, workloadKey) {
  return approach.workloads?.find((workload) => workload.key === workloadKey)?.summary || null;
}

function buildSpeedHighlightsForWorkloadStat(approaches, workloadKey, statKey) {
  const rows = approaches
    .map((approach) => ({
      approach,
      summary: getWorkloadSummary(approach, workloadKey),
    }))
    .filter((entry) => Number.isFinite(entry.summary?.ms_per_1s_audio?.[statKey]));

  void rows;
  return [];
}

function buildHighlights(approaches) {
  void approaches;

  return {
    speed_by_workload_stat: Object.fromEntries(
      WORKLOADS.map((workload) => [
        workload.key,
        Object.fromEntries(STAT_OPTIONS.map((stat) => [stat.key, buildSpeedHighlightsForWorkloadStat(approaches, workload.key, stat.key)])),
      ]),
    ),
    load: [],
  };
}

async function benchmarkModel(modelConfig) {
  logProgress(`model ${modelConfig.key}: start`);
  const approaches = [];
  approaches.push(await benchmarkNodeCpu(modelConfig));

  return {
    key: modelConfig.key,
    label: modelConfig.label,
    node_model: modelConfig.nodeModelId,
    approaches,
    highlights: buildHighlights(approaches.filter((item) => !item.skipped)),
  };
}

async function main() {
  logProgress(`profile ${CLI_OPTIONS.profile}: ${WARMUP_RUNS} warmup, ${MEASURED_RUNS} measured`);
  const selectedModels = CLI_OPTIONS.models?.length
    ? MODEL_CONFIGS.filter((modelConfig) => CLI_OPTIONS.models.includes(modelConfig.key))
    : MODEL_CONFIGS;

  if (!selectedModels.length) {
    throw new Error('No benchmark models selected.');
  }

  const models = [];
  for (const modelConfig of selectedModels) {
    models.push(await benchmarkModel(modelConfig));
  }

  const report = {
    generated_at: new Date().toISOString(),
    benchmark_name: 'multi-model-node-cpu',
    voice: VOICE,
    workloads: WORKLOADS,
    stat_options: STAT_OPTIONS,
    default_model_key: DEFAULT_MODEL_KEY,
    default_workload_key: DEFAULT_WORKLOAD_KEY,
    default_stat_key: DEFAULT_STAT_KEY,
    benchmark_config: {
      warmup_runs: WARMUP_RUNS,
      measured_runs: MEASURED_RUNS,
      profile: CLI_OPTIONS.profile,
      interpretation: 'Lower is better. Use median for central tendency and p90 to inspect slower tail runs.',
    },
    metric: 'ms_per_1s_audio',
    interpretation: 'Lower is better. The throughput chart shows the selected statistic from repeated steady-state runs after warm-up.',
    load_metric: 'load_ms',
    load_interpretation: 'Lower is better. This is cold-start model/session initialization latency.',
    models,
  };

  await Promise.all([
    fsp.writeFile(DOCS_OUTPUT, JSON.stringify(report, null, 2) + '\n'),
    fsp.writeFile(REVIEW_OUTPUT, JSON.stringify(report, null, 2) + '\n'),
  ]);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[benchmark-approaches]', error?.stack || error?.message || error);
  process.exit(1);
});