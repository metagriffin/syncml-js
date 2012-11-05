// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.store
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
  './common',
  './constant',
  './codec',
  './ctype',
  './storage'
], function(
  _,
  ET,
  common,
  constant,
  codec,
  ctype,
  storage
) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.Store = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(adapter, options) {

      // todo: some of these attributes should be modifiable...

      //: for local stores, specifies the agent that will implement
      //: the actual item operations -- it must implement the
      //: jssyncml.Agent API.
      this.agent = options.agent || null;

      //: [read-only] specifies the SyncML URI that this store is bound to.
      this.uri = options.uri || null;

      //: [read-only] specifies the human-readable name for this store.
      //: if undefined, defaults to URI.
      this.displayName = options.displayName || options.uri || null;

      //: [read-only] specifies the maximum GUID size for items in this store.
      //: if undefined, defaults to adapter setting.
      this.maxGuidSize = options.maxGuidSize || null;

      //: [read-only] specifies the maximum object size for items in this store.
      //: if undefined, defaults to adapter setting.
      this.maxObjSize = options.maxObjSize || null;

      //: [read-only] specifies conflict resolution policy for this store.
      //: if undefined, defaults to adapter setting.
      this.conflictPolicy = options.conflictPolicy || null;

      //: [read-only] specifies which syncTypes this store supports.
      //: (defaults to all.)
      this.syncTypes = options.syncTypes || [
        constant.SYNCTYPE_TWO_WAY,
        constant.SYNCTYPE_SLOW_SYNC,
        constant.SYNCTYPE_ONE_WAY_FROM_CLIENT,
        constant.SYNCTYPE_REFRESH_FROM_CLIENT,
        constant.SYNCTYPE_ONE_WAY_FROM_SERVER,
        constant.SYNCTYPE_REFRESH_FROM_SERVER,
        constant.SYNCTYPE_SERVER_ALERTED,
      ];

      ctypes = options.contentTypes;
      if ( ! ctypes && options.agent )
        ctypes = options.agent.getContentTypes();

      this.contentTypes = _.map(ctypes, function(e) {
        if ( e instanceof ctype.ContentTypeInfo )
          return e;
        return ctype.ContentTypeInfo.fromStruct(e);
      });

      // --- private attributes
      this._a       = adapter;
      this._c       = adapter._c;
      this._id      = options.id || common.makeID();
    },

    //-------------------------------------------------------------------------
    _load: function(cb) {
      cb();
    },

    //-------------------------------------------------------------------------
    _save: function(cb) {
      if ( ! this._a._model || ! this._a._model.stores )
        return cb('store created on un-initialized adapter');
      this._a._model.stores = _.filter(this._a._model.stores, function(e) {
        return e.uri != this.uri;
      }, this);
      this._a._model.stores.push({
        id              : this._id,
        uri             : this.uri,
        displayName     : this.displayName,
        syncTypes       : this.syncTypes,
        maxGuidSize     : this.maxGuidSize,
        maxObjSize      : this.maxObjSize,
        conflictPolicy  : this.conflictPolicy,
        contentTypes    : _.map(this.contentTypes, function(e) { return e.toStruct(); })
      });
      cb();
    },

    //-------------------------------------------------------------------------
    getContentTypes: function() {
      if ( this.agent != undefined )
        return this.agent.getContentTypes();
      return this.contentTypes;
    },

    //-------------------------------------------------------------------------
    getPeer: function() {

      console.log('TODO ::: Store.getPeer should be aware of local/remote...');

      var peerUri = this._c.router.getTargetUri(this._a, this.uri);
      if ( ! peerUri )
        return null;

      console.log('TODO ::: Store.getPeer NOT IMPLEMENTED');

      return null;

    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
