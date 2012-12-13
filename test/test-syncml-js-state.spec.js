// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js/state module
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
  '../src/syncml-js/constant',
  '../src/syncml-js/common',
  '../src/syncml-js/state'
], function(_, ET, constant, common, state) {
  describe('syncml-js/state', function() {

    it('isolates Stats member variables', function() {
      var s1 = state.makeStats();
      s1.hereAdd += 1;
      s1.hereAdd += 1;
      expect(s1.hereAdd).toEqual(2);
      var s2 = state.makeStats();
      s2.hereAdd += 1;
      s2.hereAdd += 1;
      expect(s2.hereAdd).toEqual(2);
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
