// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/12/22
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'util',
  'fs',
  'path',
  'crypto',
  'underscore',
  'elementtree',
  'argparse',
  'indexeddb-js',
  'sqlite3',
  './logging',
  './common',
  './constant',
  './context',
  './ctype',
  './state',
  './agent'
], function(
  util,
  fs,
  pathmod,
  crypto,
  _,
  ET,
  argparse,
  indexeddbjs,
  sqlite3,
  logging,
  common,
  constant,
  context,
  ctype,
  state,
  agent
) {

  var log = logging.getLogger('syncml-js.backup');
  var exports = {};

  var StdoutStream = common.Stream.extend({
    write: function(data) {
      util.print(data);
    }
  });

  //---------------------------------------------------------------------------
  var ItemStorage = common.Base.extend({

    constructor: function(options) {
      this.rootdir = options.rootdir;
      this.reldir  = options.reldir;
      this.label   = options.label;
    },

    // TODO: make `path` relative to Tool._opts.directory instead of `cwd`...

    _all: function(cb) {
      var self = this;
      var ret  = [];
      fs.readdir(pathmod.join(self.rootdir, self.reldir), function(err, files) {
        if ( err )
          return cb(err);
        common.cascade(files, function(file, cb) {
          var path = pathmod.join(self.reldir, file);
          fs.readFile(pathmod.join(self.rootdir, path), function(err, data) {
            if ( err )
              return cb(err);
            ret.push({path: path, data: data});
            return cb();
          });
        }, function(err) {
          if ( err )
            return cb(err);
          return cb(null, ret);
        });
      });
    },

    all: function(cb) {
      var self = this;
      self._all(function(err, items) {
        if ( err )
          return cb(err);
        return cb(null, _.map(items, function(item) {
          return JSON.parse(item.data);
        }));
      });
    },

    allMeta: function(cb) {
      var self = this;
      self._all(function(err, items) {
        if ( err )
          return cb(err);
        var ret = [];
        common.cascade(items, function(item, cb) {
          fs.stat(pathmod.join(self.rootdir, item.path), function(err, stat) {
            if ( err )
              return cb(err);
            var shasum = crypto.createHash('sha1');
            shasum.update(item.data);
            ret.push({
              id     : JSON.parse(item.data).id,
              path   : item.path,
              sha1   : shasum.digest('hex'),
              mtime  : Math.round(stat.mtime.getTime() / 1000)
            });
            cb();
          });
        }, function(err) {
          if ( err )
            return cb(err);
          return cb(null, ret);
        });
      });
    },

    add: function(item, cb) {
      var self = this;
      item.id = common.makeID();
      fs.writeFile(
        pathmod.join(self.rootdir, self.reldir, item.id + '.json'),
        common.prettyJson(item),
        function(err) {
          if ( err )
            return cb(err);
          log.info('store "%s": added item "%s"', self.label, item.id);
          return cb(null, item);
        }
      );
    },

    get: function(itemID, cb) {
      var self = this;
      fs.readFile(
        pathmod.join(self.rootdir, self.reldir, itemID + '.json'),
        function(err, data) {
          if ( err )
            return cb(err);
          return cb(null, JSON.parse(data));
        }
      );
    },

    replace: function(item, cb) {
      var self = this;
      fs.writeFile(
        pathmod.join(self.rootdir, self.reldir, item.id + '.json'),
        common.prettyJson(item),
        function(err) {
          if ( err )
            return cb(err);
          log.info('store "%s": replaced item "%s"', self.label, item.id);
          return cb();
        }
      );
    },

    delete: function(itemID, cb) {
      fs.unlink(
        pathmod.join(self.rootdir, self.reldir, itemID + '.json'),
        function(err, data) {
          if ( err )
            return cb(err);
          log.info('store "%s": deleted item "%s"', self.label, itemID);
          return cb();
        }
      );
    }

  });

  //---------------------------------------------------------------------------
  var Agent = agent.Agent.extend({

    constructor: function(options) {
      this._storage = options.storage;
      this._contentTypes = options.contentTypes || [
        new ctype.ContentTypeInfo('*/*')
      ];
    },

    getContentTypes: function() {
      return this._contentTypes;
    },

    dumpsItem: function(item, contentType, version, cb) {
      return cb(null, item.body, item.type[0], item.type[1]);
    },

    loadsItem: function(data, contentType, version, cb) {
      var item = {type: [contentType, version], body: data};
      return cb(null, item);
    },

    getAllItems: function(cb) { return this._storage.all(cb); },
    addItem: function(item, cb) { return this._storage.add(item, cb); },
    getItem: function(itemID, cb) { return this._storage.get(itemID, cb); },
    replaceItem: function(item, reportChanges, cb) {
      this._storage.replace(item, cb);
    },
    deleteItem: function(itemID, cb) { return this._storage.delete(itemID, cb); }

  });

  //---------------------------------------------------------------------------
  // override the default help formatter so that the description is left as-is
  // todo: improve this by changing parser.description to be a structure that
  //       then results in calls to addSection() et al.
  var RawDescriptionHelpFormatter = function() {
    argparse.HelpFormatter.apply(this, arguments);
  };
  RawDescriptionHelpFormatter.prototype = new argparse.HelpFormatter();
  RawDescriptionHelpFormatter.prototype._rawText = function (text) {
    return text;
  };
  RawDescriptionHelpFormatter.prototype.addText = function (text) {
    if ( !! text && text.indexOf('SyncML Backup Tool') == 0 )
      return this._addItem(this._rawText, [text]);
    return argparse.HelpFormatter.prototype.addText.call(this, text);
  };

  //---------------------------------------------------------------------------
  exports.Tool = common.Base.extend({

    constructor: function(options) {

      var parser = new argparse.ArgumentParser({
        // TODO: figure out how to pull this dynamically from package.json...
        // version     : '0.0.5',
        addHelp     : true,
        usage       : '%(prog)s [-h] [--version] COMMAND [OPTIONS] DIRECTORY',
        formatterClass : RawDescriptionHelpFormatter,
        description : 'SyncML Backup Tool (syncml-js)\n\nAvailable commands:\n'
          + '  discover              query and display the server\'s data structure\n'
          + '  backup                download server data, overriding local data\n'
          // + '  sync                  update local data with changes made since a backup\n'
          + '  restore               upload local data, overriding server data\n'
      });
      parser.addArgument(['--version'], {
        action   : 'storeTrue',
        help     : 'Show program\'s version number and exit.'
      });
      parser.addArgument(['command'], {
        choices: ['discover', 'backup', 'sync', 'restore']
      });
      parser.addArgument(['-v', '--verbose'], {
        action   : 'count',
        help     : 'increase verbosity of program output'
      });
      parser.addArgument(['-q', '--quiet'], {
        action   : 'storeTrue',
        help     : 'suppress transaction results display'
      });
      parser.addArgument(['-u', '--username'], {
        metavar  : 'USERNAME',
        help     : 'set the username for remote authorization'
      });
      parser.addArgument(['-p', '--password'], {
        metavar  : 'PASSWORD',
        help     : 'set the password for the username specified with "--username"'
      });
      parser.addArgument(['-s', '--server'], {
        metavar  : 'URL',
        help     : 'set the URL to the remote SyncML server'
      });
      parser.addArgument(['-i', '--include-store'], {
        metavar  : 'URI',
        dest     : 'stores',
        action   : 'append',
        help     : 'restrict remote data stores that are operated on to this set (can be specified multiple times to select multiple stores)'
      });
      parser.addArgument(['-e', '--exclude-store'], {
        metavar  : 'URI',
        dest     : 'xstores',
        action   : 'append',
        help     : 'exclusive version of --include-store (ie. specifies the inverse set)'
      });
      // todo: ideally, this should just take a positional parameter...
      parser.addArgument(['--dir'], {
        dest     : 'directory',
        metavar  : 'DIRECTORY',
        required : true,
        help     : 'the directory to store all sync data'
      });
      this._opts    = parser.parseArgs();
      this._sdb     = null;
      this._idb     = null;
      this._context = null;
      this._adapter = null;
      this._peer    = null;

      // TODO: load this._opts.directory + '/.sync/options.json' ...
      //       or do so first?...
    },

    //-------------------------------------------------------------------------
    _discover: function(cb) {
      var self = this;
      // note: using memory-based storage in order to ensure this is not
      //       serialized (since i'm trying to discover the current state)
      var sdb     = new sqlite3.Database(':memory:');
      var idb     = new indexeddbjs.indexedDB('sqlite3', sdb);
      var ctxt    = new context.Context({storage: idb});
      ctxt.getEasyClientAdapter({
        name: 'SyncML Backup Tool (syncml-js) [discover]',
        devInfo: {
          devID               : 'sbt.discover.' + common.makeID(),
          devType             : constant.DEVTYPE_WORKSTATION,
          manufacturerName    : 'syncml-js',
          modelName           : 'syncml-js.backup.tool',
          hierarchicalSync    : false
        },
        stores: [],
        peer: {
          url      : self._opts.server,
          auth     : constant.NAMESPACE_AUTH_BASIC,
          username : self._opts.username,
          password : self._opts.password
        },
        routes: []
      }, function(err, adapter, stores, peer) {
        if ( err )
          return cb(err);
        adapter.sync(peer, constant.SYNCTYPE_DISCOVER, function(err) {
          if ( err )
            return cb(err);
          return cb(null, peer);
        });
      });
    },

    //-------------------------------------------------------------------------
    discover: function(cb) {
      var s0 = new StdoutStream();
      var s1 = new common.IndentStream(s0);
      var self = this;
      self._discover(function(err, peer) {
        if ( err )
          return cb(err);
        s0.writeln('Remote peer:');
        peer.describe(s1, cb);
      });
    },

    //-------------------------------------------------------------------------
    _filterUris: function(uris) {
      var self = this;
      if ( this._opts.stores )
        uris = _.filter(uris, function(uri) {
          return _.indexOf(self._opts.stores, uri) >= 0;
        });
      if ( this._opts.xstores )
        uris = _.filter(uris, function(uri) {
          return _.indexOf(self._opts.xstores, uri) < 0;
        });
      return uris;
    },

    //-------------------------------------------------------------------------
    _prepDirectory: function(clear, cb) {
      var self = this;
      common.cascade([
        _.bind(common.rmfr, null, self._opts.directory),
        _.bind(common.makedirs, null, self._opts.directory + '/.sync'),
        _.bind(common.makedirs, null, self._opts.directory + '/stores'),
        function(cb) {
          // TODO: i think the adapter already stores all of this... so is
          //       there really a need to store it again?
          var opts = _.pick(self._opts, 'server', 'username', 'password', 'stores', 'xstores');
          opts = 
          fs.writeFile(
            self._opts.directory + '/.sync/options.json',
            common.prettyJson(opts),
            cb);
        }
      ], cb);
    },

    //-------------------------------------------------------------------------
    backup: function(cb) {
      var self = this;
      self._discover(function(err, peer) {
        if ( err )
          return cb(err);
        var uris = _.map(peer.getStores(), function(store) {
          return store.uri;
        })
        log.debug('remote stores: ' + uris.join(', '));
        uris = self._filterUris(uris);
        log.debug('backing up stores: ' + uris.join(', '));
        var stores = [];
        var routes = [];
        common.cascade([
          // todo: really clear the directory?... what if i just want to do
          //       a fresh backup from the same stored info?...
          // setup the storage directory structure
          _.bind(self._prepDirectory, self, true),
          // configure local stores and agents
          function(cb) {
            common.cascade(uris, function(uri, cb) {
              log.debug('setting up local storage and agent for uri "%s"', uri);
              var pstore = peer.getStore(uri);
              var sdir   = self._opts.directory + '/stores/' + common.urlEncode(uri);
              common.makedirs(sdir, function(err) {
                if ( err )
                  return cb(err);
                var storage = new ItemStorage({
                  rootdir  : self._opts.directory,
                  reldir   : 'stores/' + common.urlEncode(uri),
                  label    : uri
                });
                var agent   = new Agent({
                  storage      : storage,
                  contentTypes : pstore.getContentTypes()
                });
                stores.push({
                  uri          : uri,
                  displayName  : 'sbt backup of "' + uri + '"',
                  maxGuidSize  : common.platformBits(),
                  // maxObjSize   : common.getMaxMemorySize(),
                  agent        : agent
                });
                routes.push([uri, uri]);
                cb();
              });
            }, cb);
          },
          // execute the sync
          function(cb) {

            // todo: should these be Tool member variables?...

            var sdb     = new sqlite3.Database(self._opts.directory + '/.sync/syncml.db');
            var idb     = new indexeddbjs.indexedDB('sqlite3', sdb);
            var ctxt    = new context.Context({storage: idb});
            ctxt.getEasyClientAdapter({
              name: 'SyncML Backup Tool (syncml-js)',
              devInfo: {
                devID               : 'sbt.' + common.makeID(),
                devType             : constant.DEVTYPE_WORKSTATION,
                manufacturerName    : 'syncml-js',
                modelName           : 'syncml-js.backup.tool',
                hierarchicalSync    : false
              },
              stores: stores,
              peer: {
                url      : self._opts.server,
                auth     : constant.NAMESPACE_AUTH_BASIC,
                username : self._opts.username,
                password : self._opts.password
              },
              routes: routes
            }, function(err, adapter, stores, peer) {
              if ( err )
                return cb(err);
              adapter.sync(peer, constant.SYNCTYPE_REFRESH_FROM_SERVER, function(err, stats) {
                if ( err )
                  return cb(err);
                if ( ! self._opts.quiet )
                {
                  var s0 = new StdoutStream();
                  state.describeStats(stats, s0, {
                    title: 'SyncML Backup Tool Results'
                  });
                }
                return cb();
              });
            });

          },

          // create a snapshot (so that change detection can happen)
          function(cb) {

            var snapshot = {};

            common.cascade(stores, function(store, cb) {
              snapshot[store.uri] = {};
              store.agent._storage.allMeta(function(err, items) {
                if ( err )
                  return cb(err);
                _.each(items, function(item) {
                  snapshot[store.uri][item.id] = item;
                });
                return cb();
              });
            }, function(err, cb) {
              fs.writeFile(
                self._opts.directory + '/.sync/snapshot.json',
                common.prettyJson(snapshot),
                cb);
            });

          }

        ], cb);
      });
    },

    //-------------------------------------------------------------------------
    sync: function(cb) {
      var self = this;
      return cb('TODO ::: "sync" not implemented');

      // TODO: implement

    },

    //-------------------------------------------------------------------------
    restore: function(cb) {
      var self = this;
      return cb('TODO ::: "restore" not implemented');

      // TODO: implement

    },

    //-------------------------------------------------------------------------
    version: function(cb) {
      // TODO: figure out how to pull this dynamically from package.json...
      util.puts('0.0.5');
      return cb();
    },

    //-------------------------------------------------------------------------
    exec: function(cb) {
      switch ( this._opts.verbose )
      {
        case null:
        case 0:  logging.level = logging.WARNING; break;
        case 1:  logging.level = logging.INFO;    break;
        case 2:  logging.level = logging.DEBUG;   break;
        default:
        case 3:  logging.level = logging.NOTSET;  break;
      }
      if ( this._opts.version )
        return this.version(cb);
      return this[this._opts.command].call(this, cb);
    }

  }, {

    //-------------------------------------------------------------------------
    main: function(args, cb) {
      args = args || process.argv;
      var tool = new exports.Tool({args: args});
      tool.exec(cb || function(err) {
        if ( err )
          util.error('[**] ERROR: ' + err);
      });
    }

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
