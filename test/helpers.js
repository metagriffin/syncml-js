// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the jssyncml module in client-mode
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
  'jsindexeddb',
  'diff',
  './helpers.js',
  '../src/jssyncml',
  '../src/jssyncml/common',
  '../src/jssyncml/state'
], function(_, ET, sqlite3, jsindexeddb, diff, helpers, jssyncml, common, state) {

  var exports = {};

  //---------------------------------------------------------------------------
  exports.matchers = {
    toEqualXml: function (expected) {

      var notText  = this.isNot ? ' not' : '';
      var isEqual  = true;
      var difftext = '.';
      var act      = ET.tostring(ET.parse(this.actual).getroot());
      var exp      = ET.tostring(ET.parse(expected).getroot());

      if ( act != exp )
      {
        isEqual = false;
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

      this.message = function () {
        return 'Expected "' + this.actual + notText + '" to be "' + expected + '"' + difftext;
      };

      return isEqual;

    }
  };

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
