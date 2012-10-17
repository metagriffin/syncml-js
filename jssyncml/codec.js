// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

var _         = require('underscore');
var common    = require('./common');
var constants = require('./constants');
var ET        = require('elementtree');

//-----------------------------------------------------------------------------
exports.Codec = common.Base.extend({
  encode: function(xtree, cb) {
    throw new common.NotImplementedError();
  },
  decode: function(contentType, data, cb) {
    throw new common.NotImplementedError();
  },
});

//-----------------------------------------------------------------------------
_.extend(exports.Codec, {

  factory: function(codec) {
    if ( codec == constants.CODEC_XML )
      return new exports.XmlCodec()
    // TODO
    // if ( codec == constants.CODEC_WBXML )
    //   return exports.WbxmlCodec()
    throw new common.UnknownCodec('unknown or unimplemented codec "' + codec + '"')
  },

  autoEncode: function(contentType, xtree, cb) {
  },

  autoDecode: function(contentType, data, cb) {
  },

});

//-----------------------------------------------------------------------------
exports.XmlCodec = exports.Codec.extend({

  name: constants.CODEC_XML,

  encode: function(xtree, cb) {
    // todo: really enforce this charset...
    var ctype = constants.TYPE_SYNCML + '+' + this.name + '; charset=UTF-8';
    cb(ctype, ET.tostring(xtree));
  },

  decode: function(contentType, data, cb) {
    var expCT = constants.TYPE_SYNCML + '+' + this.name;
    if ( contentType.indexOf(expCT) != 0 )
      throw new common.ProtocolError(
        'received unexpected content-type "' + contentType + '" (expected "'
          + expCT + '")')
    cb(ET.parse(data));
  }

});

//-----------------------------------------------------------------------------
// TODO: implement wbxml...
// exports.WbXmlCodec = exports.Codec.extend({
//   encode: function(xtree, cb) {
//   },
//   decode: function(contentType, data, cb) {
//   }
// });

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
