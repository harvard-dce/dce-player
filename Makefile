test:
	node tests/basictests.js

run:
	python -m SimpleHTTPServer

pushall:
	git push origin gh-pages
