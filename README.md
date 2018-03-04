# README

The purpose of this test is to investigate whether elasticsearch version 6.X's "search_after" overcomes limitations of searching with "from" in an elasticsearch query when results past max_result_window are desired:
```
Reference: https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules.html

index.max_result_window
The maximum value of from + size for searches to this index. Defaults to 10000. 
Search requests take heap memory and time proportional to from + size and this limits that memory. 
See Scroll or Search After for a more efficient alternative to raising this. 
```

# Requirements
Elasticsearch version 6.X must already be running.

# Usage
### From the project root:
```
$> npm install
```
### Run using:
```
$> ES_PORT=9600 SEARCH_METHOD=search_after node index.js
```
or
```
$> ES_PORT=9600 SEARCH_METHOD=from node index.js
```
### Expectations:
Running with SEARCH_METHOD=from is expected to fail, as a query using "from" cannot retrieve documents past the value of max_result_window set for the index.

Running with SEARCH_METHOD=search_after is expected to succeed and output to the console the documents right before and right after the boundary dictated by max_result_window. Sorting of the documents is based on an ascending integer field contained in each document to make it easy to see that documents past the max_result_window boundary have been returned.

### Defaults:
The default elasticsearch port is 9200, but can be overridden with the environment variable ES_PORT.

By default the value of max_result_window is 10,000. This can be adjusted by changing the environment variable MAX_RESULT_WINDOW.

By default the number of documents inserted into the local elasticsearch instance for testing is 10015. This can be adjusted by changing the environment variable NUMBER_OF_ES_DOCUMENTS. Note that NUMBER_OF_ES_DOCUMENTS must be greater than MAX_RESULT_WINDOW. Also note there is a timeout used in the bulk upload of documents, so if NUMBER_OF_ES_DOCUMENTS is increased significantly beyond 10,000 this timeout might have to be increased as well in elasticsearchV6Util.js.

If for some reason it is desired to not create the index/add documents or to not delete the index at the end of the execution the environment variables SHOULD_INDEX and SHOULD_CLEANUP can be set to boolean values, respectively.