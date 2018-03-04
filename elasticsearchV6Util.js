const PromiseBatch = require("batch-promises");

module.exports = class ElasticsearchV6Util {
  constructor(opts) {
    this.client = opts.clientReference
    this.BULK_SIZE = 1000;
  }
  existsIndex(name) {
    return new Promise( (resolve, reject) => {
      this.client.indices.exists({
        index: name
      }, (err, res) => {
        if (err) {
          reject(err);
        }
        else {
          resolve({status: "success", message: `Sucessfully determined if elasticsearch index ${name} exists.`, response: res});
        }
      });
    })
  }
  createIndex(name, type, mapping, maxResultWindow=10000) {
    return new Promise( (resolve, reject) => {
      let body = {
        settings: {
          index: {
            // Just local testing...
            number_of_shards: 2,
            number_of_replicas: 1,
            max_result_window: Number(maxResultWindow)
          }
        },
        mappings: {}
      };
      body.mappings[type] = mapping;
      this.client.indices.create({
        index: name,
        body: body
      }, (err, res) => {
        if (err) {
          reject(err);
        }
        else {
          setTimeout(() => {
            resolve({status: "success", message: `Elasticsearch index ${name} created successfully.`, response: res});
          }, 500);
        }
      });
    });
  }
  setBulkIndexSize(bulkSize) {
    this.BULK_SIZE = bulkSize;
  }
  bulkIndex(name, type, documents) {
    function chunkData(data, chunk_size) {
      if (chunk_size % 2 !== 0) {
        chunk_size = chunk_size - 1;
      }
      let chunks = [];
      for (let i = 0; i < data.length; i += chunk_size) {
        let chunk = data.slice(i, i + chunk_size);
        chunks.push(chunk);
      }
      return chunks;
    }

    return new Promise( (resolve, reject) => {
      let body = [];
      for (let i = 0; i < documents.length; i++) {
        body.push({
          index: {
            _index: name,
            _type: type,
            _id: documents[i].count
          }
        });
        body.push(documents[i]);
      }
      
      let bodyChunks = chunkData(body, this.BULK_SIZE);

      PromiseBatch(1, bodyChunks, chunk => this.client.bulk({body: chunk})) // Using batch size of 1 since the chunked data just now needs to be processed. PromiseBatch makes this easy and easy to read.
        .then(res => {
          setTimeout( () => {
            resolve({status: "success", message: `Successfully bulk added documents to elasticsearch index ${name}.`, response: res});
          }, 3000);
        })
        .catch(err => {
          reject(err);
        });
    });
  }
  getDocumentsCountForIndex(name) {
    return new Promise( (resolve, reject) => {
      this.client.count({
        index: name,
        body: {
          query: {
            "match_all": {}
          }
        }
      }, (err, res) => {
        if (err) {
          reject(err);
        }
        else {
          resolve({status: "success", message: `Successfully got documents count for elasticsearch index ${name}.`, response: res});
        }
      });
    });
  }
  searchIndex(name, body) {
    return new Promise( (resolve, reject) => {
      this.client.search({
        index: name,
        body: body
      }, (err, res) => {
        if (err) {
          reject(err);
        }
        else {
          resolve({status: "success", message: `Successfully searched elasticsearch index ${name}.`, response: res});
        }
      });
    });
  }
  deleteIndex(name) {
    return new Promise( (resolve, reject) => {
      this.client.indices.delete({
        index: name     
      }, (err, res) => {
        if (err) {
          reject(err);
        }
        else {
          resolve({status: "success", message: `Successfully deleted elasticsearch index ${name}.`, response: res});
        }
      });
    })
  }
  initElasticsearchWithDocuments(name, type, mapping, documents, maxResultWindow=10000, bulkIndexSize=1000) {
    return new Promise( (resolve, reject) => {
      this.existsIndex(name)
        .then(res => {
          if (!res.response) { 
            return this.createIndex(name, type, mapping, maxResultWindow);
          }
          else {
            return Promise.resolve({status: "success", message: `The specified elasticsearch index ${name} already exists.`});
          }
        })
        .then(res => {
          this.setBulkIndexSize(bulkIndexSize);
          this.bulkIndex(name, type, documents)
            .then(res => {
              resolve(res);
            })
            .catch(err => {
              reject(err);
            });
        })
        .catch(err => {
          reject(err);
        })
    });
  }
}
