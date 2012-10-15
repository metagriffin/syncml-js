// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

var us = require('underscore');

//-----------------------------------------------------------------------------
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
  us.extend(child, parent);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function.
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();

  // Add prototype properties (instance properties) to the subclass,
  // if supplied.
  if (protoProps) us.extend(child.prototype, protoProps);

  // Add static properties to the constructor function, if supplied.
  if (staticProps) us.extend(child, staticProps);

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

us.extend(exports, {

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

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
