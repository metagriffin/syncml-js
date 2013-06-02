// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: a bridge between xpcshell and jasmine unit tests -- needs nodejs4xpcom
// auth: metagriffin <mg.npmjs@uberdev.org>
// date: 2013/05/12
// copy: (C) CopyLoose 2013 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// TODO: make nodejs4xpcom's location be elsewhere than in "test"
//       (then make it environment-configurable)
Components.utils.import("resource://test/lib/nodejs4xpcom/modules/nodejs.jsm");

//-----------------------------------------------------------------------------
var syncmljsdir = __LOCATION__.parent.parent.path;
var define_ = nodejs.make_define(__LOCATION__, {
  async: false,
  predirs: [
    syncmljsdir + '/test/lib/override_node_modules'
  ],
  libdirs: [
    syncmljsdir + '/test/lib/nodejs4xpcom/nodejs_modules',
    syncmljsdir + '/node_modules'
  ],
  globals: {
    initIndexedDBScope: function(scope) {
      // nodejs.console.log('initializing idb scope: ' + scope);
      Components.classes['@mozilla.org/dom/indexeddb/manager;1']
        .getService(Components.interfaces.nsIIndexedDatabaseManager)
        .initWindowless(scope);
      return scope;
    }
  }
});

var define = function(id, dependencies, factory, callback) {
  var args = Array.prototype.slice.call(arguments, 0);
  if ( Array.isArray(args[0]) )
    args.unshift(null);
  while ( args.length < 3 )
    args.push(null);
  callback = args[3];
  args[3] = function(err) {
    do_check_eq(err, null);
  };
  return define_.apply(null, args);
};

var jasmine    = null;
var reporter   = null;
var jasmineEnv = null;
var console    = nodejs.console;

//-----------------------------------------------------------------------------
define(['./xpcshell-jasmine-loader.js'], function(loader) {

  for ( let key in loader.globals )
    this[key] = loader.globals[key];

  jasmine    = loader.jasmine;
  reporter   = new loader.reporter.jasmineNode.TerminalVerboseReporter({color: true});
  jasmineEnv = jasmine.exports.jasmine.getEnv();
  jasmineEnv.addReporter(reporter);

});

//-----------------------------------------------------------------------------
var testGenerator = testSteps();
function testSteps()
{
  var runner = jasmineEnv.currentRunner();
  runner.finishCallback_ = runner.finishCallback;
  runner.finishCallback = function() {
    this.finishCallback_.apply(this, arguments);
    var results = this.results();
    do_check_eq(results.failedCount, 0);
    do_check_neq(results.passedCount, 0);
    finishTest();
  };
  jasmineEnv.execute();
  yield;
}

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
