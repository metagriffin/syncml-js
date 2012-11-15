// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.storage
// auth: griffin <griffin@uberdev.org>
// date: 2012/10/31
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  './logging',
  './common',
  './constant'
], function(
  _,
  logging,
  common,
  constant
) {

  var log = logging.getLogger('jssyncml.storage');
  var exports = {};

  //---------------------------------------------------------------------------
  _.extend(exports, {

    //-------------------------------------------------------------------------
    openDatabase: function(context, cb) {

      var dbreq = context.storage.open(context.dbname, 1);
      dbreq.onblocked = function(event) {
        log.critical('syncml.storage: db "' + context.dbname + '" blocked');
        cb({code: 'jssyncml.storage.OD.10',
            message: 'database blocked by other process/tab/window'});
      };
      dbreq.onerror = function(event) {
        log.critical('syncml.storage: db "' + context.dbname + '" error: '
                     + event.target.errorCode);
        cb({code: 'jssyncml.storage.OD.20',
            message: 'failed to open jssyncml database: '
            + event.target.errorCode});
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
        mappingTable.createIndex('guid', 'guid', {unique: false});
        mappingTable.createIndex('luid', 'luid', {unique: false});

        var changeTable = db.createObjectStore(
          'change',
          {keyPath: ['store_id', 'item_id']});
        changeTable.createIndex('store_id', 'store_id', {unique: false});
        changeTable.createIndex('item_id', 'item_id', {unique: false});

        log.debug('syncml.storage: db "' + context.dbname + '" upgrade complete');

        if ( context.storage.vendor != 'jsindexeddb' )
          return cb(null, db);

        adapterTable._create(function(err) {
          if ( err )
            return cb('failed to create adapter storage: ' + err);
          mappingTable._create(function(err) {
            if ( err )
              return cb('failed to create mapping storage: ' + err);
            changeTable._create(function(err) {
              if ( err )
                return cb('failed to create change storage: ' + err);
              return cb(null, db);
            });
          });
        });

      };
      dbreq.onsuccess = function(event) {
        log.debug('syncml.storage: db "' + context.dbname + '" opened');
        cb(null, event.target.result);
      };
    },

    //-------------------------------------------------------------------------
    getAll: function(source, range, direction, cb) {
      var req = source.openCursor(range, direction);
      var ret = [];
      req.onsuccess = function(event) { 
        var cursor = event.target.result;
        if ( cursor )
        {
          ret.push(cursor.value);
          return cursor.continue();
        }
        cb(null, ret);
      };
      req.onerror = function(event) {
        cb(event.target.error);
      };
    },

    //-------------------------------------------------------------------------
    put: function(store, object, cb) {
      var req = store.put(object);
      req.onsuccess = function(event) { cb(); };
      req.onerror = function(event) {
        cb(event.target.error);
      };
    },

    //-------------------------------------------------------------------------
    delete: function(store, objectID, cb) {
      var req = store.delete(objectID);
      req.onsuccess = function(event) { cb(); };
      req.onerror = function(event) {
        cb(event.target.error);
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
        cb(event.target.error);
      };
    },


  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
