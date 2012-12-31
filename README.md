syncml-js
=========

A pure javascript implementation of the SyncML adapter framework and
protocol.

Status
======

The ``syncml-js`` package is in "beta". That means that everything is
fully functional, however it has not had much real-world experience,
and therefore there are definitely bugs hidden here and there. Use
with caution, and *always* backup your data before doing anything (see
[sbt](https://npmjs.org/package/sbt) for a convenient backup tool that
uses this SyncML implementation).

Installation
============

This is the easy part, provided you have ``npm`` installed:

    npm install syncml-js

Note that ``syncml-js`` does not provide any command-line tools, so
you typically would list it in your package.json's "dependencies"
attribute and use it in your application.

Usage
=====

For in-depth discussion on how to use a SyncML protocol library,
please take a look at [pysyncml](http://pysyncml.org/): despite being
in python, it uses the same concepts and almost an identical
API. Basically, creating a SyncML client comprises the following
steps:

1. Create the actual data layer of where your data lives, how it is
   stored and formatted, and the mechanisms that users use to interact
   and manipulate it.

2. Create an "Adapter", which is responsible for actually
   communicating with a SyncML peer.

3. Create an "Agent", which implements an API that forms the bridge
   between your data layer and the SyncML adapter.

4. Ensure that changes made to the data layer are registered to the
   SyncML library.

5. Synchronize the adapter, using the ``adapter.sync()`` method for
   client-side initialization or ``adapter.handleRequest()`` for
   server-side request handling.

Here is a quick example of such a client, which assumes that the first
step, the local data layer, is implemented elsewhere.

``` js

if ( typeof(define) !== 'function' )
  var define = require('amdefine')(module);

define(['syncml-js', 'underscore', 'cascade'], function(syncml, _, cascade) {

  //---------------------------------------------------------------------------
  // define an agent class that is the bridge between your actual
  // data and the SyncML adapter protocol framework.

  var MyAgent = syncmljs.Agent.extend({

    constructor: function(options) {
      // constructor items
    },

    getContentTypes: function() {
      // returns the content-types that your agent supports
      return [
        new syncmljs.ContentTypeInfo('text/calendar', '2.0', {preferred: true}),
        new syncmljs.ContentTypeInfo('text/x-vcalendar', ['1.0', '1.1'])
      ];
    },

    dumpsItem: function(item, contentType, version, cb) {
      // serialize the item
      return cb(null, CONVERT-ITEM-TO-DATA [, CONTENT-TYPE [, VERSION ] ]);
    },

    loadsItem: function(data, contentType, version, cb) {
      // de-serialize an item
      var item = CONVERT-DATA-TO-ITEM;
      return cb(null, item);
    },

    getAllItems: function(cb) {
      // supplies a list of all existing items
      return cb(null, LIST);
    },

    addItem: function(item, cb) {
      // adds the new item to local storage -- it MUST also set
      // the `id` attribute of the new item
      return cb(null, ITEM-WITH-NEW-ID);
    },

    getItem: function(itemID, cb) {
      // fetches the item with the specified `itemID`
      return cb(null, ITEM);
    },

    replaceItem: function(item, reportChanges, cb) {
      // updates the local storage with the new item, replacing the
      // existing item with ID ``item.id``. if this agent is acting
      // as the server (usually `reportChanges` is then true), the
      // agent should provide a changeSpec string.
      return cb(null, CHANGESPEC);
    },

    deleteItem: function(itemID, cb) {
      // removes the item with the specified ID `itemID` from the
      // local storage.
      return cb(null);
    }

  });

  //---------------------------------------------------------------------------
  // create a SyncML adapter, which will be the object that actually
  // communicates and synchronizes your data with other SyncML peers.
  // this example shows how to create a client-side peer -- see the
  // full documentation for how to create a server-side peer.

  var context = new syncml.Context({
    // `storage` must point to an "IndexedDB" implementation. if
    // operating within a modern browser context, you can use
    // the IndexedDB implementation provided by the browser:
    storage: window.indexedDB,
    // you can namespace this context's data with the `prefix`
    // parameter:
    prefix:  'my-syncml-client',
  });


  var exit = function(err, exitcode) {
    util.error('[**] ERROR: ' + err);
    process.exit(exitcode);
    return;
  }

  context.getEasyClientAdapter({
    displayName: 'My Remote Calendar Database',
    devInfo: {
      devID               : 'a-globally-unique-identifier',
      devType             : syncml.DEVTYPE_WORKSTATION,
      manufacturerName    : 'syncml-js',
      modelName           : 'syncml-js.example.client',
      hierarchicalSync    : false
    },
    stores: [
      {
        uri          : 'cal',
        displayName  : 'Remote Calendar',
        maxGuidSize  : 32,
        maxObjSize   : 2147483647,
        agent        : new MyAgent(),
      }
    ],
    peer: {
      url      : 'https://example.com/sync',
      auth     : syncml.NAMESPACE_AUTH_BASIC,
      username : 'guest',
      password : 'guest'
    },
    // you can either specify how to bind local stores to the stores
    // on the server, or you can let syncml-js apply its best guess.
    // here, an example of how to bind the local "cal" datastore to
    // the server's "calendar" datastore:
    //
    //   routes: [
    //     [ 'cal', 'calendar' ],
    //   ]
  }, function(err, adapter, stores, peer) {
    if ( err )
      return exit(err, 20);

    // now the adapter is fully setup
    report_changes(adapter, stores[0], peer);

  });

  //---------------------------------------------------------------------------
  // with an adapter and peer setup, we can scan for local changes, report
  // them, and then start the synchronization. the "find_all_*" functions are
  // expected to be provided by your local data storage layer.

  var report_changes = function(adapter, store, peer) {

    find_all_add(function(items) {
      cascade(items, cascade.queue, function(item, cb) {
        store.registerChange(item.id, syncml.ITEM_ADDED, null, cb);

      }, function(err) {
        if ( err )
          return exit(err, 30);

        find_all_mod(function(items) {
          cascade(items, cascade.queue, function(item, cb) {
            store.registerChange(item.id, syncml.ITEM_MODIFIED, null, cb);

          }, function(err) {
            if ( err )
              return exit(err, 31);

            find_all_del(function(items) {
              cascade(items, cascade.queue, function(item, cb) {
                store.registerChange(item.id, syncml.ITEM_DELETED, null, cb);

              }, function(err) {
                if ( err )
                  return exit(err, 32);

                sync_peer(adapter, store, peer);

              });
            });
          });
        });
      });
    });
  };

  //---------------------------------------------------------------------------
  // now that all of the changes have been reported, we can actually do the
  // synchronization with a remote peer.

  var sync_peer = function(adapter, store, peer) {

    adapter.sync(peer, syncml.SYNCTYPE_AUTO, function(err, stats) {

      if ( err )
        return exit(err, 40);

      var stream = new syncml.Stream.extend({
        write: function(data) {
          util.print(data);
        }
      });

      syncml.describeStats(stats, stream, {
        title: 'Remote Calendar Sync Results'
      });

      process.exit(0);

    });
  };

});

```
