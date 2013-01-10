#!/usr/bin/env python
import os, sys, json, distutils.version as version
pkgdir = os.path.dirname(os.path.dirname(__file__))
with open(os.path.join(pkgdir, 'package.json'), 'rb') as fp:
  data = fp.read()
pkg = json.loads(data)
ver = version.StrictVersion(pkg['version'])
old = '.'.join([str(e) for e in ver.version])
new = list(ver.version)
new[-1] += 1
new = '.'.join([str(e) for e in new])
with open(os.path.join(pkgdir, 'src/syncml-js.js'), 'rb') as fp:
  libdata = fp.read()
if old not in libdata:
  print >>sys.stderr, '[**] ERROR: current package version "%s" not found in syncml-js.js... aborting!' % (old,)
  sys.exit(10)
data = data.replace(old, new)
libdata = libdata.replace(old, new)
with open(os.path.join(pkgdir, 'package.json'), 'wb') as fp:
  fp.write(data)
with open(os.path.join(pkgdir, 'src/syncml-js.js'), 'wb') as fp:
  fp.write(libdata)
