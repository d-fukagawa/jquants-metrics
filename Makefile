.PHONY: setup lint test verify

setup:
	@bash bin/setup

lint:
	@bash bin/lint

test:
	@bash bin/test

verify:
	@bash bin/verify
