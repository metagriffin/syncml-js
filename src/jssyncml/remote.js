// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.remote
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
  exports.RemoteAdapter = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(adapter, options) {

      //: [read-only] the URL of the remote syncml peer, acting as a server,
      //: to connect to.
      this.url = options.url || null;

      //: [read-only] the authentication method to use to identify the local
      //: peer to the remote peer.
      this.auth = options.auth || null;

      //: [read-only] the username to use during credential-based authentication.
      this.username = options.username || null;

      //: [read-only] the password to use during credential-based authentication.
      this.password = options.password || null;

      // TODO: many other attributes...

      // --- private attributes
      this._a       = adapter;
      this._c       = adapter._c;
      this._id      = options.id || common.makeID();

      // TODO: filter these options for db-valid only properties...
      this._options = options;
    },

    //-------------------------------------------------------------------------
    _load: function(cb) {
      cb();
    },

    //-------------------------------------------------------------------------
    _save: function(cb) {
      if ( ! this._a._model || ! this._a._model.peers )
        return cb('store created on un-initialized adapter');
      this._a._model.peers = _.filter(this._a._model.peers, function(e) {
        return e.url != this.url;
      }, this);
      this._a._model.peers.push(_.defaults({
        id              : this._id,
        isLocal         : false,
        isServer        : true,
        url             : this.url,
        auth            : this.auth,
        username        : this.username,
        password        : this.password,
      }, this._options));
      cb();
    },

    //-------------------------------------------------------------------------

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
