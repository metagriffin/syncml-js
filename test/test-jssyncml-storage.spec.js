// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the jssyncml/ctype module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'elementtree',
  'sqlite3',
  'jsindexeddb',
  './helpers.js',
  '../src/jssyncml/logging',
  '../src/jssyncml/constant',
  '../src/jssyncml/common',
  '../src/jssyncml/storage',
  '../src/jssyncml'
], function(_, ET, sqlite3, jsindexeddb, helpers, logging, constant, common, storage, jssyncml) {
  describe('jssyncml/storage', function() {

    var sdb     = null;
    var idb     = null;
    var context = null;
    var db      = null;

    //-------------------------------------------------------------------------
    beforeEach(function() {
      logging.level = logging.WARNING;
      this.addMatchers(helpers.matchers);
    });

    //-------------------------------------------------------------------------
    beforeEach(function(callback) {
      sdb = new sqlite3.Database(':memory:');
      // sdb = new sqlite3.Database('./test.db');
      idb = new jsindexeddb.indexedDB('sqlite3', sdb);
      var context = new jssyncml.Context({
        storage: idb,
        prefix:  'memoryBasedClient.'
      });
      storage.openDatabase(context, function(err, newdb) {
        if ( err )
          return callback(err);
        db = newdb;
        callback();
      });
    });

    // //-------------------------------------------------------------------------
    // it('tests the .ok() matcher', function() {
    //   expect(null).ok();
    //   expect('ziggy').ok();
    //   expect(null).not.ok();
    // });

    //-------------------------------------------------------------------------
    it('puts of objects with the same keypath replaces earlier objects', function(done) {
      expect(db).toBeTruthy();
      var store = db.transaction(null, 'readwrite').objectStore('mapping');
      storage.put(store, {store_id: '1', guid: '10', luid: '100'}, function(err) {
        expect(err).ok();
        storage.put(store, {store_id: '2', guid: '10', luid: '200'}, function(err) {
          expect(err).ok();
          storage.put(store, {store_id: '2', guid: '10', luid: '300'}, function(err) {
            expect(err).ok();
            storage.getAll(store, null, null, function(err, list) {
              expect(err).ok();
              var luids = _.map(list, function(item) { return item.luid; }).join(',');
              expect(luids).toEqual('100,300');
              done();
            });
          });
        });
      });
    });

    //-------------------------------------------------------------------------
    it('deleteAll() deletes all values from a store or index', function(done) {
      expect(db).toBeTruthy();
      var store = db.transaction(null, 'readwrite').objectStore('mapping');
      storage.put(store, {store_id: '1', guid: '10', luid: '100'}, function(err) {
        expect(err).ok();
        storage.put(store, {store_id: '2', guid: '10', luid: '200'}, function(err) {
          expect(err).ok();
          storage.put(store, {store_id: '2', guid: '10', luid: '300'}, function(err) {
            expect(err).ok();
            storage.getAll(store, null, null, function(err, list) {
              expect(err).ok();
              var luids = _.map(list, function(item) { return item.luid; }).join(',');
              expect(luids).toEqual('100,300');
              storage.deleteAll(store, {store_id: '2'}, function(err) {
                expect(err).ok();
                storage.getAll(store, null, null, function(err, list) {
                  expect(err).ok();
                  var new_luids = _.map(list, function(item) { return item.luid; }).join(',');
                  expect(new_luids).toEqual('100');
                  done();
                });
              });
            });
          });
        });
      });

    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
