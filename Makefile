build:
	rm llmstxt-extension.zip || true
	cd extension && zip -vr ../llmxtxt-extension.zip * -x "*.DS_Store"
