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
  exports.Synchronizer = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
