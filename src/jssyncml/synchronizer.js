// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.synchronizer
// auth: griffin <griffin@uberdev.org>
// date: 2012/11/05
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
  './storage'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  ctype,
  storage
) {

  var log = logging.getLogger('jssyncml.synchronizer');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.Synchronizer = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
    },

    //-------------------------------------------------------------------------
    actions: function(session, commands, cb) {

      log.critical('TODO: Synchronizer.actions() NOT IMPLEMENTED');
      return cb(new common.NotImplementedError('TODO: Synchronizer.actions NOT IMPLEMENTED'));

    },

    //-------------------------------------------------------------------------
    settle: function(session, cmd, chkcmd, xnode, cb) {

      log.critical('TODO: Synchronizer.settle() NOT IMPLEMENTED');
      return cb(new common.NotImplementedError('TODO: Synchronizer.settle() NOT IMPLEMENTED'));

    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
