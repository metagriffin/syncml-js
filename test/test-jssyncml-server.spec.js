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

    beforeEach(function () {
      logging.level = logging.WARNING;
      this.addMatchers(helpers.matchers);
    });

    //-------------------------------------------------------------------------
    var setupAdapter = function(callback) {

      var sync = {
        context: null,
        adapter: null,
        store:   null,
        agent:   new helpers.TestAgent(),
        sdb:     new sqlite3.Database(':memory:')
        // sdb:     new sqlite3.Database('./test.db')
      };

      var idb = new jsindexeddb.indexedDB('sqlite3', sync.sdb);

      sync.context = new jssyncml.Context({
        storage: idb,
        prefix:  'memoryBasedServer.'
      });

      sync.context.getAdapter({name: 'In-Memory Test Server'}, null, function(err, adapter) {
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
            displayName  : 'Server Note Store',
            maxGuidSize  : 32,
            maxObjSize   : 2147483647,
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
          + '      <Man>jssyncml</Man>'
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
          +        lastAnchor
          +        nextAnchor
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

    //-------------------------------------------------------------------------
    var makeRequest_alert = function(targetID, sourceID, options) {
      options = _.defaults({}, options, {
        sessionID      : '1',
        peerNextAnchor : null,
        peerLastAnchor : null,
        resultsStatus  : true
      });

      var ret = ''
        + '<?xml version="1.0" encoding="utf-8"?>'
        + '<SyncML>'
        + '  <SyncHdr>'
        + '   <VerDTD>1.2</VerDTD>'
        + '   <VerProto>SyncML/1.2</VerProto>'
        + '   <SessionID>' + options.sessionID + '</SessionID>'
        + '   <MsgID>2</MsgID>'
        + '   <Source>'
        + '    <LocURI>' + sourceID + '</LocURI>'
        + '    <LocName>test</LocName>'
        + '   </Source>'
        + '   <Target><LocURI>' + targetID + '</LocURI></Target>'
        + '   <Meta>'
        + '    <MaxMsgSize xmlns="syncml:metinf">150000</MaxMsgSize>'
        + '    <MaxObjSize xmlns="syncml:metinf">4000000</MaxObjSize>'
        + '   </Meta>'
        + '  </SyncHdr>'
        + '  <SyncBody>'
        + '   <Status>'
        + '     <CmdID>1</CmdID>'
        + '     <MsgRef>1</MsgRef>'
        + '     <CmdRef>0</CmdRef>'
        + '     <Cmd>SyncHdr</Cmd>'
        + '     <SourceRef>' + targetID + '</SourceRef>'
        + '     <TargetRef>' + sourceID + '</TargetRef>'
        + '     <Data>200</Data>'
        + '   </Status>'
      ;

      var alertStatusCmdRef = '3';

      if ( options.resultsStatus )
      {
        alertStatusCmdRef = '6';
        ret += ''
          + '   <Status>'
          + '     <CmdID>2</CmdID>'
          + '     <MsgRef>1</MsgRef>'
          + '     <CmdRef>4</CmdRef>'
          + '     <Cmd>Results</Cmd>'
          + '     <SourceRef>./devinf12</SourceRef>'
          + '     <Data>200</Data>'
          + '   </Status>'
        ;
      }

      var peerLastAnchor = options.peerLastAnchor
        ? '<Last>' + options.peerLastAnchor + '</Last>'
        : '';
      var peerNextAnchor = options.peerNextAnchor
        ? '<Next>' + options.peerNextAnchor + '</Next>'
        : '';

      ret += ''
        + '  <Status>'
        + '    <CmdID>3</CmdID>'
        + '    <MsgRef>1</MsgRef>'
        + '    <CmdRef>' + options.alertStatusCmdRef + '</CmdRef>'
        + '    <Cmd>Alert</Cmd>'
        + '    <SourceRef>srv_note</SourceRef>'
        + '    <TargetRef>./cli_memo</TargetRef>'
        + '    <Data>200</Data>'
        + '    <Item>'
        + '      <Data>'
        + '        <Anchor xmlns="syncml:metinf">'
        +            peerLastAnchor
        +            peerNextAnchor
        + '        </Anchor>'
        + '      </Data>'
        + '    </Item>'
        + '  </Status>'
        + '  <Sync>'
        + '    <CmdID>4</CmdID>'
        + '    <Source><LocURI>./cli_memo</LocURI></Source>'
        + '    <Target><LocURI>srv_note</LocURI></Target>'
        + '  </Sync>'
        + '  <Final/>'
        + ' </SyncBody>'
        + '</SyncML>'
      ;

      return ret;
    };

    //-------------------------------------------------------------------------
    var makeRequest_map = function(targetID, sourceID, options) {
      options = _.defaults({}, options, {
        sessionID : '1',
        isAdd     : true
      });

      var ret = ''
        + '<?xml version="1.0" encoding="utf-8"?>'
        + '<SyncML>'
        + ' <SyncHdr>'
        + '  <VerDTD>1.2</VerDTD>'
        + '  <VerProto>SyncML/1.2</VerProto>'
        + '  <SessionID>' + options.sessionID + '</SessionID>'
        + '  <MsgID>3</MsgID>'
        + '  <Source>'
        + '   <LocURI>' + options.sourceID + '</LocURI>'
        + '   <LocName>test</LocName>'
        + '  </Source>'
        + '  <Target><LocURI>' + options.targetID + '</LocURI></Target>'
        + '  <Meta>'
        + '   <MaxMsgSize xmlns="syncml:metinf">150000</MaxMsgSize>'
        + '   <MaxObjSize xmlns="syncml:metinf">4000000</MaxObjSize>'
        + '  </Meta>'
        + ' </SyncHdr>'
        + ' <SyncBody>'
        + '  <Status>'
        + '   <CmdID>1</CmdID>'
        + '   <MsgRef>2</MsgRef>'
        + '   <CmdRef>0</CmdRef>'
        + '   <Cmd>SyncHdr</Cmd>'
        + '   <SourceRef>' + options.targetID + '</SourceRef>'
        + '   <TargetRef>' + options.sourceID + '</TargetRef>'
        + '   <Data>200</Data>'
        + '  </Status>'
        + '  <Status>'
        + '   <CmdID>2</CmdID>'
        + '   <MsgRef>2</MsgRef>'
        + '   <CmdRef>3</CmdRef>'
        + '   <Cmd>Sync</Cmd>'
        + '   <SourceRef>srv_note</SourceRef>'
        + '   <TargetRef>cli_memo</TargetRef>'
        + '   <Data>200</Data>'
        + '  </Status>'
      ;

      if ( options.isAdd )
      {
        ret += ''
          + '  <Status>'
          + '   <CmdID>3</CmdID>'
          + '   <MsgRef>2</MsgRef>'
          + '   <CmdRef>4</CmdRef>'
          + '   <Cmd>Add</Cmd>'
          + '   <SourceRef>1000</SourceRef>'
          + '   <Data>201</Data>'
          + '  </Status>'
          + '  <Map>'
          + '   <CmdID>4</CmdID>'
          + '   <Source><LocURI>cli_memo</LocURI></Source>'
          + '   <Target><LocURI>srv_note</LocURI></Target>'
          + '   <MapItem>'
          + '    <Source><LocURI>1</LocURI></Source>'
          + '    <Target><LocURI>1000</LocURI></Target>'
          + '   </MapItem>'
          + '  </Map>'
        ;
      }
      else
      {
        ret += ''
          + '  <Status>'
          + '   <CmdID>3</CmdID>'
          + '   <MsgRef>2</MsgRef>'
          + '   <CmdRef>4</CmdRef>'
          + '   <Cmd>Replace</Cmd>'
          + '   <TargetRef>1</TargetRef>'
          + '   <Data>200</Data>'
          + '  </Status>'
        ;
      }

      ret += ''
        + '  <Final/>'
        + ' </SyncBody>'
        + '</SyncML>'
      ;

      return ret;
    };

    //-------------------------------------------------------------------------
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
      var session  = jssyncml.makeSessionInfo();
      var request  = makeRequest(
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
      var session  = jssyncml.makeSessionInfo();
      var request  = makeRequest(
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
      var session   = jssyncml.makeSessionInfo({returnUrl: returnUrl});
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
      var session  = jssyncml.makeSessionInfo();
      var request  = makeRequest(
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
      var serverID  = 'https://example.com/sync';
      var returnUrl = serverID + ';s=a139bb50047b45ca9820fe53f5161e55';
      var request   = makeRequest_init(serverID, clientID, {
        putDevInfo    : false,
        getDevInfo    : false,
        sendAlert     : false
      });
      var session   = jssyncml.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});
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
          + '   <LocURI>' + serverID + '</LocURI>'
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
          + '   <TargetRef>' + serverID + '</TargetRef>'
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
          + '      <Man>jssyncml</Man>'
          + '      <Mod>testserver</Mod>'
          + '      <OEM>-</OEM>'
          + '      <FwV>-</FwV>'
          + '      <SwV>-</SwV>'
          + '      <HwV>-</HwV>'
          + '      <DevID>test-jssyncml-server-devid</DevID>'
          + '      <DevTyp>server</DevTyp>'
          + '      <UTC/>'
          + '      <SupportLargeObjs/>'
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

    //-------------------------------------------------------------------------
    it('creates a new peer store binding on-demand', function(done) {

      var clientID   = 'test-jssyncml-server.client.' + (new Date()).getTime();
      var serverID   = 'https://example.com/sync';
      var nextAnchor = '' + helpers.now();
      var returnUrl  = serverID + ';s=a139bb50047b45ca9820fe53f5161e55';
      var request    = makeRequest_init(serverID, clientID, {nextAnchor: nextAnchor});
      var session    = jssyncml.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});
      var collector  = new helpers.ResponseCollector();

      sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
        expect(err).toBeFalsy();
        expect('' + err).toEqual('null');
        expect(stats).toEqual({srv_note: jssyncml.makeStats({mode: jssyncml.SYNCTYPE_SLOW_SYNC})});

        var anchor = helpers.findXml(collector.content, './SyncBody/Alert/Item/Meta/Anchor/Next');

        var chk = ''
          + '<SyncML>'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>' + serverID + '</LocURI>'
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
          + '   <TargetRef>' + serverID + '</TargetRef>'
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
          + '    <Source><LocURI>./devinf12</LocURI><LocName>./devinf12</LocName></Source>'
          + '    <Data>'
          + '     <DevInf xmlns="syncml:devinf">'
          + '      <VerDTD>1.2</VerDTD>'
          + '      <Man>jssyncml</Man>'
          + '      <Mod>testserver</Mod>'
          + '      <OEM>-</OEM>'
          + '      <FwV>-</FwV>'
          + '      <SwV>-</SwV>'
          + '      <HwV>-</HwV>'
          + '      <DevID>test-jssyncml-server-devid</DevID>'
          + '      <DevTyp>server</DevTyp>'
          + '      <UTC/>'
          + '      <SupportLargeObjs/>'
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
          + '  </Results>'
          + '  <Status>'
          + '   <CmdID>5</CmdID>'
          + '   <MsgRef>1</MsgRef>'
          + '   <CmdRef>3</CmdRef>'
          + '   <Cmd>Alert</Cmd>'
          + '   <SourceRef>./cli_memo</SourceRef>'
          + '   <TargetRef>srv_note</TargetRef>'
          + '   <Data>200</Data>'
          + '   <Item>'
          + '    <Data>'
          + '     <Anchor xmlns="syncml:metinf"><Next>' + nextAnchor + '</Next></Anchor>'
          + '    </Data>'
          + '   </Item>'
          + '  </Status>'
          + '  <Alert>'
          + '    <CmdID>6</CmdID>'
          + '    <Data>201</Data>'
          + '    <Item>'
          + '      <Source><LocURI>srv_note</LocURI></Source>'
          + '      <Target><LocURI>cli_memo</LocURI></Target>'
          + '      <Meta>'
          + '        <Anchor xmlns="syncml:metinf">'
          + '          <Next>' + anchor + '</Next>'
          + '        </Anchor>'
          + '        <MaxObjSize xmlns="syncml:metinf">' + helpers.getMaxMemorySize() + '</MaxObjSize>'
          + '      </Meta>'
          + '    </Item>'
          + '  </Alert>'
          + '  <Final/>'
          + ' </SyncBody>'
          + '</SyncML>'
        ;

        expect(collector.contentTypes).toEqual(['application/vnd.syncml+xml; charset=UTF-8']);
        expect(collector.content).toEqualXml(chk);

        expect(_.omit(session, 'lastCommands')).toEqual({
          returnUrl     : "https://example.com/sync;s=a139bb50047b45ca9820fe53f5161e55",
          effectiveID   : "https://example.com/sync",
          id            : 1,
          msgID         : 1,
          cmdID         : 6,
          dsstates:
          {
            srv_note:
            {
              uri              : "srv_note",
              peerUri          : "cli_memo",
              mode             : 201,
              action           : "alert",
              lastAnchor       : null,
              nextAnchor       : anchor,
              peerLastAnchor   : null,
              peerNextAnchor   : nextAnchor,
              stats:
              {
                mode        : null,
                hereAdd     : 0,
                hereMod     : 0,
                hereDel     : 0,
                hereErr     : 0,
                peerAdd     : 0,
                peerMod     : 0,
                peerDel     : 0,
                peerErr     : 0,
                conflicts   : 0,
                merged      : 0
              }
            }
          },
          stats:
          {
            mode        : null,
            hereAdd     : 0,
            hereMod     : 0,
            hereDel     : 0,
            hereErr     : 0,
            peerAdd     : 0,
            peerMod     : 0,
            peerDel     : 0,
            peerErr     : 0,
            conflicts   : 0,
            merged      : 0
          },
          codec          : "xml",
          peerID         : clientID,
          pendingMsgID   : 1
        });

        var idb2 = new jsindexeddb.indexedDB('sqlite3', sync.sdb);

        var ctxt2 = new jssyncml.Context({
          storage: idb2,
          prefix:  'memoryBasedServer.'
        });

        // validate that the adapter was stored correctly
        sync.context.getAdapter(null, null, function(err, adapter) {
          expect(adapter.name).toEqual('In-Memory Test Server');
          expect(adapter.getPeers().length).toEqual(1);
          var peer = adapter.getPeers()[0];
          expect(peer.name).toEqual('test-client');
          expect(peer.devID).toEqual(clientID);
          expect(peer.maxMsgSize).toEqual(150000);
          expect(peer.maxObjSize).toEqual(4000000);
          expect(peer.devInfo).toBeTruthy();
          expect(peer.devInfo.devID).toEqual(clientID);
          expect(peer.devInfo.manufacturerName).toEqual('jssyncml');
          expect(peer.devInfo.modelName).toEqual('test-jssyncml-server.client');
          expect(peer.devInfo.oem).toEqual('-');
          expect(peer.devInfo.firmwareVersion).toEqual('-');
          expect(peer.devInfo.softwareVersion).toEqual('-');
          expect(peer.devInfo.hardwareVersion).toEqual('-');
          expect(peer.devInfo.devType).toEqual('workstation');
          expect(peer.devInfo.utc).toEqual(true);
          expect(peer.devInfo.largeObjects).toEqual(true);
          expect(peer.devInfo.hierarchicalSync).toEqual(false);
          expect(peer.devInfo.numberOfChanges).toEqual(true);
          expect(_.keys(peer._stores).length).toEqual(1);
          var store = peer.getStore('cli_memo');
          expect(store).toBeTruthy();
          expect(store.displayName).toEqual('MemoTaker');
          expect(store.maxGuidSize).toEqual(64);
          expect(store.getContentTypes()).toEqual([
            new jssyncml.ContentTypeInfo('text/plain', '1.1', {preferred: true}),
            new jssyncml.ContentTypeInfo('text/plain', '1.0')
          ]);
          done();
        });

      });

    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
