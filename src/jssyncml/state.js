// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/27
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  './constant',
  './common'
], function(
  _,
  constant,
  common
) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.makeStats = function(options) {
    return _.defaults(options || {}, {
      mode      : null,
      hereAdd   : 0,
      hereMod   : 0,
      hereDel   : 0,
      hereErr   : 0,
      peerAdd   : 0,
      peerMod   : 0,
      peerDel   : 0,
      peerErr   : 0,
      conflicts : 0,
      merged    : 0,
    });
  };

  //---------------------------------------------------------------------------
  exports.makeSession = function(options) {
    return _.defaults(options || {}, {
      id        : 1,
      isServer  : true,
      msgID     : 1,
      cmdID     : 0,
      dsstates  : {},
      stats     : exports.makeStats()
    });
  };

  //---------------------------------------------------------------------------
  exports.makeStoreSyncState = function(options) {
    return _.defaults(options || {}, {
      uri        : null,
      peerUri    : null,
      lastAnchor : null,
      nextAnchor : '' + common.ts(),
      mode       : constant.ALERT_TWO_WAY,
      action     : null,
      stats      : exports.makeStats()
    });
  };

  //---------------------------------------------------------------------------
  exports.makeTransaction = function(options) {
    return _.defaults(options || {}, {
      context : null,
      adapter : null,
      session : null
    });
  };

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
