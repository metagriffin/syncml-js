// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  './constant'
], function(
  _,
  constant
) {

  var exports = {};

  //---------------------------------------------------------------------------
  // object inheritance helper routines shamelessly scrubbed from backbone.js

  // The self-propagating extend function that Backbone classes use.
  var extend = exports.extend = function (protoProps, classProps) {
    var child = inherits(this, protoProps, classProps);
    child.extend = this.extend;
    return child;
  };

  // Shared empty constructor function to aid in prototype-chain creation.
  var ctor = function(){};

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var inherits = function(parent, protoProps, staticProps) {
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ parent.apply(this, arguments); };
    }

    // Inherit class (static) properties from parent.
    _.extend(child, parent);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Add static properties to the constructor function, if supplied.
    if (staticProps) _.extend(child, staticProps);

    // Correctly set child's `prototype.constructor`.
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed later.
    child.__super__ = parent.prototype;

    return child;
  };

  //-----------------------------------------------------------------------------
  exports.Base = function() {};
  exports.Base.extend = extend;

  //-----------------------------------------------------------------------------
  var SyncmlError = exports.Base.extend({
    constructor: function(msg) {
      this.message = this.name;
      if ( msg != undefined )
        this.message += ': ' + msg;
    }
  });

  _.extend(exports, {

    //---------------------------------------------------------------------------
    // exceptions
    SyncmlError:           SyncmlError.extend({name: 'SyncmlError'}),
    NotImplementedError:   SyncmlError.extend({name: 'NotImplementedError'}),
    ProtocolError:         SyncmlError.extend({name: 'ProtocolError'}),
    InternalError:         SyncmlError.extend({name: 'InternalError'}),
    ConflictError:         SyncmlError.extend({name: 'ConflictError'}),
    FeatureNotSupported:   SyncmlError.extend({name: 'FeatureNotSupported'}),
    LogicalError:          SyncmlError.extend({name: 'LogicalError'}),
    CredentialsRequired:   SyncmlError.extend({name: 'CredentialsRequired'}),
    InvalidCredentials:    SyncmlError.extend({name: 'InvalidCredentials'}),
    InvalidContext:        SyncmlError.extend({name: 'InvalidContext'}),
    InvalidAdapter:        SyncmlError.extend({name: 'InvalidAdapter'}),
    InvalidStore:          SyncmlError.extend({name: 'InvalidStore'}),
    InvalidContentType:    SyncmlError.extend({name: 'InvalidContentType'}),
    InvalidAgent:          SyncmlError.extend({name: 'InvalidAgent'}),
    InvalidContent:        SyncmlError.extend({name: 'InvalidContent'}),
    InvalidItem:           SyncmlError.extend({name: 'InvalidItem'}),
    UnknownCodec:          SyncmlError.extend({name: 'UnknownCodec'}),
    NoSuchRoute:           SyncmlError.extend({name: 'NoSuchRoute'}),
    UnknownAuthType:       SyncmlError.extend({name: 'UnknownAuthType'}),
    UnknownFormatType:     SyncmlError.extend({name: 'UnknownFormatType'}),

    //---------------------------------------------------------------------------
    // UUID generation
    makeID:                function() {
      // shamelessly scrubbed from:
      //   http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
      // (adjusted to remove the dashes)
      // todo: see some of those links on how to make this more "robust"...
      return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    },

    //-------------------------------------------------------------------------
    synctype2alert: function(type) {
      return constant.SyncTypeToAlert[type];
    },

    //-------------------------------------------------------------------------
    alert2synctype: function(alert) {
      for ( var key in constant.SyncTypeToAlert )
      {
        if ( constant.SyncTypeToAlert[key] == alert )
          return parseInt(key, 10);
      }
      return null;
    },

    //-------------------------------------------------------------------------
    cascade: function(list, iterator, cb) {
      if ( ! list )
        return cb();
      var cur = 0;
      var next = function() {
        if ( cur >= list.length )
          return cb();
        iterator(list[cur], function(err) {
          if ( err )
            return cb(err);
          cur += 1;
          return next();
        });
      };
      return next();
    },

    //-------------------------------------------------------------------------
    ts: function() {
      return Math.floor((new Date()).getTime() / 1000);
    },

    //-------------------------------------------------------------------------
    j: function(obj) {
      return JSON.stringify(obj);
    },

    //-------------------------------------------------------------------------
    platformBits: function() {

      // TODO: implement this!...

      return 32;
    },

    //-------------------------------------------------------------------------
    getMaxMemorySize: function(context) {

      // Returns the maximum size of a memory object. By default this
      // is, set to ``sys.maxint``, however the `context` may override
      // this behavior.

      // NOTE: currently, this is being hardcoded to a maximum of 2GB for
      //       compatibility with funambol servers, which croak above that
      //       value.

      // TODO: allow the context to control this, or implement auto-detect to
      //       determine what the remote peer can support...

      return Math.min(Math.pow(2, exports.platformBits() - 1) - 1,
                      Math.pow(2, 31) - 1);
    },

    //-------------------------------------------------------------------------
    normpath: function(path) {
      if ( path == undefined )
        return null;
      if ( path.length <= 0 )
        return '';
      if ( path.indexOf('/') < 0 )
        path = path.replace('\\', '/');
      var ret = [];
      var plist = path.split('/');
      for ( var idx=0 ; idx<plist.length ; idx++ )
      {
        var item = plist[idx];
        if ( item.length <= 0 || item == '.' )
          continue;
        if ( item != '..' || ret.length <= 0 || ret[ret.length - 1] == '..' )
        {
          ret.push(item);
          continue;
        }
        ret.pop();
      }
      ret = ret.join('/');
      if ( path.charAt(0) != '/' )
        return ret;
      return '/' + ret;
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
