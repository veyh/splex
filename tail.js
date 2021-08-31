const {spawn} = require('child_process');
const split2 = require('split2');
const mergeStream = require('merge-stream');
const Tail = require('tail').Tail;

function tailSpawn(file, handlers) {
  const proc = spawn('tail', ['-n', 0, '-F', file], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (proc.error) {
    throw proc.error;
  }

  const stream = mergeStream(proc.stdout, proc.stderr)
    .pipe(split2());

  stream.on('data', chunk => {
    handlers.line(typeof chunk === 'string' ? chunk : chunk.toString());
  });

  stream.on('error', handlers.error);
}

function tailJs(file, handlers) {
  const emitter = new Tail(file);
  emitter.on('line', handlers.line);
  emitter.on('error', handlers.error);
}

module.exports = {
  tailSpawn,
  tailJs
};
