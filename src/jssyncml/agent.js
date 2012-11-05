// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.agent
// auth: griffin <griffin@uberdev.org>
// date: 2012/10/22
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  'elementtree',
  './common',
  './constant'
], function(
  _,
  ET,
  common,
  constant
) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.Agent = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
      options = _.defaults(options, {
        hierarchicalSync: false
      });
      this.hierarchicalSync = options.hierarchicalSync;
    },

    //-------------------------------------------------------------------------
    deleteAllItems: function(cb) {
      var self = this;
      self.getAllItems(function(err, items) {
        if ( err )
          return cb(err);
        common.cascade(items, function(e, cb) {
          self.deleteItem(e, cb);
        }, function(err) {
          if ( err )
            return cb(err);
          return cb();
        });
      });
    }

    // todo: add documentation about all expected methods...

    // TODO: provide loadsItem(), dumpsItem() helper methods...
    // TODO: provide matchItem()

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
