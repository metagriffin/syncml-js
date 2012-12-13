// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js/common module
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
  '../src/syncml-js/common'
], function(_, ET, common) {
  describe('syncml-js/common', function() {

    //-------------------------------------------------------------------------
    it('makeID creates unique values', function() {
      var id1 = common.makeID();
      var id2 = common.makeID();
      expect(id1).toNotEqual(id2);
    });

    //-------------------------------------------------------------------------
    it('detects platform bit capacity', function() {
      var bits = common.platformBits();
      expect(_.indexOf([32, 64], bits)).not.toEqual(-1);
      expect('' + (Math.pow(2, 31) - 1)).toEqual('2147483647');
      if ( bits == 64 )
        expect('' + (Math.pow(2, 63) - 1)).toEqual('9223372036854775807');
      var max = common.getMaxMemorySize();
      expect('' + max).toEqual('2147483647');
    });

    //-------------------------------------------------------------------------
    it('normalizes paths', function() {
      expect(common.normpath('/a/b')).toEqual('/a/b');
      expect(common.normpath('a/b')).toEqual('a/b');
      expect(common.normpath('a//b')).toEqual('a/b');
      expect(common.normpath('a/./b')).toEqual('a/b');
      expect(common.normpath('a/c/../b')).toEqual('a/b');
      expect(common.normpath('..//../b')).toEqual('../../b');
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
