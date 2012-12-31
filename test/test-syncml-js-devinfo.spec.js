// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js/devinfo module
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/12/31
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'elementtree',
  'sqlite3',
  'indexeddb-js',
  '../src/syncml-js',
  '../src/syncml-js/logging',
  '../src/syncml-js/common',
  '../src/syncml-js/devinfo',
  './helpers.js'
], function(_, ET, sqlite3, indexeddbjs, syncml, logging, common, devinfo, helpers) {

  describe('syncml-js/devinfo', function() {

    beforeEach(function () {
      // logging.level = logging.NOTSET;
      logging.level = logging.WARNING;
      this.addMatchers(helpers.matchers);
    });

    //-------------------------------------------------------------------------
    it('serializes extensions to XML', function(done) {
      var di = new devinfo.DevInfo(null, {devID: 'this-globally-unique-id'});
      di.setExtension('foo', 'bar');
      di.setExtension('x-array', ['x-item-1', 'x-item-2']);
      var out = ET.tostring(di.toSyncML())
      var chk = ''
        + '<DevInf xmlns="syncml:devinf">'
        + ' <VerDTD>1.2</VerDTD>'
        + ' <Man>-</Man>'
        + ' <Mod>-</Mod>'
        + ' <OEM>-</OEM>'
        + ' <FwV>-</FwV>'
        + ' <SwV>-</SwV>'
        + ' <HwV>-</HwV>'
        + ' <DevID>this-globally-unique-id</DevID>'
        + ' <DevTyp>workstation</DevTyp>'
        + ' <UTC/>'
        + ' <SupportLargeObjs/>'
        + ' <SupportHierarchicalSync/>'
        + ' <SupportNumberOfChanges/>'
        + ' <Ext>'
        + '  <XNam>foo</XNam>'
        + '  <XVal>bar</XVal>'
        + '  <XNam>x-array</XNam>'
        + '  <XVal>x-item-1</XVal>'
        + '  <XVal>x-item-2</XVal>'
        + ' </Ext>'
        + '</DevInf>'
      ;
      expect(out).toEqualXml(chk);
      done();
    });

    //-------------------------------------------------------------------------
    it('accepts constructor extensions with arrays and non-arrays', function(done) {
      var di = new devinfo.DevInfo(null, {
        devID      : 'this-globally-unique-id',
        extensions : {
          'foo'     : 'bar',
          'x-array' : ['x-item-1', 'x-item-2']
        }
      });
      di.setExtension('x-array', ['x-item-1', 'x-item-2']);
      var out = ET.tostring(di.toSyncML())
      var chk = ''
        + '<DevInf xmlns="syncml:devinf">'
        + ' <VerDTD>1.2</VerDTD>'
        + ' <Man>-</Man>'
        + ' <Mod>-</Mod>'
        + ' <OEM>-</OEM>'
        + ' <FwV>-</FwV>'
        + ' <SwV>-</SwV>'
        + ' <HwV>-</HwV>'
        + ' <DevID>this-globally-unique-id</DevID>'
        + ' <DevTyp>workstation</DevTyp>'
        + ' <UTC/>'
        + ' <SupportLargeObjs/>'
        + ' <SupportHierarchicalSync/>'
        + ' <SupportNumberOfChanges/>'
        + ' <Ext>'
        + '  <XNam>foo</XNam>'
        + '  <XVal>bar</XVal>'
        + '  <XNam>x-array</XNam>'
        + '  <XVal>x-item-1</XVal>'
        + '  <XVal>x-item-2</XVal>'
        + ' </Ext>'
        + '</DevInf>'
      ;
      expect(out).toEqualXml(chk);
      done();
    });

    //-------------------------------------------------------------------------
    it('parses extensions from XML', function(done) {
      var xml  = ''
        + '<DevInf xmlns="syncml:devinf">'
        + ' <VerDTD>1.2</VerDTD>'
        + ' <Man>-</Man>'
        + ' <Mod>-</Mod>'
        + ' <OEM>-</OEM>'
        + ' <FwV>-</FwV>'
        + ' <SwV>-</SwV>'
        + ' <HwV>-</HwV>'
        + ' <DevID>this-globally-unique-id</DevID>'
        + ' <DevTyp>workstation</DevTyp>'
        + ' <UTC/>'
        + ' <SupportLargeObjs/>'
        + ' <SupportHierarchicalSync/>'
        + ' <SupportNumberOfChanges/>'
        + ' <Ext>'
        + '  <XNam>foo</XNam>'
        + '  <XVal>bar</XVal>'
        + '  <XNam>x-array</XNam>'
        + '  <XVal>x-item-1</XVal>'
        + '  <XVal>x-item-2</XVal>'
        + ' </Ext>'
        + '</DevInf>'
      ;
      var pair = devinfo.DevInfo.fromSyncML(ET.parse(xml).getroot());
      var di = pair[0];
      expect(di.getExtensionKeys()).toEqual(['foo', 'x-array']);
      expect(di.getExtension('foo')).toEqual(['bar']);
      expect(di.getExtension('x-array')).toEqual(['x-item-1', 'x-item-2']);
      done();
    });


  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
