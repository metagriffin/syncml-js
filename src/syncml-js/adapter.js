// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  syncml-js.adapter
// auth: griffin <griffin@uberdev.org>
// date: 2012/10/22
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// TODO: update all this._c._dbtxn references...

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  'elementtree',
  './logging',
  './common',
  './constant',
  './codec',
  './storage',
  './remote',
  './store',
  './devinfo',
  './state'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  codec,
  storage,
  remote,
  storemod,
  devinfomod,
  state
) {

  var log = logging.getLogger('syncml-js.adapter');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.Adapter = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(context, options, devInfo) {

      // todo: is there anyway to mark attributes as read-only?...

      //: [read-only] devInfo describes this adapter's device info and
      //: capabilities.
      this.devInfo = null;

      //: [read-only] the device ID of this adapter.
      this.devID = options.devID || null;

      //: [read-only] specifies whether this Adapter represents a local
      //: or remote peer.
      this.isLocal = true;

      //: [read-only] human-facing name of this adapter
      this.name = options.name || null;

      //: [read-only] the adapter-wide default value of the maximum
      //: message size.
      this.maxMsgSize = options.maxMsgSize || null;

      //: [read-only] the adapter-wide default value of the maximum
      //: object size.
      this.maxObjSize = options.maxObjSize || null;

      // --- private attributes
      this.id       = options.id || common.makeID();
      this._c       = context;
      // TODO: use _.pick() for these options...
      this._options = options;
      this._devInfo = devInfo;
      this._model   = null;
      this._stores  = {};
      this._peers   = [];
    },

    //-------------------------------------------------------------------------
    _getModel: function() {
      return this._model;
    },

    //-------------------------------------------------------------------------
    setDevInfo: function(devInfo, cb) {
      if ( this._model == undefined )
        this._model = {
          id          : this.id,
          name        : this.name,
          maxMsgSize  : this.maxMsgSize,
          maxObjSize  : this.maxObjSize,
          devInfo     : null,
          stores      : [],
          peers       : [],
          isLocal     : true
        };

      var di = new devinfomod.DevInfo(this, devInfo);
      di._updateModel(_.bind(function(err) {
        if ( err )
          return cb(err);

        this._model.devID = this._model.devInfo.devID;
        this.devID        = this._model.devInfo.devID;
        this.devInfo      = di;

        // since the local devinfo has changed, we need to ensure that
        // we rebroadcast it (in case there are any affects...), thus
        // resetting all anchors.
        // TODO: this seems a little heavy-handed, since this will force
        //       a slow-sync for each datastore. is that really the best
        //       thing?...
        this._resetAllAnchors();

        this._save(this._c._dbtxn, cb);

      }, this));
    },

    //-------------------------------------------------------------------------
    _resetAllAnchors: function() {
      _.each(this._model.peers, function(peer) {
        _.each(peer.stores, function(store) {
          if ( ! store.binding )
            return;
          store.binding.localAnchor  = null;
          store.binding.remoteAnchor = null;
        });
      });
    },

    //-------------------------------------------------------------------------
    getStores: function() {
      return _.values(this._stores);
    },

    //-------------------------------------------------------------------------
    getStore: function(uri) {
      return this._stores[this.normUri(uri)];
    },

    //-------------------------------------------------------------------------
    addStore: function(storeInfo, cb) {
      var self  = this;
      var store = new storemod.Store(this, storeInfo);
      store._updateModel(function(err) {
        if ( err )
          return cb(err);
        self._stores[store.uri] = store;
        self._save(self._c._dbtxn, function(err) {
          if ( err )
            return cb(err);
          cb(null, store);
        });
      });
    },

    //-------------------------------------------------------------------------
    normUri: function(uri) {
      return common.normpath(uri);
    },

    //-------------------------------------------------------------------------
    getPeers: function() {
      return this._peers;
    },

    //-------------------------------------------------------------------------
    addPeer: function(peerInfo, cb) {
      var self = this;

      // TODO: if there is already a peer for the specified URL, then
      //       we may have a problem!...

      // todo: if we are adding a peer to an adapter that already has
      //       non-client peers, then we may have a problem!...
      //       (this is only true while syncml-js is not capable of truly
      //       operating in peer-to-peer mode)

      var peer = new remote.RemoteAdapter(this, peerInfo);
      peer._updateModel(function(err) {
        if ( err )
          return cb(err);
        self._peers.push(peer);
        cb(null, peer);
      });
    },

    //-------------------------------------------------------------------------
    _save: function(dbtxn, cb) {
      storage.put(dbtxn.objectStore('adapter'), this._model, cb);
    },

    //-------------------------------------------------------------------------
    _load: function(cb) {
      var self = this;

      // TODO: if options specifies a devID/name/etc, use that...

      storage.getAll(
        this._c._dbtxn.objectStore('adapter').index('isLocal'),
        true, null,
        function(err, adapters) {
          if ( err )
            return cb(err);
          if ( adapters.length > 1 )
            return cb('multiple local adapters defined - specify which devID to load');
          if ( adapters.length <= 0 )
            return cb(null, self);
          self._loadModel(adapters[0], function(err) {
            if ( err )
              return cb(err);
            return cb(null, self);
          });
        });
    },

    //-------------------------------------------------------------------------
    _loadModel: function(model, cb) {

      log.critical('TODO ::: new adapter settings are being overwritten');
      log.critical('TODO :::   (because they were not saved)');

      var self = this;
      self._model      = model;
      self.name        = model.name;
      self.devID       = model.devID;
      self.maxMsgSize  = model.maxMsgSize;
      self.maxObjSize  = model.maxObjSize;

      var loadDevInfo = function(cb) {
        var di = new devinfomod.DevInfo(self, self._model.devInfo);
        di._load(function(err) {
          if ( err )
            return cb(err);
          self.devInfo = di;
          cb();
        });
      };

      var loadStores = function(cb) {
        common.cascade(model.stores, function(e, cb) {
          var store = new storemod.Store(self, e);
          store._load(function(err) {
            if ( err )
              return cb(err);
            self._stores[store.uri] = store;
            return cb();
          });
        }, cb);
      };

      var loadPeers = function(cb) {
        var remotes = _.filter(model.peers, function(e) {
          return ! e.isLocal;
        });
        self._peers = [];
        common.cascade(remotes, function(e, cb) {
          var peer = new remote.RemoteAdapter(self, e);
          peer._load(function(err) {
            if ( err )
              return cb(err);
            self._peers.push(peer);
            return cb();
          });
        }, cb);
      };

      loadDevInfo(function(err) {
        if ( err )
          return cb(err);
        loadStores(function(err) {
          if ( err )
            return cb(err);
          loadPeers(cb);
        });
      });

    },

    //-------------------------------------------------------------------------
    sync: function(peer, mode, cb) {

      // TODO: initialize a new context transaction?...
      // todo: or perhaps add a new session.dbtxn?...

      var self = this;

      if ( ! _.find(self._peers, function(p) { return p === peer; }) )
        return cb(new common.InvalidAdapter('invalid peer for adapter'));
      if ( mode != undefined )
      {
        mode = common.synctype2alert(mode);
        if ( ! mode )
          return cb(new common.TypeError('invalid synctype'));
      }
      if ( ! self.devInfo )
        return cb(new common.InvalidAdapter('cannot synchronize adapter as client: invalid devInfo'));

      var session = state.makeSession({
        context  : self._c,
        dbtxn    : self._c._dbtxn,
        adapter  : self,
        peer     : peer,
        isServer : false,
        info     : state.makeSessionInfo({
          id       : ( peer.lastSessionID || 0 ) + 1,
          msgID    : 1,
          codec    : self._c.codec,
          mode     : mode
        })
      });

      session.send = function(contentType, data, cb) {
        session.peer.sendRequest(session, contentType, data, function(err, response) {
          if ( err )
            return cb(err);
          // todo: allow the client to force the server to authorize itself as well...
          self._receive(session, response, null, cb);
        });
      };

      // TODO: should i do a router.calculate() at this point?
      //       the reason is that if there was a sync, then a
      //       .setRoute(), then things may have changed...
      //       corner-case, yes... but still valid.

      session.context.synchronizer.initStoreSync(session, function(err) {
        if ( err )
          return cb(err);
        session.context.protocol.initialize(session, null, function(err, commands) {
          if ( err )
            return cb(err);
          self._transmit(session, commands, function(err) {
            if ( err )
              return cb(err);
            self._save(session.dbtxn, function(err) {
              if ( err )
                return cb(err);
              return cb(null, self._session2stats(session));
            });
          });
        });
      });
    },

    //-------------------------------------------------------------------------
    _session2stats: function(session) {
      var ret = {};
      _.each(_.values(session.info.dsstates), function(ds) {
        var stats = _.clone(ds.stats);
        stats.mode = common.alert2synctype(ds.mode);
        ret[ds.uri] = stats;
      });
      log.debug('session statistics: ' + common.j(ret));
      return ret;
    },

    //-------------------------------------------------------------------------
    _transmit: function(session, commands, cb) {
      var self = this;

      if ( session.info.msgID > 20 )
        return cb('too many client/server messages');

      session.context.protocol.negotiate(session, commands, function(err, commands) {
        if ( err )
          return cb(err);

        if ( session.context.protocol.isComplete(session, commands) )
        {
          // we're done! store all the anchors and session IDs and exit...
          var pmodel = session.peer._getModel();
          if ( ! pmodel )
            return cb('unexpected error: could not locate this peer in local adapter');
          _.each(session.info.dsstates, function(ds, uri) {
            var pstore = _.find(pmodel.stores, function(s) { return s.uri == ds.peerUri; });
            if ( ! pstore )
              return cb('unexpected error: could not locate bound peer store in local adapter');
            pstore.binding.localAnchor  = ds.nextAnchor;
            pstore.binding.remoteAnchor = ds.peerNextAnchor;
          });
          session.peer.lastSessionID = session.info.id;
          pmodel.lastSessionID       = session.info.id;
          log.debug('synchronization complete for "' + session.peer.devID + '" (s'
                    + session.info.id + '.m' + session.info.lastMsgID)
          return cb();
        }

        session.context.protocol.produce(session, commands, function(err, tree) {
          if ( err )
            return cb(err);
          codec.Codec.autoEncode(tree, session.info.codec, function(err, contentType, data) {
            if ( err )
              return cb(err);

            // update the session with the last request commands so
            // that when we receive the response package, it can be
            // compared against that.

            // TODO: should that only be done on successful transmit?...

            session.info.lastCommands = commands;
            session.send(contentType, data, function(err) {
              if ( err )
                return cb(err);
              cb();
            });

          })
        });
      });
    },

    //-------------------------------------------------------------------------
    authorize: function(request, sessionInfo, authorize, cb) {
      var self = this;
      var ct   = request.headers['Content-Type'];
      codec.Codec.autoDecode(ct, request.body, function(err, xtree, codecName) {
        if ( err )
          return cb(err);
        self._c.protocol.authorize(xtree, null, authorize, cb);
      });
    },

    //-------------------------------------------------------------------------
    getTargetID: function(request, sessionInfo, cb) {
      var self = this;
      var ct   = request.headers['Content-Type'];
      codec.Codec.autoDecode(ct, request.body, function(err, xtree, codecName) {
        if ( err )
          return cb(err);
        return cb(null, self._c.protocol.getTargetID(xtree));
      });
    },

    //-------------------------------------------------------------------------
    handleRequest: function(request, sessionInfo, authorize, response, cb) {

      // TODO: initialize a new context transaction?...
      // todo: or perhaps add a new session.dbtxn?...

      var self = this;
      var session = state.makeSession({
        context  : self._c,
        dbtxn    : self._c._dbtxn,
        adapter  : self,
        peer     : null,
        isServer : true,
        info     : sessionInfo
      });
      session.send = response;
      this._receive(session, request, authorize, function(err, stats) {
        if ( err )
          return cb(err);
        self._save(session.dbtxn, function(err) {
          if ( err )
            return cb(err);
          return cb(null, self._session2stats(session));
        });
      });
    },

    //-------------------------------------------------------------------------
    _receive: function(session, request, authorize, cb) {
      var self = this;
      if ( ! session.isServer )
      {
        session.info.lastMsgID = session.info.msgID;
        session.info.msgID += 1;
      }
      var ct = request.headers['Content-Type'];
      codec.Codec.autoDecode(ct, request.body, function(err, xtree, codecName) {
        if ( err )
          return cb(err);
        session.info.codec = codecName;
        var do_authorize = ( ! authorize ) ? common.noop : function(cb) {
          session.context.protocol.authorize(xtree, null, authorize, function(err) {
            return cb(err);
          });
        };
        do_authorize(function(err) {
          if ( err )
            return cb(err);
          session.context.protocol.consume(
            session, session.info.lastCommands, xtree,
            function(err, commands) {
              if ( err )
                return cb(err);
              self._transmit(session, commands, function(err) {
                if ( err )
                  return cb(err);
                if ( ! session.isServer )
                  return cb();
                self._save(session.dbtxn, function(err) {
                  if ( err )
                    return cb(err);
                  return cb(null, self._session2stats(session));
                });
              });
            }
          );
        });
      })
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
