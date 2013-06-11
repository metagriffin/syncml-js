// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  syncml-js.logging
// auth: griffin <griffin@uberdev.org>
// date: 2012/11/10
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'fs',
  'underscore',
  'sprintf',
  './common',
], function(
  fs,
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
  exports.Handler = common.Base.extend({
    constructor: function() {
      this.level = exports.NOTSET;
    },
    handle: function(record) {
      if ( this.level != exports.NOTSET && this.level > record.level )
        return;
      // todo: filter/format
      return this._handle(record);
    },
    _handle: function(record) {
      throw common.NotImplementedError(
        'abstract class logging.Handler does not provide any functionality');
    }
  });

  //---------------------------------------------------------------------------
  exports.MultiHandler = exports.Handler.extend({
    constructor: function() {
      this._handlers = [];
    },
    addHandler: function(handler) {
      this._handlers.push(handler);
      return this;
    },
    removeHandler: function(handler) {
      this._handlers = _.filter(this._handlers, function(h) {
        return h != handler;
      });
      return this;
    },
    handle: function(record) {
      for ( var idx=0 ; idx<this._handlers.length ; idx++ )
      {
        try {
          this._handlers[idx].handle(record);
        }catch(e){}
      }
      return this;
    }
  });

  //---------------------------------------------------------------------------
  exports.NullHandler = exports.Handler.extend({
    handle: function(record) {
      return;
    }
  });

  //---------------------------------------------------------------------------
  exports.ConsoleHandler = exports.Handler.extend({
    _handle: function(record) {
      console.log(record.msg);
    }
  });

  //---------------------------------------------------------------------------
  exports.FileHandler = exports.Handler.extend({
    constructor: function(options) {
      options = _.defaults({}, options);
      this._filename = options.filename;
      this._append   = !! options.append;
      this._mode     = options.mode || 0644;
      this._stream   = fs.createWriteStream(this._filename, {
        flags:  this._append ? 'a' : 'w',
        mode:   this._mode
      });
    },
    _handle: function(record) {
      try{
        this._stream.write(record.msg + '\n');
      }catch(e){
        // console.log('FileHandler ERROR: ' + e);
      }
    }
  });

  var global_handler = new exports.MultiHandler();

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
      // TODO: implement this to have a per-logger handling facility...
      global_handler.handle({
        name     : this._name,
        level    : lvl,
        pathname : null,
        lineno   : null,
        msg      : msg,
        args     : null,
        exc_info : null,
        func     : null
      });
    },
    addHandler: function(handler) {
      // TODO: implement this to have a per-logger handling facility...
      global_handler.addHandler(handler);
    },
    removeHandler: function(handler) {
      // TODO: implement this to have a per-logger handling facility...
      global_handler.removeHandler(handler);
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
