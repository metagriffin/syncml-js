// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  syncml-js.store
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
  './storage'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  codec,
  ctype,
  storage
) {

  var log = logging.getLogger('syncml-js.store');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.Store = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(adapter, options) {

      // todo: some of these attributes should be modifiable...

      //: for local stores, specifies the agent that will implement
      //: the actual item operations -- it must implement the
      //: syncml-js.Agent API.
      this.agent = options.agent || null;

      //: [read-only] specifies the SyncML URI that this store is bound to.
      this.uri = ( adapter ? adapter.normUri(options.uri) : options.uri ) || null;

      //: [read-only] specifies the human-readable name for this store.
      //: if undefined, defaults to URI.
      this.displayName = options.displayName || this.uri || null;

      //: [read-only] specifies the maximum GUID size for items in this store.
      //: if undefined, defaults to adapter setting.
      this.maxGuidSize = options.maxGuidSize || null;

      //: [read-only] specifies the maximum object size for items in this store.
      //: if undefined, defaults to adapter setting.
      this.maxObjSize = options.maxObjSize || null;

      //: [read-only] specifies conflict resolution policy for this store.
      //: if undefined, defaults to adapter setting.
      this.conflictPolicy = options.conflictPolicy || null;

      //: [read-only] specifies which syncTypes this store supports.
      //: (defaults to all.)
      this.syncTypes = options.syncTypes;
      if ( this.syncTypes == undefined || this.syncTypes.length <= 0 )
      {
        this.syncTypes = [
          constant.SYNCTYPE_TWO_WAY,
          constant.SYNCTYPE_SLOW_SYNC,
          constant.SYNCTYPE_ONE_WAY_FROM_CLIENT,
          constant.SYNCTYPE_REFRESH_FROM_CLIENT,
          constant.SYNCTYPE_ONE_WAY_FROM_SERVER,
          constant.SYNCTYPE_REFRESH_FROM_SERVER,
          constant.SYNCTYPE_SERVER_ALERTED,
        ];
      }

      ctypes = options.contentTypes;
      if ( ! ctypes && options.agent )
        ctypes = options.agent.getContentTypes();

      this.contentTypes = _.map(ctypes, function(e) {
        if ( e instanceof ctype.ContentTypeInfo )
          return e;
        return ctype.ContentTypeInfo.fromStruct(e);
      });

      // --- private attributes
      this.id       = options.id || common.makeID();
      this._a       = adapter;
    },

    //-------------------------------------------------------------------------
    _load: function(cb) {
      cb();
    },

    //-------------------------------------------------------------------------
    _getModel: function() {
      var self = this;
      var uri  = self._a.normUri(self.uri);
      return _.find(this._a._getModel().stores,
                    function(s) { return self._a.normUri(s.uri) == uri; });
    },

    //-------------------------------------------------------------------------
    _updateModel: function(cb) {
      if ( ! this._a._model || ! this._a._model.stores )
        return cb('store created on un-initialized adapter');
      // TODO: this squashes any data that may already be there, such
      //       as *BINDING* info!...
      this._a._model.stores = _.filter(this._a._model.stores, function(e) {
        return e.uri != this.uri;
      }, this);
      this._a._model.stores.push({
        id              : this.id,
        uri             : this.uri,
        displayName     : this.displayName,
        syncTypes       : this.syncTypes,
        maxGuidSize     : this.maxGuidSize,
        maxObjSize      : this.maxObjSize,
        conflictPolicy  : this.conflictPolicy,
        contentTypes    : _.map(this.contentTypes, function(e) { return e.toStruct(); })
      });
      cb();
    },

    //-------------------------------------------------------------------------
    _getBinding: function() {
      return this._getModel().binding;
    },

    //-------------------------------------------------------------------------
    _setBinding: function(binding) {
      this._getModel().binding = binding;
    },

    //-------------------------------------------------------------------------
    getContentTypes: function() {
      if ( this.agent != undefined )
        return this.agent.getContentTypes();
      return this.contentTypes;
    },

    //-------------------------------------------------------------------------
    getPeerStore: function(peer) {

      if ( this._a.isLocal )
      {
        var peerUri = this._a._c.router.getTargetUri(this._a, peer, this.uri);
        if ( ! peerUri )
          return null;

        log.warning('TODO ::: Store.getPeerStore NOT IMPLEMENTED');

        return null;
      }

      log.warning('TODO ::: Store.getPeerStore NOT IMPLEMENTED');

      return null;

    },

    //-------------------------------------------------------------------------
    merge: function(store, cb) {

      log.critical('TODO ::: ensure that an adapter._save (at session end) saves merged info');

      if ( this.uri != store.uri )
        return cb(new common.InternalError(
          'unexpected merging of stores with different URIs ("' + this.uri
            + '" != "' + store.uri + '")'));
      if ( ! _.isEqual(this.contentTypes, store.contentTypes) )
      {
        // todo: this is a bit drastic... perhaps have an operational setting
        //       which controls how paranoid to be?...
        this._setBinding(null);
      }
      this.displayName    = store.displayName;
      this.contentTypes   = _.rest(store.contentTypes, 0);
      this.syncTypes      = _.rest(store.syncTypes, 0);
      this.maxGuidSize    = store.maxGuidSize;
      this.maxObjSize     = store.maxObjSize;
      this.agent          = store.agent;
      this.conflictPolicy = store.conflictPolicy;
      return cb();
    },

    //-------------------------------------------------------------------------
    _clearAllMappings: function(cb) {
      if ( this._a.isLocal )
        return cb(new common.InternalError(
          'unexpected mapping request for local store'));
      var mapping = this._a._c._dbtxn.objectStore('mapping');
      storage.deleteAll(mapping, {store_id: this.id}, cb);
    },

    //-------------------------------------------------------------------------
    _setMapping: function(guid, luid, cb) {
      var self = this;
      if ( this._a.isLocal )
        return cb(new common.InternalError(
          'unexpected mapping request for local store'));
      // delete all previous mappings for this guid/store (there should
      // be at most one)... but paranoia rules.
      var mapping = this._a._c._dbtxn.objectStore('mapping');
      storage.deleteAll(mapping, {store_id: this.id, guid: guid}, function(err) {
        if ( err )
          return cb(err);
        storage.put(mapping, {store_id: self.id, guid: guid, luid: luid}, function(err) {
          if ( err )
            return cb(err);
          cb();
        });
      });
    },

    //-------------------------------------------------------------------------
    _getMapping: function(guid, cb) {
      if ( this._a.isLocal )
        return cb(new common.InternalError(
          'unexpected mapping request for local store'));
      // todo: there must be a way to use IndexedDB since i have everything
      //       needed to generate the keyPath!... eg:
      //         objectStore.get({store_id:X,guid:Y})?...
      var storeMapping = this._a._c._dbtxn.objectStore('mapping').index('store_id');
      storage.getAll(storeMapping, this.id, null, function(err, list) {
        if ( err )
          return cb(err);
        var item = _.find(list, function(item) {
          return item.guid == guid;
        });
        return cb(null, item ? item.luid : null);
      });
    },

    //-------------------------------------------------------------------------
    _getReverseMapping: function(luid, cb) {
      if ( this._a.isLocal )
        return cb(new common.InternalError(
          'unexpected mapping request for local store'));
      // todo: there must be a way to use IndexedDB since i have everything
      //       needed to generate the keyPath!... eg:
      //         objectStore.get({store_id:X,guid:Y})?...
      var storeMapping = this._a._c._dbtxn.objectStore('mapping').index('store_id');
      storage.getAll(storeMapping, this.id, null, function(err, list) {
        if ( err )
          return cb(err);
        var item = _.find(list, function(item) {
          return item.luid == luid;
        });
        return cb(null, item ? item.guid : null);
      });
    },

    //-------------------------------------------------------------------------
    registerChange: function(itemID, state, options, cb) {
      // options can include:
      //   - changeSpec (bool)
      //   - excludePeerID (string)
      options = options || {};
      var self = this;
      if ( self._a.isLocal )
      {
        // TODO: THIS NEEDS TO BE SIGNIFICANTLY OPTIMIZED!... either:
        //         a) optimize this reverse lookup, or
        //         b) use a query that targets exactly the set of stores needed
        //       note that a pre-emptive model.session.flush() may be necessary.
        common.cascade(self._a.getPeers(), function(peer, cb) {
          if ( options.excludePeerID && options.excludePeerID == peer.id )
            return cb();
          common.cascade(peer.getStores(), function(store, cb) {
            var binding = store._getBinding()
            if ( ! binding || binding.uri != self.uri )
              return cb();
            store.registerChange(itemID, state, options, cb);
          }, cb);
        }, cb);
        return;
      }

      itemID = '' + itemID;
      var change = null;

      var update_change = ( ! options.changeSpec ) ? common.noop : function(cb) {
        // todo: there must be a way to use IndexedDB since i have everything
        //       needed to generate the keyPath!... eg:
        //         objectStore.get({store_id:X,guid:Y})?...
        // todo: perhaps switch to using self._getChange() ?...
        var storeMapping = self._a._c._dbtxn.objectStore('change').index('store_id');
        storage.getAll(storeMapping, self.id, null, function(err, changes) {
          if ( err )
            return cb(err);
          change = _.find(changes, function(change) {
            return change.item_id == itemID;
          });
          if ( ! change)
            return cb();
          change.state = state;
          if ( change.changeSpec )
            change.changeSpec += ';' + options.changeSpec;
          storage.put(
            self._a._c._dbtxn.objectStore('change'),
            change,
            cb);
        });
      };

      update_change(function(err) {
        if ( err )
          return cb(err);
        if ( change )
          return cb();
        // todo: is this deleteAll really necessary?... paranoia rules!
        var changeTab = self._a._c._dbtxn.objectStore('change');
        change = {store_id: self.id, item_id: itemID};
        storage.deleteAll(changeTab, change, function(err) {
          if ( err )
            return cb(err);
          change.state = state;
          change.changeSpec = options.changeSpec;
          storage.put(changeTab, change, cb);
        });
      });
    },

    //-------------------------------------------------------------------------
    _getChange: function(itemID, cb) {
      // returns cb(null, CHANGE)
      // change ::= { store_id: ID, item_id: GUID, state: STATE, changeSpec: SPEC }
      var self = this;
      var storeMapping = self._a._c._dbtxn.objectStore('change').index('store_id');
      storage.getAll(storeMapping, self.id, null, function(err, changes) {
        if ( err )
          return cb(err);
        var change = _.find(changes, function(change) {
          return change.item_id == itemID;
        });
        return cb(null, change);
      });
    },

    //-------------------------------------------------------------------------
    _delChange: function(options, cb) {
      // - if options is null/empty, delete all changes recorded
      //   for this store

      // // todo: this is *technically* subject to a race condition... but the
      // //       same peer should really not be synchronizing at the same time...
      // // todo: also potentially check Change.registered...
      // // TODO: this could be solved by:
      // //         a) never updating a Change record (only deleting and replacing)
      // //         b) deleting Change records by ID instead of by store/item/state...

      // var objstore = session.context._dbtxn.objectStore('change');
      // storage.iterateCursor(
      //   objstore.index('store_id').openCursor(peerStore.id),
      //   function(value, key, cb) {
      //     if ( value.itemID != chkcmd.source || value.state != constant.ITEM_ADDED )
      //       return;
      //     storage.delete(objstore, key, cb);
      //   }, cb);

      var dbstore = this._a._c._dbtxn.objectStore('change');
      var matches = {store_id: this.id};
      if ( options.itemID )
        matches.item_id = options.itemID;
      if ( options.state )
        matches.state = options.state;
      storage.deleteAll(dbstore, matches, cb);
    },

    //-------------------------------------------------------------------------
    toSyncML: function() {
      var xstore = ET.Element('DataStore')
      if ( this.uri )
        ET.SubElement(xstore, 'SourceRef').text = this.uri;
      if ( this.displayName )
        ET.SubElement(xstore, 'DisplayName').text = this.displayName;
      if ( this.maxGuidSize )
      {
        // todo: this should ONLY be sent by the client... (according to the
        //       spec, but not according to funambol behavior...)
        ET.SubElement(xstore, 'MaxGUIDSize').text = this.maxGuidSize;
      }
      if ( this.maxObjSize )
        ET.SubElement(xstore, 'MaxObjSize').text = this.maxObjSize;

      var ctypes = this.getContentTypes();

      if ( ctypes && ctypes.length > 0 )
      {
        var pref = _.filter(ctypes, function(ct) { return ct.receive && ct.preferred; });

        // todo: should i just take the first one?...
        if ( pref.length > 1 )
          throw new Error('agents can prefer at most one receive content-type');

        if ( pref.length == 1 )
        {
          pref = pref[0].toSyncML('Rx', true);
          pref[0].tag = 'Rx-Pref';
          _.each(pref, function(xnode) { xstore.append(xnode); });
        }

        _.each(
          _.filter(ctypes, function(ct) { return ct.receive && ! ct.preferred; }),
          function(ct) {
            _.each(ct.toSyncML('Rx', true), function(xnode) {
              xstore.append(xnode);
            });
          });

        var pref = _.filter(ctypes, function(ct) { return ct.transmit && ct.preferred; });

        // todo: should i just take the first one?...
        if ( pref.length > 1 )
          throw new Error('agents can prefer at most one transmit content-type');

        if ( pref.length == 1 )
        {
          pref = pref[0].toSyncML('Tx', true);
          pref[0].tag = 'Tx-Pref';
          _.each(pref, function(xnode) { xstore.append(xnode); });
        }

        _.each(
          _.filter(ctypes, function(ct) { return ct.transmit && ! ct.preferred; }),
          function(ct) {
            _.each(ct.toSyncML('Tx', true), function(xnode) {
              xstore.append(xnode);
            });
          });

      }

      if ( this.syncTypes && this.syncTypes.length > 0 )
      {
        var xcap = ET.SubElement(xstore, 'SyncCap');
        for ( var idx=0 ; idx<this.syncTypes.length ; idx++ )
          ET.SubElement(xcap, 'SyncType').text = this.syncTypes[idx];
      }
      return xstore;

    },

    describe: function(stream, cb) {
      stream.writeln('URI: ' + this.uri);
      stream.writeln('Max ID size: ' + ( this.maxGuidSize || '(none)' ));
      stream.writeln('Max object size: ' + ( this.maxObjSize || '(none)' ));

      //      print >>s2, 'Sync types:', ','.join([str(e) for e in self.syncTypes or []])

      var cts = this.getContentTypes();
      if ( cts.length <= 0 )
      {
        stream.writeln('Capabilities: (none)');
        return cb();
      }
      stream.writeln('Capabilities:');
      var s1 = new common.IndentStream(stream);
      common.cascade(cts, function(ct, cb) {
        s1.write('- ');
        ct.describe(s1);
        return cb();
      }, cb);
    }

  }, {

    //-------------------------------------------------------------------------
    fromSyncML: function(xnode) {
      var options = {
        uri          : xnode.findtext('SourceRef'),
        displayName  : xnode.findtext('DisplayName'),
        maxGuidSize  : common.parseInt(xnode.findtext('MaxGUIDSize')),
        maxObjSize   : common.parseInt(xnode.findtext('MaxObjSize')),
        contentTypes : [],
        syncTypes    : _.map(xnode.findall('SyncCap/SyncType'), function(e) {
          return common.parseInt(e.text);
        })
      };
      _.each(xnode.getchildren(), function(child) {
        if ( _.indexOf(['Rx-Pref', 'Rx', 'Tx-Pref', 'Tx'], child.tag) < 0 )
          return;
        var cti = ctype.ContentTypeInfo.fromSyncML(child);
        var merged = false;
        _.each(options.contentTypes, function(ct) {
          if ( merged )
            return;
          if ( ct.merge(cti) )
            merged = true;
        });
        if ( ! merged )
          options.contentTypes.push(cti);
      });
      return new exports.Store(null, options);
    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
