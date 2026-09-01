import { fetchWithTimeout } from "@/utils.js";

/**
 * Describes a failed Item Service response.
 *
 * The status code alone answers "did it work"; it does not answer "why not". The Item
 * Service reports a missing item, a refused field and a bad path all as 4xx, with the
 * reason in the body — so throwing the status and discarding the body turns a fixable
 * mistake into a guess.
 */
async function describeFailedResponse(response: Response, url: string): Promise<string> {
    let detail = "";
    try {
        detail = (await response.text()).split(/\s+/).join(" ").trim();
    } catch {
        // The status is the useful part; an unreadable body must not mask it.
    }
    return `${response.status} ${response.statusText} from ${url}`
        + (detail ? `. Response: ${detail.slice(0, 400)}` : "");
}


class RestfulItemServiceClient {
    private serverUrl: string;
    private username: string;
    private password: string;
    private domain: string;
    private authCookie: string | null = null;
    private isInitialized: boolean = false;

    constructor(serverUrl: string, username: string, password: string, domain: string = 'sitecore') {
        this.serverUrl = serverUrl;
        this.username = username;
        this.password = password;
        this.domain = domain;
    }

    /**
     * Initializes the client by logging in and setting the authentication cookie.
     * @returns {Promise<void>} - Resolves if initialization is successful.
     */
    async initialize(): Promise<void> {
        if (!this.isInitialized) {
            try {
                await this.login();
                this.isInitialized = true;
            } catch (error) {
                console.error('Failed to initialize client:', error);
                throw error;
            }
        }
    }

    /**
     * Logs in to the Sitecore server and sets the authentication cookie.
     * @returns {Promise<void>} - Resolves if login is successful.
     */
    async login(): Promise<void> {
        const url = `${this.serverUrl}/sitecore/api/ssc/auth/login`;

        try {

            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.username,
                    password: this.password,
                    domain: this.domain
                })
            });


            if (!response.ok) {
                // 'Login failed' on its own hides the one thing that distinguishes the two
                // very different causes: a 403 is the Item Service refusing these
                // credentials (or refusing everything, under ServicesOffPolicy), while a
                // 404 means the endpoint is not there at all. Callers were left guessing,
                // and guessing wrong.
                let detail = "";
                try {
                    detail = (await response.text()).split(/\s+/).join(" ").trim();
                } catch {
                    // The status is the useful part; a missing body must not mask it.
                }
                const hint = response.status === 403
                    ? ` The Item Service rejected the login. Either the account `
                    + `'${this.domain}\\${this.username}' is not valid on this instance, or `
                    + `Sitecore.Services.SecurityPolicy is still ServicesOffPolicy — a `
                    + `malformed request answering 400 rather than 403 tells you the endpoint `
                    + `itself is live and it is the credentials that are being refused.`
                    : response.status === 404
                        ? " The endpoint was not found: check ITEM_SERVICE_SERVER_URL."
                        : "";
                throw new Error(
                    `Login failed: ${response.status} ${response.statusText} from ${url}.${hint}`
                    + (detail ? ` Response: ${detail.slice(0, 400)}` : "")
                );
            }

            const cookies = response.headers.get('set-cookie');
            if (cookies) {
                const match = cookies.match(/\.AspNet\.Cookies=([^;]+);/);
                if (match) {
                    this.authCookie = match[1];
                }
            }
            else {
                throw new Error('No cookies received in response headers');
            }

            if (!this.authCookie) {
                throw new Error('Failed to retrieve authentication cookie');
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to log in: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to log in: An unknown error occurred', { cause: error });
            }
        }
    }

    /**
     * Retrieves a Sitecore item by its ID using the ItemService RESTful API.
     * @param {string} id - The GUID of the Sitecore item to retrieve.
     * @param {Object} [options] - Optional parameters for the request.
     * @returns {Promise<object>} - The retrieved Sitecore item.
     */
    async getItemById(id: string, options: {
        database?: string;
        language?: string;
        version?: string;
        includeStandardTemplateFields?: boolean;
        includeMetadata?: boolean;
        fields?: string[];
    } = {}): Promise<object> {

        if (!this.isInitialized) {
            await this.initialize();
        }

        const params = new URLSearchParams(options as Record<string, string>);

        if (options.fields) {
            params.set('fields', options.fields.join(','));
        }

        const url = `${this.serverUrl}/sitecore/api/ssc/item/${id}?${params.toString()}`;

        try {
            const response = await fetchWithTimeout(url, {
                headers: { 'Cookie': `.AspNet.Cookies=${this.authCookie}` }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! ${await describeFailedResponse(response, url)}`);
            }

            return await response.json() as unknown as object;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to retrieve item by ID: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to retrieve item by ID: An unknown error occurred', { cause: error });
            }
        }
    }

    /**
     * Retrieves the children of a Sitecore item by its ID using the ItemService RESTful API.
     * @param {string} id - The GUID of the Sitecore item whose children to retrieve.
     * @param {Object} [options] - Optional parameters for the request.
     * @returns {Promise<object>} - The retrieved Sitecore item children.
     */
    async getItemChildren(id: string, options: {
        database?: string;
        language?: string;
        version?: string;
        includeStandardTemplateFields?: boolean;
        includeMetadata?: boolean;
        fields?: string[];
    } = {}): Promise<object> {

        if (!this.isInitialized) {
            await this.initialize();
        }

        const params = new URLSearchParams(options as Record<string, string>);

        if (options.fields) {
            params.set('fields', options.fields.join(','));
        }

        const url = `${this.serverUrl}/sitecore/api/ssc/item/${id}/children?${params.toString()}`;

        try {
            const response = await fetchWithTimeout(url, {
                headers: { 'Cookie': `.AspNet.Cookies=${this.authCookie}` }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! ${await describeFailedResponse(response, url)}`);
            }

            return await response.json() as unknown as object;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to retrieve item children: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to retrieve item children: An unknown error occurred', { cause: error });
            }
        }
    }

    /**
     * Retrieves a Sitecore item by its path using the ItemService RESTful API.
     * @param {string} path - The content path of the Sitecore item to retrieve.
     * @param {Object} [options] - Optional parameters for the request.
     * @returns {Promise<object>} - The retrieved Sitecore item.
     */
    async getItemByPath(path: string, options: {
        database?: string;
        language?: string;
        version?: string;
        includeStandardTemplateFields?: boolean;
        includeMetadata?: boolean;
        fields?: string[];
    } = {}): Promise<object> {

        if (!this.isInitialized) {
            await this.initialize();
        }

        // Encode the path parameter to make it URL-safe
        const encodedPath = encodeURIComponent(path);
        const params = new URLSearchParams(options as Record<string, string>);

        if (options.fields) {
            params.set('fields', options.fields.join(','));
        }

        const url = `${this.serverUrl}/sitecore/api/ssc/item?path=${encodedPath}&${params.toString()}`;

        try {
            const response = await fetchWithTimeout(url, {
                headers: { 'Cookie': `.AspNet.Cookies=${this.authCookie}` }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! ${await describeFailedResponse(response, url)}`);
            }

            return await response.json() as unknown as object;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to retrieve item by path: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to retrieve item by path: An unknown error occurred', { cause: error });
            }
        }
    }

    /**
     * Creates a new Sitecore item using the ItemService RESTful API.
     * @param {string} parentPath - The path where the new item will be created (e.g., 'sitecore/content/Home').
     * @param {object} data - The data for the new item (ItemName, TemplateID, fields, etc).
     * @param {object} [options] - Optional parameters for the request (database, language).
     * @returns {Promise<object>} - The created Sitecore item response.
     */
    async createItem(parentPath: string, data: {
        ItemName: string;
        TemplateID: string;
        [key: string]: any;
    }, options: {
        database?: string;
        language?: string;
    } = {}): Promise<object> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Encode the parentPath for URL
        const encodedPath = encodeURIComponent(parentPath);
        const params = new URLSearchParams(options as Record<string, string>);
        const url = `${this.serverUrl}/sitecore/api/ssc/item/${encodedPath}?${params.toString()}`;

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `.AspNet.Cookies=${this.authCookie}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! ${await describeFailedResponse(response, url)}`);
            }

            return {
                "Status": "Success",
                "Code": response.status,
                "Message": "Item created successfully",
            };
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to create item: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to create item: An unknown error occurred', { cause: error });
            }
        }
    }

    /**
     * Edits a Sitecore item using the ItemService RESTful API.
     * @param {string} id - The GUID of the Sitecore item to edit.
     * @param {object} data - The data to update (fields, etc).
     * @param {object} [options] - Optional parameters for the request (database, language, version).
     * @returns {Promise<object>} - The updated Sitecore item response.
     */
    async editItem(id: string, data: {
        [key: string]: any;
    }, options: {
        database?: string;
        language?: string;
        version?: string;
    } = {}): Promise<object> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const params = new URLSearchParams(options as Record<string, string>);
        const url = `${this.serverUrl}/sitecore/api/ssc/item/${id}?${params.toString()}`;

        try {
            const response = await fetchWithTimeout(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `.AspNet.Cookies=${this.authCookie}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! ${await describeFailedResponse(response, url)}`);
            }

            return {
                "Status": "Success",
                "Code": response.status,
                "Message": "Item updated successfully",
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to edit item: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to edit item: An unknown error occurred', { cause: error });
            }
        }
    }

    /**
     * Deletes a Sitecore item by its ID using the ItemService RESTful API.
     * @param {string} id - The GUID of the Sitecore item to delete.
     * @param {Object} [options] - Optional parameters for the request (database, language, version).
     * @returns {Promise<object>} - The response from the delete operation.
     */
    async deleteItem(id: string, options: {
        database?: string;
        language?: string;
        version?: string;
    } = {}): Promise<object> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const params = new URLSearchParams(options as Record<string, string>);
        const url = `${this.serverUrl}/sitecore/api/ssc/item/${id}?${params.toString()}`;

        try {
            const response = await fetchWithTimeout(url, {
                method: 'DELETE',
                headers: {
                    'Cookie': `.AspNet.Cookies=${this.authCookie}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! ${await describeFailedResponse(response, url)}`);
            }

            return {
                "Status": "Success",
                "Code": response.status,
                "Message": "Item deleted successfully",
            };
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to delete item: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to delete item: An unknown error occurred', { cause: error });
            }
        }
    }

    /**
     * Searches Sitecore items using the ItemService RESTful API.
     * @param {object} options - Search options (term, fields, facets, etc).
     * @returns {Promise<object>} - The search results.
     */
    async searchItems(options: {
        term: string;
        fields?: string[];
        facet?: string;
        page?: number;
        pageSize?: number;
        database?: string;
        includeStandardTemplateFields?: boolean;
    }): Promise<object> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const params = new URLSearchParams();
        if (options.term) params.set('term', options.term);
        if (options.fields) params.set('fields', options.fields.join(','));
        if (options.facet) params.set('facet', options.facet);
        if (options.page !== undefined) params.set('page', String(options.page));
        if (options.pageSize !== undefined) params.set('pageSize', String(options.pageSize));
        if (options.database) params.set('database', options.database);
        if (options.includeStandardTemplateFields !== undefined) params.set('includeStandardTemplateFields', String(options.includeStandardTemplateFields));

        const url = `${this.serverUrl}/sitecore/api/ssc/item/search?${params.toString()}`;

        try {
            const response = await fetchWithTimeout(url, {
                headers: { 'Cookie': `.AspNet.Cookies=${this.authCookie}` }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! ${await describeFailedResponse(response, url)}`);
            }
            return await response.json() as unknown as object;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to search items: ${error.message}`, { cause: error });
            } else {
                throw new Error('Failed to search items: An unknown error occurred', { cause: error });
            }
        }
    }



}

export default RestfulItemServiceClient;