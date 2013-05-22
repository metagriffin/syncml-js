// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for routing the syncml-js module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/12/30
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  '../src/syncml-js',
  '../src/syncml-js/logging',
  '../src/syncml-js/common',
  '../src/syncml-js/storage',
  './helpers.js'
], function(_, syncml, logging, common, storage, helpers) {

  describe('syncml-js/router', function() {

    beforeEach(function () {
      // logging.level = logging.NOTSET;
      logging.level = logging.WARNING;
      logging.getLogger().addHandler(new logging.ConsoleHandler());
      this.addMatchers(helpers.matchers);
    });

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
        client: {
          context: null,
          adapter: null,
          store:   null,
          peer:    null,
          storage: new helpers.TestStorage({startID: 200}),
          agent:   null
        }
      };

      sync.server.idb = helpers.getIndexedDB(':memory:');
      sync.client.idb = helpers.getIndexedDB(':memory:');

      sync.server.agent = new helpers.TestAgent({storage: sync.server.storage});
      sync.client.agent = new helpers.TestAgent({storage: sync.client.storage});

      sync.server.context = new syncml.Context({
        storage: sync.server.idb,
        prefix:  'memoryBasedServer.',
        config:  {exposeErrorTrace: true}
      });

      sync.client.context = new syncml.Context({
        storage: sync.client.idb,
        prefix:  'memoryBasedClient.'
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

            common.cascade([

              function(cb) {
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
              },

              function(cb) {
                adapter.addStore({
                  uri          : 'srv_contact',
                  displayName  : 'Server Contacts Store',
                  maxGuidSize  : 32,
                  maxObjSize   : 2147483647,
                  agent        : new helpers.TestAgent({
                    storage      : new helpers.TestStorage({startID: 110}),
                    contentTypes : [
                      new syncml.ContentTypeInfo('text/x-vcard', '2.1', {preferred: true})
                    ]
                  })
                }, function(err, store) { return cb(err); });
              },

              function(cb) {
                adapter.addStore({
                  uri          : 'srv_calendar',
                  displayName  : 'Server Calendar Store',
                  maxGuidSize  : 32,
                  maxObjSize   : 2147483647,
                  agent        : new helpers.TestAgent({
                    storage      : new helpers.TestStorage({startID: 120}),
                    contentTypes : [
                      new syncml.ContentTypeInfo('text/calendar', '2.0', {preferred: true}),
                      new syncml.ContentTypeInfo('text/x-vcalendar', '1.0')
                    ]
                  })
                }, function(err, store) { return cb(err); });
              },

              function(cb) {
                adapter.addStore({
                  uri          : 'srv_calendar_old',
                  displayName  : 'Server Calendar Store (Prefer-Old)',
                  maxGuidSize  : 32,
                  maxObjSize   : 2147483647,
                  agent        : new helpers.TestAgent({
                    storage      : new helpers.TestStorage({startID: 130}),
                    contentTypes : [
                      new syncml.ContentTypeInfo('text/x-vcalendar', '1.0', {preferred: true}),
                      new syncml.ContentTypeInfo('text/calendar', '2.0')
                    ]
                  })
                }, function(err, store) { return cb(err); });
              }

            ], cb);
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

      var setup_client = function(cb) {
        sync.client.context.getEasyClientAdapter({
          displayName: 'In-Memory Test Client',
          devInfo: {
            devID               : 'test-syncml-js-client-devid',
            devType             : syncml.DEVTYPE_WORKSTATION,
            manufacturerName    : 'syncml-js',
            modelName           : 'syncml-js.test.suite.client',
            hierarchicalSync    : false
          },
          stores: [
            {
              uri          : 'cli_memo',
              displayName  : 'Memo Taker',
              maxGuidSize  : helpers.getAddressSize(),
              maxObjSize   : helpers.getMaxMemorySize(),
              agent        : sync.client.agent
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
          sync.client.adapter = adapter;
          sync.client.store   = stores[0];
          sync.client.peer    = peer;
          // NOTE: peer._proxy should only be used for testing!...
          sync.client.peer._proxy = {
            sendRequest: function(session, contentType, requestBody, cb) {
              if ( ! sync.client.session )
                sync.client.session = syncml.makeSessionInfo({effectiveID: 'https://example.com/sync'});
              var session   = sync.client.session;
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

                // console.log('<<<<<<<<<<<<<<<<<<<<<');
                // console.log(response.body);
                // console.log('---------------------');

                cb(err, response);
              });
            }
          };
          sync.client.dosync = function(options, expectStats, cb) {
            var mode = ( options ? options.mode : null ) || syncml.SYNCTYPE_AUTO;
            sync.client.session = null;
            sync.client.adapter.sync(sync.client.peer, mode, function(err, stats) {
              expect(err).ok();
              var chk = null;

              if ( options.fullExpect )
                chk = _.object(_.map(_.keys(expectStats), function(key) {
                  var stats = expectStats[key];
                  if ( ! stats.mode )
                    // todo: make this dependent on options.mode...
                    stats.mode = mode || syncml.SYNCTYPE_TWO_WAY;
                  return [key, syncml.makeStats(stats)];
                }));
              else
              {
                if ( expectStats && ! expectStats.mode )
                  // todo: make this dependent on options.mode...
                  expectStats.mode = mode || syncml.SYNCTYPE_TWO_WAY;
                chk = {cli_memo: syncml.makeStats(expectStats)};
              }

              expect(stats).toEqual(chk);
              cb(err);
            });
          };
          cb(null);
        });
      };

      setup_server(function(err) {
        expect(err).ok();
        if ( err )
          return callback(err);
        setup_client(function(err) {
          expect(err).ok();
          if ( err )
            return callback(err);
          callback();
        });
      });

    });

    //-------------------------------------------------------------------------
    afterEach(function(callback) {
      sync = {};
      callback();
    });

    var routecmp = function(a, b) {
      return common.cmp(a.localUri, b.localUri);
    };

    //-------------------------------------------------------------------------
    it('does not add routes when no extra stores exist', function(done) {
      sync.client.dosync({}, {mode: syncml.SYNCTYPE_SLOW_SYNC}, function(err) {
        expect(err).ok();
        var chk = [{
          localUri   : 'cli_memo',
          remoteUri  : 'srv_note',
          autoMapped : false
        }];
        var routes = sync.client.peer._getModel().routes;
        chk.sort(routecmp);
        routes.sort(routecmp);
        expect(routes).toEqual(chk);
        done();
      });
    });

    //-------------------------------------------------------------------------
    it('smart-routes potential non-manually-defined routes', function(done) {

      // the following server stores exist:
      //   - srv_note
      //   - srv_contact
      //   - srv_calendar
      //   - srv_calendar_old

      sync.client.adapter.addStore({
        uri          : 'cli_calendar',
        displayName  : 'Client Calendar Store',
        maxGuidSize  : helpers.getAddressSize(),
        maxObjSize   : helpers.getMaxMemorySize(),
        agent        : new helpers.TestAgent({
          storage      : new helpers.TestStorage({startID: 210}),
          contentTypes : [
            new syncml.ContentTypeInfo('text/x-vcalendar', '1.0', {preferred: true})
          ]
        })
      }, function(err, store) {
        expect(err).ok();

        sync.client.dosync({fullExpect: true}, {
          cli_memo: {mode: syncml.SYNCTYPE_SLOW_SYNC},
          cli_calendar: {mode: syncml.SYNCTYPE_SLOW_SYNC}
        }, function(err) {
          expect(err).ok();
          var chk = [{
            localUri   : 'cli_memo',
            remoteUri  : 'srv_note',
            autoMapped : false
          }, {
            localUri   : 'cli_calendar',
            remoteUri  : 'srv_calendar_old',
            autoMapped : true
          }];
          var routes = sync.client.peer._getModel().routes;
          chk.sort(routecmp);
          routes.sort(routecmp);
          expect(routes).toEqual(chk);
          done();
        });

      });
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
