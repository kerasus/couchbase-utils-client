import type { AxiosInstance, AxiosResponse } from 'axios'

export interface CouchbaseResponseError {
    code: number; // Error code
    msg: string; // Error message
    reason?: { scope: string; collection?: string }; // Reason for the error (optional, could include scope and collection)
}

export interface CouchbaseResponse {
    requestID: string; // Unique identifier for the request
    status: string; // Status of the query (e.g., "success", "fatal")
    metrics: {
        elapsedTime: string; // Time taken to execute the query
        executionTime: string; // Time taken for the execution phase
        resultCount: number; // Number of results returned
        resultSize: number; // Size of the result set in bytes
        errorCount?: number; // Number of errors encountered (optional)
        warningCount?: number; // Number of warnings (optional)
    };
    errors?: Array<CouchbaseResponseError>;
    warnings?: Array<{
        code: number; // Warning code
        msg: string; // Warning message
    }>;
    results?: Array<any>; // Array of result objects (if any)
}

export interface CouchbaseUtilsClientConstructorType {
    connStr: string;
    username: string;
    password: string;
    bucketName: string;
    scopeName: string;
    axiosInstance: AxiosInstance;
}

export default class CouchbaseUtilsClient {
    private readonly connStr: string
    private readonly username: string
    private readonly password: string
    private readonly bucketName: string
    private readonly scopeName: string
    private readonly axiosInstance: AxiosInstance

    constructor (data: CouchbaseUtilsClientConstructorType) {
        this.connStr = data.connStr
        this.username = data.username
        this.password = data.password
        this.bucketName = data.bucketName
        this.scopeName = data.scopeName
        this.axiosInstance = data.axiosInstance
    }

    /**
     * Processes the Axios response from a Couchbase query.
     * Throws an error if the Couchbase response contains errors.
     * @param axiosResponse The Axios response containing a CouchbaseResponse.
     * @returns The results from the CouchbaseResponse.
     * @throws Error if the CouchbaseResponse contains errors.
     */
    protected getCouchbaseResponse (axiosResponse: AxiosResponse<CouchbaseResponse>) {
        const couchbaseResponse = axiosResponse.data

        // Check if the response contains errors
        if (couchbaseResponse.errors && couchbaseResponse.errors.length > 0) {
            const errorMessages = couchbaseResponse.errors.map(error => `Code ${error.code}: ${error.msg}`).join('; ')
            throw new Error(`Couchbase query failed with errors: ${errorMessages}`)
        }

        // Check if the status is not 'success'
        if (couchbaseResponse.status !== 'success') {
            throw new Error(`Couchbase query failed with status: ${couchbaseResponse.status}`)
        }

        // Return the results if no errors
        return couchbaseResponse.results
    }

    /**
     * Sends a request to the Couchbase query service.
     * @param statement The N1QL query statement to execute.
     * @returns The results from the CouchbaseResponse.
     * @throws Error if the request fails or the CouchbaseResponse contains errors.
     */
    protected async sendRequest (statement: string): Promise<any> {
        const requestBody = { statement }
        const endpoint = `${this.connStr}/query/service`

        try {
            const response: AxiosResponse<CouchbaseResponse> = await this.axiosInstance.post(
                endpoint,
                requestBody,
                {
                    headers: { 'Content-Type': 'application/json' },
                    auth: {
                        username: this.username,
                        password: this.password
                    }
                }
            )

            return this.getCouchbaseResponse(response)
        } catch (error: any) {
            if (error.response && error.response.data) {
                console.error('Couchbase query error:', error.response.data);
                throw error.response.data; // Throw the entire error object for further analysis
            } else if (error instanceof Error) {
                throw new Error(`An error occurred during the request: ${error.message}`);
            } else {
                throw new Error('An unknown error occurred during the request.');
            }
        }
    }

    /**
     * Executes a raw N1QL query statement.
     * @param statement - The raw N1QL query statement to execute.
     * @returns The results from the CouchbaseResponse.
     * @throws Error if the request fails or the CouchbaseResponse contains errors.
     */
    async query(statement: string): Promise<any> {
        return this.sendRequest(statement);
    }

    /**
     * Creates a scope by sending the N1QL query in the POST body.
     * @param scopeName The name of the scope to be created within the bucket (e.g., "`user_config`").
     * @returns The result of the create scope operation.
     * @throws Error if the operation fails.
     */
    async createScope (scopeName: string): Promise<any> {
        const query = `CREATE SCOPE \`${this.bucketName}\`.\`${scopeName}\`;`
        return this.sendRequest(query)
    }

    /**
     * Creates a collection by sending the N1QL query in the POST body.
     * @param collectionName The fully qualified collection name (e.g., "`user_config`.`111`.`i18n`").
     * @returns The result of the create collection operation.
     * @throws Error if the operation fails.
     */
    async createCollection (collectionName: string): Promise<any> {
        const queryN1QL = `CREATE COLLECTION \`${this.bucketName}\`.\`${this.scopeName}\`.\`${collectionName}\`;`
        return this.sendRequest(queryN1QL)
    }

    /**
     * Inserts or updates a document in the specified collection.
     * @param collectionName The name of the collection (e.g., "`user_config`.`111`.`i18n`").
     * @param documentKey The document key to use for the upsert operation.
     * @param data The document data to upsert.
     * @returns The result of the upsert operation.
     * @throws Error if the document key is missing or the upsert operation fails.
     */
    async upsert (collectionName: string, documentKey: string, data: any): Promise<any> {
        if (!documentKey) {
            throw new Error('Document key must be provided.')
        }

        const valueString = JSON.stringify(data)
        const queryN1QL = `UPSERT INTO \`${this.bucketName}\`.\`${this.scopeName}\`.\`${collectionName}\` (KEY, VALUE) VALUES ("${documentKey}", ${valueString});`

        return this.sendRequest(queryN1QL)
    }

    /**
     * Updates a nested field inside a document in Couchbase using N1QL.
     *
     * @param {string} collectionName - The name of the collection containing the document.
     * @param {string} documentId - The unique ID of the document to update.
     * @param {string} fieldPath - The dot-separated path to the nested field (e.g., "user.profile.age").
     * @param {any} newValue - The new value to set for the specified nested field.
     * @returns {Promise<void>} - Resolves when the update is successful.
     * @throws {Error} - Throws an error if the document ID is missing or if the query execution fails.
     *
     * @example
     * await couchbaseClient.updateNestedValue(
     *   'users',
     *   'user123',
     *   'profile.age',
     *   30
     * );
     * // This updates the document with ID "user123",
     * // setting the "profile.age" field to 30.
     */
    async updateNestedValue (
        collectionName: string,
        documentId: string,
        fieldPath: string,
        newValue: any
    ): Promise<void> {
        if (!documentId) {
            throw new Error('Document ID must be provided.')
        }
        const valueString = JSON.stringify(newValue)
        const queryN1QL = `UPSERT INTO \`${this.bucketName}\`.\`${this.scopeName}\`.\`${collectionName}\`  (KEY, VALUE) VALUES ("${documentId}", {"${fieldPath}": ${valueString}});`

        await this.sendRequest(queryN1QL)
    }

    /**
     * Retrieves a document by its ID from the specified collection.
     * @param collectionName - The fully qualified collection name (e.g., "`user_config`.`111`.`i18n`").
     * @param documentId - The ID of the document to retrieve.
     * @returns The retrieved document.
     * @throws Error if the retrieval operation fails.
     */
    async get (collectionName: string, documentId: string): Promise<any> {
        const queryN1QL = `SELECT * FROM \`${this.bucketName}\`.\`${this.scopeName}\`.\`${collectionName}\` USE KEYS "${documentId}";`
        return this.sendRequest(queryN1QL)
    }

    /**
     * Retrieves a nested field directly from Couchbase.
     * @param collectionName - The name of the collection (e.g., "dashboardConfig").
     * @param documentId - The document key/ID.
     * @param fieldPath - The dot-separated nested field path (e.g., "b.c").
     * @returns The value of the nested field.
     * @throws Error if the document or field is not found or the query fails.
     */
    async getNestedValue<T> (collectionName: string, documentId: string, fieldPath: string): Promise<T> {
        // Use an alias (d) for the document in the query to project only the nested field.
        const queryN1QL = `SELECT d.${fieldPath} AS nestedValue FROM \`${this.bucketName}\`.\`${this.scopeName}\`.\`${collectionName}\` d USE KEYS "${documentId}";`

        const results = await this.sendRequest(queryN1QL)

        if (!results || results.length === 0) {
            throw new Error(`No document found with key "${documentId}" in collection "${collectionName}".`)
        }

        const nestedValue = results[0].nestedValue
        if (nestedValue === undefined) {
            throw new Error(`Field "${fieldPath}" not found in document with key "${documentId}".`)
        }

        return nestedValue as T
    }

    /**
     * Checks for specific errors in the provided Couchbase response data and
     * attempts to handle them by invoking respective error handling methods.
     *
     * This method looks for errors in the response data, specifically scope errors
     * (code 12021) and collection errors (code 12003). If such errors are found,
     * it delegates the handling of these errors to appropriate helper methods
     * (`handleScopeError` and `handleCollectionError`).
     *
     * @param errorData The Couchbase response object containing an `errors`
     *                  array with error details.
     * @returns A promise that resolves once the errors are handled or no relevant
     *          errors are found. If errors are present, the function attempts to
     *          handle them asynchronously.
     */
    async checkError (errorData: CouchbaseResponse): Promise<void> {
        if (!errorData || !errorData.errors) {
            return
        }

        // Handle Scope Error
        const scopeError = errorData.errors.find((err: any) => err.code === 12021)
        if (scopeError) {
            await this.handleScopeError(scopeError)
        }

        // Handle Collection Error
        const collectionError = errorData.errors.find((err: any) => err.code === 12003)
        if (collectionError) {
            await this.handleCollectionError(collectionError)
        }
    }

    /**
     * Handles the error related to a scope creation failure by extracting and validating the scope name,
     * then attempting to create the scope if necessary.
     * @param scopeError The error response from Couchbase, typically containing information about the scope failure.
     * @returns void
     * @throws Error if the scope format is invalid or if the error does not contain necessary information.
     */
    async handleScopeError (scopeError: CouchbaseResponseError): Promise<void> {
        try {
            const reason = scopeError.reason

            // Ensure reason and scope are available in the error
            if (!reason || !reason.scope) {
                throw new Error(`Invalid scopeError: Missing scope in reason: ${JSON.stringify(scopeError)}`)
            }

            const scopeNameWithPrefix = reason.scope
            const match = scopeNameWithPrefix.match(/^default:([^.]+)\.(.+)$/)

            // Validate scope format (should be "default:{bucketName}.{scopeName}")
            if (!match) {
                throw new Error(`Invalid scope format: ${scopeNameWithPrefix}`)
            }

            const scopeName = match[2]

            // If no valid scope name is extracted, exit the method
            if (!scopeName) {
                return
            }

            await this.createScope(scopeName)
        } catch (createScopeError) {
            console.error('Failed to create scope:', createScopeError)
            // Re-throw the error for further handling or propagation
            throw createScopeError
        }
    }

    /**
     * Handles errors related to missing collections by extracting the collection name
     * from the error message and attempting to create the collection.
     *
     * This method parses the error message to extract the collection name. If the
     * message format is invalid or the collection name is missing, an error is thrown.
     * If the collection creation fails, the error is rethrown after logging the issue.
     *
     * @param collectionError An object containing the error `code` and `msg`
     *                        from the Couchbase error response.
     * @throws Error if the error message is malformed or if the collection
     *               creation fails.
     * @returns A promise that resolves when the collection is successfully created,
     *          or an error is thrown if creation fails.
     */
    async handleCollectionError (collectionError: { code: number, msg: string }): Promise<void> {
        try {
            // Extract collectionName from the error message
            const match = collectionError.msg.match(/Keyspace not found in CB datastore: default:([^\.]+)\.([^\.]+)\.([^\s\(]+)/)

            if (!match) {
                throw new Error(`Invalid keyspace format in error message: ${collectionError.msg}`)
            }

            const collectionName = match[3]

            if (!collectionName) {
                throw new Error('Missing collectionName to create collection.')
            }

            await this.createCollection(collectionName)
        } catch (createCollectionError) {
            console.error('Failed to create collection:', createCollectionError)
            throw createCollectionError
        }
    }
}
