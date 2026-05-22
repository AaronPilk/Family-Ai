/**
 * Vault tab — entry point on the bottom bar.
 *
 * The actual screen logic lives in app/vault/index.tsx; this file simply
 * mounts the same component under the (tabs) route so the bottom-bar icon
 * has a destination. Deep routes (/vault/add, /vault/release,
 * /vault/released-to-me, /vault/[id]) live outside the tabs group and push
 * onto the parent stack as usual.
 */
export { default } from '../vault/index';
