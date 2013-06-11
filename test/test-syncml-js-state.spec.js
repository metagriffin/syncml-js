// -*- coding: utf-8 -*-
//-----------------------------------------------------------------------------
// file: $Id$
// desc: unit test for the syncml-js/state module
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
  '../src/syncml-js/constant',
  '../src/syncml-js/common',
  '../src/syncml-js/state',
  '../src/syncml-js/logging',
  './helpers'
], function(_, ET, constant, common, state, logging, helpers) {

  describe('syncml-js/state', function() {

    var handler = new logging.ConsoleHandler();

    beforeEach(function () {
      logging.level = logging.WARNING;
      logging.getLogger().addHandler(handler);
      this.addMatchers(helpers.matchers);
    });

    afterEach(function() {
      logging.getLogger().removeHandler(handler);
    });

    it('isolates Stats member variables', function() {
      var s1 = state.makeStats();
      s1.hereAdd += 1;
      s1.hereAdd += 1;
      expect(s1.hereAdd).toEqual(2);
      var s2 = state.makeStats();
      s2.hereAdd += 1;
      s2.hereAdd += 1;
      expect(s2.hereAdd).toEqual(2);
    });

    //-------------------------------------------------------------------------
    it('describes stats in an ascii table without a title', function() {
      var buf   = new common.StringStream();
      var stats = {
        note: state.makeStats({mode: constant.SYNCTYPE_TWO_WAY, hereAdd: 10, peerDel: 2})
      };
      state.describeStats(stats, buf, {ascii: true});
      var chk = ''
        + '+--------+------+-----------------------+-----------------------+-----------+\n'
        + '|        |      |         Local         |        Remote         | Conflicts |\n'
        + '| Source | Mode | Add | Mod | Del | Err | Add | Mod | Del | Err | Col | Mrg |\n'
        + '+--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+\n'
        + '|   note |  <>  |  10 |  -  |  -  |  -  |  -  |  -  |   2 |  -  |  -  |  -  |\n'
        + '+--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+\n'
        + '|                  10 local changes and 2 remote changes.                   |\n'
        + '+---------------------------------------------------------------------------+\n'
      ;
      expect(buf.getData()).toEqual(chk);
    });

    //-------------------------------------------------------------------------
    it('describes stats in a fancy table without a title', function() {
      var buf   = new common.StringStream();
      var stats = {
        note: state.makeStats({mode: constant.SYNCTYPE_TWO_WAY, hereAdd: 1308, hereDel: 2}),
        contacts: state.makeStats({mode: constant.SYNCTYPE_REFRESH_FROM_SERVER, peerAdd: 10387})
      };
      state.describeStats(stats, buf);
      var chk = ''
        + '┌──────────┬──────┬─────────────────────────┬──────────────────────────┬───────────┐\n'
        + '│          │      │          Local          │          Remote          │ Conflicts │\n'
        + '│   Source │ Mode │  Add    Mod   Del   Err │  Add     Mod   Del   Err │ Col   Mrg │\n'
        + '├──────────┼──────┼───────┼─────┼─────┼─────┼────────┼─────┼─────┼─────┼─────┼─────┤\n'
        + '│ contacts │  <=  │       │     │     │     │ 10,387 │     │     │     │     │     │\n'
        + '│     note │  <>  │ 1,308 │     │   2 │     │        │     │     │     │     │     │\n'
        + '├──────────┴──────┴───────┴─────┴─────┴─────┴────────┴─────┴─────┴─────┴─────┴─────┤\n'
        + '│                  1,310 local changes and 10,387 remote changes.                  │\n'
        + '└──────────────────────────────────────────────────────────────────────────────────┘\n'
      ;
      expect(buf.getData()).toEqual(chk);
    });

//   #----------------------------------------------------------------------------
//   def test_describeStats_noTotals(self):
//     buf = sio()
//     stats = dict(note=adict(
//       mode=constants.SYNCTYPE_TWO_WAY,conflicts=0,merged=0,
//       hereAdd=10,hereMod=0,hereDel=0,hereErr=0,
//       peerAdd=0,peerMod=0,peerDel=2,peerErr=0))
//     common.describeStats(stats, buf, totals=False)
//     chk = '''
// +--------+------+-----------------------+-----------------------+-----------+
// |        |      |         Local         |        Remote         | Conflicts |
// | Source | Mode | Add | Mod | Del | Err | Add | Mod | Del | Err | Col | Mrg |
// +--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
// |   note |  <>  |  10 |  -  |  -  |  -  |  -  |  -  |   2 |  -  |  -  |  -  |
// +--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
// '''.lstrip()
//     self.assertMultiLineEqual(chk, buf.getvalue())

    //-------------------------------------------------------------------------
    it('describes stats in an ascii table with a title', function() {
      var buf   = new common.StringStream();
      var stats = {
        note: state.makeStats({mode: constant.SYNCTYPE_TWO_WAY, hereAdd: 10, peerDel: 2})
      };
      state.describeStats(stats, buf, {title: 'Synchronization Summary', ascii: true});
      var chk = ''
        + '+---------------------------------------------------------------------------+\n'
        + '|                          Synchronization Summary                          |\n'
        + '+--------+------+-----------------------+-----------------------+-----------+\n'
        + '|        |      |         Local         |        Remote         | Conflicts |\n'
        + '| Source | Mode | Add | Mod | Del | Err | Add | Mod | Del | Err | Col | Mrg |\n'
        + '+--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+\n'
        + '|   note |  <>  |  10 |  -  |  -  |  -  |  -  |  -  |   2 |  -  |  -  |  -  |\n'
        + '+--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+\n'
        + '|                  10 local changes and 2 remote changes.                   |\n'
        + '+---------------------------------------------------------------------------+\n'
      ;
      expect(buf.getData()).toEqual(chk);
    });

    //-------------------------------------------------------------------------
    it('describes stats in a fancy table with a title', function() {
      var buf   = new common.StringStream();
      var stats = {
        note: state.makeStats({mode: constant.SYNCTYPE_TWO_WAY, hereAdd: 1308, hereDel: 2}),
        contacts: state.makeStats({mode: constant.SYNCTYPE_REFRESH_FROM_SERVER, peerAdd: 10387})
      };
      state.describeStats(stats, buf, {title: 'Synchronization Summary'});
      var chk = ''
        + '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n'
        + '┃                             Synchronization Summary                              ┃\n'
        + '┡━━━━━━━━━━┯━━━━━━┯━━━━━━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━━━━━━━━━━━━━━━━┯━━━━━━━━━━━┩\n'
        + '│          │      │          Local          │          Remote          │ Conflicts │\n'
        + '│   Source │ Mode │  Add    Mod   Del   Err │  Add     Mod   Del   Err │ Col   Mrg │\n'
        + '├──────────┼──────┼───────┼─────┼─────┼─────┼────────┼─────┼─────┼─────┼─────┼─────┤\n'
        + '│ contacts │  <=  │       │     │     │     │ 10,387 │     │     │     │     │     │\n'
        + '│     note │  <>  │ 1,308 │     │   2 │     │        │     │     │     │     │     │\n'
        + '├──────────┴──────┴───────┴─────┴─────┴─────┴────────┴─────┴─────┴─────┴─────┴─────┤\n'
        + '│                  1,310 local changes and 10,387 remote changes.                  │\n'
        + '└──────────────────────────────────────────────────────────────────────────────────┘\n'
      ;
      expect(buf.getData()).toEqual(chk);
    });

//   #----------------------------------------------------------------------------
//   def test_describeStats_errors(self):
//     buf = sio()
//     stats = dict(note=adict(
//       mode=constants.SYNCTYPE_TWO_WAY,conflicts=0,merged=0,
//       hereAdd=10,hereMod=0,hereDel=0,hereErr=1,
//       peerAdd=0,peerMod=0,peerDel=1,peerErr=2))
//     common.describeStats(stats, buf, title='Synchronization Summary')
//     chk = '''
// +---------------------------------------------------------------------------+
// |                          Synchronization Summary                          |
// +--------+------+-----------------------+-----------------------+-----------+
// |        |      |         Local         |        Remote         | Conflicts |
// | Source | Mode | Add | Mod | Del | Err | Add | Mod | Del | Err | Col | Mrg |
// +--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
// |   note |  <>  |  10 |  -  |  -  |   1 |  -  |  -  |   1 |   2 |  -  |  -  |
// +--------+------+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+
// |              10 local changes, 1 remote change and 3 errors.              |
// +---------------------------------------------------------------------------+
// '''.lstrip()
//     self.assertMultiLineEqual(chk, buf.getvalue())

//   #----------------------------------------------------------------------------
//   def test_describeStats_multiwide(self):
//     buf = sio()
//     stats = dict(note=adict(
//       mode=constants.SYNCTYPE_SLOW_SYNC,conflicts=0,merged=0,
//       hereAdd=1308,hereMod=0,hereDel=2,hereErr=0,
//       peerAdd=0,peerMod=0,peerDel=0,peerErr=0),
//                  contacts=adict(
//       mode=constants.SYNCTYPE_REFRESH_FROM_SERVER,conflicts=0,merged=0,
//       hereAdd=0,hereMod=0,hereDel=0,hereErr=0,
//       peerAdd=10387,peerMod=0,peerDel=0,peerErr=0))
//     common.describeStats(stats, buf)
//     chk = '''
// +----------+------+-------------------------+--------------------------+-----------+
// |          |      |          Local          |          Remote          | Conflicts |
// |   Source | Mode |  Add  | Mod | Del | Err |  Add   | Mod | Del | Err | Col | Mrg |
// +----------+------+-------+-----+-----+-----+--------+-----+-----+-----+-----+-----+
// | contacts |  <=  |   -   |  -  |  -  |  -  | 10,387 |  -  |  -  |  -  |  -  |  -  |
// |     note |  SS  | 1,308 |  -  |   2 |  -  |   -    |  -  |  -  |  -  |  -  |  -  |
// +----------+------+-------+-----+-----+-----+--------+-----+-----+-----+-----+-----+
// |                  1,310 local changes and 10,387 remote changes.                  |
// +----------------------------------------------------------------------------------+
// '''.lstrip()
//     self.assertMultiLineEqual(chk, buf.getvalue())

//   #----------------------------------------------------------------------------
//   def test_describeStats_titleAndTotals(self):
//     buf = sio()
//     stats = dict(note=adict(
//       mode=constants.SYNCTYPE_SLOW_SYNC,conflicts=0,merged=0,
//       hereAdd=1308,hereMod=0,hereDel=2,hereErr=0,
//       peerAdd=0,peerMod=0,peerDel=0,peerErr=0),
//                  contacts=adict(
//       mode=constants.SYNCTYPE_REFRESH_FROM_SERVER,conflicts=0,merged=0,
//       hereAdd=0,hereMod=0,hereDel=0,hereErr=0,
//       peerAdd=10387,peerMod=0,peerDel=0,peerErr=0))
//     common.describeStats(stats, buf, title='Synchronization Summary', details=False)
//     chk = '''
// +------------------------------------------------+
// |            Synchronization Summary             |
// | 1,310 local changes and 10,387 remote changes. |
// +------------------------------------------------+
// '''.lstrip()
//     self.assertMultiLineEqual(chk, buf.getvalue())

//   #----------------------------------------------------------------------------
//   def test_describeStats_totals(self):
//     buf = sio()
//     stats = dict(note=adict(
//       mode=constants.SYNCTYPE_SLOW_SYNC,conflicts=0,merged=0,
//       hereAdd=1308,hereMod=0,hereDel=2,hereErr=0,
//       peerAdd=0,peerMod=0,peerDel=0,peerErr=0),
//                  contacts=adict(
//       mode=constants.SYNCTYPE_REFRESH_FROM_SERVER,conflicts=0,merged=0,
//       hereAdd=0,hereMod=0,hereDel=0,hereErr=0,
//       peerAdd=10387,peerMod=0,peerDel=0,peerErr=0))
//     common.describeStats(stats, buf, details=False)
//     chk = '''
// +------------------------------------------------+
// | 1,310 local changes and 10,387 remote changes. |
// +------------------------------------------------+
// '''.lstrip()
//     self.assertMultiLineEqual(chk, buf.getvalue())
//     stats['note'].merged    = 3
//     stats['note'].conflicts = 2
//     stats['note'].hereErr   = 2
//     buf = sio()
//     common.describeStats(stats, buf, details=False)
//     chk = '''
// +------------------------------------------------------------------------------------+
// | 1,310 local changes, 10,387 remote changes and 2 errors: 3 merges and 2 conflicts. |
// +------------------------------------------------------------------------------------+
// '''.lstrip()
//     self.assertMultiLineEqual(chk, buf.getvalue())

//     });

  });
});

//-----------------------------------------------------------------------------
// end of $Id$
//-----------------------------------------------------------------------------
