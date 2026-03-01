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
                if (err.message === 'AUTH_FAILED') {
                    authError.innerText = 'Incorrect access key';
                    console.error('Auth failed', err.message);
                } else {
                    authError.innerText = 'Can\'t reach the server';
                    console.error('Connection failed', err.message);
                }
                this.socket.disconnect();
            });

            this.socket.on('state:full', (state) => {
                if (onStateUpdate) onStateUpdate(state);
            });

            this.socket.on('error:msg', (msg) => {
                alert('Server Error: ' + msg);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected');
                authError.innerText = 'Server offline, Please try again.';
                authOverlay.style.opacity = '1';
                authOverlay.classList.remove('hidden');
                this.socket = null;
            });
        });

        // Allow 'Enter' key in input
        authInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') authButton.click();
        });
    },

    // For public display pages
    initPublic: function (onStateUpdate) {
        // Hide connecting message on connect event
        const setStatus = (connected) => {
            const connectionStatusDot = document.getElementById('connection-status');
            if (!connectionStatusDot) { return };
            connectionStatusDot.classList.toggle('hidden', connected);
        };

        this.socket = io('/public');
        this.socket.on('connect', () => setStatus(true));
        this.socket.on('disconnect', () => setStatus(false));
        this.socket.on('state:full', onStateUpdate);
        this.socket.on('error:msg', (msg) => {
            alert('Server Error: ' + msg);
        });
    },

    // Utility to emit events
    emit: function (event, data) {
        if (this.socket) this.socket.emit(event, data);
    }
};
