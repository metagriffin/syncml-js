// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the jssyncml/ctype module
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
  '../src/jssyncml/constant',
  '../src/jssyncml/common',
  '../src/jssyncml/ctype'
], function(_, ET, constant, common, ctype) {
  describe('jssyncml/ctype', function() {

    it('generates single version XML', function() {
      var ct = new ctype.ContentTypeInfo('text/plain', '1.0', {preferred: true});
      var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<CT><CTType>text/plain</CTType><VerCT>1.0</VerCT></CT>'
      out = ct.toSyncML('CT', null);
      out = ET.tostring(out);
      expect(out).toEqual(chk);
    });

    it('generates multi version XML with non-unique VerCT', function() {
      var ct = new ctype.ContentTypeInfo('text/plain', ['1.0', '1.1']);
      var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<CT><CTType>text/plain</CTType><VerCT>1.0</VerCT><VerCT>1.1</VerCT></CT>'
      out = ct.toSyncML('CT', null);
      out = ET.tostring(out);
      expect(out).toEqual(chk);
    });

    it('generates multi version XML with unique VerCT', function() {
      var ct = new ctype.ContentTypeInfo('text/plain', ['1.0', '1.1']);
      var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<C><CT><CTType>text/plain</CTType><VerCT>1.0</VerCT></CT><CT><CTType>text/plain</CTType><VerCT>1.1</VerCT></CT></C>'
      out = ct.toSyncML('CT', true)
      var tmp = ET.Element('C');
      _.each(out, function(e) { tmp.append(e); });
      out = ET.tostring(tmp);
      expect(out).toEqual(chk);
    });

    it('parses XML tx-pref mono-version', function() {
      var xdoc = ET.parse('<Tx-Pref><CTType>text/plain</CTType><VerCT>1.0</VerCT></Tx-Pref>');
      ctype.ContentTypeInfo.fromSyncML(xdoc._root, function(err, ct) {
        expect(err).toBeFalsy();
        expect(ct.ctype).toEqual('text/plain');
        expect(ct.versions).toEqual(['1.0']);
        expect(ct.preferred).toEqual(true);
        expect(ct.transmit).toEqual(true);
        expect(ct.receive).toEqual(false);
      });
    });

    it('parses XML rx multi-version', function() {
      var xdoc = ET.parse('<Rx><CTType>text/plain</CTType><VerCT>1.0</VerCT><VerCT>1.1</VerCT></Rx>');
      ctype.ContentTypeInfo.fromSyncML(xdoc._root, function(err, ct) {
        expect(err).toBeFalsy();
        expect(ct.ctype).toEqual('text/plain');
        expect(ct.versions).toEqual(['1.0', '1.1']);
        expect(ct.preferred).toEqual(false);
        expect(ct.transmit).toEqual(false);
        expect(ct.receive).toEqual(true);
      });
    });

    it('merging of ContentTypeInfo as mergeable', function() {
      var ct1 = new ctype.ContentTypeInfo('text/plain', '1.0', { receive: false });
      var ct2 = new ctype.ContentTypeInfo('text/plain', '1.0', { transmit: false });
      expect(ct2.merge(ct1)).toEqual(true);
      expect(ct2.ctype).toEqual('text/plain');
      expect(ct2.versions).toEqual(['1.0']);
      expect(ct2.preferred).toEqual(false);
      expect(ct2.transmit).toEqual(true);
      expect(ct2.receive).toEqual(true);
    });

    it('merging of ContentTypeInfo as un-mergeable', function() {
      var ct1 = new ctype.ContentTypeInfo('text/plain', '1.0', { receive: false });
      var ct2 = new ctype.ContentTypeInfo('text/plain', '1.1', { transmit: false });
      expect(ct2.merge(ct1)).toEqual(false);
      expect(ct2.ctype).toEqual('text/plain');
      expect(ct2.versions).toEqual(['1.1']);
      expect(ct2.preferred).toEqual(false);
      expect(ct2.transmit).toEqual(false);
      expect(ct2.receive).toEqual(true);
    });

    it('converts from db struct to object', function() {
      var ct = ctype.ContentTypeInfo.fromStruct({
        ctype: 'text/plain',
        versions: ['1.0', '1.1'],
        preferred: false,
        transmit: true,
        receive: true
      });
      expect(ct.preferred).toBeFalsy();
      expect(ct.transmit).toBeTruthy();
      expect(ct.receive).toBeTruthy();
      var chk = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<C><CT><CTType>text/plain</CTType><VerCT>1.0</VerCT></CT><CT><CTType>text/plain</CTType><VerCT>1.1</VerCT></CT></C>'
      out = ct.toSyncML('CT', true);
      var tmp = ET.Element('C');
      _.each(out, function(e) { tmp.append(e); });
      out = ET.tostring(tmp);
      expect(out).toEqual(chk);
    });

    it('converts from object to db struct', function() {
      var ct = new ctype.ContentTypeInfo('text/plain', '1.1', { transmit: false });
      var out = ct.toStruct();
      expect(out).toEqual({
        ctype: 'text/plain',
        versions: ['1.1'],
        preferred: false,
        transmit: false,
        receive: true
      });
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
