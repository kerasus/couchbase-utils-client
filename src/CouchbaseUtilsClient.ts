import type { AxiosInstance, AxiosResponse } from 'axios'

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
    errors?: Array<{
        code: number; // Error code
        msg: string; // Error message
    }>;
    warnings?: Array<{
        code: number; // Warning code
        msg: string; // Warning message
    }>;
    results?: Array<any>; // Array of result objects (if any)
}

export interface CouchbaseDBConstructorType {
    connStr: string;
    username: string;
    password: string;
    bucketName: string;
    scopeName: string;
    axiosInstanceWithToken: AxiosInstance;
}

export default class CouchbaseUtilsClient {
    private readonly connStr: string
    private readonly username: string
    private readonly password: string
    private readonly bucketName: string
    private readonly scopeName: string
    private readonly axiosInstanceWithToken: AxiosInstance

    constructor (data: CouchbaseDBConstructorType) {
        this.connStr = data.connStr
        this.username = data.username
        this.password = data.password
        this.bucketName = data.bucketName
        this.scopeName = data.scopeName
        this.axiosInstanceWithToken = data.axiosInstanceWithToken
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
            const response: AxiosResponse<CouchbaseResponse> = await this.axiosInstanceWithToken.post(
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
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`An error occurred during the request: ${error.message}`)
            } else {
                throw new Error('An unknown error occurred during the request.')
            }
        }
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
}
