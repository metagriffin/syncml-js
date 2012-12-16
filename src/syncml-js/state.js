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
  './logging',
  './constant',
  './common'
], function(
  _,
  logging,
  constant,
  common
) {

  var log = logging.getLogger('syncml-js.state');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.makeCommand = function(options) {
    return _.defaults({}, options, {
      // ?
    });
  };

  //---------------------------------------------------------------------------
  exports.makeStats = function(options) {
    return _.defaults({}, options, {
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
  exports.makeSessionInfo = function(options) {
    return _.defaults({}, options, {
      id           : null,
      msgID        : null,
      cmdID        : 0,
      dsstates     : {},
      lastCommands : [],
      stats        : exports.makeStats()
    });
  };

  //---------------------------------------------------------------------------
  exports.makeStoreSyncState = function(options) {
    return _.defaults({}, options, {
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
  exports.makeSession = function(options) {
    return new (function() {
      this.context   = options.context || null;
      this.dbtxn     = options.dbtxn   || null;
      this.adapter   = options.adapter || null;
      this.peer      = options.peer    || null;
      this.info      = options.info    || null;
      this.isServer  = options.isServer ? true : false;
      this.nextCmdID = function() {
        this.info.cmdID += 1;
        return this.info.cmdID;
      };
    })();

    // return _.defaults({}, options, {
    //   context : null,
    //   adapter : null,
    //   peer    : null,
    //   info    : null
    // });
  };

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
