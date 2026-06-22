/**
 * aws - WebSocket Module Index
 * WebSocket client module
 *
 * @packageDocumentation
 */

export { createWS } from './aws.js';
export { WSError } from './error.js';
export { WSState, WSErrorType } from './types.js';

export type { WSConfig, WSMessage, WSClient } from './types.js';

export type {
    WSPlugin,
    WSPluginApi,
    WSOpenHook,
    WSMessageHook,
    WSErrorHook,
    WSCloseHook,
    WSSendHook,
    WSOpenContext,
    WSMessageContext,
    WSErrorContext,
    WSCloseContext,
    WSSendContext,
} from './plugin.js';

export { createAutoReconnectPlugin, createRequestSyncPlugin } from './plugins/index.js';
export type {
    AutoReconnectOptions,
    RequestSyncPlugin,
    RequestSyncOptions,
    IdType,
    IdGenerator,
    RequestFormatter,
    ResponseIdExtractor,
    ResponseMatcher,
    ResponseDataExtractor,
} from './plugins/index.js';
