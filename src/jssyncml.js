// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: the base jssyncml include
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  './jssyncml/constant',
  './jssyncml/codec',
  './jssyncml/context',
  './jssyncml/ctype',
  './jssyncml/agent'
], function(
  _,
  constant,
  codec,
  context,
  ctype,
  agent
) {

  return _.extend(
    // TODO: figure out how to pull this dynamically from package.json...
    {version: '0.0.2'},
    constant,
    codec,
    context,
    ctype,
    agent
  );

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
