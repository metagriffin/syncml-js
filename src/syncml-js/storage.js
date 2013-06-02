// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  syncml-js.storage
// auth: griffin <griffin@uberdev.org>
// date: 2012/10/31
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  'async',
  './logging',
  './common',
  './constant'
], function(
  _,
  async,
  logging,
  common,
  constant
) {

  var log = logging.getLogger('syncml-js.storage');
  var exports = {};

  //---------------------------------------------------------------------------
  _.extend(exports, {

    //-------------------------------------------------------------------------
    errstr: function(target) {
      if ( target.error && typeof(target.error.toString) == 'function' )
        return target.error.toString();
      var ret = '';
      var count = 0;
      for ( var key in target.error )
        count += 1;
      if ( count == 1 && target.error.name )
        ret = '' + target.error.name;
      else
      {
        ret = '{';
        for ( var key in target.error )
        {
          ret += key + ': ' + target.error[key];
          count -= 1;
          if ( count > 0 )
            ret += ', ';
        }
      }
      if ( target.errorCode )
      {
        if ( ret.length <= 0 || ret == '{}' )
          ret = '' + target.errorCode;
        else
          ret = '[' + target.errorCode + '] ' + ret;
      }
      if ( ret.length <= 0 || ret == '{}' )
        // last ditch effort...
        ret = common.prettyJson(target);
      return ret;
    },

    //-------------------------------------------------------------------------
    openDatabase: function(context, cb) {
      var dbreq = context.storage.indexedDB.open(context.dbname, 1);
      dbreq.onblocked = function(event) {
        log.critical('syncml.storage: db "' + context.dbname + '" blocked');
        cb({code: 'syncml-js.storage.OD.10',
            message: 'database blocked by other process/tab/window'});
      };
      dbreq.onerror = function(event) {
        var errmsg = exports.errstr(event.target);
        log.critical('syncml.storage: db "%s" error: %s', context.dbname, errmsg);
        cb({code: 'syncml-js.storage.OD.20',
            message: 'failed to open syncml-js database: ' + errmsg});
      };
      dbreq.onupgradeneeded = function(event) {

        log.debug('syncml.storage: db "' + context.dbname + '" upgrade needed');

        var db = event.target.result;

        var adapterTable = db.createObjectStore('adapter', {keyPath: 'id'});
        adapterTable.createIndex('isLocal', 'isLocal', {unique: false});
        adapterTable.createIndex('devID', 'devID', {unique: true});

        var mappingTable = db.createObjectStore(
          'mapping',
          {keyPath: ['store_id', 'guid']});
        mappingTable.createIndex('store_id', 'store_id', {unique: false});
        // mappingTable.createIndex('guid', 'guid', {unique: false});
        // mappingTable.createIndex('luid', 'luid', {unique: false});

        var changeTable = db.createObjectStore(
          'change',
          {keyPath: ['store_id', 'item_id']});
        changeTable.createIndex('store_id', 'store_id', {unique: false});
        // changeTable.createIndex('item_id', 'item_id', {unique: false});

        log.debug('syncml.storage: db "' + context.dbname + '" upgrade complete');
      };
      dbreq.onsuccess = function(event) {
        log.debug('syncml.storage: db "' + context.dbname + '" opened');
        cb(null, event.target.result);
      };
    },

    //-------------------------------------------------------------------------
    getTransaction: function(db, tables, mode) {
      // NOTE: the spec says passing in null should be valid... but
      //       mozilla's indexedDB seems to barf with:
      //         [Exception... "The operation failed because the
      //         requested database object could not be found. For
      //         example, an object store did not exist but was
      //         being opened."  code: "8" nsresult: "0x80660003
      //         (NotFoundError)"
      if ( ! tables )
        tables = ['adapter','mapping','change'];
      if ( ! mode )
        mode = 'readwrite';
      return db.transaction(tables, mode);
    },

    //-------------------------------------------------------------------------
    dumpDatabase: function(context, cb) {

      var ret = {};
      var txn = context._txn();

      var steps = [
        function(cb) {
          exports.getAll(context, txn.objectStore('adapter'), {}, function(err, adapters) {
            ret.adapter = adapters;
            return cb(err);
          });
        },
        function(cb) {
          exports.getAll(context, txn.objectStore('mapping'), {}, function(err, mappings) {
            ret.mapping = mappings;
            return cb(err);
          });
        },
        function(cb) {
          exports.getAll(context, txn.objectStore('change'), {}, function(err, changes) {
            ret.change = changes;
            return cb(err);
          });
        }
      ];

      common.cascade(steps, function(step, cb) {
        return step(cb);
      }, function(err) {
        return cb(err, ret);
      });
    },

    //-------------------------------------------------------------------------
    clearDatabase: function(context, cb) {
      log.warning('Storage.clearDatabase() called -- this is an untested function!');
      var dbreq = context.storage.indexedDB.open(context.dbname, 1);
      dbreq.onblocked = function(event) {
        log.critical('syncml.storage: db "' + context.dbname + '" blocked');
        cb({code: 'syncml-js.storage.CD.10',
            message: 'database blocked by other process/tab/window'});
      };
      dbreq.onerror = function(event) {
        var errmsg = exports.errstr(event.target);
        log.critical('syncml.storage: db "%s" error: %s', context.dbname, errmsg);
        cb({code: 'syncml-js.storage.CD.20',
            message: 'failed to open syncml-js database: ' + errmsg});
      };
      dbreq.onsuccess = function(event) {
        var db = event.target.result;
        db.onerror = dbreq.onerror;
        log.debug('syncml.storage: clearing db "' + context.dbname + '"');
        async.map(['adapter', 'mapping', 'change'], function(name, cb) {
          log.debug('syncml.storage: clearing table "' + context.dbname + '.' + name + '"');
          cb();
        }, function(err) {
          if ( err )
            return cb(err);
          db.close();
        });
      };
    },

    //-------------------------------------------------------------------------
    getAll: function(context, source, options, cb) {
      // supported options:
      //   - range
      //   - only
      options = options || {};
      var range = options.range;
      if ( ! range && options.only )
        range = context.storage.IDBKeyRange.only(options.only);
      var req = source.openCursor(range);
      var ret = [];
      req.onsuccess = function(event) {
        var cursor = event.target.result;
        if ( cursor )
        {
          ret.push(cursor.value);
          // ret.push({key: cursor.key, value: cursor.value});
          return cursor.continue();
        }
        cb(null, ret);
      };
      req.onerror = function(event) {
        cb(exports.errstr(event.target));
      };
    },

    //-------------------------------------------------------------------------
    put: function(store, object, cb) {
      var req = store.put(object);
      req.onsuccess = function(event) { cb(); };
      req.onerror = function(event) {
        cb(exports.errstr(event.target));
      };
    },

    //-------------------------------------------------------------------------
    delete: function(store, objectID, cb) {
      var req = store.delete(objectID);
      req.onsuccess = function(event) { cb(); };
      req.onerror = function(event) {
        cb(exports.errstr(event.target));
      };
    },

    //-------------------------------------------------------------------------
    deleteAll: function(source, matches, cb) {
      var req = source.openCursor();
      req.onsuccess = function(event) {
        var cursor = event.target.result;
        if ( cursor )
        {
          for (key in matches)
            if ( matches[key] != cursor.value[key] )
              return cursor.continue();
          exports.delete(source, cursor.key, function(err) {
            if ( err )
              return cb(err);
            return cursor.continue();
          });
          return;
        }
        cb(null);
      };
      req.onerror = function(event) {
        cb(exports.errstr(event.target));
      };
    },

    //-------------------------------------------------------------------------
    iterateCursor: function(openCursor, iterator, cb) {
      openCursor.onsuccess = function(event) {
        var cursor = event.target.result;
        if ( ! cursor )
          return cb();
        iterator(cursor.value.value, cursor.value.id, function(err) {
          if ( err )
            return cb(err);
          return cursor.continue();
        });
      };
      openCursor.onerror = function(event) {
        cb(exports.errstr(event.target));
      };
    }

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
