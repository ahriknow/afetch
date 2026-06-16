/**
 * afetch - Core Implementation
 * The main afetch implementation
 */

import type {
    AFetchInstance,
    AFetchOptions,
    AFetchConfig,
    AResponse,
    ResolvedRequestConfig,
    RequestTask,
} from './types.js';
import { AFetchErrorType } from './types.js';
import { AFetchError } from './error.js';
import { HookRunner } from './plugin.js';
import type { AFetchPlugin, AFetchPluginApi } from './plugin.js';
import {
    buildURL,
    mergeConfig,
    shouldHaveBody,
    shouldSerializeAsJSON,
    parseResponse,
    transformData,
    createTimeoutController,
} from './utils.js';

/**
 * Create an afetch instance
 */
function createInstance(defaultConfig: AFetchConfig = {}): AFetchInstance {
    const context: AFetchConfig = { ...defaultConfig };
    const hooks = new HookRunner();
    const installedPlugins = new Set<string>();

    /**
     * Install a plugin
     */
    function use(plugin: AFetchPlugin): void {
        if (installedPlugins.has(plugin.name)) return;
        installedPlugins.add(plugin.name);

        const api: AFetchPluginApi = {
            addHook(type, fn) {
                if (type === 'beforeRequest') hooks.addBeforeRequest(fn as any);
                else if (type === 'afterResponse') hooks.addAfterResponse(fn as any);
                else if (type === 'onError') hooks.addOnError(fn as any);
            },
        };

        plugin.install(api);
    }

    // Install plugins from config
    if (defaultConfig.plugins) {
        for (const plugin of defaultConfig.plugins) {
            use(plugin);
        }
    }

    // Create the core request function
    async function afetch<T = unknown>(
        url: string,
        options?: AFetchOptions
    ): Promise<AResponse<T>> {
        const config = mergeConfig(context, { ...options, url });

        // Run beforeRequest hooks (may return cached response)
        const cached = await hooks.runBeforeRequest(config);
        if (cached) {
            return cached as AResponse<T>;
        }

        // Execute request
        try {
            const response = await executeRequest<T>(config);

            // Run afterResponse hooks
            const finalResponse = await hooks.runAfterResponse(config, response);
            return finalResponse as AResponse<T>;
        } catch (error) {
            let afetchError: AFetchError;
            if (error instanceof AFetchError) {
                afetchError = error;
            } else {
                const rawMessage = (error as Error).message;
                let message: string;
                if (rawMessage) {
                    message = rawMessage;
                } else {
                    message = 'Request failed';
                }
                afetchError = new AFetchError(
                    message,
                    AFetchErrorType.NETWORK,
                    config,
                    undefined,
                    error as Error
                );
            }

            // Run onError hooks
            const retryResponse = await hooks.runOnError(config, afetchError);
            if (retryResponse) {
                return retryResponse as AResponse<T>;
            }

            throw afetchError;
        }
    }

    /**
     * Execute a single HTTP request
     */
    async function executeRequest<T>(config: ResolvedRequestConfig): Promise<AResponse<T>> {
        // Build the full URL
        const fullURL = buildURL(config.baseURL, config.url, config.params);

        // Prepare request body
        let body = config.body;
        const headers = { ...config.headers };

        if (shouldHaveBody(config.method) && body !== undefined && body !== null) {
            // Apply request transforms
            body = transformData(body, config.transformRequest, headers) as BodyInit;

            // Auto-serialize plain objects to JSON
            if (shouldSerializeAsJSON(body) && !headers['content-type']) {
                headers['content-type'] = 'application/json';
                body = JSON.stringify(body);
            }
        } else {
            body = undefined;
        }

        // Create timeout controller
        const { controller, cleanup } = createTimeoutController(config.timeout, config.signal);

        try {
            // Create the fetch request
            const request = new Request(fullURL, {
                method: config.method,
                headers,
                body: body as BodyInit | null,
                signal: controller.signal,
                cache: config.cache,
                credentials: config.credentials,
                redirect: config.redirect,
                referrer: config.referrer,
                referrerPolicy: config.referrerPolicy,
            });

            // Execute the fetch
            let fetchFn: typeof fetch;
            if (config.fetchAdapter) {
                fetchFn = config.fetchAdapter;
            } else {
                fetchFn = globalThis.fetch;
            }
            const rawResponse = await fetchFn(request);

            // Monitor download progress if callback provided
            let monitoredResponse = rawResponse;
            if (config.onDownloadProgress && rawResponse.body) {
                const contentLength = rawResponse.headers.get('content-length');
                const total = contentLength ? parseInt(contentLength, 10) : 0;
                let loaded = 0;

                const progressStream = new TransformStream({
                    transform(chunk, controller) {
                        loaded += chunk.byteLength;
                        const progress = total > 0 ? loaded / total : 0;
                        config.onDownloadProgress!({ loaded, total, progress });
                        controller.enqueue(chunk);
                    },
                });

                const monitoredBody = rawResponse.body.pipeThrough(progressStream);
                monitoredResponse = new Response(monitoredBody, {
                    status: rawResponse.status,
                    statusText: rawResponse.statusText,
                    headers: rawResponse.headers,
                });
            }

            // Parse response data
            let data: unknown;
            try {
                data = await parseResponse(monitoredResponse, config.responseType);
            } catch (error) {
                throw new AFetchError(
                    'Failed to parse response',
                    AFetchErrorType.PARSE,
                    config,
                    undefined,
                    error as Error
                );
            }

            // Apply response transforms
            const transformedData = transformData(data, config.transformResponse);

            // Build the afetch response
            const response: AResponse<T> = {
                data: transformedData as T,
                status: monitoredResponse.status,
                statusText: monitoredResponse.statusText,
                headers: monitoredResponse.headers,
                config,
                raw: monitoredResponse,
                ok: monitoredResponse.ok,
            };

            // Throw on non-2xx status if configured
            if (config.throwOnError && !monitoredResponse.ok) {
                throw new AFetchError(
                    `Request failed with status ${monitoredResponse.status}`,
                    AFetchErrorType.HTTP,
                    config,
                    response
                );
            }

            return response;
        } catch (error) {
            if (error instanceof AFetchError) {
                throw error;
            }

            // Handle AbortError
            if (error instanceof DOMException && error.name === 'AbortError') {
                const isTimeout = config.timeout > 0 && !config.signal?.aborted;
                throw new AFetchError(
                    isTimeout
                        ? `Request timed out after ${config.timeout}ms`
                        : 'Request was aborted',
                    isTimeout ? AFetchErrorType.TIMEOUT : AFetchErrorType.ABORT,
                    config,
                    undefined,
                    error
                );
            }

            // Handle network errors
            const networkMessage = (error as Error).message;
            let networkError: string;
            if (networkMessage) {
                networkError = networkMessage;
            } else {
                networkError = 'Network error';
            }
            throw new AFetchError(
                networkError,
                AFetchErrorType.NETWORK,
                config,
                undefined,
                error as Error
            );
        } finally {
            cleanup();
        }
    }

    /**
     * Create a cancellable request task
     */
    function createTask<T = unknown>(
        method: string,
        url: string,
        dataOrOptions?: unknown,
        maybeOptions?: AFetchOptions
    ): RequestTask<T> {
        const controller = new AbortController();
        let aborted = false;
        let done = false;
        let responsePromise: Promise<AResponse<T>> | null = null;

        // Determine if data argument is provided (POST, PUT, PATCH)
        const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
        const body = hasBody ? (dataOrOptions as BodyInit) : undefined;
        const options: AFetchOptions | undefined = hasBody
            ? maybeOptions
            : (dataOrOptions as AFetchOptions | undefined);

        // Merge user signal with our controller signal
        const mergedOptions: AFetchOptions = {
            ...options,
            method: method as any,
            body,
            signal: controller.signal,
        };

        // Start the request immediately
        const requestPromise = afetch<T>(url, mergedOptions)
            .then((response) => {
                done = true;
                return response;
            })
            .catch((error) => {
                done = true;
                throw error;
            });

        return {
            abort() {
                if (!done && !aborted) {
                    aborted = true;
                    controller.abort();
                }
            },
            wait() {
                if (!responsePromise) {
                    responsePromise = requestPromise;
                }
                return responsePromise;
            },
            get aborted() {
                return aborted;
            },
            get done() {
                return done;
            },
        };
    }

    // Create the afetch instance
    const instance: AFetchInstance = {
        request: afetch,

        get<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>> {
            return afetch<T>(url, { ...options, method: 'GET' });
        },

        post<T = unknown>(
            url: string,
            data?: unknown,
            options?: AFetchOptions
        ): Promise<AResponse<T>> {
            return afetch<T>(url, { ...options, method: 'POST', body: data as BodyInit });
        },

        put<T = unknown>(
            url: string,
            data?: unknown,
            options?: AFetchOptions
        ): Promise<AResponse<T>> {
            return afetch<T>(url, { ...options, method: 'PUT', body: data as BodyInit });
        },

        delete<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>> {
            return afetch<T>(url, { ...options, method: 'DELETE' });
        },

        patch<T = unknown>(
            url: string,
            data?: unknown,
            options?: AFetchOptions
        ): Promise<AResponse<T>> {
            return afetch<T>(url, { ...options, method: 'PATCH', body: data as BodyInit });
        },

        head<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>> {
            return afetch<T>(url, { ...options, method: 'HEAD' });
        },

        options<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>> {
            return afetch<T>(url, { ...options, method: 'OPTIONS' });
        },

        create(config?: AFetchConfig): AFetchInstance {
            return createInstance({ ...context, ...config });
        },

        use,

        task: {
            get<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T> {
                return createTask<T>('GET', url, options);
            },
            post<T = unknown>(
                url: string,
                data?: unknown,
                options?: AFetchOptions
            ): RequestTask<T> {
                return createTask<T>('POST', url, data, options);
            },
            put<T = unknown>(url: string, data?: unknown, options?: AFetchOptions): RequestTask<T> {
                return createTask<T>('PUT', url, data, options);
            },
            delete<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T> {
                return createTask<T>('DELETE', url, options);
            },
            patch<T = unknown>(
                url: string,
                data?: unknown,
                options?: AFetchOptions
            ): RequestTask<T> {
                return createTask<T>('PATCH', url, data, options);
            },
            head<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T> {
                return createTask<T>('HEAD', url, options);
            },
            options<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T> {
                return createTask<T>('OPTIONS', url, options);
            },
        },

        all<T extends readonly unknown[]>(requests: {
            [K in keyof T]: Promise<AResponse<T[K]>>;
        }): Promise<{ [K in keyof T]: AResponse<T[K]> }> {
            return Promise.all(requests) as Promise<{ [K in keyof T]: AResponse<T[K]> }>;
        },

        race<T>(requests: Promise<AResponse<T>>[]): Promise<AResponse<T>> {
            return Promise.race(requests);
        },

        defaults: context,
    };

    return instance;
}

// Create the default afetch instance
const afetch = createInstance();

export { afetch, createInstance, AFetchError, AFetchErrorType };
export type { AFetchInstance, AFetchOptions, AFetchConfig, AResponse, ResolvedRequestConfig };
