// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the jssyncml module in client-mode
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
  '../src/jssyncml'
], function(_, ET, sqlite3, jsindexeddb, jssyncml) {

  describe('jssyncml-client', function() {

    //-------------------------------------------------------------------------
    var TestAgent = jssyncml.Agent.extend({

      constructor: function(options) {
        this._items = {};
      },

      dumpItem: function(item, stream, contentType, version, cb) {
        stream.write(item.body, cb);
      },

      loadItem: function(stream, contentType, version, cb) {
        stream.read(function(err, data) {
          if ( err )
            cb(err);
          var item = {body: data};
          cb(null, item);
        });
      },

      getAllItems: function(cb) {
        var ret = [];
        for ( var obj in this._items )
          ret.push(obj);
        return cb(null, ret);
      },

      addItem: function(item, cb) {
        item.id = jssyncml.makeID();
        this._items[item.id] = item;
        cb(null, item);
      },

      getItem: function(itemID, cb) {
        if ( this._items[itemID] == undefined )
          cb('no such item ID');
        cb(null, this._items[itemID]);
      },

      replaceItem: function(item, reportChanges, cb) {
        if ( reportChanges )
          cb('changeSpec not expected on the client-side');
        this._items[item.id] = item;
        cb();
      },

      deleteItem: function(itemID, cb) {
        delete this._items[itemID];
        cb();
      },

      getContentTypes: function() {
        return [
          // new jssyncml.ContentTypeInfo('text/x-s4j-sifn', '1.1', {preferred: true}),
          // new jssyncml.ContentTypeInfo('text/x-s4j-sifn', '1.0'),
          new jssyncml.ContentTypeInfo('text/plain', '1.0', {preferred: true})
        ];
      },

    });

    //-------------------------------------------------------------------------
    var setupAdapter = function(callback) {

      var sync = {
        adapter: null,
        store: null,
        agent: new TestAgent()
      };

      //var sdb = new sqlite3.Database(':memory:');
      var sdb = new sqlite3.Database('./test.db');
      var idb = new jsindexeddb.indexedDB('sqlite3', sdb);

      var context = new jssyncml.Context({
        storage: idb,
        prefix:  'memoryBased'
      });

      context.getAdapter(null, function(err, adapter) {

        expect(err).toBeFalsy();

        sync.adapter = adapter;

        var setupDevInfo = function(cb) {
          if ( adapter.devInfo != undefined )
            return cb();
          console.log('==> setting devInfo...');
          adapter.setDevInfo({
            devID               : 'test-jssyncml-devid',
            devType             : jssyncml.DEVTYPE_WORKSTATION,
            manufacturerName    : 'jssyncml',
            modelName           : 'testclient',
            hierarchicalSync    : false
          }, cb);
        }

        var setupPeer = function(cb) {
          if ( adapter.peer != undefined )
            return cb();
          console.log('==> setting peer...');
          adapter.setPeer({
            url      : 'https://www.example.com/funambol/ds',
            auth     : jssyncml.NAMESPACE_AUTH_BASIC,
            username : 'guest',
            password : 'guest'
          }, cb);
        }

        var setupStore = function(cb) {
          sync.store = adapter.getStore('note');
          if ( sync.store != undefined )
          {
            sync.store.agent = sync.agent;
            return cb();
          }
          console.log('==> adding store...');
          adapter.addStore({
            uri          : 'note',
            displayName  : 'Note Storage',
            agent        : sync.agent
          }, function(err, store) {
            if ( err )
              cb(err);
            sync.store = store;
            cb();
          });
        };

        setupDevInfo(function(err) {
          expect(err).toBeFalsy();
          setupPeer(function(err) {
            expect(err).toBeFalsy();
            setupStore(function(err) {
              expect(err).toBeFalsy();
              callback(null, sync);
            });
          });
        });

      });

    };

    //-------------------------------------------------------------------------
    var doFirstSync = function(sync, callback) {
      expect(sync).not.toBeFalsy();
      expect(sync.adapter).not.toBeFalsy();
      expect(sync.store).not.toBeFalsy();
      expect(sync.agent).not.toBeFalsy();

      var scanForChanges = function(cb) {
        // not doing a scan as we will force a slow-sync
        sync.agent._items['1'] = {id: '1', body: 'first'};
        cb();
      };

      // TODO: add jasmine spies here...

      var synchronize = function(cb) {
        sync.adapter.sync(jssyncml.SYNCTYPE_SLOW_SYNC, cb);
      };

      scanForChanges(function(err) {
        expect(err).toBeFalsy();
        synchronize(function(err, stats) {
          expect(err).toBeFalsy();
          expect(_.keys(stats)).toEqual(['note']);
          callback(null, 'complete');
        });
      });

    };

    var sync = {};

    //-------------------------------------------------------------------------
    beforeEach(function(callback) {
      setupAdapter(function(err, ret) {
        expect(err).toBeFalsy();
        sync = ret;
        callback();
      });
    });

    //-------------------------------------------------------------------------
    afterEach(function(callback) {
      sync = {};
      callback();
    });

    //-------------------------------------------------------------------------
    describe('that synchronizes for the first time', function() {

      var done = 'synchronization';

      //-----------------------------------------------------------------------
      beforeEach(function(callback) {
        doFirstSync(sync, function(err, ret) {
          expect(err).toBeFalsy();
          done = ret;
          callback();
        });
      });

      //-----------------------------------------------------------------------
      it('does a slow-sync with all stores', function() {
        expect(done).toEqual('complete');
      });

    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
