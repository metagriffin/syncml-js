// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js/ctype module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'async',
  'elementtree',
  './helpers.js',
  '../src/syncml-js/logging',
  '../src/syncml-js/constant',
  '../src/syncml-js/common',
  '../src/syncml-js/storage',
  '../src/syncml-js'
], function(_, async, ET, helpers, logging, constant, common, storage, syncmljs) {

  describe('syncml-js/storage', function() {

    // jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;

    //-------------------------------------------------------------------------
    it('works with async.nextTick', function(done) {
      async.nextTick(function(timer) {
        // `timer` is not defined in the nodejs version of async.
        if ( typeof(process) == 'undefined' )
          expect(timer).toBeDefined();
        done();
      });
    });

    var shared_idb = null;

    //-------------------------------------------------------------------------
    beforeEach(function() {
      logging.level = logging.WARNING;
      logging.getLogger().addHandler(new logging.ConsoleHandler());
      this.addMatchers(helpers.matchers);
      if ( ! shared_idb )
        shared_idb = helpers.getIndexedDBScope(':memory:');
    });

    //-------------------------------------------------------------------------
    it('tests the .ok() matcher', function() {
      expect(null).ok();
      expect('error!').not.ok();
      expect({error: 'error'}).not.ok();
      expect({}).not.ok();
    });

    //-------------------------------------------------------------------------
    it('tests the .toBeNear() matcher', function() {
      expect(3).toBeNear(4, 1);
      expect(3).not.toBeNear(4, 0.5);
      // expect(3).not.toBeNear(4, 1);
      // expect(3).toBeNear(4, 0.5);
    });

    //-------------------------------------------------------------------------
    var makeErrorHandler = function(name, errtype, cb) {
      var func = function(event) {
        var err = 'unexpected call to "' + name + '.' + errtype + '"';
        if ( event && event.target && event.target.error )
          err += ': ' + storage.errstr(event.target);
        expect(err).toBeNull();
        return cb(err);
      };
      return func;
    };

    //-------------------------------------------------------------------------
    it('checks that the indexedDB versioning works as expected', function(done) {
      var idb = shared_idb;
      var name = 'syncml-js.test.raw.db';
      var request = idb.indexedDB.open(name, 1);
      request.onerror = makeErrorHandler('reuse', 'open.error', done);
      request.onblocked = makeErrorHandler('reuse', 'open.blocked', done);
      request.onsuccess = function(event) {
        var db = event.target.result;
        expect(db.version).toEqual(1);
        expect(event.target.transaction).toBeNull();
        db.close();
        var req2 = idb.indexedDB.open(name, 7);
        req2.onerror = makeErrorHandler('reuse', 'open2.error', done);
        req2.onupgradeneeded = function(event) {
          var db = event.target.result;
          expect(db.version).toEqual(7);
          expect(event.target.transaction.mode).toEqual('versionchange');
        };
        req2.onsuccess = function(event) {
          var db = event.target.result;
          expect(db.version).toEqual(7);
          db.close();
          done();
        };
      };
    });

    //-------------------------------------------------------------------------
    it('fails on downgrade', function(done) {
      var idb = shared_idb;
      var name = 'syncml-js.test.raw.db';
      var request = idb.indexedDB.open(name, 3);
      request.onblocked = makeErrorHandler('reuse2', 'open.blocked', done);
      request.onsuccess = makeErrorHandler('reuse2', 'open.success', done);
      request.onerror = function(event) {
        expect(event.target.error).not.ok();
        expect(event.target.error.name).toBe('VersionError');
        done();
      };
    });

    //-------------------------------------------------------------------------
    it('can be opened again in another test', function(done) {
      var idb = shared_idb;
      var name = 'syncml-js.test.raw.db';
      var request = idb.indexedDB.open(name, 18);
      request.onerror = makeErrorHandler('reuse3', 'open.error', done);
      request.onblocked = makeErrorHandler('reuse3', 'open.blocked', done);
      request.onsuccess = function(event) {
        var db = event.target.result;
        expect(db.version).toEqual(18);
        expect(event.target.transaction).toBeNull();
        db.close();
        var req2 = idb.indexedDB.open(name, 29);
        req2.onerror = makeErrorHandler('reuse3', 'open2.error', done);
        req2.onupgradeneeded = function(event) {
          var db = event.target.result;
          expect(db.version).toEqual(29);
          expect(event.target.transaction.mode).toEqual('versionchange');
        };
        req2.onsuccess = function(event) {
          var db = event.target.result;
          expect(db.version).toEqual(29);
          db.close();
          done();
        };
      };
    });

    var context = null;
    var db      = null;

    //-------------------------------------------------------------------------
    beforeEach(function(callback) {
      if ( db )
      {
        console.log('ERROR: database was not closed!');
        return callback('ERROR: database was not closed!');
      }
      context = new syncmljs.Context({
        storage: helpers.getIndexedDBScope(':memory:'),
        prefix:  'syncml-js.test.storage.' + common.makeID() + '.'
      });
      storage.openDatabase(context, function(err, newdb) {
        if ( err )
          return callback(err);
        db = newdb;
        callback();
      });
    });

    //-------------------------------------------------------------------------
    afterEach(function(callback) {
      if ( db )
        db.close();
      db = null;
      return callback();
    });

    //-------------------------------------------------------------------------
    it('puts of objects with the same keypath replaces earlier objects', function(done) {
      expect(db).toBeTruthy();
      var store = db.transaction(['mapping'], 'readwrite').objectStore('mapping');
      storage.put(store, {store_id: '1', guid: '10', luid: '100'}, function(err) {
        expect(err).ok();
        storage.put(store, {store_id: '2', guid: '10', luid: '200'}, function(err) {
          expect(err).ok();
          storage.put(store, {store_id: '2', guid: '10', luid: '300'}, function(err) {
            expect(err).ok();
            storage.getAll(context, store, {}, function(err, list) {
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
      var store = db.transaction(['mapping'], 'readwrite').objectStore('mapping');
      storage.put(store, {store_id: '1', guid: '10', luid: '100'}, function(err) {
        expect(err).ok();
        storage.put(store, {store_id: '2', guid: '10', luid: '200'}, function(err) {
          expect(err).ok();
          storage.put(store, {store_id: '2', guid: '10', luid: '300'}, function(err) {
            expect(err).ok();
            storage.getAll(context, store, {}, function(err, list) {
              expect(err).ok();
              var luids = _.map(list, function(item) { return item.luid; }).join(',');
              expect(luids).toEqual('100,300');
              storage.deleteAll(store, {store_id: '2'}, function(err) {
                expect(err).ok();
                storage.getAll(context, store, {}, function(err, list) {
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
