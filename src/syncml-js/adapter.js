// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  syncml-js.localadapter
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
  './remoteadapter',
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

    // //-------------------------------------------------------------------------
    // constructor: function(context, options, devInfo) {

    //-------------------------------------------------------------------------
    normUri: function(uri) {
      return common.normpath(uri);
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
    addStore: function(store, cb) {
      var self = this;
      if ( store instanceof storemod.Store )
      {
        store.uri = self.normUri(store.uri);
        store._a  = self;
      }
      else
        store = new storemod.Store(this, store);
      store._updateModel(function(err) {
        if ( err )
          return cb(err);
        self._stores[store.uri] = store;

        // TODO: remove this sensitivity...
        if ( ! self.isLocal )
          return cb();

        self._save(self._c._dbtxn, function(err) {
          if ( err )
            return cb(err);
          cb(null, store);
        });
      });
    },

    //-------------------------------------------------------------------------
    describe: function(stream, cb) {
      var self = this;
      if ( self.url )
        stream.writeln('URL: ' + self.url);
      stream.writeln('Device ID: ' + self.devID);
      var s1 = stream.indented();
      var s2 = s1.indented();

      var describe_stores = function(cb) {
        var stores = self.getStores();
        if ( stores.length <= 0 )
        {
          stream.writeln('Data stores: (none)');
          return cb();
        }
        stream.writeln('Data stores:');
        common.cascade(stores, function(store, cb) {
          s1.writeln(( store.displayName || store.uri ) + ':');
          store.describe(s2, cb);
        }, cb);
      };

      var describe_peers = function(cb) {
        if ( ! self.getPeers )
          return cb();
        var peers = self.getPeers();
        if ( peers.length <= 0 )
        {
          stream.writeln('Known peers: (none)');
          return cb();
        }
        stream.writeln('Known peers:');
        common.cascade(peers, function(peer, cb) {
          s1.writeln(( peer.displayName || peer.url ) + ':');
          peer.describe(s2, cb);
        }, cb);
      }

      describe_stores(function(err) {
        if ( err )
          return cb(err);
        describe_peers(cb);
      });
    }

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
