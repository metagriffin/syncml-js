// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the constants module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

var assert    = require('assert');
var common    = require('../jssyncml/common');
var constants = require('../jssyncml/constants');
var codec     = require('../jssyncml/codec');
var ET        = require('elementtree');

module.exports = {

  'test Codec.factory with unknown codec': function() {
    try {
      var obj = codec.Codec.factory('no-such-codec');
    } catch(e) {
      assert.equal(
        'UnknownCodec: unknown or unimplemented codec "no-such-codec"',
        e.message);
    }
  },

  'test XmlCodec.encode': function() {
    var encoder = codec.Codec.factory(constants.CODEC_XML);
    var xdoc  = ET.Element(constants.NODE_SYNCML);
    xdoc.set('xmlns', constants.NAMESPACE_SYNCML_1_2);
    var xhdr  = ET.SubElement(xdoc, 'SyncHdr');
    var xver  = ET.SubElement(xhdr, 'VerDTD');
    xver.set('xmlns', constants.NAMESPACE_METINF);
    xver.text = '1.2'
    var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n'
      + '<SyncML xmlns="syncml:syncml1.2">'
      +  '<SyncHdr>'
      +   '<VerDTD xmlns="syncml:metinf">1.2</VerDTD>'
      +  '</SyncHdr>'
      + '</SyncML>';
    encoder.encode(xdoc, function(ctype, data) {
      assert.equal(ctype, 'application/vnd.syncml+xml; charset=UTF-8');
      assert.equal(data, chk);
    });
  },

  'test XmlCodec.decode': function() {
    var decoder = codec.Codec.factory(constants.CODEC_XML);
    decoder.decode(
      'application/vnd.syncml+xml',
      '<?xml version="1.0" encoding="utf-8"?>'
      + '<root><node1>v1</node1><node2 xmlns="syncml:metinf">v2</node2></root>',
      function(node) {
        assert.equal(node.findtext('node1'), 'v1');
        assert.equal(node.findtext('node2'), 'v2');
      });
  },

};

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
