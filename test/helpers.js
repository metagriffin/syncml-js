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
  '../src/syncml-js/common',
  '../src/syncml-js/codec',
  '../src/syncml-js/storage',
  '../src/syncml-js/state'
], function(
  _,
  ET,
  sqlite3,
  indexeddbjs,
  diff,
  helpers,
  syncmljs,
  common,
  codec,
  storage,
  state
) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.matchers = {
    ok: function(expected) {
      var isOK = this.actual ? false : true;
      this.message = function () {
        if ( this.isNot )
          return 'Expected an error to have happened.';
        var json = JSON.stringify(this.actual);
        var msg = 'Did not expect error "' + this.actual + '"';
        if ( json != '' + this.actual )
          msg += ' (' + json + ')';
        return msg + '.';
      };
      return isOK;
    },
    toEqualXml: function (expected) {
      var notText  = this.isNot ? ' not' : '';
      var difftext = '.';
      var act      = exports.normXml(this.actual);
      var exp      = exports.normXml(expected);
      var isEqual  = act == exp;

      if ( ! isEqual )
      {
        if ( act && exp )
        {
          // todo: improve this "pretty-fying"...
          var srcxml = act.replace(/>\s*</g, '>\n<');
          var dstxml = exp.replace(/>\s*</g, '>\n<');
          difftext = diff.createPatch('xml', dstxml, srcxml, '(expected)', '(received)');
          var idx = difftext.indexOf('---');
          if ( idx >= 0 )
            difftext = difftext.substr(idx);
          difftext = difftext
            .replace(/\-\-\- xml\s*\(expected\)/, '--- expected')
            .replace(/\+\+\+ xml\s*\(received\)/, '+++ received');
          difftext = ', differences:\n' + difftext;
        }
      }

      this.message = function () {
        return 'Expected "' + this.actual + '"' + notText + ' to be "' + expected + '"' + difftext;
      };

      return isEqual;

    }
  };

  //---------------------------------------------------------------------------
  exports.TestStorage = common.Base.extend({

    constructor: function(options) {
      options = options || {};
      this._lastID = options.startID || 1000;
      this._items = {};
    },

    all: function(cb) {
      return cb(null, _.values(this._items));
    },

    add: function(item, cb) {
      item.id = '' + this._lastID;
      this._lastID += 1;
      this._items['' + item.id] = item;
      return cb(null, item);
    },

    get: function(itemID, cb) {
      if ( this._items['' + itemID] == undefined )
        return cb('no such item ID');
      return cb(null, this._items['' + itemID]);
    },

    replace: function(item, cb) {
      this._items['' + item.id] = item;
      return cb();
    },

    delete: function(itemID, cb) {
      delete this._items['' + itemID];
      return cb();
    }

  });

  //---------------------------------------------------------------------------
  exports.TestAgent = syncmljs.Agent.extend({

    constructor: function(options) {
      options = options || {};
      this._storage = options.storage || new exports.TestStorage(options);
    },

    getContentTypes: function() {
      return [
        new syncmljs.ContentTypeInfo('text/x-s4j-sifn', '1.1', {preferred: true}),
        new syncmljs.ContentTypeInfo('text/x-s4j-sifn', '1.0'),
        new syncmljs.ContentTypeInfo('text/plain', ['1.1', '1.0'])
      ];
    },

    dumpsItem: function(item, contentType, version, cb) {
      return cb(null, item.body);
    },

    loadsItem: function(data, contentType, version, cb) {
      var item = {body: data};
      return cb(null, item);
    },

    getAllItems: function(cb) { return this._storage.all(cb); },
    addItem: function(item, cb) { return this._storage.add(item, cb); },
    getItem: function(itemID, cb) { return this._storage.get(itemID, cb); },
    replaceItem: function(item, reportChanges, cb) {
      // todo: implement reportChanges
      // if ( reportChanges )
      //   return cb('changeSpec not expected on the client-side');
      this._storage.replace(item, cb);
    },
    deleteItem: function(itemID, cb) { return this._storage.delete(itemID, cb); }

  });

  //---------------------------------------------------------------------------
  exports.normXml = function(xml) {
    if ( ! xml )
      return xml;
    try{
      return ET.tostring(ET.parse(xml).getroot());
    }catch(e){
      return xml;
    }
  },

  //---------------------------------------------------------------------------
  exports.getMaxMemorySize = function() {
    // because of funambol, syncml-js always limits max-memory-size to 2GB...
    return 2147483647;
  };

  //---------------------------------------------------------------------------
  exports.getAddressSize = function() {
    return syncmljs.platformBits();
  };

  //---------------------------------------------------------------------------
  exports.now = function() {
    return Math.round((new Date()).getTime() / 1000);
  };

  //---------------------------------------------------------------------------
  exports.findXml = function(xml, xpath) {
    var xtree = ET.parse(xml).getroot();
    return xtree.findtext(xpath);
  };

  //---------------------------------------------------------------------------
  exports.ResponseCollector = function() {
    var self = this;
    this.contentTypes = [];
    this.contents = [];
    this.write = function(contentType, content, cb) {
      self.contentTypes.push(contentType);
      self.contents.push(content);
      cb();
    };
    return this;
  };

  //---------------------------------------------------------------------------
  exports.getPendingChanges = function(context, cb) {

    var changetab  = context._dbtxn.objectStore('change');
    var adaptertab = context._dbtxn.objectStore('adapter');
    storage.getAll(changetab, null, null, function(err, changes) {

      var ret = [];

      common.cascade(changes, function(change, cb) {

        var peer  = null;
        var store = null;


        storage.getAll(adaptertab, null, null, function(err, adapters) {

          if ( store )
            return;

          _.each(adapters, function(adapter) {
            if ( store )
              return;
            _.each(adapter.stores, function(curstore) {
              if ( store || curstore.id != change.store_id )
                return;
              peer  = adapter;
              store = curstore;
            });
            if ( store )
              return;
            _.each(adapter.peers, function(curpeer) {
              if ( store )
                return;
              _.each(curpeer.stores, function(curstore) {
                if ( store || curstore.id != change.store_id )
                  return;
                peer  = curpeer;
                store = curstore;
              });
            });
          });

          if ( store )
          {
            delete change.store_id;
            change.devid = peer.devID;
            change.uri   = store.uri;
          }

          ret.push(change);
          cb();

        });

      // var storeMapping = self._a._c._dbtxn.objectStore('change').index('store_id');
      // storage.getAll(storeMapping, self.id, null, function(err, changes) {
      //   if ( err )
      //     return cb(err);
      //   var change = _.find(changes, function(change) {
      //     return change.item_id == itemID;
      //   });
      //   return cb(null, change);
      // });

      // return cb(null, common.j(objects));

      }, function(err) {
        if ( err )
          return cb(err);

        var sort_changes = function(c1, c2) {
          if ( c1.store_id && c2.store_id )
            return common.cmp(c1.store_id, c2.store_id);
          if ( c1.store_id || c2.store_id )
            return c1.store_id ? 1 : -1;
          var ret = common.cmp(c1.devid, c2.devid);
          if ( ret != 0 )
            return ret;
          ret = common.cmp(c1.uri, c2.uri);
          if ( ret != 0 )
            return ret;
          ret = common.cmp(c1.item_id, c2.item_id);
          if ( ret != 0 )
            return ret;
          return common.cmp(c1.state, c2.state);
        };

        ret.sort(sort_changes);

        return cb(null, ret);
      });

    });
  };

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
