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
  './common',
  './constant',
  './codec',
  './storage',
  './remote',
  './store',
  './state'
], function(
  _,
  ET,
  common,
  constant,
  codec,
  storage,
  remote,
  storemod,
  state
) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.Adapter = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(context, options) {

      // todo: is there anyway to mark attributes as read-only?...

      //: devInfo is a read-only attribute describing this adapter's
      //: device info.
      this.devInfo  = null;

      //: peer is a read-only attribute that describes the current peer
      //: with which this adapter is synchronizing with.
      this.peer     = null;

      // --- private attributes
      this._c       = context;
      // TODO: use _.pick() for these options...
      this._options = options;
      this._model   = null;
      this._stores  = {};
    },

    //-------------------------------------------------------------------------
    setDevInfo: function(devInfo, cb) {
      if ( this._model == undefined )
        this._model = {
          id          : common.makeID(),
          name        : null,
          devInfo     : null,
          stores      : [],
          peers       : [],
          isLocal     : true
        };
      // todo: directly setting the database content here without
      //       filtering the properties... doh! ensure that devInfo
      //       is clean!
      // TODO: use _.pick() for these options...
      this._model.devInfo = _.defaults(devInfo, {
        devType           : constant.DEVTYPE_WORKSTATION,
        manufacturerName  : '-',
        modelName         : '-',
        oem               : '-',
        hardwareVersion   : '-',
        firmwareVersion   : '-',
        softwareVersion   : '-',
        utc               : true,
        largeObjects      : true,
        hierarchicalSync  : true,
        numberOfChanges   : true
      });
      this._model.devID = this._model.devInfo.devID;
      this.devInfo = this._model.devInfo;

      // since the local devinfo has changed, we need to ensure that
      // we rebroadcast it (in case there are any affects...), thus
      // resetting all anchors.
      // TODO: this seems a little heavy-handed, since this will force
      //       a slow-sync for each datastore. is that really the best
      //       thing?...
      this._resetAllAnchors();

      this._save(cb);
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
    setPeer: function(peerInfo, cb) {
      var self = this;

      // TODO: if there is already a peer for the specified URL, then
      //       we have a problem!...

      // TODO: if we are adding a peer to an adapter that alread has
      //       non-client peers, then we have a problem!...

      var peer = new remote.RemoteAdapter(this, peerInfo);
      peer._save(function(err) {
        if ( err )
          return cb(err);
        self.peer = peer;
        cb();
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
      store._save(function(err) {
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
      self._model = model;
      self.devInfo = self._model.devInfo;
      var loadPeers = function() {
        var rempeers = _.filter(model.peers, function(e) {
          return ! e.isLocal;
        });
        if ( rempeers.length != 1 )
          return cb(null, self);
        var peer = new remote.RemoteAdapter(self, rempeers[0]);
        return peer._load(function(err) {
          if ( err )
            return cb(err);
          self.peer = peer;
          cb();
        });
      };
      common.cascade(model.stores, function(e, cb) {
        var store = new storemod.Store(self, e);
        store._load(function(err) {
          if ( err )
            return cb(err);
          self._stores[store.uri] = store;
          return cb();
        });
      }, function(err) {
        if ( err )
          return cb(err);
        loadPeers();
      });
    },

    //-------------------------------------------------------------------------
    sync: function(mode, cb) {
      var self = this;

      if ( mode != undefined )
        mode = common.synctype2alert(mode);
      if ( ! mode )
        return cb('invalid synctype');
      if ( ! this.devInfo )
        return cb('cannot synchronize adapter as client: invalid devInfo');
      if ( ! this.peer )
        return cb('cannot synchronize adapter as client: invalid peer');

      // if ( _.filter(_.values(this._stores), function(e) { return e.agent; }).length <= 0 )
      //   return cb('cannot synchronize adapter as client: no agent-backed store');

      var session = state.makeSession({
        id       : ( this.peer.lastSessionID || 0 ) + 1,
        isServer : false,
        mode     : mode
      });

      var err = null;

      _.each(this._stores, function(store) {
        if ( err )
          return;
        if ( ! store.agent )
          return;
        var peerStore = store.getPeer();
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
            console.log('forcing slow-sync for store "'
                        + ds.uri + '" (no previous successful synchronization)');
            ds.mode = constant.ALERT_SLOW_SYNC;
          }
          else
          {
            err = 'unexpected sync mode "' + ds.mode + '" requested';
            return;
          }
        }

        session.dsstates[store.uri] = ds;
      });

      if ( err )
        return cb(err);

      console.log('starting client-side sync with session: ' + JSON.stringify(session));

      cb('not implemented');
    }

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
