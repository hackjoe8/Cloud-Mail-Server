export function createAsyncPolling({ getDelay, shouldRun, onTick, onError }) {
    let active = false;
    let running = false;
    let timer = null;

    const clearTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const schedule = () => {
        clearTimer();

        if (!active) {
            return;
        }

        const delay = Math.max(0, Number(getDelay?.() ?? 0));
        timer = setTimeout(async () => {
            if (!active) {
                return;
            }

            if (running) {
                schedule();
                return;
            }

            if (shouldRun && !shouldRun()) {
                schedule();
                return;
            }

            running = true;
            try {
                await onTick?.();
            } catch (error) {
                onError?.(error);
            } finally {
                running = false;
                if (active) {
                    schedule();
                }
            }
        }, delay);
    };

    return {
        start() {
            if (active) {
                return;
            }
            active = true;
            schedule();
        },
        stop() {
            active = false;
            clearTimer();
        },
        isActive() {
            return active;
        },
        isRunning() {
            return running;
        }
    };
}
