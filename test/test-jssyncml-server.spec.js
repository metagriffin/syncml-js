// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the jssyncml module in server-mode
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/12/08
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define([
  'underscore',
  'elementtree',
  'sqlite3',
  'jsindexeddb',
  'diff',
  './helpers.js',
  '../src/jssyncml',
  '../src/jssyncml/logging',
  '../src/jssyncml/common',
  '../src/jssyncml/state'
], function(_, ET, sqlite3, jsindexeddb, diff, helpers, jssyncml, logging, common, state) {

  describe('jssyncml-server', function() {

    var seenRequests = '';

    beforeEach(function () {
      logging.level = logging.NOTSET;
      this.addMatchers(helpers.matchers);
      seenRequests = '';
    });

    //-------------------------------------------------------------------------
    var setupAdapter = function(callback) {

      var sync = {
        adapter: null,
        store:   null,
        agent:   new helpers.TestAgent()
      };

      var sdb = new sqlite3.Database(':memory:');
      // var sdb = new sqlite3.Database('./test.db');
      var idb = new jsindexeddb.indexedDB('sqlite3', sdb);

      var context = new jssyncml.Context({
        storage: idb,
        prefix:  'memoryBasedServer.'
      });

      context.getAdapter(null, null, function(err, adapter) {
        expect(err).toBeFalsy();
        sync.adapter = adapter;
        var setupDevInfo = function(cb) {
          if ( adapter.devInfo != undefined )
            return cb();
          adapter.setDevInfo({
            devID               : 'test-jssyncml-server-devid',
            devType             : jssyncml.DEVTYPE_SERVER,
            manufacturerName    : 'jssyncml',
            modelName           : 'testserver',
            hierarchicalSync    : false
          }, cb);
        }
        var setupStore = function(cb) {
          sync.store = adapter.getStore('srv_note');
          if ( sync.store != undefined )
          {
            sync.store.agent = sync.agent;
            return cb();
          }
          adapter.addStore({
            uri          : 'srv_note',
            displayName  : 'Note Storage',
            agent        : sync.agent
          }, function(err, store) {
            if ( err )
              cb(err);
            sync.store = store;
            cb();
          });
        };
        setupDevInfo(function(err) {
          expect(err).toBeFalsy();
          setupStore(function(err) {
            expect(err).toBeFalsy();
            callback(null, sync);
          });
        });
      });

    };

    //-------------------------------------------------------------------------
    var makeRequest = function(body) {
      return {
        headers: { 'Content-Type': 'application/vnd.syncml+xml'},
        body:    body
      };
    };

    //-------------------------------------------------------------------------
    var makeRequest_init = function(targetID, sourceID, options) {
      options = _.defaults({}, options, {
        sourceName    : 'test-client',
        modelName     : 'test-jssyncml-server.client',
        storeName     : 'MemoTaker',
        sessionID     : '1',
        putDevInfo    : true,
        getDevInfo    : true,
        sendAlert     : true,
        alertCode     : 201,
        nextAnchor    : null,
        lastAnchor    : null
      });
      options.targetID = targetID;
      options.sourceID = sourceID;

      var ret = '<?xml version="1.0" encoding="utf-8"?>'
        + '<SyncML>'
        + ' <SyncHdr>'
        + '  <VerDTD>1.2</VerDTD>'
        + '  <VerProto>SyncML/1.2</VerProto>'
        + '  <SessionID>' + options.sessionID + '</SessionID>'
        + '  <MsgID>1</MsgID>'
        + '  <Source>'
        + '   <LocURI>' + options.sourceID + '</LocURI>'
        + '   <LocName>' + options.sourceName + '</LocName>'
        + '  </Source>'
        + '  <Target><LocURI>' + options.targetID + '</LocURI></Target>'
        + '  <Cred>'
        + '   <Meta>'
        + '    <Format xmlns="syncml:metinf">b64</Format>'
        + '    <Type xmlns="syncml:metinf">syncml:auth-basic</Type>'
        + '   </Meta>'
        + '   <Data>Z3Vlc3Q6Z3Vlc3Q=</Data>'
        + '  </Cred>'
        + '  <Meta>'
        + '   <MaxMsgSize xmlns="syncml:metinf">150000</MaxMsgSize>'
        + '   <MaxObjSize xmlns="syncml:metinf">4000000</MaxObjSize>'
        + '  </Meta>'
        + ' </SyncHdr>'
        + ' <SyncBody>'
      ;

      if ( options.putDevInfo )
      {
        ret += ''
          + '<Put>'
          + '   <CmdID>1</CmdID>'
          + '   <Meta><Type xmlns="syncml:metinf">application/vnd.syncml-devinf+xml</Type></Meta>'
          + '   <Item>'
          + '    <Source><LocURI>./devinf12</LocURI></Source>'
          + '    <Data>'
          + '     <DevInf xmlns="syncml:devinf">'
          + '      <VerDTD>1.2</VerDTD>'
          + '      <Man>pysyncml</Man>'
          + '      <Mod>' + options.modelName + '</Mod>'
          + '      <OEM>-</OEM>'
          + '      <FwV>-</FwV>'
          + '      <SwV>-</SwV>'
          + '      <HwV>-</HwV>'
          + '      <DevID>' + options.sourceID + '</DevID>'
          + '      <DevTyp>workstation</DevTyp>'
          + '      <UTC/>'
          + '      <SupportNumberOfChanges/>'
          + '      <SupportLargeObjs/>'
          + '      <DataStore>'
          + '       <SourceRef>./cli_memo</SourceRef>'
          + '       <DisplayName>' + options.storeName + '</DisplayName>'
          + '       <MaxGUIDSize>64</MaxGUIDSize>'
          + '       <Rx-Pref>'
          + '        <CTType>text/plain</CTType>'
          + '        <VerCT>1.1</VerCT>'
          + '       </Rx-Pref>'
          + '       <Rx>'
          + '        <CTType>text/plain</CTType>'
          + '        <VerCT>1.0</VerCT>'
          + '       </Rx>'
          + '       <Tx-Pref>'
          + '        <CTType>text/plain</CTType>'
          + '        <VerCT>1.1</VerCT>'
          + '       </Tx-Pref>'
          + '       <Tx>'
          + '        <CTType>text/plain</CTType>'
          + '        <VerCT>1.0</VerCT>'
          + '       </Tx>'
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
        ;
      }

      if ( options.getDevInfo )
      {
        ret += ''
          + '  <Get>'
          + '   <CmdID>2</CmdID>'
          + '   <Meta><Type xmlns="syncml:metinf">application/vnd.syncml-devinf+xml</Type></Meta>'
          + '   <Item>'
          + '    <Target><LocURI>./devinf12</LocURI></Target>'
          + '   </Item>'
          + '  </Get>'
        ;
      }

      var nextAnchor = options.nextAnchor ? '<Next>' + options.nextAnchor + '</Next>' : '';
      var lastAnchor = options.lastAnchor ? '<Last>' + options.lastAnchor + '</Last>' : '';

      if ( options.sendAlert )
      {
        ret += ''
          + '  <Alert>'
          + '   <CmdID>3</CmdID>'
          + '   <Data>' + options.alertCode + '</Data>'
          + '   <Item>'
          + '    <Source><LocURI>./cli_memo</LocURI></Source>'
          + '    <Target><LocURI>srv_note</LocURI></Target>'
          + '    <Meta>'
          + '     <Anchor xmlns="syncml:metinf">'
          + '      ' + options.lastAnchor + ''
          + '      ' + options.nextAnchor + ''
          + '     </Anchor>'
          + '     <MaxObjSize xmlns="syncml:metinf">4000000</MaxObjSize>'
          + '    </Meta>'
          + '   </Item>'
          + '  </Alert>'
        ;
      }

      ret += ''
        + '  <Final/>'
        + ' </SyncBody>'
        + '</SyncML>'
      ;

      return makeRequest(ret);
    }

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
    it('detects a client without authorization', function(done) {
      var targetID = 'http://example.com/sync';
      var session = {};
      var request = makeRequest(
        '<?xml version="1.0" encoding="utf-8"?>'
          + '<SyncML>'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>test-jssyncml-server.client.1234</LocURI>'
          + '   <LocName>test-client</LocName>'
          + '  </Source>'
          + '  <Target><LocURI>' + targetID + '</LocURI></Target>'
          + '  <Meta>'
          + '   <MaxMsgSize xmlns="syncml:metinf">150000</MaxMsgSize>'
          + '   <MaxObjSize xmlns="syncml:metinf">4000000</MaxObjSize>'
          + '  </Meta>'
          + ' </SyncHdr>'
          + ' <SyncBody><Final/></SyncBody>'
          + '</SyncML>'
      );
      sync.adapter.authorize(request, session, null, function(err, auth) {
        expect(err).toBeFalsy();
        expect('' + err).toEqual('null');
        expect(auth).toBeNull();
        sync.adapter.getTargetID(request, session, function(err, tid) {
          expect(err).toBeFalsy();
          expect('' + err).toEqual('null');
          expect(tid).toEqual(targetID);
          done();
        });
      });
    });

    //-------------------------------------------------------------------------
    it('handles basic authorization', function(done) {
      var targetID = 'http://example.com/sync';
      var session = {};
      var request = makeRequest(
          '<?xml version="1.0" encoding="utf-8"?>'
          + '<SyncML>'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>test-jssyncml-server.client.1234</LocURI>'
          + '   <LocName>test-client</LocName>'
          + '  </Source>'
          + '  <Target><LocURI>' + targetID + '</LocURI></Target>'
          + '  <Cred>'
          + '   <Meta>'
          + '    <Format xmlns="syncml:metinf">b64</Format>'
          + '    <Type xmlns="syncml:metinf">syncml:auth-basic</Type>'
          + '   </Meta>'
          + '   <Data>Z3Vlc3Q6Z3Vlc3Q=</Data>'
          + '  </Cred>'
          + '  <Meta>'
          + '   <MaxMsgSize xmlns="syncml:metinf">150000</MaxMsgSize>'
          + '   <MaxObjSize xmlns="syncml:metinf">4000000</MaxObjSize>'
          + '  </Meta>'
          + ' </SyncHdr>'
          + ' <SyncBody><Final/></SyncBody>'
          + '</SyncML>'
      );
      sync.adapter.authorize(request, session, null, function(err, auth) {
        expect(err).toBeFalsy();
        expect('' + err).toEqual('null');
        expect(auth).toEqual({
          auth:     'syncml:auth-basic',
          username: 'guest',
          password: 'guest'
        });
        sync.adapter.getTargetID(request, session, function(err, tid) {
          expect(err).toBeFalsy();
          expect('' + err).toEqual('null');
          expect(tid).toEqual(targetID);
          done();
        });
      });
    });

    //-------------------------------------------------------------------------
    it('handles invalid authentication credentials', function(done) {
      var clientID  = 'test-jssyncml-server.client.' + (new Date()).getTime();
      var returnUrl = 'https://example.com/sync;s=a139bb50047b45ca9820fe53f5161e55';
      var request   = makeRequest_init('https://example.com/sync', clientID, {
        putDevInfo    : false,
        getDevInfo    : false,
        sendAlert     : false
      });
      var session   = {returnUrl: returnUrl};
      var collector = new helpers.ResponseCollector();
      var authorize = function(uri, data, cb) {
        return cb('bad-credentials');
      };
      sync.adapter.handleRequest(request, session, authorize, collector.write, function(err) {
        expect(err).toBeTruthy();
        expect(err).toEqual('bad-credentials');
        expect(collector.contentTypes).toEqual([]);
        expect(collector.content).toEqual('');
        done();
      });
    });

    //-------------------------------------------------------------------------
    it('handles SyncML document with official URN-based namespace', function(done) {
      var targetID = 'http://example.com/sync';
      var session = {};
      var request = makeRequest(
          '<?xml version="1.0" encoding="utf-8"?>'
          + '<SyncML xmlns="SYNCML:SYNCML1.2">'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>test-jssyncml-server.client.1234</LocURI>'
          + '   <LocName>test-client</LocName>'
          + '  </Source>'
          + '  <Target><LocURI>' + targetID + '</LocURI></Target>'
          + '  <Cred>'
          + '   <Meta>'
          + '    <Format xmlns="syncml:metinf">b64</Format>'
          + '    <Type xmlns="syncml:metinf">syncml:auth-basic</Type>'
          + '   </Meta>'
          + '   <Data>Z3Vlc3Q6Z3Vlc3Q=</Data>'
          + '  </Cred>'
          + '  <Meta>'
          + '   <MaxMsgSize xmlns="syncml:metinf">150000</MaxMsgSize>'
          + '   <MaxObjSize xmlns="syncml:metinf">4000000</MaxObjSize>'
          + '  </Meta>'
          + ' </SyncHdr>'
          + ' <SyncBody><Final/></SyncBody>'
          + '</SyncML>'
      );
      sync.adapter.authorize(request, session, null, function(err, auth) {
        expect(err).toBeFalsy();
        expect('' + err).toEqual('null');
        expect(auth).toEqual({
          auth:     'syncml:auth-basic',
          username: 'guest',
          password: 'guest'
        });
        sync.adapter.getTargetID(request, session, function(err, tid) {
          expect(err).toBeFalsy();
          expect('' + err).toEqual('null');
          expect(tid).toEqual(targetID);
          done();
        });
      });
    });

    //-------------------------------------------------------------------------
    it('handles a new peer with no device info', function(done) {
      var clientID  = 'test-jssyncml-server.client.' + (new Date()).getTime();
      var returnUrl = 'https://example.com/sync;s=a139bb50047b45ca9820fe53f5161e55';
      var request   = makeRequest_init('https://example.com/sync', clientID, {
        putDevInfo    : false,
        getDevInfo    : false,
        sendAlert     : false
      });
      var session   = {returnUrl: returnUrl};
      var collector = new helpers.ResponseCollector();
      var authorize = function(uri, data, cb) {
        expect(uri).toBeNull();
        expect(data).toEqual({
          auth:     'syncml:auth-basic',
          username: 'guest',
          password: 'guest'
        });
        return cb();
      };
      sync.adapter.handleRequest(request, session, authorize, collector.write, function(err, stats) {
        expect(err).toBeFalsy();
        expect('' + err).toEqual('null');
        expect(stats).toEqual({});

        var chk = ''
          + '<SyncML>'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>test-jssyncml-server-devid</LocURI>'
          + '   <LocName>In-Memory Test Server</LocName>'
          + '  </Source>'
          + '  <Target>'
          + '   <LocURI>' + clientID + '</LocURI>'
          + '   <LocName>test-client</LocName>'
          + '  </Target>'
          + '  <RespURI>' + returnUrl + '</RespURI>'
          + '  <Meta>'
          + '   <MaxMsgSize xmlns="syncml:metinf">' + helpers.getMaxMemorySize() + '</MaxMsgSize>'
          + '   <MaxObjSize xmlns="syncml:metinf">' + helpers.getMaxMemorySize() + '</MaxObjSize>'
          + '  </Meta>'
          + ' </SyncHdr>'
          + ' <SyncBody>'
          + '  <Status>'
          + '   <CmdID>1</CmdID>'
          + '   <MsgRef>1</MsgRef>'
          + '   <CmdRef>0</CmdRef>'
          + '   <Cmd>SyncHdr</Cmd>'
          + '   <SourceRef>' + clientID + '</SourceRef>'
          + '   <TargetRef>test-jssyncml-server-devid</TargetRef>'
          + '   <Data>212</Data>'
          + '  </Status>'
          + '  <Put>'
          + '   <CmdID>2</CmdID>'
          + '   <Meta><Type xmlns="syncml:metinf">application/vnd.syncml-devinf+xml</Type></Meta>'
          + '   <Item>'
          + '    <Source><LocURI>./devinf12</LocURI><LocName>./devinf12</LocName></Source>'
          + '    <Data>'
          + '     <DevInf xmlns="syncml:devinf">'
          + '      <VerDTD>1.2</VerDTD>'
          + '      <Man>pysyncml</Man>'
          + '      <Mod>testserver</Mod>'
          + '      <OEM>-</OEM>'
          + '      <FwV>-</FwV>'
          + '      <SwV>-</SwV>'
          + '      <HwV>-</HwV>'
          + '      <DevID>test-jssyncml-server-devid</DevID>'
          + '      <DevTyp>server</DevTyp>'
          + '      <UTC/>'
          + '      <SupportLargeObjs/>'
          + '      <SupportHierarchicalSync/>'
          + '      <SupportNumberOfChanges/>'
          + '      <DataStore>'
          + '       <SourceRef>srv_note</SourceRef>'
          + '       <DisplayName>Server Note Store</DisplayName>'
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
          + '   <CmdID>3</CmdID>'
          + '   <Meta><Type xmlns="syncml:metinf">application/vnd.syncml-devinf+xml</Type></Meta>'
          + '   <Item>'
          + '    <Target><LocURI>./devinf12</LocURI><LocName>./devinf12</LocName></Target>'
          + '   </Item>'
          + '  </Get>'
          + '  <Final/>'
          + ' </SyncBody>'
          + '</SyncML>'
        ;

        expect(collector.contentTypes).toEqual(['application/vnd.syncml+xml; charset=UTF-8']);
        expect(collector.content).toEqualXml(chk);
        done();
      });
    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
