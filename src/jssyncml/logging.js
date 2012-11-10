// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.logging
// auth: griffin <griffin@uberdev.org>
// date: 2012/11/10
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  'sprintf',
  './common',
], function(
  _,
  sprintf,
  common
) {

  var exports = {
    CRITICAL: 'CRITICAL',
    ERROR:    'ERROR',
    WARNING:  'WARNING',
    INFO:     'INFO',
    DEBUG:    'DEBUG'
  };

  //---------------------------------------------------------------------------
  var Logger = common.Base.extend({
    constructor: function(options) {
      this._name = options.name || '';
    },
    exception: function() {
      this.critical.apply(this, arguments);
    },
    critical: function() {
      var args = _.initial(arguments, 0);
      args.unshift(exports.CRITICAL);
      this.log.apply(this, args);
    },
    error: function() {
      var args = _.initial(arguments, 0);
      args.unshift(exports.ERROR);
      this.log.apply(this, args);
    },
    warn: function() {
      this.warning.apply(this, arguments);
    },
    warning: function() {
      var args = _.initial(arguments, 0);
      args.unshift(exports.WARNING);
      this.log.apply(this, args);
    },
    info: function() {
      var args = _.initial(arguments, 0);
      args.unshift(exports.INFO);
      this.log.apply(this, args);
    },
    debug: function() {
      var args = _.initial(arguments, 0);
      args.unshift(exports.DEBUG);
      this.log.apply(this, args);
    },
    log: function() {
      this._log.apply(this, arguments);
    },
    _log: function(lvl) {
      var args = _.initial(arguments, 0);
      args.shift();
      var msg = '[' + this._name + '] ' + lvl + ': ' + sprintf.sprintf.apply(null, args);
      console.log(msg);
    }
  });

  //---------------------------------------------------------------------------
  exports.getLogger = function(name) {
    return new Logger({name: name});
  };

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
