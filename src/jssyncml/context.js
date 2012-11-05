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
  './common',
  './constant',
  './codec',
  './storage',
  './router',
  './adapter'
], function(
  _,
  ET,
  common,
  constant,
  codec,
  storage,
  router,
  adapter
) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.Context = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
      options = options || {};
      this.storage      = options.storage || idxdb;
      this.dbname       = ( options.prefix || '' ) + 'jssynmcl';
      this.autoCommit   = options.autoCommit == undefined ? true : options.autoCommit;
      this.router       = options.router || new router.Router();
      //this.synchronizer = options.synchronizer || new synchronizer.Synchronizer();
      //this.protocol     = options.protocol || new protocol.Protocol();
      this.codec        = options.codec || codec.Codec.factory(constant.CODEC_XML);
      this._db          = null;
    },

    //-------------------------------------------------------------------------
    getAdapter: function(options, cb) {
      options = options || {};
      var self = this;
      if ( this._db == undefined )
      {
        storage.openDatabase(this, function(err, db) {
          if ( err )
            return cb(err);
          self._db = db;
          self._db.onerror = function(event) {
            console.log('ERROR: jssyncml.context.db request failed with: '
                        + event.target.errorCode);
          };
          self.getAdapter(options, cb);
        });
      }
      else
      {
        var ret = new adapter.Adapter(this, options);
        return ret._load(cb);
      }
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
