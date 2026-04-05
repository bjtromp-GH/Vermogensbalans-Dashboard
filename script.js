// State Management
let state = {
    isDarkMode: localStorage.getItem('theme') === 'dark',
    date: new Date().toISOString().split('T')[0],
    // Load current balance from localStorage or use defaults
    assets: JSON.parse(localStorage.getItem('current_assets')) || [
        { id: '1', description: 'Spaarrekening', amount: 5000 },
        { id: '2', description: 'Beleggingen', amount: 2500 }
    ],
    debts: JSON.parse(localStorage.getItem('current_debts')) || [
        { id: '1', description: 'Hypotheek', amount: 1000 },
        { id: '2', description: 'Persoonlijke lening', amount: 500 }
    ],
    history: JSON.parse(localStorage.getItem('balance_history') || '[]'),
    goal: parseFloat(localStorage.getItem('net_worth_goal') || '100000')
};

// Charts Instances
let historyChart = null;
let doughnutChart = null;

// Initialization
function init() {
    // Apply theme
    if (state.isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Set initial values in UI
    document.getElementById('balance-date').value = state.date;
    document.getElementById('goal-input').value = formatInputNumber(state.goal);

    // Event Listeners
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('theme-toggle-mobile').addEventListener('click', toggleTheme);
    
    document.getElementById('balance-date').addEventListener('change', (e) => {
        state.date = e.target.value;
    });

    const goalInput = document.getElementById('goal-input');
    goalInput.addEventListener('input', (e) => {
        const cleanValue = e.target.value.replace(/\./g, '').replace(',', '.');
        state.goal = parseFloat(cleanValue) || 0;
        localStorage.setItem('net_worth_goal', state.goal);
        updateCalculations();
    });
    goalInput.addEventListener('blur', (e) => {
        e.target.value = formatInputNumber(state.goal);
    });
    goalInput.addEventListener('focus', (e) => {
        e.target.value = state.goal || '';
    });

    document.getElementById('add-asset').addEventListener('click', () => addRow('assets'));
    document.getElementById('add-debt').addEventListener('click', () => addRow('debts'));
    document.getElementById('save-btn').addEventListener('click', saveBalance);

    // Initial Render
    renderRows('assets');
    renderRows('debts');
    renderHistory();
    
    // Initialize Charts after a short delay to ensure container size is calculated
    setTimeout(() => {
        initCharts();
        updateCalculations();
    }, 100);
    
    // Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Theme Toggle
function toggleTheme() {
    state.isDarkMode = !state.isDarkMode;
    localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark');
    updateChartsTheme();
}

// Row Management
function addRow(type) {
    const newRow = { 
        id: Math.random().toString(36).substr(2, 9), 
        description: '', 
        amount: 0 
    };
    state[type].push(newRow);
    renderRows(type);
    saveCurrentState();
    updateCalculations();
}

function removeRow(type, id) {
    state[type] = state[type].filter(r => r.id !== id);
    renderRows(type);
    saveCurrentState();
    updateCalculations();
}

function updateRow(type, id, field, value) {
    const row = state[type].find(r => r.id === id);
    if (row) {
        if (field === 'amount') {
            // Parse Dutch format (1.250,50 -> 1250.50)
            const cleanValue = value.replace(/\./g, '').replace(',', '.');
            row.amount = parseFloat(cleanValue) || 0;
        } else {
            row[field] = value;
        }
        saveCurrentState();
        updateCalculations();
    }
}

function formatInputNumber(value) {
    if (value === 0 || !value) return '';
    return new Intl.NumberFormat('nl-NL', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    }).format(value);
}

function saveCurrentState() {
    localStorage.setItem('current_assets', JSON.stringify(state.assets));
    localStorage.setItem('current_debts', JSON.stringify(state.debts));
}

function renderRows(type) {
    const container = document.getElementById(`${type}-list`);
    container.innerHTML = '';
    
    state[type].forEach(row => {
        const div = document.createElement('div');
        div.className = 'flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-3 sm:p-0 rounded-xl sm:rounded-none bg-slate-50/50 sm:bg-transparent dark:bg-slate-800/30 sm:dark:bg-transparent border sm:border-none border-slate-100 dark:border-slate-800 animate-fade-in';
        
        div.innerHTML = `
            <input type="text" placeholder="Omschrijving" value="${row.description}" 
                class="flex-grow p-2.5 sm:p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm md:text-base bg-white border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                oninput="updateRow('${type}', '${row.id}', 'description', this.value)">
            <div class="flex items-center gap-2">
                <div class="relative flex-grow sm:w-32 md:w-40">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                    <input type="text" placeholder="0,00" value="${formatInputNumber(row.amount)}" 
                        class="w-full pl-7 pr-3 py-2.5 sm:py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-right text-sm md:text-base bg-white border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                        onblur="this.value = formatInputNumber(state['${type}'].find(r => r.id === '${row.id}').amount)"
                        onfocus="this.value = state['${type}'].find(r => r.id === '${row.id}').amount || ''"
                        oninput="updateRow('${type}', '${row.id}', 'amount', this.value)">
                </div>
                <button onclick="removeRow('${type}', '${row.id}')" class="p-2.5 sm:p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    if (window.lucide) window.lucide.createIcons();
}

// Calculations
function updateCalculations() {
    const totalAssets = state.assets.reduce((sum, row) => sum + (row.amount || 0), 0);
    const totalDebts = state.debts.reduce((sum, row) => sum + (row.amount || 0), 0);
    const equity = totalAssets - totalDebts;

    // Update Labels
    document.getElementById('stat-assets').innerText = formatCurrency(totalAssets);
    document.getElementById('stat-debts').innerText = formatCurrency(totalDebts);
    document.getElementById('stat-equity').innerText = formatCurrency(equity);
    document.getElementById('total-assets-label').innerText = formatCurrency(totalAssets);
    document.getElementById('equity-label').innerText = formatCurrency(equity);
    document.getElementById('total-passiva-label').innerText = formatCurrency(equity + totalDebts);
    document.getElementById('doughnut-total').innerText = formatCurrency(totalAssets);

    // Balance Status
    const statusEl = document.getElementById('balance-status');
    const diff = Math.abs(totalAssets - (equity + totalDebts));
    if (diff < 0.01) {
        statusEl.innerText = '✓ Balans in evenwicht';
        statusEl.className = 'text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    } else {
        statusEl.innerText = '⚠ Balans niet in evenwicht';
        statusEl.className = 'text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }

    // Goal Tracker
    const percent = state.goal > 0 ? Math.min(100, Math.max(0, (equity / state.goal) * 100)) : 0;
    document.getElementById('goal-percent').innerText = percent.toFixed(1) + '%';
    document.getElementById('goal-remaining').innerText = formatCurrency(Math.max(0, state.goal - equity));
    document.getElementById('goal-progress-bar').style.width = percent + '%';

    // Update Charts
    updateDoughnutChart();
}

function formatCurrency(value) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value);
}

// History Management
function saveBalance() {
    const totalAssets = state.assets.reduce((sum, row) => sum + (row.amount || 0), 0);
    const totalDebts = state.debts.reduce((sum, row) => sum + (row.amount || 0), 0);
    const equity = totalAssets - totalDebts;

    const newEntry = {
        id: Math.random().toString(36).substr(2, 9),
        date: state.date,
        equity: equity,
        // Store full snapshot
        assets: JSON.parse(JSON.stringify(state.assets)),
        debts: JSON.parse(JSON.stringify(state.debts))
    };

    state.history.push(newEntry);
    state.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem('balance_history', JSON.stringify(state.history));
    
    renderHistory();
    updateHistoryChart();
    
    // Visual feedback
    const btn = document.getElementById('save-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="w-6 h-6"></i> Opgeslagen!';
    btn.classList.replace('bg-blue-600', 'bg-green-600');
    if (window.lucide) window.lucide.createIcons();
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.replace('bg-green-600', 'bg-blue-600');
        if (window.lucide) window.lucide.createIcons();
    }, 2000);
}

function loadHistoryEntry(id) {
    const entry = state.history.find(e => e.id === id);
    if (!entry) return;
    
    if (!confirm(`Wil je de balans van ${new Date(entry.date).toLocaleDateString('nl-NL')} laden? Dit overschrijft je huidige invoer.`)) {
        return;
    }

    // Update state
    state.date = entry.date;
    state.assets = JSON.parse(JSON.stringify(entry.assets || []));
    state.debts = JSON.parse(JSON.stringify(entry.debts || []));
    
    // Update UI
    document.getElementById('balance-date').value = state.date;
    renderRows('assets');
    renderRows('debts');
    saveCurrentState();
    updateCalculations();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteHistoryEntry(id) {
    if (!confirm('Weet je zeker dat je dit historisch punt wilt verwijderen?')) return;
    state.history = state.history.filter(e => e.id !== id);
    localStorage.setItem('balance_history', JSON.stringify(state.history));
    renderHistory();
    updateHistoryChart();
}

function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    
    if (state.history.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">Geen opgeslagen data</p>';
        return;
    }

    [...state.history].reverse().forEach(entry => {
        const div = document.createElement('div');
        div.className = 'group flex items-center justify-between p-3 rounded-xl border transition-all bg-slate-50/50 border-slate-100 hover:border-blue-200 dark:bg-slate-800/50 dark:border-slate-700 dark:hover:border-blue-500 cursor-pointer';
        div.onclick = (e) => {
            // Prevent loading if clicking delete button
            if (e.target.closest('.delete-btn')) return;
            loadHistoryEntry(entry.id);
        };
        
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </div>
                <div>
                    <div class="text-xs font-bold text-slate-500 uppercase">${new Date(entry.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })} ${!entry.assets ? '(Alleen bedrag)' : ''}</div>
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-200">${formatCurrency(entry.equity)}</div>
                </div>
            </div>
            <button onclick="deleteHistoryEntry('${entry.id}')" class="delete-btn p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        container.appendChild(div);
    });
    if (window.lucide) window.lucide.createIcons();
}

// Charts
function initCharts() {
    const ctxHistory = document.getElementById('historyChart').getContext('2d');
    historyChart = new Chart(ctxHistory, {
        type: 'line',
        data: {
            labels: state.history.map(e => new Date(e.date).toLocaleDateString('nl-NL')),
            datasets: [{
                label: 'Eigen Vermogen',
                data: state.history.map(e => e.equity),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: { 
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: (value) => '€' + value.toLocaleString('nl-NL') }
                },
                x: { grid: { display: false } }
            }
        }
    });

    const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');
    doughnutChart = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: state.assets.map(a => a.description || 'Onbekend'),
            datasets: [{
                data: state.assets.map(a => a.amount),
                backgroundColor: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#2563eb', '#1d4ed8'],
                borderWidth: 2,
                borderColor: state.isDarkMode ? '#0f172a' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        boxWidth: 12, 
                        font: { size: 10 },
                        padding: 15
                    } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + formatCurrency(context.parsed);
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
    
    updateChartsTheme();
}

function updateHistoryChart() {
    if (!historyChart) return;
    historyChart.data.labels = state.history.map(e => new Date(e.date).toLocaleDateString('nl-NL'));
    historyChart.data.datasets[0].data = state.history.map(e => e.equity);
    historyChart.update();
}

function updateDoughnutChart() {
    if (!doughnutChart) return;
    const validAssets = state.assets.filter(a => a.amount > 0);
    doughnutChart.data.labels = validAssets.map(a => a.description || 'Onbekend');
    doughnutChart.data.datasets[0].data = validAssets.map(a => a.amount);
    doughnutChart.update();
}

function updateChartsTheme() {
    const textColor = state.isDarkMode ? '#94a3b8' : '#64748b';
    const gridColor = state.isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    
    if (historyChart) {
        historyChart.options.scales.x.ticks.color = textColor;
        historyChart.options.scales.y.ticks.color = textColor;
        historyChart.options.scales.y.grid.color = gridColor;
        historyChart.update();
    }
    
    if (doughnutChart) {
        doughnutChart.options.plugins.legend.labels.color = textColor;
        doughnutChart.data.datasets[0].borderColor = state.isDarkMode ? '#0f172a' : '#ffffff';
        doughnutChart.update();
    }
}

// Global exposure for inline event handlers
window.updateRow = updateRow;
window.removeRow = removeRow;
window.deleteHistoryEntry = deleteHistoryEntry;

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
