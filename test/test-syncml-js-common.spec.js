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
  '../src/syncml-js/common',
  '../src/syncml-js/logging',
  './helpers'
], function(_, ET, common, logging, helpers) {

  describe('syncml-js/common', function() {

    var handler = new logging.ConsoleHandler();

    beforeEach(function () {
      logging.level = logging.WARNING;
      logging.getLogger().addHandler(handler);
      this.addMatchers(helpers.matchers);
    });

    afterEach(function() {
      logging.getLogger().removeHandler(handler);
    });

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

    //-------------------------------------------------------------------------
    it('indents output streams', function() {
      var str = new common.StringStream();
      var ind = new common.IndentStream(str, '>>'); 
      str.writeln('hello there,');
      ind.writeln('for example.');
      ind.write('thats\nit, folks!');
      expect(str.getData()).toEqual('hello there,\n>>for example.\n>>thats\n>>it, folks!');
    });

    //-------------------------------------------------------------------------
    it('cascades function calls', function(done) {
      var steps = '';
      common.cascade([
        function(cb) { steps += '1'; cb(); },
        function(cb) { steps += '2'; cb(); },
        function(cb) { steps += '3'; cb(); }
      ], function(cmd, cb) {
        return cmd(cb);
      }, function(cb) {
        expect(steps).toEqual('123');
        done();
      });
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
