
tests:
	jasmine-node --verbose test
#	mocha

serve:
	python -m SimpleHTTPServer 9000

bump:
	python bin/bumpversion.py
