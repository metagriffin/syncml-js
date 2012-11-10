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

  var log = logging.getLogger('jssyncml.agent');
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
    dumpItem: function(item, stream, contentType, version, cb) {
      return this.dumpsItem(
        item, contentType, version,
        function(err, data, new_contentType, new_version) {
          if ( err )
            return cb(err);
          stream.write(data, function(err) {
            if ( err )
              return cb(err);
            cb(null, new_contentType, new_version);
          });
        });
    },

    //-------------------------------------------------------------------------
    loadItem: function(stream, contentType, version, cb) {
      var self = this;
      stream.read(function(err, data) {
        if ( err )
          cb(err);
        self.loadsItem(data, contentType, version, cb);
      });
    },

    //-------------------------------------------------------------------------
    deleteAllItems: function(cb) {
      var self = this;
      self.getAllItems(function(err, items) {
        if ( err )
          return cb(err);
        common.cascade(items, function(e, cb) {
          self.deleteItem(e, cb);
        }, cb);
      });
    }

    // todo: add documentation about all expected methods...
    // TODO: provide matchItem()

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
