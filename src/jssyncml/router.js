// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// lib:  jssyncml.router
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
  './ctype',
  './storage'
], function(
  _,
  ET,
  logging,
  common,
  constant,
  ctype,
  storage
) {

  var log = logging.getLogger('jssyncml.router');
  var exports = {};

  //---------------------------------------------------------------------------
  exports.Router = common.Base.extend({

    //-------------------------------------------------------------------------
    constructor: function(options) {
    },

    //-------------------------------------------------------------------------
    getTargetUri: function(adapter, peer, sourceUri) {
      var pmodel = peer._getModel();
      for ( var idx=0 ; idx<pmodel.routes.length ; idx++ )
      {
        var route = pmodel.routes[idx];
        if ( route.localUri == sourceUri )
          return route.remoteUri;
      }
      for ( var idx=0 ; idx<pmodel.stores.length ; idx++ )
      {
        var store = pmodel.stores[idx];
        if ( store.binding && store.binding.uri == sourceUri )
          return store.uri;
      }
      return null;
    },

    //-------------------------------------------------------------------------
    recalculate: function(adapter, peer, cb) {
      // the non-"SmartRouter" only connects manually-configured routes...

      // available local URIs
      var lset = _.map(adapter._model.stores,
                       function(s) { return adapter.normUri(s.uri); });
      // available remote URIs
      var rset = _.map(peer._getModel().stores,
                       function(s) { return peer.normUri(s.uri); });
      // manual routes
      var routes = _.filter(peer._getModel().routes,
                            function(r) { return ! r.autoMapped; });

      var err = null;
      _.each(routes, function(route) {
        if ( err )
          return;

        route.localUri  = adapter.normUri(route.localUri);
        route.remoteUri = peer.normUri(route.remoteUri);

        if ( _.indexOf(rset, route.remoteUri) < 0
             || _.indexOf(lset, route.localUri) < 0 )
        {
          err = 'unable to route from "' + route.localUri
            + '" to "' + route.remoteUri
            + '": no such stores or already routed elsewhere';
          return;
        }

        lset = _.filter(lset, function(uri) { return uri != route.localUri; });
        rset = _.filter(rset, function(uri) { return uri != route.remoteUri; });

        log.debug('setting up route from "' + route.localUri + '" to "'
                  + route.remoteUri + '"');

        var smodel = peer.getStore(route.remoteUri)._getModel();
        if ( smodel.binding && smodel.binding.uri == route.localUri )
          return;
        smodel.binding = {
          uri          : route.localUri,
          autoMapped   : false,
          localAnchor  : null,
          remoteAnchor : null
        };
      });

      if ( err )
        return cb(err);

      return cb();
    },

    getBestTransmitContentType: function(session, uri) {
      log.critical('TODO ::: Router.getBestTransmitContentType NOT IMPLEMENTED');
      return ['text/plain', '1.1'];
    },

  });

  //---------------------------------------------------------------------------
  exports.SmartRouter = exports.Router.extend({

    //-------------------------------------------------------------------------
    recalculate: function(adapter, peer, cb) {

      log.critical('TODO ::: SmartRouter.recalculate() NOT IMPLEMENTED');
      return exports.Router.prototype.recalculate.call(this, adapter, peer, cb);

    },

  });

  return exports;

});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
