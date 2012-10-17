// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the constants module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

var assert    = require('assert');
var util      = require('util');
var _         = require('underscore');
var ET        = require('elementtree');
var common    = require('../jssyncml/common');
var constants = require('../jssyncml/constants');
var codec     = require('../jssyncml/codec');
var ctype     = require('../jssyncml/ctype');

module.exports = {

  'test ContentTypeInfo.toSyncML mono-version': function() {
    var ct = new ctype.ContentTypeInfo('text/plain', '1.0', {preferred: true});
    var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<CT><CTType>text/plain</CTType><VerCT>1.0</VerCT></CT>'
    ct.toSyncML('CT', null, function(out) {
      out = ET.tostring(out);
      assert.equal(out, chk);
    });
  },

  'test ContentTypeInfo.toSyncML multi-version non-unique-verct': function() {
    var ct = new ctype.ContentTypeInfo('text/plain', ['1.0', '1.1']);
    var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<CT><CTType>text/plain</CTType><VerCT>1.0</VerCT><VerCT>1.1</VerCT></CT>'
    ct.toSyncML('CT', null, function(out) {
      out = ET.tostring(out);
      assert.equal(out, chk);
    });
  },

  'test ContentTypeInfo.toSyncML multi-version unique-verct': function() {
    var ct = new ctype.ContentTypeInfo('text/plain', ['1.0', '1.1']);
    var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<C><CT><CTType>text/plain</CTType><VerCT>1.0</VerCT></CT><CT><CTType>text/plain</CTType><VerCT>1.1</VerCT></CT></C>'
    ct.toSyncML('CT', true, function(out) {
      var tmp = ET.Element('C');
      _.each(out, function(e) { tmp.append(e); });
      out = ET.tostring(tmp);
      assert.equal(out, chk);
    });
  },

  'test ContentTypeInfo.fromSyncML tx-pref mono-version': function() {
    var xdoc = ET.parse('<Tx-Pref><CTType>text/plain</CTType><VerCT>1.0</VerCT></Tx-Pref>');
    ctype.ContentTypeInfo.fromSyncML(xdoc._root, function(ct) {
      assert.equal(ct.ctype, 'text/plain');
      assert.deepEqual(ct.versions, ['1.0']);
      assert.equal(ct.preferred, true);
      assert.equal(ct.transmit, true);
      assert.equal(ct.receive, false);
    });
  },

  'test ContentTypeInfo.fromSyncML rx multi-version': function() {
    var xdoc = ET.parse('<Rx><CTType>text/plain</CTType><VerCT>1.0</VerCT><VerCT>1.1</VerCT></Rx>');
    ctype.ContentTypeInfo.fromSyncML(xdoc._root, function(ct) {
      assert.equal(ct.ctype, 'text/plain');
      assert.deepEqual(ct.versions, ['1.0', '1.1']);
      assert.equal(ct.preferred, false);
      assert.equal(ct.transmit, false);
      assert.equal(ct.receive, true);
    });
  },

  'test ContentTypeInfo.merge is-mergeable': function() {
    var ct1 = new ctype.ContentTypeInfo('text/plain', '1.0', { receive: false });
    var ct2 = new ctype.ContentTypeInfo('text/plain', '1.0', { transmit: false });
    assert.equal(ct2.merge(ct1), true);
    assert.equal(ct2.ctype, 'text/plain');
    assert.deepEqual(ct2.versions, ['1.0']);
    assert.equal(ct2.preferred, false);
    assert.equal(ct2.transmit, true);
    assert.equal(ct2.receive, true);
  },

  'test ContentTypeInfo.merge is-not-mergeable': function() {
    var ct1 = new ctype.ContentTypeInfo('text/plain', '1.0', { receive: false });
    var ct2 = new ctype.ContentTypeInfo('text/plain', '1.1', { transmit: false });
    assert.equal(ct2.merge(ct1), false);
    assert.equal(ct2.ctype, 'text/plain');
    assert.deepEqual(ct2.versions, ['1.1']);
    assert.equal(ct2.preferred, false);
    assert.equal(ct2.transmit, false);
    assert.equal(ct2.receive, true);
  },

};

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
