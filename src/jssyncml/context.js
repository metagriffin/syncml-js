// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.context
// auth: griffin <griffin@uberdev.org>
// date: 2012/10/22
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

// todo: is this the right place to put this?...
//       the reason that i did not put it in the `define` call is
//       because it needs access to `this.indexedDB`...
var idxdb = ( typeof(window) != 'undefined' && window.indexedDB ) || this.indexedDB;

define([
  'underscore',
  'elementtree',
  './logging',
  './common',
  './constant',
  './storage',
  './router',
  './synchronizer',
  './protocol',
  './adapter'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  storage,
  router,
  synchronizer,
  protocol,
  adapter
) {

  var log = logging.getLogger('jssyncml.context');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.Context = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
      options = options || {};
      this.storage      = options.storage || idxdb;
      this.dbname       = ( options.prefix || '' ) + 'jssynmcl';
      this.autoCommit   = options.autoCommit == undefined ? true : options.autoCommit;
      this.router       = options.router || new router.SmartRouter();
      this.synchronizer = options.synchronizer || new synchronizer.Synchronizer();
      this.protocol     = options.protocol || new protocol.Protocol();
      this.codec        = options.codec || constant.CODEC_XML;
      this._db          = null;
    },

    //-------------------------------------------------------------------------
    getAdapter: function(options, devInfo, cb) {
      options = options || {};
      var self = this;
      if ( this._db == undefined )
      {
        storage.openDatabase(this, function(err, db) {
          if ( err )
            return cb(err);
          self._db = db;
          self._db.onerror = function(event) {
            // todo: remove this?...
            log.error('jssyncml.context.db request failed with: '
                      + event.target.error);
          };
          self.getAdapter(options, devInfo, cb);
        });
      }
      else
      {
        var ret = new adapter.Adapter(this, options, devInfo);
        return ret._load(cb);
      }
    },

    //-------------------------------------------------------------------------
    getEasyClientAdapter: function(options, cb) {
      // options should be:= {
      //   // devID,
      //   // name,
      //   devInfo: {},
      //   stores: [],
      //   peer: {},
      //   routes: [
      //     [ source, target ],
      //   ]
      // }
      // response: cb(err, adapter, stores, peer);

      var self = this;

      var ret = {
        adapter: null,
        stores: [],
        peer: null
      };

      var setupAdapter = function(cb) {
        var adapterOptions = _.omit(options, 'devInfo', 'stores', 'peers', 'routes');
        self.getAdapter(adapterOptions, options.devInfo, function(err, adapter) {
          if ( err )
            return cb(err);
          ret.adapter = adapter;
          if ( adapter.devInfo )
            return cb();
          adapter.setDevInfo(options.devInfo, cb);
        });
      };

      var setupStores = function(cb) {
        common.cascade(options.stores, function(storeInfo, cb) {
          var store = ret.adapter.getStore(storeInfo.uri);
          if ( store != undefined )
          {
            if ( storeInfo.agent )
              store.agent = storeInfo.agent;
            ret.stores.push(store);
            return cb();
          }
          ret.adapter.addStore(storeInfo, function(err, store) {
            if ( err )
              return cb(err);
            ret.stores.push(store);
            return cb();
          });
        }, cb);
      };

      var setupPeer = function(cb) {
        var peer = _.find(ret.adapter.getPeers(), function(p) {
          return p.url == options.peer.url;
        });
        if ( peer )
        {
          ret.peer = peer;
          return cb();
        }
        ret.adapter.addPeer(options.peer, function(err, peer) {
          if ( err )
            return cb(err);
          ret.peer = peer;
          common.cascade(options.routes, function(route, cb) {
            ret.peer.addRoute(route[0], route[1], cb);
          }, cb);
        });
      };

      setupAdapter(function(err) {
        if ( err )
          return cb(err);
        setupStores(function(err) {
          if ( err )
            return cb(err);
          setupPeer(function(err) {
            if ( err )
              return cb(err);
            cb(null, ret.adapter, ret.stores, ret.peer);
          });
        });
      });
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
