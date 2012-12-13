// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  syncml-js.remote
// auth: griffin <griffin@uberdev.org>
// date: 2012/11/04
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
  './ctype',
  './storage',
  './devinfo',
  './store'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  ctype,
  storage,
  devinfomod,
  storemod
) {

  var log = logging.getLogger('syncml-js.remote');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.RemoteAdapter = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(adapter, options) {

      //: [read-only] the URL of the remote syncml peer, acting as a server,
      //: to connect to.
      this.url = options.url || null;

      //: [read-only] specifies whether this Adapter represents a local
      //: or remote peer.
      this.isLocal = false;

      //: [read-only] the DevID of the remote syncml peer (which usually
      //: defaults to the URL).
      this.devID = options.devID || options.url || null;

      //: [read-only] the authentication method to use to identify the local
      //: peer to the remote peer.
      this.auth = options.auth || null;

      //: [read-only] the human-friendly display name of the remote peer.
      this.name = options.name || null;

      //: [read-only] the username to use during credential-based authentication.
      this.username = options.username || null;

      //: [read-only] the password to use during credential-based authentication.
      this.password = options.password || null;

      //: [read-only] the peer-wide default value of the maximum
      //: message size.
      this.maxMsgSize = options.maxMsgSize || null;

      //: [read-only] the peer-wide default value of the maximum
      //: object size.
      this.maxObjSize = options.maxObjSize || null;

      //: [read-only] the DevInfo object for this remote peer.
      this.devInfo = null;

      this.lastSessionID = options.lastSessionID || null;

      // --- private attributes
      this.id       = options.id || common.makeID();
      this._a       = adapter;
      this._c       = adapter._c;
      this._stores  = {};
      this._proxy   = null;

      // TODO: filter these options for db-valid only properties...
      this._options = options;
    },

    //-------------------------------------------------------------------------
    _load: function(cb) {

      var self  = this;
      var model = this._getModel();

      // todo: should this be loading these?...
      // self.name    = model.name;
      // self.devID   = model.devID;

      var loadDevInfo = function(cb) {
        var di = new devinfomod.DevInfo(self, model.devInfo);
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

      loadDevInfo(function(err) {
        if ( err )
          return cb(err);
        loadStores(cb);
      });
    },

    //-------------------------------------------------------------------------
    _updateModel: function(cb) {
      if ( ! this._a._model || ! this._a._model.peers )
        return cb('store created on un-initialized adapter');
      // TODO: identifying peers by URL... is that really the right thing?...
      // todo: perhaps a better way would be tu use this._getModel() and if
      //       found, update, if not found, add?...
      this._a._model.peers = _.filter(this._a._model.peers, function(e) {
        if ( e.url != this.url )
          return true;
        // TODO: handle this!...
        log.warning('potential peer info leakage - cleanup RemoteAdapter._updateModel');
        return false;
      }, this);
      this._a._model.peers.push(_.defaults({
        id              : this.id,
        isLocal         : false,
        isServer        : true,
        url             : this.url,
        devID           : this.devID,
        name            : this.name,
        devInfo         : null,
        stores          : [],
        auth            : this.auth,
        username        : this.username,
        password        : this.password,
        lastSessionID   : this.lastSessionID
      }, this._options));
      cb();
    },

    //-------------------------------------------------------------------------
    _getModel: function() {
      return _.find(this._a._model.peers,
                    function(e) { return e.id == this.id; }, this);
    },

    //-------------------------------------------------------------------------
    _setRemoteInfo: function(devInfo, stores, cb) {
      var self      = this;
      self._model   = self._getModel();
      devInfo._a    = self;
      self.devInfo  = devInfo;
      self.devInfo._updateModel(function(err) {
        if ( err )
          return cb(err);

        //---------------------------------------------------------------------
        // TODO: fix this...
        log.critical('TODO ::: setRemoteInfo is currently nuking previous store info');
        log.critical('TODO ::: this will cause slow-syncs everytime...');
        // TODO: right here...
        self._stores  = {};

        // # merge the new datastore info

        // # step 1: prepare the new stores (clean up the URIs)
        // lut = dict([(adapter.peer.normUri(s.uri), s) for s in stores])
        // for key, store in lut.items():
        //   store.uri = key

        // # step 2: remove all stores that are no longer mentioned
        // adapter.peer._stores = [s for s in adapter.peer._stores if s.uri in lut]

        // # step 3: merge the datastore info for existing stores
        // for store in adapter.peer._stores:
        //   store.merge(lut[store.uri])
        //   del lut[store.uri]

        // # step 4: add new datastores
        // for store in lut.values():
        //   adapter.peer.addStore(store)
        //---------------------------------------------------------------------

        common.cascade(stores, function(store, cb) {
          store.uri = self.normUri(store.uri);
          store._a  = self;
          self._stores[store.uri] = store;
          store._updateModel(cb);
        }, cb);
      });
    },

    //-------------------------------------------------------------------------
    setRoute: function(localUri, remoteUri, autoMapped, cb) {
      if ( _.isFunction(autoMapped) )
        // defaulting 'autoMapped' to false
        return this.setRoute(localUri, remoteUri, false, autoMapped);
      var pmodel = this._getModel();
      if ( ! pmodel )
        return cb('could not locate this peer in local adapter');
      pmodel.routes = _.filter(pmodel.routes, function(r) {
        return r.localUri != localUri && r.remoteUri != remoteUri;
      });
      pmodel.routes.push({localUri   : localUri,
                          remoteUri  : remoteUri,
                          autoMapped : autoMapped
                         });
      // now search through previous bindings, breaking incorrect ones...
      // NOTE: this requires that a router.recalculate() is called at
      //       some point later since other valid bindings may now be
      //       possible...
      _.each(pmodel.stores, function(store) {
        if ( ! store.binding )
        {
          if ( store.uri == remoteUri )
            store.binding = {
              uri          : localUri,
              autoMapped   : autoMapped,
              localAnchor  : null,
              remoteAnchor : null
            };
          return;
        }
        if ( store.uri == remoteUri && store.binding.uri == localUri )
        {
          store.binding.autoMapped = store.binding.autoMapped && autoMapped;
          return;
        }
        store.binding = null;
        return;
      });

      // TODO: this additional route may impact "smart routing" - recalculate?...
      // TODO: saving adapter from peer --- SHOULD IT BE DOING THIS?...
      // TODO: get transaction from a session!...
      this._a._save(this._c._txn, cb);
    },

    //-------------------------------------------------------------------------
    getStore: function(uri) {
      return this._stores[this.normUri(uri)];
    },

    //-------------------------------------------------------------------------
    normUri: function(uri) {
      return common.normpath(uri);
    },

    //-------------------------------------------------------------------------
    sendRequest: function(txn, contentType, data, cb) {

      // TODO: shouldn't proxies just overwrite .sendRequest() ?...
      if ( this._proxy )
        return this._proxy.sendRequest(txn, contentType, data, cb);

      // TODO: implement
      log.critical('TODO ::: RemoteAdapter.sendRequest NOT IMPLEMENTED');
      cb('TODO ::: RemoteAdapter.sendRequest NOT IMPLEMENTED');

    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
