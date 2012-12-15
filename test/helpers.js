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
  '../src/syncml-js/state'
], function(_, ET, sqlite3, indexeddbjs, diff, helpers, syncmljs, common, codec, state) {

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
  exports.TestAgent = syncmljs.Agent.extend({

    constructor: function(options) {
      options = options || {};
      this._lastID = options.startID || 1000;
      this._items = {};
    },

    dumpsItem: function(item, contentType, version, cb) {
      cb(null, item.body);
    },

    loadsItem: function(data, contentType, version, cb) {
      var item = {body: data};
      cb(null, item);
    },

    getAllItems: function(cb) {
      return cb(null, _.values(this._items));
    },

    addItem: function(item, cb) {
      item.id = '' + this._lastID;
      this._lastID += 1;
      this._items['' + item.id] = item;
      cb(null, item);
    },

    getItem: function(itemID, cb) {
      if ( this._items['' + itemID] == undefined )
        cb('no such item ID');
      cb(null, this._items['' + itemID]);
    },

    replaceItem: function(item, reportChanges, cb) {
      if ( reportChanges )
        cb('changeSpec not expected on the client-side');
      this._items['' + item.id] = item;
      cb();
    },

    deleteItem: function(itemID, cb) {
      delete this._items['' + itemID];
      cb();
    },

    getContentTypes: function() {
      return [
        new syncmljs.ContentTypeInfo('text/x-s4j-sifn', '1.1', {preferred: true}),
        new syncmljs.ContentTypeInfo('text/x-s4j-sifn', '1.0'),
        new syncmljs.ContentTypeInfo('text/plain', ['1.1', '1.0'])
      ];
    },

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

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
