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
    level:    0,
    CRITICAL: 50,
    ERROR:    40,
    WARNING:  30,
    INFO:     20,
    DEBUG:    10,
    NOTSET:   0
  };

  //---------------------------------------------------------------------------
  var Logger = common.Base.extend({
    constructor: function(options) {
      this.level = exports.NOTSET;
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
      if ( this.level != exports.NOTSET && this.level > lvl )
        return;
      // todo: ugh. i really should implement a cascading of loggers...
      if ( exports.level != exports.NOTSET && exports.level > lvl )
        return;
      var lvlstr = '';
      if ( lvl >= exports.CRITICAL )
        lvlstr = 'CRITICAL';
      else if ( lvl >= exports.ERROR )
        lvlstr = 'ERROR';
      else if ( lvl >= exports.WARNING )
        lvlstr = 'WARNING';
      else if ( lvl >= exports.INFO )
        lvlstr = 'INFO';
      else
        lvlstr = 'DEBUG';
      var msg = '[' + this._name + '] ' + lvlstr + ': ' + sprintf.sprintf.apply(null, args);
      this._logmsg(lvl, msg);
    },
    _logmsg: function(lvl, msg) {
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
