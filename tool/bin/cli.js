#!/usr/bin/env node
/* eslint-env node */

const { spawn } = require('child_process');
const chokidar = require('chokidar');
const program = require('commander');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const pkg = require('../../package.json');
const { log } = require('../lib/misc.js');
const protoParser = require('../lib/proto-parser.js');
const WebpackPlugin = require('../plugin/webpack.js');
const server = require('./server.js');

module.exports = new class CommandToolLine {
  constructor() {
    this.appRoot = this.getAppRoot();
    this.setOptions();

    program.environment = program.environment && /^\w+=\w+$/.test(program.environment)
      ? program.environment
      : '';
    this.main();
  }

  /**
   * Main control flow
   */
  main() {
    if (program.init) {
      return this.init();
    }
    if (program.inject) {
      return this.inject();
    }
    if (program.watch) {
      return this.watch();
    }
    if (program.proto) {
      return this.proto();
    }
    if (program.proxy === 'matched' && program.proxy === 'marked') {
      return this.proxy();
    }
    program.help();
  }

  /**
   * -i, --init: Initialize some samples & a .runtime.js in the mock directory
   */
  async init() {
    const dir = path.resolve(this.appRoot, program.directory);
    if (fs.existsSync(dir) && fs.statSync(dir).isFile()) {
      return log(`${dir} already exists and is not directory.`);
    }

    if (!fs.existsSync(dir)) {
      log(`${dir} does not exist.`);
      if (/^(yes|y|)$/i.test(await this.askInput('Are you sure to create it? [Yes/no]'))) {
        fs.mkdirSync(dir, { recursive: true });
      } else {
        return log('Nothing was happened.');
      }
    }

    const webpack = new WebpackPlugin({
      dir,
      entry: /1/,
      type: program.type,
    });
    webpack.environment = program.environment ? program.environment.split('=') : null;

    this.copySampleFiles(dir);

    const runtime = webpack.setRuntimeConfigFile();
    log('A runtime mock entry configuration has been initialized:');
    log(runtime);
  }

  /**
   * -j, --inject <app-entry-file>: Inject .runtime.js into the specified entry relative to the working directory.
   */
  async inject() {
    const appEntryFile = path.resolve(this.appRoot, program.inject);
    if (!fs.existsSync(appEntryFile)) {
      log(`The specified app entry file [\x1b[31m${appEntryFile}\x1b[0m] does not exist.`);
      return;
    }

    await this.init();
    const dir = path.resolve(this.appRoot, program.directory);

    let runtime = path.resolve(dir, '.runtime.js');
    runtime = path.relative(path.resolve(appEntryFile, '../'), runtime);
    runtime = process.platform === 'win32' ? runtime.replace(/\\/g, '/') : runtime;
    runtime = /^\./.test(runtime) ? runtime : ('./'+runtime);

    const entryContent = fs.readFileSync(appEntryFile, 'utf8');
    if (/(\/|\\)\.runtime\.js('|")/.test(entryContent)) {
      log(`The specified application entry file [\x1b[32m${appEntryFile}\x1b[0m] already contains '.runtime.js'.`);
      log('Please check your application entry file.');
      return;
    }

    const isCjs = /\brequire\s*\(/.test(entryContent) && !/\bimport /.test(entryContent);
    const codes = [
      '/* eslint-disable */',
      (isCjs ? `require('${runtime}');` : `import '${runtime}';`),
      '/* eslint-enable */',
    ].join('\n');

    fs.writeFileSync(appEntryFile, codes+'\n'+entryContent);
    log(`[.runtime.js] dependency has been injected into [\x1b[32m${appEntryFile}\x1b[0m].`);
    log('Please check your application entry file.');
  }

  /**
   * -w, --watch [command]:
   * Watch mock directory & update .runtime.js. If the [command] is specified,
   * ths specified command will be executed together with watching.'
   */
  async watch() {
    console.log('this.appRoot:', this.appRoot);
    const dir = path.resolve(this.appRoot, program.directory);
    if (!fs.existsSync(path.resolve(dir, '.runtime.js'))) {
      log(`There is no a .runtime.js file in the mock directory: ${dir}.`);
      log('Please use command(npx http-request-mock-cli -i) to initialize it.');
      return;
    }

    const proxyServer = program.proxy === 'matched' || program.proxy === 'marked'
      ? await server.init({
        type: program.type,
        mockDir: dir,
        environment: program.environment,
        proxyMode: program.proxy
      })
      : null;
    log(`Watching: ${dir}`);
    const webpack = new WebpackPlugin({
      dir,
      entry: /1/,
      type: program.type,
      proxyMode: program.proxy
    });

    webpack.environment = program.environment ? program.environment.split('=') : null;
    if (proxyServer) {
      webpack.proxyServer = program.proxy + '@' + proxyServer;
    }

    const pathsSet = new Set();
    let timer = null;
    webpack.setRuntimeConfigFile(); // update .runtime.js before watching

    chokidar.watch(dir, {ignoreInitial: true}).on('all', (event, filePath) => {
      const filename = path.basename(filePath);
      // Only watch file that matches /^[\w][-\w]*\.js$/
      if (event === 'addDir' || event === 'error') return;
      if(filename && !/^[\w][-\w]*\.js$/.test(filename)) return;

      if (pathsSet.has(filePath)) return;
      pathsSet.add(filePath);

      clearTimeout(timer);
      timer = setTimeout(() => {
        const runtime = webpack.setRuntimeConfigFile();
        proxyServer && server.reload([...pathsSet]);

        console.log(' ');
        log(`${path.relative(path.resolve(dir, '..'), runtime)} has been updated.`);
        pathsSet.clear();
      }, 100);
    });

    if (typeof program.watch === 'string') {
      spawn(program.watch, { cwd: this.appRoot, env: process.env, stdio: 'inherit', detached: false, shell: true });
    }
  }

  /**
   * -p, --proxy [mode]:
   *'Proxy mode. In proxy mode, http-request-mock will start a proxy server which recives
   * incoming requests on localhost. The mock files will be run in a nodejs environment.
   * This feature is designed for browser, so do not use it in a nodjs project.
   * Note: proxy mode is still under experimental stage, only for experts.
   * [matched] All requests matched by @url will be proxied to a proxy server.
   * [marked] All requests marked by @proxy will be proxied to a proxy server.
   */
  proxy() {
    if (program.proxy === 'matched' && program.proxy === 'marked') {
      const dir = path.resolve(this.appRoot, program.directory);
      server.init({ type: program.type, mockDir: dir, environment: program.environment, proxyMode: program.proxy });
    }
  }

  /**
   * --proto: Generate mock files by proto files.
   */
  proto() {
    const configFile = path.resolve(this.appRoot, program.directory, '.protorc.js');
    this.generateProtorcFile(configFile);

    const protorcConfig = require(configFile);
    if (!protorcConfig.protoEntry) {
      console.log('Please set [protoEntry] option in the file below and run this command again.');
      return console.log('.protorc config file: ' + configFile);
    }
    if (!fs.existsSync(protorcConfig.protoEntry)) {
      return console.log(`file: ${protorcConfig.protoEntry} does not exist.`);
    }

    const outputDir = path.resolve(this.appRoot, program.directory, 'proto');
    fs.mkdirSync(outputDir, { recursive: true});
    protoParser.generateMockFiles(protorcConfig, outputDir);
  }

  /**
   * Generate a .protorc.js config file
   * @param {string} filePath
   */
  generateProtorcFile(filePath) {
    if (fs.existsSync(filePath)) {
      return;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true});
    try {
      const tpl = path.resolve(__dirname, '../tpl/protorc.tpl.js');
      const content = fs.readFileSync(tpl).toString().split('\n');
      // replace the first line
      content.splice(0, 1, 'const faker = require(\'http-request-mock/plugin/faker.js\').shadow;');

      fs.writeFileSync(filePath, content.join('\n'));
    } catch(err) {
      console.log('Failed to generate proto config file: ' + err.message);
    }
  }

  /**
   * Ask for input
   * @param {string} question
   */
  askInput(question) {
    return new Promise(resolve => {
      const opts = { input: process.stdin, output: process.stdout };
      const rl = readline.createInterface(opts);
      rl.question(question, (answer) => {
        resolve(answer.trim());
        rl.close();
      });
    });
  }

  /**
   * Copy some samples into the specified mock directory.
   * @param {string} mockDirectory
   */
  copySampleFiles(mockDirectory) {
    fs.mkdirSync(mockDirectory, { recursive: true });

    const sampleTpl = path.resolve(__dirname, '../tpl/sample.tpl.js');
    const mockFile = path.resolve(mockDirectory, './sample.js');

    if (!fs.existsSync(mockFile)) {
      fs.copyFileSync(sampleTpl, mockFile);
    }
  }

  /**
   * Get root directory of current application
   */
  getAppRoot() {
    if (!/\bnode_modules\b/.test(__dirname)) return process.cwd();

    const root = __dirname.split('node_modules')[0];
    const json = path.resolve(root, 'package.json');
    if (!fs.existsSync(json)) return process.cwd();

    return fs.readFileSync(json, 'utf8').includes('"http-request-mock"') ? root : process.cwd();
  }

  /**
   * Set command line options
   */
  setOptions() {
    const spaces = ' '.repeat(34);
    program
      .name('npx http-request-mock-cli')
      .usage('[options]')
      .description([
        `Description: http-request-mock command line tool at version ${pkg.version}.`,
        'Glossary: [.runtime.js] A runtime mock configuration entry file.',
        `Current working directory: \x1b[32m${this.appRoot}\x1b[0m`,
        'Example: ',
        '    npx http-request-mock-cli -i',
      ].join('\n'))
      .option('-d, --directory [directory]', 'The mock directory relative to the working directory.', 'mock')
      .option(
        '-e, --environment [variable-pair]',
        'Enable mock function by environment variable for .runtime.js.\n'+spaces,
        'NODE_ENV=development'
      )
      .option('-i, --init', 'Initialize some samples & a .runtime.js in the mock directory.')
      .option(
        '-w, --watch [command]',
        'Watch mock directory & update .runtime.js. If the [command] is specified,\n'+spaces+
        ' ths specified command will be executed together with watching.'
      )
      .option(
        '-j, --inject <app-entry-file>',
        'Inject .runtime.js into the specified entry relative to the working directory.'
      )
      .option(
        '-t, --type [module-type]',
        'The module type of .runtime.js.\n'+spaces+
        ' Possible values are: es6(alias of ESM), cjs(alias of commonjs).\n'+spaces,
        'cjs'
      )
      .option(
        '-p, --proxy [mode]',
        'Proxy mode. In proxy mode, http-request-mock will start\n'+spaces+
        ' a proxy server which recives incoming requests on localhost.\n'+spaces+
        ' The mock files will be run in a nodejs environment.\n'+spaces+
        ' This feature is designed for browser, so do not use it in a nodjs project.\n'+spaces+
        ' Note: proxy mode is still under experimental stage, only for experts.\n'+spaces+
        ' [matched] All requests matched by @url will be proxied to a proxy server.\n'+spaces+
        ' [marked] All requests marked by @proxy will be proxied to a proxy server.',
        'none'
      )
      .option(
        '--proto',
        'Generate mock files by proto files.'
      )
      .parse(process.argv);
  }
};
