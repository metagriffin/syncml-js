// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'elementtree',
  'sqlite3',
  'indexeddb-js',
  '../src/syncml-js'
], function(_, ET, sqlite3, indexeddbjs, syncmljs) {

  describe('syncml-js', function() {

    //-------------------------------------------------------------------------
    it('declares a version', function() {
      expect(syncmljs.version).not.toBeUndefined();
      expect(syncmljs.version).not.toBeNull();
      expect(syncmljs.version).toMatch(/^\d+\.\d+\.\d$/);
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
