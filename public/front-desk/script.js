/**
 * Front Desk Script (Refactored for Tailwind CSS and Premium SVG Avatars)
 */

(function () {
    // Premium SVG Car Silhouettes
    const CAR_SVG = (colorClass) => `
        <svg viewBox="0 0 24 24" fill="none" class="w-8 h-8 ${colorClass}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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

    const CAR_BG_COLORS = {
        1: 'bg-red-500/10', 2: 'bg-blue-500/10', 3: 'bg-green-500/10', 4: 'bg-yellow-500/10',
        5: 'bg-purple-500/10', 6: 'bg-orange-500/10', 7: 'bg-pink-500/10', 8: 'bg-cyan-500/10'
    };

    Racetrack.init('/front-desk', (state) => {
        const container = document.getElementById('sessions-container');
        container.innerHTML = '';

        state.pendingSessions.forEach(session => {
            const drivers = state.allPendingDrivers[session.id] || [];
            const card = document.createElement('div');
            card.className = 'bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-[2.5rem] p-8 hover:border-indigo-500/30 transition-all duration-300 shadow-2xl';

            const driversListHtml = drivers.length > 0
                ? drivers.map(d => renderDriverItem(d)).join('')
                : `<div class="py-12 text-center text-slate-600 font-medium italic">No drivers registered yet.</div>`;

            const usedCars = drivers.map(d => d.car_number);
            const carOptionsHtml = Array.from({ length: 8 }, (_, i) => i + 1)
                .map(num => `<option value="${num}" ${usedCars.includes(num) ? 'disabled' : ''}>Car ${num} ${usedCars.includes(num) ? '(Taken)' : ''}</option>`)
                .join('');

            card.innerHTML = `
                <div class="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                    <div>
                        <h3 class="text-xl font-black tracking-tight">${session.name}</h3>
                        <div class="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase mt-1">Pending Registration</div>
                    </div>
                    <button class="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" onclick="deleteSession('${session.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                    </button>
                </div>

                <div class="space-y-3 mb-10">
                    ${driversListHtml}
                </div>

                <div class="bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                    <div class="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase mb-4">Register New Driver</div>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <input type="text" placeholder="Full Name" id="name-${session.id}" class="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500 transition-all font-medium">
                        <select id="car-${session.id}" class="bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-indigo-500 transition-all font-bold appearance-none min-w-[120px]">
                            <option value="">Auto Car</option>
                            ${carOptionsHtml}
                        </select>
                        <button class="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95" onclick="addDriver('${session.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        if (state.pendingSessions.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-40 bg-slate-900/20 border-4 border-dashed border-white/5 rounded-[4rem]">
                    <div class="w-24 h-24 bg-indigo-600/10 rounded-full flex items-center justify-center mb-8 border border-indigo-500/10">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                    </div>
                    <h2 class="text-3xl font-black mb-3 tracking-tighter">No Active Sessions</h2>
                    <p class="text-slate-500 font-medium">Clear for take-off. Use the "New Race Session" button to begin.</p>
                </div>
            `;
        }
    });

    function renderDriverItem(d) {
        return `
            <div class="flex items-center justify-between p-4 bg-slate-950/40 rounded-[1.5rem] border border-white/5 group hover:border-indigo-500/40 transition-all">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 flex items-center justify-center rounded-2xl ${CAR_BG_COLORS[d.car_number] || 'bg-slate-800'} shadow-inner border border-white/5">
                        ${CAR_SVG(CAR_COLORS[d.car_number])}
                    </div>
                    <div>
                        <div class="font-bold text-lg tracking-tight">${d.name}</div>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">CAR UNIT</span>
                            <span class="text-[9px] font-black ${CAR_COLORS[d.car_number]} tracking-[0.2em] uppercase">NO. 00${d.car_number}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all" onclick="editDriver('${d.id}', '${d.name}', ${d.car_number})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" onclick="removeDriver('${d.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }

    window.addDriver = (sessionId) => {
        const nameInput = document.getElementById(`name-${sessionId}`);
        const carInput = document.getElementById(`car-${sessionId}`);
        const name = nameInput.value.trim();
        const carNumber = carInput.value;
        if (!name) return;
        Racetrack.emit('driver:add', { sessionId, name, carNumber });
        nameInput.value = '';
    };

    window.deleteSession = (sessionId) => {
        if (confirm('Permanently delete this session and all its drivers?')) {
            Racetrack.emit('session:delete', { sessionId });
        }
    };

    window.removeDriver = (driverId) => {
        Racetrack.emit('driver:remove', { driverId });
    };

    window.editDriver = (driverId, currentName, carNumber) => {
        const newName = prompt('Modify driver name:', currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
            Racetrack.emit('driver:update', { driverId, name: newName.trim(), carNumber });
        }
    };
})();
