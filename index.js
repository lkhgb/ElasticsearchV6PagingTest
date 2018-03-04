/** 
 * @fileOverview Testing paging using search_after with elasticsearch version 6.X
 * @requires NPM:elasticsearch  VERSION 6.X!!
 * */

const ES_PORT = typeof process.env.ES_PORT !== "undefined" ?  Number(process.env.ES_PORT) : 9200; 
const NUMBER_OF_ES_DOCUMENTS = typeof process.env.NUMBER_OF_ES_DOCUMENTS !== "undefined" ? Number(process.env.NUMBER_OF_ES_DOCUMENTS) : 10015; // Needs to be greater than the MAX_RESULT_WINDOW
const SEARCH_METHOD = typeof process.env.SEARCH_METHOD !== "undefined" ? process.env.SEARCH_METHOD : "search_after"; // Needs to be either from or search_after
const MAX_RESULT_WINDOW = typeof process.env.MAX_RESULT_WINDOW !== "undefined" ?  Number(process.env.MAX_RESULT_WINDOW) : 10000; // 10,000 is the elasticsearch default. Can lower for testing.
const SHOULD_INDEX = typeof process.env.SHOULD_INDEX !== "undefined" ? JSON.parse(process.env.SHOULD_INDEX) : true;
const SHOULD_CLEANUP = typeof process.env.SHOULD_CLEANUP !== "undefined" ? JSON.parse(process.env.SHOULD_CLEANUP) : true;

const INDEX_NAME = "test-es6-paging";
const INDEX_TYPE = "test";

const elasticsearch = require("elasticsearch");
const ElasticsearchV6Util = require("./elasticsearchv6Util"); // This is a class

// Reference if coming from v2.X: https://www.elastic.co/blog/strings-are-dead-long-live-strings
const mapping = readJson("./mapping.json");

let esClient = new elasticsearch.Client({
  host: "localhost:"+ES_PORT,
  log: "info"
});

let elasticsearchUtil = new ElasticsearchV6Util({
  clientReference: esClient
});

function generateElasticsearchDocuments() {
  const generateName = require("sillyname");
  const loremIpsum = require("lorem-ipsum");

  let documents = [];
  let loremIpsumText = "";
  let document = {};
  for(let i = 0; i < NUMBER_OF_ES_DOCUMENTS; i++) {
    // See https://www.npmjs.com/package/lorem-ipsum for options
    loremIpsumText = loremIpsum({
      count: 1,                // Number of words, sentences, or paragraphs to generate. 
      units: "paragraph",      // Generate words, sentences, or paragraphs. 
      sentenceLowerBound: 2,   // Minimum words per sentence. 
      sentenceUpperBound: 5,   // Maximum words per sentence. 
      paragraphLowerBound: 1,  // Minimum sentences per paragraph. 
      paragraphUpperBound: 2,  // Maximum sentences per paragraph. 
    });
    document = {
      author: generateName(),
      text: loremIpsumText,
      count: Number(i)
    };
    document["@timestamp"] = new Date();
    documents.push(document);
  }
  return documents;
}

function queryDocumentsOverResultWindowLimit(name) { 
  return new Promise( (resolve, reject) => {
    elasticsearchUtil.getDocumentsCountForIndex(name)
      .then(res => {
        if (res.response.count <= MAX_RESULT_WINDOW) {
          return Promise.reject(new Error(`Invalid use. There must be more than ${MAX_RESULT_WINDOW} documents in the elasticsearch index ${name} to use this function. There are ${res.response.count} documents.`));
        }
        else if (SEARCH_METHOD !== "search_after" && SEARCH_METHOD !== "from") {
          return Promise.reject(new Error("Invalid search type. Must be \'from\' or \'search_after\'."));
        }
        else {
          let body = {
              size: 3,
              sort: [{
                count: "asc"
              }],
              query: {
                match_all: {}
              }
          };
          if (SEARCH_METHOD === "search_after") {
            body.search_after = [String(MAX_RESULT_WINDOW-2)];
          }
          else if (SEARCH_METHOD === "from") {
            body.from = Number(MAX_RESULT_WINDOW-1);
          }
          console.log("Query body:");
          console.log(JSON.stringify(body, null, 2))
          resolve(elasticsearchUtil.searchIndex(name, body));
        }
      })
      .catch(err => {
        reject(err);
      });
  });
}

function readJson(filename) {
  return JSON.parse(JSON.stringify(require(require("path").resolve(__dirname, filename))));
}

let documents = generateElasticsearchDocuments();
Promise.resolve()
  .then( () => {
    if (SHOULD_INDEX) {
      return elasticsearchUtil.initElasticsearchWithDocuments(INDEX_NAME, INDEX_TYPE, mapping, documents, MAX_RESULT_WINDOW);
    }
    else {
      return Promise.resolve({status: "success", message: `Not creating or adding documents to elasticsearch index ${INDEX_NAME}.`});
    }
  })
  .then(res => {
    return queryDocumentsOverResultWindowLimit(INDEX_NAME);
  })
  .catch(err => {
    console.log(err);
    return Promise.resolve(null);
  })
  .then(res => {
    if (res) {
      console.log(`Total documents in index ${INDEX_NAME}: ${res.response.hits.total}`);
      console.log(`The following logged documents are from the ${MAX_RESULT_WINDOW} document boundary, as this is the value of max_result_window for the index.`);
      console.log(JSON.stringify(res.response.hits.hits, null, 2));
    }
    if (SHOULD_CLEANUP) {
      return elasticsearchUtil.deleteIndex(INDEX_NAME); 
    }
    else {
      return Promise.resolve({status: "success", message: `Not cleaning up elasticsearch index ${INDEX_NAME}.`})
    }
  })
  .catch(err => {
    console.log(err);
  })