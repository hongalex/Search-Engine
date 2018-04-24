## Search Engine

This is the EJS generated dynamic frontend search engine which uses Solr (Lucene) to index HTML files. 

Supports the following features:
1. Choose to search with either Lucene or PageRank
2. Autocomplete
3. Spelling correction
4. Snippets

Configuration
1. ```npm install```
2. Add big.txt specific to the HTML files you are trying to search through (used for spell correction)

Running
```node server.js``` - Starts the server

