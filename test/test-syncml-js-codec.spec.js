// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js/codec module
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
  '../src/syncml-js/codec'
], function(_, ET, constant, codec) {
  describe('syncml-js/codec', function() {

    //-------------------------------------------------------------------------
    it('throws an exception for unknown codecs', function() {
      expect(function() {
        codec.Codec.factory('no-such-codec');
      }).toThrow('UnknownCodec: unknown or unimplemented codec "no-such-codec"');
    });

    //-------------------------------------------------------------------------
    it('encodes XML', function() {
      var encoder = codec.Codec.factory(constant.CODEC_XML);
      var xdoc  = ET.Element(constant.NODE_SYNCML);
      xdoc.set('xmlns', constant.NAMESPACE_SYNCML_1_2);
      var xhdr  = ET.SubElement(xdoc, 'SyncHdr');
      var xver  = ET.SubElement(xhdr, 'VerDTD');
      xver.set('xmlns', constant.NAMESPACE_METINF);
      xver.text = '1.2'
      var chk = '<?xml version="1.0" encoding="utf-8"?>\n'
        + '<SyncML xmlns="syncml:syncml1.2">'
        +  '<SyncHdr>'
        +   '<VerDTD xmlns="syncml:metinf">1.2</VerDTD>'
        +  '</SyncHdr>'
        + '</SyncML>';
      encoder.encode(xdoc, function(err, ctype, data) {
        expect(err).toBeFalsy();
        expect(ctype).toEqual('application/vnd.syncml+xml; charset=UTF-8');
        expect(data).toEqual(chk);
      });
    });

    //-------------------------------------------------------------------------
    it('decodes XML', function() {
      var decoder = codec.Codec.factory(constant.CODEC_XML);
      decoder.decode(
        'application/vnd.syncml+xml',
        '<?xml version="1.0" encoding="utf-8"?>'
          + '<root><node1>v1</node1><node2 xmlns="syncml:metinf">v2</node2></root>',
        function(err, node) {
          expect(err).toBeFalsy();
          expect(node.findtext('node1')).toEqual('v1');
          expect(node.findtext('node2')).toEqual('v2');
        });
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
