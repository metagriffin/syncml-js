// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'sqlite3',
  'indexeddb-js',
  '../src/syncml-js',
  '../src/syncml-js/logging',
  '../src/syncml-js/common',
  './helpers.js'
], function(_, sqlite3, indexeddbjs, syncml, logging, common, helpers) {

  describe('syncml-js', function() {

    beforeEach(function () {
      logging.level = logging.WARNING;
      this.addMatchers(helpers.matchers);
    });

    //-------------------------------------------------------------------------
    it('declares a version', function() {
      expect(syncml.version).not.toBeUndefined();
      expect(syncml.version).not.toBeNull();
      expect(syncml.version).toMatch(/^\d+\.\d+\.\d$/);
    });

    var sync = {};

    //-------------------------------------------------------------------------
    beforeEach(function(callback) {

      sync = {
        sdb:     new sqlite3.Database(':memory:'),
        // sdb:     new sqlite3.Database('./test.db'),
        server:  {
          context: null,
          adapter: null,
          store:   null,
          agent:   new helpers.TestAgent({startID: 100})
        },
        c1: {
          context: null,
          adapter: null,
          store:   null,
          peer:    null,
          agent:   new helpers.TestAgent({startID: 200})
        },
        c2: {
          context: null,
          adapter: null,
          store:   null,
          peer:    null,
          agent:   new helpers.TestAgent({startID: 300})
        },
        c3: {
          context: null,
          adapter: null,
          store:   null,
          peer:    null,
          agent:   new helpers.TestAgent({startID: 400})
        }
      };

      sync.idb = new indexeddbjs.indexedDB('sqlite3', sync.sdb);

      sync.server.context = new syncml.Context({
        storage: sync.idb,
        prefix:  'memoryBasedServer.'
      });

      sync.c1.context = new syncml.Context({
        storage: sync.idb,
        prefix:  'memoryBasedClient1.'
      });

      sync.c2.context = new syncml.Context({
        storage: sync.idb,
        prefix:  'memoryBasedClient2.'
      });

      sync.c3.context = new syncml.Context({
        storage: sync.idb,
        prefix:  'memoryBasedClient3.'
      });

      var setup_server = function(cb) {
        sync.server.context.getAdapter({name: 'In-Memory Test Server'}, null, function(err, adapter) {
          expect(err).ok();
          sync.server.adapter = adapter;
          var setupDevInfo = function(cb) {
            if ( adapter.devInfo != undefined )
              return cb();
            adapter.setDevInfo({
              devID               : 'test-syncml-js-server-devid',
              devType             : syncml.DEVTYPE_SERVER,
              manufacturerName    : 'syncml-js',
              modelName           : 'testserver',
              hierarchicalSync    : false
            }, cb);
          }
          var setupStore = function(cb) {
            sync.server.store = adapter.getStore('srv_note');
            if ( sync.server.store != undefined )
            {
              sync.server.store.agent = sync.server.agent;
              return cb();
            }
            adapter.addStore({
              uri          : 'srv_note',
              displayName  : 'Server Note Store',
              maxGuidSize  : 32,
              maxObjSize   : 2147483647,
              agent        : sync.server.agent
            }, function(err, store) {
              if ( err )
                cb(err);
              sync.server.store = store;
              cb();
            });
          };
          setupDevInfo(function(err) {
            expect(err).ok();
            if ( err )
              return cb(err);
            setupStore(function(err) {
              expect(err).ok();
              cb(err);
            });
          });
        });
      };

      var setup_client = function(name, shortname, syncobj, cb) {
        syncobj.context.getEasyClientAdapter({
          name: 'In-Memory Test ' + name,
          devInfo: {
            devID               : 'test-syncml-js-client-' + shortname,
            devType             : syncml.DEVTYPE_WORKSTATION,
            manufacturerName    : 'syncml-js',
            modelName           : 'syncml-js.test.suite.client.' + shortname,
            hierarchicalSync    : false
          },
          stores: [
            {
              uri          : 'cli_memo',
              displayName  : 'Memo Taker',
              maxGuidSize  : helpers.getAddressSize(),
              maxObjSize   : helpers.getMaxMemorySize(),
              agent        : syncobj.agent
            }
          ],
          peer: {
            url      : 'https://example.com/sync',
            auth     : syncml.NAMESPACE_AUTH_BASIC,
            username : 'guest',
            password : 'guest'
          },
          routes: [
            [ 'cli_memo', 'srv_note' ],
          ]
        }, function(err, adapter, stores, peer) {
          expect(err).ok();
          if ( err )
            return cb(err);
          expect(adapter).toBeTruthy();
          expect(stores.length).toEqual(1);
          expect(peer).toBeTruthy();
          syncobj.adapter = adapter;
          syncobj.store   = stores[0];
          syncobj.peer    = peer;
          syncobj.peer._proxy = {
            sendRequest: function(txn, contentType, requestBody, cb) {
              if ( ! syncobj.session )
                syncobj.session = syncml.makeSessionInfo({effectiveID: 'https://example.com/sync'});
              var session   = syncobj.session;
              var collector = new helpers.ResponseCollector();
              var authorize = function(uri, data, cb) { return cb(); };
              var request   = {
                headers: { 'Content-Type': contentType},
                body:    requestBody
              };
              sync.server.adapter.handleRequest(request, session, authorize, collector.write, function(err) {
                expect(err).ok();
                expect(collector.contentTypes).toEqual(['application/vnd.syncml+xml; charset=UTF-8']);
                expect(collector.contents.length).toEqual(1);
                var response = {
                  headers: { 'Content-Type': collector.contentTypes[0]},
                  body:    collector.contents[0]
                };
                cb(err, response);
              });
            }
          };
          cb(null);
        });
      };

      setup_server(function(err) {
        expect(err).ok();
        if ( err )
          return callback(err);
        setup_client('Client 1', 'c1', sync.c1, function(err) {
          expect(err).ok();
          if ( err )
            return callback(err);
          setup_client('Client 2', 'c2', sync.c2, function(err) {
            expect(err).ok();
            if ( err )
              return callback(err);
            setup_client('Client 3', 'c3', sync.c3, function(err) {
              expect(err).ok();
              if ( err )
                return callback(err);
              callback();
            });
          });
        });
      });

    });

    //-------------------------------------------------------------------------
    afterEach(function(callback) {
      sync = {};
      callback();
    });

    //-------------------------------------------------------------------------
    it('propagates initial data', function(done) {

      var steps = [

        // initialize data
        function (cb) {
          sync.c1.agent.addItem({body: 'some c1 data'}, function(err) {
            sync.c2.agent.addItem({body: 'some c2 data'}, cb);
          });
        },

        // initial sync c1 with server
        function (cb) {
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_AUTO, cb);
        },

        // initial sync c2 with server
        function (cb) {
          sync.c2.adapter.sync(sync.c2.peer, syncml.SYNCTYPE_AUTO, cb);
        },

        // initial sync c3 with server
        function (cb) {
          sync.c3.adapter.sync(sync.c3.peer, syncml.SYNCTYPE_AUTO, cb);
        },

        // validate data...
        function (cb) {
          expect(sync.server.agent._items).toEqual({
            '100': {id: '100', body: 'some c1 data'},
            '101': {id: '101', body: 'some c2 data'}
          });
          expect(sync.c1.agent._items).toEqual({
            // note: c1 was sync'd before c2, so will not have c2 data
            '200': {id: '200', body: 'some c1 data'}
          });
          expect(sync.c2.agent._items).toEqual({
            '300': {id: '300', body: 'some c2 data'},
            '301': {id: '301', body: 'some c1 data'}
          });
          expect(sync.c3.agent._items).toEqual({
            '400': {id: '400', body: 'some c1 data'},
            '401': {id: '401', body: 'some c2 data'}
          });
          cb();
        }
      ];

      common.cascade(steps, function(step, cb) {
        step(cb);
      }, function(err) {
        expect(err).ok();
        done(err);
      });
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
