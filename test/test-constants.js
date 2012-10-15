// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the constants module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

var assert    = require('assert');
var constants = require('../jssyncml/constants');

module.exports = {

  'test Constants.SyncTypeToAlert': function() {
    assert.equal(200, constants.SyncTypeToAlert[1]);
    assert.equal(201, constants.SyncTypeToAlert[2]);
    assert.equal(202, constants.SyncTypeToAlert[3]);
    assert.equal(203, constants.SyncTypeToAlert[4]);
    assert.equal(204, constants.SyncTypeToAlert[5]);
    assert.equal(205, constants.SyncTypeToAlert[6]);
    assert.equal(206, constants.SyncTypeToAlert[7]);
  },

};

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
