#!/usr/bin/env node
/* eslint-disable capitalized-comments */
const meow = require('meow');
const fs = require('fs');
const chokidar = require('chokidar');
const tail = require('./tail').tailSpawn;

const updateNotifier = require('update-notifier');
const pkg = require('./package.json');

// Checks for available update and returns an instance
const notifier = updateNotifier({pkg});

// Notify using the built-in convenience method
notifier.notify();

// CLI Stuff
const cli = meow(
  `
==================
------------------
    S P L E X
------------------
==================


Usage: 
------------------
$ splex [options] file_1 file_2 file_X

Options:
--file        -f    specify a different .splexrc.json file
--table       -t    print as table rows
--colors      -c    specify custom colors as: -c color1,color2
--monochrome  -m    monochrome mode
--level       -l    force color support (0: none, 1: 16, 2: 256, 3: 16m)
--output      -o    write to a file instead of stdout


Config file:
------------------
you can have per firectory config file with named .splexrc.json 
with following content

{
  "files": [
	  "logs/log-0.log",
	  "logs/log-1.log",
	  "logs/log-2.log",
	  "logs/log-3.log"
  ]	
}

if this file exist you can just run splex command, 
wihout list of files provided


`,
  {
    flags: {
      file: {type: 'string', alias: 'f', default: '.splexrc.json'},
      table: {type: 'boolean', alias: 't'},
      colors: {type: 'string', alias: 'c'},
      monochrome: {type: 'boolean', alias: 'm'},
      level: {type: 'number', alias: 'l'},
      output: {type: 'string', alias: 'o'}
    }
  }
);

let chalk;

if (typeof cli.flags.level === 'number' &&
  cli.flags.level >= 0 &&
  cli.flags.level <= 3
) {
  const c = require('chalk');
  chalk = new c.Instance({level: cli.flags.level});
} else {
  chalk = require('chalk');
}

let testRcFile = function () {
  if (fs.existsSync(cli.flags.file)) {
    return true;
  }

  return false;
};

let readRcFile = function () {
  const raw = fs.readFileSync(cli.flags.file);
  return JSON.parse(raw);
};

let filenames = cli.input;
// Sanity checks
if (cli.input.length === 0) {
  if (testRcFile() === true) {
    console.log(chalk.blueBright('INFO: File names not provided, reading from .splexrc.json file'));
    let rcFIle = readRcFile();
    filenames = rcFIle.files;
  } else {
    console.log(chalk.red('Error:'), 'No files specified.');
    console.log(
      chalk.yellow('Usage example:'),
      'splex [options] file1 file2 file3...'
    );
    cli.showHelp(2);
  }
}

// Options handling
const optionsMap = {
  t: 1,
  c: 2,
  m: 4
};

let optionsSum = 0;
['t', 'c', 'm'].forEach(flag => {
  if (cli.flags[flag] === true || (typeof cli.flags[flag] === 'string' && cli.flags[flag] !== '')) {
    optionsSum += optionsMap[flag];
  }
});

let appOptions = {
  term: {
    size: process.stdout.columns,
    line: '-'.repeat(process.stdout.columns)
  },
  colors: ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan'],
  colorIdx: {}
};

// Provide custom colors
if (cli.flags.c) {
  appOptions.colors = cli.flags.c.split(',');
}

// Create index of fileName -> color
filenames.forEach((f, idx) => {
  let cIdx = idx % appOptions.colors.length;
  appOptions.colorIdx[f] = appOptions.colors[cIdx];
});

let write = console.log;

if (cli.flags.output) {
  const watcher = chokidar.watch(cli.flags.output);
  let stream = fs.createWriteStream(cli.flags.output, {flags: 'a'});

  watcher.on('unlink', () => {
    stream.end();
    stream = fs.createWriteStream(cli.flags.output, {flags: 'a'});
  });

  write = text => {
    stream.write(text + '\n');
  };

  process.on('SIGINT', () => {
    stream.end();
    process.exit();
  });
}

// -------- START SPLEX -----------
write('-------------------');
write('  Starting SpleX   ');
write('----- 🦈  🦈 ------');

// Start tail listeners for each file provided
filenames.forEach(file => {
  tail(file, {
    line: line => {
      let color = appOptions.colorIdx[file];
      switch (optionsSum) {
        case 1: // Tables, same as 3
        case 3:
          // Custom colors + table
          colorPrintTable(color, file, line);
          break;
        case 0: // No options provided
        case 2: // Custom colors provided, print default
          splexPrint(colorPrint(color, file, line));
          break;
        case 4: // Mono - no tables, same as 6
        case 6:
          // Mono + custom colors, invalid combination,
          // just print mono
          splexPrint(monoPrint(file, line));
          break;
        case 5: // Mono - with tables, same as 7
        case 7:
          // Mono + table + custom colors
          // invalid combination, print mono table
          monoPrintTable(file, line);
          break;
        default:
          colorPrint(color, file, line);
          break;
      }
    },
    error: err => {
      write('Error: ', err);
    }
  });

  write(
    chalk[appOptions.colorIdx[file]]('Setting up listener for: ') + file
  );
});

// Color print line, with table flag for tagle format
let colorPrint = function (color, file, line) {
  return (chalk[color](`# ${file}: `) + chalk.white(`${line}`));
};

let colorPrintTable = function (color, file, line) {
  write(chalk[color](`# ${file}: `) + chalk.green('| ') + chalk.white(`${line}`));
  write(chalk.green(appOptions.term.line));
};

// Mono print line with flag for table format
let monoPrint = function (file, line) {
  return (`# ${file}: ${line}`);
};

// Mono print line with flag for table format
let monoPrintTable = function (file, line) {
  write(`# ${file}: | ${line}`);
  write(appOptions.term.line);
};

let splexPrint = function (line) {
  write(line);
};

// Stuff that need to be re-calculated
// on term re-size
// ------------------------------------
let handleChange = function () {
  appOptions.term.size = process.stdout.columns;
  appOptions.term.line = '-'.repeat(process.stdout.columns);
};

// Wait in loop, until someone presses ctrl-c
setInterval(() => {
  handleChange();
}, 1000);
