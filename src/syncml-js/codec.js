// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// auth: metagriffin <metagriffin@uberdev.org>
// date: 2012/10/13
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
  './constant'
], function(
  _,
  ET,
  logging,
  common,
  constant
) {

  var log = logging.getLogger('syncml-js.codec');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.Codec = common.Base.extend({

    encode: function(xtree, cb) {
      throw new common.NotImplementedError();
    },

    decode: function(contentType, data, cb) {
      throw new common.NotImplementedError();
    },
  }, {

    factory: function(codec) {
      // todo: should this be converted to callback-based?...
      if ( codec == constant.CODEC_XML )
        return new exports.XmlCodec()
      // TODO
      // if ( codec == constant.CODEC_WBXML )
      //   return exports.WbxmlCodec()
      throw new common.UnknownCodec('unknown or unimplemented codec "' + codec + '"')
    },

    autoEncode: function(xtree, codecName, cb) {
      exports.Codec.factory(codecName).encode(xtree, cb);
    },

    autoDecode: function(contentType, data, cb) {
      if ( contentType.indexOf(constant.TYPE_SYNCML + '+') != 0 )
        return cb('unknown or unimplemented content type "' + contentType + '"');
      var ct = contentType.slice((constant.TYPE_SYNCML + '+').length).split(';')[0];
      exports.Codec.factory(ct).decode(contentType, data, function(err, tree) {
        if ( err )
          return cb(err);
        return cb(null, tree, ct);
      });
    },
  });

  //---------------------------------------------------------------------------
  exports.XmlCodec = exports.Codec.extend({

    name: constant.CODEC_XML,

    encode: function(xtree, cb) {
      // todo: really enforce this charset...
      var ctype = constant.TYPE_SYNCML + '+' + this.name + '; charset=UTF-8';
      cb(null, ctype, ET.tostring(xtree));
    },

    decode: function(contentType, data, cb) {
      var expCT = constant.TYPE_SYNCML + '+' + this.name;
      if ( contentType.indexOf(expCT) != 0 )
        cb(new common.ProtocolError(
          'received unexpected content-type "' + contentType + '" (expected "'
            + expCT + '")'));
      try
      {
        return cb(null, ET.parse(data).getroot());
      }
      catch(e)
      {
        return cb(new common.ProtocolError('could not parse XML: ' + e, e));
      }
    }

  });

  //---------------------------------------------------------------------------
  // TODO: implement wbxml...
  // exports.WbXmlCodec = exports.Codec.extend({
  //   encode: function(xtree, cb) {
  //   },
  //   decode: function(contentType, data, cb) {
  //   }
  // });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
