#! /usr/bin/env node
const usage = require('command-line-usage');
const parallel = require('through2-concurrent');
const diff = require('diff-stream');
const filter = require('stream-filter');
const through2 = require('through2');
const map = require('through2-map');
const pooling = require('generic-pool');
const status = require('log-update');
const fs = require('fs');
const chalk = require('chalk');
const conf = require('rc')('dagdep', {
  repository: {},
  resolver: {},
  database: {},
  parallel: 1
});
if(!conf.repository.type) {
  conf.repository.type = conf.repository.url ? 'artifactory' : 'filesystem'
}
if(!conf.resolver.type) {
  conf.resolver.type = conf.repository.context ? 'maven' : 'chain'
}
if(!conf.database.type) {
  conf.database.type = conf.database.url ? 'neo4j' : 'filesystem'
}
const debug = (process.argv.indexOf('-d') != -1)
const trace = (name) => (data) => { if(debug) console.log(name, data) }
if(process.argv.indexOf('--help') == -1) {
  // status bar
  console.log(chalk.magenta(conf.repository.type)+' '+
    chalk.cyan(("                 "+conf.resolver.type).slice(-17)) +' '+
    chalk.green(("              "+conf.database.type).slice(-15)))
  var nicetime = (seconds) => {
    var minutes = (seconds / 60);
    var time = (minutes < 2) ? seconds : minutes;
    return Math.trunc(time) + (minutes < 2 ?  's' : 'm');
  };
  var counts = { repo: 0, db: 0, resolving: 0, resolved: 0, deps:0, updated: 0 };
  const inc = (counter) => (data) => { if(data) counts[counter]++; return data }
  var statusTimer;
  var buffer=[]
  if(!debug) statusTimer = setInterval(() => {
    buffer.unshift(counts.resolved)
    if(buffer.length > 60) buffer.pop()
    var throughput = Math.trunc(60*(buffer[0]-buffer.slice(-1))/buffer.length)
    status(
      chalk.magenta('r'+("      " + counts.repo).slice(-6)) + ' ' +
      chalk.green('d'+("      " + counts.db).slice(-6)) + ' ' +
      chalk.blue('g'+("      " + counts.resolving).slice(-6)) + ' ' +
      chalk.cyan('s'+("      " + counts.resolved).slice(-6)) + ' ' +
      chalk.white('d'+("      " + counts.deps).slice(-6)) + ' ' +
      chalk.green('u'+("      " + counts.updated).slice(-6)) + ' ' +
      chalk.yellow(("    " + throughput).slice(-4)+ '/m ') +
      chalk.yellow(("     "+nicetime(process.uptime())).slice(-5)));
  }, 1000);
  // resolve plugins
  const resolver = require(`./resolver/${conf.resolver.type}.js`)(conf.resolver, conf.repository);
  const repository = require(`./repository/${conf.repository.type}.js`)(conf.repository, resolver);
  const database = require(`./database/${conf.database.type}.js`)(conf.database, conf.resolver.type);
  // create a pool of resolve functions
  const pool = pooling.createPool({
    create: () => Promise.resolve(resolver.resolve()),
    destroy: fn => fn.destroy ? fn.destroy() : null
  }, { min: conf.parallel, max: conf.parallel });
  // resolve function proxy wrapping the pool aquire/release
  const resolve = function(data, enc, cb) {
    var self = this;
    pool.acquire().then( fn => {
      try {
        fn.bind(self)(data, enc, () => {
          pool.release(fn);
          cb();
        });
      } catch(e) {
        pool.release(fn);
        console.error(e.stack);
      }
    });
  };
  // normalize resolver output for database insert
  const normalize = function(data) {
    var result;
    if(!data) return data;
    if(data.type === 'dependency') {
      result = {
        type: 'dependency',
        source: resolver.parse(data.source.id),
        target: resolver.parse(data.target.id)
      }
      result.source.type = conf.resolver.type;
      result.target.type = conf.resolver.type;
      counts.deps++;
    } else if(data.type === 'artifact') {
      var artifact = resolver.parse(data.id);
      artifact.type = conf.resolver.type;
      artifact.status = data.status;
      var result = {
        type: 'artifact',
        artifact: artifact
      }
      counts.resolved++;
    }
    return result;
  };
  // do the job
  diff(repository.artifacts().pipe(map.obj(inc('repo'))).on('data', trace('repo')),
       database.artifacts().pipe(map.obj(inc('db')))
        .pipe(map.obj(data => {
          return { id: resolver.format(data) }
        }))
        .on('data', trace('db')))
    .on('data', trace('compared'))
    .pipe(filter.obj(data => data[0] && !data[1])) // keep the artifacts that exist only in the repository
    .pipe(map.obj(data => data[0]))
    .pipe(map.obj(inc('resolving')))
    .pipe(parallel.obj({maxConcurrency: conf.parallel, highWaterMark: 262144}, resolve))
    .pipe(map.obj(normalize))
    .pipe(parallel.obj({maxConcurrency: conf.parallel, highWaterMark: 262144}, database.updates()))
    .pipe(map.obj(inc('updated')))
    .pipe(map.obj(data => JSON.stringify(data)+'\n'))
    .pipe(fs.createWriteStream('output.log'))
    .on('finish',() => pool.drain().then(() => {
      if(statusTimer) setTimeout(() => clearInterval(statusTimer), 1000);
      pool.clear();
      database.close();
    }))
} else {
  // usage
  const sections = [
    {
      content: '[yellow]{[bold]{dagdep}} - Extracts module dependencies to feed a graph database model'
    },
    {
      header: 'Synopsis',
      content: [
        '$ dagdep <options>',
        '',
        'The options can be specified in any form specified in [bold]{rc}.',
        'See https://www.npmjs.com/package/rc.'
      ]
    },
    {
      header: 'Options',
      optionList: [
        {
          name: 'repository.type',
          typeLabel: '[artifactory|stdin]',
          description: 'Repository type. Defaults to [bold]{stdin} if no URL is given. [bold]{artifactory}, otherwise.'
        },
        {
          name: 'repository.url',
          typeLabel: '[underline]{url}',
          description: 'Repository base URL'
        },
        {
          name: 'repository.username',
          typeLabel: '[underline]{username}',
          description: 'Repository credentials'
        },
        {
          name: 'repository.password',
          typeLabel: '[underline]{password}'
        },
        {
          name: 'repository.context',
          typeLabel: '[underline]{repository-context}',
          description: 'Repository context for artifact resolution'
        },
        {
          name: 'repository.visit',
          typeLabel: '[underline]{visit-context}, ...',
          description: 'Repository contexts to visit, defaults to [underline]{repository-context}'
        },
        {
          name: 'resolver.type',
          typeLabel: '[maven|nuget|npm|chain]',
          description: 'Repository for artifact resolution. Defaults to [bold]{chain} if no repository context is given. [bold]{maven}, otherwise.'
        },
        {
          name: 'database.type',
          typeLabel: '[neo4j|filesystem]',
          description: 'Database type. Defaults to [bold]{filesystem} if no URL is given. [bold]{neo4j}, otherwise'
        },
        {
          name: 'database.url',
          typeLabel: '[underline]{url}',
          description: 'Database URL'
        },
        {
          name: 'database.username',
          typeLabel: '[underline]{username}',
          description: 'Database credentials'
        },
        {
          name: 'database.password',
          typeLabel: '[underline]{password}'
        },
        {
          name: 'help',
          description: 'Print this usage guide.'
        }
      ]
    }
  ];
  console.log(usage(sections));
  process.exit(1);
}
