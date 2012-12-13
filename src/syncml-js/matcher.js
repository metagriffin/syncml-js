// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  syncml-js.matcher
// auth: griffin <griffin@uberdev.org>
// date: 2012/12/05
// copy: (C) CopyLoose 2012 UberDev <hardcore@uberdev.org>, No Rights Reserved.
//-----------------------------------------------------------------------------

// for node compatibility...
if ( typeof(define) !== 'function')
  var define = require('amdefine')(module);

define([
  'underscore',
  './logging',
  './common'
], function(
  _,
  logging,
  common
) {

  var log = logging.getLogger('syncml-js.matcher');
  var exports = {};

  //---------------------------------------------------------------------------
  exports._cntpref = function(source, target) {
    return ( source.preferred ? 1 : 0 ) + ( target.preferred ? 1 : 0 );
  };

  //---------------------------------------------------------------------------
  exports._pickTransmitContentType = function(source, target, prefcnt, checkVersion) {
    for ( var sidx=0 ; sidx<source.length ; sidx++ )
    {
      var sct = source[sidx];
      for ( var tidx=0 ; tidx<target.length ; tidx++ )
      {
        var tct = target[tidx];
        if ( sct.ctype != tct.ctype )
          continue;
        if ( ! checkVersion )
        {
          if ( exports._cntpref(sct, tct) >= prefcnt )
            return [sct.ctype, sct.versions[sct.versions.length - 1]];
          continue;
        }
        for ( var svidx=sct.versions.length ; svidx>0 ; svidx-- )
        {
          var sv = sct.versions[svidx - 1]
          for ( var tvidx=tct.versions.length ; tvidx>0 ; tvidx-- )
          {
            var tv = tct.versions[tvidx - 1]
            if ( sv != tv )
              continue;
            if ( exports._cntpref(sct, tct) >= prefcnt )
              return [sct.ctype, sv];
          }
        }
      }
    }
    return null;
  };

  //---------------------------------------------------------------------------
  exports.pickTransmitContentType = function(source, target) {

    // TODO: this is probably not the most efficient algorithm!...
    //       (but it works... ;-)

    // order of preference:
    //   - transmit => receive, BOTH preferred, VERSION match
    //   - transmit => receive, ONE preferred, VERSION match
    //   - transmit => receive, neither preferred, VERSION match
    //   - transmit => receive, BOTH preferred, no version match
    //   - transmit => receive, ONE preferred, no version match
    //   - transmit => receive, neither preferred, no version match
    //   - tx/rx => tx/rx, BOTH preferred, VERSION match
    //   - tx/rx => tx/rx, ONE preferred, VERSION match
    //   - tx/rx => tx/rx, neither preferred, VERSION match
    //   - tx/rx => tx/rx, BOTH preferred, no version match
    //   - tx/rx => tx/rx, ONE preferred, no version match
    //   - tx/rx => tx/rx, neither preferred, no version match

    // todo: make it explicit (or overrideable) that i am depending on the ordering
    //       of the versions supported to give an indicator of preference...

    var sct = source.getContentTypes();
    var tct = target.getContentTypes();

    var fct = function(cts, transmit) {
      return _.filter(cts, function(ct) {
        return transmit ? ct.transmit : ct.receive;
      });
    };

    return exports._pickTransmitContentType(fct(sct, true), fct(tct, false), 2, true)
      || exports._pickTransmitContentType(fct(sct, true), fct(tct, false), 1, true)
      || exports._pickTransmitContentType(fct(sct, true), fct(tct, false), 0, true)
      || exports._pickTransmitContentType(fct(sct, true), fct(tct, false), 2, false)
      || exports._pickTransmitContentType(fct(sct, true), fct(tct, false), 1, false)
      || exports._pickTransmitContentType(fct(sct, true), fct(tct, false), 0, false)
      || exports._pickTransmitContentType(sct, tct, 2, true)
      || exports._pickTransmitContentType(sct, tct, 1, true)
      || exports._pickTransmitContentType(sct, tct, 0, true)
      || exports._pickTransmitContentType(sct, tct, 2, false)
      || exports._pickTransmitContentType(sct, tct, 1, false)
      || exports._pickTransmitContentType(sct, tct, 0, false)
      || null;

  };

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
