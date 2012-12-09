// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.synchronizer
// auth: griffin <griffin@uberdev.org>
// date: 2012/11/05
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
  './ctype',
  './state',
  './protocol',
  './storage'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  ctype,
  state,
  protocol,
  storage
) {

  var log = logging.getLogger('jssyncml.synchronizer');
  var exports = {};
  var badStatus = protocol.badStatus;

  //---------------------------------------------------------------------------
  exports.Synchronizer = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
    },

    //-------------------------------------------------------------------------
    initStoreSync: function(session, cb) {
      var err = null;
      _.each(session.peer._getModel().stores, function(rstore) {
        if ( err )
          return;
        var ruri = session.peer.normUri(rstore.uri);
        if ( session.info.dsstates[ruri] || ! rstore.binding )
          return;
        var lstore = session.adapter.getStore(rstore.binding.uri);
        if ( ! lstore || ! lstore.agent )
          return;
        var ds = state.makeStoreSyncState({
          uri        : lstore.uri,
          peerUri    : ruri,
          lastAnchor : rstore.binding.localAnchor,
          mode       : session.info.mode || constant.ALERT_TWO_WAY,
          action     : 'alert'
        });
        log.debug('adding store "%s" (remote "%s") to sync list', ds.uri, ruri);
        if ( ! ds.lastAnchor )
        {
          switch ( ds.mode )
          {
            case constant.ALERT_SLOW_SYNC:
            case constant.ALERT_REFRESH_FROM_CLIENT:
            case constant.ALERT_REFRESH_FROM_SERVER:
            {
              break;
            }
            case constant.ALERT_TWO_WAY:
            case constant.ALERT_ONE_WAY_FROM_CLIENT:
            case constant.ALERT_ONE_WAY_FROM_SERVER:
            {
              log.debug('forcing slow-sync for store "'
                        + ds.uri + '" (no previous successful synchronization)');
              ds.mode = constant.ALERT_SLOW_SYNC;
              break;
            }
            default:
            {
              err = 'unexpected sync mode "' + ds.mode + '" requested';
              return;
            }
          }
        }
        session.info.dsstates[ds.uri] = ds;
      });
      return cb(err);
    },

    //-------------------------------------------------------------------------
    // SYNCHRONIZATION PHASE: ACTION
    //-------------------------------------------------------------------------

    //-------------------------------------------------------------------------
    actions: function(session, commands, cb) {
      var self = this;
      common.cascade(_.keys(session.info.dsstates), function(uri, cb) {
        var ds = session.info.dsstates[uri];
        log.debug('generating synchronizer "%s" actions for store "%s"', ds.action, uri);
        if ( ds.action == 'done' )
          return cb();
        var func = self['_action_' + ds.action.toLowerCase()];
        if ( ! func )
          return cb('unexpected store action "' + ds.action + '"');
        try{
          func.call(self, session, ds, function(err, cmds) {
            if ( err )
              return cb(err);
            _.each(cmds, function(cmd) { commands.push(cmd); });
            return cb(null, commands);
          });
        }catch(e){
          // todo: preserve exception location file/line number somehow?...
          return cb('failed invoking synchronizer action: ' + e);
        }
      }, function(err) {
        if ( err )
          return cb(err);
        return cb(null, commands);
      });
    },

    //-------------------------------------------------------------------------
    _action_alert: function(session, dsstate, cb) {

      var src = session.adapter.getStore(dsstate.uri);
      var tgt = session.peer.getStore(dsstate.peerUri);

      // TODO: ensure that mode is acceptable...

      // todo: perhaps i should only specify maxObjSize if it differs from
      //       adapter.maxObjSize?...

      return cb(null, [state.makeCommand({
        name        : constant.CMD_ALERT,
        cmdID       : session.nextCmdID(),
        data        : dsstate.mode,
        source      : src.uri,
        target      : tgt.uri,
        lastAnchor  : dsstate.lastAnchor,
        nextAnchor  : dsstate.nextAnchor,
        maxObjSize  : src.maxObjSize,
      })]);

    },

    //-------------------------------------------------------------------------
    _action_send: function(session, dsstate, cb) {
      var store = session.adapter.getStore(dsstate.uri);
      var agent = store.agent;
      var peerStore = session.peer.getStore(dsstate.peerUri);

      var cmd = state.makeCommand({
        name   : constant.CMD_SYNC,
        cmdID  : session.nextCmdID(),
        source : dsstate.uri,
        // target : adapter.router.getTargetUri(uri),
        target : dsstate.peerUri
      });

      switch ( dsstate.mode )
      {
        case constant.ALERT_TWO_WAY:
        case constant.ALERT_SLOW_SYNC:
        case constant.ALERT_ONE_WAY_FROM_CLIENT:
        case constant.ALERT_REFRESH_FROM_CLIENT:
        case constant.ALERT_ONE_WAY_FROM_SERVER:
        case constant.ALERT_REFRESH_FROM_SERVER:
        // todo: these should only be received out-of-band, right?...
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
          return cb(new common.InternalError(
            'unexpected sync mode "' + common.mode2string(dsstate.mode) + '"'));
        }
      }

      log.debug('sending sync commands for URI "%s" in %s mode (anchor: %s)',
                dsstate.uri, common.mode2string(dsstate.mode),
                dsstate.lastAnchor || '-');

      if ( session.isServer )
      {
        if ( dsstate.mode == constant.ALERT_REFRESH_FROM_CLIENT
             || dsstate.mode == constant.ALERT_ONE_WAY_FROM_CLIENT )
          return cb(null, [cmd]);
      }

      if ( ! session.isServer )
      {
        if ( dsstate.mode == constant.ALERT_REFRESH_FROM_SERVER
             || dsstate.mode == constant.ALERT_ONE_WAY_FROM_SERVER )
          return cb(null, [cmd]);
      }

      switch ( dsstate.mode )
      {

        case constant.ALERT_TWO_WAY:
        case constant.ALERT_ONE_WAY_FROM_CLIENT: // when ! session.isServer
        case constant.ALERT_ONE_WAY_FROM_SERVER: // when session.isServer
        {

          return cb(new common.NotImplementedError('two-way or one-way sync'));

  //     # send local changes
  //     changes  = adapter._context._model.Change.q(store_id=peerStore.id)
  //     cmd.data = []
  //     ctype    = adapter.router.getBestTransmitContentType(uri)

  //     # TODO: add support for hierarchical operations...
  //     #       including MOVE, COPY, etc.

  //     # TODO: this assumes that the entire object set can fit in memory...
  //     #       perhaps, as a work-around, just keep a reference to the object
  //     #       and then stream-based serialize it actually gets converted to
  //     #       XML.

  //     for change in changes:
  //       if dsstate.conflicts is not None and change.itemID in dsstate.conflicts:
  //         continue
  //       scmdtype = {
  //         constant.ITEM_ADDED    : constant.CMD_ADD,
  //         constant.ITEM_MODIFIED : constant.CMD_REPLACE,
  //         constant.ITEM_DELETED  : constant.CMD_DELETE,
  //         }.get(change.state)
  //       if scmdtype is None:
  //         log.error('could not resolve item state %d to sync command', change.state)
  //         continue
  //       # todo: do something with the content-type version?...
  //       scmd = state.Command(
  //         name    = scmdtype,
  //         cmdID   = session.nextCmdID(),
  //         format  = constant.FORMAT_AUTO,
  //         type    = ctype[0] if change.state != constant.ITEM_DELETED else None,
  //         uri     = uri,
  //         )
  //       # TODO: need to add hierarchical addition support here...
  //       if scmdtype != constant.CMD_DELETE:
  //         item = agent.getItem(change.itemID)
  //         scmd.data = agent.dumpsItem(item, ctype[0], ctype[1])
  //         if not isinstance(scmd.data, basestring):
  //           scmd.type = scmd.data[0]
  //           scmd.data = scmd.data[2]
  //         if agent.hierarchicalSync and item.parent is not None:
  //           scmd.sourceParent = str(item.parent)
  //       if scmdtype == constant.CMD_ADD:
  //         scmd.source = change.itemID
  //       else:
  //         if session.isServer:
  //           try:
  //             # todo: this is a bit of an abstraction violation...
  //             query = adapter._context._model.Mapping.q(store_id=peerStore.id, guid=change.itemID)
  //             scmd.target = query.one().luid
  //           except NoResultFound:
  //             scmd.source = change.itemID
  //         else:
  //           scmd.source = change.itemID
  //       cmd.data.append(scmd)

  //     cmd.noc  = len(cmd.data)
  //     return [cmd]

          return cb(null, [cmd]);
        }
        case constant.ALERT_SLOW_SYNC:
        case constant.ALERT_REFRESH_FROM_SERVER: // when session.isServer
        case constant.ALERT_REFRESH_FROM_CLIENT: // when ! session.isServer
        {
          // todo: this approach assumes that the entire object set can fit
          //       in memory... perhaps move to an iterator-based approach?...
          cmd.data = [];
          agent.getAllItems(function(err, items) {

            // TODO: support hierarchical sync...

            if ( agent.hierarchicalSync )
            {
              return cb(new common.NotImplementedError('hierarchical-sync'));
  //       orditems = []            # the ordered items
  //       dunitems = dict()        # lut of the ordered items
  //       curitems = dict()        # lut of current items (for loop detection)
  //       lutitems = dict([(item.id, item) for item in items])
  //       def appenditem(item):
  //         if item.id in dunitems:
  //           return
  //         if item.id in curitems:
  //           raise common.LogicalError('recursive item hierarchy detected at item %r' % (item,))
  //         curitems[item.id] = True
  //         if item.parent is not None:
  //           appenditem(lutitems[item.parent])
  //         orditems.append(item)
  //         dunitems[item.id] = item
  //       for item in items:
  //         curitems = dict()
  //         appenditem(item)
            }

            var ctype = session.context.router.getBestTransmitContentType(
              session.adapter, session.peer, dsstate.uri);

            common.cascade(items, function(item, cb) {

              // TODO: these should all be non-deleted items, right?...

              if ( _.indexOf(dsstate.conflicts, '' + item.id) >= 0 )
                return cb();

              if ( session.isServer )
              {
                return cb(new common.NotImplementedError('server-side sync'));
                // TODO: implement server-side...
                // check to see if this item has already been mapped. if so,
                // then don't send it.
                //   try:
                //     # todo: this is a bit of an abstraction violation...
                //     query = adapter._context._model.Mapping.q(store_id=peerStore.id, guid=item.id)
                //     if query.one().luid is not None:
                //       continue
                //   except NoResultFound:
                //     pass
              }


              agent.dumpsItem(
                item, ctype[0], ctype[1],
                function(err, data, new_ct, new_v) {

                  if ( err )
                    return cb(err);

                  // todo: do something with the content-type version...
                  var scmd = state.makeCommand({
                    name    : constant.CMD_ADD,
                    cmdID   : session.nextCmdID(),
                    format  : constant.FORMAT_AUTO,
                    type    : new_ct || ctype[0],
                    uri     : dsstate.uri,
                    source  : '' + item.id,
                    data    : data
                    });

                  if ( agent.hierarchicalSync )
                  {
                    // TODO: support hierarchical sync...
                    // if agent.hierarchicalSync and item.parent is not None:
                    //   scmd.sourceParent = str(item.parent)
                    return cb(new common.NotImplementedError('hierarchical-sync'));
                  }

                  cmd.data.push(scmd);
                  return cb();
                });

            }, function(err) {

              cmd.noc = cmd.data.length;
              return cb(null, [cmd]);
            });

          });
          return;
        }
      }

      return cb(new common.InternalError(
        'unexpected sync situation (action=' + dsstate.action
          + ', mode=' + common.mode2string(dsstate.mode)
          + ', isServer=' + ( session.isServer ? '1' : '0' ) + ')'));
    },

  // #----------------------------------------------------------------------------
  // def action_save(self, adapter, session, uri, dsstate):
  //   if not session.isServer:
  //     # TODO: for now, only servers should take the "save" action - the client
  //     #       will explicitly do this at the end of the .sync() method.
  //     #       ... mostly because clients don't call synchronizer.actions()
  //     #       one final time ...
  //     #       *BUT* perhaps that should be changed?... for example, .sync()
  //     #       could call synchronizer.actions() to cause action_save's to occur
  //     #       *AND* verify that synchronizer.actions() does not return anything...
  //     raise common.InternalError('unexpected sync situation (action=%s, isServer=%s)'
  //                                % (dsstate.action, '1' if session.isServer else '0'))
  //   log.debug('storing anchors: peer=%s; source=%s/%s; target=%s/%s',
  //             adapter.peer.devID, uri, dsstate.nextAnchor,
  //             dsstate.peerUri, dsstate.peerNextAnchor)
  //   peerStore = adapter.peer.stores[dsstate.peerUri]
  //   peerStore.binding.sourceAnchor = dsstate.nextAnchor
  //   peerStore.binding.targetAnchor = dsstate.peerNextAnchor

    //-------------------------------------------------------------------------
    // SYNCHRONIZATION PHASE: REACTION
    //-------------------------------------------------------------------------

    //-------------------------------------------------------------------------
    reactions: function(session, commands, cb) {
      var self = this;
      var ret  = [];
      session.hierlut = null;
      common.cascade(commands, function(cmd, cb) {
        log.debug('generating synchronizer "%s" reactions', cmd.name);
        var func = self['_reaction_' + cmd.name.toLowerCase()];
        if ( ! func )
          return cb('unexpected store reaction "' + cmd.name + '"');
        try{
          func.call(self, session, cmd, function(err, cmds) {
            if ( err )
              return cb(err);
            _.each(cmds, function(cmd) { ret.push(cmd); });
            return cb();
          });
        }catch(e){
          // todo: preserve exception location file/line number somehow?...
          return cb('failed invoking synchronizer reaction: ' + e);
        }
      }, function(err) {
        session.hierlut = null;
        if ( err )
          return cb(err);
        return cb(null, ret);
      });
    },

    //-------------------------------------------------------------------------
    _reaction_sync: function(session, command, cb) {

      var self = this;
      var ret  = [state.makeCommand({
        name       : constant.CMD_STATUS,
        cmdID      : session.nextCmdID(),
        msgRef     : command.msgID,
        cmdRef     : command.cmdID,
        targetRef  : command.target,
        sourceRef  : command.source,
        statusOf   : command.name,
        statusCode : constant.STATUS_OK
      })];

      var store = session.adapter.getStore(session.adapter.normUri(command.target));
      if ( store.agent.hierarchicalSync )
        session.hierlut = {};
      var dsstate = session.info.dsstates[store.uri];

      var preprocess = common.noop;

      if ( ( ! session.isServer && dsstate.mode == constant.ALERT_REFRESH_FROM_SERVER )
           || ( session.isServer && dsstate.mode == constant.ALERT_REFRESH_FROM_CLIENT ) )
      {
        // delete all local items
        preprocess = function(cb) {
          store.agent.getAllItems(function(err, items) {
            if ( err )
              return cb(err);
            common.cascade(items, function(item, cb) {
              store.agent.deleteItem(item.id, function(err) {
                if ( err )
                  return cb(err);
                dsstate.stats.hereDel += 1;
                if ( ! session.isServer )
                  return cb();
                store.registerChange(item.id, constant.ITEM_DELETED,
                                     {excludePeerID: session.peer.id}, cb);
              });
            }, function(err) {
              if ( err )
                return cb(err);
              return store.getPeerStore(session.peer)._delChange({}, cb);
            });
          });
        };
      }

      preprocess(function(err) {
        if ( err )
          return cb(err);

        if ( command.data.length <= 0 )
          return cb(null, ret);

        // paranoia: verify that i should be receiving data...
        if ( ! ( dsstate.mode == constant.ALERT_TWO_WAY
                 || dsstate.mode == constant.ALERT_SLOW_SYNC
                 || ( ! session.isServer
                      && ( dsstate.mode == constant.ALERT_ONE_WAY_FROM_SERVER
                           || dsstate.mode == constant.ALERT_REFRESH_FROM_SERVER ) )
                 || ( session.isServer
                      && ( dsstate.mode == constant.ALERT_ONE_WAY_FROM_CLIENT
                           || dsstate.mode == constant.ALERT_REFRESH_FROM_CLIENT ) ) ) )
          return cb(new common.ProtocolError(
            'unexpected sync data (role="'
              + ( session.isServer ? 'server' : 'client' )
              + '", mode="' + common.mode2string(dsstate.mode)
              + '")'));

        common.cascade(command.data, function(cmd, cb) {
          // paranoia: non-'add' sync commands should only be received in non-refresh modes
          if ( cmd.name != constant.CMD_ADD
               && _.indexOf([constant.ALERT_TWO_WAY,
                             constant.ALERT_ONE_WAY_FROM_SERVER,
                             constant.ALERT_ONE_WAY_FROM_CLIENT], dsstate.mode) < 0 )
            return cb(new common.ProtocolError(
              'unexpected non-add sync command (role="'
                + ( session.isServer ? 'server' : 'client' )
                + '", mode="' + common.mode2string(dsstate.mode)
                + '", command="' + cmd.name
                + '")'));

          self._reaction_syncdispatch(session, cmd, store, dsstate, function(err, cmds) {
            if ( err )
              return cb(err);
            _.each(cmds, function(cmd) { ret.push(cmd); });
            return cb(null, ret);
          });

        }, function(err) {
          if ( err )
            return cb(err);
          return cb(null, ret);
        });
      });
    },

    //-------------------------------------------------------------------------
    _reaction_syncdispatch: function(session, cmd, store, dsstate, cb) {

      var self = this;
      var func = self['_reaction_sync_' + cmd.name.toLowerCase()];
      if ( ! func )
        return cb('unexpected reaction requested for sync command "' + cmd.name + '"');

      if ( session.isServer
           && cmd.name != constant.CMD_ADD
           && dsstate.mode != constant.ALERT_REFRESH_FROM_CLIENT )
      {
        // server, non-add, non-slowsync, non-refresh commands: check for conflicts.
        // note that certain types of content could be a conflict even if it is an
        // "Add" command; for example, two files with the same name cannot be added
        // from separate clients.

        return cb(new common.NotImplementedError('server-side sync'));
        // TODO: implement server-side...

  //   # todo: allow agents to raise a ConflictError...
  //   #       ==> perhaps this is already covered by the .matchItem() API?...
  //   if session.isServer \
  //      and cmd.name != constant.CMD_ADD \
  //      and dsstate.mode != constant.ALERT_REFRESH_FROM_CLIENT:
  //     itemID = self.getSourceMapping(adapter, session, constant.CMD_SYNC,
  //                                    cmd, store.peer, cmd.source)
  //     try:
  //       change = adapter._context._model.Change.q(
  //         store_id = store.peer.id,
  //         itemID   = itemID).one()

  //       retcmd = state.Command(
  //         name       = constant.CMD_STATUS,
  //         cmdID      = session.nextCmdID(),
  //         msgRef     = cmd.msgID,
  //         cmdRef     = cmd.cmdID,
  //         sourceRef  = cmd.source,
  //         targetRef  = cmd.target,
  //         statusOf   = cmd.name,
  //         # todo: make this error message a bit more descriptive...
  //         errorMsg   = 'command "%s" conflict for item ID %r (state: %s)' \
  //                        % (cmd.name, itemID, common.state2string(change.state)),
  //         )

  //       # four possible states: mod-mod, mod-del, del-mod, del-del
  //       if dsstate.conflicts is None:
  //         dsstate.conflicts = []

  //       # handle mod-mod (but only if change-tracking is enabled)
  //       if change.state == constant.ITEM_MODIFIED \
  //          and cmd.name == constant.CMD_REPLACE:
  //         cmd._conflict = retcmd
  //         cmd._change   = change
  //         # todo: this "raise" is a hack just to abort conflict handling!...
  //         #       here and let reaction_sync_replace handle it...
  //         raise NoResultFound

  //       # handle del-del
  //       if change.state == constant.ITEM_DELETED \
  //          and cmd.name == constant.CMD_DELETE:
  //         # both changes are deletes... that's not a conflict.
  //         # TODO: should i really be doing all this here?... it does not
  //         #       follow the pattern...
  //         adapter._context._model.session.delete(change)
  //         dsstate.stats.peerDel   += 1
  //         dsstate.stats.hereDel   += 1
  //         dsstate.stats.merged    += 1
  //         retcmd.statusCode = constant.STATUS_CONFLICT_RESOLVED_MERGE
  //         retcmd.errorCode  = None
  //         retcmd.errorMsg   = None
  //         return [retcmd]

  //       # handle del-mod or mod-del
  //       if ( change.state == constant.ITEM_DELETED \
  //            or cmd.name == constant.CMD_DELETE ) \
  //          and store.conflictPolicy != constant.POLICY_ERROR:
  //         # one of them is a delete and a conflict that can be solved
  //         # by the framework
  //         cmd._conflict = retcmd
  //         cmd._change   = change
  //         # todo: this "raise" is a hack just to abort conflict handling
  //         #       here and let reaction_sync_delete handle it...
  //         raise NoResultFound

  //       dsstate.conflicts.append(itemID)
  //       dsstate.stats.peerErr   += 1
  //       dsstate.stats.conflicts += 1
  //       log.warning(retcmd.errorMsg)
  //       retcmd.statusCode = constant.STATUS_UPDATE_CONFLICT
  //       retcmd.errorCode  = common.fullClassname(self) + '.RSd.10'
  //       return [retcmd]

  //     except NoResultFound:
  //       pass

      }

      try{
        func.call(self, session, cmd, store, dsstate, cb);
      }catch(e){
        // todo: preserve exception location file/line number somehow?...
        return cb('failed invoking synchronizer reaction: ' + e);
      }

    },

    //-------------------------------------------------------------------------
    _reaction_sync_add: function(session, cmd, store, dsstate, cb) {

      var curitem = null;
      var item    = null;
      if ( store.agent.hierarchicalSync )
      {
        if ( cmd.targetParent )
          cmd.data.parent = cmd.targetParent;
        else if ( cmd.sourceParent )
          cmd.data.parent = session.hierlut[cmd.sourceParent];
      }

      var matcher = common.noop;
      if ( session.isServer && dsstate.mode == constant.ALERT_SLOW_SYNC )
      {
        // TODO: if the matched item is already mapped to another client-side
        //       object, then this should cancel the matching...
        matcher = function(cb) {
          store.agent.matchItem(cmd.data, function(err, match) {
            if ( err )
              return cb(err);
            if ( ! match || ! match.compare )
              return cb();
            curitem = match;
            if ( match.compare(cmd.data) == 0 )
              return cb();
            store.agent.mergeItems(curitem, cmd.data, null, function(err) {
              // TODO: if there is a common.ConflictError, set
              //       curitem to null and continue without error...
              if ( err )
                return cb(err);
              store.registerChange(curitem.id, constant.ITEM_MODIFIED,
                                   {changeSpec: cspec, excludePeerID: session.peer.id},
                                   cb);
            });
          });
        };
      }

      matcher(function(err) {
        if ( err )
          return cb(err);
        var adder = common.noop;
        if ( ! curitem )
          adder = function(cb) {
            store.agent.addItem(cmd.data, function(err, newitem) {
              if ( err )
                return cb(err);
              item = newitem;
              dsstate.stats.hereAdd += 1;
              store.registerChange(item.id, constant.ITEM_ADDED,
                                   {excludePeerID: session.peer.id}, cb);
            });
          };
        else
          item = curitem;
        return adder(function(err) {
          if ( err )
            return cb(err);

          if ( store.agent.hierarchicalSync )
            session.hierlut[cmd.source] = item.id;

          var ret = [state.makeCommand({
            name       : constant.CMD_STATUS,
            cmdID      : session.nextCmdID(),
            msgRef     : cmd.msgID,
            cmdRef     : cmd.cmdID,
            sourceRef  : cmd.source,
            statusOf   : cmd.name,
            statusCode : ( curitem
                           ? constant.STATUS_ALREADY_EXISTS
                           : constant.STATUS_ITEM_ADDED )
          })];

          if ( session.isServer )
          {
            return cb(new common.NotImplementedError('server-side sync'));
            // TODO: implement server-side...
            //     peerStore = adapter.peer.stores[session.dsstates[store.uri].peerUri]
            //     # todo: this is a bit of an abstraction violation...
            //     adapter._context._model.Mapping.q(store_id=peerStore.id, guid=item.id).delete()
            //     newmap = adapter._context._model.Mapping(store_id=peerStore.id, guid=item.id, luid=cmd.source)
            //     adapter._context._model.session.add(newmap)
          }
          else
          {
            ret.push(state.makeCommand({
              name       : constant.CMD_MAP,
              cmdID      : session.nextCmdID(),
              source     : store.uri,
              target     : dsstate.peerUri,
              sourceItem : item.id,
              targetItem : cmd.source
            }));
          }

          return cb(null, ret);
        });
      });

    },

  // #----------------------------------------------------------------------------
  // def getSourceMapping(self, adapter, session, cmdctxt, cmd, peerStore, luid):
  //   try:
  //     curmap = adapter._context._model.Mapping.q(store_id=peerStore.id, luid=luid).one()
  //     return str(curmap.guid)
  //   except NoResultFound:
  //     msg = 'unexpected "%s/%s" request for unmapped item ID: %r' % (cmdctxt, cmd.name, luid)
  //     log.warning(msg)
  //     # todo: this is a bit of a hack when cmdctxt == 'Status'...
  //     return state.Command(
  //       name       = constant.CMD_STATUS,
  //       cmdID      = session.nextCmdID(),
  //       msgRef     = cmd.msgID,
  //       cmdRef     = cmd.cmdID,
  //       sourceRef  = cmd.source,
  //       targetRef  = cmd.target,
  //       statusOf   = cmd.name if cmdctxt != constant.CMD_STATUS else cmdctxt,
  //       statusCode = constant.STATUS_COMMAND_FAILED,
  //       errorCode  = __name__ + '.' + self.__class__.__name__ + '.GSM.10',
  //       errorMsg   = msg,
  //       )

  // #----------------------------------------------------------------------------
  // def reaction_sync_replace(self, adapter, session, cmd, store):

  //   # TODO: handle hierarchical data...

  //   item = cmd.data
  //   if session.isServer:
  //     item.id = self.getSourceMapping(adapter, session, constant.CMD_SYNC,
  //                                     cmd, store.peer, cmd.source)
  //     if not isinstance(item.id, basestring):
  //       return [item.id]
  //   else:
  //     item.id = cmd.target

  //   dsstate = session.dsstates[store.uri]

  //   okcmd = state.Command(
  //     name       = constant.CMD_STATUS,
  //     cmdID      = session.nextCmdID(),
  //     msgRef     = cmd.msgID,
  //     cmdRef     = cmd.cmdID,
  //     targetRef  = cmd.target,
  //     sourceRef  = cmd.source,
  //     statusOf   = cmd.name,
  //     statusCode = constant.STATUS_OK,
  //     )

  //   if cmd._conflict is not None:
  //     try:
  //       if cmd._change.state == constant.ITEM_DELETED:
  //         raise common.ConflictError('item deleted')
  //       if cmd._change.changeSpec is None:
  //         raise common.ConflictError('no change tracking enabled - falling back to policy')
  //       cspec = store.agent.mergeItems(store.agent.getItem(item.id), item, cmd._change.changeSpec)
  //       log.info('merged conflicting changes for item ID %r' % (item.id,))
  //       dsstate.stats.hereMod += 1
  //       store.registerChange(item.id, constant.ITEM_MODIFIED,
  //                            changeSpec=cspec, excludePeerID=adapter.peer.id)
  //       okcmd.statusCode = constant.STATUS_CONFLICT_RESOLVED_MERGE
  //       # NOTE: *not* suppressing the change that is registered from server
  //       #       to client, since the merge may have resulted in an item that
  //       #       is not identical to the one on the client.
  //       return [okcmd]
  //     except common.ConflictError, e:
  //       # conflict types: client=mod/server=mod or client=mod/server=del
  //       if store.conflictPolicy == constant.POLICY_CLIENT_WINS:
  //         adapter._context._model.session.delete(cmd._change)
  //         dsstate.stats.merged += 1
  //         okcmd.statusCode = constant.STATUS_CONFLICT_RESOLVED_CLIENT_DATA
  //         if cmd._change.state == constant.ITEM_DELETED:
  //           # todo: this "re-creation" of a new item is detrimental to
  //           #       clients that are tracking changes to an item (for
  //           #       example, a SyncML svn client bridge...). but then, to
  //           #       them, this item may already have been deleted. ugh.
  //           dsstate.stats.hereMod += 1
  //           item = store.agent.addItem(item)
  //           peerStore = store.peer
  //           adapter._context._model.Mapping.q(store_id=peerStore.id, guid=item.id).delete()
  //           newmap = adapter._context._model.Mapping(store_id=peerStore.id,
  //                                                    guid=item.id,
  //                                                    luid=cmd.source)
  //           adapter._context._model.session.add(newmap)
  //           store.registerChange(item.id, constant.ITEM_ADDED,
  //                                excludePeerID=adapter.peer.id)
  //           return [okcmd]
  //         # falling back to standard handling...
  //       elif store.conflictPolicy == constant.POLICY_SERVER_WINS:
  //         dsstate.stats.merged += 1
  //         okcmd.statusCode = constant.STATUS_CONFLICT_RESOLVED_SERVER_DATA
  //         return [okcmd]
  //       else:
  //         # store.conflictPolicy == constant.POLICY_ERROR or other...
  //         dsstate.stats.peerErr    += 1
  //         dsstate.stats.conflicts  += 1
  //         cmd._conflict.errorMsg   += ', agent failed merge: ' + str(e)
  //         cmd._conflict.statusCode = constant.STATUS_UPDATE_CONFLICT
  //         cmd._conflict.errorCode  = common.fullClassname(self) + '.RSR.10'
  //         log.warning(cmd._conflict.errorMsg)
  //         dsstate.conflicts.append(str(item.id))
  //         return [cmd._conflict]

  //   # if store.agent.hierarchicalSync:
  //   #   session.hierlut[cmd.source] = item.id

  //   cspec = store.agent.replaceItem(item, reportChanges=session.isServer)
  //   dsstate.stats.hereMod += 1
  //   store.registerChange(item.id, constant.ITEM_MODIFIED,
  //                        changeSpec=cspec, excludePeerID=adapter.peer.id)
  //   return [okcmd]

  // #----------------------------------------------------------------------------
  // def reaction_sync_delete(self, adapter, session, cmd, store):
  //   status = constant.STATUS_OK
  //   if session.isServer:
  //     itemID = self.getSourceMapping(adapter, session, constant.CMD_SYNC,
  //                                    cmd, store.peer, cmd.source)
  //     if not isinstance(itemID, basestring):
  //       return [itemID]
  //     if cmd._conflict is not None:
  //       if store.conflictPolicy == constant.POLICY_CLIENT_WINS:
  //         adapter._context._model.session.delete(cmd._change)
  //         status = constant.STATUS_CONFLICT_RESOLVED_CLIENT_DATA
  //         session.dsstates[store.uri].stats.merged += 1
  //         # falling back to standard handling...
  //       elif store.conflictPolicy == constant.POLICY_SERVER_WINS:
  //         adapter._context._model.session.delete(cmd._change)
  //         store.peer.registerChange(itemID, constant.ITEM_ADDED)
  //         session.dsstates[store.uri].stats.merged += 1
  //         cmd._conflict.statusCode = constant.STATUS_CONFLICT_RESOLVED_SERVER_DATA
  //         cmd._conflict.errorCode  = None
  //         cmd._conflict.errorMsg   = None
  //         return [cmd._conflict]
  //       else:
  //         # a POLICY_ERROR policy should have been handled by the dispatch
  //         raise Exception('unexpected conflictPolicy: %r' % (store.conflictPolicy,))
  //   else:
  //     itemID = cmd.target
  //   store.agent.deleteItem(itemID)
  //   session.dsstates[store.uri].stats.hereDel += 1
  //   store.registerChange(itemID, constant.ITEM_DELETED, excludePeerID=adapter.peer.id)
  //   return [state.Command(
  //     name       = constant.CMD_STATUS,
  //     cmdID      = session.nextCmdID(),
  //     msgRef     = cmd.msgID,
  //     cmdRef     = cmd.cmdID,
  //     targetRef  = cmd.target,
  //     sourceRef  = cmd.source,
  //     statusOf   = cmd.name,
  //     # todo: should this return DELETE_WITHOUT_ARCHIVE instead of OK?...
  //     # statusCode = constant.STATUS_DELETE_WITHOUT_ARCHIVE,
  //     statusCode = status,
  //     )]

    //-------------------------------------------------------------------------
    // SYNCHRONIZATION PHASE: SETTLE
    //-------------------------------------------------------------------------

    //-------------------------------------------------------------------------
    settle: function(session, cmd, chkcmd, xnode, cb) {

      // TODO: remove the "xnode" parameter... it is a hack so that i can
      //       call badStatus() the same way as in protocol.js
      // todo: there is a bit of a disconnect between how action and reaction
      //       phases are called (for a list of commands), whereas the settle
      //       phase is called on a per-item basis... not ideal, but the protocol
      //       is really set up that way :(
      // TODO: check all valid values of ``data``...
      // todo: anything else in common?...
      // todo: trap errors...

      var func = this['_settle_' + cmd.name.toLowerCase()];
      if ( ! func )
        return cb(new common.ProtocolError('unexpected command "' + cmd.name + '"'));
      return func.call(this, session, cmd, chkcmd, xnode, cb);
    },

    //-------------------------------------------------------------------------
    _settle_add: function(session, cmd, chkcmd, xnode, cb) {

      if ( cmd.data != constant.STATUS_OK
           && cmd.data != constant.STATUS_ITEM_ADDED
           && cmd.data != constant.STATUS_ALREADY_EXISTS )
        return cb(badStatus(xnode));

      if ( cmd.data != constant.STATUS_ALREADY_EXISTS )
        session.info.dsstates[chkcmd.uri].stats.peerAdd += 1;

      var peerStore = session.peer.getStore(
        session.context.router.getTargetUri(
          session.adapter, session.peer, chkcmd.uri));

      // todo: this is *technically* subject to a race condition... but the
      //       same peer should really not be synchronizing at the same time...
      // todo: also potentially check Change.registered...
      // TODO: this could be solved by:
      //         a) never updating a Change record (only deleting and replacing)
      //         b) deleting Change records by ID instead of by store/item/state...

      var txn = session.context._db.transaction(null, 'readwrite');
      var objstore = txn.objectStore('change');
      storage.iterateCursor(
        objstore.index('store_id').openCursor(peerStore.id),
        function(value, key, cb) {
          if ( value.itemID != chkcmd.source || value.state != constant.ITEM_ADDED )
            return;
          storage.delete(objstore, value.itemID, cb);
        }, cb);
    },

  // #----------------------------------------------------------------------------
  // def settle_replace(self, adapter, session, cmd, chkcmd, xnode):
  //   if not session.isServer and cmd.data == constant.STATUS_UPDATE_CONFLICT:
  //     session.dsstates[chkcmd.uri].stats.hereErr   += 1
  //     session.dsstates[chkcmd.uri].stats.conflicts += 1
  //     return
  //   if cmd.data not in (constant.STATUS_OK,
  //                       constant.STATUS_CONFLICT_RESOLVED_MERGE,
  //                       constant.STATUS_CONFLICT_RESOLVED_CLIENT_DATA,
  //                       constant.STATUS_CONFLICT_RESOLVED_SERVER_DATA,
  //                       ):
  //     raise badStatus(xnode)
  //   if cmd.data in (constant.STATUS_CONFLICT_RESOLVED_MERGE,
  //                   constant.STATUS_CONFLICT_RESOLVED_CLIENT_DATA,
  //                   constant.STATUS_CONFLICT_RESOLVED_SERVER_DATA):
  //     session.dsstates[chkcmd.uri].stats.merged += 1
  //   if cmd.data != constant.STATUS_CONFLICT_RESOLVED_SERVER_DATA:
  //     session.dsstates[chkcmd.uri].stats.peerMod += 1
  //   peerStore = adapter.peer.stores[adapter.router.getTargetUri(chkcmd.uri)]
  //   locItemID = chkcmd.source
  //   # todo: handle hierarchical sync...
  //   if session.isServer and chkcmd.target is not None:
  //     locItemID = self.getSourceMapping(adapter, session, constant.CMD_STATUS,
  //                                       cmd, peerStore, chkcmd.target)
  //     if not isinstance(locItemID, basestring):
  //       return locItemID
  //   # todo: this is *technically* subject to a race condition... but the
  //   #       same peer should really not be synchronizing at the same time...
  //   # todo: also potentially check Change.registered...
  //   # TODO: this could be solved by:
  //   #         a) never updating a Change record (only deleting and replacing)
  //   #         b) deleting Change records by ID instead of by store/item/state...
  //   adapter._context._model.Change.q(
  //     store_id  = peerStore.id,
  //     itemID    = locItemID,
  //     state     = constant.ITEM_MODIFIED,
  //     ).delete()

  // #----------------------------------------------------------------------------
  // def settle_delete(self, adapter, session, cmd, chkcmd, xnode):
  //   if not session.isServer and cmd.data == constant.STATUS_UPDATE_CONFLICT:
  //     session.dsstates[chkcmd.uri].stats.hereErr   += 1
  //     session.dsstates[chkcmd.uri].stats.conflicts += 1
  //     return
  //   elif not session.isServer and cmd.data == constant.STATUS_CONFLICT_RESOLVED_MERGE:
  //     session.dsstates[chkcmd.uri].stats.hereDel   += 1
  //     session.dsstates[chkcmd.uri].stats.peerDel   += 1
  //     session.dsstates[chkcmd.uri].stats.merged    += 1
  //   elif not session.isServer and cmd.data == constant.STATUS_CONFLICT_RESOLVED_CLIENT_DATA:
  //     session.dsstates[chkcmd.uri].stats.peerDel   += 1
  //     session.dsstates[chkcmd.uri].stats.merged    += 1
  //   elif not session.isServer and cmd.data == constant.STATUS_CONFLICT_RESOLVED_SERVER_DATA:
  //     session.dsstates[chkcmd.uri].stats.merged    += 1
  //   elif cmd.data == constant.STATUS_ITEM_NOT_DELETED:
  //     # note: the reason that this *may* be ok is that some servers (funambol)
  //     #       will report ITEM_NOT_DELETED when the item did not exist, thus this
  //     #       is "alright"...
  //     # todo: perhaps this should be raised as an error if the
  //     #       remote peer != funambol?...
  //     log.warning('received ITEM_NOT_DELETED for DELETE command for URI "%s" item "%s"'
  //                 ' - assuming previous pending deletion executed',
  //                 chkcmd.uri, chkcmd.source)
  //   elif cmd.data == constant.STATUS_OK:
  //     session.dsstates[chkcmd.uri].stats.peerDel += 1
  //   else:
  //     raise badStatus(xnode)
  //   peerStore = adapter.peer.stores[adapter.router.getTargetUri(chkcmd.uri)]
  //   locItemID = chkcmd.source
  //   # todo: handle hierarchical sync...
  //   if chkcmd.target is not None:
  //     locItemID = self.getSourceMapping(adapter, session, constant.CMD_STATUS,
  //                                       cmd, peerStore, chkcmd.target)
  //     if not isinstance(locItemID, basestring):
  //       return locItemID
  //   # todo: this is *technically* subject to a race condition... but the
  //   #       same peer should really not be synchronizing at the same time...
  //   # todo: also potentially check Change.registered...
  //   # TODO: this could be solved by:
  //   #         a) never updating a Change record (only deleting and replacing)
  //   #         b) deleting Change records by ID instead of by store/item/state...
  //   adapter._context._model.Change.q(
  //     store_id  = peerStore.id,
  //     itemID    = locItemID,
  //     state     = constant.ITEM_DELETED,
  //     ).delete()


  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
