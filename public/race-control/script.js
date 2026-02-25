/**
 * Race Control Script (Refactored for Tailwind CSS)
 */

(function () {
    let timerInterval = null;
    const CAR_AVATARS = { 1: '🏎️', 2: '🏎️', 3: '🏎️', 4: '🏎️', 5: '🏎️', 6: '🏎️', 7: '🏎️', 8: '🏎️' };
    const CAR_COLORS = { 1: 'bg-red-500', 2: 'bg-blue-500', 3: 'bg-green-500', 4: 'bg-yellow-500', 5: 'bg-purple-500', 6: 'bg-orange-500', 7: 'bg-pink-500', 8: 'bg-cyan-500' };

    Racetrack.init('/race-control', (state) => {
        const statusText = document.getElementById('status-text');
        const timerDisplay = document.getElementById('timer-display');
        const sessionTitle = document.getElementById('session-title');
        const driverStatus = document.getElementById('driver-status');
        const actionArea = document.getElementById('action-area');
        const nextBriefing = document.getElementById('next-briefing');

        // Flag UI Updates
        const modes = ['safe', 'hazard', 'danger', 'finish'];
        modes.forEach(m => {
            const btn = document.getElementById(`btn-${m}`);
            if (btn) {
                btn.classList.remove('border-white', 'scale-[1.02]', 'shadow-2xl');
                if (m === state.raceState.mode) {
                    btn.classList.add('border-white', 'scale-[1.02]', 'shadow-2xl');
                }
            }
        });

        // Timer Sync
        // Only run the countdown if there is an active session and it's in a running mode
        if (state.currentSession && state.timerRemaining > 0 && state.raceState.mode !== 'finish' && state.raceState.mode !== 'idle') {
            syncLocalTimer(state.timerRemaining);
        } else {
            clearInterval(timerInterval);
            timerDisplay.innerText = state.timerRemaining <= 0 ? "00:00.0" : formatFullTime(state.timerRemaining);
            timerDisplay.classList.remove('text-indigo-500');
            timerDisplay.classList.add('text-slate-700');
        }

        // Active Session Logic
        if (state.currentSession) {
            statusText.innerText = `RACE IN PROGRESS`;
            statusText.classList.remove('text-slate-500');
            statusText.classList.add('text-emerald-400');
            sessionTitle.innerText = state.currentSession.name;
            driverStatus.innerText = `${state.currentDrivers.length} Cars on Track`;

            if (state.raceState.mode === 'finish') {
                actionArea.innerHTML = renderActionBtn('Declare Race Over', 'bg-red-600 hover:bg-red-500', "Racetrack.emit('race:end')");
            } else {
                actionArea.innerHTML = renderActionBtn('Emergency Finish', 'bg-slate-800 hover:bg-red-900', "Racetrack.emit('race:mode', {mode:'finish'})");
            }
        } else {
            statusText.innerText = `READY TO START`;
            statusText.classList.remove('text-emerald-400');
            statusText.classList.add('text-slate-500');
            sessionTitle.innerText = "No Active Race";
            driverStatus.innerText = "Standing by for Next Group";

            if (state.nextSession) {
                actionArea.innerHTML = renderActionBtn(`START ${state.nextSession.name.toUpperCase()}`, 'bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 py-8 text-2xl', "Racetrack.emit('race:start')");
            } else {
                actionArea.innerHTML = `<button class="w-full py-6 bg-slate-800 text-slate-500 font-bold rounded-2xl cursor-not-allowed" disabled>Waiting for Reception...</button>`;
            }
        }

        // Briefing Info (with Avatars)
        if (state.nextSession) {
            const driversList = state.nextDrivers.map(d => `
                <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                    <div class="w-10 h-10 flex items-center justify-center text-xl rounded-lg ${CAR_COLORS[d.car_number]} shadow-inner">
                        ${CAR_AVATARS[d.car_number]}
                    </div>
                    <div>
                        <div class="font-bold text-sm">${d.name}</div>
                        <div class="text-[0.625rem] font-black text-slate-500 uppercase">CAR ${d.car_number}</div>
                    </div>
                </div>
            `).join('');

            nextBriefing.innerHTML = `
                <div class="bg-indigo-600/5 border border-indigo-500/20 rounded-[2rem] p-8">
                    <div class="text-[0.625rem] font-black tracking-[0.25em] text-indigo-400 uppercase mb-4">NEXT BRIEFING</div>
                    <div class="text-xl font-bold mb-6">${state.nextSession.name}</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        ${driversList}
                    </div>
                </div>
            `;
        } else {
            nextBriefing.innerHTML = `
                <div class="p-12 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                    <div class="text-slate-600 font-medium">No upcoming sessions configured by Reception.</div>
                </div>
            `;
        }
    });

    function renderActionBtn(label, bgClass, onClick) {
        return `<button class="w-full py-6 ${bgClass} text-white font-black rounded-2xl transition-all shadow-lg uppercase tracking-widest active:scale-95" onclick="${onClick}">${label}</button>`;
    }

    function formatFullTime(ms) {
        const totalSec = ms / 1000;
        const m = Math.floor(totalSec / 60);
        const s = Math.floor(totalSec % 60);
        const ds = Math.floor((ms % 1000) / 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ds}`;
    }

    function syncLocalTimer(remainingMs) {
        clearInterval(timerInterval);
        const display = document.getElementById('timer-display');
        display.classList.add('text-indigo-500');
        display.classList.remove('text-slate-700');

        let localRemaining = remainingMs;
        display.innerText = formatFullTime(localRemaining);

        timerInterval = setInterval(() => {
            localRemaining -= 100;
            if (localRemaining <= 0) {
                display.innerText = "00:00.0";
                display.classList.remove('text-indigo-500');
                display.classList.add('text-slate-700');
                clearInterval(timerInterval);
            } else {
                display.innerText = formatFullTime(localRemaining);
            }
        }, 100);
    }

    window.maximizeControl = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
        } else {
            document.exitFullscreen();
        }
    };
})();
