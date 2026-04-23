document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('loading');
    const errorContainer = document.getElementById('error');
    const resultsContainer = document.getElementById('results');
    
    const redirectCountEl = document.getElementById('redirectCount');
    const totalTimeEl = document.getElementById('totalTime');
    const verdictTextEl = document.getElementById('verdictText');
    const warningMsgEl = document.getElementById('warningMsg');
    const chainListEl = document.getElementById('chainList');

    analyzeBtn.addEventListener('click', analyzeUrl);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') analyzeUrl();
    });

    async function analyzeUrl() {
        const url = urlInput.value.trim();
        if (!url) return;

        // Reset UI
        errorContainer.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        warningMsgEl.classList.add('hidden');
        loading.classList.remove('hidden');
        analyzeBtn.disabled = true;

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                // We might still have a chain to display even if there's an error (e.g. timeout mid-chain)
                if (data.chain && data.chain.length > 0) {
                    renderResults(data);
                }
                throw new Error(data.error || 'An error occurred during analysis.');
            }

            renderResults(data);
            
        } catch (err) {
            errorContainer.textContent = err.message;
            errorContainer.classList.remove('hidden');
        } finally {
            loading.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    }

    function renderResults(data) {
        // Summary
        redirectCountEl.textContent = data.count;
        totalTimeEl.textContent = data.total_time.toFixed(3) + 's';

        // Verdict
        verdictTextEl.className = 'stat-value'; // Reset classes
        if (data.verdict === 0) {
            verdictTextEl.textContent = 'Efficient';
            verdictTextEl.classList.add('verdict-efficient');
        } else if (data.verdict === 1) {
            verdictTextEl.textContent = 'Normal';
            verdictTextEl.classList.add('verdict-normal');
        } else {
            verdictTextEl.textContent = 'Inefficient';
            verdictTextEl.classList.add('verdict-inefficient');
        }

        // Warning for too many redirects
        if (data.count > 3) {
            warningMsgEl.classList.remove('hidden');
        } else {
            warningMsgEl.classList.add('hidden');
        }

        // Render Chain
        chainListEl.innerHTML = '';
        
        data.chain.forEach((step, index) => {
            const li = document.createElement('li');
            li.className = 'chain-item';
            
            // Mark the last item as final (green dot) or error (red dot)
            if (index === data.chain.length - 1) {
                if (step.status_code === 0 || step.status_code >= 400) {
                    li.classList.add('error-item');
                } else if (step.status_code >= 200 && step.status_code < 300) {
                    li.classList.add('final-item');
                }
            }

            // Domain change logic
            let currentDomain = '';
            let prevDomain = '';
            try {
                currentDomain = new URL(step.url).hostname;
                if (index > 0) {
                    prevDomain = new URL(data.chain[index-1].url).hostname;
                }
            } catch(e) {
                // fallback if url parsing fails
            }

            // Highlight if domain differs from the previous step
            const isDomainChange = index > 0 && currentDomain !== prevDomain;
            const urlHtml = isDomainChange 
                ? `<div class="step-url"><span class="domain-diff">Cross-Domain</span> ${escapeHtml(step.url)}</div>`
                : `<div class="step-url">${escapeHtml(step.url)}</div>`;

            // Status code styling
            let statusClass = 'status-error';
            if (step.status_code >= 200 && step.status_code < 300) statusClass = 'status-200';
            else if (step.status_code >= 300 && step.status_code < 400) statusClass = 'status-3xx';

            // Special case for our manual "0" status code generated on exceptions
            const statusDisplay = step.status_code === 0 ? 'Failed' : `HTTP ${step.status_code}`;

            li.innerHTML = `
                <div class="step-details">
                    ${urlHtml}
                    <div class="step-meta">
                        <span class="status-code ${statusClass}">${statusDisplay}</span>
                        <span class="time-taken">⏱ ${step.time_taken.toFixed(3)}s</span>
                    </div>
                </div>
            `;
            chainListEl.appendChild(li);
        });

        resultsContainer.classList.remove('hidden');
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
