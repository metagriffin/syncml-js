// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the jssyncml module
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
  'jsindexeddb',
  '../src/jssyncml'
], function(_, ET, sqlite3, jsindexeddb, jssyncml) {

  describe('jssyncml', function() {

    //-------------------------------------------------------------------------
    it('declares a version', function() {
      expect(jssyncml.version).not.toBeUndefined();
      expect(jssyncml.version).not.toBeNull();
      expect(jssyncml.version).toMatch(/^\d+\.\d+\.\d$/);
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
