
tests:
	jasmine-node --verbose test
#	mocha

serve:
	python -m SimpleHTTPServer 9000

bump:
	python bin/bumpversion.py

#------------------------------------------------------------------------------
# for the xpcshell-based unit tests to work, xpcshell must be available, which
# means the thunderbird development environment needs to be installed and
# working, as documented in:
#   https://developer.mozilla.org/en-US/docs/XPConnect/xpcshell
# and you must also set the following environment variables:
#   MOZOBJDIR  the compiled objectdir, eg path-to-mozdir/obj-x86_64-unknown-linux-gnu/mozilla
#   MOZDEVDIR  the uncompiled mozilla dir, eg path-to-mozdir/mozilla
#   SYNCMLDIR  here
# incidentally, the unit tests are based on mozilla unit tests found in:
#   path-to-mozdir/mozilla/_tests/xpcshell/dom/indexedDB/test/unit/test_put_get_values.js

MOZOBJDIR?=../thunderbird/obj-x86_64-unknown-linux-gnu/mozilla
MOZDEVDIR?=../thunderbird/mozilla
SYNCMLDIR?=.

xpc-ini:
	cat test/xpcshell.ini.IN > test/xpcshell.ini
	find test -iname 'test-*.spec.js' | cut -f2 -d/ \
	  | sed -re 's/(.*)/[\1]/' \
	  >> test/xpcshell.ini

xpc-run:
	$(MOZOBJDIR)/_virtualenv/bin/python \
          -u $(MOZDEVDIR)/config/pythonpath.py \
          -I$(MOZDEVDIR)/build \
          -I$(MOZOBJDIR)/_tests/mozbase/mozinfo \
          $(MOZDEVDIR)/testing/xpcshell/runxpcshelltests.py \
          --symbols-path=$(MOZOBJDIR)/dist/crashreporter-symbols \
          --build-info-json=$(MOZOBJDIR)/mozinfo.json \
          --tests-root-dir=$(SYNCMLDIR)/test \
          --testing-modules-dir=$(MOZOBJDIR)/_tests/modules \
          --xunit-file=$(MOZOBJDIR)/_tests/xpcshell/netwerk/test/results.xml \
          --xunit-suite-name=xpcshell \
          --test-plugin-path=$(MOZOBJDIR)/dist/plugins \
          $(MOZOBJDIR)/dist/bin/xpcshell \
          $(SYNCMLDIR)/test

xpc: xpc-ini xpc-run
