# Couchbase Utils Client

**Couchbase Utils Client** is a lightweight client library for interacting with Couchbase using N1QL. It provides utility functions to create collections, upsert documents, retrieve full documents, and fetch specific nested fields directly—minimizing data transfer when working with large documents.

## Features

- **Execute N1QL Queries:** Perform queries using Couchbase's native query language.
- **Create Collections:** Easily create collections within a specified bucket and scope.
- **Upsert Documents:** Insert or update documents with a separate document key.
- **Fetch Nested Fields:** Retrieve only the required nested fields without transferring the entire document.

## Installation

Install the package via npm:

```bash
npm install couchbase-utils-client
```

# API Reference

## `CouchbaseDB(config)`
Constructor to initialize the CouchbaseDB instance with the provided configuration.

### Parameters:
- `config`: An object containing the following properties:
    - `connStr`: The Couchbase connection string.
    - `username`: The Couchbase username.
    - `password`: The Couchbase password.
    - `bucketName`: The name of the Couchbase bucket.
    - `scopeName`: The name of the Couchbase scope.
    - `axiosInstance`: An Axios instance configured with the necessary authentication token.

---

## `upsert(collectionName, documentKey, data)`
Inserts or updates a document in the specified collection.

### Parameters:
- `collectionName`: The name of the collection (e.g., `'dashboardConfig'`).
- `documentKey`: The document key to use for the upsert operation.
- `data`: The document data to upsert.

### Returns:
- A promise that resolves when the upsert operation is complete.

### Throws:
- An error if the document key is missing or the upsert operation fails.

---

## `get(collectionName, documentId)`
Retrieves a document by its ID from the specified collection.

### Parameters:
- `collectionName`: The name of the collection.
- `documentId`: The ID of the document to retrieve.

### Returns:
- A promise that resolves to the retrieved document.

### Throws:
- An error if the retrieval operation fails.

---

## `getNestedValue(collectionName, documentId, fieldPath)`
Retrieves a nested field directly from Couchbase.

### Parameters:
- `collectionName`: The name of the collection.
- `documentId`: The document key/ID.
- `fieldPath`: The dot-separated nested field path (e.g., `'b.c'`).

### Returns:
- A promise that resolves to the value of the nested field.

### Throws:
- An error if the document or field is not found or the query fails.

## Usage

```typescript
import CouchbaseDB from 'couchbase-utils-client';
import axios from 'axios';

const config = {
  connStr: 'your-couchbase-connection-string',
  username: 'your-username',
  password: 'your-password',
  bucketName: 'your-bucket-name',
  scopeName: 'your-scope-name',
  axiosInstance: axios.create({
    // Configure your Axios instance here
  }),
};

const couchbaseDB = new CouchbaseDB(config);

// Upsert a document
const collectionName = 'dashboardConfig';
const documentKey = 'user123';
const data = { a: 1, b: { c: 2 } };

couchbaseDB.upsert(collectionName, documentKey, data)
  .then(() => {
    // Retrieve a nested value
    return couchbaseDB.getNestedValue(collectionName, documentKey, 'b.c');
  })
  .then(nestedValue => {
    console.log(nestedValue); // Outputs: 2
  })
  .catch(error => {
    console.error('Error:', error);
  });
```