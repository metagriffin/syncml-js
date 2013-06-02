// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: a bridge between xpcshell and jasmine unit tests -- needs nodejs4xpcom
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2013/05/23
// copy: (C) CopyLoose 2013 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

var notFromJasmine = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'isCommonJS',
  'jasmine'
];

define([
  'underscore',
  '../node_modules/jasmine-node/lib/jasmine-node/jasmine-2.0.0.rc1.js',
  '../node_modules/jasmine-node/lib/jasmine-node/reporter.js'
], function(_, jasmine_, reporter_) {

  var exports = {globals: {}};

  this.jasmine = jasmine_.jasmine;
  exports.async = require('../node_modules/jasmine-node/lib/jasmine-node/async-callback.js');

  for ( let key in jasmine_ )
  {
    if ( reporter_[key] || _.contains(notFromJasmine, key) )
      continue;
    exports.globals[key] = jasmine_[key];
  }

  exports.jasmine  = jasmine_;
  exports.reporter = reporter_;
  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
