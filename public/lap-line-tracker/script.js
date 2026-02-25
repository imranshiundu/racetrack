/**
 * Lap-line Tracker Script (Refactored for Tailwind CSS)
 */

(function () {
    const CAR_SVG = (colorClass) => `
        <svg viewBox="0 0 24 24" fill="none" class="w-16 h-16 ${colorClass} opacity-20 group-active:opacity-100 transition-opacity" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
        </svg>
    `;

    const CAR_COLORS = {
        1: 'text-red-500', 2: 'text-blue-500', 3: 'text-green-500', 4: 'text-yellow-500',
        5: 'text-purple-500', 6: 'text-orange-500', 7: 'text-pink-500', 8: 'text-cyan-500'
    };

    const CAR_PILL_COLORS = { 1: 'bg-red-500', 2: 'bg-blue-500', 3: 'bg-green-500', 4: 'bg-yellow-500', 5: 'bg-purple-500', 6: 'bg-orange-500', 7: 'bg-pink-500', 8: 'bg-cyan-500' };

    Racetrack.init('/lap-tracker', (state) => {
        const overlay = document.getElementById('end-overlay');
        const flagStatus = document.getElementById('flag-status');
        const raceName = document.getElementById('race-name');

        // Flag Indicator
        const flagColors = {
            'safe': 'bg-emerald-500',
            'hazard': 'bg-amber-400',
            'danger': 'bg-red-600',
            'finish': 'bg-white',
            'idle': 'bg-slate-800'
        };

        flagStatus.className = `w-16 h-16 rounded-2xl border-4 border-white/10 shadow-xl transition-all duration-500 ${flagColors[state.raceState.mode] || flagColors.idle}`;

        // Session Lock UI
        if (state.currentSession) {
            overlay.classList.add('hidden');
            raceName.innerText = state.currentSession.name;

            for (let i = 1; i <= 8; i++) {
                const driver = state.currentDrivers.find(d => d.car_number === i);
                const btn = document.getElementById(`btn-${i}`);
                const nameLabel = document.getElementById(`name-${i}`);
                const pill = btn.querySelector('.car-pill');
                const avatarContainer = btn.querySelector('.avatar-container');

                if (driver) {
                    nameLabel.innerText = driver.name;
                    nameLabel.classList.remove('text-slate-700');
                    nameLabel.classList.add('text-slate-400');
                    btn.disabled = false;
                    btn.classList.add('hover:border-indigo-500/50');
                    pill.className = `car-pill absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 ${CAR_PILL_COLORS[i]} text-white text-[0.625rem] font-black tracking-widest rounded-full opacity-60 group-hover:opacity-100 transition-opacity`;
                    avatarContainer.innerHTML = CAR_SVG(CAR_COLORS[i]);
                } else {
                    nameLabel.innerText = 'UNASSIGNED';
                    nameLabel.classList.add('text-slate-700');
                    btn.disabled = true;
                    btn.classList.remove('hover:border-indigo-500/50');
                    pill.className = `hidden`;
                    avatarContainer.innerHTML = '';
                }
            }
        } else {
            overlay.classList.remove('hidden');
            raceName.innerText = "TRACK CLOSED";
            for (let i = 1; i <= 8; i++) {
                document.getElementById(`name-${i}`).innerText = '-';
                document.getElementById(`btn-${i}`).disabled = true;
                document.getElementById(`btn-${i}`).querySelector('.avatar-container').innerHTML = '';
            }
        }
    });

    window.recordLap = (carNum) => {
        const btn = document.getElementById(`btn-${carNum}`);
        const numSpan = btn.querySelector('.text-8xl');

        // Visual feedback
        numSpan.classList.remove('text-white/10');
        numSpan.classList.add('text-white', 'scale-110');
        setTimeout(() => {
            numSpan.classList.add('text-white/10');
            numSpan.classList.remove('text-white', 'scale-110');
        }, 300);

        Racetrack.emit('lap:record', { carNumber: carNum });
    };
})();
