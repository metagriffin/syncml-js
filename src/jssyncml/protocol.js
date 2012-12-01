// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.protocol
// auth: griffin <griffin@uberdev.org>
// date: 2012/11/04
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  'elementtree',
  './logging',
  './common',
  './constant',
  './codec',
  './ctype',
  './storage',
  './devinfo',
  './state',
  './base64'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  codec,
  ctype,
  storage,
  devinfo,
  state,
  // todo: is the inclusion of a base-64 implementation really necessary?
  //       don't all frameworks now provide that???
  base64
) {

  var log = logging.getLogger('jssyncml.protocol');
  var exports = {};

  //---------------------------------------------------------------------------
  var badStatus = function(xnode, kls) {
    if ( ! kls )
      kls = common.ProtocolError;
    var code  = xnode.findtext('Data');
    var cname = xnode.findtext('Cmd');
    var msg   = null;
    if ( kls == common.ProtocolError )
      msg = 'unexpected status code ' + code + ' for command "' + cname + '"';
    else
      msg = 'received status code ' + code + ' for command "' + cname + '"';
    try{
      var xerr  = xnode.find('Error');
    }catch(e){
      var xerr = null;
    }
    if ( xerr )
      msg += ': [' + xerr.findtext('Code') + '] ' + xerr.findtext('Message');
    return new kls(msg)
  };

  //---------------------------------------------------------------------------
  exports.badStatus = badStatus;

  //---------------------------------------------------------------------------
  exports.Protocol = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
    },

    // TODO: FOR SERVER-SIDE:
    //         - implement getAuthInfo()
    //         - implement getTargetID()

    //-------------------------------------------------------------------------
    isComplete: function(session, commands) {
      return (! session.info.isServer
              && commands.length == 3
              && commands[0].name == constant.CMD_SYNCHDR
              && commands[1].name == constant.CMD_STATUS
              && commands[1].statusOf == constant.CMD_SYNCHDR
              && commands[1].statusCode == constant.STATUS_OK
              && commands[2].name == constant.CMD_FINAL
             );
    },

    //----------------------<---------------------------------------------------
    initialize: function(session, xtree, cb) {
      var cmd = state.makeCommand({
        name        : constant.CMD_SYNCHDR,
        cmdID       : 0,
        version     : constant.SYNCML_VERSION_1_2,
        source      : session.info.effectiveID || session.adapter.devID,
        sourceName  : session.adapter.name
      });

      if ( session.info.isServer )
      {
        // TODO: FOR SERVER-SIDE, implement:
        //         - target peer extraction
        //         - session / message ID extraction
        //         - response URL extraction / generation
        return cb(new common.NotImplementedError('server-side protocol'));
      }

      session.info.pendingMsgID = ( session.info.isServer
                                    ? session.info.msgID
                                    : session.info.lastMsgID );
      session.info.cmdID        = 0;
      cmd.sessionID   = session.info.id;
      cmd.msgID       = session.info.msgID;
      cmd.target      = session.peer.devID || null;
      cmd.targetName  = session.peer.name || null;
      cmd.auth        = session.peer.auth;

      if ( cmd.msgID == 1 )
      {
        // NOTE: normally, the "server" would not send this info. however, in
        //       the jssyncml world where it is much more peer-oriented
        //       instead of client/server, i send this as well... the
        //       idea being, if two "client" peers are communicating in
        //       the event of server unavailability, then they may need
        //       to know each-others limitations...
        cmd.maxMsgSize = common.getMaxMemorySize(session.context);
        cmd.maxObjSize = common.getMaxMemorySize(session.context);
      }

      cb(null, [cmd]);
    },

    //-------------------------------------------------------------------------
    negotiate: function(session, commands, cb) {

      // // todo: determine why i decided to clone the commands...
      // commands = _.clone(commands);

      if ( commands.length > 0 && _.last(commands).name == constant.CMD_FINAL )
        return cb(null, commands);

      if ( commands.length > 0
           && _.last(commands).name == constant.CMD_ALERT
           && _.last(commands).data == constant.STATUS_NEXT_MESSAGE )
        // todo: should i add a "final" here?...
        // commands.push(state.makeCommand({name: constant.CMD_FINAL}));
        return cb(null, commands);

      var createCommands = function(commands, cb) {
        // request the remote device info if not currently available
        if ( ! session.peer.devInfo )
        {
          log.debug('no peer.devinfo - requesting from target (and sending source devinfo)');
          commands.push(state.makeCommand({
            name       : constant.CMD_PUT,
            cmdID      : session.nextCmdID(),
            type       : constant.TYPE_SYNCML_DEVICE_INFO + '+' + session.info.codec,
            source     : './' + constant.URI_DEVINFO_1_2,
            data       : session.adapter.devInfo.toSyncML(constant.SYNCML_DTD_VERSION_1_2,
                                                          _.values(session.adapter._stores))
          }));
          commands.push(state.makeCommand({
            name     : constant.CMD_GET,
            cmdID    : session.nextCmdID(),
            type     : constant.TYPE_SYNCML_DEVICE_INFO + '+' + session.info.codec,
            target   : './' + constant.URI_DEVINFO_1_2
          }));
          return cb(null, commands);
        }

        log.debug('have peer.devinfo - not requesting from target');
        return session.context.synchronizer.actions(session, commands, cb);
      };

      createCommands(commands, function(err, commands) {
        if ( err )
          return cb(err);
        commands.push(state.makeCommand({name: constant.CMD_FINAL}));
        cb(null, commands);
      });

    },

    //-------------------------------------------------------------------------
    // NOTE: `produce` is equivalent to the `pysyncml.protocol.commands2tree`...
    // Consumes state.Command commands and converts them to an ET protocol tree
    produce: function(session, commands, cb) {

      if ( commands.length <= 0 )
        return cb('protocol.produce received empty commands');

      var hdrcmd = commands[0];
      commands = _.rest(commands, 1);

      if ( hdrcmd.name != constant.CMD_SYNCHDR )
        return cb('unexpected first command "' + hdrcmd.name + '"');

      if ( hdrcmd.version != constant.SYNCML_VERSION_1_2 )
        return cb('unsupported SyncML version "' + hdrcmd.version + '"');

      var xsync = ET.Element(constant.NODE_SYNCML);
      var xhdr  = ET.SubElement(xsync, hdrcmd.name);
      if ( hdrcmd.version == constant.SYNCML_VERSION_1_2 )
      {
        ET.SubElement(xhdr, 'VerDTD').text = constant.SYNCML_DTD_VERSION_1_2;
        ET.SubElement(xhdr, 'VerProto').text = hdrcmd.version;
      }

      ET.SubElement(xhdr, 'SessionID').text = hdrcmd.sessionID;
      ET.SubElement(xhdr, 'MsgID').text = hdrcmd.msgID;
      var xsrc = ET.SubElement(xhdr, 'Source');
      ET.SubElement(xsrc, 'LocURI').text = hdrcmd.source;
      if ( hdrcmd.sourceName )
        ET.SubElement(xsrc, 'LocName').text = hdrcmd.sourceName;
      var xtgt = ET.SubElement(xhdr, 'Target');
      ET.SubElement(xtgt, 'LocURI').text = hdrcmd.target;
      if ( hdrcmd.targetName )
        ET.SubElement(xtgt, 'LocName').text = hdrcmd.targetName;
      if ( hdrcmd.respUri )
        ET.SubElement(xhdr, 'RespURI').text = hdrcmd.respUri;

      if ( hdrcmd.auth && ! session.info.authAccepted )
      {
        // TODO: implement other auth schemes...
        if ( hdrcmd.auth != constant.NAMESPACE_AUTH_BASIC )
          return cb('auth method "' + hdrcmd.auth + '" not implemented');

        if ( hdrcmd.auth == constant.NAMESPACE_AUTH_BASIC )
        {
          var xcred = ET.SubElement(xhdr, 'Cred');
          var xmeta = ET.SubElement(xcred, 'Meta');
          ET.SubElement(xmeta, 'Format', {'xmlns': constant.NAMESPACE_METINF}).text = 'b64';
          ET.SubElement(xmeta, 'Type', {'xmlns': constant.NAMESPACE_METINF}).text   = hdrcmd.auth;
          ET.SubElement(xcred, 'Data').text = base64.encode(
            session.peer.username + ':' + session.peer.password);
        }
      }
      if ( hdrcmd.maxMsgSize || hdrcmd.maxObjSize )
      {
        var xmeta = ET.SubElement(xhdr, 'Meta');
        if ( hdrcmd.maxMsgSize )
          ET.SubElement(xmeta, 'MaxMsgSize',
                        {'xmlns': constant.NAMESPACE_METINF}).text = hdrcmd.maxMsgSize;
        if ( hdrcmd.maxObjSize )
          ET.SubElement(xmeta, 'MaxObjSize',
                        {'xmlns': constant.NAMESPACE_METINF}).text = hdrcmd.maxObjSize;
      }

      var xbody = ET.SubElement(xsync, constant.NODE_SYNCBODY);

      for ( var idx=0 ; idx<commands.length ; idx++ )
      {
        var cmd  = commands[idx];
        var xcmd = ET.SubElement(xbody, cmd.name);
        if ( cmd.cmdID != undefined )
          ET.SubElement(xcmd, 'CmdID').text = cmd.cmdID;
        var func = this['_produce_cmd_' + cmd.name.toLowerCase()];
        if ( ! func )
          return cb('unexpected command "' + cmd.name + '"');
        try{
          func.call(this, session, cmd, xcmd);
        }catch(e){
          // todo: preserve exception location file/line number somehow?...
          return cb('failed invoking protocol sub-production: ' + e);
        }
        if ( cmd.name == constant.CMD_FINAL && idx + 1 != commands.length )
          return cb('command "' + cmd.name + '" not at end of commands');
      }

      cb(null, xsync);
    },

    //-------------------------------------------------------------------------
    _produce_cmd_alert: function(session, cmd, xcmd) {
      ET.SubElement(xcmd, 'Data').text = cmd.data;
      var xitem = ET.SubElement(xcmd, 'Item');
      ET.SubElement(ET.SubElement(xitem, 'Source'), 'LocURI').text = cmd.source;
      ET.SubElement(ET.SubElement(xitem, 'Target'), 'LocURI').text = cmd.target;
      if ( cmd.lastAnchor || cmd.nextAnchor || cmd.maxObjSize )
      {
        var xmeta = ET.SubElement(xitem, 'Meta');
        var xanch = ET.SubElement(xmeta, 'Anchor', {'xmlns': constant.NAMESPACE_METINF});
        if ( cmd.lastAnchor )
          ET.SubElement(xanch, 'Last').text = cmd.lastAnchor;
        if ( cmd.nextAnchor )
          ET.SubElement(xanch, 'Next').text = cmd.nextAnchor;
        if ( cmd.maxObjSize )
          ET.SubElement(xmeta, 'MaxObjSize',
                        {'xmlns': constant.NAMESPACE_METINF}).text = cmd.maxObjSize;
      }
    },

    //-------------------------------------------------------------------------
    _produce_cmd_status: function(session, cmd, xcmd) {
      ET.SubElement(xcmd, 'MsgRef').text    = '' + cmd.msgRef;
      ET.SubElement(xcmd, 'CmdRef').text    = '' + cmd.cmdRef;
      ET.SubElement(xcmd, 'Cmd').text       = cmd.statusOf;
      if ( cmd.sourceRef )
        ET.SubElement(xcmd, 'SourceRef').text = cmd.sourceRef;
      if ( cmd.targetRef )
        ET.SubElement(xcmd, 'TargetRef').text = cmd.targetRef;
      ET.SubElement(xcmd, 'Data').text      = cmd.statusCode;
      if ( cmd.nextAnchor || cmd.lastAnchor )
      {
        var xdata = ET.SubElement(ET.SubElement(xcmd, 'Item'), 'Data');
        var xanch = ET.SubElement(xdata, 'Anchor', {'xmlns': constant.NAMESPACE_METINF});
        if ( cmd.lastAnchor )
          ET.SubElement(xanch, 'Last').text = cmd.lastAnchor;
        if ( cmd.nextAnchor )
          ET.SubElement(xanch, 'Next').text = cmd.nextAnchor;
      }
      // NOTE: this is NOT standard SyncML...
      if ( cmd.errorCode || cmd.errorMsg )
      {
        var xerr = ET.SubElement(xcmd, 'Error');
        if ( cmd.errorCode )
          ET.SubElement(xerr, 'Code').text = cmd.errorCode;
        if ( cmd.errorMsg )
          ET.SubElement(xerr, 'Message').text = cmd.errorMsg;
        if ( cmd.errorTrace )
          ET.SubElement(xerr, 'Trace').text = cmd.errorTrace;
      }
    },

    //-------------------------------------------------------------------------
    _produce_cmd_get: function(session, cmd, xcmd) {
      ET.SubElement(ET.SubElement(xcmd, 'Meta'), 'Type',
                    {'xmlns': constant.NAMESPACE_METINF}).text = cmd.type;
      if ( cmd.source || cmd.target || cmd.data )
      {
        var xitem = ET.SubElement(xcmd, 'Item');
        if ( cmd.source )
        {
          var xsrc = ET.SubElement(xitem, 'Source');
          ET.SubElement(xsrc, 'LocURI').text  = cmd.source;
          ET.SubElement(xsrc, 'LocName').text = cmd.source;
        }
        if ( cmd.target )
        {
          var xtgt = ET.SubElement(xitem, 'Target');
          ET.SubElement(xtgt, 'LocURI').text  = cmd.target;
          ET.SubElement(xtgt, 'LocName').text = cmd.target;
        }
        if ( cmd.data )
        {
          if ( _.isString(cmd.data) )
            ET.SubElement(xitem, 'Data').text = cmd.data;
          else
            // assuming here that it is an ElementTree object...
            ET.SubElement(xitem, 'Data').append(cmd.data);
        }
      }
    },

    //-------------------------------------------------------------------------
    _produce_cmd_put: function(session, cmd, xcmd) {
      return this._produce_cmd_get(session, cmd, xcmd);
    },

    //-------------------------------------------------------------------------
    _produce_cmd_results: function(session, cmd, xcmd) {
      ET.SubElement(xcmd, 'MsgRef').text    = cmd.msgRef;
      ET.SubElement(xcmd, 'CmdRef').text    = cmd.cmdRef;
      ET.SubElement(ET.SubElement(xcmd, 'Meta'), 'Type',
                    {'xmlns': constant.NAMESPACE_METINF}).text = cmd.type;
      var xitem = ET.SubElement(xcmd, 'Item');
      var xsrc  = ET.SubElement(xitem, 'Source');
      ET.SubElement(xsrc, 'LocURI').text  = cmd.source;
      ET.SubElement(xsrc, 'LocName').text = cmd.source;
      if ( cmd.data )
      {
        if ( _.isString(cmd.data) )
          ET.SubElement(xitem, 'Data').text = cmd.data;
        else
          // assuming here that it is an ElementTree object...
          ET.SubElement(xitem, 'Data').append(cmd.data);
      }
    },

    //-------------------------------------------------------------------------
    _produce_cmd_sync: function(session, cmd, xcmd) {
      ET.SubElement(ET.SubElement(xcmd, 'Source'), 'LocURI').text = cmd.source;
      ET.SubElement(ET.SubElement(xcmd, 'Target'), 'LocURI').text = cmd.target;
      if ( cmd.noc != undefined )
        ET.SubElement(xcmd, 'NumberOfChanges').text = '' + cmd.noc;
      if ( ! cmd.data )
        return;
      for ( var idx=0 ; idx<cmd.data.length ; idx++ )
      {
        var scmd = cmd.data[idx];
        var xscmd = ET.SubElement(xcmd, scmd.name);
        if ( scmd.cmdID )
          ET.SubElement(xscmd, 'CmdID').text = scmd.cmdID;
        if ( scmd.type
             || ( scmd.format && scmd.format != constant.FORMAT_AUTO ) )
        {
          var xsmeta = ET.SubElement(xscmd, 'Meta')
          // todo: implement auto encoding determination...
          //       (the current implementation just lets XML encoding
          //       do it, which is for most things good enough, but
          //       not so good for sequences that need a large amount
          //       of escaping such as binary data...)
          if ( scmd.format && scmd.format != constant.FORMAT_AUTO )
            ET.SubElement(xsmeta, 'Format',
                          {'xmlns': constant.NAMESPACE_METINF}).text = scmd.format;
          if ( scmd.type )
            ET.SubElement(xsmeta, 'Type',
                          {'xmlns': constant.NAMESPACE_METINF}).text = scmd.type;
        }
        var xsitem = ET.SubElement(xscmd, 'Item');
        if ( scmd.source )
          ET.SubElement(ET.SubElement(xsitem, 'Source'),
                        'LocURI').text = scmd.source;
        if ( scmd.sourceParent )
          ET.SubElement(ET.SubElement(xsitem, 'SourceParent'),
                        'LocURI').text = scmd.sourceParent;
        if ( scmd.target )
          ET.SubElement(ET.SubElement(xsitem, 'Target'),
                        'LocURI').text = scmd.target;
        if ( scmd.targetParent )
          ET.SubElement(ET.SubElement(xsitem, 'TargetParent'),
                        'LocURI').text = scmd.targetParent;
        if ( scmd.data )
        {
          if ( _.isString(scmd.data) )
            ET.SubElement(xsitem, 'Data').text = scmd.data;
          else
            // assuming here that it is an ElementTree object...
            ET.SubElement(xsitem, 'Data').append(scmd.data);
        }
      }
    },

    //-------------------------------------------------------------------------
    _produce_cmd_map: function(session, cmd, xcmd) {
      ET.SubElement(ET.SubElement(xcmd, 'Source'), 'LocURI').text = cmd.source;
      ET.SubElement(ET.SubElement(xcmd, 'Target'), 'LocURI').text = cmd.target;
      if ( cmd.sourceItem || cmd.targetItem )
      {
        var xitem = ET.SubElement(xcmd, constant.CMD_MAPITEM);
        if ( cmd.sourceItem )
          ET.SubElement(ET.SubElement(xitem, 'Source'), 'LocURI').text = cmd.sourceItem;
        if ( cmd.targetItem )
          ET.SubElement(ET.SubElement(xitem, 'Target'), 'LocURI').text = cmd.targetItem;
      }
    },

    //-------------------------------------------------------------------------
    _produce_cmd_final: function(session, cmd, xcmd) {
      return;
    },

    //-------------------------------------------------------------------------
    // NOTE: `consume` is equivalent to the `pysyncml.protocol.tree2commands`...
    // consume: function...
    consume: function(session, lastcmds, xsync, cb) {

      // do some preliminary sanity checks...
      // todo: do i really want to be returning an error instead of
      // generating an error response?...

      if ( xsync.tag != constant.NODE_SYNCML
           || xsync.getchildren().length != 2
           || xsync.getchildren()[0].tag != constant.CMD_SYNCHDR
           || xsync.getchildren()[1].tag != constant.NODE_SYNCBODY
         )
      {
        log.error('bad SyncML request: ' + ET.tostring(xsync));
        return cb('unexpected SyncML document structure');
      }

      var version = xsync.getchildren()[0].findtext('VerProto');
      if ( version != constant.SYNCML_VERSION_1_2 )
        return cb('unsupported SyncML version "' + version + '"');

      var verdtd = xsync.getchildren()[0].findtext('VerDTD');
      if ( verdtd != constant.SYNCML_DTD_VERSION_1_2 )
        return cb('unsupported SyncML DTD version "' + verdtd + '"');

      var self = this;

      self.initialize(session, xsync, function(err, cmds) {

        var hdrcmd = cmds[0];
        var makeErrorCommands = function(err, cb) {
          if ( ! session.info.isServer )
            return cb(err);

          // TODO: make sure this is executed as intended...

          // TODO: make this configurable as to whether or not any error
          //       is sent back to the peer as a SyncML "standardized" error
          //       status...
          return cb(null, [
            hdrcmd,
            state.makeCommand({
              name       : constant.CMD_STATUS,
              cmdID      : '1',
              msgRef     : session.info.pendingMsgID,
              cmdRef     : 0,
              sourceRef  : xsync.getchildren()[0].findtext('Source/LocURI'),
              targetRef  : xsync.getchildren()[0].findtext('Target/LocURI'),
              statusOf   : constant.CMD_SYNCHDR,
              statusCode : constant.STATUS_COMMAND_FAILED,
              errorMsg   : err
              // errorCode  : code,
              // errorMsg   : msg,
              // errorTrace : make-stack-trace...
            }),
            state.makeCommand({name: constant.CMD_FINAL})]);
        };

        try {

          self._consume(session, lastcmds, xsync, cmds, function(err, commands) {
            if ( err )
              return makeErrorCommands(err, cb);
            return cb(null, commands);
          });

        } catch ( exc ) {

          return makeErrorCommands(exc, cb);

        }

      });
    },

    //-------------------------------------------------------------------------
    _consume: function(session, lastcmds, xsync, commands, cb) {

      var self       = this;
      var hdrcmd     = commands[0];
      var statusCode = constant.STATUS_OK;

      // analyze the SyncHdr
      var children = xsync.getchildren()[0].getchildren();
      for ( var idx=0 ; idx<children.length ; idx++ )
      {
        var child = children[idx];

        if ( child.tag == 'VerDTD' )
        {
          if ( hdrcmd.version == constant.SYNCML_VERSION_1_2 )
          {
            if ( child.text != constant.SYNCML_DTD_VERSION_1_2 )
              return cb(new common.ProtocolError('bad VerDTD "' + child.text + '"'));
          }
          else
            return cb(new common.FeatureNotSupported(
              'unsupported internal SyncML version "' + hdrcmd.version + '"'));
          continue;
        }

        if ( child.tag == 'VerProto' )
          // this was checked earlier...
          continue;

        if ( child.tag == 'SessionID' )
        {
          if ( child.text != hdrcmd.sessionID )
            return cb(new common.ProtocolError(
              'session ID mismatch: "' + child.text + '" != "' + hdrcmd.sessionID + '"'));
          continue;
        }

        if ( child.tag == 'MsgID' )
        {
          var chkmsg = ( session.info.isServer ? hdrcmd.msgID : lastcmds[0].msgID );
          if ( child.text != chkmsg )
            return cb(new common.ProtocolError(
              'message ID mismatch: "' + child.text + '" != "' + chkmsg + '"'));
          continue;
        }

        if ( child.tag == 'Target' )
        {
          var uri = child.findtext('LocURI');
          if ( uri != hdrcmd.source )
            return cb(new common.ProtocolError(
              'incoming target mismatch: "' + uri + '" != "' + hdrcmd.source + '"'));
          continue;
        }

        if ( child.tag == 'Source' )
        {
          var uri = child.findtext('LocURI');
          if ( uri != hdrcmd.target && uri != lastcmds[0].target )
            return cb(new common.ProtocolError(
              'incoming source mismatch: "' + uri + '" != "' + hdrcmd.target + '"'));
          continue;
        }

        if ( child.tag == 'RespURI' )
        {
          // hdrcmd.target = child.text
          // session.info.respUri = child.text
          if ( ! session.info.isServer )
            session.info.respUri = child.text;
          continue;
        }

        if ( child.tag == 'Cred' )
        {
          // the responsibility is on the calling framework to ensure this is
          // checked long before we get here... ie. Adapter.authorize(...)
          statusCode = constant.STATUS_AUTHENTICATION_ACCEPTED;
          continue;
        }

        if ( child.tag == 'Meta' )
        {
          // this should already have been consumed during the protocol.initialize() call
          continue;
        }

        return cb(new common.ProtocolError('unexpected header node "' + child.tag + '"'));
      };

      commands.push(state.makeCommand({
        name       : constant.CMD_STATUS,
        cmdID      : session.nextCmdID(),
        msgRef     : session.info.pendingMsgID,
        cmdRef     : 0,
        sourceRef  : xsync.getchildren()[0].findtext('Source/LocURI'),
        targetRef  : xsync.getchildren()[0].findtext('Target/LocURI'),
        statusOf   : constant.CMD_SYNCHDR,
        statusCode : statusCode
      }));

      // and now evaluate the SyncBody

      var chkcmds = _.filter(lastcmds, function(e) {
        return e.name != constant.CMD_STATUS && e.name != constant.CMD_FINAL;
      });

      // for each "sync" command, search for sub-commands
      // todo: should this be generalized to search for any sub-commands?...
      _.each(chkcmds, function(e) {
        if ( e.name != constant.CMD_SYNC || ! e.data || e.data.length <= 0 )
          return;
        _.each(e.data, function(sub) { chkcmds.push(sub); });
      });

      _.each(chkcmds, function(chkcmd) {
        log.debug('outstanding command node "s%s.m%s.c%s" (%s)',
                  session.info.id, lastcmds[0].msgID,
                  chkcmd.cmdID, chkcmd.name);
      });

      var children = xsync.getchildren()[1].getchildren();

      // first, check all the 'Status' commands

      var consumeStatus = function(cb) {

        common.cascade(children, function(child, cb) {

          if ( child.tag != constant.CMD_STATUS )
            return cb();

          cname = child.findtext('Cmd');

          log.debug('checking status node for "s%s.m%s.c%s" (%s)',
                    session.info.id, child.findtext('MsgRef'),
                    child.findtext('CmdRef'), cname);

          var blen   = chkcmds.length;
          var chkcmd = null;
          var chkerr = null;

          chkcmds = _.filter(chkcmds, function(cmd) {
            if ( chkerr )
              return;
            if ( cmd.cmdID != child.findtext('CmdRef')
                 || cmd.name != cname
                 || lastcmds[0].msgID != child.findtext('MsgRef') )
              return true;
            if ( chkcmd )
              chkerr = new Error('unexpected error: multiple check commands match status command');
            chkcmd = cmd;
            return false;
          });

          if ( chkerr )
            return cb(chkerr);

          if ( chkcmds.length >= blen )
            return cb(new common.ProtocolError(
              'unexpected status node "s' + session.info.id + '.m' + child.findtext('MsgRef')
                + '.c' + child.findtext('CmdRef') + ' cmd=' + cname + '"'));

          // TODO: check for unknown elements...

          var code = parseInt(child.findtext('Data'), 10);

          if ( code == constant.STATUS_MISSING_CREDENTIALS )
            return cb(badStatus(child, common.CredentialsRequired));
          if ( code == constant.STATUS_INVALID_CREDENTIALS )
            return cb(badStatus(child, common.InvalidCredentials));

          var targetRef = child.findtext('TargetRef');
          if ( targetRef )
          {
            // note: doing a normUri on chkcmd.target because it could be "./devinf12"...
            if ( session.peer.normUri(targetRef) != session.peer.normUri(chkcmd.target) )
              return cb(new common.ProtocolError('unexpected target-ref "'
                                                 + targetRef + '" != "' + chkcmd.target
                                                 + '" for command "' + cname + '"'));
          }

          var sourceRef = child.findtext('SourceRef');
          if ( sourceRef )
          {
            // note: doing a normUri on chkcmd.source because it could be "./devinf12"...
            if ( cname == constant.CMD_SYNCHDR )
            {
              // this is a little odd, but syncevolution strips the sessionid path
              // parameter off for some reason, so compensating here...
              if ( _.indexOf([session.adapter.normUri(chkcmd.source),
                              session.info.effectiveID,
                              session.info.returnUrl],
                             session.adapter.normUri(sourceRef)) < 0
                   && session.adapter.normUri(chkcmd.source).indexOf(session.adapter.normUri(sourceRef)) != 0 )
                return cb(new common.ProtocolError('unexpected source-ref "'
                                                   + sourceRef + '" != "' + chkcmd.source
                                                   + '" for command "' + cname + '"'));
            }
            else
            {
              if ( session.adapter.normUri(sourceRef) != session.adapter.normUri(chkcmd.source) )
                return cb(new common.ProtocolError('unexpected source-ref "'
                                                   + sourceRef + '" != "' + chkcmd.source
                                                   + '" for command "' + cname + '"'));
            }
          }   

          // todo: any other common elements?...

          switch ( cname )
          {

            case constant.CMD_SYNCHDR:
            {
              if ( code != constant.STATUS_OK && code != constant.STATUS_AUTHENTICATION_ACCEPTED )
                return cb(badStatus(child));
              if ( code == constant.STATUS_AUTHENTICATION_ACCEPTED )
              {
                // TODO: there is currently nothing that can "reset" the
                //       authAccepted flag...  there should be a trap such
                //       that if an auth fails, then authAccepted gets set
                //       to false.
                session.info.authAccepted = true;
              }
              return cb();
            }

            case constant.CMD_ALERT:
            {
              if ( code != constant.STATUS_OK )
                return cb(badStatus(child));
              // TODO: do something with the Item/Data/Anchor/Next...
              return cb();
            }

            case constant.CMD_GET:
            {
              if ( code != constant.STATUS_OK )
                return cb(badStatus(child));
              return cb();
            }

            case constant.CMD_PUT:
            {
              if ( code != constant.STATUS_OK )
                return cb(badStatus(child));
              return cb();
            }

            case constant.CMD_RESULTS:
            {
              if ( code != constant.STATUS_OK )
                return cb(badStatus(child));
              return cb();
            }

            case constant.CMD_SYNC:
            {
              // todo: should this be moved into the synchronizer as a "settle" event?...
              if ( code != constant.STATUS_OK )
                return cb(badStatus(child));
              var ds = session.info.dsstates[session.adapter.normUri(chkcmd.source)]
              if ( session.info.isServer )
              {
                if ( ds.action == 'send' )
                {
                  ds.action = 'save';
                  return cb();
                }
              }
              else
              {
                if ( ds.action == 'send' )
                {
                  ds.action = 'recv';
                  return cb();
                }
              }
              return cb(new common.ProtocolError('unexpected sync state for action=' + ds.action));
            }

            case constant.CMD_ADD:
            case constant.CMD_REPLACE:
            case constant.CMD_DELETE:
            {
              var scmd = state.makeCommand({
                name       : cname,
                msgID      : hdrcmd.msgID,
                cmdID      : child.findtext('CmdID'),
                sourceRef  : sourceRef,
                targetRef  : targetRef,
                data       : code
              });

              session.context.synchronizer.settle(
                session, scmd, chkcmd, child,
                function(err, cmds) {
                  if ( err )
                    return cb(err);
                  _.each(cmds, function(cmd) { commands.push(cmd); });
                  return cb();
                });
              return;
            }

            case constant.CMD_MAP:
            {
              if ( session.info.isServer )
                return cb(new common.ProtocolError(
                  'unexpected server-side status for command "' + cname + '"'));
              if ( code != constant.STATUS_OK )
                return cb(badStatus(child));
              return cb();
            }

            default:
            {
              return cb(new common.ProtocolError('unexpected status for command "' + cname + '"'));
            }

          }

        }, cb);

      };

      // second, check all the non-'Status' commands

      var consumeCommands = function(cb) {

        var gotFinal = false;

        common.cascade(children, function(child, cb) {

          if ( gotFinal )
            log.warning('peer sent non-last final command');

          if ( child.tag == constant.CMD_STATUS )
            return cb();

          if ( child.tag == constant.CMD_FINAL )
          {
            gotFinal = true;
            return cb();
          }

          log.debug('handling command "%s"', child.tag);

          // todo: restrict this to the following commands?...
          //         CMD_ALERT, CMD_GET, CMD_PUT,
          //         CMD_SYNC, CMD_RESULTS, CMD_MAP

          var func = self['_consume_node_' + child.tag.toLowerCase()];

          if ( ! func )
            return cb(new common.ProtocolError('unexpected command node "' + child.tag + '"'));

          try{

            func.call(self, session, lastcmds, xsync, child, function(err, cmds) {
              if ( err )
                return cb(err);
              _.each(cmds, function(cmd) { commands.push(cmd); });
              return cb();
            });

          }catch(e){
            return cb('failed invoking protocol sub-consumption: ' + e);
          }

        }, function(err) {

          if ( err )
            return cb(err);

          if ( ! gotFinal )
          {
            commands.append(state.makeCommand({
              name       : constant.CMD_ALERT,
              cmdID      : session.nextCmdID(),
              data       : constant.STATUS_NEXT_MESSAGE,
              source     : session.adapter.devID,
              target     : session.peer.devID,
            }));
          }

          return cb();

        });

      };

      // do it!

      consumeStatus(function(err) {

        if ( err )
          return cb(err);

        // TODO: is this right?... or should i be getting pissed off and
        //       raising hell that all my commands were not addressed?...

        _.each(chkcmds, function(chkcmd) {
          log.warn('re-issuing unrequited command node "s%s.m%s.c%s" (%s)',
                   session.info.id, lastcmds[0].msgID,
                   chkcmd.cmdID, chkcmd.name);
          commands.push(chkcmd);
        });

        return consumeCommands(function(err) {
          if ( err )
            return cb(err);
          return cb(null, commands);
        });

      });

    },

    // #----------------------------------------------------------------------------
    // def t2c_get(self, adapter, session, lastcmds, xsync, xnode):
    //   cttype = xnode.findtext('Meta/Type')
    //   target = xnode.findtext('Item/Target/LocURI')
    //   if cttype.startswith(constant.TYPE_SYNCML_DEVICE_INFO) \
    //      and adapter.normUri(target) == constant.URI_DEVINFO_1_2:
    //     return self.t2c_get_devinf12(adapter, session, lastcmds, xsync, xnode)
    //   # todo: make error status node...
    //   raise common.ProtocolError('unexpected "Get" command for target "%s"' % (target,))

    // #----------------------------------------------------------------------------
    // def t2c_get_devinf12(self, adapter, session, lastcmds, xsync, xnode):
    //   ret = []
    //   ret.append(state.Command(
    //     name       = constant.CMD_STATUS,
    //     cmdID      = session.nextCmdID(),
    //     msgRef     = session.info.pendingMsgID,
    //     cmdRef     = xnode.findtext('CmdID'),
    //     statusOf   = xnode.tag,
    //     statusCode = constant.STATUS_OK,
    //     targetRef  = xnode.findtext('Item/Target/LocURI'),
    //     ))
    //   ret.append(state.Command(
    //     name       = constant.CMD_RESULTS,
    //     cmdID      = session.nextCmdID(),
    //     msgRef     = session.info.pendingMsgID,
    //     cmdRef     = xnode.findtext('CmdID'),
    //     type       = constant.TYPE_SYNCML_DEVICE_INFO + '+' + adapter.codec.name,
    //     source     = './' + constant.URI_DEVINFO_1_2,
    //     data       = adapter.devInfo.toSyncML(constant.SYNCML_DTD_VERSION_1_2, adapter.stores.values()),
    //     ))
    //   return ret

    // #----------------------------------------------------------------------------
    // def t2c_put(self, adapter, session, lastcmds, xsync, xnode):
    //   cttype = xnode.findtext('Meta/Type')
    //   source = xnode.findtext('Item/Source/LocURI')
    //   if cttype.startswith(constant.TYPE_SYNCML_DEVICE_INFO) \
    //      and adapter.peer.normUri(source) == constant.URI_DEVINFO_1_2:
    //     return self.t2c_put_devinf12(adapter, session, lastcmds, xsync, xnode)
    //   # todo: make error status node...
    //   raise common.ProtocolError('unexpected "%s" command for remote "%s"' % (constant.CMD_RESULTS, source))

    //-------------------------------------------------------------------------
    _consume_node_put_devinf12: function(session, lastcmds, xsync, xnode, cb) {
      var xdev = xnode.find('Item/Data/DevInf');
      var res  = devinfo.DevInfo.fromSyncML(xdev);
      session.peer._setRemoteInfo(res[0], res[1], function(err) {
        if ( err )
          return cb(err);
        session.context.router.recalculate(session.adapter, session.peer, function(err) {
          if ( err )
            return cb(err);
          session.context.synchronizer.initStoreSync(session, function(err) {
            if ( err )
              return cb(err);

            // session.adapter._save(function(err) {
            //   if ( err )
            //     return cb(err);

            return cb(null, [state.makeCommand({
              name       : constant.CMD_STATUS,
              cmdID      : session.nextCmdID(),
              msgRef     : xsync.findtext('SyncHdr/MsgID'),
              cmdRef     : xnode.findtext('CmdID'),
              sourceRef  : xnode.findtext('Item/Source/LocURI'),
              statusOf   : xnode.tag,
              statusCode : constant.STATUS_OK
            })]);

            // });

          });
        });
      });
    },

    //-------------------------------------------------------------------------
    _consume_node_results: function(session, lastcmds, xsync, xnode, cb) {
      var cttype = xnode.findtext('Meta/Type');
      var source = xnode.findtext('Item/Source/LocURI');
      if ( cttype.indexOf(constant.TYPE_SYNCML_DEVICE_INFO) == 0
           && session.peer.normUri(source) == constant.URI_DEVINFO_1_2 )
        return this._consume_node_put_devinf12(session, lastcmds, xsync, xnode, cb);
      // todo: make error status node...
      return cb(new common.ProtocolError('unexpected "' + constant.CMD_RESULTS
                                         + '" command for remote "' + source + '"'))
    },

    //-------------------------------------------------------------------------
    _consume_node_alert: function(session, lastcmds, xsync, xnode, cb) {
      var code = parseInt(xnode.findtext('Data'), 10);
      var statusCode = constant.STATUS_OK
      switch ( code )
      {
        case constant.ALERT_TWO_WAY:
        case constant.ALERT_SLOW_SYNC:
        case constant.ALERT_ONE_WAY_FROM_CLIENT:
        case constant.ALERT_REFRESH_FROM_CLIENT:
        case constant.ALERT_ONE_WAY_FROM_SERVER:
        case constant.ALERT_REFRESH_FROM_SERVER:
        // todo: these should only be received out-of-band: right?...
        // case constant.ALERT_TWO_WAY_BY_SERVER:
        // case constant.ALERT_ONE_WAY_FROM_CLIENT_BY_SERVER:
        // case constant.ALERT_REFRESH_FROM_CLIENT_BY_SERVER:
        // case constant.ALERT_ONE_WAY_FROM_SERVER_BY_SERVER:
        // case constant.ALERT_REFRESH_FROM_SERVER_BY_SERVER:
        {
          break;
        }
        default:
        {
          if ( session.info.isServer && code == constant.STATUS_RESUME )
          {
            log.warn('peer requested resume (not support that yet) - forcing slow-sync');
            code = constant.ALERT_SLOW_SYNC;
          }
          else
          {
            return cb(new common.FeatureNotSupported(
              'unimplemented sync mode '
                + code + ' ("' + common.mode2string(code) + '")'));
          }
        }
      }

      if ( session.info.isServer )
      {
        // TODO: if this is the server, we need to validate that the requested
        //       sync mode is actually feasible... i.e. check:
        //         - do the anchors match?
        //         - have we bound the datastores together?
        //         - is there a pending sync?
        return cb(new common.NotImplementedError('server-side protocol'));
      }

      var uri  = session.adapter.normUri(xnode.findtext('Item/Target/LocURI'));
      var ruri = session.peer.normUri(xnode.findtext('Item/Source/LocURI'));
      log.debug('peer requested %s synchronization of "%s" (here) to "%s" (peer)',
                common.mode2string(code), uri, ruri);

      // TODO: this should really be done by the synchronizer... as it can
      //       then also do a lot of checks - potentially responding with
      //       an error...

      var ds = null;

      if ( session.info.isServer )
      {
        // TODO: implement server-side
        return cb(new common.NotImplementedError('server-side protocol'));

        // if uri in session.info.dsstates:
        //   ds = session.info.dsstates[uri]
        // else:
        //   adapter.router.setRoute(uri, ruri, autoMapped=True)
        //   peerStore = adapter.peer.stores[ruri]
        //   ds = common.adict(
        //     # TODO: perhaps share this "constructor" with router/adapter?...
        //     peerUri    = ruri,
        //     lastAnchor = peerStore.binding.localAnchor,
        //     nextAnchor = str(int(time.time())),
        //     stats      = state.Stats(),
        //     mode       = None, # setting to null so that the client tells us...
        //     )
        //   session.info.dsstates[uri] = ds
        // ds.action = 'alert'
      }
      else
      {
        ds = session.info.dsstates[uri];
        if ( ! ds )
          return cb(new common.ProtocolError('request for unreflected local datastore "'
                                             + uri + '"'));
        ds.action = 'send'
        if ( code != ds.mode )
          log.info('server-side switched sync modes from %s to %s for datastore "%s"',
                   common.mode2string(ds.mode), common.mode2string(code), uri);
      }

      ds.mode = code;
      ds.peerLastAnchor = xnode.findtext('Item/Meta/Anchor/Last');
      ds.peerNextAnchor = xnode.findtext('Item/Meta/Anchor/Next');

      if ( ds.peerLastAnchor != session.peer.getStore(ruri)._getModel().binding.remoteAnchor )
      {
        log.warning(
          'last-anchor mismatch (here: %r, peer: %r) for datastore "%s" - forcing slow-sync',
          session.peer.getStore(ruri)._getModel().binding.remoteAnchor, ds.peerLastAnchor, uri);
        ds.peerLastAnchor = null;
        switch ( ds.mode )
        {
          case constant.ALERT_SLOW_SYNC:
          case constant.ALERT_REFRESH_FROM_CLIENT:
          case constant.ALERT_REFRESH_FROM_SERVER:
          {
            break;
          }
          default:
          {
            if ( session.info.isServer )
            {
              ds.mode = constant.ALERT_SLOW_SYNC;
              statusCode = constant.STATUS_REFRESH_REQUIRED;
            }
            else
            {
              // todo: should i assume that the server knows something
              //       that i don't and just go along with it?...
              return cb(new common.ProtocolError(
                'server-side requested inappropriate ' + common.mode2string(ds.mode)
                  + ' sync mode on unbound datastore "' + uri + '"'));
            }
          }
        }
      }

      return cb(null, [state.makeCommand({
        name       : constant.CMD_STATUS,
        cmdID      : session.nextCmdID(),
        msgRef     : xsync.findtext('SyncHdr/MsgID'),
        cmdRef     : xnode.findtext('CmdID'),
        targetRef  : xnode.findtext('Item/Target/LocURI'),
        sourceRef  : xnode.findtext('Item/Source/LocURI'),
        statusOf   : xnode.tag,
        statusCode : statusCode,
        // todo: syncevolution does not echo the remote last anchor... why not?
        lastAnchor : ds.peerLastAnchor,
        nextAnchor : ds.peerNextAnchor
      })]);

    },

    //-------------------------------------------------------------------------
    _consume_node_sync: function(session, lastcmds, xsync, xnode, cb) {
      var self   = this;
      var uri    = xnode.findtext('Target/LocURI');
      var store  = session.adapter.getStore(session.adapter.normUri(uri));
      var ds     = session.info.dsstates[session.adapter.normUri(uri)];
      var commands = [state.makeCommand({
        name        : constant.CMD_SYNC,
        msgID       : xsync.findtext('SyncHdr/MsgID'),
        cmdID       : xnode.findtext('CmdID'),
        source      : xnode.findtext('Source/LocURI'),
        target      : uri,
        data        : [],
      })];
      var noc = xnode.findtext('NumberOfChanges');
      if ( noc != undefined )
        noc = parseInt(noc, 10);
      common.cascade(xnode.getchildren(), function(child, cb) {
        switch ( child.tag )
        {
          case 'CmdID':
          case 'Target':
          case 'Source':
          case 'NumberOfChanges':
          {
            return cb();
          }
          case constant.CMD_ADD:
          case constant.CMD_REPLACE:
          case constant.CMD_DELETE:
          {
            var func = self['_consume_sync_' + child.tag.toLowerCase()];
            func.call(self, session, lastcmds, store, xsync, child, function(err, cmds) {
              if ( err )
                return cb(err);
              _.each(cmds, function(cmd) { commands[0].data.push(cmd); });
              return cb();
            });
            return;
          }
          default:
          {
            return cb(new common.ProtocolError('unexpected sync command "' + child.tag + '"'));
          }
        }
      }, function(err) {
        if ( err )
          return cb(err);
        // confirm that i received the right number of changes...
        if ( noc != undefined && noc != commands[0].data.length )
          return cb(new common.ProtocolError('number-of-changes mismatch (received '
                                             + commands[0].data.length + ', expected '
                                             + noc + ')'));
        if ( ! session.info.isServer )
        {
          if ( ds.action != 'recv' )
            return cb(new common.ProtocolError('unexpected sync state for URI "'
                                               + uri + '": action=' + ds.action));
          ds.action = 'done';
        }
        else
        {
          return cb(new common.NotImplementedError('server-side sync receive'));
          // if ds.action != 'alert':
          //   raise common.ProtocolError('unexpected sync state for URI "%s": action=%s'
          //                              % (uri, ds.action))
          // ds.action = 'send'
        }
        return session.context.synchronizer.reactions(session, commands, cb);
      });
    },

    //-------------------------------------------------------------------------
    _consume_xnode2item: function(session, lastcmds, store, xsync, xnode, cb) {
      var ctype  = xnode.findtext('Meta/Type');
      // todo: can the version be specified in the Meta tag?... maybe create an
      //       extension to SyncML to communicate this?...
      var ctver  = null;
      var format = xnode.findtext('Meta/Format');
      var xitem  = xnode.findall('Item/Data');
      if ( xitem.length > 1 )
        return cb(new common.ProtocolError(
          '"' + xnode.tag + '" command with non-singular item data nodes'));
      if ( xitem.length < 1 )
        return cb(new common.ProtocolError(
          '"' + xnode.tag + '" command with missing data node'));
      var xitem = xitem[0];
      // todo: confirm that getchildren only returns element nodes...
      if ( xitem.getchildren().length == 1 )
        data = xitem.getchildren()[0];
      else
      {
        data = xitem.text;
        if ( format == constant.FORMAT_B64 )
          data = base64.decode(data);
      }
      return store.agent.loadsItem(data, ctype, ctver, cb);
    },

    //-------------------------------------------------------------------------
    _consume_sync_add: function(session, lastcmds, store, xsync, xnode, cb) {
      this._consume_xnode2item(session, lastcmds, store, xsync, xnode, function(err, item) {
        if ( err )
          return cb(err);
        return cb(null, [state.makeCommand({
          name          : constant.CMD_ADD,
          msgID         : xsync.findtext('SyncHdr/MsgID'),
          cmdID         : xnode.findtext('CmdID'),
          source        : xnode.findtext('Item/Source/LocURI'),
          sourceParent  : xnode.findtext('Item/SourceParent/LocURI'),
          targetParent  : xnode.findtext('Item/TargetParent/LocURI'),
          data          : item
        })]);
      });
    },

    //-------------------------------------------------------------------------
    _consume_sync_replace: function(session, lastcmds, store, xsync, xnode, cb) {
      this._consume_xnode2item(session, lastcmds, store, xsync, xnode, function(err, item) {
        if ( err )
          return cb(err);
        return cb(null, [state.makeCommand({
          name          : constant.CMD_REPLACE,
          msgID         : xsync.findtext('SyncHdr/MsgID'),
          cmdID         : xnode.findtext('CmdID'),
          source        : xnode.findtext('Item/Source/LocURI'),
          sourceParent  : xnode.findtext('Item/SourceParent/LocURI'),
          target        : xnode.findtext('Item/Target/LocURI'),
          targetParent  : xnode.findtext('Item/TargetParent/LocURI'),
          data          : item
        })]);
      });
    },

    //-------------------------------------------------------------------------
    _consume_sync_delete: function(session, lastcmds, store, xsync, xnode, cb) {
      return cb(null, [state.makeCommand({
        name          : constant.CMD_DELETE,
        msgID         : xsync.findtext('SyncHdr/MsgID'),
        cmdID         : xnode.findtext('CmdID'),
        source        : xnode.findtext('Item/Source/LocURI'),
        sourceParent  : xnode.findtext('Item/SourceParent/LocURI'),
        target        : xnode.findtext('Item/Target/LocURI'),
        targetParent  : xnode.findtext('Item/TargetParent/LocURI')
      })]);
    },

    // #----------------------------------------------------------------------------
    // def makeStatus(self, session, xsync, xnode, status=constant.STATUS_OK, **kw):
    //   return state.Command(
    //     name       = constant.CMD_STATUS,
    //     cmdID      = session.nextCmdID(),
    //     msgRef     = xsync.findtext('SyncHdr/MsgID'),
    //     cmdRef     = xnode.findtext('CmdID'),
    //     statusOf   = xnode.tag,
    //     statusCode = status,
    //     **kw
    //     )

    // #----------------------------------------------------------------------------
    // def t2c_map(self, adapter, session, lastcmds, xsync, xnode):
    //   # TODO: should this be moved into the synchronizer?...
    //   srcUri = xnode.findtext('Source/LocURI')
    //   tgtUri = xnode.findtext('Target/LocURI')
    //   peerStore = adapter.peer.stores[adapter.peer.normUri(srcUri)]
    //   # todo: should i verify that the GUID is valid?...
    //   for xitem in xnode.findall('MapItem'):
    //     luid = xitem.findtext('Source/LocURI')
    //     guid = xitem.findtext('Target/LocURI')
    //     # TODO: is there a better way of doing this than DELETE + INSERT?...
    //     #       ie. is there an SQL INSERT_OR_UPDATE?...
    //     adapter._context._model.Mapping.q(store_id=peerStore.id, guid=guid).delete()
    //     newmap = adapter._context._model.Mapping(store_id=peerStore.id, guid=guid, luid=luid)
    //     adapter._context._model.session.add(newmap)
    //   return [self.makeStatus(session, xsync, xnode,
    //                           targetRef=tgtUri, sourceRef=srcUri)]



  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
