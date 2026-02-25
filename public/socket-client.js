/**
 * socket-client.js — Shared frontend communication logic
 */

window.Racetrack = {
    socket: null,

    /**
     * Initialize connection with authentication
     * @param {string} namespace - e.g., '/front-desk'
     * @param {function} onStateUpdate - callback for state:full
     */
    init: function (namespace, onStateUpdate) {
        const authOverlay = document.getElementById('auth-overlay');
        const authInput = document.getElementById('auth-input');
        const authButton = document.getElementById('auth-button');
        const authError = document.getElementById('auth-error');

        authButton.addEventListener('click', () => {
            const key = authInput.value;
            if (!key) return;

            // Connect with auth handshake
            this.socket = io(namespace, {
                auth: { key }
            });

            this.socket.on('connect', () => {
                console.log('Connected to', namespace);
                authOverlay.style.opacity = '0';
                setTimeout(() => authOverlay.classList.add('hidden'), 300);
            });

            this.socket.on('connect_error', (err) => {
                console.error('Auth failed', err.message);
                authError.innerText = 'Incorrect Access Key. Please try again.';
                this.socket.disconnect();
            });

            this.socket.on('state:full', (state) => {
                if (onStateUpdate) onStateUpdate(state);
            });

            this.socket.on('error:msg', (msg) => {
                alert('Server Error: ' + msg);
            });
        });

        // Allow 'Enter' key in input
        authInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') authButton.click();
        });
    },

    // Utility to emit events
    emit: function (event, data) {
        if (this.socket) this.socket.emit(event, data);
    }
};
