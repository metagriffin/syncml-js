// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js module user-agent decision delegating
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2013/06/07
// copy: (C) CopyLoose 2013 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'async',
  '../src/syncml-js',
  '../src/syncml-js/logging',
  '../src/syncml-js/common',
  '../src/syncml-js/storage',
  './helpers.js'
], function(_, async, syncml, logging, common, storage, helpers) {

  var log = 

  describe('syncml-js/useragent', function() {

    var handler = new logging.ConsoleHandler();

    beforeEach(function () {
      // logging.level = logging.NOTSET;
      logging.level = logging.WARNING;
      logging.getLogger().addHandler(handler);
      this.addMatchers(helpers.matchers);
    });

    afterEach(function() {
      logging.getLogger().removeHandler(handler);
    });

    //-------------------------------------------------------------------------
    // TODO.BEGIN: this is the exact same code as in test-syncml-js.spec.js... DRY!

    var sync = {};

    //-------------------------------------------------------------------------
    beforeEach(function(callback) {

      sync = {
        server:  {
          context: null,
          adapter: null,
          store:   null,
          storage: new helpers.TestStorage({startID: 100}),
          agent:   null
        },
        c1: {
          context: null,
          adapter: null,
          store:   null,
          peer:    null,
          storage: new helpers.TestStorage({startID: 200}),
          agent:   null
        },
        c2: {
          context: null,
          adapter: null,
          store:   null,
          peer:    null,
          storage: new helpers.TestStorage({startID: 300}),
          agent:   null
        },
        c3: {
          context: null,
          adapter: null,
          store:   null,
          peer:    null,
          storage: new helpers.TestStorage({startID: 400}),
          agent:   null
        }
      };

      sync.server.idb = helpers.getIndexedDBScope(':memory:');
      sync.c1.idb     = helpers.getIndexedDBScope(':memory:');
      sync.c2.idb     = helpers.getIndexedDBScope(':memory:');
      sync.c3.idb     = helpers.getIndexedDBScope(':memory:');

      sync.server.agent = new helpers.TestAgent({storage: sync.server.storage});
      sync.c1.agent = new helpers.TestAgent({storage: sync.c1.storage});
      sync.c2.agent = new helpers.TestAgent({storage: sync.c2.storage});
      sync.c3.agent = new helpers.TestAgent({storage: sync.c3.storage});

      sync.server.context = new syncml.Context({
        storage: sync.server.idb,
        prefix:  'syncml-js.test.base.server.' + common.makeID() + '.',
        config:  {exposeErrorTrace: true}
      });

      sync.c1.context = new syncml.Context({
        storage: sync.c1.idb,
        prefix:  'syncml-js.test.base.client1.' + common.makeID() + '.'
      });

      sync.c2.context = new syncml.Context({
        storage: sync.c2.idb,
        prefix:  'syncml-js.test.base.client2.' + common.makeID() + '.'
      });

      sync.c3.context = new syncml.Context({
        storage: sync.c3.idb,
        prefix:  'syncml-js.test.base.client3.' + common.makeID() + '.'
      });

      var setup_server = function(cb) {
        sync.server.context.getAdapter({
          displayName: 'In-Memory Test Server'
        }, null, function(err, adapter) {
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
          displayName: 'In-Memory Test ' + name,
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
          // NOTE: peer._proxy should only be used for testing!...
          syncobj.peer._proxy = {
            sendRequest: function(session, contentType, requestBody, cb) {
              if ( ! syncobj.session )
                syncobj.session = syncml.makeSessionInfo({effectiveID: 'https://example.com/sync'});
              var session   = syncobj.session;
              var collector = new helpers.ResponseCollector();
              var authorize = function(uri, data, cb) { return cb(); };
              var request   = {
                headers: { 'Content-Type': contentType},
                body:    requestBody
              };

              // console.log('>>>>>>>>>>>>>>>>>>>>>');
              // console.log(request.body);
              // console.log('---------------------');

              sync.server.adapter.handleRequest(request, session, authorize, collector.write, function(err) {
                expect(err).ok();
                expect(collector.contentTypes).toEqual(['application/vnd.syncml+xml; charset=UTF-8']);
                expect(collector.contents.length).toEqual(1);
                var response = {
                  headers: { 'Content-Type': collector.contentTypes[0]},
                  body:    collector.contents[0]
                };

                // console.log(response.body);
                // console.log('<<<<<<<<<<<<<<<<<<<<<');

                cb(err, response);
              });
            }
          };
          syncobj.dosync = function(options, expectStats, cb) {
            var mode = ( options ? options.mode : null ) || syncml.SYNCTYPE_AUTO;
            if ( expectStats && ! expectStats.mode )
              // todo: make this dependent on options.mode...
              expectStats.mode = mode || syncml.SYNCTYPE_TWO_WAY;
            syncobj.session = null;
            syncobj.adapter.sync(syncobj.peer, mode, function(err, stats) {
              expect(err).ok();
              if ( err )
                return cb(err);
              var exp = {cli_memo: syncml.makeStats(expectStats)};
              expect(stats).toEqualDict(exp);
              if ( ! _.isEqual(stats, exp) )
                return cb('expected stats != received stats');
              return cb();
            });
          };
          cb(null);
        });
      };

      var add_helper_methods = function(device) {
        var storage = sync[device].storage;
        var store   = sync[device].store;
        sync[device].item_add = function(item, cb) {
          storage.add(item, function(err, new_item) {
            if ( err )
              return cb(err);
            store.registerChange(new_item.id, syncml.ITEM_ADDED, null, function(err) {
              return cb(err, new_item);
            });
          });
        };
        sync[device].item_replace = function(item, cb) {
          storage.replace(item, function(err) {
            if ( err )
              return cb(err);
            sync.c1.store.registerChange(item.id, syncml.ITEM_MODIFIED, null, function(err) {
              return cb(err);
            });
          });
        };
        sync[device].item_delete = function(itemID, cb) {
          storage.delete(itemID, function(err) {
            if ( err )
              return cb(err);
            store.registerChange(itemID, syncml.ITEM_DELETED, null, function(err) {
              return cb(err);
            });
          });
        };
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
              for ( var device in sync )
                add_helper_methods(device);
              callback();
            });
          });
        });
      });

    });

    //-------------------------------------------------------------------------
    afterEach(function(callback) {
      async.map(_.keys(sync), function(key, cb) {
        sync[key].context.close(cb);
      }, function() {
        sync = {};
        callback();
      });
    });

    //-------------------------------------------------------------------------
    var initialize_and_sync_all_peers = function(cb) {
      var steps = [
        // initialize data
        function(cb) {
          // NOTE: no need to call sync.c*.store.registerChange() since
          //       no sync has happened yet...
          sync.c1.storage.add({body: 'some c1 data'}, function(err) {
            expect(err).ok();
            sync.c2.storage.add({body: 'some c2 data'}, function(err) {
              return cb(err);
            });
          });
        },
        // initial sync c1 with server
        function(cb) {
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_AUTO, function(err, stats) {
            expect(err).ok();
            expect(stats).toEqualDict({cli_memo: syncml.makeStats({
              mode:    syncml.SYNCTYPE_SLOW_SYNC,
              peerAdd: 1,
              hereAdd: 0
            })});
            cb(err);
          });
        },
        // initial sync c2 with server
        function(cb) {
          sync.c2.adapter.sync(sync.c2.peer, syncml.SYNCTYPE_AUTO, function(err, stats) {
            expect(err).ok();
            expect(stats).toEqualDict({cli_memo: syncml.makeStats({
              mode:    syncml.SYNCTYPE_SLOW_SYNC,
              peerAdd: 1,
              hereAdd: 1
            })});
            cb(err);
          });
        },
        // initial sync c3 with server
        function(cb) {
          sync.c3.adapter.sync(sync.c3.peer, syncml.SYNCTYPE_AUTO, function(err, stats) {
            expect(err).ok();
            expect(stats).toEqualDict({cli_memo: syncml.makeStats({
              mode:    syncml.SYNCTYPE_SLOW_SYNC,
              peerAdd: 0,
              hereAdd: 2
            })});
            cb(err);
          });
        },
        // validate data
        function(cb) {
          expect(sync.server.storage._items).toEqualDict({
            '100': new helpers.TestItem({id: '100', body: 'some c1 data'}),
            '101': new helpers.TestItem({id: '101', body: 'some c2 data'})
          });
          expect(sync.c1.storage._items).toEqualDict({
            // note: c1 was sync'd before c2, so will not have c2 data
            '200': new helpers.TestItem({id: '200', body: 'some c1 data'})
          });
          expect(sync.c2.storage._items).toEqualDict({
            '300': new helpers.TestItem({id: '300', body: 'some c2 data'}),
            '301': new helpers.TestItem({id: '301', body: 'some c1 data'})
          });
          expect(sync.c3.storage._items).toEqualDict({
            '400': new helpers.TestItem({id: '400', body: 'some c1 data'}),
            '401': new helpers.TestItem({id: '401', body: 'some c2 data'})
          });
          cb();
        },
        // synchronize c1 with server to get all peers on the same page...
        function(cb) {
          sync.c1.session = null;
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_AUTO, function(err, stats) {
            expect(err).ok();
            expect(stats).toEqualDict({cli_memo: syncml.makeStats({
              mode:    syncml.SYNCTYPE_TWO_WAY,
              peerAdd: 0,
              hereAdd: 1
            })});
            cb(err);
          });
        },
        // synchronize all peers again, expect no changes
        function(cb) {
          sync.c1.session = null;
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_AUTO, function(err, stats) {
            expect(err).ok();
            expect(stats).toEqualDict({cli_memo: syncml.makeStats({mode: syncml.SYNCTYPE_TWO_WAY})});
            sync.c2.session = null;
            sync.c2.adapter.sync(sync.c2.peer, syncml.SYNCTYPE_AUTO, function(err, stats) {
              expect(err).ok();
              expect(stats).toEqualDict({cli_memo: syncml.makeStats({mode: syncml.SYNCTYPE_TWO_WAY})});
              sync.c3.session = null;
              sync.c3.adapter.sync(sync.c3.peer, syncml.SYNCTYPE_AUTO, function(err, stats) {
                expect(err).ok();
                expect(stats).toEqualDict({cli_memo: syncml.makeStats({mode: syncml.SYNCTYPE_TWO_WAY})});
                cb();
              });
            });
          });
        },
        // and validate data again
        function(cb) {
          expect(sync.server.storage._items).toEqualDict({
            '100': new helpers.TestItem({id: '100', body: 'some c1 data'}),
            '101': new helpers.TestItem({id: '101', body: 'some c2 data'})
          });
          expect(sync.c1.storage._items).toEqualDict({
            '200': new helpers.TestItem({id: '200', body: 'some c1 data'}),
            '201': new helpers.TestItem({id: '201', body: 'some c2 data'})
          });
          expect(sync.c2.storage._items).toEqualDict({
            '300': new helpers.TestItem({id: '300', body: 'some c2 data'}),
            '301': new helpers.TestItem({id: '301', body: 'some c1 data'})
          });
          expect(sync.c3.storage._items).toEqualDict({
            '400': new helpers.TestItem({id: '400', body: 'some c1 data'}),
            '401': new helpers.TestItem({id: '401', body: 'some c2 data'})
          });
          return cb();

          // var dumps = [
          //   function(cb) {
          //     storage.dumpDatabase(sync.server.context, function(err, dump) {
          //       if ( err )
          //         return cb(err);
          //       console.log('****************************************************************');
          //       console.log('SERVER');
          //       console.log(common.j(dump));
          //       return cb()
          //     });
          //   },
          //   function(cb) {
          //     storage.dumpDatabase(sync.c1.context, function(err, dump) {
          //       if ( err )
          //         return cb(err);
          //       console.log('----------------------------------------------------------------');
          //       console.log('CLIENT-1');
          //       console.log(common.j(dump));
          //       return cb()
          //     });
          //   },
          //   function(cb) {
          //     storage.dumpDatabase(sync.c2.context, function(err, dump) {
          //       if ( err )
          //         return cb(err);
          //       console.log('----------------------------------------------------------------');
          //       console.log('CLIENT-2');
          //       console.log(common.j(dump));
          //       return cb()
          //     });
          //   },
          //   function(cb) {
          //     storage.dumpDatabase(sync.c3.context, function(err, dump) {
          //       if ( err )
          //         return cb(err);
          //       console.log('----------------------------------------------------------------');
          //       console.log('CLIENT-3');
          //       console.log(common.j(dump));
          //       console.log('****************************************************************');
          //       return cb()
          //     });
          //   }
          // ];
          // common.cascade(dumps, function(dump, cb) { dump(cb); }, cb);

        }
      ];
      common.cascade(steps, function(step, cb) {
        step(cb);
      }, function(err) {
        expect(err).ok();
        cb(err);
      });
    };

    // /TODO.END: this is the exact same code as in test-syncml-js.spec.js... DRY!
    //-------------------------------------------------------------------------

    //-------------------------------------------------------------------------
    it('allows control of willingness to initially synchronize', function(done) {
      var options = {
        ua: {
          acceptDevInfoSwap: function(event, cb) {
            return cb('no initial sync!');
          }
        }
      };
      sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_AUTO, options, function(err, stats) {
        expect(err).not.ok();
        expect(err).toEqual('no initial sync!');
        expect(stats).toBeUndefined();
        done();
      });
    });

    //-------------------------------------------------------------------------
    it('allows aborting of a sync-mode switch', function(done) {
      var no_slow_sync_options = { ua: {
        acceptSyncModeSwitch: function(event, cb) {
          return cb('no sync-mode-switch!');
        }
      }};
      common.cascade([
        // initialize everything
        initialize_and_sync_all_peers,
        // after a slow-sync, all else being equal, we expect a two-way sync
        function(cb) {
          sync.c1.session = null;
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_TWO_WAY,
                               no_slow_sync_options, function(err, stats) {
            expect(err).ok();
            return cb();
          });
        },
        // sabotage the lastanchor and sync, but expect the adapters to
        // realize something is wrong and declare a slow-sync
        function(cb) {
          // temporarily squelching logging (since the following causes warnings/errors)
          var prevlevel = logging.level;
          logging.level = logging.CRITICAL;
          sync.c1.session = null;
          sync.server.adapter._model.peers[0].stores[0].binding.remoteAnchor = 'bad-anchor';
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_TWO_WAY,
                               no_slow_sync_options, function(err, stats) {
            logging.level = prevlevel;
            expect(err).not.ok();
            expect(err).toEqual('no sync-mode-switch!');
            expect(stats).toBeUndefined();
            return cb();
          });
        }
      ], done);
    });

    //-------------------------------------------------------------------------
    it('allows aborting of a refresh-required sync', function(done) {
      var no_refresh_options = { ua: {
        chooseRefreshRequired: function(event, cb) {
          return cb('no refresh!');
        }
      }};
      common.cascade([
        // initialize everything
        initialize_and_sync_all_peers,
        // after a slow-sync, all else being equal, we expect a two-way sync
        function(cb) {
          sync.c1.session = null;
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_TWO_WAY,
                               no_refresh_options, function(err, stats) {
            expect(err).ok();
            return cb();
          });
        },
        // sabotage the lastanchor and sync, but expect the adapters to
        // realize something is wrong and declare a slow-sync
        function(cb) {
          sync.c1.session = null;
          sync.c1.peer._model.stores[0].binding.localAnchor = null;
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_TWO_WAY,
                               no_refresh_options, function(err, stats) {
            expect(err).not.ok();
            expect(err).toEqual('no refresh!');
            expect(stats).toBeUndefined();
            return cb();
          });
        }
      ], done);
    });

    //-------------------------------------------------------------------------
    it('exposes control of the mode during a refresh-required sync', function(done) {
      var no_refresh_options = { ua: {
        chooseRefreshRequired: function(event, cb) {
          return cb('no refresh!');
        }
      }};
      var server_refresh_options = { ua: {
        chooseRefreshRequired: function(event, cb) {
          return cb(null, syncml.SYNCTYPE_REFRESH_FROM_SERVER);
        }
      }};
      common.cascade([
        // initialize everything
        initialize_and_sync_all_peers,
        // after a slow-sync, all else being equal, we expect a two-way sync
        function(cb) {
          sync.c1.session = null;
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_TWO_WAY,
                               no_refresh_options, function(err, stats) {
            expect(err).ok();
            expect(stats.cli_memo.mode).toEqual(syncml.SYNCTYPE_TWO_WAY);
            return cb();
          });
        },
        // sabotage the lastanchor and sync, but expect the adapters to
        // realize something is wrong and declare a slow-sync
        function(cb) {
          // temporarily squelching logging (since the following causes warnings/errors)
          var prevlevel = logging.level;
          logging.level = logging.CRITICAL;
          sync.c1.session = null;
          sync.c1.peer._model.stores[0].binding.localAnchor = null;
          sync.c1.adapter.sync(sync.c1.peer, syncml.SYNCTYPE_TWO_WAY,
                               server_refresh_options, function(err, stats) {
            logging.level = prevlevel;
            expect(err).ok();
            expect(stats).toEqualDict({
              cli_memo: syncml.makeStats({
                mode: syncml.SYNCTYPE_REFRESH_FROM_SERVER,
                peerAdd: 0,
                hereAdd: 2,
                hereDel: 2
              })
            });
            return cb();
          });
        }
      ], done);
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
