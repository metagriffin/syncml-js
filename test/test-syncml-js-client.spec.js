// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js module in client-mode
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
  'sqlite3',
  'indexeddb-js',
  'diff',
  './helpers.js',
  '../src/syncml-js',
  '../src/syncml-js/logging',
  '../src/syncml-js/common',
  '../src/syncml-js/state'
], function(_, ET, sqlite3, indexeddbjs, diff, helpers, syncmljs, logging, common, state) {

  describe('syncml-js/client', function() {

    var seenRequests = '';

    beforeEach(function () {
      logging.level = logging.WARNING;
      this.addMatchers(helpers.matchers);
      seenRequests = '';
    });

    //-------------------------------------------------------------------------
    var setupAdapter = function(callback) {

      var sync = {
        adapter: null,
        store:   null,
        peer:    null,
        agent:   new helpers.TestAgent()
      };

      var sdb = new sqlite3.Database(':memory:');
      // var sdb = new sqlite3.Database('./test.db');
      var idb = new indexeddbjs.indexedDB('sqlite3', sdb);

      var context = new syncmljs.Context({
        storage: idb,
        prefix:  'memoryBasedClient.'
      });

      context.getEasyClientAdapter({
        name: 'In-Memory Test Client',
        devInfo: {
          devID               : 'test-syncml-js-devid',
          devType             : syncmljs.DEVTYPE_WORKSTATION,
          manufacturerName    : 'syncml-js',
          modelName           : 'syncml-js.test.suite.client',
          hierarchicalSync    : false
        },
        stores: [
          {
            uri          : 'cli_memo',
            displayName  : 'Memo Taker',
            maxGuidSize  : helpers.getAddressSize(),
            maxObjSize   : helpers.getMaxMemorySize(),
            agent        : sync.agent
          }
        ],
        peer: {
          url      : 'https://www.example.com/sync',
          auth     : syncmljs.NAMESPACE_AUTH_BASIC,
          username : 'guest',
          password : 'guest'
        },
        routes: [
          [ 'cli_memo', 'srv_note' ],
        ]
      }, function(err, adapter, stores, peer) {
        expect(err).toBeFalsy();
        if ( err )
          return callback(err);
        expect(adapter).toBeTruthy();
        expect(stores.length).toEqual(1);
        expect(peer).toBeTruthy();
        sync.adapter = adapter;
        sync.store   = stores[0];
        sync.peer    = peer;
        callback(null, sync);
      });

    };

    //-------------------------------------------------------------------------
    var doFirstSync = function(sync, callback) {
      expect(sync).not.toBeFalsy();
      expect(sync.adapter).not.toBeFalsy();
      expect(sync.store).not.toBeFalsy();
      expect(sync.agent).not.toBeFalsy();

      var scanForChanges = function(cb) {
        // not doing a scan as we will force a slow-sync
        sync.agent._items['1'] = {id: '1', body: 'first'};
        cb();
      };

      // TODO: add jasmine spies here...
      //       note that it may require use of jasmine.Clock.tick()...

      var synchronize = function(cb) {

        var fake_request_1 = {
          sendRequest: function(txn, contentType, requestBody, cb) {
            seenRequests += '1';
            var chk =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>1</MsgID>'
              + '  <Source>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '  </Target>'
              + '  <Cred>'
              + '    <Meta>'
              + '      <Format xmlns="syncml:metinf">b64</Format>'
              + '      <Type xmlns="syncml:metinf">syncml:auth-basic</Type>'
              + '    </Meta>'
              + '    <Data>Z3Vlc3Q6Z3Vlc3Q=</Data>'
              + '  </Cred>'
              + '  <Meta>'
              + '   <MaxMsgSize xmlns="syncml:metinf">' + helpers.getMaxMemorySize() + '</MaxMsgSize>'
              + '   <MaxObjSize xmlns="syncml:metinf">' + helpers.getMaxMemorySize() + '</MaxObjSize>'
              + '  </Meta>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Put>'
              + '   <CmdID>1</CmdID>'
              + '   <Meta><Type xmlns="syncml:metinf">application/vnd.syncml-devinf+xml</Type></Meta>'
              + '   <Item>'
              + '    <Source><LocURI>./devinf12</LocURI><LocName>./devinf12</LocName></Source>'
              + '    <Data>'
              + '     <DevInf xmlns="syncml:devinf">'
              + '      <VerDTD>1.2</VerDTD>'
              + '      <Man>syncml-js</Man>'
              + '      <Mod>syncml-js.test.suite.client</Mod>'
              + '      <OEM>-</OEM>'
              + '      <FwV>-</FwV>'
              + '      <SwV>-</SwV>'
              + '      <HwV>-</HwV>'
              + '      <DevID>test-syncml-js-devid</DevID>'
              + '      <DevTyp>workstation</DevTyp>'
              + '      <UTC/>'
              + '      <SupportLargeObjs/>'
              + '      <SupportNumberOfChanges/>'
              + '      <DataStore>'
              + '       <SourceRef>cli_memo</SourceRef>'
              + '       <DisplayName>Memo Taker</DisplayName>'
              + '       <MaxGUIDSize>' + helpers.getAddressSize() + '</MaxGUIDSize>'
              + '       <MaxObjSize>' + helpers.getMaxMemorySize() + '</MaxObjSize>'
              + '       <Rx-Pref><CTType>text/x-s4j-sifn</CTType><VerCT>1.1</VerCT></Rx-Pref>'
              + '       <Rx><CTType>text/x-s4j-sifn</CTType><VerCT>1.0</VerCT></Rx>'
              + '       <Rx><CTType>text/plain</CTType><VerCT>1.1</VerCT></Rx>'
              + '       <Rx><CTType>text/plain</CTType><VerCT>1.0</VerCT></Rx>'
              + '       <Tx-Pref><CTType>text/x-s4j-sifn</CTType><VerCT>1.1</VerCT></Tx-Pref>'
              + '       <Tx><CTType>text/x-s4j-sifn</CTType><VerCT>1.0</VerCT></Tx>'
              + '       <Tx><CTType>text/plain</CTType><VerCT>1.1</VerCT></Tx>'
              + '       <Tx><CTType>text/plain</CTType><VerCT>1.0</VerCT></Tx>'
              + '       <SyncCap>'
              + '        <SyncType>1</SyncType>'
              + '        <SyncType>2</SyncType>'
              + '        <SyncType>3</SyncType>'
              + '        <SyncType>4</SyncType>'
              + '        <SyncType>5</SyncType>'
              + '        <SyncType>6</SyncType>'
              + '        <SyncType>7</SyncType>'
              + '       </SyncCap>'
              + '      </DataStore>'
              + '     </DevInf>'
              + '    </Data>'
              + '   </Item>'
              + '  </Put>'
              + '  <Get>'
              + '   <CmdID>2</CmdID>'
              + '   <Meta><Type xmlns="syncml:metinf">application/vnd.syncml-devinf+xml</Type></Meta>'
              + '   <Item>'
              + '    <Target><LocURI>./devinf12</LocURI><LocName>./devinf12</LocName></Target>'
              + '   </Item>'
              + '  </Get>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';
            expect(contentType).toEqual('application/vnd.syncml+xml; charset=UTF-8');
            // todo: make this display in "pretty" xml and "multi-line-diff" mode...
            expect(requestBody).toEqualXml(chk);

            var responseType = 'application/vnd.syncml+xml; charset=UTF-8';
            var responseBody =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>1</MsgID>'
              + '  <Source>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '   <LocName>Fake Server</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Target>'
              + '  <RespURI>https://www.example.com/sync;s=9D35ACF5AEDDD26AC875EE1286F3C048</RespURI>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Status>'
              + '   <CmdID>1</CmdID>'
              + '   <MsgRef>1</MsgRef>'
              + '   <CmdRef>0</CmdRef>'
              + '   <Cmd>SyncHdr</Cmd>'
              + '   <SourceRef>test-syncml-js-devid</SourceRef>'
              + '   <TargetRef>https://www.example.com/sync</TargetRef>'
              + '   <Data>212</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>2</CmdID>'
              + '   <MsgRef>1</MsgRef>'
              + '   <CmdRef>1</CmdRef>'
              + '   <Cmd>Put</Cmd>'
              + '   <SourceRef>./devinf12</SourceRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>3</CmdID>'
              + '   <MsgRef>1</MsgRef>'
              + '   <CmdRef>2</CmdRef>'
              + '   <Cmd>Get</Cmd>'
              + '   <TargetRef>./devinf12</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Results>'
              + '   <CmdID>4</CmdID>'
              + '   <MsgRef>1</MsgRef>'
              + '   <CmdRef>2</CmdRef>'
              + '   <Meta><Type xmlns="syncml:metinf">application/vnd.syncml-devinf+xml</Type></Meta>'
              + '   <Item>'
              + '    <Source><LocURI>./devinf12</LocURI></Source>'
              + '    <Data>'
              + '     <DevInf xmlns="syncml:devinf">'
              + '      <VerDTD>1.2</VerDTD>'
              + '      <Man>syncml-js</Man>'
              + '      <Mod>syncml-js.test.suite.server</Mod>'
              + '      <OEM>-</OEM>'
              + '      <FwV>1.2.3</FwV>'
              + '      <SwV>4.5.6</SwV>'
              + '      <HwV>7.8.9</HwV>'
              + '      <DevID>syncml-js.test.suite.server</DevID>'
              + '      <DevTyp>server</DevTyp>'
              + '      <UTC/>'
              + '      <SupportLargeObjs/>'
              + '      <SupportNumberOfChanges/>'
              // + '      <SupportHierarchicalSync/>'
              + '      <DataStore>'
              + '       <SourceRef>srv_note</SourceRef>'
              + '       <DisplayName>Note Storage</DisplayName>'
              + '       <MaxGUIDSize>' + helpers.getAddressSize() + '</MaxGUIDSize>'
              + '       <Rx-Pref><CTType>text/x-s4j-sifn</CTType><VerCT>1.1</VerCT></Rx-Pref>'
              + '       <Rx><CTType>text/x-s4j-sifn</CTType><VerCT>1.0</VerCT></Rx>'
              + '       <Rx><CTType>text/plain</CTType><VerCT>1.1</VerCT><VerCT>1.0</VerCT></Rx>'
              + '       <Tx-Pref><CTType>text/x-s4j-sifn</CTType><VerCT>1.1</VerCT></Tx-Pref>'
              + '       <Tx><CTType>text/x-s4j-sifn</CTType><VerCT>1.0</VerCT></Tx>'
              + '       <Tx><CTType>text/plain</CTType><VerCT>1.1</VerCT><VerCT>1.0</VerCT></Tx>'
              + '       <SyncCap>'
              + '        <SyncType>1</SyncType>'
              + '        <SyncType>2</SyncType>'
              + '        <SyncType>3</SyncType>'
              + '        <SyncType>4</SyncType>'
              + '        <SyncType>5</SyncType>'
              + '        <SyncType>6</SyncType>'
              + '        <SyncType>7</SyncType>'
              + '       </SyncCap>'
              + '      </DataStore>'
              + '     </DevInf>'
              + '    </Data>'
              + '   </Item>'
              + '  </Results>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';
            var response = {
              headers: { 'Content-Type': responseType },
              body: responseBody
            };
            sync.peer._proxy = fake_request_2;
            cb(null, response);
          }
        };

        var fake_request_2 = {
          sendRequest: function(txn, contentType, requestBody, cb) {
            seenRequests += '2';
            var nextAnchor = ET.parse(requestBody)
              .getroot().findtext('SyncBody/Alert/Item/Meta/Anchor/Next');
            expect(parseInt(nextAnchor, 10)).toBeCloseTo((new Date()).getTime()/1000, -2);
            var chk =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>2</MsgID>'
              + '  <Source>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '  </Target>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Status>'
              + '   <CmdID>1</CmdID>'
              + '   <MsgRef>1</MsgRef>'
              + '   <CmdRef>0</CmdRef>'
              + '   <Cmd>SyncHdr</Cmd>'
              + '   <SourceRef>https://www.example.com/sync</SourceRef>'
              + '   <TargetRef>test-syncml-js-devid</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>2</CmdID>'
              + '   <MsgRef>1</MsgRef>'
              + '   <CmdRef>4</CmdRef>'
              + '   <Cmd>Results</Cmd>'
              + '   <SourceRef>./devinf12</SourceRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Alert>'
              + '   <CmdID>3</CmdID>'
              + '   <Data>201</Data>'
              + '   <Item>'
              + '    <Source><LocURI>cli_memo</LocURI></Source>'
              + '    <Target><LocURI>srv_note</LocURI></Target>'
              + '    <Meta>'
              + '     <Anchor xmlns="syncml:metinf"><Next>' + nextAnchor + '</Next></Anchor>'
              + '     <MaxObjSize xmlns="syncml:metinf">' + helpers.getMaxMemorySize() + '</MaxObjSize>'
              + '    </Meta>'
              + '   </Item>'
              + '  </Alert>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';
            expect(contentType).toEqual('application/vnd.syncml+xml; charset=UTF-8');
            expect(requestBody).toEqualXml(chk);

            var responseType = 'application/vnd.syncml+xml; charset=UTF-8';
            var responseBody =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>2</MsgID>'
              + '  <Source>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '   <LocName>Fake Server</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Target>'
              + '  <RespURI>https://www.example.com/sync;s=9D35ACF5AEDDD26AC875EE1286F3C048</RespURI>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Status>'
              + '   <CmdID>1</CmdID>'
              + '   <MsgRef>2</MsgRef>'
              + '   <CmdRef>0</CmdRef>'
              + '   <Cmd>SyncHdr</Cmd>'
              + '   <SourceRef>test-syncml-js-devid</SourceRef>'
              + '   <TargetRef>https://www.example.com/sync</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>2</CmdID>'
              + '   <MsgRef>2</MsgRef>'
              + '   <CmdRef>3</CmdRef>'
              + '   <Cmd>Alert</Cmd>'
              + '   <SourceRef>cli_memo</SourceRef>'
              + '   <TargetRef>srv_note</TargetRef>'
              + '   <Data>200</Data>'
              + '   <Item>'
              + '    <Data>'
              + '     <Anchor xmlns="syncml:metinf"><Next>' + nextAnchor + '</Next></Anchor>'
              + '    </Data>'
              + '   </Item>'
              + '  </Status>'
              + '  <Alert>'
              + '   <CmdID>3</CmdID>'
              + '   <Data>201</Data>'
              + '   <Item>'
              + '    <Source><LocURI>srv_note</LocURI></Source>'
              + '    <Target><LocURI>cli_memo</LocURI></Target>'
              + '    <Meta>'
              + '     <Anchor xmlns="syncml:metinf"><Next>' + nextAnchor + '</Next></Anchor>'
              + '     <MaxObjSize xmlns="syncml:metinf">' + helpers.getMaxMemorySize() + '</MaxObjSize>'
              + '    </Meta>'
              + '   </Item>'
              + '  </Alert>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';
            var response = {
              headers: { 'Content-Type': responseType },
              body: responseBody
            };
            sync.peer._proxy = fake_request_3;
            cb(null, response);
          }
        };

        var fake_request_3 = {
          sendRequest: function(txn, contentType, requestBody, cb) {
            seenRequests += '3';
            var nextAnchor = ET.parse(requestBody)
              .getroot().findtext('SyncBody/Status/Item/Data/Anchor/Next');
            expect(parseInt(nextAnchor, 10)).toBeCloseTo((new Date()).getTime()/1000, -2);

            var chk =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>3</MsgID>'
              + '  <Source>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '  </Target>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Status>'
              + '   <CmdID>1</CmdID>'
              + '   <MsgRef>2</MsgRef>'
              + '   <CmdRef>0</CmdRef>'
              + '   <Cmd>SyncHdr</Cmd>'
              + '   <SourceRef>https://www.example.com/sync</SourceRef>'
              + '   <TargetRef>test-syncml-js-devid</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>2</CmdID>'
              + '   <MsgRef>2</MsgRef>'
              + '   <CmdRef>3</CmdRef>'
              + '   <Cmd>Alert</Cmd>'
              + '   <SourceRef>srv_note</SourceRef>'
              + '   <TargetRef>cli_memo</TargetRef>'
              + '   <Data>200</Data>'
              + '   <Item>'
              + '    <Data>'
              + '     <Anchor xmlns="syncml:metinf">'
              + '      <Next>' + nextAnchor + '</Next>'
              + '     </Anchor>'
              + '    </Data>'
              + '   </Item>'
              + '  </Status>'
              + '  <Sync>'
              + '   <CmdID>3</CmdID>'
              + '   <Source><LocURI>cli_memo</LocURI></Source>'
              + '   <Target><LocURI>srv_note</LocURI></Target>'
              + '   <NumberOfChanges>1</NumberOfChanges>'
              + '   <Add>'
              + '    <CmdID>4</CmdID>'
              + '    <Meta><Type xmlns="syncml:metinf">text/x-s4j-sifn</Type></Meta>'
              + '    <Item>'
              + '     <Source><LocURI>1</LocURI></Source>'
              + '     <Data>first</Data>'
              + '    </Item>'
              + '   </Add>'
              + '  </Sync>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';
            expect(contentType).toEqual('application/vnd.syncml+xml; charset=UTF-8');
            expect(requestBody).toEqualXml(chk);

            var responseType = 'application/vnd.syncml+xml; charset=UTF-8';
            var responseBody =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>3</MsgID>'
              + '  <Source>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '   <LocName>Fake Server</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Target>'
              + '  <RespURI>https://www.example.com/sync;s=9D35ACF5AEDDD26AC875EE1286F3C048</RespURI>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Status>'
              + '   <CmdID>1</CmdID>'
              + '   <MsgRef>3</MsgRef>'
              + '   <CmdRef>0</CmdRef>'
              + '   <Cmd>SyncHdr</Cmd>'
              + '   <SourceRef>test-syncml-js-devid</SourceRef>'
              + '   <TargetRef>https://www.example.com/sync</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>2</CmdID>'
              + '   <MsgRef>3</MsgRef>'
              + '   <CmdRef>3</CmdRef>'
              + '   <Cmd>Sync</Cmd>'
              + '   <SourceRef>cli_memo</SourceRef>'
              + '   <TargetRef>srv_note</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>3</CmdID>'
              + '   <MsgRef>3</MsgRef>'
              + '   <CmdRef>4</CmdRef>'
              + '   <Cmd>Add</Cmd>'
              + '   <SourceRef>1</SourceRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Sync>'
              + '   <CmdID>4</CmdID>'
              + '   <Source><LocURI>srv_note</LocURI></Source>'
              + '   <Target><LocURI>cli_memo</LocURI></Target>'
              + '   <NumberOfChanges>1</NumberOfChanges>'
              + '   <Add>'
              + '    <CmdID>5</CmdID>'
              + '    <Meta><Type xmlns="syncml:metinf">text/x-s4j-sifn</Type></Meta>'
              + '    <Item>'
              + '     <Source><LocURI>50</LocURI></Source>'
              + '     <Data>some text content</Data>'
              + '    </Item>'
              + '   </Add>'
              + '  </Sync>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';
            var response = {
              headers: { 'Content-Type': responseType },
              body: responseBody
            };
            sync.peer._proxy = fake_request_4;
            cb(null, response);
          }
        };

        var fake_request_4 = {
          sendRequest: function(txn, contentType, requestBody, cb) {
            seenRequests += '4';
            var chk =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>4</MsgID>'
              + '  <Source>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '  </Target>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Status>'
              + '   <CmdID>1</CmdID>'
              + '   <MsgRef>3</MsgRef>'
              + '   <CmdRef>0</CmdRef>'
              + '   <Cmd>SyncHdr</Cmd>'
              + '   <SourceRef>https://www.example.com/sync</SourceRef>'
              + '   <TargetRef>test-syncml-js-devid</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>2</CmdID>'
              + '   <MsgRef>3</MsgRef>'
              + '   <CmdRef>4</CmdRef>'
              + '   <Cmd>Sync</Cmd>'
              + '   <SourceRef>srv_note</SourceRef>'
              + '   <TargetRef>cli_memo</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>3</CmdID>'
              + '   <MsgRef>3</MsgRef>'
              + '   <CmdRef>5</CmdRef>'
              + '   <Cmd>Add</Cmd>'
              + '   <SourceRef>50</SourceRef>'
              + '   <Data>201</Data>'
              + '  </Status>'
              + '  <Map>'
              + '   <CmdID>4</CmdID>'
              + '   <Source><LocURI>cli_memo</LocURI></Source>'
              + '   <Target><LocURI>srv_note</LocURI></Target>'
              + '   <MapItem>'
              + '    <Source><LocURI>1000</LocURI></Source>'
              + '    <Target><LocURI>50</LocURI></Target>'
              + '   </MapItem>'
              + '  </Map>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';
            expect(contentType).toEqual('application/vnd.syncml+xml; charset=UTF-8');
            expect(requestBody).toEqualXml(chk);

            var responseType = 'application/vnd.syncml+xml; charset=UTF-8';
            var responseBody =
              '<SyncML>'
              + ' <SyncHdr>'
              + '  <VerDTD>1.2</VerDTD>'
              + '  <VerProto>SyncML/1.2</VerProto>'
              + '  <SessionID>1</SessionID>'
              + '  <MsgID>4</MsgID>'
              + '  <Source>'
              + '   <LocURI>https://www.example.com/sync</LocURI>'
              + '   <LocName>Fake Server</LocName>'
              + '  </Source>'
              + '  <Target>'
              + '   <LocURI>test-syncml-js-devid</LocURI>'
              + '   <LocName>In-Memory Test Client</LocName>'
              + '  </Target>'
              + '  <RespURI>https://www.example.com/sync;s=9D35ACF5AEDDD26AC875EE1286F3C048</RespURI>'
              + ' </SyncHdr>'
              + ' <SyncBody>'
              + '  <Status>'
              + '   <CmdID>1</CmdID>'
              + '   <MsgRef>4</MsgRef>'
              + '   <CmdRef>0</CmdRef>'
              + '   <Cmd>SyncHdr</Cmd>'
              + '   <SourceRef>test-syncml-js-devid</SourceRef>'
              + '   <TargetRef>https://www.example.com/sync</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Status>'
              + '   <CmdID>2</CmdID>'
              + '   <MsgRef>4</MsgRef>'
              + '   <CmdRef>4</CmdRef>'
              + '   <Cmd>Map</Cmd>'
              + '   <SourceRef>cli_memo</SourceRef>'
              + '   <TargetRef>srv_note</TargetRef>'
              + '   <Data>200</Data>'
              + '  </Status>'
              + '  <Final/>'
              + ' </SyncBody>'
              + '</SyncML>';

            var response = {
              headers: { 'Content-Type': responseType },
              body: responseBody
            };
            sync.peer._proxy = fake_request_5;

            cb(null, response);
          }
        };

        var fake_request_5 = {
          sendRequest: function(txn, contentType, requestBody, cb) {
            seenRequests += '5';
            // request #4 should have been the last...
            expect('this').toBe('*not* called');
            cb('error');
          }
        };

        // NOTE: using peer._proxy is only for testing purposes!...
        sync.peer._proxy = fake_request_1;
        sync.adapter.sync(sync.peer, syncmljs.SYNCTYPE_SLOW_SYNC, cb);
      };

      scanForChanges(function(err) {
        expect(err).toBeFalsy();
        synchronize(function(err, stats) {
          expect(err).toBeFalsy();
          expect('' + err).toEqual('null');
          expect(_.keys(stats)).toEqual(['cli_memo']);
          expect(stats['cli_memo']).toEqual(state.makeStats({
            mode: syncmljs.SYNCTYPE_SLOW_SYNC,
            peerAdd: 1,
            hereAdd: 1
          }));
          expect(seenRequests).toEqual('1234');
          callback(null, 'complete');
        });
      });

    };

    var sync = {};

    //-------------------------------------------------------------------------
    beforeEach(function(callback) {
      setupAdapter(function(err, ret) {
        expect(err).toBeFalsy();
        sync = ret;
        callback();
      });
    });

    //-------------------------------------------------------------------------
    afterEach(function(callback) {
      sync = {};
      callback();
    });

    //-------------------------------------------------------------------------
    describe('that synchronizes for the first time', function() {

      var done = 'synchronization';

      //-----------------------------------------------------------------------
      beforeEach(function(callback) {
        doFirstSync(sync, function(err, ret) {
          expect(err).toBeFalsy();
          done = ret;
          callback();
        });
      });

      //-----------------------------------------------------------------------
      it('does a slow-sync with all stores', function() {
        expect(done).toEqual('complete');
      });

    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
