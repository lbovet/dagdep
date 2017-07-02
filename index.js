#! /usr/bin/env node
const usage = require('command-line-usage');
const parallel = require('through2-concurrent');
const diff = require('diff-stream');
const filter = require('stream-filter');
const through2 = require('through2');
const map = require('through2-map');
const pooling = require('generic-pool');
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
if(process.argv.indexOf('--help') == -1) {
  // resolve plugins
  const resolver = require(`./resolver/${conf.resolver.type}.js`)(conf.resolver, conf.repository);
  const repository = require(`./repository/${conf.repository.type}.js`)(conf.repository, resolver);
  const database = require(`./database/${conf.database.type}.js`)(conf.database);
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
        console.log(e.stack);
      }
    });
  };
  // do the job
  diff(repository.artifacts(), database.artifacts())
    .pipe(filter.obj(data => data[0] && !data[1])) // keep the artifacts that exist only in the repository
    .pipe(map.obj(data => data[0]))
    .pipe(parallel.obj({maxConcurrency: conf.parallel}, resolve))
    .pipe(database.updates())
    .on('finish',() => pool.drain().then(pool.clear()))
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
