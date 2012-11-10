// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.adapter
// auth: griffin <griffin@uberdev.org>
// date: 2012/10/22
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

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

  var log = logging.getLogger('jssyncml.adapter');
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

      // todo: by setting the name here, it interrupts the normal _load
      // process...

      //: [read-only] human-facing name of this adapter
      this.name = options.name || null;

      // --- private attributes
      this._id      = options.id || common.makeID();
      this._c       = context;
      // TODO: use _.pick() for these options...
      this._options = options;
      this._devInfo = devInfo;
      this._model   = null;
      this._stores  = {};
      this._peers   = [];
    },

    //-------------------------------------------------------------------------
    setDevInfo: function(devInfo, cb) {
      if ( this._model == undefined )
        this._model = {
          id          : this._id,
          name        : this.name,
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

        this._save(cb);


      }, this));
    },

    //-------------------------------------------------------------------------
    _resetAllAnchors: function() {
      _.each(this._model.peers, function(peer) {
        _.each(peer.stores, function(store) {
          if ( ! store.binding )
            return;
          store.binding.sourceAnchor = null;
          store.binding.targetAnchor = null;
        });
      });
    },

    //-------------------------------------------------------------------------
    getStore: function(storeUri) {
      return this._stores[storeUri];
    },

    //-------------------------------------------------------------------------
    addStore: function(storeInfo, cb) {
      var self  = this;
      var store = new storemod.Store(this, storeInfo);
      store._updateModel(function(err) {
        if ( err )
          return cb(err);
        self._stores[store.uri] = store;
        self._save(function(err) {
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
      //       (this is only true while jssyncml is not capable of truly
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
    _save: function(cb) {
      storage.put(
        this._c._db.transaction(null, 'readwrite').objectStore('adapter'),
        this._model,
        cb);
    },

    //-------------------------------------------------------------------------
    _load: function(cb) {
      var self = this;

      // TODO: if options specifies a devID/name/etc, use that...

      storage.getAll(
        this._c._db.transaction().objectStore('adapter').index('isLocal'),
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
      var self = this;
      self._model  = model;
      self.name    = model.name;
      self.devID   = model.devID;

      var loadDevInfo = function(cb) {
        var di = new devinfomod.DevInfo(this, this._model.devInfo);
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
      var self = this;

      if ( ! _.find(self._peers, function(p) { return p === peer; }) )
        return cb('invalid peer for adapter');
      if ( mode != undefined )
        mode = common.synctype2alert(mode);
      if ( ! mode )
        return cb('invalid synctype');
      if ( ! self.devInfo )
        return cb('cannot synchronize adapter as client: invalid devInfo');

      var session = state.makeSession({
        context : self._c,
        adapter : self,
        peer    : peer,
        info    : state.makeSessionInfo({
          id       : ( peer.lastSessionID || 0 ) + 1,
          codec    : self._c.codec,
          isServer : false,
          mode     : mode
        })
      });

      var err = null;

      _.each(self._stores, function(store) {
        if ( err )
          return;
        if ( ! store.agent )
          return;
        var peerStore = store.getPeerStore(peer);
        if ( ! peerStore )
          return;

        var ds = state.makeStoreSyncState({
          uri        : store.uri,
          peerUri    : peerStore.uri,
          lastAnchor : peerStore.binding.sourceAnchor,
          mode       : mode || constant.ALERT_TWO_WAY,
          action     : 'alert'
        });

        if ( ! ds.lastAnchor )
        {
          if ( _.indexOf([
            constant.ALERT_SLOW_SYNC,
            constants.ALERT_REFRESH_FROM_CLIENT,
            constants.ALERT_REFRESH_FROM_SERVER,
          ], ds.mode) >= 0 )
          {}
          else if ( _.indexOf([
            constant.ALERT_TWO_WAY,
            constant.ALERT_ONE_WAY_FROM_CLIENT,
            constant.ALERT_ONE_WAY_FROM_SERVER,
          ], ds.mode) >= 0 )
          {
            log.debug('forcing slow-sync for store "'
                      + ds.uri + '" (no previous successful synchronization)');
            ds.mode = constant.ALERT_SLOW_SYNC;
          }
          else
          {
            err = 'unexpected sync mode "' + ds.mode + '" requested';
            return;
          }
        }

        session.info.dsstates[store.uri] = ds;
      });

      if ( err )
        return cb(err);

      session.send = function(contentType, data, cb) {
        session.peer.sendRequest(session, contentType, data, function(err, response) {
          if ( err )
            return cb(err);
          self._receive(session, response, cb);
        });
      };

      session.context.protocol.initialize(session, null, function(err, commands) {
        if ( err )
          return cb(err);
        self._transmit(session, commands, function(err) {
          if ( err )
            return cb(err);
          self._save(function(err) {
            if ( err )
              return cb(err);
            return cb(null, self._session2stats(session));
          });
        });
      });
    },

    //-------------------------------------------------------------------------
    _session2stats: function(session) {
      var ret = {};
      _.each(_.values(session.info.dsstates), function(ds) {
        ret[ds.uri] = _.clone(ds);
        ret[ds.uri].mode = common.alert2synctype(ds.mode);
      });
      log.debug('session statistics: ' + common.j(ret));
      return ret;
    },

    //-------------------------------------------------------------------------
    _transmit: function(session, commands, cb) {
      var self = this;

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
            pstore.binding.sourceAnchor = ds.nextAnchor;
            pstore.binding.targetAnchor = ds.peerNextAnchor;
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
    handleRequest: function(request, cb) {

      var session = state.makeSession({
        context : self._c,
        adapter : self,
        peer    : null,
        info    : request.session['jssyncml']
      });

      // TODO
      log.critical('TODO ::: populate session.peer');

      if ( ! session.info )
      {
        // TODO
        log.critical('TODO ::: get the session-id from the request?...');
        log.critical('TODO ::: or will that get filled in during the initialize?...');

        session.info = state.makeSessionInfo({
          id       : ( session.peer.lastSessionID || 0 ) + 1,
          codec    : self._c.codec,
          isServer : true,
          mode     : null
        })
      }

      session.send = cb;

      this._receive(session, request, function(err, stats) {
        if ( err )
          return cb(err);
        log.info('syncml transaction stats: ' + common.j(stats));
        return cb(null, null, null, stats);
      });

    },

    //-------------------------------------------------------------------------
    _receive: function(session, request, cb) {
      var self = this;
      if ( session.info.msgID > 20 )
        return cb('too many client/server messages');
      if ( ! session.info.isServer )
      {
        session.info.lastMsgID = session.info.msgID;
        session.info.msgID += 1;
      }
      var ct = request.headers['Content-Type'];
      codec.Codec.autoDecode(ct, request.body, function(err, xtree, engine) {
        if ( err )
          return cb(err);
        session.info.codec = engine;
        session.context.protocol.consume(
          session, session.info.lastCommands, xtree,
          function(err, commands) {
            if ( err )
              return cb(err);
            self._transmit(session, commands, function(err) {
              if ( err )
                return cb(err);
              if ( ! session.info.isServer )
                return cb();
              self._save(function(err) {
                if ( err )
                  return cb(err);
                return cb(null, self._session2stats(session));
              });
            });
          });
      })
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
