// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.router
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

  var log = logging.getLogger('jssyncml.router');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.Router = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
    },

    //-------------------------------------------------------------------------
    getTargetUri: function(adapter, peer, sourceUri) {

      log.critical('TODO ::: Router.getTargetUri() NOT IMPLEMENTED');

      return null;
    },

    //-------------------------------------------------------------------------
    recalculate: function(adapter, peer, cb) {
      // the default recalculate does nothing - it requires that all routes
      // be set up manually.
      return cb();
    },

  });

  //---------------------------------------------------------------------------
  exports.SmartRouter = exports.Router.extend({

    //-------------------------------------------------------------------------
    recalculate: function(adapter, peer, cb) {

      log.critical('TODO ::: SmartRouter.recalculate() NOT IMPLEMENTED');

      return cb();
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
