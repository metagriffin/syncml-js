// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.item
// auth: griffin <griffin@uberdev.org>
// date: 2012/11/30
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
  './constant'
], function(
  _,
  ET,
  logging,
  common,
  constant
) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.Item = common.Base.extend({

    //: the unique identifier (within the context of a SyncML datastore)
    //: of the current SyncML item.
    id: null,

    compare: function(other) {
      return ( other === this ? 0 : 1 );
    }

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
