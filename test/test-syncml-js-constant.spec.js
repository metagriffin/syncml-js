// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js/constant module
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
  '../src/syncml-js/logging',
  './helpers'
], function(_, ET, constant, logging, helpers) {

  describe('syncml-js/constant', function() {

    var handler = new logging.ConsoleHandler();

    beforeEach(function () {
      logging.level = logging.WARNING;
      logging.getLogger().addHandler(handler);
      this.addMatchers(helpers.matchers);
    });

    afterEach(function() {
      logging.getLogger().removeHandler(handler);
    });

    it('creates the correct SyncTypeToAlert lookup table', function() {
      expect(constant.SyncTypeToAlert[1]).toEqual(200);
      expect(constant.SyncTypeToAlert[2]).toEqual(201);
      expect(constant.SyncTypeToAlert[3]).toEqual(202);
      expect(constant.SyncTypeToAlert[4]).toEqual(203);
      expect(constant.SyncTypeToAlert[5]).toEqual(204);
      expect(constant.SyncTypeToAlert[6]).toEqual(205);
      expect(constant.SyncTypeToAlert[7]).toEqual(206);
    });

  });

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
