// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js module in server-mode
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
  'indexeddb-js',
  'diff',
  './helpers.js',
  '../src/syncml-js',
  '../src/syncml-js/logging',
  '../src/syncml-js/common',
  '../src/syncml-js/state',
  '../src/syncml-js/storage'
], function(_, ET, sqlite3, indexeddbjs, diff, helpers, syncmljs, logging, common, state, storage) {

  describe('syncml-js/server', function() {

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

      var idb = new indexeddbjs.indexedDB('sqlite3', sync.sdb);

      sync.context = new syncmljs.Context({
        storage: idb,
        prefix:  'memoryBasedServer.',
        config  : {trustDevInfo: true}
      });

      sync.context.getAdapter({
        displayName: 'In-Memory Test Server'
      }, null, function(err, adapter) {
        expect(err).toBeFalsy();
        sync.adapter = adapter;
        var setupDevInfo = function(cb) {
          if ( adapter.devInfo != undefined )
            return cb();
          adapter.setDevInfo({
            devID               : 'test-syncml-js-server-devid',
            devType             : syncmljs.DEVTYPE_SERVER,
            manufacturerName    : 'syncml-js',
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
        modelName     : 'test-syncml-js-server.client',
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
          + '      <Man>syncml-js</Man>'
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
    var makeRequest_sync = function(targetID, sourceID, options) {
      options = _.defaults({}, options, {
        sessionID      : '1',
        messageID      : '2',
        peerNextAnchor : null,
        peerLastAnchor : null,
        resultsStatus  : true,
        items          : []
      });

      var ret = ''
        + '<?xml version="1.0" encoding="utf-8"?>'
        + '<SyncML>'
        + '  <SyncHdr>'
        + '   <VerDTD>1.2</VerDTD>'
        + '   <VerProto>SyncML/1.2</VerProto>'
        + '   <SessionID>' + options.sessionID + '</SessionID>'
        + '   <MsgID>' + options.messageID + '</MsgID>'
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
        + '    <CmdRef>' + alertStatusCmdRef + '</CmdRef>'
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
        + '    <NumberOfChanges>' + options.items.length + '</NumberOfChanges>'
      ;

      for ( var idx=0 ; idx<options.items.length ; idx++ )
      {
        var item = options.items[idx];
        ret += ''
          + '    <Add>'
          + '      <CmdID>' + ( 5 + idx ) + '</CmdID>'
          + '      <Meta><Type xmlns="syncml:metinf">text/plain</Type></Meta>'
          + '      <Item>'
          + '        <Source><LocURI>' + item.id + '</LocURI></Source>'
          + '        <Data>' + item.body + '</Data>'
          + '      </Item>'
          + '    </Add>'
        ;
      }

      ret += ''
        + '  </Sync>'
        + '  <Final/>'
        + ' </SyncBody>'
        + '</SyncML>'
      ;

      return makeRequest(ret);
    };

    //-------------------------------------------------------------------------
    var makeRequest_map = function(targetID, sourceID, options) {
      options = _.defaults({}, options, {
        sessionID  : '1',
        syncCmdRef : 3,
        map        : {'1': '1000'}
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
        + '   <LocURI>' + sourceID + '</LocURI>'
        + '   <LocName>test</LocName>'
        + '  </Source>'
        + '  <Target><LocURI>' + targetID + '</LocURI></Target>'
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
        + '   <SourceRef>' + targetID + '</SourceRef>'
        + '   <TargetRef>' + sourceID + '</TargetRef>'
        + '   <Data>200</Data>'
        + '  </Status>'
        + '  <Status>'
        + '   <CmdID>2</CmdID>'
        + '   <MsgRef>2</MsgRef>'
        + '   <CmdRef>' + options.syncCmdRef + '</CmdRef>'
        + '   <Cmd>Sync</Cmd>'
        + '   <SourceRef>srv_note</SourceRef>'
        + '   <TargetRef>cli_memo</TargetRef>'
        + '   <Data>200</Data>'
        + '  </Status>'
      ;

      if ( _.keys(options.map).length > 0 )
      {
        ret += ''
          + '  <Status>'
          + '   <CmdID>3</CmdID>'
          + '   <MsgRef>2</MsgRef>'
          + '   <CmdRef>' + ( options.syncCmdRef + 1 ) + '</CmdRef>'
          + '   <Cmd>Add</Cmd>'
          + '   <SourceRef>1000</SourceRef>'
          + '   <Data>201</Data>'
          + '  </Status>'
        ;
        var cmdid = 3;
        for ( var key in options.map )
        {
          cmdid += 1;
          ret += ''
            + '  <Map>'
            + '   <CmdID>' + cmdid + '</CmdID>'
            + '   <Source><LocURI>cli_memo</LocURI></Source>'
            + '   <Target><LocURI>srv_note</LocURI></Target>'
            + '   <MapItem>'
            + '    <Source><LocURI>' + key + '</LocURI></Source>'
            + '    <Target><LocURI>' + options.map[key] + '</LocURI></Target>'
            + '   </MapItem>'
            + '  </Map>'
          ;
        }
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

      return makeRequest(ret);
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
      var session  = syncmljs.makeSessionInfo();
      var request  = makeRequest(
        '<?xml version="1.0" encoding="utf-8"?>'
          + '<SyncML>'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>test-syncml-js-server.client.1234</LocURI>'
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
        expect(err).ok();
        expect(auth).toBeNull();
        sync.adapter.getTargetID(request, session, function(err, tid) {
          expect(err).ok();
          expect(tid).toEqual(targetID);
          done();
        });
      });
    });

    //-------------------------------------------------------------------------
    it('handles basic authorization', function(done) {
      var targetID = 'http://example.com/sync';
      var session  = syncmljs.makeSessionInfo();
      var request  = makeRequest(
          '<?xml version="1.0" encoding="utf-8"?>'
          + '<SyncML>'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>test-syncml-js-server.client.1234</LocURI>'
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
        expect(err).ok();
        expect(auth).toEqual({
          auth:     'syncml:auth-basic',
          username: 'guest',
          password: 'guest'
        });
        sync.adapter.getTargetID(request, session, function(err, tid) {
          expect(err).ok();
          expect(tid).toEqual(targetID);
          done();
        });
      });
    });

    //-------------------------------------------------------------------------
    it('handles invalid authentication credentials', function(done) {
      var clientID  = 'test-syncml-js-server.client.' + (new Date()).getTime();
      var returnUrl = 'https://example.com/sync;s=a139bb50047b45ca9820fe53f5161e55';
      var request   = makeRequest_init('https://example.com/sync', clientID, {
        putDevInfo    : false,
        getDevInfo    : false,
        sendAlert     : false
      });
      var session   = syncmljs.makeSessionInfo({returnUrl: returnUrl});
      var collector = new helpers.ResponseCollector();
      var authorize = function(uri, data, cb) {
        return cb('bad-credentials');
      };
      sync.adapter.handleRequest(request, session, authorize, collector.write, function(err) {
        expect(err).toBeTruthy();
        expect(err).toEqual('bad-credentials');
        expect(collector.contentTypes).toEqual([]);
        expect(collector.contents).toEqual([]);
        done();
      });
    });

    //-------------------------------------------------------------------------
    it('handles SyncML document with official URN-based namespace', function(done) {
      var targetID = 'http://example.com/sync';
      var session  = syncmljs.makeSessionInfo();
      var request  = makeRequest(
          '<?xml version="1.0" encoding="utf-8"?>'
          + '<SyncML xmlns="SYNCML:SYNCML1.2">'
          + ' <SyncHdr>'
          + '  <VerDTD>1.2</VerDTD>'
          + '  <VerProto>SyncML/1.2</VerProto>'
          + '  <SessionID>1</SessionID>'
          + '  <MsgID>1</MsgID>'
          + '  <Source>'
          + '   <LocURI>test-syncml-js-server.client.1234</LocURI>'
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
        expect(err).ok();
        expect(auth).toEqual({
          auth:     'syncml:auth-basic',
          username: 'guest',
          password: 'guest'
        });
        sync.adapter.getTargetID(request, session, function(err, tid) {
          expect(err).ok();
          expect(tid).toEqual(targetID);
          done();
        });
      });
    });

    //-------------------------------------------------------------------------
    it('handles a new peer with no device info', function(done) {
      var clientID  = 'test-syncml-js-server.client.' + (new Date()).getTime();
      var serverID  = 'https://example.com/sync';
      var returnUrl = serverID + ';s=a139bb50047b45ca9820fe53f5161e55';
      var request   = makeRequest_init(serverID, clientID, {
        putDevInfo    : false,
        getDevInfo    : false,
        sendAlert     : false
      });
      var session   = syncmljs.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});
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
        expect(err).ok();
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
          + '      <Man>syncml-js</Man>'
          + '      <Mod>testserver</Mod>'
          + '      <OEM>-</OEM>'
          + '      <FwV>-</FwV>'
          + '      <SwV>-</SwV>'
          + '      <HwV>-</HwV>'
          + '      <DevID>test-syncml-js-server-devid</DevID>'
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
        expect(collector.contents.length).toEqual(1);
        expect(collector.contents[0]).toEqualXml(chk);
        done();
      });
    });

    //-------------------------------------------------------------------------
    it('supports setting extension info', function(done) {
      var clientID  = 'test-syncml-js-server.client.' + (new Date()).getTime();
      var serverID  = 'https://example.com/sync';
      var returnUrl = serverID + ';s=a139bb50047b45ca9820fe53f5161e55';
      var request   = makeRequest_init(serverID, clientID, {
        putDevInfo    : false,
        getDevInfo    : false,
        sendAlert     : false
      });
      var session   = syncmljs.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});
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
      sync.adapter.devInfo.setExtension('x-syncml-engine', 'syncml-js/' + syncmljs.version);
      sync.adapter.handleRequest(request, session, authorize, collector.write, function(err, stats) {
        expect(err).ok();
        expect(stats).toEqual({});
        var engine = helpers.findXml(collector.contents[0], './SyncBody/Put/Item/Data/DevInf/Ext/XVal');
        expect(engine).toMatch(/^syncml-js\/\d+\.\d+\.\d+$/);

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
          + '      <Man>syncml-js</Man>'
          + '      <Mod>testserver</Mod>'
          + '      <OEM>-</OEM>'
          + '      <FwV>-</FwV>'
          + '      <SwV>-</SwV>'
          + '      <HwV>-</HwV>'
          + '      <DevID>test-syncml-js-server-devid</DevID>'
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
          + '      <Ext><XNam>x-syncml-engine</XNam><XVal>' + engine + '</XVal></Ext>'
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
        expect(collector.contents.length).toEqual(1);
        expect(collector.contents[0]).toEqualXml(chk);
        done();
      });
    });

    //-------------------------------------------------------------------------
    it('creates a new peer store binding on-demand', function(done) {

      var clientID   = 'test-syncml-js-server.client.' + (new Date()).getTime();
      var serverID   = 'https://example.com/sync';
      var nextAnchor = '' + helpers.now();
      var returnUrl  = serverID + ';s=a139bb50047b45ca9820fe53f5161e55';
      var request    = makeRequest_init(serverID, clientID, {nextAnchor: nextAnchor});
      var session    = syncmljs.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});
      var collector  = new helpers.ResponseCollector();

      sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
        expect(err).ok();
        expect(stats).toEqual({srv_note: syncmljs.makeStats({mode: syncmljs.SYNCTYPE_SLOW_SYNC})});
        expect(collector.contents.length).toEqual(1);

        var anchor = helpers.findXml(collector.contents[0], './SyncBody/Alert/Item/Meta/Anchor/Next');

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
          + '      <Man>syncml-js</Man>'
          + '      <Mod>testserver</Mod>'
          + '      <OEM>-</OEM>'
          + '      <FwV>-</FwV>'
          + '      <SwV>-</SwV>'
          + '      <HwV>-</HwV>'
          + '      <DevID>test-syncml-js-server-devid</DevID>'
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
        expect(collector.contents.length).toEqual(1);
        expect(collector.contents[0]).toEqualXml(chk);

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

        var idb2 = new indexeddbjs.indexedDB('sqlite3', sync.sdb);

        var ctxt2 = new syncmljs.Context({
          storage: idb2,
          prefix:  'memoryBasedServer.',
          config  : {trustDevInfo: true, exposeErrorTrace: true}
        });

        // validate that the adapter was stored correctly
        sync.context.getAdapter(null, null, function(err, adapter) {
          expect(adapter.displayName).toEqual('In-Memory Test Server');
          expect(adapter.getPeers().length).toEqual(1);
          var peer = adapter.getPeers()[0];
          expect(peer.displayName).toEqual('test-client');
          expect(peer.devID).toEqual(clientID);
          expect(peer.maxMsgSize).toEqual(150000);
          expect(peer.maxObjSize).toEqual(4000000);
          expect(peer.devInfo).toBeTruthy();
          expect(peer.devInfo.devID).toEqual(clientID);
          expect(peer.devInfo.manufacturerName).toEqual('syncml-js');
          expect(peer.devInfo.modelName).toEqual('test-syncml-js-server.client');
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
            new syncmljs.ContentTypeInfo('text/plain', '1.1', {preferred: true}),
            new syncmljs.ContentTypeInfo('text/plain', '1.0')
          ]);
          done();
        });

      });

    });

    //-------------------------------------------------------------------------
    it('with no data, pushes an empty slow-sync', function(done) {

      var clientID   = 'test-syncml-js-server.client.' + (new Date()).getTime();
      var serverID   = 'https://example.com/sync';
      var nextAnchor = '' + helpers.now();
      var peerAnchor = null;
      var returnUrl  = serverID + ';s=a139bb50047b45ca9820fe53f5161e55';
      var session    = syncmljs.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});

      // step 1: register the peer (and transfer devInfo)
      var register_new_peer = function(cb) {
        var request    = makeRequest_init(serverID, clientID, {nextAnchor: nextAnchor});
        var collector  = new helpers.ResponseCollector();
        sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
          expect(err).ok();
          expect(stats).toEqual({srv_note: syncmljs.makeStats({mode: syncmljs.SYNCTYPE_SLOW_SYNC})});
          return cb(err);
        });
      };

      // step 2: start a new session and initiate an alert
      var start_new_session = function(cb) {
        session = syncmljs.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});
        var request    = makeRequest_init(serverID, clientID, {
          nextAnchor  : nextAnchor,
          sessionID   : '2',
          putDevInfo  : false,
          getDevInfo  : false
        });
        var collector  = new helpers.ResponseCollector();
        sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
          expect(err).ok();
          expect(stats).toEqual({srv_note: syncmljs.makeStats({mode: syncmljs.SYNCTYPE_SLOW_SYNC})});
          peerAnchor = helpers.findXml(collector.contents[0], './SyncBody/Alert/Item/Meta/Anchor/Next');
          var chk = ''
            + '<SyncML>'
            + ' <SyncHdr>'
            + '  <VerDTD>1.2</VerDTD>'
            + '  <VerProto>SyncML/1.2</VerProto>'
            + '  <SessionID>2</SessionID>'
            + '  <MsgID>1</MsgID>'
            + '  <Source>'
            + '   <LocURI>https://example.com/sync</LocURI>'
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
            + '   <TargetRef>https://example.com/sync</TargetRef>'
            + '   <Data>212</Data>'
            + '  </Status>'
            + '  <Status>'
            + '   <CmdID>2</CmdID>'
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
            + '    <CmdID>3</CmdID>'
            + '    <Data>201</Data>'
            + '    <Item>'
            + '      <Source><LocURI>srv_note</LocURI></Source>'
            + '      <Target><LocURI>cli_memo</LocURI></Target>'
            + '      <Meta>'
            + '        <Anchor xmlns="syncml:metinf">'
            + '          <Next>' + peerAnchor + '</Next>'
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
          expect(collector.contents.length).toEqual(1);
          expect(collector.contents[0]).toEqualXml(chk);
          return cb(err);
        });
      };

      // step 3: respond to the alert (send a sync) and receive a sync
      var send_alert = function(cb) {
        var request    = makeRequest_sync(serverID, clientID, {
          sessionID      :  '2',
          peerNextAnchor : peerAnchor,
          resultsStatus  : false
        });
        var collector  = new helpers.ResponseCollector();
        sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
          expect(err).ok();
          expect(stats).toEqual({srv_note: syncmljs.makeStats({mode: syncmljs.SYNCTYPE_SLOW_SYNC})});
          var chk = ''
            + '<SyncML>'
            + ' <SyncHdr>'
            + '  <VerDTD>1.2</VerDTD>'
            + '  <VerProto>SyncML/1.2</VerProto>'
            + '  <SessionID>2</SessionID>'
            + '  <MsgID>2</MsgID>'
            + '  <Source>'
            + '   <LocURI>https://example.com/sync</LocURI>'
            + '   <LocName>In-Memory Test Server</LocName>'
            + '  </Source>'
            + '  <Target>'
            + '   <LocURI>' + clientID + '</LocURI>'
            + '   <LocName>test-client</LocName>'
            + '  </Target>'
            + '  <RespURI>' + returnUrl + '</RespURI>'
            + ' </SyncHdr>'
            + ' <SyncBody>'
            + '  <Status>'
            + '   <CmdID>1</CmdID>'
            + '   <MsgRef>2</MsgRef>'
            + '   <CmdRef>0</CmdRef>'
            + '   <Cmd>SyncHdr</Cmd>'
            + '   <SourceRef>' + clientID + '</SourceRef>'
            + '   <TargetRef>https://example.com/sync</TargetRef>'
            + '   <Data>200</Data>'
            + '  </Status>'
            + '  <Status>'
            + '   <CmdID>2</CmdID>'
            + '   <MsgRef>2</MsgRef>'
            + '   <CmdRef>4</CmdRef>'
            + '   <Cmd>Sync</Cmd>'
            + '   <SourceRef>./cli_memo</SourceRef>'
            + '   <TargetRef>srv_note</TargetRef>'
            + '   <Data>200</Data>'
            + '  </Status>'
            + '  <Sync>'
            + '    <CmdID>3</CmdID>'
            + '    <Source><LocURI>srv_note</LocURI></Source>'
            + '    <Target><LocURI>cli_memo</LocURI></Target>'
            + '    <NumberOfChanges>0</NumberOfChanges>'
            + '  </Sync>'
            + '  <Final/>'
            + ' </SyncBody>'
            + '</SyncML>'
          ;
          expect(collector.contentTypes).toEqual(['application/vnd.syncml+xml; charset=UTF-8']);
          expect(collector.contents.length).toEqual(1);
          expect(collector.contents[0]).toEqualXml(chk);
          return cb(err);
        });
      };

      register_new_peer(function(err) {
        expect(err).ok();
        start_new_session(function(err) {
          expect(err).ok();
          send_alert(function(err) {
            expect(err).ok();
            done();
          });
        });
      });

    });

    //-------------------------------------------------------------------------
    it('performs an initial slow-sync and exchanges data', function(done) {

      var clientID   = 'test-syncml-js-server.client.' + (new Date()).getTime();
      var serverID   = 'https://example.com/sync';
      var nextAnchor = '' + helpers.now();
      var peerAnchor = null;
      var returnUrl  = serverID + ';s=a139bb50047b45ca9820fe53f5161e55';
      var session    = syncmljs.makeSessionInfo({returnUrl: returnUrl, effectiveID: serverID});

      // step 0: initialize server storage with some data
      var initialize_storage = function(cb) {
        sync.agent.addItem({body: 'some server data'}, cb);
      };

      // step 1: register the peer (transfer devInfo) and send alert
      var register_new_peer = function(cb) {
        var request    = makeRequest_init(serverID, clientID, {nextAnchor: nextAnchor});
        var collector  = new helpers.ResponseCollector();
        sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
          expect(err).ok();
          expect(stats).toEqual({srv_note: syncmljs.makeStats({mode: syncmljs.SYNCTYPE_SLOW_SYNC})});
          peerAnchor = helpers.findXml(collector.contents[0], './SyncBody/Alert/Item/Meta/Anchor/Next');
          return cb(err);
        });
      };

      // step 2: send the client data and receive server data
      var exchange_data = function(cb) {
        var request = makeRequest_sync(serverID, clientID, {
          peerNextAnchor: peerAnchor,
          items: [
            {id: '2000', body: 'first client item'},
            {id: '2001', body: 'second client item'}
          ]
        });
        var collector  = new helpers.ResponseCollector();
        sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
          expect(err).ok();
          expect(stats).toEqual({srv_note: syncmljs.makeStats({
            mode:    syncmljs.SYNCTYPE_SLOW_SYNC,
            hereAdd: 2
          })});
          var chk = ''
            + '<SyncML>'
            + ' <SyncHdr>'
            + '  <VerDTD>1.2</VerDTD>'
            + '  <VerProto>SyncML/1.2</VerProto>'
            + '  <SessionID>1</SessionID>'
            + '  <MsgID>2</MsgID>'
            + '  <Source>'
            + '   <LocURI>https://example.com/sync</LocURI>'
            + '   <LocName>In-Memory Test Server</LocName>'
            + '  </Source>'
            + '  <Target>'
            + '   <LocURI>' + clientID + '</LocURI>'
            + '   <LocName>test-client</LocName>'
            + '  </Target>'
            + '  <RespURI>' + returnUrl + '</RespURI>'
            + ' </SyncHdr>'
            + ' <SyncBody>'
            + '  <Status>'
            + '   <CmdID>1</CmdID>'
            + '   <MsgRef>2</MsgRef>'
            + '   <CmdRef>0</CmdRef>'
            + '   <Cmd>SyncHdr</Cmd>'
            + '   <SourceRef>' + clientID + '</SourceRef>'
            + '   <TargetRef>https://example.com/sync</TargetRef>'
            + '   <Data>200</Data>'
            + '  </Status>'
            + '  <Status>'
            + '   <CmdID>2</CmdID>'
            + '   <MsgRef>2</MsgRef>'
            + '   <CmdRef>4</CmdRef>'
            + '   <Cmd>Sync</Cmd>'
            + '   <SourceRef>./cli_memo</SourceRef>'
            + '   <TargetRef>srv_note</TargetRef>'
            + '   <Data>200</Data>'
            + '  </Status>'
            + '  <Status>'
            + '   <CmdID>3</CmdID>'
            + '   <MsgRef>2</MsgRef>'
            + '   <CmdRef>5</CmdRef>'
            + '   <Cmd>Add</Cmd>'
            + '   <SourceRef>2000</SourceRef>'
            + '   <Data>201</Data>'
            + '  </Status>'
            + '  <Status>'
            + '   <CmdID>4</CmdID>'
            + '   <MsgRef>2</MsgRef>'
            + '   <CmdRef>6</CmdRef>'
            + '   <Cmd>Add</Cmd>'
            + '   <SourceRef>2001</SourceRef>'
            + '   <Data>201</Data>'
            + '  </Status>'
            + '  <Sync>'
            + '    <CmdID>5</CmdID>'
            + '    <Source><LocURI>srv_note</LocURI></Source>'
            + '    <Target><LocURI>cli_memo</LocURI></Target>'
            + '    <NumberOfChanges>1</NumberOfChanges>'
            + '    <Add>'
            + '      <CmdID>6</CmdID>'
            + '      <Meta><Type xmlns="syncml:metinf">text/plain</Type></Meta>'
            + '      <Item>'
            + '        <Source><LocURI>1000</LocURI></Source>'
            + '        <Data>some server data</Data>'
            + '      </Item>'
            + '    </Add>'
            + '  </Sync>'
            + '  <Final/>'
            + ' </SyncBody>'
            + '</SyncML>'
          ;
          expect(collector.contentTypes).toEqual(['application/vnd.syncml+xml; charset=UTF-8']);
          expect(collector.contents.length).toEqual(1);
          expect(collector.contents[0]).toEqualXml(chk);
          return cb(err);
        });
      };

      // step 3: send mapping of server-sent data and terminate
      var map_data = function(cb) {
        var request = makeRequest_map(serverID, clientID, {
          syncCmdRef : 5,
          map        : {'2002': '1000'}
        });
        var collector  = new helpers.ResponseCollector();
        sync.adapter.handleRequest(request, session, null, collector.write, function(err, stats) {
          expect(err).ok();
          expect(stats).toEqual({srv_note: syncmljs.makeStats({
            mode:    syncmljs.SYNCTYPE_SLOW_SYNC,
            hereAdd: 2,
            peerAdd: 1
          })});
          var chk = ''
            + '<SyncML>'
            + ' <SyncHdr>'
            + '  <VerDTD>1.2</VerDTD>'
            + '  <VerProto>SyncML/1.2</VerProto>'
            + '  <SessionID>1</SessionID>'
            + '  <MsgID>3</MsgID>'
            + '  <Source>'
            + '   <LocURI>https://example.com/sync</LocURI>'
            + '   <LocName>In-Memory Test Server</LocName>'
            + '  </Source>'
            + '  <Target>'
            + '   <LocURI>' + clientID + '</LocURI>'
            + '   <LocName>test-client</LocName>'
            + '  </Target>'
            + '  <RespURI>' + returnUrl + '</RespURI>'
            + ' </SyncHdr>'
            + ' <SyncBody>'
            + '  <Status>'
            + '   <CmdID>1</CmdID>'
            + '   <MsgRef>3</MsgRef>'
            + '   <CmdRef>0</CmdRef>'
            + '   <Cmd>SyncHdr</Cmd>'
            + '   <SourceRef>' + clientID + '</SourceRef>'
            + '   <TargetRef>https://example.com/sync</TargetRef>'
            + '   <Data>200</Data>'
            + '  </Status>'
            + '  <Status>'
            + '   <CmdID>2</CmdID>'
            + '   <MsgRef>3</MsgRef>'
            + '   <CmdRef>4</CmdRef>'
            + '   <Cmd>Map</Cmd>'
            + '   <SourceRef>cli_memo</SourceRef>'
            + '   <TargetRef>srv_note</TargetRef>'
            + '   <Data>200</Data>'
            + '  </Status>'
            + '  <Final/>'
            + ' </SyncBody>'
            + '</SyncML>'
          ;
          expect(collector.contentTypes).toEqual(['application/vnd.syncml+xml; charset=UTF-8']);
          expect(collector.contents.length).toEqual(1);
          expect(collector.contents[0]).toEqualXml(chk);
          return cb(err);
        });
      };

      // step 4: check the server data...
      var verify_data = function(cb) {
        var txn = sync.context._db.transaction();
        storage.getAll(txn.objectStore('mapping'), null, null, function(err, list) {
          if ( err )
            return cb(err);
          list = _.map(list, function(item) {
            return _.omit(item, 'store_id');
          });
          var s = function(item) {
            return 'g:' + item.guid + ';l:' + item.luid;
          };
          expect(_.sortBy(list, s)).toEqual(_.sortBy([
            {guid: '1000', luid: '2002'},
            {guid: '1001', luid: '2000'},
            {guid: '1002', luid: '2001'}
          ], s));
          // TODO: verify the storage of all other stores as well...
          cb();
        });
      };

      initialize_storage(function(err) {
        expect(err).ok();
        register_new_peer(function(err) {
          expect(err).ok();
          exchange_data(function(err) {
            expect(err).ok();
            map_data(function(err) {
              expect(err).ok();
              verify_data(function(err) {
                expect(err).ok();
                done();
              });
            });
          });
        });
      });

    });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
