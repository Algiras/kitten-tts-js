import { performance } from 'node:perf_hooks';
import { KittenTTS } from '../src/index.node.ts';

const DEFAULTS = {
  model: 'KittenML/kitten-tts-nano-0.8-int8',
  models: null,
  runtime: 'cpu',
  runtimes: null,
  text: 'Kitten TTS runtime probe.',
  voice: 'Leo',
  generate: true,
  json: false,
};

function printHelp() {
  console.log(`Usage: npm run diagnose:node-runtime -- [options]\n\nOptions:\n  --model <id>         Hugging Face model id\n  --models <a,b,c>     Comma-separated model ids to test as a batch\n  --runtime <name>     Runtime request (auto, cpu)\n  --runtimes <a,b,c>   Comma-separated runtimes to test as a batch\n  --text <value>       Probe text for synthesis\n  --voice <name>       Voice used for synthesis\n  --no-generate        Skip synthesis and only test model loading\n  --json               Print JSON only\n  -h, --help           Show this help`);
}

function parseList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--no-generate') {
      options.generate = false;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }

      if (!['model', 'models', 'runtime', 'runtimes', 'text', 'voice'].includes(key)) {
        throw new Error(`Unknown option: ${arg}`);
      }

      options[key] = key === 'models' || key === 'runtimes'
        ? parseList(value)
        : value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function formatProbeReport(report) {
  const lines = [
    `platform: ${report.environment.platform}`,
    `arch: ${report.environment.arch}`,
    `node: ${report.environment.node}`,
    `model: ${report.model}`,
    `runtime requested: ${report.runtimeRequested}`,
    `runtime actual: ${report.runtimeActual}`,
    `execution providers: ${report.executionProviders.join(', ') || 'none'}`,
    `load ms: ${report.loadMs}`,
  ];

  if (report.generate) {
    lines.push(`generate ms: ${report.generate.elapsedMs}`);
    lines.push(`audio duration sec: ${report.generate.durationSec}`);
    lines.push(`realtime factor: ${report.generate.realtimeFactor}`);
  }

  return lines.join('\n');
}

function formatBatchReport(batch) {
  const lines = [
    `platform: ${batch.environment.platform}`,
    `arch: ${batch.environment.arch}`,
    `node: ${batch.environment.node}`,
    `probes: ${batch.results.length}`,
  ];

  for (const report of batch.results) {
    lines.push('');
    lines.push(`model: ${report.model}`);
    lines.push(`runtime requested: ${report.runtimeRequested}`);
    lines.push(`runtime actual: ${report.runtimeActual}`);
    lines.push(`execution providers: ${report.executionProviders.join(', ') || 'none'}`);
    lines.push(`load ms: ${report.loadMs}`);
    if (report.generate) {
      lines.push(`generate ms: ${report.generate.elapsedMs}`);
      lines.push(`audio duration sec: ${report.generate.durationSec}`);
      lines.push(`realtime factor: ${report.generate.realtimeFactor}`);
    }
    if (report.error) {
      lines.push(`error: ${report.error}`);
    }
  }

  return lines.join('\n');
}

async function runProbe({ model, runtime, text, voice, generate }) {
  const loadStart = performance.now();
  const tts = await KittenTTS.from_pretrained(model, { runtime });
  const loadMs = performance.now() - loadStart;

  try {
    const report = {
      environment: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
      },
      model,
      runtimeRequested: tts.runtimeRequested,
      runtimeActual: tts.runtime,
      executionProviders: tts.executionProviders,
      loadMs: Number(loadMs.toFixed(1)),
      generate: null,
    };

    if (generate) {
      const generateStart = performance.now();
      const audio = await tts.generate(text, { voice });
      const generateMs = performance.now() - generateStart;

      report.generate = {
        elapsedMs: Number(generateMs.toFixed(1)),
        durationSec: Number(audio.duration.toFixed(3)),
        realtimeFactor: Number((audio.duration * 1000 / generateMs).toFixed(2)),
      };
    }

    return report;
  } finally {
    await tts.release();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const models = options.models?.length ? options.models : [options.model];
  const runtimes = options.runtimes?.length ? options.runtimes : [options.runtime];

  const results = [];
  for (const model of models) {
    for (const runtime of runtimes) {
      try {
        results.push(await runProbe({
          model,
          runtime,
          text: options.text,
          voice: options.voice,
          generate: options.generate,
        }));
      } catch (error) {
        results.push({
          environment: {
            platform: process.platform,
            arch: process.arch,
            node: process.version,
          },
          model,
          runtimeRequested: runtime,
          runtimeActual: 'error',
          executionProviders: [],
          loadMs: null,
          generate: null,
          error: String(error?.message || error),
        });
      }
    }
  }

  const batch = {
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
    results,
  };

  if (options.json) {
    console.log(JSON.stringify(models.length === 1 && runtimes.length === 1 ? results[0] : batch, null, 2));
    return;
  }

  console.log(models.length === 1 && runtimes.length === 1 ? formatProbeReport(results[0]) : formatBatchReport(batch));
}

main().catch((error) => {
  console.error(`[diagnose-node-runtime] ${error?.message || error}`);
  process.exitCode = 1;
});