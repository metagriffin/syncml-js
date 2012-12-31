// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: the base syncml-js include
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  './syncml-js/constant',
  './syncml-js/common',
  './syncml-js/codec',
  './syncml-js/state',
  './syncml-js/context',
  './syncml-js/ctype',
  './syncml-js/agent',
  './syncml-js/router',
  './syncml-js/synchronizer',
  './syncml-js/protocol',
  './syncml-js/logging'
], function(
  _,
  constant,
  common,
  codec,
  state,
  context,
  ctype,
  agent,
  router,
  synchronizer,
  protocol,
  logging
) {

  return _.extend(
    constant,
    codec,
    state,
    context,
    ctype,
    agent,
    router,
    synchronizer,
    protocol,
    {
      // TODO: figure out how to pull this dynamically from package.json...
      version:           '0.0.11',
      platformBits:      common.platformBits,
      getMaxMemorySize:  common.getMaxMemorySize,
      common:            common,
      logging:           logging
    }
  );

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
