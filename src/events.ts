/**
 * afetch - Event Emitter
 * Simple typed event emitter for the event bus plugin
 */

type Listener<T = unknown> = (data: T) => void;

/**
 * Simple event emitter
 */
export class Emitter {
    private listeners = new Map<string, Set<Listener>>();

    /**
     * Register an event listener
     * @returns Unsubscribe function
     */
    on<T = unknown>(event: string, listener: Listener<T>): () => void {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(listener as Listener);
        return () => {
            set!.delete(listener as Listener);
            if (set!.size === 0) {
                this.listeners.delete(event);
            }
        };
    }

    /**
     * Register a one-time event listener
     * @returns Unsubscribe function
     */
    once<T = unknown>(event: string, listener: Listener<T>): () => void {
        const wrapped: Listener<T> = (data) => {
            off();
            listener(data);
        };
        const off = this.on(event, wrapped);
        return off;
    }

    /**
     * Emit an event
     */
    emit<T = unknown>(event: string, data: T): void {
        const set = this.listeners.get(event);
        if (set) {
            for (const listener of set) {
                listener(data);
            }
        }
    }

    /**
     * Remove all listeners for an event, or all events
     */
    off(event?: string): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}
