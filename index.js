#! /usr/bin/env node
const usage = require('command-line-usage');
const parallel = require('parallel-transform');
const diff = require('diff-stream');
const filter = require('stream-filter');
const through2 = require('through2');
const map = require("through2-map")
const conf = require('rc')('dagdep', {
  repository: {
    type: 'filesystem'
  },
  resolver: {
    type: 'chain'
  },
  database: {
    type: 'filesystem'
  },
  parallel: 1
});

if(process.argv.indexOf('--help') == -1) {
  const repository = require(`./repository/${conf.repository.type}.js`)(conf.repository);
  const resolver = require(`./resolver/${conf.resolver.type}.js`)(conf.resolver, conf.repository);
  const database = require(`./database/${conf.database.type}.js`)(conf.database);
  diff(repository.artifacts(), database.artifacts())
    .pipe(filter.obj(data => data[0] && !data[1])) // keep the ones that exist only in the repository
    .pipe(map.obj(data => data[0]))
    .pipe(parallel(conf.parallel, {ordered:false}, resolver.resolve()))
    .pipe(database.updates());
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
          name: 'resolver.type',
          typeLabel: '[maven|nuget|npm|chain]',
          description: 'Repository for artifact resolution. Defaults to [bold]{chain} if no context is given. [bold]{maven}, otherwise.'
        },
        {
          name: 'resolver.context',
          typeLabel: '[underline]{resolution-context}',
          description: 'Repository context for artifact resolution'
        },
        {
          name: 'resolver.visit',
          typeLabel: '[underline]{visit-context}, ...',
          description: 'Repository contexts to visit, defaults to [underline]{resolution-context}'
        },
        {
          name: 'database.type',
          typeLabel: '[neo4j|filesystem]',
          description: 'Database type. Defaults to [bold]{filesystem} if no context is given. [bold]{neo4j}, otherwise'
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
