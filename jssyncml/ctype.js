// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

var _         = require('underscore');
var ET        = require('elementtree');
var common    = require('./common');
var constants = require('./constants');

//-----------------------------------------------------------------------------
exports.ContentTypeInfo = common.Base.extend({

  //---------------------------------------------------------------------------
  constructor: function(ctype, versions, options) {
    this.ctype    = ctype;
    this.versions = _.isArray(versions) ? versions : [versions];
    _.defaults(this, options || {}, {
      preferred: false,
      transmit:  true,
      receive:   true,
    });
  },

  //---------------------------------------------------------------------------
  merge: function(other) {
    if ( this.ctype != other.ctype
         || ! _.isEqual(this.versions, other.versions)
         || this.preferred != other.preferred )
      return false;
    this.transmit = this.transmit || other.transmit;
    this.receive  = this.receive  || other.receive;
    return true
  },


  //---------------------------------------------------------------------------
  toSyncML: function(nodeName, uniqueVerCt, cb) {
    if ( _.isFunction(nodeName) )
    {
      cb = nodeName;
      nodeName = null;
    }
    else if ( _.isFunction(uniqueVerCt) )
    {
      cb = uniqueVerCt;
      uniqueVerCt = null;
    }
    if ( ! nodeName )
    {
      nodeName = this.transmit ? 'Tx' : 'Rx';
      if ( this.preferred )
        nodeName += '-Pref';
    }
    if ( uniqueVerCt )
    {
      var ret = _.map(this.versions, function(v) {
        var tmp = ET.Element(nodeName);
        ET.SubElement(tmp, 'CTType').text = this.ctype;
        ET.SubElement(tmp, 'VerCT').text = v;
        return tmp;
      }, this);
      return cb(ret);
    }
    var ret = ET.Element(nodeName);
    ET.SubElement(ret, 'CTType').text = this.ctype;
    _.each(this.versions, function(v) {
      ET.SubElement(ret, 'VerCT').text = v;
    });
    return cb(ret);
  },

}, {

  //---------------------------------------------------------------------------
  fromSyncML: function(xnode, cb) {
    cb(new exports.ContentTypeInfo(
      xnode.findtext('CTType'),
      _.map(xnode.findall('VerCT'), function(e) { return e.text; }),
      {
        preferred: xnode.tag.match('-Pref$') != undefined,
        transmit:  xnode.tag.indexOf('Tx') >= 0,
        receive:   xnode.tag.indexOf('Rx') >= 0
      }
    ));
  }

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
