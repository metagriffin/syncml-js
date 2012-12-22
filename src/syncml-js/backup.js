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
  './agent'
], function(
  util,
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
    },

    all: function(cb) {
      // return cb(null, _.values(this._items));
    },

    add: function(item, cb) {
      // return cb(null, item);
    },

    get: function(itemID, cb) {
      // return cb(null, this._items['' + itemID]);
    },

    replace: function(item, cb) {
      // return cb();
    },

    delete: function(itemID, cb) {
      // return cb();
    }

  });

  //---------------------------------------------------------------------------
  var Agent = agent.Agent.extend({

    constructor: function(options) {
      this._storage = options.storage;
    },

    getContentTypes: function() {
      return [
        new ctype.ContentTypeInfo('*/*')
      ];
    },

    dumpsItem: function(item, contentType, version, cb) {
      return cb(null, item.body);
    },

    loadsItem: function(data, contentType, version, cb) {
      var item = {body: data};
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
          + '  sync                  update local data with changes made since a backup\n'
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
      // note: 
      self._sdb     = new sqlite3.Database(':memory:');
      self._idb     = new indexeddbjs.indexedDB('sqlite3', self._sdb);
      self._context = new context.Context({storage: self._idb});
      self._context.getEasyClientAdapter({
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
        self._adapter = adapter;
        self._peer    = peer;
        self._adapter.sync(self._peer, constant.SYNCTYPE_DISCOVER, function(err) {
          if ( err )
            return cb(err);
          return cb();
        });
      });
    },

    //-------------------------------------------------------------------------
    discover: function(cb) {
      var s0 = new StdoutStream();
      var s1 = new common.IndentStream(s0);
      var self = this;
      self._discover(function(err) {
        if ( err )
          return cb(err);
        s0.writeln('Remote peer:');
        self._peer.describe(s1, cb);
      });
    },

    //-------------------------------------------------------------------------
    backup: function(cb) {
      var self = this;
      return cb('not implemented');
      self._discover(function(err) {
        if ( err )
          return cb(err);
        self._adapter.clearStores();
        _.each(self._peer.getStores(), function(store) {
          // ...
        });
        self._storage = new ItemStorage({rootdir: options.rootdir});
        self._agent   = new Agent({storage: self._storage});
      });
    },

    //-------------------------------------------------------------------------
    sync: function(cb) {
      var self = this;
      return cb('TODO ::: "sync" not implemented');
    },

    //-------------------------------------------------------------------------
    restore: function(cb) {
      var self = this;
      return cb('TODO ::: "restore" not implemented');
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
